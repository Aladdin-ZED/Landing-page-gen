/**
 * Market specs — currency, phone and city conventions per selling country.
 * Pure data types (isomorphic: server, admin preview, workers).
 */
import type { Locale, Market } from "@/lib/page/schema";

export interface City {
  /** canonical value stored on orders and sent to the sheet (Latin/French spelling) */
  value: string;
  fr: string;
  ar: string;
  /** English exonym when it differs from the French name (Fez, Tangier…) */
  en?: string;
  /** true for the ~30 largest cities, listed first in selects */
  major?: boolean;
}

export interface PhoneSpec {
  /** ISO 3166 alpha-2, e.g. "MA" */
  country: string;
  /** international calling prefix, e.g. "+212" ("" when unknown) */
  prefix: string;
  /**
   * RegExp source validating a NORMALIZED national number (digits only, trunk "0" kept when the
   * country uses one). Lenient superset for the browser runtime — the server validates with
   * libphonenumber-js "max" metadata (normalizePhone).
   */
  national: string;
  /** shown as the input placeholder */
  placeholder: string;
}

export interface MarketSpec {
  code: Market;
  name: { en: string; fr: string; ar: string };
  currency: string;
  defaultLocale: Locale;
  locales: readonly Locale[];
  /** IANA time zone used for "days" in stats and sheet dates */
  timeZone: string;
  phone: PhoneSpec;
  /** curated delivery cities, or null when the city is free text */
  cities: readonly City[] | null;
}

export interface MoneySpec {
  /** BCP 47 locale used with Intl.NumberFormat for the number part (always Western digits) */
  locale: string;
  symbol: string;
  position: "before" | "after";
  /** maximum fraction digits; whole amounts are shown without decimals */
  decimals: number;
}

export interface NormalizedPhone {
  /** E.164, e.g. "+212612345678" */
  e164: string;
  /** national digits incl. trunk prefix, e.g. "0612345678" (what call centers dial) */
  national: string;
  country: string;
  type: "MOBILE" | "FIXED_LINE" | "FIXED_LINE_OR_MOBILE" | "VOIP" | "PERSONAL_NUMBER" | "OTHER";
}
