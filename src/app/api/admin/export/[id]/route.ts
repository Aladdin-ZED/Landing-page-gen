/**
 * DELETE /api/admin/export/<exportId> — revoke an export: from now on the public API refuses orders,
 * leads, upsells and analytics carrying its key (connected mode). The row is kept for the history.
 * → { ok: true, export: ExportRecordJson }
 */
import type { NextRequest } from "next/server";
import { ULID_RE } from "@/lib/export/options";
import { revokeExport } from "@/lib/export/server";
import type { ExportErrorResponse } from "@/lib/export/types";
import { adminGuard, json } from "@/lib/orders/http";
import { exportErrorResponse } from "../errors";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Params): Promise<Response> {
  const g = await adminGuard(req, "export.create");
  if (!g.ok) return g.response;
  const { id } = await ctx.params;
  if (!ULID_RE.test(id)) return json({ ok: false, error: "invalid" } satisfies ExportErrorResponse, 400);
  try {
    return json({ ok: true, export: await revokeExport(id, g.user, g.ip) });
  } catch (err) {
    return exportErrorResponse(err, "api/admin/export:revoke");
  }
}
