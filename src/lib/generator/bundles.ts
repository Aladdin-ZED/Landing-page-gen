/**
 * Bundle suggestion: ×1 at the unit price, ×2 ≈ 1.8×, ×3 ≈ 2.5×, rounded to "charming" prices
 * (MAD: 199 / 349 / 449…; EUR: 29.90 / 54.90…). Every pack is a genuine saving per unit, and
 * no struck-through reference is invented: compareAt stays empty (the reference is unit × qty).
 */
import type { Bundle } from "@/lib/page/schema";
import { round2 } from "@/lib/page/pricing";

/** Currencies priced in whole units on COD pages (prices end in 9: 99, 149, 199…). */
const WHOLE_UNIT = new Set(["MAD", "DZD", "TND", "EGP", "XOF", "SAR", "AED"]);

/** Charming candidates around `n` for a currency, closest first. */
function charmCandidates(n: number, currency: string): number[] {
  if (WHOLE_UNIT.has(currency)) {
    // step grows with the price: 179 / 249 under 300, 349 / 449 under 1 000, 1 299 above
    const step = n < 300 ? 10 : n < 1000 ? 50 : 100;
    const lo = Math.floor(n / step) * step - 1;
    return [lo, lo + step, lo - step].filter((x) => x > 0).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  }
  // decimal currencies: x.90 under 100, whole x9 above
  if (n < 100) {
    const lo = Math.floor(n) - 0.1;
    return [lo, lo + 1, lo - 1].filter((x) => x > 0).map(round2).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  }
  const lo = Math.floor(n / 10) * 10 - 1;
  return [lo, lo + 10, lo - 10].filter((x) => x > 0).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
}

/** Closest charming price strictly inside (floor, ceil); falls back to a plain rounded price. */
function charmBetween(target: number, floor: number, ceil: number, currency: string): number {
  for (const c of charmCandidates(target, currency)) if (c > floor + 0.001 && c < ceil - 0.001) return c;
  const plain = WHOLE_UNIT.has(currency) ? Math.round(target) : round2(target);
  return Math.min(Math.max(plain, floor + (WHOLE_UNIT.has(currency) ? 1 : 0.01)), ceil - (WHOLE_UNIT.has(currency) ? 1 : 0.01));
}

export interface BundleText {
  title: string;
  subtitle: string;
}

/**
 * Three packs for a unit price. When the unit price is too small for honest multi-packs (or not
 * set), returns a single pack.
 */
export function suggestBundles(unitPrice: number, currency: string, texts: readonly BundleText[], freeShipping: boolean): Bundle[] {
  const price = round2(Math.max(0, unitPrice));
  const t = (i: number) => texts[i] ?? { title: "", subtitle: "" };
  const single: Bundle = {
    id: "x1",
    qty: 1,
    price,
    title: t(0).title || undefined,
    subtitle: t(0).subtitle || undefined,
    badge: "none",
    freeShipping,
    preselected: false,
  };
  if (price < 5) return [single];
  // ×2: below 2 × unit, above unit; ×3: below 3 × unit, and cheaper per piece than ×2
  const x2 = charmBetween(price * 1.8, price, price * 2, currency);
  const x3 = charmBetween(price * 2.5, x2, Math.min(price * 3, (x2 / 2) * 3), currency);
  if (!(x2 > price && x2 < price * 2 && x3 > x2 && x3 / 3 < x2 / 2)) return [single];
  return [
    single,
    { id: "x2", qty: 2, price: x2, title: t(1).title || undefined, subtitle: t(1).subtitle || undefined, badge: "popular", freeShipping, preselected: false },
    { id: "x3", qty: 3, price: x3, title: t(2).title || undefined, subtitle: t(2).subtitle || undefined, badge: "best", freeShipping, preselected: false },
  ];
}
