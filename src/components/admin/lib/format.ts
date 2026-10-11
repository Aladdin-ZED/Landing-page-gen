/**
 * Display formatting for the admin (isomorphic, Intl only). Money uses the same formatter as the
 * landing pages so "249 DH" reads identically everywhere.
 */
import { formatMoney } from "@/lib/markets/money";

const ADMIN_LOCALE = "en";

export function money(amount: number, currency: string): string {
  return formatMoney(amount, currency, currency === "MAD" ? "fr" : ADMIN_LOCALE);
}

const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function compact(n: number): string {
  return Math.abs(n) >= 10_000 ? compactFmt.format(n) : intFmt.format(n);
}

export function int(n: number): string {
  return intFmt.format(n);
}

export function percent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  const v = ratio * 100;
  return `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(digits)}%`;
}

/** Relative change between two values: +12%, −3%, or null when there is no baseline. */
export function delta(value: number, previous: number | null): { ratio: number; label: string } | null {
  if (previous === null || previous === 0) return null;
  const ratio = (value - previous) / previous;
  const pct = Math.round(Math.abs(ratio) * 100);
  return { ratio, label: `${ratio >= 0 ? "+" : "−"}${pct}%` };
}

export function bytes(n: number | null | undefined): string {
  if (!n || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export const shortDate = (iso: string) => dateFmt.format(new Date(iso));
export const dateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const fullDate = (iso: string) => fullFmt.format(new Date(iso));
/** "YYYY-MM-DD" (a calendar day, not an instant) → "7 Oct" */
export const dayLabel = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

/** "just now", "5 min. ago", "yesterday", "3 days ago"… then a date. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(diff / 86_400), "day");
  return shortDate(iso);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

/** E.164 → spaced national form for Morocco ("+212612345678" → "06 12 34 56 78"), else spaced E.164. */
export function phone(e164: string): string {
  const ma = /^\+212([5-7]\d{8})$/.exec(e164);
  if (ma) return `0${ma[1]}`.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return e164.replace(/^(\+\d{1,3})(\d+)$/, (_, cc: string, rest: string) => `${cc} ${rest.replace(/(\d{3})(?=\d)/g, "$1 ")}`);
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${int(n)} ${n === 1 ? one : many}`;
}
