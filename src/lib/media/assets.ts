import "server-only";
/**
 * Asset rows: lookup for the renderer, media-library listing and deletion.
 * Assets are immutable (id = content hash); deleting one leaves pages referencing it rendering
 * gracefully (RenderContext.asset() returns null for missing ids).
 */
import { and, count, desc, eq, inArray, isNotNull, like, or, type SQL } from "drizzle-orm";
import { db, pool } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { parseFocus } from "./focus";
import { liveMediaUrl } from "./keys";
import { deleteFilesOfAsset, evictKeys } from "./store";

export type AssetRecord = typeof assets.$inferSelect;

export const ASSET_ID_RE = /^[a-f0-9]{16,64}$/;
/** Video file key: "<assetId>-<width>.<mp4|webm>" (images use KEY_RE from ./keys). */
export const VIDEO_KEY_RE = /^[a-f0-9]{16,64}-\d{2,5}\.(mp4|webm)$/;

export const VIDEO_MIME = { mp4: "video/mp4", webm: "video/webm" } as const;
export type VideoFormat = keyof typeof VIDEO_MIME;

export const videoKey = (assetId: string, width: number, fmt: VideoFormat) => `${assetId}-${width}.${fmt}`;

/** Playable source of a video asset (null for images). */
export function videoSource(a: Pick<AssetRecord, "id" | "kind" | "mime" | "width">): { key: string; url: string; mime: string } | null {
  if (a.kind !== "video") return null;
  const fmt: VideoFormat = a.mime === VIDEO_MIME.webm ? "webm" : "mp4";
  const key = videoKey(a.id, a.width, fmt);
  return { key, url: liveMediaUrl(key), mime: a.mime };
}

export async function getAsset(id: string): Promise<AssetRecord | null> {
  if (!ASSET_ID_RE.test(id)) return null;
  const [row] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return row ?? null;
}

/** Rows for the given ids (unknown / malformed ids are skipped). Order follows the input. */
export async function getAssetsByIds(ids: readonly string[]): Promise<AssetRecord[]> {
  const wanted = [...new Set(ids.filter((id) => typeof id === "string" && ASSET_ID_RE.test(id)))];
  if (!wanted.length) return [];
  const found = new Map<string, AssetRecord>();
  for (let i = 0; i < wanted.length; i += 500) {
    const rows = await db.select().from(assets).where(inArray(assets.id, wanted.slice(i, i + 500)));
    for (const r of rows) found.set(r.id, r);
  }
  return wanted.map((id) => found.get(id)).filter((r): r is AssetRecord => !!r);
}

export interface ListAssetsInput {
  page?: number;
  pageSize?: number;
  kind?: "image" | "video";
  /** "cutout" → transparent images only; "photo" → opaque images only */
  filter?: "cutout" | "photo";
  /** search in original file name */
  q?: string;
  /** only derived assets of this source (background removals) */
  sourceAssetId?: string;
}

export interface AssetPage {
  items: AssetRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAssets(input: ListAssetsInput = {}): Promise<AssetPage> {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 48)));
  const where: SQL[] = [];
  if (input.kind) where.push(eq(assets.kind, input.kind));
  // both filters are image-only (videos are stored with alpha = false)
  if (input.filter === "cutout") where.push(eq(assets.kind, "image"), eq(assets.alpha, true));
  if (input.filter === "photo") where.push(eq(assets.kind, "image"), eq(assets.alpha, false));
  if (input.sourceAssetId && ASSET_ID_RE.test(input.sourceAssetId)) where.push(eq(assets.sourceAssetId, input.sourceAssetId));
  const q = input.q?.trim().slice(0, 80);
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    where.push(or(like(assets.originalName, pattern), and(isNotNull(assets.tags), like(assets.tags, pattern)))!);
  }
  const cond = where.length ? and(...where) : undefined;
  const [items, [totalRow]] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(cond)
      .orderBy(desc(assets.createdAt), desc(assets.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(assets).where(cond),
  ]);
  return { items, total: Number(totalRow?.n ?? 0), page, pageSize };
}

/** Assets derived from `id` (cutouts made from a photo) — kept when the source is deleted. */
export async function hasDerivedAssets(id: string): Promise<boolean> {
  const [row] = await db.select({ id: assets.id }).from(assets).where(eq(assets.sourceAssetId, id)).limit(1);
  return !!row;
}

/** Delete an asset and all its stored files atomically. Returns false when it did not exist. */
export async function deleteAsset(id: string): Promise<boolean> {
  if (!ASSET_ID_RE.test(id)) return false;
  const conn = await pool().getConnection();
  let keys: string[] = [];
  try {
    await conn.beginTransaction();
    const [res] = (await conn.query("DELETE FROM assets WHERE id = ?", [id])) as unknown as [{ affectedRows: number }];
    if (!res.affectedRows) {
      await conn.rollback();
      return false;
    }
    keys = await deleteFilesOfAsset(conn, id);
    // derived cutouts keep living on their own
    await conn.query("UPDATE assets SET source_asset_id = NULL WHERE source_asset_id = ?", [id]);
    await conn.commit();
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
  evictKeys(keys);
  return true;
}

/** Public JSON for the admin (media library, upload response). */
export function assetToJson(a: AssetRecord) {
  const best =
    a.variants.filter((v) => v.fmt === "webp").sort((x, y) => y.w - x.w)[0] ?? a.variants[a.variants.length - 1];
  const thumb =
    a.variants.filter((v) => v.fmt === "webp" && v.w >= 360).sort((x, y) => x.w - y.w)[0] ?? best;
  const video = videoSource(a);
  return {
    id: a.id,
    kind: a.kind,
    mime: a.mime,
    width: a.width,
    height: a.height,
    bytes: a.bytes,
    alpha: a.alpha,
    dominant: a.dominant,
    palette: a.palette ?? null,
    /** subject analysis (focal point, subject box, heads/hands) — the preview crops like the live page */
    focus: parseFocus(a.focus),
    variants: a.variants,
    url: video?.url ?? (best ? liveMediaUrl(best.key) : null),
    thumbUrl: thumb ? liveMediaUrl(thumb.key) : null,
    originalName: a.originalName,
    sourceAssetId: a.sourceAssetId,
    tags: a.tags ?? [],
    createdAt: a.createdAt.toISOString(),
  };
}
export type AssetJson = ReturnType<typeof assetToJson>;

