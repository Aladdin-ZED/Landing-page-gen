/**
 * Admin media library.
 *   GET    ?page&pageSize&kind=image|video&filter=cutout|photo&q&sourceAssetId  → paginated assets
 *   POST   multipart/form-data: file (required), cutout ("1"), sourceAssetId          → processed asset
 *   DELETE ?id=<assetId>[&force=1]                                                    → { ok: true }
 *          409 { error: "in_use", pages, storeLogo } when a live page version or the store logo
 *          shows the file — the caller confirms with the admin, then repeats with force=1.
 * Pages referencing a deleted asset keep rendering (missing assets resolve to null).
 *
 * This route is outside the proxy matcher, so the proxy never buffers a copy of the (≤ 25 MB) upload
 * body. Every handler therefore starts with the admin gate itself and answers exactly like the proxy
 * would for an un-gated request (the public 404). Uploads then need a Content-Length, take an
 * in-flight slot BEFORE reading the body (per user and per process), and read it into one buffer.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { livePagesUsing } from "@/lib/admin-data/assets";
import { audit } from "@/lib/audit";
import { hasAdminAccess } from "@/lib/auth";
import { UNKNOWN_PAGE_HEADERS, UNKNOWN_PAGE_HTML } from "@/lib/auth/unknown-page";
import {
  ASSET_ID_RE,
  assetToJson,
  deleteAsset,
  listAssets,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MediaError,
  processUpload,
} from "@/lib/media";
import { declaredLength, multipartBoundary, parseMultipart, readExactBody } from "@/lib/media/upload-body";
import { takeUploadSlot } from "@/lib/media/upload-slots";
import { adminGuard, json, logError } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSetting } from "@/lib/settings";

const MAX_FILE = Math.max(MAX_IMAGE_BYTES, MAX_VIDEO_BYTES);
/** multipart envelope overhead allowance */
const MAX_BODY = MAX_FILE + 256 * 1024;

/** The proxy's answer to un-gated admin requests: the public not-found page (HTML for GET only). */
async function hiddenUnlessGated(req: NextRequest): Promise<Response | null> {
  if (await hasAdminAccess()) return null;
  return new Response(req.method === "GET" ? UNKNOWN_PAGE_HTML : null, { status: 404, headers: UNKNOWN_PAGE_HEADERS });
}

const tooLarge = () => json({ ok: false, error: "too_large", message: new MediaError("too_large").message }, 413);
const busy = (status: 429 | 503, retryAfter: number) =>
  json({ ok: false, error: "busy", message: new MediaError("busy").message }, status, { "Retry-After": String(retryAfter) });

const ListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(48),
  kind: z.enum(["image", "video"]).optional(),
  filter: z.enum(["cutout", "photo"]).optional(),
  q: z.string().trim().max(80).optional(),
  sourceAssetId: z.string().regex(ASSET_ID_RE).optional(),
});

export async function GET(req: NextRequest): Promise<Response> {
  const hidden = await hiddenUnlessGated(req);
  if (hidden) return hidden;
  const g = await adminGuard(req, "pages.read");
  if (!g.ok) return g.response;
  const q = ListQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return json({ ok: false, error: "invalid" }, 400);
  try {
    const res = await listAssets(q.data);
    return json({ ok: true, items: res.items.map(assetToJson), total: res.total, page: res.page, pageSize: res.pageSize });
  } catch (err) {
    logError("api/admin/media:list", err);
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const hidden = await hiddenUnlessGated(req);
  if (hidden) return hidden;
  const g = await adminGuard(req, "media.write");
  if (!g.ok) return g.response;

  const boundary = multipartBoundary(req.headers.get("content-type"));
  if (!boundary) return json({ ok: false, error: "unsupported_media_type" }, 415);
  const length = declaredLength(req.headers);
  if (length === null) return json({ ok: false, error: "length_required", message: "Upload size missing. Please try again." }, 411);
  if (length > MAX_BODY) return tooLarge();

  const slot = takeUploadSlot(g.user.id);
  if (!slot.ok) return slot.scope === "user" ? busy(429, 10) : busy(503, 10);
  try {
    const gate = await rateLimit(`media:upload:${g.user.id}`, 120, 600);
    if (!gate.ok) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(gate.retryAfter) });
    return await receive(req, boundary, length, g.user.id, g.ip);
  } finally {
    slot.release();
  }
}

/** Read, parse and process one upload (inside an upload slot). */
async function receive(req: NextRequest, boundary: string, length: number, userId: string, ip: string): Promise<Response> {
  const body = await readExactBody(req.body, length);
  if (!body.ok) return json({ ok: false, error: "invalid", message: "The upload was interrupted. Please try again." }, body.status);
  const form = parseMultipart(body.value, boundary);
  if (!form) return json({ ok: false, error: "invalid" }, 400);
  const file = form.file;
  if (!file || file.data.length === 0) return json({ ok: false, error: "invalid", message: "No file received." }, 400);
  if (file.data.length > MAX_FILE) return tooLarge();
  const cutoutField = form.fields.get("cutout");
  const cutout = cutoutField === "1" || cutoutField === "true";
  const source = form.fields.get("sourceAssetId");
  const sourceAssetId = source !== undefined && ASSET_ID_RE.test(source) ? source : null;

  try {
    // file.data is a view into this request's own body buffer: processing may scrub it in place
    const { asset, deduped } = await processUpload(file.data, file.name, {
      cutout,
      sourceAssetId,
      createdBy: userId,
    });
    if (!deduped) {
      await audit("media.uploaded", {
        userId,
        target: asset.id,
        meta: { kind: asset.kind, bytes: asset.bytes, cutout },
        ip,
      });
    }
    return json({ ok: true, deduped, asset: assetToJson(asset) }, deduped ? 200 : 201);
  } catch (err) {
    if (err instanceof MediaError && err.code === "busy") return busy(503, 10);
    if (err instanceof MediaError) return json({ ok: false, error: err.code, message: err.message }, 422);
    logError("api/admin/media:upload", err);
    return json({ ok: false, error: "server", message: "Upload failed. Please try again." }, 500);
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const hidden = await hiddenUnlessGated(req);
  if (hidden) return hidden;
  const g = await adminGuard(req, "media.write");
  if (!g.ok) return g.response;
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!ASSET_ID_RE.test(id)) return json({ ok: false, error: "invalid" }, 400);
  const force = req.nextUrl.searchParams.get("force") === "1";
  try {
    // what visitors see right now: live versions (immutable HTML) and the store logo on every page
    const [live, store] = await Promise.all([livePagesUsing(id, 50), getSetting("store", { fresh: true })]);
    const storeLogo = store.logo?.id === id;
    if (!force && (live.length || storeLogo)) {
      const where = live.length ? `${live.length === 1 ? "a live page" : `${live.length} live pages`}` : "your store logo";
      return json(
        {
          ok: false,
          error: "in_use",
          message: `This file is shown on ${where}. Confirm to delete it anyway.`,
          pages: live.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
          storeLogo,
        },
        409,
      );
    }
    const deleted = await deleteAsset(id);
    if (!deleted) return json({ ok: false, error: "not_found" }, 404);
    await audit("media.deleted", {
      userId: g.user.id,
      target: id,
      ...(live.length || storeLogo ? { meta: { forced: true, livePages: live.map((p) => p.slug), storeLogo } } : {}),
      ip: g.ip,
    });
    return json({ ok: true });
  } catch (err) {
    logError("api/admin/media:delete", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
