import "server-only";
/**
 * Asset helpers for admin lists: slim asset rows for thumbnails/previews (only what the landing
 * renderer needs), and the media library's default alt text.
 *
 * Alt text convention: assets have no dedicated column, so the library keeps the default alt as a
 * tag "alt:<text>" in assets.tags (searchable by the media API's `q`). Pages keep their own alt on
 * each AssetRef; this default pre-fills it when an image is picked.
 */
import { and, count, eq, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assets, pages, pageVersions } from "@/lib/db/schema";
import { getAssetsByIds, ASSET_ID_RE } from "@/lib/media";
import { assetRowOf } from "@/lib/media/asset-row";
import type { AssetRef, PageDoc } from "@/lib/page/schema";
import { getSetting } from "@/lib/settings";
import { collectAssetIds, type AssetRowLike } from "@/landing/context";

export type PreviewAssetRow = AssetRowLike;
export type PreviewAssetMap = Record<string, PreviewAssetRow>;

export const ALT_TAG_PREFIX = "alt:";
export const ALT_MAX = 200;

export function altFromTags(tags: readonly string[] | null | undefined): string {
  const tag = tags?.find((t) => t.startsWith(ALT_TAG_PREFIX));
  return tag ? tag.slice(ALT_TAG_PREFIX.length) : "";
}


/** Asset rows (by id) for every image the documents (and extra refs, e.g. the store logo) reference. */
export async function previewAssetsFor(docs: readonly PageDoc[], extra: readonly (AssetRef | undefined)[] = []): Promise<PreviewAssetMap> {
  const ids = new Set<string>();
  for (const doc of docs) for (const id of collectAssetIds(doc, [...extra])) ids.add(id);
  for (const ref of extra) if (ref?.id) ids.add(ref.id);
  if (!ids.size) return {};
  const rows = await getAssetsByIds([...ids]);
  // the renderer row every path shares (subject analysis included): previews crop like the live page
  return Object.fromEntries(rows.map((r) => [r.id, assetRowOf(r)]));
}

/** Strip control characters and collapse whitespace; ≤ ALT_MAX chars. */
export function cleanAlt(input: string): string {
  return input
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ALT_MAX);
}

/** Set (or clear, with "") the library's default alt text of an asset. Returns false if unknown. */
export async function setAssetAlt(id: string, alt: string): Promise<boolean> {
  if (!ASSET_ID_RE.test(id)) return false;
  const [row] = await db.select({ tags: assets.tags }).from(assets).where(eq(assets.id, id)).limit(1);
  if (!row) return false;
  const value = cleanAlt(alt);
  const tags = (row.tags ?? []).filter((t) => !t.startsWith(ALT_TAG_PREFIX));
  if (value) tags.push(ALT_TAG_PREFIX + value);
  await db.update(assets).set({ tags }).where(eq(assets.id, id));
  return true;
}

export interface AssetUsage {
  /** non-archived pages whose draft or live version shows the file */
  pages: { id: string; name: string; slug: string; inDraft: boolean; live: boolean }[];
  /** the file is the store logo (Settings → Store) */
  storeLogo: boolean;
}

/** LIKE pattern matching an asset id inside stored document JSON (ids are lowercase hex: no wildcards). */
const idNeedle = (id: string) => `%"${id}"%`;

/**
 * Published pages whose LIVE version shows the file (what visitors see right now). Asset ids are
 * lowercase hex and only ever appear in documents as AssetRef ids, so a text search of the stored
 * JSON is exact.
 */
export async function livePagesUsing(id: string, limit = 200): Promise<{ id: string; name: string; slug: string }[]> {
  if (!ASSET_ID_RE.test(id)) return [];
  return db
    .select({ id: pages.id, name: pages.name, slug: pages.slug })
    .from(pages)
    .innerJoin(pageVersions, eq(pageVersions.id, pages.publishedVersionId))
    .where(and(eq(pages.status, "published"), sql`${pageVersions.doc} LIKE ${idNeedle(id)}`))
    .limit(limit);
}

/** Where a file is used (drafts, live versions, store logo), so deleting it never breaks a page by surprise. */
export async function assetUsage(id: string): Promise<AssetUsage> {
  if (!ASSET_ID_RE.test(id)) return { pages: [], storeLogo: false };
  const [drafts, live, store] = await Promise.all([
    db
      .select({ id: pages.id, name: pages.name, slug: pages.slug })
      .from(pages)
      .where(and(ne(pages.status, "archived"), sql`${pages.draft} LIKE ${idNeedle(id)}`))
      .limit(200),
    livePagesUsing(id),
    getSetting("store"),
  ]);
  const byId = new Map<string, AssetUsage["pages"][number]>();
  for (const p of drafts) byId.set(p.id, { ...p, inDraft: true, live: false });
  for (const p of live) byId.set(p.id, { ...(byId.get(p.id) ?? { ...p, inDraft: false }), live: true });
  return {
    pages: [...byId.values()].sort((a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name)),
    storeLogo: store.logo?.id === id,
  };
}

/** Library counts for the filter chips (images split into photos / cutouts). */
export async function mediaCounts(): Promise<{ all: number; photo: number; cutout: number; video: number }> {
  const rows = await db.select({ kind: assets.kind, alpha: assets.alpha, n: count() }).from(assets).groupBy(assets.kind, assets.alpha);
  const out = { all: 0, photo: 0, cutout: 0, video: 0 };
  for (const r of rows) {
    const n = Number(r.n);
    out.all += n;
    if (r.kind === "video") out.video += n;
    else if (r.alpha) out.cutout += n;
    else out.photo += n;
  }
  return out;
}
