/**
 * Font manifest access, CSS font stacks, @font-face generation and preload hints.
 *
 * Data comes from fonts.generated.ts (scripts/sync-fonts.mjs). Every family gets two metric-matched
 * local fallback faces (size-adjust + ascent/descent/line-gap overrides, the fontaine/next-font
 * technique) so the swap from system font to web font causes no layout shift:
 *   "<Family> Fallback"   → Arial / Times New Roman / Courier New (+ metric-compatible clones)
 *   "<Family> Fallback R" → Roboto / Noto Serif (Android)
 * Fallback faces are limited to Latin code points so Arabic text falls through to the system
 * Arabic font instead of a size-adjusted Arial.
 */
import type { Locale } from "@/lib/page/schema";
import { FONT_DATA, FONT_IDS, type FontData, type FontFileData, type KnownFontId } from "./fonts.generated";

export { FONT_DATA, FONT_IDS };
export type { FontData, FontFileData, KnownFontId };

export const isKnownFont = (id: string): id is KnownFontId => Object.prototype.hasOwnProperty.call(FONT_DATA, id);

export function fontData(id: string): FontData | undefined {
  return isKnownFont(id) ? FONT_DATA[id] : undefined;
}

export const hasItalic = (id: string) => fontData(id)?.italic ?? false;

/** Role of a Latin accent font: monospace labels/spec numbers, or a serif whose italic carries emphasis. */
export function accentRole(id: string): "mono" | "serif" | "sans" {
  const c = fontData(id)?.category;
  if (c === "monospace") return "mono";
  if (c === "serif") return "serif";
  return "sans";
}

/** Closest weight the font actually ships (no faux bold). */
export function nearestWeight(id: string, desired: number): number {
  const f = fontData(id);
  if (!f) return desired;
  if (f.variable) return Math.round(Math.min(f.weightRange[1], Math.max(f.weightRange[0], desired)));
  let best = f.weights[0] ?? 400;
  for (const w of f.weights) if (Math.abs(w - desired) < Math.abs(best - desired)) best = w;
  return best;
}

/* ------------------------------------------------------------------ */
/* Fallback metrics                                                    */
/* ------------------------------------------------------------------ */

interface FallbackMetrics {
  names: readonly string[];
  unitsPerEm: number;
  ascent: number;
  descent: number;
  lineGap: number;
  /** same letter-frequency weighting as scripts/sync-fonts.mjs (measured on the system fonts) */
  xWidthAvg: number;
}

const FALLBACKS = {
  arial: { names: ["Arial", "ArialMT", "Liberation Sans", "Arimo", "Helvetica"], unitsPerEm: 2048, ascent: 1854, descent: -434, lineGap: 67, xWidthAvg: 909 },
  times: { names: ["Times New Roman", "TimesNewRomanPSMT", "Liberation Serif", "Tinos", "Times"], unitsPerEm: 2048, ascent: 1825, descent: -443, lineGap: 87, xWidthAvg: 821 },
  courier: { names: ["Courier New", "CourierNewPSMT", "Liberation Mono", "Cousine"], unitsPerEm: 2048, ascent: 1705, descent: -615, lineGap: 0, xWidthAvg: 1229 },
  roboto: { names: ["Roboto", "Roboto-Regular"], unitsPerEm: 2048, ascent: 1900, descent: -500, lineGap: 0, xWidthAvg: 907 },
  notoSerif: { names: ["Noto Serif", "NotoSerif", "Droid Serif"], unitsPerEm: 1000, ascent: 1069, descent: -293, lineGap: 0, xWidthAvg: 475 },
} satisfies Record<string, FallbackMetrics>;

/** Latin + Latin Extended code points (fallback faces never catch Arabic glyphs). */
const LATIN_RANGE = "U+0000-024F,U+0259,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-036F,U+1E00-1EFF,U+2000-206F,U+20A0-20C0,U+2100-215F,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD";

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

function fallbackFace(f: FontData, fb: FallbackMetrics, suffix: string): string {
  const m = f.metrics;
  const sizeAdjust = m.xWidthAvg / m.unitsPerEm / (fb.xWidthAvg / fb.unitsPerEm);
  const em = m.unitsPerEm * sizeAdjust;
  const src = fb.names.map((n) => `local("${n}")`).join(",");
  return (
    `@font-face{font-family:"${f.family} ${suffix}";src:${src};` +
    `size-adjust:${pct(sizeAdjust)};ascent-override:${pct(m.ascent / em)};descent-override:${pct(Math.abs(m.descent) / em)};` +
    `line-gap-override:${pct(Math.max(0, m.lineGap) / em)};unicode-range:${LATIN_RANGE}}`
  );
}

function genericFamily(f: FontData): string {
  if (f.category === "serif") return "serif";
  if (f.category === "monospace") return "monospace";
  return "sans-serif";
}

/** CSS font-family stack for a font id (web font → metric-matched fallbacks → generic). */
export function fontStack(id: string, extraFamilies: readonly string[] = []): string {
  const f = fontData(id);
  if (!f) {
    const parts = extraFamilies.map(familyStackPart).filter(Boolean);
    return parts.length ? `${parts.join(",")},sans-serif` : "sans-serif";
  }
  const parts = [familyStackPart(id), ...extraFamilies.map(familyStackPart)].filter(Boolean);
  return `${parts.join(",")},${genericFamily(f)}`;
}

function familyStackPart(id: string): string {
  const f = fontData(id);
  if (!f) return "";
  return `"${f.family}","${f.family} Fallback","${f.family} Fallback R"`;
}

/* ------------------------------------------------------------------ */
/* @font-face                                                          */
/* ------------------------------------------------------------------ */

/** URL prefix must be a plain relative/absolute path or https origin (it ends up inside url("…")). */
const SAFE_BASE = /^(?:https:\/\/[a-z0-9.-]+(?::\d+)?\/|\.{0,2}\/)?(?:[A-Za-z0-9._~-]+\/)*$/;

function assertBase(base: string): string {
  if (typeof base !== "string" || !SAFE_BASE.test(base)) throw new Error(`unsafe font base URL: ${JSON.stringify(base)}`);
  return base;
}

function subsetsFor(locale: Locale): readonly FontFileData["subset"][] {
  return locale === "ar" ? ["arabic", "latin", "latin-ext"] : ["latin", "latin-ext"];
}

function uniqueKnown(ids: readonly string[]): KnownFontId[] {
  const out: KnownFontId[] = [];
  for (const id of ids) if (isKnownFont(id) && !out.includes(id)) out.push(id);
  return out;
}

/**
 * @font-face rules for the given font ids: web-font faces (font-display:swap, one per subset with
 * its unicode-range, url = base + "fonts/<id>/<file>") plus the two metric-matched fallback faces.
 * Arabic subsets are only emitted for Arabic pages. Unknown ids are ignored.
 */
export function fontFaceCss(fontIds: readonly string[], locale: Locale, base: string): string {
  const prefix = assertBase(base);
  const wanted = subsetsFor(locale);
  const rules: string[] = [];
  for (const id of uniqueKnown(fontIds)) {
    const f = FONT_DATA[id];
    for (const file of f.files) {
      if (!wanted.includes(file.subset)) continue;
      rules.push(
        `@font-face{font-family:"${f.family}";font-style:${file.style};font-weight:${file.weight};font-display:swap;` +
          `src:url("${prefix}fonts/${f.id}/${file.file}") format("woff2");unicode-range:${file.unicodeRange}}`,
      );
    }
    const serif = f.category === "serif";
    rules.push(fallbackFace(f, f.category === "monospace" ? FALLBACKS.courier : serif ? FALLBACKS.times : FALLBACKS.arial, "Fallback"));
    rules.push(fallbackFace(f, serif ? FALLBACKS.notoSerif : FALLBACKS.roboto, "Fallback R"));
  }
  return rules.join("\n");
}

/** The single most important file of a font for a locale (regular upright, page script subset). */
function primaryFile(f: FontData, locale: Locale, weight?: number): FontFileData | undefined {
  const subset = locale === "ar" && f.scripts.includes("arabic") ? "arabic" : "latin";
  const candidates = f.files.filter((x) => x.subset === subset && x.style === "normal");
  if (f.variable) return candidates[0];
  const w = String(nearestWeight(f.id, weight ?? 400));
  return candidates.find((x) => x.weight === w) ?? candidates.find((x) => x.weight === "400") ?? candidates[0];
}

/**
 * <link rel="preload" as="font" type="font/woff2" crossorigin> candidates (max 2): the display font
 * and the body font in the page's script (arabic subset for "ar", latin otherwise).
 * `weights` (aligned with `fontIds`, e.g. BuiltTheme.fontWeights) picks the right static file.
 * When display and body share a family, `fontIds[1]` is the accent face (mono labels):
 * it is not preloaded, so it never competes with the hero image. Arabic pages only preload faces
 * that carry Arabic.
 */
export function fontPreloads(fontIds: readonly string[], locale: Locale, base: string, weights?: readonly number[]): { href: string; type: string }[] {
  const prefix = assertBase(base);
  const out: { href: string; type: string }[] = [];
  fontIds.slice(0, 2).forEach((id, i) => {
    const f = fontData(id);
    if (!f) return;
    if (i > 0 && f.category === "monospace") return;
    if (locale === "ar" && !f.scripts.includes("arabic")) return;
    const file = primaryFile(f, locale, weights?.[i]);
    if (!file) return;
    const href = `${prefix}fonts/${f.id}/${file.file}`;
    if (!out.some((p) => p.href === href)) out.push({ href, type: "font/woff2" });
  });
  return out;
}

/** Recommended line-heights for an Arabic family, derived from its vertical metrics. */
export function arabicLineHeights(id: string, latinDisplayLh: number): { display: number; body: number } {
  const f = fontData(id);
  const area = f ? (f.metrics.ascent - f.metrics.descent) / f.metrics.unitsPerEm : 1.4;
  const display = Math.min(1.6, Math.max(1.2, latinDisplayLh + 0.22, area * 0.78));
  const body = Math.min(1.9, Math.max(1.72, area * 0.92));
  return { display: Math.round(display * 100) / 100, body: Math.round(body * 100) / 100 };
}
