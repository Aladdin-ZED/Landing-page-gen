/**
 * Static exports of a landing page.
 *   GET  ?pageId=<id>[&versionId=<id>] → ExportContextResponse (versions — incl. that one —, recent exports,
 *                                         defaults for the dialog)
 *   POST ExportRequest  → the ZIP as an attachment (streamed), or ExportErrorResponse JSON
 * Permission: export.create. State changes are same-origin only (adminGuard).
 */
import type { NextRequest } from "next/server";
import { buildExport, getExportContext } from "@/lib/export/server";
import { ULID_RE, parseExportRequest } from "@/lib/export/options";
import { EXPORT_HEADERS, type ExportErrorResponse } from "@/lib/export/types";
import { adminGuard, apiHeaders, json, readJson } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { exportErrorResponse, rateLimited } from "./errors";

export async function GET(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "export.create");
  if (!g.ok) return g.response;
  const pageId = req.nextUrl.searchParams.get("pageId") ?? "";
  const versionId = req.nextUrl.searchParams.get("versionId") ?? "";
  if (!ULID_RE.test(pageId) || (versionId && !ULID_RE.test(versionId))) return json({ ok: false, error: "invalid" } satisfies ExportErrorResponse, 400);
  try {
    return json(await getExportContext(pageId, g.user, { versionId: versionId || undefined }));
  } catch (err) {
    return exportErrorResponse(err, "api/admin/export:context");
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "export.create");
  if (!g.ok) return g.response;
  const gate = await rateLimit(`export:create:${g.user.id}`, 20, 600);
  if (!gate.ok) return rateLimited(gate.retryAfter, "Too many exports in a row — wait a few minutes.");
  const body = await readJson(req, 16 * 1024);
  if (!body.ok) return json({ ok: false, error: "invalid" } satisfies ExportErrorResponse, body.status);
  const parsed = parseExportRequest(body.value);
  if (!parsed.ok) {
    return json({ ok: false, error: "invalid", message: Object.values(parsed.errors)[0], fields: parsed.errors } satisfies ExportErrorResponse, 422);
  }
  try {
    const built = await buildExport(parsed.value, g.user, g.ip);
    const headers = apiHeaders({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${built.fileName}"`,
      [EXPORT_HEADERS.id]: built.exportId,
      [EXPORT_HEADERS.estimate]: String(built.estimate),
    });
    return new Response(built.stream, { status: 200, headers });
  } catch (err) {
    return exportErrorResponse(err, "api/admin/export:create");
  }
}
