/**
 * Connected sheet management.
 *   POST   { url }        → find/create & format the "Commandes" tab, prove Editor access, save setting
 *   PATCH  { enabled }    → pause / resume appending orders & pulling statuses (orders keep queuing while paused;
 *                           status edits made in the admin still reach rows already in the sheet)
 *   DELETE                → forget the connected sheet
 * Errors carry a French `message` for the admin (incl. the service-account e-mail to share with).
 */
import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard, json, logError, readJson } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSetting } from "@/lib/settings";
import {
  connectSheet,
  disconnectSheet,
  explain,
  getSheetsConfig,
  parseSheetUrl,
  saveSheetsConfig,
  serviceAccountEmail,
  setSheetsEnabled,
  sheetsConfigProblem,
  SheetLinkInvalid,
  SheetsConfigError,
  syncPendingOrders,
} from "@/lib/sheets";

const ConnectBody = z.object({ url: z.string().trim().min(1).max(2000) });
const PatchBody = z.object({ enabled: z.boolean() });

export async function POST(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "settings.write");
  if (!g.ok) return g.response;
  const gate = await rateLimit(`sheets:connect:${g.user.id}`, 20, 600);
  if (!gate.ok) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(gate.retryAfter) });

  const body = await readJson(req, 4096);
  const parsed = body.ok ? ConnectBody.safeParse(body.value) : null;
  if (!parsed?.success) return json({ ok: false, error: "invalid", message: "Collez le lien de votre feuille Google Sheets." }, 400);

  const email = serviceAccountEmail();
  const problem = sheetsConfigProblem();
  if (problem) return json({ ok: false, error: "not_configured", message: explain(problem, email) }, 409);
  try {
    const link = parseSheetUrl(parsed.data.url);
    const previous = await getSheetsConfig();
    const known = link.ok && previous?.spreadsheetId === link.spreadsheetId ? previous.sheetId : null;
    const { currency } = await getSetting("defaults");
    const r = await connectSheet(parsed.data.url, { knownSheetId: known, currency });
    const sheet = await saveSheetsConfig(
      { spreadsheetId: r.spreadsheetId, sheetId: r.sheetId, sheetTitle: r.sheetTitle, enabled: true },
      { id: g.user.id, ip: g.ip },
    );
    // push orders that queued while no sheet was connected
    after(async () => {
      try {
        await syncPendingOrders({ force: true });
      } catch (err) {
        logError("api/admin/sheets:connect-sync", err);
      }
    });
    return json({ ok: true, created: r.created, spreadsheetTitle: r.spreadsheetTitle, sheet });
  } catch (err) {
    if (err instanceof SheetLinkInvalid) return json({ ok: false, error: "invalid_link", code: err.code, message: explain(err, email) }, 400);
    const message = explain(err, email);
    if (!(err instanceof SheetsConfigError)) logError("api/admin/sheets:connect", err);
    return json({ ok: false, error: "google", message, serviceAccountEmail: email }, 502);
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "settings.write");
  if (!g.ok) return g.response;
  const body = await readJson(req, 1024);
  const parsed = body.ok ? PatchBody.safeParse(body.value) : null;
  if (!parsed?.success) return json({ ok: false, error: "invalid" }, 400);
  try {
    const sheet = await setSheetsEnabled(parsed.data.enabled, { id: g.user.id, ip: g.ip });
    if (!sheet) return json({ ok: false, error: "not_connected" }, 409);
    if (sheet.enabled) {
      after(async () => {
        try {
          await syncPendingOrders({ force: true });
        } catch (err) {
          logError("api/admin/sheets:resume-sync", err);
        }
      });
    }
    return json({ ok: true, sheet });
  } catch (err) {
    logError("api/admin/sheets:patch", err);
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "settings.write");
  if (!g.ok) return g.response;
  try {
    await disconnectSheet({ id: g.user.id, ip: g.ip });
    return json({ ok: true });
  } catch (err) {
    logError("api/admin/sheets:delete", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
