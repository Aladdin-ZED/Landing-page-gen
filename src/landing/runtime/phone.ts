/**
 * Phone normalization (pure). Accepts what real shoppers type: Eastern-Arabic / Persian digits,
 * spaces, dashes, dots, parentheses, bidi marks, international prefixes (+212 / 00212 / 212…),
 * a missing or doubled trunk "0" — and returns the national form validated by the market regex
 * plus the E.164 form. The server re-validates; this only gives instant feedback and clean payloads.
 *
 * Morocco (prefix "+212", national "^0[5-7][0-9]{8}$"):
 *   "06 12 34 56 78" · "٠٦١٢٣٤٥٦٧٨" · "+212 6 12 34 56 78" · "00212612345678" · "212612345678"
 *   · "+212 0612345678" · "612345678"  →  { national: "0612345678", e164: "+212612345678" }
 * Other countries work the same way from their prefix + national regex (e.g. FR "^0[1-9][0-9]{8}$",
 * ES "^[6-9][0-9]{8}$" with no trunk zero).
 */
import { toAsciiDigits } from "./numbers";

export interface PhoneRule {
  /** "+212" */
  prefix: string;
  /** RegExp source validating the normalized national number (digits only, trunk 0 kept) */
  national: string;
}

export interface NormalizedPhone {
  national: string;
  e164: string;
}

/** Characters people put inside phone numbers: spaces (incl. NBSP), dashes, bidi / Arabic letter marks, zero-width chars. */
const NOISE = /[\s\-.()/_\u061c\u200b-\u200f\u2010-\u2015\u2212\u202a-\u202e\u2060\u2066-\u2069]/g;

/** Countries whose trunk "0" stays in the international form. */
const KEEP_TRUNK = ["39"];

const cache: Record<string, RegExp | null> = {};
function nationalRe(src: string): RegExp | null {
  if (!(src in cache)) {
    try {
      cache[src] = new RegExp("^(?:" + src + ")$");
    } catch {
      cache[src] = null;
    }
  }
  return cache[src]!;
}

/** Strip formatting and convert digits; returns "+digits" / "digits" or "" when not phone-like. */
export function cleanPhone(raw: string): string {
  const s = toAsciiDigits(String(raw || ""))
    .replace(/＋/g, "+")
    .replace(NOISE, "");
  return /^\+?[0-9]{6,20}$/.test(s) ? s : "";
}

export function normalizePhone(raw: string, rule: PhoneRule): NormalizedPhone | null {
  const s = cleanPhone(raw);
  const re = nationalRe(rule.national);
  const cc = String(rule.prefix || "").replace(/[^0-9]/g, "");
  if (!s || !re || !cc) return null;

  const d = s.charAt(0) === "+" ? "00" + s.slice(1) : s;
  const candidates: string[] = [];
  let rest: string | null = null;
  if (d.indexOf("00" + cc) === 0) rest = d.slice(2 + cc.length);
  else if (d.indexOf("00") === 0) return null; // another country's international number
  else {
    candidates.push(d, "0" + d);
    if (d.indexOf(cc) === 0) rest = d.slice(cc.length);
  }
  if (rest !== null) {
    const r = rest.replace(/^0/, "");
    candidates.push("0" + r, r);
  }

  for (const national of candidates) {
    if (!re.test(national)) continue;
    const significant = national.charAt(0) === "0" && KEEP_TRUNK.indexOf(cc) < 0 ? national.slice(1) : national;
    const e164 = "+" + cc + significant;
    if (/^\+[1-9][0-9]{7,14}$/.test(e164)) return { national, e164 };
  }
  return null;
}
