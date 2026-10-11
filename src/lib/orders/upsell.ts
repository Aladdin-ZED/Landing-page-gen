import "server-only";
/**
 * One-click post-purchase upsell from the thank-you page. The token returned with the order is
 * single-use (its hash is cleared atomically), valid for max(30, offer window) minutes (+2 min grace),
 * and the upsell price always comes from the version the order was placed on.
 */
import { timingSafeEqual } from "node:crypto";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { round2 } from "@/lib/page/pricing";
import { hashIp } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import { bumpOrderStats } from "@/lib/stats";
import { versionDoc } from "./resolve";
import { upsellTokenHash } from "./create";
import { logError } from "./log";

export type UpsellResponse =
  | { ok: true; orderId: string; total: number; currency: string }
  | { ok: false; error: "invalid" | "expired" | "rate_limited" };

const GRACE_MS = 2 * 60_000;
const CLOSED: ReadonlySet<string> = new Set(["cancelled", "fake", "returned"]);

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export interface UpsellResult {
  response: UpsellResponse;
  /** re-queue the sheet row update after responding */
  sync: boolean;
  retryAfter?: number;
}

export async function acceptUpsell(input: { orderId: string; token: string }, ctx: { ip: string }): Promise<UpsellResult> {
  const gate = await rateLimit(`upsell:ip:${hashIp(ctx.ip)}`, 20, 600);
  if (!gate.ok) return { response: { ok: false, error: "rate_limited" }, sync: false, retryAfter: gate.retryAfter };

  const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const hash = upsellTokenHash(input.token);
  if (!order?.upsellTokenHash || !sameHash(order.upsellTokenHash, hash) || order.items.upsell) {
    return { response: { ok: false, error: "invalid" }, sync: false };
  }
  // the call center already closed this order (cancelled / fake): nothing to add to
  if (CLOSED.has(order.status)) return { response: { ok: false, error: "expired" }, sync: false };
  const doc = order.versionId ? await versionDoc(order.versionId) : null;
  const offer = doc?.offers.upsell;
  if (!offer?.enabled) return { response: { ok: false, error: "invalid" }, sync: false };

  const windowMs = Math.max(30, offer.windowMinutes) * 60_000 + GRACE_MS;
  if (Date.now() - order.createdAt.getTime() > windowMs) return { response: { ok: false, error: "expired" }, sync: false };

  const price = round2(offer.price);
  const items = { ...order.items, upsell: { title: offer.title, price } };
  const res = await db
    .update(orders)
    .set({
      items,
      subtotal: sql`${orders.subtotal} + ${price}`,
      total: sql`${orders.total} + ${price}`,
      upsellTokenHash: null,
      sheetStatus: sql`IF(${orders.sheetStatus} = 'disabled', 'disabled', 'pending')`,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, order.id), eq(orders.upsellTokenHash, hash), notInArray(orders.status, [...CLOSED])));
  const head = (Array.isArray(res) ? res[0] : res) as { affectedRows?: number };
  if (head?.affectedRows !== 1) return { response: { ok: false, error: "invalid" }, sync: false }; // lost a race

  const honeypot = order.sheetStatus === "disabled";
  if (!honeypot) {
    await bumpOrderStats(order.pageId, order.createdAt, { revenue: price }).catch((err) => logError("orders:upsell-stats", err));
  }
  return {
    response: { ok: true, orderId: order.id, total: round2(Number(order.total) + price), currency: order.currency },
    sync: !honeypot,
  };
}
