import "server-only";
/**
 * Orders screen helpers on top of @/lib/orders: URL filters → OrderFilters (store-day ranges),
 * status counts for the filter chips, and serializable rows / details for client components.
 */
import { and, count, eq, gte, isNull, lt, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { blocklist, leads, orders } from "@/lib/db/schema";
import { getOrder, isOrderStatus, type OrderFilters, type OrderRecord } from "@/lib/orders";
import { variantText, type OrderStatus } from "@/lib/orders/contract";
import { addDays, dayKey, dayStart, isDay } from "./time";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "all" | "custom";
export const RANGE_KEYS: RangeKey[] = ["today", "7d", "30d", "90d", "all", "custom"];

export interface OrderQuery {
  q: string;
  status: OrderStatus | null;
  pageId: string | null;
  range: RangeKey;
  from: string | null;
  to: string | null;
  sheet: "failed" | "pending" | null;
  risky: boolean;
  page: number;
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Read and sanitize the orders URL (every value is whitelisted or pattern-checked). */
export function parseOrderQuery(sp: Params): OrderQuery {
  const status = one(sp.status);
  const range = one(sp.range) as RangeKey;
  const sheet = one(sp.sheet);
  const from = one(sp.from);
  const to = one(sp.to);
  return {
    q: one(sp.q).trim().slice(0, 80),
    status: isOrderStatus(status) ? status : null,
    pageId: ULID.test(one(sp.page_id)) ? one(sp.page_id) : null,
    range: RANGE_KEYS.includes(range) ? range : "all",
    from: isDay(from) ? from : null,
    to: isDay(to) ? to : null,
    sheet: sheet === "failed" || sheet === "pending" ? sheet : null,
    risky: one(sp.risky) === "1",
    page: Math.max(1, Math.min(100_000, Number.parseInt(one(sp.page), 10) || 1)),
  };
}

/** [from, to) instants of a range in the store's time zone. */
export function rangeBounds(q: Pick<OrderQuery, "range" | "from" | "to">): { from?: Date; to?: Date } {
  const today = dayKey();
  switch (q.range) {
    case "today":
      return { from: dayStart(today) };
    case "7d":
      return { from: dayStart(addDays(today, -6)) };
    case "30d":
      return { from: dayStart(addDays(today, -29)) };
    case "90d":
      return { from: dayStart(addDays(today, -89)) };
    case "custom": {
      const [a, b] = q.from && q.to && q.from > q.to ? [q.to, q.from] : [q.from, q.to];
      return { from: a ? dayStart(a) : undefined, to: b ? dayStart(addDays(b, 1)) : undefined };
    }
    default:
      return {};
  }
}

export function toOrderFilters(q: OrderQuery): OrderFilters {
  const { from, to } = rangeBounds(q);
  return {
    q: q.q || undefined,
    status: q.status ?? undefined,
    pageId: q.pageId ?? undefined,
    from,
    to,
    sheetStatus: q.sheet ?? undefined,
    minRisk: q.risky ? 30 : undefined,
  };
}

/** Orders per status inside the current range / page scope (chips). */
export async function statusCounts(q: OrderQuery): Promise<Record<string, number> & { all: number }> {
  const { from, to } = rangeBounds(q);
  const where: SQL[] = [];
  if (from) where.push(gte(orders.createdAt, from));
  if (to) where.push(lt(orders.createdAt, to));
  if (q.pageId) where.push(eq(orders.pageId, q.pageId));
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .groupBy(orders.status);
  const out: Record<string, number> & { all: number } = { all: 0 };
  for (const r of rows) {
    out[r.status] = Number(r.n);
    out.all += Number(r.n);
  }
  return out;
}

export async function tabCounts(): Promise<{ orders: number; leads: number; blocked: number }> {
  const [[o], [l], [b]] = await Promise.all([
    db.select({ n: count() }).from(orders),
    db.select({ n: count() }).from(leads).where(isNull(leads.convertedOrderId)),
    db.select({ n: count() }).from(blocklist),
  ]);
  return { orders: Number(o?.n ?? 0), leads: Number(l?.n ?? 0), blocked: Number(b?.n ?? 0) };
}

/* ------------------------------------------------------------------ */
/* serializable shapes                                                 */
/* ------------------------------------------------------------------ */

export interface OrderRow {
  id: string;
  createdAt: string;
  status: string;
  name: string;
  phone: string;
  city: string | null;
  productName: string;
  bundleLabel: string;
  /** chosen product options in one line ("2 × Noir/M + Beige/L"), "" without options */
  options: string;
  qty: number;
  total: number;
  currency: string;
  pageName: string | null;
  source: "live" | "export" | "php";
  sheetStatus: "pending" | "synced" | "failed" | "disabled";
  riskScore: number;
  flags: string[];
}

export function toOrderRow(o: OrderRecord & { pageName: string | null }): OrderRow {
  return {
    id: o.id,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    name: o.name,
    phone: o.phone,
    city: o.city,
    productName: o.productName,
    bundleLabel: o.items?.bundleLabel ?? "",
    options: variantText(o.items?.variants),
    qty: o.qty,
    total: Number(o.total),
    currency: o.currency,
    pageName: o.pageName,
    source: o.source,
    sheetStatus: o.sheetStatus,
    riskScore: o.riskScore,
    flags: o.flags ?? [],
  };
}

export interface OrderDetailJson extends OrderRow {
  updatedAt: string;
  address: string | null;
  note: string | null;
  email: string | null;
  locale: string | null;
  subtotal: number;
  shipping: number;
  items: {
    bundleLabel: string;
    qty: number;
    unitPrice: number;
    variants: Record<string, string>[];
    bump: { title: string; price: number } | null;
    upsell: { title: string; price: number } | null;
  };
  utm: Record<string, string>;
  ref: string | null;
  sheetAttempts: number;
  sheetError: string | null;
  page: { id: string; name: string; slug: string } | null;
  history: { id: string; status: string; total: number; currency: string; createdAt: string; productName: string }[];
  blocked: { phone: boolean; ip: boolean };
  hasIp: boolean;
}

export async function orderDetailJson(id: string): Promise<OrderDetailJson | null> {
  const o = await getOrder(id);
  if (!o) return null;
  return {
    ...toOrderRow({ ...o, pageName: o.page?.name ?? null }),
    updatedAt: o.updatedAt.toISOString(),
    address: o.address,
    note: o.note,
    email: o.email,
    locale: o.locale,
    subtotal: Number(o.subtotal),
    shipping: Number(o.shipping),
    items: {
      bundleLabel: o.items.bundleLabel,
      qty: o.items.qty,
      unitPrice: Number(o.items.unitPrice),
      variants: o.items.variants ?? [],
      bump: o.items.bump ?? null,
      upsell: o.items.upsell ?? null,
    },
    utm: o.utm ?? {},
    ref: o.ref,
    sheetAttempts: o.sheetAttempts,
    sheetError: o.sheetError,
    page: o.page,
    history: o.history.map((h) => ({
      id: h.id,
      status: h.status,
      total: Number(h.total),
      currency: h.currency,
      createdAt: h.createdAt.toISOString(),
      productName: h.productName,
    })),
    blocked: o.blocked,
    hasIp: !!o.ipHash,
  };
}

export interface LeadRow {
  id: string;
  createdAt: string;
  name: string | null;
  phone: string;
  city: string | null;
  bundleId: string | null;
  pageName: string | null;
  utmSource: string | null;
}

export function toLeadRow(l: { id: string; createdAt: Date; name: string | null; phone: string; city: string | null; bundleId: string | null; pageName: string | null; utm: Record<string, string> | null }): LeadRow {
  return {
    id: l.id,
    createdAt: l.createdAt.toISOString(),
    name: l.name,
    phone: l.phone,
    city: l.city,
    bundleId: l.bundleId,
    pageName: l.pageName,
    utmSource: l.utm?.source ?? null,
  };
}

export interface BlockRow {
  id: string;
  kind: "phone" | "ip";
  /** E.164 phone, or a short fingerprint of the hashed IP (never the hash itself) */
  value: string;
  reason: string | null;
  createdAt: string;
}

export function toBlockRow(b: { id: string; kind: "phone" | "ip"; value: string; reason: string | null; createdAt: Date }): BlockRow {
  return {
    id: b.id,
    kind: b.kind,
    value: b.kind === "phone" ? b.value : `Network #${b.value.slice(0, 8)}`,
    reason: b.reason,
    createdAt: b.createdAt.toISOString(),
  };
}
