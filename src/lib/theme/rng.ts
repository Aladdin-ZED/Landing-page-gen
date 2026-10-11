/**
 * Deterministic randomness for the theme engine. Same seed → same choices on server, browser and
 * worker (no Math.random anywhere in src/lib/theme).
 */

/** 32-bit FNV-1a hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG → floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PRNG for (seed, purpose) — independent streams per purpose so adding a draw never shifts others. */
export function rngFor(seed: number, purpose: string): () => number {
  return mulberry32((Math.imul(seed >>> 0, 0x9e3779b1) ^ hashString(purpose)) >>> 0);
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick from empty list");
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

/** Weighted pick; weights ≤ 0 are never chosen (falls back to the first item if all are ≤ 0). */
export function pickWeighted<T>(rng: () => number, items: readonly { value: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (items.length === 0) throw new Error("pickWeighted from empty list");
  if (total <= 0) return items[0]!.value;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r < 0) return it.value;
  }
  return items[items.length - 1]!.value;
}

/** Seeded Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(rng: () => number, items: readonly T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Uniform float in [min, max). */
export const range = (rng: () => number, min: number, max: number) => min + (max - min) * rng();
