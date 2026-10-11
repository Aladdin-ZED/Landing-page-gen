import "server-only";
/**
 * Orders → Google Sheets sync queue (DB first, sheet second).
 *
 * syncPendingOrders(): pending orders (+ failed ones whose backoff elapsed) are claimed (attempts + 1),
 * then written in ONE append request. Whenever a batch may already be partly in the sheet — a retry
 * after a timeout, a requeue, or an order whose upsell was accepted after it was written — column A is
 * read first: ids already present are not appended again (upsell orders get their Produit/Total cells
 * updated instead). Runs are serialized in-process and across processes (MySQL GET_LOCK).
 *
 * pullStatuses(): statuses set by call-center agents in the sheet flow back to the database for
 * orders that are fully synced (the sheet is the source of truth for statuses once connected).
 */
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { RowDataPacket } from "mysql2/promise";
import { db, pool } from "@/lib/db/client";
import { orders, type OrderItems } from "@/lib/db/schema";
import type { OrderStatus } from "@/lib/orders/contract";
import { phoneToNational } from "@/lib/markets/phone";
import { rateLimit } from "@/lib/security/rate-limit";
import { isSheetsConfigured, serviceAccountEmail, type GapiOptions } from "./client";
import { activeSheet, getSheetsConfig, type SheetsConfig } from "./config";
import { cleanText, colLetter, toSheetsSerial } from "./format";
import {
  appendRows,
  COL,
  COLUMNS,
  explain,
  readOrderRows,
  readStatuses,
  statusLabel,
  updateCells,
  type Cell,
} from "./orders-sheet";

type OrderRow = typeof orders.$inferSelect;

/** Wall-clock zone for the Date column (Morocco by default). */
const SHEET_TZ = process.env.APP_TIMEZONE || "Africa/Casablanca";
const LOCK_NAME = "cod:sheets-sync";
/** risk score from which the row is prefixed "[À vérifier]" for the call center */
const REVIEW_SCORE = 50;

/* ------------------------------------------------------------------ */
/* row content                                                         */
/* ------------------------------------------------------------------ */

export function productText(o: Pick<OrderRow, "productName" | "items">): string {
  const parts = [`${o.productName} — ${o.items.bundleLabel}`];
  if (o.items.bump) parts.push(o.items.bump.title);
  if (o.items.upsell) parts.push(o.items.upsell.title);
  return parts.join(" + ");
}

export function variantText(items: OrderItems): string {
  const units = items.variants.map((v) => Object.values(v).filter(Boolean).join("/")).filter(Boolean);
  if (!units.length) return "";
  if (units.every((u) => u === units[0])) return units.length > 1 ? `${units[0]} ×${units.length}` : units[0]!;
  return units.map((u, i) => `${i + 1}: ${u}`).join(" · ");
}

export function sourceText(o: Pick<OrderRow, "utm" | "source" | "ref">): string {
  const u = o.utm ?? {};
  let s =
    u.source ? [u.source, u.campaign].filter(Boolean).join(" · ")
    : u.fbclid ? "facebook"
    : u.ttclid ? "tiktok"
    : u.sccid ? "snapchat"
    : u.gclid ? "google"
    : "direct";
  if (o.source !== "live") {
    let host = "";
    try {
      host = o.ref ? new URL(o.ref).hostname : "";
    } catch {
      host = "";
    }
    s = `${s} (${host || o.source})`;
  }
  return s;
}

/** One sheet row in COLUMNS order. */
export function orderToRow(o: OrderRow): Cell[] {
  const note = [
    o.riskScore >= REVIEW_SCORE ? "[À vérifier]" : "",
    o.note ?? "",
    o.email ? `E-mail : ${o.email}` : "",
  ]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(" · ");
  const row: Cell[] = new Array<Cell>(COLUMNS.length).fill("");
  row[COL.id] = cleanText(o.id, 40);
  row[COL.date] = toSheetsSerial(o.createdAt, SHEET_TZ);
  row[COL.status] = statusLabel(o.status);
  row[COL.name] = cleanText(o.name, 120);
  row[COL.phone] = phoneToNational(o.phone); // RAW text: leading zero kept
  row[COL.city] = cleanText(o.city, 80);
  row[COL.address] = cleanText(o.address, 300);
  row[COL.product] = cleanText(productText(o), 250);
  row[COL.variant] = cleanText(variantText(o.items), 200);
  row[COL.qty] = Math.max(1, Math.trunc(o.qty));
  row[COL.total] = Math.round(Number(o.total) * 100) / 100;
  row[COL.note] = cleanText(note, 500);
  row[COL.source] = cleanText(sourceText(o), 120);
  return row;
}

/* ------------------------------------------------------------------ */
/* locking                                                             */
/* ------------------------------------------------------------------ */

async function withDbLock<T>(fn: () => Promise<T>): Promise<T | "locked"> {
  const conn = await pool().getConnection();
  // a named lock lives as long as its session: a connection that may still hold it never goes back to the pool
  let reusable = false;
  try {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT GET_LOCK(?, 0) AS l", [LOCK_NAME]);
    if (Number(rows[0]?.l) !== 1) {
      reusable = true;
      return "locked";
    }
    try {
      return await fn();
    } finally {
      reusable = await conn.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).then(
        () => true,
        () => false,
      );
    }
  } finally {
    if (reusable) conn.release();
    else conn.destroy();
  }
}

/* ------------------------------------------------------------------ */
/* push                                                                */
/* ------------------------------------------------------------------ */

export interface SyncResult {
  status: "ok" | "not_configured" | "locked" | "error";
  appended: number;
  updated: number;
  /** already present in the sheet (nothing written) */
  skipped: number;
  failed: number;
  error?: string;
}

const empty = (status: SyncResult["status"], error?: string): SyncResult => ({
  status,
  appended: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  ...(error ? { error } : {}),
});

export interface SyncOptions {
  /** max orders per run (default 50) */
  limit?: number;
  /** ignore the retry backoff of failed orders ("Sync now" in the admin) */
  force?: boolean;
  /** Google retries per request (lower in request-adjacent paths) */
  maxRetries?: number;
}

async function syncOnce(sheet: SheetsConfig, opts: SyncOptions): Promise<SyncResult & { selected: number }> {
  const limit = opts.limit ?? 50;
  const now = new Date();
  const eligible = opts.force
    ? inArray(orders.sheetStatus, ["pending", "failed"])
    : or(
        eq(orders.sheetStatus, "pending"),
        and(
          eq(orders.sheetStatus, "failed"),
          sql`${orders.updatedAt} <= DATE_SUB(${now}, INTERVAL LEAST(POW(2, ${orders.sheetAttempts}), 360) MINUTE)`,
        ),
      );
  const batch = await db.select().from(orders).where(eligible).orderBy(orders.createdAt).limit(limit);
  if (!batch.length) return { ...empty("ok"), selected: 0 };

  const ids = batch.map((o) => o.id);
  // claim: any later retry of these rows will look the sheet up before appending
  await db
    .update(orders)
    .set({ sheetAttempts: sql`${orders.sheetAttempts} + 1` })
    .where(inArray(orders.id, ids));

  const gopts: GapiOptions = { maxRetries: opts.maxRetries ?? 4 };
  const result = { ...empty("ok"), selected: batch.length };
  try {
    const needLookup = batch.some((o) => o.sheetAttempts > 0 || !!o.items.upsell);
    const existing = needLookup ? await readOrderRows(sheet.spreadsheetId, sheet.sheetTitle, gopts) : new Map<string, number>();
    const toAppend = batch.filter((o) => !existing.has(o.id));
    const updates: { range: string; values: Cell[][] }[] = [];
    for (const o of batch) {
      const rowNo = existing.get(o.id);
      if (!rowNo) continue;
      if (o.items.upsell) {
        const row = orderToRow(o);
        updates.push({ range: `${colLetter(COL.product)}${rowNo}`, values: [[row[COL.product]!]] });
        updates.push({ range: `${colLetter(COL.total)}${rowNo}`, values: [[row[COL.total]!]] });
        result.updated++;
      } else {
        result.skipped++;
      }
    }
    await appendRows(sheet.spreadsheetId, sheet.sheetTitle, toAppend.map(orderToRow), gopts);
    result.appended = toAppend.length;
    await updateCells(sheet.spreadsheetId, sheet.sheetTitle, updates, gopts);

    // mark synced — unless the order changed meanwhile (e.g. upsell accepted): it stays pending
    const unchanged = batch.map((o) => and(eq(orders.id, o.id), eq(orders.updatedAt, o.updatedAt))!);
    await db
      .update(orders)
      .set({ sheetStatus: "synced", sheetError: null })
      .where(and(inArray(orders.id, ids), or(...unchanged)));
    return result;
  } catch (err) {
    const message = explain(err, serviceAccountEmail()).slice(0, 500);
    await db
      .update(orders)
      .set({ sheetStatus: "failed", sheetError: message, updatedAt: new Date() })
      .where(and(inArray(orders.id, ids), ne(orders.sheetStatus, "synced")));
    return { ...empty("error", message), failed: batch.length, selected: batch.length };
  }
}

declare global {
  var __codSheetsSync: { running: Promise<SyncResult> | null; rerun: boolean; force: boolean } | undefined;
}
// process-wide (route bundles may each load their own copy of this module)
const syncState = () => (globalThis.__codSheetsSync ??= { running: null, rerun: false, force: false });
/** passes per call: a backlog (e.g. orders queued before the sheet was connected) drains in one go */
const MAX_PASSES = 5;

/**
 * Push pending orders to the connected sheet. Safe to call often (after each order, from the cron):
 * concurrent calls coalesce into the running pass, which then runs again to pick up new orders
 * (with the retry backoff ignored when a coalesced caller asked for `force`).
 */
export async function syncPendingOrders(opts: SyncOptions = {}): Promise<SyncResult> {
  const st = syncState();
  if (st.running) {
    st.rerun = true;
    if (opts.force) st.force = true;
    return st.running;
  }
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  st.running = (async () => {
    try {
      if (!isSheetsConfigured()) return empty("not_configured");
      const sheet = await activeSheet();
      if (!sheet) return empty("not_configured");
      const total = empty("ok");
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const force = !!opts.force || st.force;
        st.rerun = false;
        st.force = false;
        const r = await withDbLock(() => syncOnce(sheet, { ...opts, force, limit }));
        if (r === "locked") return pass === 0 ? empty("locked") : total;
        total.appended += r.appended;
        total.updated += r.updated;
        total.skipped += r.skipped;
        total.failed += r.failed;
        if (r.status === "error") return { ...total, status: "error", error: r.error };
        if (!st.rerun && r.selected < limit) break;
      }
      return total;
    } finally {
      st.running = null;
      st.rerun = false;
      st.force = false;
    }
  })();
  return st.running;
}

/* ------------------------------------------------------------------ */
/* pull                                                                */
/* ------------------------------------------------------------------ */

export interface PullResult {
  status: "ok" | "not_configured" | "throttled" | "error";
  /** rows read from the sheet */
  seen: number;
  /** local orders whose status changed */
  updated: number;
  error?: string;
}

/** Apply statuses chosen by agents in the sheet (at most every 5 min unless forced). */
export async function pullStatuses(opts: { force?: boolean } = {}): Promise<PullResult> {
  if (!isSheetsConfigured()) return { status: "not_configured", seen: 0, updated: 0 };
  const sheet = await activeSheet();
  if (!sheet) return { status: "not_configured", seen: 0, updated: 0 };
  if (!opts.force) {
    const gate = await rateLimit("sheets:pull", 1, 290);
    if (!gate.ok) return { status: "throttled", seen: 0, updated: 0 };
  }
  let statuses: Map<string, OrderStatus>;
  try {
    statuses = await readStatuses(sheet.spreadsheetId, sheet.sheetTitle, { maxRetries: 2 });
  } catch (err) {
    return { status: "error", seen: 0, updated: 0, error: explain(err, serviceAccountEmail()) };
  }
  const byStatus = new Map<OrderStatus, string[]>();
  for (const [id, st] of statuses) {
    if (!/^[A-Z0-9]{2,8}-[A-Z0-9]{4,12}$/.test(id)) continue;
    const list = byStatus.get(st) ?? [];
    list.push(id);
    byStatus.set(st, list);
  }
  let updated = 0;
  const now = new Date();
  for (const [status, ids] of byStatus) {
    for (let i = 0; i < ids.length; i += 500) {
      const res = await db
        .update(orders)
        .set({ status, updatedAt: now })
        .where(and(inArray(orders.id, ids.slice(i, i + 500)), eq(orders.sheetStatus, "synced"), ne(orders.status, status)));
      updated += affected(res);
    }
  }
  return { status: "ok", seen: statuses.size, updated };
}

/** affectedRows from a drizzle mysql2 update result */
export function affected(res: unknown): number {
  const head = Array.isArray(res) ? res[0] : res;
  const n = (head as { affectedRows?: number } | undefined)?.affectedRows;
  return typeof n === "number" ? n : 0;
}

/* ------------------------------------------------------------------ */
/* single-order status push (admin edits)                              */
/* ------------------------------------------------------------------ */

export type PushStatusResult = "updated" | "not_found" | "skipped";

/**
 * Write one order's status label into its row (column C). "skipped" when no sheet is connected,
 * "not_found" when the row is not in the sheet (deleted by an agent, or not yet synced).
 * A paused sheet is written too: pausing stops appending orders and pulling statuses, but a status
 * chosen in the admin must reach a row that already exists, or resuming would pull the old label back.
 * Throws SheetsError on Google failures (callers surface `explain()`).
 */
export async function pushOrderStatus(orderId: string, status: OrderStatus): Promise<PushStatusResult> {
  if (!isSheetsConfigured()) return "skipped";
  const sheet = await getSheetsConfig();
  if (!sheet) return "skipped";
  const rows = await readOrderRows(sheet.spreadsheetId, sheet.sheetTitle, { maxRetries: 2 });
  const rowNo = rows.get(orderId);
  if (!rowNo) return "not_found";
  await updateCells(
    sheet.spreadsheetId,
    sheet.sheetTitle,
    [{ range: `${colLetter(COL.status)}${rowNo}`, values: [[statusLabel(status)]] }],
    { maxRetries: 2 },
  );
  return "updated";
}

/** Sheet sync health for dashboards: counts per sheet status. */
export async function syncHealth(): Promise<Record<"pending" | "synced" | "failed" | "disabled", number>> {
  const rows = await db
    .select({ s: orders.sheetStatus, n: sql<number>`COUNT(*)` })
    .from(orders)
    .groupBy(orders.sheetStatus);
  const out = { pending: 0, synced: 0, failed: 0, disabled: 0 };
  for (const r of rows) out[r.s] = Number(r.n);
  return out;
}
