/**
 * Pure digit helpers: Eastern-Arabic / Persian digit conversion and "format like the server did"
 * number rendering (used by count roll-ups and countdown digits so animated values keep the exact
 * numbering system and separators of the server-rendered text).
 */

const EASTERN = /[٠-٩۰-۹]/;

/** First run of digits (with inner group/decimal separators) inside a text. */
export const NUM_RUN =
  /[0-9٠-٩۰-۹](?:[0-9٠-٩۰-۹\s.,'٫٬]*[0-9٠-٩۰-۹])?/;

/** ٠-٩ (Arabic-Indic) and ۰-۹ (Persian) → 0-9. */
export function toAsciiDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code - (code >= 0x6f0 ? 0x6f0 : 0x660));
  });
}

/** Char code of "0" in the numbering system used by a sample text (48 = Latin). */
export function digitZero(sample: string): number {
  const m = EASTERN.exec(sample);
  if (!m) return 48;
  return m[0].charCodeAt(0) >= 0x6f0 ? 0x6f0 : 0x660;
}

/** Latin digits → the numbering system starting at `zero`. */
export function mapDigits(s: string, zero: number): string {
  return zero === 48 ? s : s.replace(/[0-9]/g, (d) => String.fromCharCode(zero + Number(d)));
}

export interface NumStyle {
  zero: number;
  /** grouping separator ("" = no grouping) */
  group: string;
  dec: string;
}

/** Infer digits/grouping/decimal separator from a rendered number such as "12 000", "4,8", "١٢٬٠٠٠". */
export function numStyle(run: string, decimals: number): NumStyle {
  const ascii = toAsciiDigits(run);
  let intPart = ascii;
  let dec = ".";
  if (decimals > 0 && ascii.length > decimals + 1) {
    const sep = ascii.charAt(ascii.length - decimals - 1);
    if (!/[0-9]/.test(sep)) {
      dec = sep;
      intPart = ascii.slice(0, ascii.length - decimals - 1);
    }
  }
  const g = /[^0-9]/.exec(intPart);
  return { zero: digitZero(run), group: g ? g[0] : "", dec };
}

export function formatNum(n: number, decimals: number, st: NumStyle): string {
  const parts = Math.abs(n).toFixed(decimals).split(".");
  const int = st.group ? parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, st.group) : parts[0]!;
  const frac = parts[1] ? st.dec + parts[1] : "";
  return mapDigits((n < 0 ? "-" : "") + int + frac, st.zero);
}

export const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
