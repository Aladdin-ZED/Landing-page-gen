/**
 * Money formatting and order totals (pure). This formatMoney() is THE price rule of a landing page:
 * the renderer's ctx.money calls it with the same MoneyFormat it embeds in the runtime config
 * (src/lib/render/config.ts moneyFormat()), so server-rendered and runtime-updated prices are
 * byte-identical (Latin digits, U+00A0 between amount and symbol, cents only when there are some).
 * Totals mirror src/lib/page/pricing.ts orderTotals() (verified by selftest.ts).
 */
import { round2 } from "../../lib/page/pricing";
import type { LandingRuntimeConfig } from "./config";

export type MoneyFormat = LandingRuntimeConfig["money"];

const formatters: Record<string, Intl.NumberFormat> = {};

function nf(locale: string, d: number): Intl.NumberFormat {
  const key = locale + "|" + d;
  let f = formatters[key];
  if (!f) {
    const o: Intl.NumberFormatOptions = { minimumFractionDigits: d, maximumFractionDigits: d };
    // Deterministic digits across ICU versions: Latin unless the locale explicitly asks (…-u-nu-arab).
    if (locale.indexOf("-nu-") < 0) (o as Intl.NumberFormatOptions & { numberingSystem?: string }).numberingSystem = "latn";
    try {
      f = new Intl.NumberFormat(locale, o);
    } catch {
      f = new Intl.NumberFormat("en", o);
    }
    formatters[key] = f;
  }
  return f;
}

const NBSP = String.fromCharCode(0xa0);
const SPACE_END = /\s$/;
const SPACE_START = /^\s/;

/**
 * "249 درهم" / "1 249 DH" / "24,90 €" / "$10.00" / "€ 24,90" — always a no-break space between
 * amount and symbol, except a single-character symbol placed before the amount ("$10").
 * A symbol that already carries its separator ("€" + U+00A0 for nl-NL) is used as is.
 * `decimals` is the minimum number of fraction digits; a whole-unit format (0) still shows cents
 * when the amount has some — never misstate a price.
 */
export function formatMoney(amount: number, m: MoneyFormat): string {
  const v = round2(isFinite(amount) ? amount : 0);
  let d = Math.max(0, Math.min(3, Math.floor(m.decimals) || 0));
  if (d === 0 && Math.round(v * 100) % 100 !== 0) d = 2;
  const n = nf(m.locale || "en", d).format(v);
  const s = m.symbol || "";
  if (!s) return n;
  if (m.position === "before") return s + (s.length > 1 && !SPACE_END.test(s) ? NBSP : "") + n;
  return n + (SPACE_START.test(s) ? "" : NBSP) + s;
}

export interface Totals {
  qty: number;
  label: string;
  bundle: number;
  bump: number;
  shipping: number;
  subtotal: number;
  total: number;
}

/** Same math as pricing.orderTotals(), from the runtime config (config.bump is present only when enabled). */
export function computeTotals(
  cfg: Pick<LandingRuntimeConfig, "bundles" | "bump" | "shippingFee">,
  bundleId: string,
  withBump: boolean,
): Totals | null {
  const b = cfg.bundles.find((x) => x.id === bundleId);
  if (!b) return null;
  const bundle = round2(b.total);
  const bump = withBump && cfg.bump ? round2(cfg.bump.price) : 0;
  const shipping = round2(cfg.shippingFee || 0);
  const subtotal = round2(bundle + bump);
  return { qty: b.qty, label: b.label, bundle, bump, shipping, subtotal, total: round2(subtotal + shipping) };
}
