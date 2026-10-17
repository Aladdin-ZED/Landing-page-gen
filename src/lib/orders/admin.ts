import "server-only";
/**
 * Admin-side order queries & mutations (call after requireUser() with the right permission):
 * orders list/detail, status updates (mirrored to the sheet), sheet re-sync, abandoned leads,
 * blocklist, per-page order stats and streamed CSV exports (orders, abandoned leads).
 *
 * CSV (docs/OFFERS.md §G.4): "Variante" is the warehouse order text the Sheet gets (codes, short
 * names, [OFFERT] / [AJOUT] / [UPSELL], « typed values », "|| Commande : …"); "Options (+)" lists
 * what added money ("XL ×2 (+40); Emballage cadeau (+15)") and "SKU" is the Sheets SKU cell.
 */
import { and, count, desc, eq, gte, inArray, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import { blocklist, leads, orders, pages } from "@/lib/db/schema";
import { normalizePhone, toAsciiDigits } from "@/lib/markets/phone";
import { cleanText, explain, pushOrderStatus, serviceAccountEmail, syncPendingOrders, type SyncResult } from "@/lib/sheets";
import { skuCell, variantCell } from "@/lib/sheets/row";
import type { OrderItems } from "@/lib/db/schema";
import { ORDER_STATUSES, type OrderStatus } from "./contract";

export type OrderRecord = typeof orders.$inferSelect;
export type LeadRecord = typeof leads.$inferSelect;
export type BlockRecord = typeof blocklist.$inferSelect;

export const ORDER_STATUS_IDS = ORDER_STATUSES.map((s) => s.id) as OrderStatus[];
export const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === "string" && (ORDER_STATUS_IDS as string[]).includes(v);

export interface Actor {
  id: string;
  ip?: string | null;
}

export interface Pagination {
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const paging = (p: Pagination = {}) => {
  const page = Math.max(1, Math.floor(p.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(p.pageSize ?? 50)));
  return { page, pageSize, offset: (page - 1) * pageSize };
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

/* ------------------------------------------------------------------ */
/* orders                                                              */
/* ------------------------------------------------------------------ */

export interface OrderFilters {
  /** order id, phone (any format) or customer name */
  q?: string;
  status?: OrderStatus | OrderStatus[];
  pageId?: string;
  from?: Date;
  /** exclusive upper bound */
  to?: Date;
  sheetStatus?: OrderRecord["sheetStatus"];
  /** only orders with riskScore ≥ minRisk */
  minRisk?: number;
  source?: OrderRecord["source"];
}

function orderWhere(f: OrderFilters): SQL | undefined {
  const w: SQL[] = [];
  const q = f.q?.trim().slice(0, 80);
  if (q) {
    const digits = toAsciiDigits(q).replace(/[^0-9]/g, "");
    const or_: SQL[] = [eq(orders.id, q.toUpperCase()), like(orders.name, `%${likeEscape(q)}%`)];
    // phone search: "0612…" / "+2126…" / "612…" all match the stored E.164
    if (digits.length >= 4) or_.push(like(orders.phone, `%${digits.replace(/^0+/, "")}%`));
    w.push(or(...or_)!);
  }
  if (Array.isArray(f.status)) {
    if (f.status.length) w.push(inArray(orders.status, f.status));
  } else if (f.status) {
    w.push(eq(orders.status, f.status));
  }
  if (f.pageId) w.push(eq(orders.pageId, f.pageId));
  if (f.from) w.push(gte(orders.createdAt, f.from));
  if (f.to) w.push(lt(orders.createdAt, f.to));
  if (f.sheetStatus) w.push(eq(orders.sheetStatus, f.sheetStatus));
  if (typeof f.minRisk === "number") w.push(gte(orders.riskScore, f.minRisk));
  if (f.source) w.push(eq(orders.source, f.source));
  return w.length ? and(...w) : undefined;
}

export async function listOrders(filters: OrderFilters = {}, pagination?: Pagination): Promise<Paged<OrderRecord & { pageName: string | null }>> {
  const { page, pageSize, offset } = paging(pagination);
  const where = orderWhere(filters);
  const [rows, [t]] = await Promise.all([
    db
      .select({ order: orders, pageName: pages.name })
      .from(orders)
      .leftJoin(pages, eq(pages.id, orders.pageId))
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(orders).where(where),
  ]);
  return { items: rows.map((r) => ({ ...r.order, pageName: r.pageName ?? null })), total: Number(t?.n ?? 0), page, pageSize };
}

export interface OrderDetail extends OrderRecord {
  page: { id: string; name: string; slug: string } | null;
  /** other orders of the same phone (newest first, max 20) */
  history: Pick<OrderRecord, "id" | "status" | "total" | "currency" | "createdAt" | "productName">[];
  blocked: { phone: boolean; ip: boolean };
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  const [row] = await db
    .select({ order: orders, page: { id: pages.id, name: pages.name, slug: pages.slug } })
    .from(orders)
    .leftJoin(pages, eq(pages.id, orders.pageId))
    .where(eq(orders.id, id))
    .limit(1);
  if (!row) return null;
  const o = row.order;
  const [history, blocks] = await Promise.all([
    db
      .select({
        id: orders.id,
        status: orders.status,
        total: orders.total,
        currency: orders.currency,
        createdAt: orders.createdAt,
        productName: orders.productName,
      })
      .from(orders)
      .where(and(eq(orders.phone, o.phone), sql`${orders.id} <> ${o.id}`))
      .orderBy(desc(orders.createdAt))
      .limit(20),
    db
      .select({ kind: blocklist.kind })
      .from(blocklist)
      .where(
        or(
          and(eq(blocklist.kind, "phone"), eq(blocklist.value, o.phone)),
          o.ipHash ? and(eq(blocklist.kind, "ip"), eq(blocklist.value, o.ipHash)) : sql`FALSE`,
        ),
      ),
  ]);
  return {
    ...o,
    page: row.page?.id ? { id: row.page.id, name: row.page.name, slug: row.page.slug } : null,
    history,
    blocked: { phone: blocks.some((b) => b.kind === "phone"), ip: blocks.some((b) => b.kind === "ip") },
  };
}

export type UpdateStatusResult =
  | { ok: true; sheet: "updated" | "not_found" | "skipped" | "queued" }
  | { ok: false; error: string };

/**
 * Change an order's status. When the order may already be in the connected sheet (synced, or a
 * previous push attempt may have appended it before failing), the sheet cell is written FIRST — even
 * while sync is paused — because the sheet is the source of truth for statuses: if Google fails,
 * nothing changes locally and the French explanation is returned, so the two never diverge.
 * Orders not in the sheet yet keep the change locally ("queued"): their append carries the new status.
 */
export async function updateOrderStatus(id: string, status: OrderStatus, actor: Actor): Promise<UpdateStatusResult> {
  if (!isOrderStatus(status)) return { ok: false, error: "Unknown status." };
  const [o] = await db
    .select({ id: orders.id, status: orders.status, sheetStatus: orders.sheetStatus, sheetAttempts: orders.sheetAttempts })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);
  if (!o) return { ok: false, error: "Order not found." };
  if (o.status === status) return { ok: true, sheet: "skipped" };

  const synced = o.sheetStatus === "synced";
  const mayBeInSheet = synced || (o.sheetStatus !== "disabled" && o.sheetAttempts > 0);
  let sheet: "updated" | "not_found" | "skipped" | "queued" = synced || o.sheetStatus === "disabled" ? "skipped" : "queued";
  if (mayBeInSheet) {
    try {
      const pushed = await pushOrderStatus(id, status);
      if (synced || pushed === "updated") sheet = pushed;
    } catch (err) {
      return { ok: false, error: explain(err, serviceAccountEmail()) };
    }
  }
  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
  await audit("orders.status_changed", { userId: actor.id, target: id, meta: { from: o.status, to: status, sheet }, ip: actor.ip });
  return { ok: true, sheet };
}

/** "Resend to sheet": re-queue one order (looked up in the sheet first, so no duplicate row). */
export async function requeueOrderSync(id: string, actor: Actor): Promise<boolean> {
  const res = await db
    .update(orders)
    .set({
      sheetStatus: "pending",
      sheetError: null,
      sheetAttempts: sql`GREATEST(${orders.sheetAttempts}, 1)`,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), sql`${orders.sheetStatus} <> 'disabled'`));
  const ok = affectedRows(res) === 1;
  if (ok) await audit("orders.sheet_requeued", { userId: actor.id, target: id, ip: actor.ip });
  return ok;
}

/** Re-queue every failed order and run a sync pass now. */
export async function retryFailedSync(actor: Actor): Promise<SyncResult> {
  await db
    .update(orders)
    .set({ sheetStatus: "pending", sheetAttempts: sql`GREATEST(${orders.sheetAttempts}, 1)` })
    .where(eq(orders.sheetStatus, "failed"));
  await audit("orders.sheet_retry_all", { userId: actor.id, ip: actor.ip });
  return syncPendingOrders({ force: true, limit: 200 });
}

/** Per-page order counts & revenue by status for a period (excludes honeypot-flagged orders). */
export async function orderStatsByPage(range: { from: Date; to: Date }): Promise<
  { pageId: string; pageName: string | null; orders: number; revenue: number; byStatus: Partial<Record<OrderStatus, number>> }[]
> {
  const rows = await db
    .select({
      pageId: orders.pageId,
      pageName: pages.name,
      status: orders.status,
      n: sql<number>`COUNT(*)`,
      revenue: sql<number>`COALESCE(SUM(${orders.total}), 0)`,
    })
    .from(orders)
    .leftJoin(pages, eq(pages.id, orders.pageId))
    .where(and(gte(orders.createdAt, range.from), lt(orders.createdAt, range.to), sql`${orders.sheetStatus} <> 'disabled'`))
    .groupBy(orders.pageId, pages.name, orders.status);
  const out = new Map<string, { pageId: string; pageName: string | null; orders: number; revenue: number; byStatus: Partial<Record<OrderStatus, number>> }>();
  for (const r of rows) {
    const e = out.get(r.pageId) ?? { pageId: r.pageId, pageName: r.pageName ?? null, orders: 0, revenue: 0, byStatus: {} };
    const n = Number(r.n);
    e.orders += n;
    if (r.status !== "cancelled" && r.status !== "fake" && r.status !== "returned") e.revenue += Number(r.revenue);
    if (isOrderStatus(r.status)) e.byStatus[r.status] = (e.byStatus[r.status] ?? 0) + n;
    out.set(r.pageId, e);
  }
  return [...out.values()].map((e) => ({ ...e, revenue: Math.round(e.revenue * 100) / 100 })).sort((a, b) => b.orders - a.orders);
}

/* ------------------------------------------------------------------ */
/* leads                                                               */
/* ------------------------------------------------------------------ */

export interface LeadFilters {
  pageId?: string;
  from?: Date;
  to?: Date;
  /** only leads that never became an order (default true) */
  abandonedOnly?: boolean;
  q?: string;
}

function leadWhere(filters: LeadFilters): SQL | undefined {
  const w: SQL[] = [];
  if (filters.abandonedOnly ?? true) w.push(isNull(leads.convertedOrderId));
  if (filters.pageId) w.push(eq(leads.pageId, filters.pageId));
  if (filters.from) w.push(gte(leads.createdAt, filters.from));
  if (filters.to) w.push(lt(leads.createdAt, filters.to));
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const digits = toAsciiDigits(q).replace(/[^0-9]/g, "").replace(/^0+/, "");
    w.push(or(like(leads.name, `%${likeEscape(q)}%`), ...(digits.length >= 4 ? [like(leads.phone, `%${digits}%`)] : []))!);
  }
  return w.length ? and(...w) : undefined;
}

export async function listLeads(filters: LeadFilters = {}, pagination?: Pagination): Promise<Paged<LeadRecord & { pageName: string | null }>> {
  const { page, pageSize, offset } = paging(pagination);
  const where = leadWhere(filters);
  const [rows, [t]] = await Promise.all([
    db
      .select({ lead: leads, pageName: pages.name })
      .from(leads)
      .leftJoin(pages, eq(pages.id, leads.pageId))
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ n: count() }).from(leads).where(where),
  ]);
  return { items: rows.map((r) => ({ ...r.lead, pageName: r.pageName ?? null })), total: Number(t?.n ?? 0), page, pageSize };
}

/** Housekeeping: abandoned leads older than `days` (cron). */
export async function purgeAbandonedLeads(days = 30): Promise<number> {
  const res = await db
    .delete(leads)
    .where(and(isNull(leads.convertedOrderId), lte(leads.createdAt, new Date(Date.now() - days * 86_400_000))));
  return affectedRows(res);
}

/* ------------------------------------------------------------------ */
/* blocklist                                                           */
/* ------------------------------------------------------------------ */

export async function listBlocklist(pagination?: Pagination): Promise<Paged<BlockRecord>> {
  const { page, pageSize, offset } = paging(pagination);
  const [items, [t]] = await Promise.all([
    db.select().from(blocklist).orderBy(desc(blocklist.createdAt)).limit(pageSize).offset(offset),
    db.select({ n: count() }).from(blocklist),
  ]);
  return { items, total: Number(t?.n ?? 0), page, pageSize };
}

async function addBlock(kind: "phone" | "ip", value: string, reason: string | null, actor: Actor): Promise<void> {
  await db
    .insert(blocklist)
    .values({ id: newId(), kind, value, reason: reason ? cleanText(reason, 200) : null, createdBy: actor.id, createdAt: new Date() })
    .onDuplicateKeyUpdate({ set: { reason: reason ? cleanText(reason, 200) : null } });
  await audit("blocklist.added", { userId: actor.id, target: kind === "phone" ? value : `ip:${value.slice(0, 12)}…`, ip: actor.ip });
}

/** Block a phone number (any common format; validated for `country`). */
export async function blockPhone(raw: string, country: string, reason: string | null, actor: Actor): Promise<{ ok: true; e164: string } | { ok: false; error: string }> {
  const p = normalizePhone(raw, country) ?? (/^\+[1-9][0-9]{6,14}$/.test(raw.trim()) ? { e164: raw.trim() } : null);
  if (!p) return { ok: false, error: "Invalid phone number." };
  await addBlock("phone", p.e164, reason, actor);
  return { ok: true, e164: p.e164 };
}

/** Block the phone and/or the (hashed) IP of an order. */
export async function blockFromOrder(orderId: string, what: { phone?: boolean; ip?: boolean }, reason: string | null, actor: Actor): Promise<boolean> {
  const [o] = await db.select({ phone: orders.phone, ipHash: orders.ipHash }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!o) return false;
  if (what.phone) await addBlock("phone", o.phone, reason ?? `Commande ${orderId}`, actor);
  if (what.ip && o.ipHash) await addBlock("ip", o.ipHash, reason ?? `Commande ${orderId}`, actor);
  return true;
}

export async function unblock(id: string, actor: Actor): Promise<boolean> {
  const res = await db.delete(blocklist).where(eq(blocklist.id, id));
  const ok = affectedRows(res) === 1;
  if (ok) await audit("blocklist.removed", { userId: actor.id, target: id, ip: actor.ip });
  return ok;
}

/* ------------------------------------------------------------------ */
/* CSV export                                                          */
/* ------------------------------------------------------------------ */

const CSV_HEADER = [
  "Order", "Date (UTC)", "Status", "Name", "Phone", "City", "Address", "Product", "Pack", "Variante", "Qty", "Subtotal",
  "Shipping", "Total", "Currency", "Note", "Email", "Page", "Source", "UTM source", "UTM campaign", "Risk", "Flags",
  "Options (+)", "SKU",
];

const plainMoney = (n: number) => String(Math.round(n * 100) / 100);

/** "Options (+)": what added money to the order, one entry per reason ("XL ×2 (+40); Emballage cadeau (+15)"). */
export function surchargesText(items: OrderItems | null | undefined): string {
  return (items?.reasons ?? [])
    .filter((r) => r.amount > 0)
    .map((r) => `${cleanText(r.label, 60)}${r.count > 1 ? ` ×${r.count}` : ""} (+${plainMoney(r.amount)})`)
    .join("; ");
}

/** RFC 4180 field, formula-injection safe (Excel/Sheets): leading = + - @ tab CR get a ' prefix. */
function csvField(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Streamed CSV (UTF-8 with BOM for Excel) of all orders matching `filters`, newest first. */
export function ordersCsv(filters: OrderFilters = {}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const where = orderWhere(filters);
  let cursor: { createdAt: Date; id: string } | null = null;
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(enc.encode(`\uFEFF${CSV_HEADER.join(",")}\r\n`));
          return;
        }
        const c = cursor;
        const after = c ? or(lt(orders.createdAt, c.createdAt), and(eq(orders.createdAt, c.createdAt), lt(orders.id, c.id))) : undefined;
        const rows = await db
          .select({ order: orders, pageName: pages.name })
          .from(orders)
          .leftJoin(pages, eq(pages.id, orders.pageId))
          .where(and(where, after))
          .orderBy(desc(orders.createdAt), desc(orders.id))
          .limit(500);
        if (!rows.length) {
          controller.close();
          return;
        }
        let chunk = "";
        for (const { order: o, pageName } of rows) {
          chunk +=
            [
              o.id,
              o.createdAt.toISOString().replace("T", " ").slice(0, 19),
              ORDER_STATUSES.find((s) => s.id === o.status)?.fr ?? o.status,
              o.name,
              o.phone,
              o.city,
              o.address,
              o.productName,
              o.items.bundleLabel,
              variantCell(o),
              o.qty,
              o.subtotal,
              o.shipping,
              o.total,
              o.currency,
              o.note,
              o.email,
              pageName,
              o.source,
              o.utm?.source,
              o.utm?.campaign,
              o.riskScore,
              (o.flags ?? []).join(" "),
              surchargesText(o.items),
              skuCell(o),
            ]
              .map(csvField)
              .join(",") + "\r\n";
        }
        controller.enqueue(enc.encode(chunk));
        const last = rows[rows.length - 1]!.order;
        cursor = { createdAt: last.createdAt, id: last.id };
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

const LEADS_CSV_HEADER = ["Date (UTC)", "Name", "Phone", "City", "Page", "Pack", "Selection", "UTM source", "UTM campaign", "Order"];

/** Streamed CSV of the leads matching `filters` (abandoned only by default), newest first. */
export function leadsCsv(filters: LeadFilters = {}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const where = leadWhere(filters);
  let cursor: { createdAt: Date; id: string } | null = null;
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!started) {
          started = true;
          controller.enqueue(enc.encode(`﻿${LEADS_CSV_HEADER.join(",")}\r\n`));
          return;
        }
        const c = cursor;
        const after = c ? or(lt(leads.createdAt, c.createdAt), and(eq(leads.createdAt, c.createdAt), lt(leads.id, c.id))) : undefined;
        const rows = await db
          .select({ lead: leads, pageName: pages.name })
          .from(leads)
          .leftJoin(pages, eq(pages.id, leads.pageId))
          .where(and(where, after))
          .orderBy(desc(leads.createdAt), desc(leads.id))
          .limit(500);
        if (!rows.length) {
          controller.close();
          return;
        }
        let chunk = "";
        for (const { lead: l, pageName } of rows) {
          chunk +=
            [
              l.createdAt.toISOString().replace("T", " ").slice(0, 19),
              l.name,
              l.phone,
              l.city,
              pageName,
              l.bundleId,
              l.selection,
              l.utm?.source,
              l.utm?.campaign,
              l.convertedOrderId,
            ]
              .map(csvField)
              .join(",") + "\r\n";
        }
        controller.enqueue(enc.encode(chunk));
        const last = rows[rows.length - 1]!.lead;
        cursor = { createdAt: last.createdAt, id: last.id };
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

function affectedRows(res: unknown): number {
  const head = Array.isArray(res) ? res[0] : res;
  const n = (head as { affectedRows?: number } | undefined)?.affectedRows;
  return typeof n === "number" ? n : 0;
}
