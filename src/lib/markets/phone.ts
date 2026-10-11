/**
 * Phone normalization — the server-side source of truth (libphonenumber-js "max" metadata).
 * Accepts what Moroccan shoppers actually type: "06 12 34 56 78", "+212 6…", "00212…", "212…",
 * Eastern-Arabic / Persian digits, stray dashes, dots, parentheses and bidi marks.
 */
import { getCountryCallingCode, isSupportedCountry, parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { NormalizedPhone } from "./types";

/** ٠١٢٣٤٥٦٧٨٩ (U+0660…) and ۰۱۲۳۴۵۶۷۸۹ (U+06F0…) → 0-9; also NFKC folds full-width digits. */
export function toAsciiDigits(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** separators and invisible formatting characters people paste around numbers */
const NOISE = /[\s\u00A0\u2000-\u200F\u2028-\u202F\u205F\u2060-\u2069\uFEFF\-\u2013\u2014.()/\\]/g;

/** Types accepted per country: Morocco = mobiles + landlines only (no 08 VoIP / premium). */
const STRICT_TYPES = new Set(["MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE"]);
const LENIENT_TYPES = new Set([...STRICT_TYPES, "VOIP", "PERSONAL_NUMBER"]);
const STRICT_COUNTRIES = new Set(["MA"]);

/**
 * Validate & normalize a customer phone number for `country` (ISO alpha-2).
 * Returns null when invalid, not callable, or registered in another country.
 */
export function normalizePhone(raw: string, country: string): NormalizedPhone | null {
  if (typeof raw !== "string" || raw.length > 64) return null;
  const cc = country.trim().toUpperCase();
  if (!isSupportedCountry(cc)) return null;

  let s = toAsciiDigits(raw).replace(NOISE, "");
  if (!/^\+?[0-9]{6,17}$/.test(s)) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // "+212 0612…" — some people keep the trunk zero after the country code
  const calling = getCountryCallingCode(cc);
  if (s.startsWith(`+${calling}0`)) s = `+${calling}` + s.slice(calling.length + 2);

  const p = parsePhoneNumberFromString(s, cc);
  if (!p || p.country !== cc || !p.isValid()) return null;
  const type = p.getType();
  const allowed = STRICT_COUNTRIES.has(cc) ? STRICT_TYPES : LENIENT_TYPES;
  if (!type || !allowed.has(type)) return null;

  return {
    e164: p.number,
    national: p.formatNational().replace(/[^0-9]/g, ""),
    country: cc,
    type: type as NormalizedPhone["type"],
  };
}

/** National digits for an E.164 number (e.g. "+212612345678" → "0612345678"); input unchanged if unparsable. */
export function phoneToNational(e164: string): string {
  const p = parsePhoneNumberFromString(e164);
  return p ? p.formatNational().replace(/[^0-9]/g, "") : e164;
}

/** Calling code for a supported country ("MA" → "+212"), or "" when unknown. */
export function callingPrefix(country: string): string {
  const cc = country.trim().toUpperCase();
  return isSupportedCountry(cc) ? `+${getCountryCallingCode(cc)}` : "";
}
