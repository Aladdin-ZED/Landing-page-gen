/**
 * Page caps (docs/OFFERS.md §F.9, §J.1) — blocking render issues: publish refuses a page that breaks
 * one (`page_too_large`), the builder checklist shows the same as errors.
 *
 *   HTML        ≤ 400 KB, measured gzip-compressed (what a visitor downloads; today's pages are
 *               150–170 KB gzip for 550–950 KB of HTML, most of it inline CSS)
 *   #lp-config  ≤ 24 KB (the runtime configuration JSON)
 *   photos      ≤ 48 option / value / cell photos (each becomes a <picture> template)
 *
 * Node-only (zlib): render/core.ts reports the issues on RenderedHtml.blocking.
 */
import { gzipSync } from "node:zlib";
import { optionPhotoCount, type PageDoc } from "@/lib/page/schema";

export const PAGE_CAPS = {
  /** gzip bytes of the landing HTML */
  htmlGzipBytes: 400 * 1024,
  /** bytes of the serialized #lp-config JSON */
  configBytes: 24 * 1024,
  optionPhotos: 48,
} as const;

export interface BlockingIssue {
  code: "page_too_large";
  measure: "html" | "config" | "photos";
  value: number;
  limit: number;
  /** admin English */
  message: string;
}

const CONFIG = /<script type="application\/json" id="lp-config">([\s\S]*?)<\/script>/;
const kb = (n: number) => `${Math.round(n / 1024)} KB`;

/** The embedded runtime configuration: its size and contract version (null when the page has none). */
export function runtimeConfigOf(html: string): { bytes: number; v: number | null } | null {
  const m = CONFIG.exec(html);
  if (!m) return null;
  let v: number | null = null;
  try {
    const parsed = JSON.parse(m[1]!) as { v?: unknown };
    v = typeof parsed.v === "number" ? parsed.v : null;
  } catch {
    v = null;
  }
  return { bytes: Buffer.byteLength(m[1]!, "utf8"), v };
}

/** The page caps a rendered landing page breaks (empty: publishable). */
export function pageCapIssues(doc: Pick<PageDoc, "items" | "offers">, html: string): BlockingIssue[] {
  const out: BlockingIssue[] = [];
  const gz = gzipSync(html).length;
  if (gz > PAGE_CAPS.htmlGzipBytes)
    out.push({ code: "page_too_large", measure: "html", value: gz, limit: PAGE_CAPS.htmlGzipBytes, message: `The page weighs ${kb(gz)} compressed (at most ${kb(PAGE_CAPS.htmlGzipBytes)}): remove sections or option photos.` });
  const cfg = runtimeConfigOf(html);
  if (cfg && cfg.bytes > PAGE_CAPS.configBytes)
    out.push({ code: "page_too_large", measure: "config", value: cfg.bytes, limit: PAGE_CAPS.configBytes, message: `The order form data is ${kb(cfg.bytes)} (at most ${kb(PAGE_CAPS.configBytes)}): fewer options, offers or combinations.` });
  const photos = optionPhotoCount(doc);
  if (photos > PAGE_CAPS.optionPhotos)
    out.push({ code: "page_too_large", measure: "photos", value: photos, limit: PAGE_CAPS.optionPhotos, message: `${photos} option photos (at most ${PAGE_CAPS.optionPhotos}): remove some option photos.` });
  return out;
}
