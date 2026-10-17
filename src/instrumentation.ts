/**
 * Runs once per server start, before the first request is handled (Node.js runtime only):
 *  - warns about missing/weak security configuration (never prints secret values); an unusable
 *    APP_SECRET is logged as an error, since every order fails with it
 *  - applies pending database migrations (serialised across processes with a DB lock)
 *  - purges expired sessions
 *  - one-time boot tasks in ONE process (withBootLock, src/lib/db/boot-lock.ts), in the background:
 *    published checksums in the v2 document form (marker setting doc_schema = 2), then the read-only
 *    Offers v2 upgrade dry run (`[upgrade-check]` lines) — they never delay serving
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

  void bootTasks();
}

/** One-time tasks, run by the process that gets the boot lock (others skip them). Never throws. */
async function bootTasks(): Promise<void> {
  try {
    const { withBootLock } = await import("./lib/db/boot-lock");
    const { bootUpgradeCheck, syncPublishedChecksums } = await import("./lib/db/boot-tasks");
    const res = await withBootLock(async () => {
      const checksums = await syncPublishedChecksums();
      if (!checksums.skipped) console.info(`[boot] published checksums in the v2 document form: ${checksums.updated} of ${checksums.pages} updated.`);
      // pixel library migration (docs/OFFERS.md §A.6): one-time, idempotent, marker written last
      try {
        const { migratePixelLibrary } = await import("./lib/pixels/migrate.server");
        const px = await migratePixelLibrary();
        if (px.ran) console.info(`[boot] pixel library created: ${px.entries} pixel(s), ${px.tokensCopied} token(s) copied, ${px.testCodesDeactivated} test code(s) deactivated.`);
      } catch (err) {
        console.error("[boot] pixel library migration failed:", err instanceof Error ? err.message : err);
      }
      return true;
    });
    if (!res.ran) return;
    await bootUpgradeCheck().catch((err) => console.error("[upgrade-check] failed:", err instanceof Error ? err.message : err));
  } catch (err) {
    console.error("[boot] one-time tasks failed:", err instanceof Error ? err.message : err);
  }
}
