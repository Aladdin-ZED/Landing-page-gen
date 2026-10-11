/**
 * POST /api/admin/sheets/sync — "Sync now": push queued/failed orders (ignoring retry backoff) and
 * pull statuses set by agents in the sheet.
 */
import type { NextRequest } from "next/server";
import { adminGuard, json, logError } from "@/lib/orders/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { pullStatuses, syncPendingOrders } from "@/lib/sheets";

export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<Response> {
  const g = await adminGuard(req, "orders.write");
  if (!g.ok) return g.response;
  const gate = await rateLimit(`sheets:sync:${g.user.id}`, 12, 600);
  if (!gate.ok) return json({ ok: false, error: "rate_limited" }, 429, { "Retry-After": String(gate.retryAfter) });
  try {
    const push = await syncPendingOrders({ force: true, limit: 200 });
    const pull = push.status === "not_configured" ? null : await pullStatuses({ force: true });
    return json({ ok: push.status !== "error" && pull?.status !== "error", push, pull });
  } catch (err) {
    logError("api/admin/sheets:sync", err);
    return json({ ok: false, error: "server" }, 500);
  }
}
