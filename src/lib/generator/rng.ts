/**
 * Deterministic randomness for the generator: same seed + key → same choices everywhere
 * (server, browser, worker). Independent streams per key, so adding a draw never shifts others.
 */

/** 32-bit FNV-1a hash. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG for (seed, purpose). */
export function rngFor(seed: number, key: string): () => number {
  return mulberry32((Math.imul(seed >>> 0, 0x9e3779b1) ^ hash32(key)) >>> 0);
}

/** A derived seed in the ThemeSpec range (0 … 2^31 − 1). */
export function deriveSeed(seed: number, key: string): number {
  return Math.floor(rngFor(seed, key)() * 2_147_483_647);
}

export function weighted<T>(rng: () => number, items: readonly { value: T; weight: number }[]): T {
  if (items.length === 0) throw new Error("weighted pick from an empty list");
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return items[0]!.value;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r < 0) return it.value;
  }
  return items[items.length - 1]!.value;
}

export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
