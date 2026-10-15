/**
 * Runs once per server start, before the first request is handled (Node.js runtime only):
 *  - warns about missing/weak security configuration (never prints secret values); an unusable
 *    APP_SECRET is logged as an error, since every order fails with it
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

  const { authConfigWarnings, isAppSecretConfigured } = await import("./lib/auth/config");
  // visitor IPs are hashed with APP_SECRET: without a usable one every order fails too, not only the
  // admin, so its line goes out at error level (hosts' log views filter and colour by level)
  const secretBroken = !isAppSecretConfigured();
  for (const warning of authConfigWarnings()) {
    if (secretBroken && warning.startsWith("APP_SECRET")) console.error(`[boot] ERROR: ${warning}`);
    else console.warn(`[boot] ${warning}`);
  }

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
