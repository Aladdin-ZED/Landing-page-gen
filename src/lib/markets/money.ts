/**
 * Money & number formatting shared by the renderer, admin and server (isomorphic, Intl only).
 * Always Western (latn) digits — Moroccan shoppers read prices as "249 درهم" / "249 DH".
 */
import type { MoneySpec } from "./types";

/** Local display names for the Moroccan dirham, placed after the amount. */
const MAD_SYMBOLS: Record<string, string> = { ar: "درهم", fr: "DH", en: "MAD" };

const INTL_LOCALE: Record<string, string> = {
  ar: "fr-FR", // Western digits, thin-space grouping, decimal comma (how prices are written in Morocco)
  fr: "fr-FR",
  en: "en-IE",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  pt: "pt-PT",
};

const lang = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] ?? "en";

/** BCP 47 locale used for the number part in a page locale. */
export function numberLocale(locale: string, currency?: string): string {
  const l = lang(locale);
  if (currency === "MAD" && l === "en") return "en-US";
  return INTL_LOCALE[l] ?? "en-US";
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(locale: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { numberingSystem: "latn", ...opts });
    fmtCache.set(key, f);
  }
  return f;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const fractionDigits = (v: number, max: number) => (Number.isInteger(v) ? 0 : max);

/** How the browser runtime should format money (symbol, position, number locale). */
export function moneySpec(currency: string, locale: string): MoneySpec {
  const cur = currency.toUpperCase();
  if (cur === "MAD") {
    return { locale: numberLocale(locale, cur), symbol: MAD_SYMBOLS[lang(locale)] ?? "MAD", position: "after", decimals: 2 };
  }
  const loc = numberLocale(locale, cur);
  let symbol = cur;
  let position: MoneySpec["position"] = "after";
  let decimals = 2;
  try {
    const f = nf(loc, { style: "currency", currency: cur, currencyDisplay: "narrowSymbol" });
    const parts = f.formatToParts(1234.5);
    const ci = parts.findIndex((p) => p.type === "currency");
    const ii = parts.findIndex((p) => p.type === "integer");
    symbol = parts[ci]?.value ?? cur;
    position = ci >= 0 && ci < ii ? "before" : "after";
    decimals = f.resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // unknown ISO code → "123 XYZ"
  }
  return { locale: loc, symbol, position, decimals };
}

/** "1 299 درهم" (ar) · "1 299 DH" (fr) · "1,299 MAD" (en) · "29,90 €" (fr, EUR). */
export function formatMoney(amount: number, currency: string, locale: string): string {
  const v = round2(Number.isFinite(amount) ? amount : 0);
  const cur = currency.toUpperCase();
  const spec = moneySpec(cur, locale);
  const digits = fractionDigits(v, spec.decimals);
  if (cur !== "MAD") {
    try {
      return nf(spec.locale, {
        style: "currency",
        currency: cur,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v);
    } catch {
      // fall through to the generic layout
    }
  }
  const num = nf(spec.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
  return spec.position === "before" ? `${spec.symbol}${num}` : `${num}\u00A0${spec.symbol}`;
}

/** Plain number with locale grouping and Western digits (e.g. counters, quantities). */
export function formatNumber(n: number, locale: string, maxDecimals = 2): string {
  const v = Number.isFinite(n) ? n : 0;
  return nf(numberLocale(locale), { maximumFractionDigits: maxDecimals }).format(v);
}
