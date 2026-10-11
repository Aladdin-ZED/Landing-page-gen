import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface RateResult {
  ok: boolean;
  count: number;
  limit: number;
  /** seconds until the window resets */
  retryAfter: number;
}

/**
 * Fixed-window rate limiter stored in MariaDB (survives process restarts — Hostinger stops idle apps).
 * One atomic upsert per call. Bucket names should be namespaced, e.g. "login:ip:<hash>".
 */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<RateResult> {
  const key = bucket.slice(0, 191);
  await db.execute(sql`
    INSERT INTO rate_limits (bucket, count, reset_at)
    VALUES (${key}, 1, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${windowSec} SECOND))
    ON DUPLICATE KEY UPDATE
      count = IF(reset_at <= UTC_TIMESTAMP(3), 1, count + 1),
      reset_at = IF(reset_at <= UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ${windowSec} SECOND), reset_at)
  `);
  const [rows] = (await db.execute(
    sql`SELECT count, GREATEST(0, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), reset_at)) AS ttl FROM rate_limits WHERE bucket = ${key}`,
  )) as unknown as [{ count: number; ttl: number }[]];
  const row = rows[0] ?? { count: 1, ttl: windowSec };
  return { ok: row.count <= limit, count: row.count, limit, retryAfter: Number(row.ttl) };
}

/** Has `bucket` already used up `limit` in its current window? Read-only: counts nothing. */
export async function rateLimitReached(bucket: string, limit: number): Promise<boolean> {
  const key = bucket.slice(0, 191);
  const [rows] = (await db.execute(
    sql`SELECT count FROM rate_limits WHERE bucket = ${key} AND reset_at > UTC_TIMESTAMP(3)`,
  )) as unknown as [{ count: number }[]];
  return Number(rows[0]?.count ?? 0) >= limit;
}

/** Housekeeping — delete expired buckets (called from the cron tick). */
export async function purgeRateLimits(): Promise<void> {
  await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 HOUR)`);
}
