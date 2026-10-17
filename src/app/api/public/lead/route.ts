/**
 * POST /api/public/lead — abandoned-lead capture (sent once the phone becomes valid).
 * Fire-and-forget for the runtime: answers 204 whether or not the lead was stored (no oracle).
 * A per-process burst guard runs before any database work (a flood never reaches MariaDB).
 * Body ≤ 24 KB (v2 runtimes send the offer selection): `units` / `extras` are tolerant — entries that
 * don't parse are dropped, never an error (docs/OFFERS.md §G.1).
 */
import type { NextRequest } from "next/server";
import { LeadPayload, leadSelection } from "@/lib/orders/contract";
import { checkOrigin, clientContext, corsHeaders, json, logError, noContent, preflight, readJson } from "@/lib/orders/http";
import { upsertLead } from "@/lib/orders/leads";
import { resolvePageKey } from "@/lib/orders/resolve";
import { burstLimit } from "@/lib/security/burst-limit";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return preflight(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  const client = clientContext(req);
  if (!burstLimit("lead", client.ip).ok) return noContent({ Vary: "Origin" });
  try {
    const body = await readJson(req, 24 * 1024);
    if (!body.ok) return json({ ok: false, error: "invalid" }, body.status, { Vary: "Origin" });
    const parsed = LeadPayload.safeParse(body.value);
    if (!parsed.success) return json({ ok: false, error: "invalid" }, 422, { Vary: "Origin" });

    const target = await resolvePageKey(parsed.data.pageKey, "order");
    if (!target) return noContent({ Vary: "Origin" });
    const verdict = checkOrigin(req, target.kind === "export" ? target.allowedOrigins : null);
    if (!verdict.ok) return json({ ok: false, error: "unavailable" }, 403, { Vary: "Origin" });

    const { units, extras } = leadSelection(parsed.data);
    await upsertLead({ ...parsed.data, units, extras }, { ip: client.ip, target });
    return noContent(corsHeaders(verdict.cors));
  } catch (err) {
    logError("api/lead", err);
    return json({ ok: false, error: "server" }, 500, { Vary: "Origin" });
  }
}
