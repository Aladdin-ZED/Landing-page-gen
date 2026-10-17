/**
 * Offers v2 deploy gate (docs/OFFERS.md §I.3) — READ ONLY: every pages.draft, every page_versions.doc
 * and every non-revoked export's version through the v1 → v2 upgrade the new build applies on read.
 *
 *   npm run qa:upgrade-dry-run -- --db mysql://user:pass@127.0.0.1:3306/cod_studio [--json report.json]
 *
 * Asserts 0 unreadable documents, ids preserved, offerMath (cents) == v1 bundleMath per bundle,
 * orderTotals equal for each bundle × bump on/off, Sheets labels identical; prints repair counts by
 * kind and every money value changed by rounding. The session is switched to read-only transactions
 * before the first query. Run it on the XAMPP database and on a fresh dump of production imported
 * into XAMPP before every deploy of this feature. Exit code 1 when the gate fails.
 */
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { runUpgradeCheck, upgradeCheckOk, upgradeCheckSummary } from "@/lib/db/upgrade-check";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = arg("db");
  if (!url || !/^mysql:\/\//.test(url)) {
    console.error("upgrade-dry-run: --db mysql://… is required (read-only)");
    process.exit(2);
  }
  const conn = await mysql.createConnection({ uri: url, charset: "utf8mb4_unicode_ci", timezone: "Z", connectTimeout: 10_000 });
  try {
    const started = Date.now();
    const report = await runUpgradeCheck(conn);
    const ok = upgradeCheckOk(report);
    for (const line of upgradeCheckSummary(report)) console.log(line);
    console.log(`${ok ? "✓ upgrade dry run passed" : "✗ upgrade dry run FAILED"} (${Date.now() - started} ms)`);
    const json = arg("json");
    if (json) writeFileSync(json, JSON.stringify(report, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await conn.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("upgrade-dry-run:", err instanceof Error ? err.message : err);
  process.exit(2);
});
