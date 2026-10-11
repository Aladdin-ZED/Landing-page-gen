/**
 * Market specs. Morocco is the primary market (curated cities, MAD); EU markets use free-text cities.
 * Phone `national` patterns are lenient browser-side prefilters; libphonenumber-js "max" is the server truth.
 */
import type { Market } from "@/lib/page/schema";
import { MA_CITIES } from "./cities-ma";
import type { MarketSpec, PhoneSpec } from "./types";

export const PHONE_SPECS: Record<string, PhoneSpec> = {
  // mobiles 06/07, landlines 05 (08 VoIP is rejected server-side)
  MA: { country: "MA", prefix: "+212", national: "^0[5-7][0-9]{8}$", placeholder: "06 12 34 56 78" },
  FR: { country: "FR", prefix: "+33", national: "^0[1-9][0-9]{8}$", placeholder: "06 12 34 56 78" },
  BE: { country: "BE", prefix: "+32", national: "^0[1-9][0-9]{7,8}$", placeholder: "0470 12 34 56" },
  ES: { country: "ES", prefix: "+34", national: "^[6-9][0-9]{8}$", placeholder: "612 34 56 78" },
  DE: { country: "DE", prefix: "+49", national: "^0[1-9][0-9]{5,13}$", placeholder: "0151 23456789" },
  IT: { country: "IT", prefix: "+39", national: "^(?:3[0-9]{8,9}|0[0-9]{5,10})$", placeholder: "312 345 6789" },
  NL: { country: "NL", prefix: "+31", national: "^0[1-9][0-9]{8}$", placeholder: "06 12345678" },
  PT: { country: "PT", prefix: "+351", national: "^[29][0-9]{8}$", placeholder: "912 345 678" },
};

/** Fallback for countries without a curated spec (digits only, 6–15). */
export const GENERIC_PHONE: PhoneSpec = { country: "", prefix: "", national: "^[0-9]{6,15}$", placeholder: "" };

const EU_LOCALES = ["fr", "en", "es", "de", "it", "nl", "pt"] as const;

export const MARKET_SPECS: Record<Market, MarketSpec> = {
  MA: {
    code: "MA",
    name: { en: "Morocco", fr: "Maroc", ar: "المغرب" },
    currency: "MAD",
    defaultLocale: "ar",
    locales: ["ar", "fr", "en"],
    timeZone: "Africa/Casablanca",
    phone: PHONE_SPECS.MA!,
    cities: MA_CITIES,
  },
  FR: {
    code: "FR",
    name: { en: "France", fr: "France", ar: "فرنسا" },
    currency: "EUR",
    defaultLocale: "fr",
    locales: ["fr", "ar", "en"],
    timeZone: "Europe/Paris",
    phone: PHONE_SPECS.FR!,
    cities: null,
  },
  BE: {
    code: "BE",
    name: { en: "Belgium", fr: "Belgique", ar: "بلجيكا" },
    currency: "EUR",
    defaultLocale: "fr",
    locales: ["fr", "nl", "de", "en", "ar"],
    timeZone: "Europe/Brussels",
    phone: PHONE_SPECS.BE!,
    cities: null,
  },
  ES: {
    code: "ES",
    name: { en: "Spain", fr: "Espagne", ar: "إسبانيا" },
    currency: "EUR",
    defaultLocale: "es",
    locales: ["es", "en", "fr", "ar"],
    timeZone: "Europe/Madrid",
    phone: PHONE_SPECS.ES!,
    cities: null,
  },
  DE: {
    code: "DE",
    name: { en: "Germany", fr: "Allemagne", ar: "ألمانيا" },
    currency: "EUR",
    defaultLocale: "de",
    locales: ["de", "en", "fr", "ar"],
    timeZone: "Europe/Berlin",
    phone: PHONE_SPECS.DE!,
    cities: null,
  },
  IT: {
    code: "IT",
    name: { en: "Italy", fr: "Italie", ar: "إيطاليا" },
    currency: "EUR",
    defaultLocale: "it",
    locales: ["it", "en", "fr", "ar"],
    timeZone: "Europe/Rome",
    phone: PHONE_SPECS.IT!,
    cities: null,
  },
  NL: {
    code: "NL",
    name: { en: "Netherlands", fr: "Pays-Bas", ar: "هولندا" },
    currency: "EUR",
    defaultLocale: "nl",
    locales: ["nl", "en", "fr", "ar"],
    timeZone: "Europe/Amsterdam",
    phone: PHONE_SPECS.NL!,
    cities: null,
  },
  PT: {
    code: "PT",
    name: { en: "Portugal", fr: "Portugal", ar: "البرتغال" },
    currency: "EUR",
    defaultLocale: "pt",
    locales: ["pt", "en", "fr", "ar"],
    timeZone: "Europe/Lisbon",
    phone: PHONE_SPECS.PT!,
    cities: null,
  },
  INTL: {
    code: "INTL",
    name: { en: "International", fr: "International", ar: "دولي" },
    currency: "EUR",
    defaultLocale: "en",
    locales: [...EU_LOCALES, "ar"],
    timeZone: "UTC",
    phone: GENERIC_PHONE,
    cities: null,
  },
};
