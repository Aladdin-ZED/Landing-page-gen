import "server-only";
/**
 * Export service (admin route handlers call these after requireUser / adminGuard):
 *
 *   getExportContext(pageId, user)       versions, recent exports and defaults for the ExportDialog
 *   estimateExport(request, user)        approximate ZIP size + warnings (no database writes)
 *   buildExport(request, user, ip)       records an exports row (new public key) and returns the ZIP stream
 *   revokeExport(exportId, user, ip)     stops a connected export from taking orders
 *
 * Connected exports are validated by the order API against the version they are bound to; when the
 * stored document needs repairs to render, the repaired document is saved as a new version first, so
 * the API checks orders against exactly what the exported page shows.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, ne, type SQL } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { can, type SessionUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { newId, newPublicKey } from "@/lib/db/ids";
import { exportsTable, pages, pageVersions, users } from "@/lib/db/schema";
import { getAssetsByIds, getMediaFile, getMediaMeta } from "@/lib/media";
import { PageDoc } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { whatsappDigits, whatsappNumber } from "@/lib/render/config";
import { publicOrigin, storeInfo } from "@/lib/render/publish.server";
import { invalidateExportOrigins } from "@/lib/orders/export-origins";
import { errorSummary } from "@/lib/orders/log";
import { getSetting } from "@/lib/settings";
import { collectAssetIds, type StoreInfo } from "@/landing/context";
import { buildBundle, bundleSize, type BundleInput, type MediaSource } from "./bundle";
import { exportFileName, isExportMode, normalizeAllowedOrigins, WHATSAPP_HINT, type ExportMode, type ExportRequest, type ExportRequestField } from "./options";
import { exportServiceAccount, type ExportKey } from "./service-account";
import type { ExportContextResponse, ExportEstimateResponse, ExportRecordJson, ExportVersionJson } from "./types";
import { zipStream } from "./zip";

export class ExportError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "forbidden" | "unavailable",
    message: string,
    readonly fields?: Partial<Record<ExportRequestField, string>>,
  ) {
    super(message);
    this.name = "ExportError";
  }
}

/* ------------------------------------------------------------------ */
/* data access                                                         */
/* ------------------------------------------------------------------ */

/** Media files straight from the database store. */
const dbMedia: MediaSource = {
  async size(key) {
    const meta = await getMediaMeta(key);
    return meta ? meta.bytes : null;
  },
  async read(key) {
    const file = await getMediaFile(key);
    return file ? new Uint8Array(file.data.buffer, file.data.byteOffset, file.data.byteLength) : null;
  },
};

interface VersionRow {
  id: string;
  pageId: string;
  doc: unknown;
  createdAt: Date;
  page: { id: string; name: string; slug: string; status: "draft" | "published" | "archived"; publishedVersionId: string | null };
}

async function loadVersion(versionId: string): Promise<VersionRow> {
  const [row] = await db
    .select({
      id: pageVersions.id,
      pageId: pageVersions.pageId,
      doc: pageVersions.doc,
      createdAt: pageVersions.createdAt,
      name: pages.name,
      slug: pages.slug,
      status: pages.status,
      publishedVersionId: pages.publishedVersionId,
    })
    .from(pageVersions)
    .innerJoin(pages, eq(pages.id, pageVersions.pageId))
    .where(eq(pageVersions.id, versionId))
    .limit(1);
  if (!row) throw new ExportError("not_found", "This version no longer exists.", { versionId: "Choose another version." });
  return {
    id: row.id,
    pageId: row.pageId,
    doc: row.doc,
    createdAt: row.createdAt,
    page: { id: row.pageId, name: row.name, slug: row.slug, status: row.status, publishedVersionId: row.publishedVersionId },
  };
}

function validDoc(raw: unknown): PageDoc {
  const { doc } = validateDoc(raw);
  if (!doc) throw new ExportError("invalid", "This version has errors that must be fixed in the builder before it can be exported.");
  return doc;
}

/** The app's public origin for connected exports, or why connected mode cannot be used. */
function apiOriginState(): { origin: string | null; blocker: string | null } {
  const origin = publicOrigin() ?? null;
  if (!origin) return { origin: null, blocker: "Set PUBLIC_URL to the app's public https address to export connected pages." };
  const u = new URL(origin);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname);
  if (u.protocol !== "https:" && !local) return { origin: null, blocker: "PUBLIC_URL must be an https:// address for connected exports." };
  return { origin, blocker: null };
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function recordJson(r: {
  id: string;
  versionId: string;
  mode: ExportMode;
  allowedOrigins: unknown;
  fileName: string | null;
  bytes: number | null;
  createdAt: Date;
  revokedAt: Date | null;
  createdByName: string | null;
}): ExportRecordJson {
  return {
    id: r.id,
    versionId: r.versionId,
    mode: r.mode,
    allowedOrigins: Array.isArray(r.allowedOrigins) ? r.allowedOrigins.filter((o): o is string => typeof o === "string") : [],
    fileName: r.fileName,
    bytes: r.bytes,
    createdAt: r.createdAt.toISOString(),
    revokedAt: iso(r.revokedAt),
    createdByName: r.createdByName,
  };
}

async function exportRecords(where: SQL, limit: number): Promise<ExportRecordJson[]> {
  const rows = await db
    .select({
      id: exportsTable.id,
      versionId: exportsTable.versionId,
      mode: exportsTable.mode,
      allowedOrigins: exportsTable.allowedOrigins,
      fileName: exportsTable.fileName,
      bytes: exportsTable.bytes,
      createdAt: exportsTable.createdAt,
      revokedAt: exportsTable.revokedAt,
      createdByName: users.name,
    })
    .from(exportsTable)
    .leftJoin(users, eq(users.id, exportsTable.createdBy))
    .where(where)
    .orderBy(desc(exportsTable.createdAt))
    .limit(limit);
  return rows.map(recordJson);
}

/* ------------------------------------------------------------------ */
/* context                                                             */
/* ------------------------------------------------------------------ */

/**
 * `opts.versionId` (e.g. "download again" from the exports history) is listed even when it is older
 * than the 40 most recent versions, as long as it belongs to the page.
 */
export async function getExportContext(pageId: string, user: SessionUser, opts: { versionId?: string } = {}): Promise<ExportContextResponse> {
  const [page] = await db
    .select({ id: pages.id, name: pages.name, slug: pages.slug, status: pages.status, publishedVersionId: pages.publishedVersionId, draft: pages.draft })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page) throw new ExportError("not_found", "Page not found.");

  const versionRows = await db
    .select({ id: pageVersions.id, kind: pageVersions.kind, label: pageVersions.label, createdAt: pageVersions.createdAt })
    .from(pageVersions)
    .where(and(eq(pageVersions.pageId, pageId), ne(pageVersions.kind, "autosave")))
    .orderBy(desc(pageVersions.createdAt))
    .limit(40);
  if (opts.versionId && !versionRows.some((v) => v.id === opts.versionId)) {
    const [extra] = await db
      .select({ id: pageVersions.id, kind: pageVersions.kind, label: pageVersions.label, createdAt: pageVersions.createdAt })
      .from(pageVersions)
      .where(and(eq(pageVersions.id, opts.versionId), eq(pageVersions.pageId, pageId)))
      .limit(1);
    if (extra) versionRows.push(extra);
  }
  const versions: ExportVersionJson[] = versionRows.map((v) => ({
    id: v.id,
    kind: v.kind,
    label: v.label,
    createdAt: v.createdAt.toISOString(),
    published: v.id === page.publishedVersionId,
  }));

  const exports = await exportRecords(eq(exportsTable.pageId, pageId), 20);

  // suggestions: the last connected export's first full origin; WhatsApp of the live page or the store
  const lastOrigin = exports.flatMap((e) => e.allowedOrigins).find((o) => /^https:\/\/[^*]+$/.test(o)) ?? null;
  const [store, sheets] = await Promise.all([storeInfo(), getSetting("sheets")]);
  let liveDoc: PageDoc | null = null;
  if (page.publishedVersionId) {
    const [pv] = await db.select({ doc: pageVersions.doc }).from(pageVersions).where(eq(pageVersions.id, page.publishedVersionId)).limit(1);
    liveDoc = pv ? validateDoc(pv.doc).doc : null;
  }
  liveDoc ??= validateDoc(page.draft).doc;
  const api = apiOriginState();
  const owner = can(user.role, "settings.write");
  const exportKey = owner ? exportServiceAccount() : null;
  return {
    ok: true,
    page: { id: page.id, name: page.name, slug: page.slug, status: page.status, publishedVersionId: page.publishedVersionId },
    versions,
    exports,
    defaults: {
      siteUrl: lastOrigin ? `${lastOrigin}/` : null,
      whatsapp: liveDoc ? whatsappNumber(liveDoc, store.whatsapp) : null,
      apiOrigin: api.origin,
      connectedBlocker: api.blocker,
      sheetConnected: !!sheets.spreadsheetId,
      canEmbedServiceAccount: !!exportKey?.key,
      embedKeyBlocker: exportKey?.problem ?? null,
      exportServiceAccountEmail: exportKey?.key?.email ?? null,
    },
  };
}

/* ------------------------------------------------------------------ */
/* bundle                                                              */
/* ------------------------------------------------------------------ */

interface Prepared {
  version: VersionRow;
  doc: PageDoc;
  store: StoreInfo;
  input: Omit<BundleInput, "exportId" | "pageKey" | "php">;
}

async function prepare(req: ExportRequest): Promise<Prepared> {
  const version = await loadVersion(req.versionId);
  const doc = validDoc(version.doc);
  const store = await storeInfo();

  let apiOrigin: string | undefined;
  if (req.mode === "connected") {
    const api = apiOriginState();
    if (!api.origin) {
      const message = api.blocker ?? "Connected exports are unavailable.";
      throw new ExportError("unavailable", message, { mode: message });
    }
    apiOrigin = api.origin;
  }
  let wa: string | undefined;
  if (req.mode === "whatsapp") {
    const typed = req.options.whatsappNumber;
    wa = (typed ? whatsappDigits(typed, doc.form.phoneCountry) : whatsappNumber(doc, store.whatsapp)) ?? undefined;
    if (!wa) {
      const message = typed ? WHATSAPP_HINT : "Add the WhatsApp number orders are sent to.";
      throw new ExportError("invalid", message, { whatsappNumber: message });
    }
  }
  const ids = collectAssetIds(doc, [store.logo]);
  const assets = await getAssetsByIds(ids);
  const found = new Set(assets.map((a) => a.id));
  const lost = ids.filter((id) => !found.has(id)).length;
  return {
    version,
    doc,
    store,
    input: {
      mode: req.mode,
      doc,
      pageName: version.page.name,
      store,
      assets,
      media: dbMedia,
      siteUrl: req.options.siteUrl,
      hostConfigs: req.options.hostConfigs,
      apiOrigin,
      allowedOrigins: req.mode === "connected" ? req.allowedOrigins : [],
      whatsappNumber: wa,
      now: new Date(),
      updatedAt: version.createdAt,
      warnings: lost
        ? [`${lost} image${lost > 1 ? "s" : ""} used by this version ${lost > 1 ? "were" : "was"} deleted from the media library and ${lost > 1 ? "are" : "is"} left out — replace ${lost > 1 ? "them" : "it"} in the builder.`]
        : [],
    },
  };
}

const estimateCache = new Map<string, { at: number; value: ExportEstimateResponse }>();

/**
 * Approximate ZIP size and the warnings of an export (renders the pages, writes nothing). The
 * WhatsApp number is validated on every call but is not part of the cache key: it changes the size
 * by a few bytes, and the dialog asks again on every typed digit — one full render per number would
 * be wasted work.
 */
export async function estimateExport(req: ExportRequest): Promise<ExportEstimateResponse> {
  const p = await prepare(req);
  const key = JSON.stringify([req.versionId, req.mode, req.options.hostConfigs, req.options.siteUrl?.base ?? ""]);
  const hit = estimateCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const bundle = await buildBundle({
    ...p.input,
    // placeholder ids: same lengths as real ones, nothing is recorded
    exportId: "0".repeat(26),
    pageKey: `pk_${"0".repeat(20)}`,
    allowedOrigins: p.input.allowedOrigins.length ? p.input.allowedOrigins : ["https://example.com"],
    php: req.mode === "php" ? { secret: "0".repeat(64) } : undefined,
  });
  const size = bundleSize(bundle);
  const value: ExportEstimateResponse = { ok: true, ...size, warnings: bundle.warnings };
  estimateCache.set(key, { at: Date.now(), value });
  while (estimateCache.size > 50) estimateCache.delete(estimateCache.keys().next().value!);
  return value;
}

/** Fields the order API validates against — if they differ, the export gets its own version. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  );
const orderView = (d: PageDoc) => stable([d.locale, d.market, d.currency, d.product, d.offers, d.form]);

async function orderVersionFor(p: Prepared, user: SessionUser): Promise<string> {
  const stored = PageDoc.safeParse(p.version.doc);
  if (stored.success && orderView(stored.data) === orderView(p.doc)) return p.version.id;
  const id = newId();
  await db.insert(pageVersions).values({
    id,
    pageId: p.version.pageId,
    kind: "save",
    label: "Export snapshot",
    doc: p.doc,
    checksum: createHash("sha256").update(JSON.stringify(p.doc), "utf8").digest("hex"),
    createdBy: user.id,
    createdAt: new Date(),
  });
  return id;
}

export interface BuiltExport {
  exportId: string;
  fileName: string;
  estimate: number;
  stream: ReadableStream<Uint8Array>;
  warnings: string[];
}

/**
 * Records the export (new public key) and returns its ZIP as a stream. The row's size is filled in
 * when the stream completes; an interrupted download deletes the row (its archive is unusable).
 */
export async function buildExport(req: ExportRequest, user: SessionUser, ip: string): Promise<BuiltExport> {
  if (!isExportMode(req.mode)) throw new ExportError("invalid", "Unknown export mode.");
  if (req.mode === "connected" && !normalizeAllowedOrigins(req.allowedOrigins).origins.length) {
    throw new ExportError("invalid", "Add the domain where the page will be hosted.", { allowedOrigins: "Add the domain where the page will be hosted." });
  }
  let embedded: ExportKey | undefined;
  if (req.options.embedServiceAccount) {
    if (!can(user.role, "settings.write")) throw new ExportError("forbidden", "Only owners can include the Google key in an export.");
    const sa = exportServiceAccount();
    if (!sa.key) throw new ExportError("unavailable", sa.problem, { embedServiceAccount: sa.problem });
    embedded = sa.key;
  }
  const p = await prepare(req);
  const versionId = req.mode === "connected" ? await orderVersionFor(p, user) : p.version.id;
  const sheets = req.mode === "php" ? await getSetting("sheets") : null;

  const exportId = newId();
  const pageKey = newPublicKey();
  const now = p.input.now;
  const fileName = exportFileName(p.version.page.slug, req.mode, now);
  const bundle = await buildBundle({
    ...p.input,
    exportId,
    pageKey,
    php:
      req.mode === "php"
        ? {
            secret: randomBytes(32).toString("hex"),
            spreadsheetId: sheets?.spreadsheetId,
            sheetTab: sheets?.sheetTitle,
            serviceAccountB64: embedded?.b64,
            serviceAccountEmail: embedded?.email,
          }
        : undefined,
  });

  await db.insert(exportsTable).values({
    id: exportId,
    pageId: p.version.pageId,
    versionId,
    mode: req.mode,
    publicKey: pageKey,
    allowedOrigins: p.input.allowedOrigins,
    fileName,
    bytes: null,
    createdBy: user.id,
    createdAt: now,
  });
  // the order API answers this export's origins from now on (CORS preflights read a cached list)
  invalidateExportOrigins();
  await audit("export.created", {
    userId: user.id,
    target: exportId,
    ip,
    meta: {
      pageId: p.version.pageId,
      versionId,
      mode: req.mode,
      origins: p.input.allowedOrigins,
      files: bundle.files.length,
      // which key went out, so a leaked ZIP can be matched to the key to delete in Google Cloud (never the key itself)
      serviceAccount: embedded ? { email: embedded.email, keyId: embedded.keyId } : null,
    },
  });

  const stream = zipStream(bundle.files, {
    mtime: now,
    onDone: (bytes) => {
      db.update(exportsTable)
        .set({ bytes })
        .where(eq(exportsTable.id, exportId))
        .catch((err: unknown) => console.error("[export] size update failed:", errorSummary(err)));
    },
    onAbort: () => {
      db.delete(exportsTable)
        .where(and(eq(exportsTable.id, exportId), isNull(exportsTable.bytes)))
        .then(() => invalidateExportOrigins())
        .catch((err: unknown) => console.error("[export] cleanup failed:", errorSummary(err)));
    },
  });
  return { exportId, fileName, estimate: bundleSize(bundle).bytes, stream, warnings: bundle.warnings };
}

/* ------------------------------------------------------------------ */
/* revoke                                                              */
/* ------------------------------------------------------------------ */

export async function revokeExport(exportId: string, user: SessionUser, ip: string): Promise<ExportRecordJson> {
  const [row] = await db
    .select({ id: exportsTable.id, revokedAt: exportsTable.revokedAt, pageId: exportsTable.pageId, mode: exportsTable.mode })
    .from(exportsTable)
    .where(eq(exportsTable.id, exportId))
    .limit(1);
  if (!row) throw new ExportError("not_found", "Export not found.");
  if (!row.revokedAt) {
    await db.update(exportsTable).set({ revokedAt: new Date() }).where(and(eq(exportsTable.id, exportId), isNull(exportsTable.revokedAt)));
    invalidateExportOrigins();
    await audit("export.revoked", { userId: user.id, target: exportId, ip, meta: { pageId: row.pageId, mode: row.mode } });
  }
  const [record] = await exportRecords(eq(exportsTable.id, exportId), 1);
  return record!;
}
