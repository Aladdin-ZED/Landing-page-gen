/**
 * Media store self-test against the local database (writes and removes its own test rows):
 *   npx tsx --conditions=react-server src/lib/media/selftest-store.ts
 *
 * Checks the public-read hardening: single-flight loads, the 60 s miss cache, the dedicated read
 * pool failing fast when saturated while the main (order) pool stays responsive, and the verified
 * disk cache for large files (one copy from the database, ranges from disk, tamper detection,
 * database fallback, removal on delete).
 */
import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) passes++;
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (title: string) => console.log(`\n${title}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

if (!process.env.DATABASE_URL) {
  const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const url = /^DATABASE_URL=(.*)$/m.exec(env)?.[1]?.trim();
  if (url) process.env.DATABASE_URL = url;
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const parts: Buffer[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}

async function main(): Promise<void> {
  const store = await import("./store");
  const { pool } = await import("@/lib/db/client");
  const assetId = `5e1f7e57${randomBytes(12).toString("hex")}`;
  const smallKey = `${assetId}-640.webp`;
  const bigKey = `${assetId}-1280.mp4`;
  const small = randomBytes(300 * 1024);
  const big = randomBytes(9 * 1024 * 1024 + 12345); // > MAX_CACHED_FILE → disk path
  const bigSha = createHash("sha256").update(big).digest("hex");
  const diskFile = join(tmpdir(), "cod-studio-media", bigSha);

  // count every query on the media read pool
  let queries = 0;
  let delay = 0;
  await store.getMediaMeta(`${assetId}-1.webp`); // creates the pool
  const readPool = globalThis.__codMediaState!.read.pool!;
  const query = readPool.query.bind(readPool);
  (readPool as unknown as { query: (...a: unknown[]) => unknown }).query = async (...args: unknown[]) => {
    queries++;
    if (delay) await sleep(delay);
    return (query as (...a: unknown[]) => unknown)(...args);
  };

  try {
    section("metadata · miss cache");
    queries = 0;
    for (let i = 0; i < 5; i++) await store.getMediaMeta(smallKey);
    check("unknown key queried once, then cached as missing", queries === 1, `${queries} queries`);
    check("peek reports known-missing", store.peekMediaMeta(smallKey) === null);

    const conn = await pool().getConnection();
    try {
      await conn.beginTransaction();
      await store.insertFiles(conn, assetId, [
        { key: smallKey, mime: "image/webp", data: small },
        { key: bigKey, mime: "video/mp4", data: big },
      ]);
      await conn.commit();
    } finally {
      conn.release();
    }
    check("insert clears the miss", store.peekMediaMeta(smallKey) === undefined);

    section("whole files · single-flight");
    queries = 0;
    const files = await Promise.all(Array.from({ length: 20 }, () => store.getMediaFile(smallKey)));
    check("20 concurrent cold loads → 2 queries (meta + chunks)", queries === 2, `${queries} queries`);
    check("same bytes for everyone", files.every((f) => f === files[0] && f?.data.equals(small)));
    queries = 0;
    await store.getMediaFile(smallKey);
    check("cached afterwards", queries === 0 && store.mediaBodyCached(files[0]!));

    section("read pool · saturation");
    delay = 250;
    queries = 0;
    const t0 = performance.now();
    const results = await Promise.allSettled(
      Array.from({ length: store.READ_CONNECTIONS + store.READ_QUEUE + 6 }, (_, i) =>
        store.getMediaMeta(`${assetId}-${100 + i}.webp`).then(() => performance.now() - t0),
      ),
    );
    const busy = results.filter((r) => r.status === "rejected" && r.reason instanceof store.MediaBusyError);
    check("overflow beyond 2 running + 32 waiting fails fast with MediaBusyError", busy.length === 6, `${busy.length} busy`);
    const mainT = performance.now();
    // fire the order-side query while media reads are still saturated
    const satAgain = Promise.allSettled(Array.from({ length: 34 }, (_, i) => store.getMediaMeta(`${assetId}-${300 + i}.webp`)));
    await pool().query("SELECT 1");
    const mainMs = performance.now() - mainT;
    check(`main pool unaffected while media reads queue (${mainMs.toFixed(0)} ms)`, mainMs < 200);
    await satAgain;
    delay = 0;

    section("large files · disk cache");
    const bigMeta = (await store.getMediaMeta(bigKey))!;
    check("not cached before first use", !store.mediaBodyCached(bigMeta));
    queries = 0;
    const firstByte = await Promise.all(Array.from({ length: 25 }, async () => readAll(await store.openMediaRange(bigMeta, 0, 0))));
    const batches = Math.ceil(bigMeta.chunks / 4);
    check(`25 concurrent 1-byte ranges → one copy (${batches} batch queries)`, queries === batches, `${queries} queries`);
    check("1-byte range correct", firstByte.every((b) => b.length === 1 && b[0] === big[0]));
    check("disk copy verified and indexed", store.mediaBodyCached(bigMeta) && existsSync(diskFile));
    check("disk copy is byte-identical", existsSync(diskFile) && readFileSync(diskFile).equals(big));
    queries = 0;
    const a = store.CHUNK_SIZE - 5;
    const b = store.CHUNK_SIZE * 3 + 7;
    const mid = await readAll(await store.openMediaRange(bigMeta, a, b));
    const tail = await readAll(await store.openMediaRange(bigMeta, big.length - 100, big.length - 1));
    check("cross-chunk range correct", mid.equals(big.subarray(a, b + 1)));
    check("tail range correct", tail.equals(big.subarray(big.length - 100)));
    check("ranges from disk need no queries", queries === 0, `${queries} queries`);
    const whole = await store.getMediaFile(bigKey);
    check("whole large file read from disk", !!whole && whole.data.equals(big) && queries === 0, `${queries} queries`);

    section("large files · tampering, fallback, delete");
    const corrupt = readFileSync(diskFile);
    corrupt[12345] = corrupt[12345]! ^ 0xff;
    writeFileSync(diskFile, corrupt);
    globalThis.__codMediaState!.disk = { ready: null, index: new Map(), total: 0, flights: new Map(), backoff: new Map() };
    const healed = await readAll(await store.openMediaRange(bigMeta, 12340, 12350));
    check("tampered file from an earlier run is detected and re-copied", healed.equals(big.subarray(12340, 12351)));
    check("disk copy repaired", readFileSync(diskFile).equals(big));

    globalThis.__codMediaState!.disk.backoff.set("*", Date.now() + 60_000);
    queries = 0;
    const viaDb = await readAll(await store.openMediaRange(bigMeta, 1_000_000, 1_000_099));
    check("disk unavailable → streamed from the database", viaDb.equals(big.subarray(1_000_000, 1_000_100)) && queries > 0);
    globalThis.__codMediaState!.disk.backoff.clear();

    section("cleanup");
    const del = await pool().getConnection();
    try {
      await del.beginTransaction();
      const keys = await store.deleteFilesOfAsset(del, assetId);
      await del.commit();
      store.evictKeys(keys);
      check("rows deleted", keys.length === 2);
    } finally {
      del.release();
    }
    await sleep(100);
    check("disk copy removed with the asset", !existsSync(diskFile));
    check("deleted key resolves to null", (await store.getMediaMeta(bigKey)) === null);
  } finally {
    // never leave test rows behind, even on failure
    await pool().query("DELETE FROM media_chunks WHERE `key` LIKE ?", [`${assetId}%`]);
    await pool().query("DELETE FROM media_files WHERE asset_id = ?", [assetId]);
    await readPool.end().catch(() => undefined);
    await pool().end().catch(() => undefined);
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  if (failures) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
