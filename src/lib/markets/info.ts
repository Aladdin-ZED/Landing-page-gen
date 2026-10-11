/**
 * Market facts for rendering — specs, phone conventions, localized city lists, money/number
 * formatting. Isomorphic and LIGHT: it never imports ./phone (libphonenumber-js "max" metadata,
 * ~145 KB), so the admin preview and the renderer can use it without pulling the phone library
 * into a browser bundle. Server code that validates phones imports ./phone.
 *
 * Money: formatMoney() here is THE price rule of the product (landing pages, thank-you pages, admin,
 * sheets). It is the landing runtime's own formatter fed with moneyFormat(), the format the renderer
 * embeds in every page's runtime config — so a price written on the server and the same price
 * updated in the browser are byte-identical: Latin digits, U+00A0 between amount and symbol, whole
 * amounts without decimals and cents only when an amount has some.
 */
import { formatMoney as formatWithFormat, type MoneyFormat } from "@/landing/runtime/money";
import { MARKETS, type Locale, type Market } from "@/lib/page/schema";
import type { MarketInfo } from "@/landing/types";
import { moneySpec } from "./money";
import { MARKET_SPECS, GENERIC_PHONE, PHONE_SPECS } from "./specs";
import type { City, MarketSpec, PhoneSpec } from "./types";

export { formatNumber, moneySpec, numberLocale } from "./money";
export type { MoneyFormat } from "@/landing/runtime/money";

const NBSP = String.fromCharCode(0xa0);
const symbolGap = new Map<string, boolean>();

/** Does Intl separate a leading currency symbol from the amount in this locale ("€ 24,90" in nl-NL)? */
function leadingSymbolSpaced(currency: string, locale: string): boolean {
  const key = `${currency}|${locale}`;
  let spaced = symbolGap.get(key);
  if (spaced === undefined) {
    spaced = false;
    try {
      const parts = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(1);
      const at = parts.findIndex((p) => p.type === "currency");
      spaced = at >= 0 && parts[at + 1]?.type === "literal" && /\s/.test(parts[at + 1]!.value);
    } catch {
      // unknown ISO code: the generic layout applies
    }
    symbolGap.set(key, spaced);
  }
  return spaced;
}

/**
 * Money format of a page (currency + page locale) — embedded in the landing runtime config and used
 * by every server-side price. `decimals` is the runtime's MINIMUM digit count: 0 for 2-digit
 * currencies (whole amounts plain, cents shown when present), the currency's own digits otherwise
 * (TND "12,500", JPY "1 235").
 */
export function moneyFormat(currency: string, locale: string): MoneyFormat {
  const cur = currency.toUpperCase();
  const spec = moneySpec(cur, locale);
  // a leading one-character symbol keeps Intl's gap, as a no-break space ("€ 24,90" never wraps)
  const symbol = spec.position === "before" && spec.symbol.length === 1 && leadingSymbolSpaced(cur, spec.locale) ? spec.symbol + NBSP : spec.symbol;
  return { locale: spec.locale, symbol, position: spec.position, decimals: spec.decimals === 2 ? 0 : spec.decimals };
}

/** "1 299 درهم" (ar) · "1 299 DH" (fr) · "1,299 MAD" (en) · "29,90 €" (fr, EUR) · "€ 24,90" (nl, EUR). */
export function formatMoney(amount: number, currency: string, locale: string): string {
  return formatWithFormat(amount, moneyFormat(currency, locale));
}

const isMarket = (code: string): code is Market => (MARKETS as readonly string[]).includes(code);

/** Spec for a market code; unknown codes fall back to INTL. */
export function getMarket(code: string): MarketSpec {
  const c = code.trim().toUpperCase();
  return MARKET_SPECS[isMarket(c) ? c : "INTL"];
}

/** Phone conventions for an ISO country (curated spec, or a generic digits-only pattern). */
export function phoneSpec(country: string): PhoneSpec {
  const cc = country.trim().toUpperCase();
  return PHONE_SPECS[cc] ?? { ...GENERIC_PHONE, country: cc };
}

/** City label in a page locale (Arabic for ar, English exonym for en, French/Latin otherwise). */
export function cityLabel(city: City, locale: string): string {
  if (locale === "ar") return city.ar;
  if (locale === "en") return city.en ?? city.fr;
  return city.fr;
}

const optionsCache = new Map<string, { value: string; label: string }[]>();

/** Localized <select> options: major cities first (fixed order), other towns sorted, "other city" last. */
export function cityOptions(code: string, locale: string): { value: string; label: string }[] {
  const spec = getMarket(code);
  if (!spec.cities) return [];
  const key = `${spec.code}:${locale}`;
  const hit = optionsCache.get(key);
  if (hit) return hit;
  const collator = new Intl.Collator(locale === "ar" ? "ar" : "fr", { sensitivity: "base" });
  const major = spec.cities.filter((c) => c.major);
  const other = spec.cities.filter((c) => !c.major && c.value !== "Autre");
  const last = spec.cities.filter((c) => c.value === "Autre");
  other.sort((a, b) => collator.compare(cityLabel(a, locale), cityLabel(b, locale)));
  const out = [...major, ...other, ...last].map((c) => ({ value: c.value, label: cityLabel(c, locale) }));
  optionsCache.set(key, out);
  return out;
}

/** The MarketInfo the renderer puts in RenderContext (cities localized for the page locale). */
export function marketInfoForLocale(code: Market, locale: Locale | string, phoneCountry?: string): MarketInfo {
  const spec = getMarket(code);
  const phone = phoneCountry ? phoneSpec(phoneCountry) : spec.phone;
  return {
    code: spec.code,
    phoneCountry: phone.country || spec.phone.country || (phoneCountry ?? "").toUpperCase(),
    phonePrefix: phone.prefix,
    phonePlaceholder: phone.placeholder,
    cities: cityOptions(spec.code, locale),
  };
}

/** Market name in a page locale (Arabic for ar, French for fr, English otherwise). */
export function marketName(code: string, locale: string): string {
  const spec = getMarket(code);
  if (locale === "ar") return spec.name.ar;
  if (locale === "fr") return spec.name.fr;
  return spec.name.en;
}

/** Accent/case-insensitive key: "Fès" ≡ "fes" ≡ "FES ", "M'diq" ≡ "Mdiq". */
const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "") // Latin diacritics + Arabic harakat
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[\s'’`\-_.]+/g, "");

const indexCache = new Map<string, Map<string, City>>();

/** Resolve customer input (value, French, Arabic or English name) to a market city; null if unknown. */
export function findCity(code: string, input: string): City | null {
  const spec = getMarket(code);
  if (!spec.cities || !input) return null;
  let idx = indexCache.get(spec.code);
  if (!idx) {
    idx = new Map();
    for (const c of spec.cities) for (const n of [c.value, c.fr, c.ar, c.en]) if (n) idx.set(fold(n), c);
    indexCache.set(spec.code, idx);
  }
  return idx.get(fold(input)) ?? null;
}
