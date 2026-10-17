/**
 * Charming prices (docs/OFFERS.md §H.1) — pure, shared by the generator's offer suggestions, the
 * offer presets and the builder's "Discount %" price mode:
 *   - whole-unit COD currencies (MAD, DZD…) end in 9: 99 · 149 · 249 · 349 · 449 · 1 299;
 *   - decimal currencies end in .90 under 100 (29.90 · 54.90) and in 9 above (119 · 249).
 * Every price these helpers return is derived from the owner's own prices; nothing here invents a
 * reference price.
 */
import { round2 } from "./money";

/** Currencies priced in whole units on COD pages (prices end in 9: 99, 149, 199…). */
const WHOLE_UNIT = new Set(["MAD", "DZD", "TND", "EGP", "XOF", "SAR", "AED"]);

export const isWholeUnit = (currency: string): boolean => WHOLE_UNIT.has(currency.toUpperCase());

/** The smallest price step of a currency on COD pages: 1 (whole units) or 0.01. */
export const priceStep = (currency: string): number => (isWholeUnit(currency) ? 1 : 0.01);

/** Charming candidates around `n` for a currency, closest first (all > 0). */
export function charmCandidates(n: number, currency: string): number[] {
  const near = (xs: number[]) => xs.filter((x) => x > 0).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  if (isWholeUnit(currency)) {
    // the step grows with the price: 179 / 249 under 300, 349 / 449 under 1 000, 1 299 above
    const step = n < 300 ? 10 : n < 1000 ? 50 : 100;
    const lo = Math.floor(n / step) * step - 1;
    return near([lo, lo + step, lo - step]);
  }
  // decimal currencies: x.90 under 100, whole x9 above
  if (n < 100) {
    const lo = Math.floor(n) - 0.1;
    return near([lo, lo + 1, lo - 1].map(round2));
  }
  const lo = Math.floor(n / 10) * 10 - 1;
  return near([lo, lo + 10, lo - 10]);
}

/** A plain price for the currency (whole units or 2 decimals). */
const plainPrice = (n: number, currency: string) => (isWholeUnit(currency) ? Math.round(n) : round2(n));

/** The charming price closest to `target` (a plain rounded price when none is near). */
export function charm(target: number, currency: string): number {
  const t = Math.max(0, target);
  return charmCandidates(t, currency)[0] ?? plainPrice(t, currency);
}

/** Charming prices on the grid around `x` (a few steps on both sides), ascending. */
function charmGrid(x: number, currency: string): number[] {
  const out = new Set<number>();
  for (const k of [0.9, 0.97, 1, 1.03, 1.1]) for (const c of charmCandidates(x * k, currency)) out.add(c);
  return [...out].sort((a, b) => a - b);
}

/**
 * The charming price closest to `target` strictly inside (floor, ceil); else the charming price
 * nearest to `target` among those just above `floor` and just below `ceil`; else a plain rounded
 * price clamped inside the interval. Used for packs: above the smaller pack, below the units bought
 * alone.
 */
export function charmBetween(target: number, floor: number, ceil: number, currency: string): number {
  const inside = (c: number) => c > floor + 0.001 && c < ceil - 0.001;
  for (const c of charmCandidates(target, currency)) if (inside(c)) return c;
  const near = [...charmGrid(floor, currency), ...charmGrid(ceil, currency)].filter(inside).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  if (near[0] !== undefined) return near[0];
  const step = priceStep(currency);
  return round2(Math.min(Math.max(plainPrice(target, currency), floor + step), ceil - step));
}
