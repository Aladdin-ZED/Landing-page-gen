/**
 * One library image's crop data (the framing picker).
 *   GET   → { ok, focal: FocalInfo }   the subject analysis (AssetFocus: focal point, subject box,
 *         heads, hands — analysed and stored here on first view for rows older than the analysis)
 *         + the library's default point
 *   PATCH { focal: { x, y } | null }  → { ok, focal: FocalInfo }   set the library's default point, or
 *         clear it (back to auto framing). Pages keep their own point per AssetRef (fx/fy); the default
 *         pre-fills it when the image is placed.
 *
 * Gate: the proxy already hides this path from un-gated visitors (only the upload route is outside its
 * matcher); the check is repeated here so the answer never depends on the matcher. Writes need
 * media.write and a same-origin request (adminGuard), take JSON only, are rate limited and audited.
 */
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { focalFromTags, withFocalTag, type FocalInfo } from "@/components/admin/media/focal/tags";
import { audit } from "@/lib/audit";
import { hasAdminAccess } from "@/lib/auth";
import { UNKNOWN_PAGE_HEADERS, UNKNOWN_PAGE_HTML } from "@/lib/auth/unknown-page";
import { db } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { ASSET_ID_RE, getAsset, type AssetRecord } from "@/lib/media";
import { adminGuard, json, logError, readJson } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { focusOfAsset } from "./focus";

type Params = { params: Promise<{ id: string }> };

async function hiddenUnlessGated(req: NextRequest): Promise<Response | null> {
  if (await hasAdminAccess()) return null;
  return new Response(req.method === "GET" ? UNKNOWN_PAGE_HTML : null, { status: 404, headers: UNKNOWN_PAGE_HEADERS });
}

const Point = z
  .object({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict();

const PatchBody = z.object({ focal: Point.nullable() }).strict();

async function info(asset: AssetRecord): Promise<FocalInfo> {
  let focus: FocalInfo["focus"] = null;
  try {
    focus = await focusOfAsset(asset);
  } catch (err) {
    // a busy media store or database: the picker works without the analysis
    logError("api/admin/media/[id]:focus", err);
  }
  return { id: asset.id, width: asset.width, height: asset.height, alpha: asset.alpha, focus, saved: focalFromTags(asset.tags) };
}

async function imageAsset(id: string): Promise<AssetRecord | Response> {
  if (!ASSET_ID_RE.test(id)) return json({ ok: false, error: "invalid" }, 400);
  const asset = await getAsset(id);
  if (!asset) return json({ ok: false, error: "not_found" }, 404);
  if (asset.kind !== "image") return json({ ok: false, error: "not_image", message: "Focal points apply to images only." }, 422);
  return asset;
}

export async function GET(req: NextRequest, ctx: Params): Promise<Response> {
  const hidden = await hiddenUnlessGated(req);
  if (hidden) return hidden;
  const g = await adminGuard(req, "pages.read");
  if (!g.ok) return g.response;
  try {
    const asset = await imageAsset((await ctx.params).id);
    if (asset instanceof Response) return asset;
    return json({ ok: true, focal: await info(asset) }, 200, { "Cache-Control": "private, no-store" });
  } catch (err) {
    logError("api/admin/media/[id]:get", err);
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function PATCH(req: NextRequest, ctx: Params): Promise<Response> {
  const hidden = await hiddenUnlessGated(req);
  if (hidden) return hidden;
  const g = await adminGuard(req, "media.write");
  if (!g.ok) return g.response;
  const type = (req.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (type !== "application/json") return json({ ok: false, error: "unsupported_media_type" }, 415);

  const body = await readJson(req, 1024);
  if (!body.ok) return json({ ok: false, error: "invalid" }, body.status);
  const parsed = PatchBody.safeParse(body.value);
  if (!parsed.success) return json({ ok: false, error: "invalid", message: "Send { focal: { x, y } } with values from 0 to 1, or { focal: null }." }, 400);

  try {
    const gate = await rateLimit(`media:focal:${g.user.id}`, 240, 600);
    if (!gate.ok) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(gate.retryAfter) });

    const asset = await imageAsset((await ctx.params).id);
    if (asset instanceof Response) return asset;

    const before = focalFromTags(asset.tags);
    const tags = withFocalTag(asset.tags, parsed.data.focal);
    const after = focalFromTags(tags);
    const changed = (before?.x ?? null) !== (after?.x ?? null) || (before?.y ?? null) !== (after?.y ?? null);
    if (changed) {
      await db.update(assets).set({ tags }).where(eq(assets.id, asset.id));
      await audit("media.focal_updated", {
        userId: g.user.id,
        target: asset.id,
        meta: after ? { fx: after.x, fy: after.y, ...(before ? { from: [before.x, before.y] } : {}) } : { reset: true, ...(before ? { from: [before.x, before.y] } : {}) },
        ip: g.ip,
      });
    }
    return json({ ok: true, focal: await info({ ...asset, tags }) });
  } catch (err) {
    logError("api/admin/media/[id]:patch", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
