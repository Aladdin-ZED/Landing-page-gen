import "server-only";
/**
 * pageKey → the PUBLISHED document a public request is about (never a draft).
 *  - live pages: pages.publicKey, page published, its publishedVersionId
 *  - exports:    exports.publicKey, not revoked, the version baked into the export
 * Version documents are immutable, so parsed docs are cached by version id.
 *
 * orderVersion(target, payload) — which published version an order is validated against
 * (docs/OFFERS.md §G.2): the version the shopper saw while it was replaced less than 72 h ago, else
 * the current one with `fallback` (the validation then answers "stale" on any mismatch).
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exportsTable, pages, pageVersions } from "@/lib/db/schema";
import type { PageDoc } from "@/lib/page/schema";
import { chooseOrderVersion, orderDocOf } from "./versions";

export const PAGE_KEY_RE = /^[a-zA-Z0-9_-]{8,80}$/;

export interface PageTarget {
  kind: "page" | "export";
  pageId: string;
  versionId: string;
  exportId: string | null;
  exportMode: "connected" | "php" | "whatsapp" | null;
  /** origins allowed to call the API cross-origin (exports only) */
  allowedOrigins: string[];
  doc: PageDoc;
  source: "live" | "export";
}

/** "order": orders/leads/upsells (connected exports only) · "event": analytics (any active export). */
export type ResolvePurpose = "order" | "event";

const DOC_CACHE_MAX = 64;
const KEY_TTL_MS = 15_000;

declare global {
  var __codOrderCache:
    | {
        docs: Map<string, PageDoc>;
        keys: Map<string, { at: number; value: Omit<PageTarget, "doc"> | null }>;
        captcha: Map<string, boolean>;
      }
    | undefined;
}

const cache = () =>
  (globalThis.__codOrderCache ??= { docs: new Map(), keys: new Map(), captcha: new Map() });

/** Parsed, validated document of a page version (cached; versions never change). */
export async function versionDoc(versionId: string): Promise<PageDoc | null> {
  const docs = cache().docs;
  const hit = docs.get(versionId);
  if (hit) {
    docs.delete(versionId);
    docs.set(versionId, hit);
    return hit;
  }
  const [row] = await db.select({ doc: pageVersions.doc }).from(pageVersions).where(eq(pageVersions.id, versionId)).limit(1);
  if (!row) return null;
  const doc = await orderDocOf(row.doc, versionId);
  if (!doc) return null;
  docs.set(versionId, doc);
  while (docs.size > DOC_CACHE_MAX) docs.delete(docs.keys().next().value!);
  return doc;
}

export { STALE_WINDOW_MS } from "./versions";

export interface OrderVersion {
  versionId: string;
  doc: PageDoc;
  /** the current version, used although the shopper may have seen another one: mismatches answer "stale" */
  fallback: boolean;
}

/**
 * The version an order is validated against (§G.2, rule in ./versions.ts chooseOrderVersion): an
 * export's pinned version; on live pages the version the shopper's tab was rendered from while it was
 * replaced less than 72 h ago, else the current one with `fallback`. A database error falls back to the
 * current version without `fallback` (v1 behaviour).
 */
export async function orderVersion(target: PageTarget, payload: { v?: unknown; ver?: unknown }, now = Date.now()): Promise<OrderVersion> {
  const current: OrderVersion = { versionId: target.versionId, doc: target.doc, fallback: false };
  if (target.kind === "export") return current;
  if (payload.v === 2 && payload.ver === target.versionId) return current;
  try {
    const rows = await db
      .select({ id: pageVersions.id, createdAt: pageVersions.createdAt, runtimeV: pageVersions.runtimeV })
      .from(pageVersions)
      .where(and(eq(pageVersions.pageId, target.pageId), eq(pageVersions.kind, "publish")))
      .orderBy(desc(pageVersions.createdAt))
      .limit(200);
    const choice = chooseOrderVersion(target.versionId, rows, payload, now);
    if (choice.versionId === target.versionId) return { ...current, fallback: choice.fallback };
    const doc = await versionDoc(choice.versionId);
    return doc ? { versionId: choice.versionId, doc, fallback: false } : { ...current, fallback: true };
  } catch (err) {
    console.error("[orders] version lookup failed, using the current version:", err instanceof Error ? err.message : "unknown error");
    return current;
  }
}

async function lookup(pageKey: string): Promise<Omit<PageTarget, "doc"> | null> {
  const [page] = await db
    .select({ id: pages.id, status: pages.status, versionId: pages.publishedVersionId })
    .from(pages)
    .where(eq(pages.publicKey, pageKey))
    .limit(1);
  if (page) {
    if (page.status !== "published" || !page.versionId) return null;
    return {
      kind: "page",
      pageId: page.id,
      versionId: page.versionId,
      exportId: null,
      exportMode: null,
      allowedOrigins: [],
      source: "live",
    };
  }
  const [exp] = await db
    .select({
      id: exportsTable.id,
      pageId: exportsTable.pageId,
      versionId: exportsTable.versionId,
      mode: exportsTable.mode,
      allowedOrigins: exportsTable.allowedOrigins,
    })
    .from(exportsTable)
    .where(and(eq(exportsTable.publicKey, pageKey), isNull(exportsTable.revokedAt)))
    .limit(1);
  if (!exp) return null;
  return {
    kind: "export",
    pageId: exp.pageId,
    versionId: exp.versionId,
    exportId: exp.id,
    exportMode: exp.mode,
    allowedOrigins: Array.isArray(exp.allowedOrigins) ? exp.allowedOrigins.filter((o) => typeof o === "string") : [],
    source: "export",
  };
}

/**
 * Resolve a public page key. Orders always read fresh page state (a just-unpublished page stops taking
 * orders immediately); analytics beacons use a 15 s cache.
 */
export async function resolvePageKey(pageKey: string, purpose: ResolvePurpose): Promise<PageTarget | null> {
  if (!PAGE_KEY_RE.test(pageKey)) return null;
  let base: Omit<PageTarget, "doc"> | null;
  const keys = cache().keys;
  const hit = purpose === "event" ? keys.get(pageKey) : undefined;
  if (hit && Date.now() - hit.at < KEY_TTL_MS) {
    base = hit.value;
  } else {
    base = await lookup(pageKey);
    keys.set(pageKey, { at: Date.now(), value: base });
    if (keys.size > 2000) keys.delete(keys.keys().next().value!);
  }
  if (!base) return null;
  if (purpose === "order" && base.kind === "export" && base.exportMode !== "connected") return null;
  const doc = await versionDoc(base.versionId);
  return doc ? { ...base, doc } : null;
}

/** Does the published HTML of this version embed the Turnstile widget for `siteKey`? (cached) */
export async function versionEmbedsSiteKey(versionId: string, siteKey: string): Promise<boolean> {
  const k = `${versionId}:${siteKey}`;
  const c = cache().captcha;
  const hit = c.get(k);
  if (hit !== undefined) return hit;
  const [row] = await db
    .select({ found: sql<number>`LOCATE(${siteKey}, COALESCE(${pageVersions.html}, ''))` })
    .from(pageVersions)
    .where(eq(pageVersions.id, versionId))
    .limit(1);
  const found = Number(row?.found ?? 0) > 0;
  c.set(k, found);
  if (c.size > 500) c.delete(c.keys().next().value!);
  return found;
}
