/**
 * POST /api/public/event — analytics beacon (navigator.sendBeacon, text/plain JSON ≤ 2 KB).
 * Always 204 for well-formed beacons (unknown keys / throttled clients are dropped silently).
 * A per-process burst guard runs before any database work (a flood never reaches MariaDB).
 */
import type { NextRequest } from "next/server";
import { EventPayload } from "@/lib/orders/contract";
import { checkOrigin, clientContext, corsHeaders, json, logError, noContent, preflight, readJson } from "@/lib/orders/http";
import { resolvePageKey } from "@/lib/orders/resolve";
import { burstLimit } from "@/lib/security/burst-limit";
import { recordEvent } from "@/lib/stats";

export function OPTIONS(req: NextRequest): Promise<Response> {
  return preflight(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  const client = clientContext(req);
  if (!burstLimit("event", client.ip).ok) return noContent({ Vary: "Origin" });
  try {
    const body = await readJson(req, 2 * 1024);
    if (!body.ok) return json({ ok: false, error: "invalid" }, body.status, { Vary: "Origin" });
    const parsed = EventPayload.safeParse(body.value);
    if (!parsed.success) return json({ ok: false, error: "invalid" }, 422, { Vary: "Origin" });

    const target = await resolvePageKey(parsed.data.pageKey, "event");
    if (!target) return noContent({ Vary: "Origin" });
    const verdict = checkOrigin(req, target.kind === "export" ? target.allowedOrigins : null);
    // browsers always send Origin on a POST (sendBeacon included): a beacon without one is a script
    if (!verdict.ok || verdict.noOrigin) return noContent({ Vary: "Origin" });

    await recordEvent(target.pageId, parsed.data, client.ip);
    return noContent(corsHeaders(verdict.cors));
  } catch (err) {
    logError("api/event", err);
    return noContent({ Vary: "Origin" });
  }
}
