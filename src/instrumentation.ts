/**
 * Runs once per server start, before the first request is handled (Node.js runtime only):
 *  - warns about missing/weak security configuration (never prints secret values)
 *  - applies pending database migrations (serialised across processes with a DB lock)
 *  - purges expired sessions
 * Failures are logged and never crash the process: the app keeps serving what it can and
 * the next start retries.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as typeof globalThis & { __codBooted?: boolean };
  if (g.__codBooted) return;
  g.__codBooted = true;

  const { authConfigWarnings } = await import("./lib/auth/config");
  for (const warning of authConfigWarnings()) console.warn(`[boot] ${warning}`);

  if (!process.env.DATABASE_URL) {
    console.error("[boot] DATABASE_URL is not set — skipping migrations.");
    return;
  }

  try {
    const { runMigrations } = await import("./lib/db/migrate");
    const result = await runMigrations();
    if (result.status === "lock-timeout") {
      console.warn("[boot] another process held the migration lock for too long; skipped migrations this time.");
    } else if (result.status === "applied") {
      console.info(`[boot] applied ${result.applied} migration(s) in ${result.durationMs} ms.`);
    } else {
      console.info(`[boot] database schema up to date (${result.total} migration(s)).`);
    }
  } catch (err) {
    console.error("[boot] database migration failed:", err instanceof Error ? err.message : err);
    return;
  }

  try {
    const { purgeExpiredSessions } = await import("./lib/auth/session");
    const purged = await purgeExpiredSessions();
    if (purged > 0) console.info(`[boot] purged ${purged} expired session(s).`);
  } catch (err) {
    console.error("[boot] session cleanup failed:", err instanceof Error ? err.message : err);
  }
}
