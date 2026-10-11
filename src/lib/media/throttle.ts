/**
 * Per-IP token bucket for public media requests that need database work (cache misses).
 *
 * In memory on purpose: the DB-backed rate limiter would itself queue on the database this protects.
 * Cache hits are free, so visitors never feel it — after the first cold view of a page every image is
 * cached in the process. Mobile carriers in Morocco put many visitors behind one address (CGNAT), so
 * the burst stays generous; a flood of unknown keys or cache-busting misses from one address does not.
 */

export const BUCKET_SIZE = 300;
export const REFILL_PER_SECOND = 5;
const MAX_TRACKED = 20_000;

interface Bucket {
  tokens: number;
  at: number;
}

declare global {
  var __codMediaThrottle: Map<string, Bucket> | undefined;
}

const buckets = () => (globalThis.__codMediaThrottle ??= new Map());

function prune(map: Map<string, Bucket>, now: number): void {
  // full buckets carry no information
  for (const [ip, b] of map) {
    if (b.tokens + ((now - b.at) / 1000) * REFILL_PER_SECOND >= BUCKET_SIZE) map.delete(ip);
  }
  // still too many distinct addresses: forget the oldest half
  if (map.size > MAX_TRACKED) {
    let drop = map.size - MAX_TRACKED / 2;
    for (const ip of map.keys()) {
      if (drop-- <= 0) break;
      map.delete(ip);
    }
  }
}

/**
 * Spend `cost` tokens for `ip`. Returns 0 when allowed, otherwise the seconds to wait (Retry-After).
 */
export function spendMediaTokens(ip: string, cost = 1, now: number = Date.now()): number {
  const map = buckets();
  let b = map.get(ip);
  if (b) {
    b.tokens = Math.min(BUCKET_SIZE, b.tokens + ((now - b.at) / 1000) * REFILL_PER_SECOND);
    b.at = now;
    map.delete(ip); // keep insertion order ≈ last activity
  } else {
    b = { tokens: BUCKET_SIZE, at: now };
  }
  if (map.size >= MAX_TRACKED) prune(map, now);
  map.set(ip, b);
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return 0;
  }
  return Math.max(1, Math.ceil((cost - b.tokens) / REFILL_PER_SECOND));
}
