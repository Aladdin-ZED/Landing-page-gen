/**
 * GET /api/cron/tick?key=<CRON_KEY> — hPanel cron (every 5 min):
 * push queued orders to Google Sheets, pull agent statuses (≤ every 5 min), housekeeping
 * (rate-limit buckets, visitor markers > 2 days, abandoned leads > 30 days, expired sessions).
 * Also keeps the Node process warm. Wrong/missing key → 404 (endpoint stays invisible).
 */
import type { NextRequest } from "next/server";
import { purgeExpiredSessions } from "@/lib/auth";
import { cronKeySecret } from "@/lib/auth/config";
import { purgeAbandonedLeads } from "@/lib/orders/admin";
import { clientContext, errorSummary, json, logError } from "@/lib/orders/http";
import { hashIp, safeEqual } from "@/lib/security/crypto";
import { purgeRateLimits, rateLimit } from "@/lib/security/rate-limit";
import { pullStatuses, syncPendingOrders } from "@/lib/sheets/sync";
import { purgeVisitorMarkers } from "@/lib/stats";

export const maxDuration = 120;

const hidden = () =>
  new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    logError(`cron:${name}`, err);
    // the error's name and driver code only: a message can quote bound values (customer data)
    return { error: errorSummary(err).slice(0, 200) };
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const expected = cronKeySecret(); // null when unset, shorter than 8 or a template value
  const given = req.nextUrl.searchParams.get("key") ?? "";
  if (!expected) return hidden();
  // key guessing is throttled per IP (the real cron calls twice per 10 min at most)
  const gate = await rateLimit(`cron:ip:${hashIp(clientContext(req).ip)}`, 60, 600);
  if (!gate.ok || !safeEqual(given, expected)) return hidden();

  const started = Date.now();
  const sync = await step("sync", () => syncPendingOrders({ limit: 100 }));
  const pull = await step("pull", () => pullStatuses());
  const purged = {
    rateLimits: await step("rate_limits", async () => {
      await purgeRateLimits();
      return true;
    }),
    visitorMarkers: await step("visitors", () => purgeVisitorMarkers(2)),
    abandonedLeads: await step("leads", () => purgeAbandonedLeads(30)),
    sessions: await step("sessions", () => purgeExpiredSessions()),
  };
  return json({ ok: true, ms: Date.now() - started, sync, pull, purged });
}
