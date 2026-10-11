import "server-only";
/**
 * Allow-lists of the active connected exports, for CORS preflights: an OPTIONS request carries no
 * page key, so the union of every active list is all a preflight can be checked against.
 *
 *  - cached in this process for a minute (on globalThis: route bundles share one copy),
 *  - dropped whenever this process creates, revokes or removes an export,
 *  - an origin missing from the cached list is looked up again (at most every few seconds), so a
 *    brand-new export also works at once when another process or bundle created it — instead of
 *    the shopper's first orders failing with a CORS error for up to a minute.
 */
import { isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { exportsTable } from "@/lib/db/schema";
import { originAllowed } from "./origin";

const TTL_MS = 60_000;
/** A miss re-reads the table at most this often (bounds the cost of preflights from random origins). */
const MISS_REFRESH_MS = 3_000;

interface OriginsCache {
  at: number;
  list: string[];
}

declare global {
  var __codExportOrigins: OriginsCache | null | undefined;
}

async function load(): Promise<string[]> {
  const rows = await db.select({ origins: exportsTable.allowedOrigins }).from(exportsTable).where(isNull(exportsTable.revokedAt));
  const list = [...new Set(rows.flatMap((r) => (Array.isArray(r.origins) ? r.origins.filter((o): o is string => typeof o === "string") : [])))];
  globalThis.__codExportOrigins = { at: Date.now(), list };
  return list;
}

/** Union of the allow-lists of all active (non-revoked) exports. */
export async function activeExportOrigins(): Promise<string[]> {
  const hit = globalThis.__codExportOrigins;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.list;
  return load();
}

/** Is `origin` allowed by any active export? A cached "no" is confirmed against the database. */
export async function exportOriginAllowed(origin: string): Promise<boolean> {
  if (originAllowed(origin, await activeExportOrigins())) return true;
  const hit = globalThis.__codExportOrigins;
  if (hit && Date.now() - hit.at < MISS_REFRESH_MS) return false;
  return originAllowed(origin, await load());
}

/** Call after an export is created, revoked or deleted. */
export function invalidateExportOrigins(): void {
  globalThis.__codExportOrigins = null;
}
