/**
 * Content-coding of the HTML documents the public routes serve (landing, thank-you, legal).
 *
 *   negotiateEncoding(req.headers.get("accept-encoding"))  → "br" | "gzip" | "identity"
 *   await encodeCached(etag, html, "br")                    → bytes, compressed once per version
 *   await encodeOnce(html, "gzip")                          → bytes, not kept (re-rendered documents)
 *
 * Why here and not in a proxy: `next start` only gzips (per request, level 6) and Hostinger's front
 * proxy may or may not compress. Encoding ourselves gives brotli to every modern browser and turns the
 * per-request work into a cache lookup. Next's compression middleware skips any response that already
 * carries Content-Encoding, so nothing is ever compressed twice.
 *
 * Two tiers per (document, coding), both off the event loop (zlib's thread pool):
 *  - fast: brotli q5 / gzip 6 on the first request (~15 ms for an 850 KB fixture), cached at once;
 *  - best: brotli q11 / gzip 9 (~1 s for brotli on that fixture), computed ONCE in the background by
 *    a single serial worker (so it never occupies more than one pool thread: scrypt logins, DNS and
 *    file I/O share that pool), then swapped in when smaller.
 * The bytes of a representation therefore change once while its meaning does not, which is exactly
 * what a weak ETag promises: compressed representations carry W/"<sha>-br" | W/"<sha>-gz".
 *
 * The cache is content-addressed (key = sha256 of the HTML = the version's ETag), per process,
 * bounded LRU (bytes and entries). An unpublished or replaced version simply ages out.
 * Pure Node (no "server-only" guard) so QA scripts can import it; only server code does.
 */
import { brotliCompress, constants as Z, gzip, type BrotliOptions, type ZlibOptions } from "node:zlib";

export type ContentCoding = "br" | "gzip";
export type Coding = ContentCoding | "identity";

/** Bodies below this size are sent as is (headers would cost more than they save). */
export const MIN_COMPRESS_BYTES = 1024;

/** Upper bound of the cached encoded bytes of this process. */
const MAX_BYTES = 24 * 1024 * 1024;
/** Upper bound of cached (document, coding) pairs. */
const MAX_ENTRIES = 512;
/** Best-level upgrades waiting for the worker at most (the rest stay fast until hit again). */
const MAX_PENDING_UPGRADES = 64;
/** Above this size brotli q11 would hold the worker for seconds: q9 is ~25× faster for ~7% more. */
const BROTLI_MAX_Q11_BYTES = 2 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Negotiation                                                         */
/* ------------------------------------------------------------------ */

/** Elements of Accept-Encoding looked at (real browsers send 3–6). */
const MAX_ELEMENTS = 32;
const QVALUE_RE = /^q\s*=\s*(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/i;
const QPARAM_RE = /^q\s*=/i;

/**
 * The content-coding to answer with (RFC 9110 §12.5.3): the acceptable coding with the highest
 * weight among brotli and gzip ("x-gzip" counts as gzip, "*" covers the unlisted ones, q=0 refuses),
 * brotli on a tie, identity when neither is acceptable or the header is absent. An element with a
 * malformed weight is ignored.
 */
export function negotiateEncoding(header: string | null | undefined): Coding {
  if (!header) return "identity";
  let br: number | undefined;
  let gz: number | undefined;
  let any: number | undefined;
  for (const element of header.split(",", MAX_ELEMENTS)) {
    const [rawName = "", ...params] = element.split(";");
    const name = rawName.trim().toLowerCase();
    if (name !== "br" && name !== "gzip" && name !== "x-gzip" && name !== "*") continue;
    let weight = 1;
    let malformed = false;
    for (const rawParam of params) {
      const param = rawParam.trim();
      if (!QPARAM_RE.test(param)) continue; // other parameters do not change the weight
      const m = QVALUE_RE.exec(param);
      if (m) weight = Number(m[1]);
      else malformed = true;
    }
    if (malformed) continue;
    // listed twice: the more permissive weight wins
    if (name === "br") br = Math.max(br ?? 0, weight);
    else if (name === "*") any = Math.max(any ?? 0, weight);
    else gz = Math.max(gz ?? 0, weight);
  }
  const qBr = br ?? any ?? 0;
  const qGz = gz ?? any ?? 0;
  if (qBr <= 0 && qGz <= 0) return "identity";
  return qBr >= qGz ? "br" : "gzip";
}

/* ------------------------------------------------------------------ */
/* Encoders                                                            */
/* ------------------------------------------------------------------ */

type Tier = "fast" | "best";
type Bytes = Uint8Array<ArrayBuffer>;

function brotliOptions(quality: number, size: number): BrotliOptions {
  return {
    params: {
      [Z.BROTLI_PARAM_MODE]: Z.BROTLI_MODE_TEXT,
      [Z.BROTLI_PARAM_QUALITY]: quality,
      [Z.BROTLI_PARAM_SIZE_HINT]: size,
    },
  };
}

function gzipOptions(level: number): ZlibOptions {
  return { level, memLevel: 9 };
}

const brotliAsync = (input: Buffer, options: BrotliOptions) =>
  new Promise<Buffer>((resolve, reject) => brotliCompress(input, options, (err, out) => (err ? reject(err) : resolve(out))));

const gzipAsync = (input: Buffer, options: ZlibOptions) =>
  new Promise<Buffer>((resolve, reject) => gzip(input, options, (err, out) => (err ? reject(err) : resolve(out))));

/** Encoded bytes on a fresh ArrayBuffer (a valid Response body, never a view into a shared pool). */
async function compress(html: string, coding: ContentCoding, tier: Tier): Promise<Bytes> {
  const input = Buffer.from(html, "utf8");
  const out =
    coding === "br"
      ? await brotliAsync(input, brotliOptions(tier === "fast" ? 5 : input.length <= BROTLI_MAX_Q11_BYTES ? 11 : 9, input.length))
      : await gzipAsync(input, gzipOptions(tier === "fast" ? 6 : 9));
  return new Uint8Array(out);
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

interface Entry {
  body: Bytes;
  tier: Tier;
}

export interface EncodingStats {
  entries: number;
  bytes: number;
  hits: number;
  misses: number;
  /** fast encodings computed for a request (cache misses that were not joined to one in flight) */
  fastRuns: number;
  /** best-level encodings computed in the background */
  upgrades: number;
  /** upgrades queued or running */
  pendingUpgrades: number;
  evictions: number;
  errors: number;
}

interface Store {
  entries: Map<string, Entry>;
  bytes: number;
  /** fast encodings in flight: concurrent cold requests share one */
  inflight: Map<string, Promise<Bytes>>;
  /** keys queued for the best level */
  queued: Set<string>;
  /** the serial upgrade worker (tail of the queue) */
  worker: Promise<void>;
  stats: Omit<EncodingStats, "entries" | "bytes" | "pendingUpgrades">;
}

declare global {
  var __codEncodedCache: Store | undefined;
}

function store(): Store {
  return (globalThis.__codEncodedCache ??= {
    entries: new Map(),
    bytes: 0,
    inflight: new Map(),
    queued: new Set(),
    worker: Promise.resolve(),
    stats: { hits: 0, misses: 0, fastRuns: 0, upgrades: 0, evictions: 0, errors: 0 },
  });
}

function put(s: Store, key: string, entry: Entry): void {
  const old = s.entries.get(key);
  if (old) {
    s.bytes -= old.body.byteLength;
    s.entries.delete(key);
  }
  s.entries.set(key, entry); // most recently used last
  s.bytes += entry.body.byteLength;
  while (s.entries.size > MAX_ENTRIES || s.bytes > MAX_BYTES) {
    const oldest = s.entries.keys().next();
    if (oldest.done) break;
    s.bytes -= s.entries.get(oldest.value)!.body.byteLength;
    s.entries.delete(oldest.value);
    s.stats.evictions++;
  }
}

function logFailure(what: string, err: unknown): void {
  console.error(`[serve] ${what} failed:`, err instanceof Error ? err.message : "unknown error");
}

/** Queue the best-level encoding of a cached fast entry (no-op when queued, upgraded or evicted). */
function scheduleUpgrade(s: Store, key: string, html: string, coding: ContentCoding): void {
  if (s.queued.has(key) || s.queued.size >= MAX_PENDING_UPGRADES) return;
  s.queued.add(key);
  s.worker = s.worker.then(async () => {
    try {
      // evicted while waiting → the document is not hot enough to spend a second of CPU on
      if (s.entries.get(key)?.tier !== "fast") return;
      const body = await compress(html, coding, "best");
      const current = s.entries.get(key);
      if (current?.tier !== "fast") return;
      if (body.byteLength < current.body.byteLength) put(s, key, { body, tier: "best" });
      else current.tier = "best";
      s.stats.upgrades++;
    } catch (err) {
      s.stats.errors++;
      logFailure(`${coding} upgrade`, err);
    } finally {
      s.queued.delete(key);
    }
  });
}

/**
 * The `coding` encoding of `html`, cached under `id` — which MUST identify these exact bytes (the
 * version's ETag, i.e. sha256 of the HTML). The first request pays the fast level; the best level
 * replaces it in the background. Rejects only when zlib fails (callers then send identity).
 */
export function encodeCached(id: string, html: string, coding: ContentCoding): Promise<Bytes> {
  const s = store();
  const key = `${coding}:${id}`;
  const hit = s.entries.get(key);
  if (hit) {
    s.stats.hits++;
    s.entries.delete(key);
    s.entries.set(key, hit); // most recently used last
    if (hit.tier === "fast") scheduleUpgrade(s, key, html, coding);
    return Promise.resolve(hit.body);
  }
  s.stats.misses++;
  const running = s.inflight.get(key);
  if (running) return running;
  s.stats.fastRuns++;
  const job = compress(html, coding, "fast")
    .then((body) => {
      put(s, key, { body, tier: "fast" });
      scheduleUpgrade(s, key, html, coding);
      return body;
    })
    .catch((err: unknown) => {
      s.stats.errors++;
      logFailure(`${coding} encoding`, err);
      throw err;
    })
    .finally(() => s.inflight.delete(key));
  s.inflight.set(key, job);
  return job;
}

/** One-off fast encoding, not kept: for documents rendered anew on every request (dev fixtures). */
export function encodeOnce(html: string, coding: ContentCoding): Promise<Bytes> {
  return compress(html, coding, "fast").catch((err: unknown) => {
    store().stats.errors++;
    logFailure(`${coding} encoding`, err);
    throw err;
  });
}

export function encodingCacheStats(): EncodingStats {
  const s = store();
  return { ...s.stats, entries: s.entries.size, bytes: s.bytes, pendingUpgrades: s.queued.size };
}

/** Resolves once every queued best-level upgrade has run (tests; a warm-up script could await it). */
export async function encodingIdle(): Promise<void> {
  const s = store();
  let tail: Promise<void>;
  do {
    tail = s.worker;
    await tail;
  } while (tail !== s.worker);
}

/** Forget every cached encoding of this process (tests). Work already running lands in the discarded store. */
export function clearEncodingCache(): void {
  globalThis.__codEncodedCache = undefined;
}
