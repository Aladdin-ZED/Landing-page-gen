/**
 * POST /api/admin/sheets/test — read-only access check of the connected sheet: the header row is read
 * back and compared with the expected columns (no test rows are ever written to a live order sheet).
 */
import type { NextRequest } from "next/server";
import { adminGuard, json } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { COLUMNS, explain, getSheetsConfig, serviceAccountEmail, sheetsConfigProblem, verifySheet } from "@/lib/sheets";

export async function POST(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "settings.write");
  if (!g.ok) return g.response;
  const gate = await rateLimit(`sheets:test:${g.user.id}`, 30, 600);
  if (!gate.ok) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(gate.retryAfter) });

  const email = serviceAccountEmail();
  const problem = sheetsConfigProblem();
  if (problem) return json({ ok: false, error: "not_configured", message: explain(problem, email) }, 409);
  const cfg = await getSheetsConfig();
  if (!cfg) return json({ ok: false, error: "not_connected", message: "Aucune feuille n'est connectée." }, 409);
  try {
    const r = await verifySheet(cfg.spreadsheetId, cfg.sheetTitle);
    return json({
      ok: true,
      headerOk: r.ok,
      message: r.ok
        ? "Connexion vérifiée : la feuille est accessible."
        : `La ligne d'en-tête a été modifiée. Colonnes attendues : ${COLUMNS.map((c) => c[0]).join(" · ")}. Reconnectez la feuille pour la rétablir.`,
      sheet: cfg,
    });
  } catch (err) {
    return json({ ok: false, error: "google", message: explain(err, email), serviceAccountEmail: email }, 502);
  }
}
