/**
 * Recompute the subject analysis (focal point, subject box, heads/hands — src/lib/media/focus.ts) of
 * stored image assets, e.g. after FOCUS_VERSION changed or for rows uploaded before the analysis existed.
 *
 *   npx tsx scripts/media-backfill.ts              rows with no focus or an older FOCUS_VERSION
 *   npx tsx scripts/media-backfill.ts --all        every image row
 *   npx tsx scripts/media-backfill.ts --id <id>    one asset (repeatable)
 *   npx tsx scripts/media-backfill.ts --dry        analyse and print, write nothing
 *   npx tsx scripts/media-backfill.ts --fixtures   analyse public/dev-fixtures → src/lib/media/fixture-focus.ts
 *
 * Reads the largest stored WebP rendition of each asset (the processed master: EXIF-rotated, trimmed
 * for cutouts — the same pixels the upload analysed), one asset at a time. Works against the local
 * XAMPP MariaDB or a production database (DATABASE_URL from the environment, else .env.local / .env).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import mysql from "mysql2/promise";
import { FOCUS_VERSION, parseFocus, type AssetFocus } from "../src/lib/media/focus";
import { analyzeImageFocus } from "../src/lib/media/focus-analyze";

const ROOT = resolve(__dirname, "..");

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of [".env.local", ".env"]) {
    const p = join(ROOT, f);
    if (!existsSync(p)) continue;
    const m = /^DATABASE_URL=(.*)$/m.exec(readFileSync(p, "utf8"));
    if (m?.[1]?.trim()) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("DATABASE_URL is not set (environment, .env.local or .env)");
}

interface Row {
  id: string;
  alpha: number;
  variants: string;
  focus: string | null;
  focus_version: number | null;
  original_name: string | null;
}

interface Variant {
  key: string;
  w: number;
  h: number;
  fmt: string;
}

const describe = (f: AssetFocus) => {
  const heads = (f.keep ?? []).filter((k) => k.k === "head").length;
  const hands = (f.keep ?? []).filter((k) => k.k === "hand").length;
  const b = f.box;
  return `${f.kind.padEnd(7)} focal ${f.x.toFixed(2)},${f.y.toFixed(2)} box ${b.x.toFixed(2)},${b.y.toFixed(2)} ${b.w.toFixed(2)}×${b.h.toFixed(2)}${heads ? ` heads ${heads}` : ""}${hands ? ` hands ${hands}` : ""} conf ${f.conf}`;
};

async function backfillDb(args: string[]): Promise<void> {
  const all = args.includes("--all");
  const dry = args.includes("--dry");
  const ids = args.flatMap((a, i) => (a === "--id" && args[i + 1] ? [args[i + 1]!] : []));
  const c = await mysql.createConnection({ uri: databaseUrl(), charset: "utf8mb4_unicode_ci" });
  try {
    const where = ids.length ? "kind = 'image' AND id IN (?)" : all ? "kind = 'image'" : "kind = 'image' AND (focus_version IS NULL OR focus_version < ?)";
    const [rows] = (await c.query(
      `SELECT id, alpha, variants, focus, focus_version, original_name FROM assets WHERE ${where} ORDER BY created_at`,
      ids.length ? [ids] : all ? [] : [FOCUS_VERSION],
    )) as unknown as [Row[]];
    console.log(`${rows.length} image asset(s) to analyse (FOCUS_VERSION ${FOCUS_VERSION}${dry ? ", dry run" : ""})`);
    let done = 0;
    let failed = 0;
    for (const r of rows) {
      const variants = (typeof r.variants === "string" ? JSON.parse(r.variants) : r.variants) as Variant[];
      const master = variants.filter((v) => v.fmt === "webp").sort((a, b) => b.w - a.w)[0] ?? [...variants].sort((a, b) => b.w - a.w)[0];
      if (!master) {
        console.warn(`  ${r.id}: no image rendition, skipped`);
        failed++;
        continue;
      }
      const [chunks] = (await c.query("SELECT data FROM media_chunks WHERE `key` = ? ORDER BY idx", [master.key])) as unknown as [{ data: Buffer }[]];
      if (!chunks.length) {
        console.warn(`  ${r.id}: rendition ${master.key} has no stored bytes, skipped`);
        failed++;
        continue;
      }
      try {
        const t0 = Date.now();
        const focus = await analyzeImageFocus(Buffer.concat(chunks.map((x) => x.data)), { alpha: !!r.alpha });
        const before = parseFocus(r.focus ? JSON.parse(r.focus) : null);
        console.log(`  ${r.id} ${(r.original_name ?? "").slice(0, 40).padEnd(40)} ${describe(focus)} (${Date.now() - t0} ms)${before ? `\n      was ${describe(before)} v${before.v}` : ""}`);
        if (!dry) await c.query("UPDATE assets SET focus = ?, focus_version = ? WHERE id = ?", [JSON.stringify(focus), FOCUS_VERSION, r.id]);
        done++;
      } catch (err) {
        console.warn(`  ${r.id}: analysis failed — ${err instanceof Error ? err.message : String(err)}`);
        failed++;
      }
    }
    console.log(`${dry ? "analysed" : "updated"} ${done}, failed ${failed}`);
  } finally {
    await c.end();
  }
}

async function backfillFixtures(): Promise<void> {
  const { FIXTURE_ASSETS } = await import("../src/lib/page/fixtures");
  const out: Record<string, AssetFocus> = {};
  for (const a of FIXTURE_ASSETS) {
    const master = [...a.variants].filter((v) => v.fmt === "webp").sort((x, y) => y.w - x.w)[0];
    if (!master) continue;
    const file = join(ROOT, "public", "dev-fixtures", master.key);
    if (!existsSync(file)) {
      console.warn(`  ${a.id}: ${master.key} missing, skipped`);
      continue;
    }
    const focus = await analyzeImageFocus(readFileSync(file), { alpha: !!a.alpha });
    out[a.id] = focus;
    console.log(`  ${a.id} ${String((a as { name?: string }).name ?? "").padEnd(16)} ${describe(focus)}`);
  }
  const body = Object.entries(out)
    .map(([id, f]) => `  ${JSON.stringify(id)}: ${JSON.stringify(f)},`)
    .join("\n");
  const target = join(ROOT, "src", "lib", "media", "fixture-focus.ts");
  writeFileSync(
    target,
    `/**
 * Subject analysis of the dev-fixture photos (public/dev-fixtures), so fixture renders and QA crop
 * exactly like uploaded assets. GENERATED by \`npx tsx scripts/media-backfill.ts --fixtures\` — do not edit.
 */
export const FIXTURE_FOCUS: Readonly<Record<string, unknown>> = {
${body}
};
`,
  );
  console.log(`wrote ${Object.keys(out).length} fixture(s) → src/lib/media/fixture-focus.ts`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--fixtures")) await backfillFixtures();
  else await backfillDb(args);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
