import "server-only";
/**
 * Size of the app's database against the hosting plan's per-database limit (Hostinger Business:
 * 3 GB). Past the limit Hostinger suspends write permissions until the size drops, so orders,
 * sign-ins and settings would fail along with everything else. Media files (media_chunks) are the
 * bulk of it: the admin warns from DB_WARN_RATIO on, and new uploads are refused from
 * DB_BLOCK_RATIO on so orders keep the remaining space.
 *
 * Size = SUM(data_length + index_length) of this database's tables, the figure phpMyAdmin shows.
 * InnoDB keeps these statistics approximate (refreshed as tables change), which is fine for 70 % /
 * 85 % marks. Cached per process for a few minutes; a stored upload clears the cache.
 */
import type { RowDataPacket } from "mysql2/promise";
import { logError } from "@/lib/orders/log";
import { pool } from "./client";

/** Hostinger Business: 3 GB per database. Other plans: set DB_QUOTA_MB. */
const DEFAULT_QUOTA_MB = 3 * 1024;
export const DB_WARN_RATIO = 0.7;
export const DB_BLOCK_RATIO = 0.85;
const TTL_MS = 5 * 60_000;

export interface DbUsage {
  bytes: number;
  quotaBytes: number;
  /** bytes / quotaBytes */
  ratio: number;
  /** "warn" from DB_WARN_RATIO on, "full" from DB_BLOCK_RATIO on (new uploads are refused) */
  level: "ok" | "warn" | "full";
}

declare global {
  var __codDbUsage: { at: number; bytes: number } | undefined;
}

/** DB_QUOTA_MB when it is a positive whole number of MB, else 3 GB. */
export function dbQuotaBytes(): number {
  const raw = process.env.DB_QUOTA_MB?.trim() ?? "";
  const mb = /^\d{1,7}$/.test(raw) ? Number(raw) : 0;
  return (mb > 0 ? mb : DEFAULT_QUOTA_MB) * 1024 * 1024;
}

/** Current usage (cached), or null when the size can't be read: monitoring never blocks anything. */
export async function getDbUsage(opts: { fresh?: boolean } = {}): Promise<DbUsage | null> {
  let cached = globalThis.__codDbUsage;
  if (opts.fresh || !cached || Date.now() - cached.at > TTL_MS) {
    try {
      const [rows] = await pool().query<RowDataPacket[]>(
        "SELECT COALESCE(SUM(data_length + index_length), 0) AS bytes FROM information_schema.tables WHERE table_schema = DATABASE()",
      );
      cached = globalThis.__codDbUsage = { at: Date.now(), bytes: Number(rows[0]?.bytes ?? 0) };
    } catch (err) {
      logError("db:usage", err);
      return null;
    }
  }
  const quotaBytes = dbQuotaBytes();
  const ratio = cached.bytes / quotaBytes;
  return { bytes: cached.bytes, quotaBytes, ratio, level: ratio >= DB_BLOCK_RATIO ? "full" : ratio >= DB_WARN_RATIO ? "warn" : "ok" };
}

/** Forget the cached size after a write that grows it noticeably (a stored upload). */
export function invalidateDbUsage(): void {
  globalThis.__codDbUsage = undefined;
}
