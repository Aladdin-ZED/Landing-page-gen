/** Small display helpers of the export dialog. */
import type { ExportVersionJson } from "@/lib/export/types";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dtf = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "3 min ago", "yesterday", then "7 Oct, 17:30". */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.round((t - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(s / 86_400), "day");
  return dtf.format(t);
}

export function absoluteTime(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? dtf.format(t) : "";
}

const KIND: Record<ExportVersionJson["kind"], string> = {
  publish: "Published",
  save: "Saved",
  restore: "Restored",
  import: "Imported",
  generation: "Generated",
  autosave: "Autosave",
};

export function versionTitle(v: ExportVersionJson): string {
  return v.label?.trim() || KIND[v.kind];
}

/** "+212 612 345 678" from wa.me digits (display only). */
export function displayPhone(digits: string | null): string {
  if (!digits) return "";
  const cc = digits.startsWith("212") ? 3 : digits.length > 11 ? 3 : 2;
  const rest = digits.slice(cc).replace(/(\d{3})(?=\d)/g, "$1 ");
  return `+${digits.slice(0, cc)} ${rest}`.trim();
}
