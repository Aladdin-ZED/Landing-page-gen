/**
 * Seeded randomness for the illustration system.
 *
 * Same seed (+ key) → same sequence on every render (publish, admin preview, export), so the
 * SVG markup is byte-identical across renders. Never use Math.random() anywhere in src/landing.
 */
export type Seed = number | string;

/** 32-bit hash of any seed: FNV-1a over its string form, then the murmur3 finalizer (avalanche). */
export function hashSeed(seed: Seed): number {
  const s = typeof seed === "number" ? (Number.isFinite(seed) ? String(seed) : "0") : seed;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — tiny, fast PRNG with good distribution for graphics. Floats in [0, 1). */
export function mulberry32(state: number): () => number {
  let a = state >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** uniform float in [0, 1) */
  next(): number;
  /** uniform float in [min, max) */
  range(min: number, max: number): number;
  /** uniform integer in [min, max] (inclusive) */
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  chance(p: number): boolean;
  sign(): 1 | -1;
  /** uniform float in [-amount, amount] */
  jitter(amount: number): number;
  /** independent child stream — stable no matter how many values the parent consumed */
  fork(key: string): Rng;
}

export function createRng(seed: Seed, key = ""): Rng {
  const base = key ? `${String(seed)}|${key}` : String(seed);
  const next = mulberry32(hashSeed(base));
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.min(max, Math.floor(min + (max - min + 1) * next())),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T,
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    jitter: (amount) => (next() * 2 - 1) * amount,
    fork: (k) => createRng(base, k),
  };
}

/**
 * Seeded "hand placed" tilt in whole degrees: |angle| in [min, max] with a random sign.
 * Near-zero tilts read as mistakes, so they are avoided.
 */
export function seededTilt(seed: Seed, key: string, max = 4, min = 1): number {
  const r = createRng(seed, `tilt:${key}`);
  const lo = Math.max(0, Math.min(min, max));
  return r.sign() * r.int(Math.round(lo), Math.round(max));
}
