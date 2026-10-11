/**
 * Pricing math shared by renderer, runtime and server (server ALWAYS recomputes — never trusts client totals).
 * Pure functions, no dependencies.
 */
import type { Bundle, Offers, Product } from "./schema";

export interface BundleMath {
  id: string;
  qty: number;
  total: number;
  /** genuine reference total (compareAt or unit price × qty) */
  reference: number;
  savings: number;
  /** whole percent, 0..99 */
  savingsPct: number;
  perUnit: number;
  /** show struck-through reference only if there is a real saving */
  showReference: boolean;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function bundleMath(b: Bundle, unitPrice: number): BundleMath {
  const reference = round2(b.compareAt ?? unitPrice * b.qty);
  const savings = round2(Math.max(0, reference - b.price));
  const savingsPct = reference > 0 ? Math.min(99, Math.round((savings / reference) * 100)) : 0;
  return {
    id: b.id,
    qty: b.qty,
    total: round2(b.price),
    reference,
    savings,
    savingsPct,
    perUnit: round2(b.price / b.qty),
    showReference: savings > 0.009,
  };
}

/** Which bundle is selected on first paint: explicit preselected → "popular" badge → first. */
export function defaultBundleId(offers: Offers): string {
  return (
    offers.bundles.find((b) => b.preselected)?.id ??
    offers.bundles.find((b) => b.badge === "popular")?.id ??
    offers.bundles[0]!.id
  );
}

export interface OrderTotals {
  bundle: BundleMath;
  bump: number;
  shipping: number;
  subtotal: number;
  total: number;
}

export function orderTotals(
  product: Pick<Product, "price">,
  offers: Offers,
  bundleId: string,
  withBump: boolean,
): OrderTotals | null {
  const b = offers.bundles.find((x) => x.id === bundleId);
  if (!b) return null;
  const bundle = bundleMath(b, product.price);
  const bump = withBump && offers.orderBump?.enabled ? round2(offers.orderBump.price) : 0;
  const shipping = round2(offers.shippingFee ?? 0);
  const subtotal = round2(bundle.total + bump);
  return { bundle, bump, shipping, subtotal, total: round2(subtotal + shipping) };
}

/** Sanity rules surfaced in the admin (bundle editor) — returns human warnings, empty when fine. */
export function bundleWarnings(offers: Offers, unitPrice: number): string[] {
  const w: string[] = [];
  const sorted = [...offers.bundles].sort((a, b) => a.qty - b.qty);
  let prevPerUnit = Infinity;
  for (const b of sorted) {
    const m = bundleMath(b, unitPrice);
    if (m.perUnit > prevPerUnit + 0.001)
      w.push(`Pack x${b.qty}: price per item (${m.perUnit}) is higher than a smaller pack.`);
    prevPerUnit = Math.min(prevPerUnit, m.perUnit);
    if (b.compareAt !== undefined && b.compareAt < b.price)
      w.push(`Pack x${b.qty}: "compare at" is lower than the price.`);
  }
  if (offers.bundles.filter((b) => b.badge === "popular").length > 1) w.push("More than one pack is marked “popular”.");
  if (offers.bundles.filter((b) => b.badge === "best").length > 1) w.push("More than one pack is marked “best price”.");
  if (new Set(offers.bundles.map((b) => b.qty)).size !== offers.bundles.length) w.push("Two packs have the same quantity.");
  return w;
}
