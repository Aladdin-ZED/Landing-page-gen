/**
 * GET /api/admin/sheets/status — setup wizard state:
 * { configured, serviceAccountEmail, sheet: { url, title, enabled, connectedAt… } | null, queue }.
 */
import type { NextRequest } from "next/server";
import { adminGuard, json, logError } from "@/lib/orders/http";
import { getSheetsConfig, isSheetsConfigured, serviceAccountEmail, syncHealth } from "@/lib/sheets";

export async function GET(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "settings.read");
  if (!g.ok) return g.response;
  try {
    const [sheet, queue] = await Promise.all([getSheetsConfig(), syncHealth()]);
    return json({
      ok: true,
      configured: isSheetsConfigured(),
      envPresent: !!process.env.GOOGLE_SA_JSON_B64?.trim(),
      serviceAccountEmail: serviceAccountEmail(),
      sheet,
      queue,
    });
  } catch (err) {
    logError("api/admin/sheets:status", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
