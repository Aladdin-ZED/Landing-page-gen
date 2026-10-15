/**
 * The order hand-off between the landing form and the thank-you page (sessionStorage "lp-order").
 * Read back defensively: storage is user-controlled, so every field is type-checked and bounded.
 */
import type { W } from "./core";
import { sget, sset } from "./core";
import type { UnitGroup } from "./variants";

export const ORDER_KEY = "lp-order";
export const ORDER_ID_RE = /^[A-Za-z0-9-]{4,40}$/;

export interface OrderRecord {
  orderId: string;
  name: string;
  total: number;
  currency: string;
  bundleLabel: string;
  /** human line for [data-ty="items"]: bundle label (+ order bump title) */
  items: string;
  qty: number;
  /** chosen product options, identical units counted (variants.ts unitGroups) */
  options?: UnitGroup[];
  upsellToken?: string;
  eventId: string;
  /** epoch ms the order was confirmed (upsell window start) */
  ts: number;
  pageKey: string;
  upsell?: "added" | "declined";
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const n = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);

/** Stored option summary, bounded (≤ 20 unit groups × 3 choices) and type-checked. */
function options(v: unknown): UnitGroup[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: UnitGroup[] = [];
  for (const g of v.slice(0, 20) as { n?: unknown; parts?: unknown }[]) {
    if (!g || !Array.isArray(g.parts)) continue;
    const parts = (g.parts.slice(0, 3) as { label?: unknown; sw?: unknown }[])
      .filter((p) => p && typeof p.label === "string" && p.label)
      .map((p) => ({ label: s(p.label, 40), sw: typeof p.sw === "string" && /^#[0-9a-fA-F]{6}$/.test(p.sw) ? p.sw : undefined }));
    if (parts.length) out.push({ n: Math.min(20, Math.max(1, Math.floor(n(g.n)) || 1)), parts });
  }
  return out.length ? out : undefined;
}

export function readOrder(win: W): OrderRecord | null {
  try {
    const o = JSON.parse(sget(win, "sessionStorage", ORDER_KEY) || "null") as Record<string, unknown> | null;
    if (!o || typeof o !== "object" || typeof o.orderId !== "string" || !ORDER_ID_RE.test(o.orderId)) return null;
    const token = s(o.upsellToken, 128);
    return {
      orderId: o.orderId,
      name: s(o.name, 80),
      total: n(o.total),
      currency: /^[A-Z]{3}$/.test(s(o.currency, 3)) ? s(o.currency, 3) : "",
      bundleLabel: s(o.bundleLabel, 120),
      items: s(o.items, 240),
      qty: Math.max(1, Math.floor(n(o.qty)) || 1),
      options: options(o.options),
      upsellToken: /^[a-zA-Z0-9_-]{16,128}$/.test(token) ? token : undefined,
      eventId: s(o.eventId, 64),
      ts: n(o.ts),
      pageKey: s(o.pageKey, 80),
      upsell: o.upsell === "added" || o.upsell === "declined" ? o.upsell : undefined,
    };
  } catch {
    return null;
  }
}

export function writeOrder(win: W, rec: OrderRecord): boolean {
  return sset(win, "sessionStorage", ORDER_KEY, JSON.stringify(rec));
}
