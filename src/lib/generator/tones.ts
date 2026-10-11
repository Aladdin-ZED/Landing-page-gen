/**
 * Section background tones — what the six `data-bg` blocks of a theme actually look like, so the page
 * rhythm is planned on real colors instead of token names:
 *
 *   - on a dark page `dark` is just a deeper neutral, and `soft`/`surface` can be the same color;
 *   - a pale `pop` (peach on blush) is a tint, not a color moment;
 *   - a golden `pop` beside a butter `soft` reads as one muddy block, not as a change.
 *
 * Distances are Euclidean in OKLab (0 = identical, ~0.03 = barely visible on a large field,
 * ≥ 0.12 = a clear color change). Pure; one build per ThemeSpec object (cached).
 */
import type { Locale, SectionBg, ThemeSpec } from "@/lib/page/schema";
import { SECTION_BGS } from "@/lib/page/schema";
import { buildTheme, parseColor, toOklch } from "@/lib/theme";

/** Below this, two section backgrounds read as the same field (no rhythm, no edge worth drawing). */
export const SAME_FIELD = 0.03;
/** A strong block (accent / dark / pop) must stand this far from the page ground to count as a color moment. */
export const STRONG_MIN = 0.12;
/** Two blocks of which one is strong must differ at least this much, or they read as one muddy band. */
export const STRONG_APART = 0.11;

const STRONG_NAMES: ReadonlySet<SectionBg> = new Set(["accent", "dark", "pop"]);

export interface Tones {
  /** OKLab distance between two section backgrounds */
  dist(a: SectionBg, b: SectionBg): number;
  /** a real color moment on this page (accent/dark/pop that stands out from the page ground) */
  strong(bg: SectionBg): boolean;
  /** two neighbors that read as a deliberate change (stricter when a color block is involved) */
  distinct(a: SectionBg, b: SectionBg): boolean;
}

type Lab = readonly [number, number, number];

function lab(hex: string): Lab | null {
  const h = parseColor(hex);
  if (!h) return null;
  const c = toOklch(h);
  const rad = (c.h * Math.PI) / 180;
  return [c.l, c.c * Math.cos(rad), c.c * Math.sin(rad)];
}

/** Tones from a map of section background colors (hex); null when a color is missing or unreadable. */
export function tonesFromColors(colors: Partial<Record<SectionBg, string>>): Tones | null {
  const labs = new Map<SectionBg, Lab>();
  for (const bg of SECTION_BGS) {
    const l = lab(colors[bg] ?? "");
    if (!l) return null;
    labs.set(bg, l);
  }
  const dist = (a: SectionBg, b: SectionBg) => {
    if (a === b) return 0;
    const x = labs.get(a)!;
    const y = labs.get(b)!;
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };
  const strong = (bg: SectionBg) => STRONG_NAMES.has(bg) && dist(bg, "base") >= STRONG_MIN;
  return {
    dist,
    strong,
    distinct: (a, b) => a !== b && dist(a, b) >= (strong(a) || strong(b) ? STRONG_APART : SAME_FIELD),
  };
}

const built = new WeakMap<ThemeSpec, Map<Locale, Record<string, string> | null>>();

/**
 * The CSS tokens of a theme, built once per ThemeSpec object and locale (a build is ≈ 3 ms; the
 * generator reads the same theme for its rhythm and its color checks). null when the engine throws.
 */
export function themeTokens(theme: ThemeSpec, locale: Locale): Record<string, string> | null {
  let byLocale = built.get(theme);
  if (!byLocale) built.set(theme, (byLocale = new Map()));
  if (byLocale.has(locale)) return byLocale.get(locale) ?? null;
  let tokens: Record<string, string> | null = null;
  try {
    tokens = buildTheme(theme, locale).tokens;
  } catch {
    tokens = null;
  }
  byLocale.set(locale, tokens);
  return tokens;
}

const cache = new WeakMap<ThemeSpec, Tones | null>();

/** Tones of a theme (null if the theme engine cannot build it — callers fall back to token names). */
export function themeTones(theme: ThemeSpec, locale: Locale): Tones | null {
  if (cache.has(theme)) return cache.get(theme) ?? null;
  const tokens = themeTokens(theme, locale);
  let tones: Tones | null = null;
  if (tokens) {
    const colors: Partial<Record<SectionBg, string>> = {};
    for (const bg of SECTION_BGS) {
      const v = tokens[`${bg}:sec-bg`];
      if (v) colors[bg] = v;
    }
    tones = tonesFromColors(colors);
  }
  cache.set(theme, tones);
  return tones;
}

/** Name-only fallback: accent/dark/pop are strong, any two different names are distinct. */
export const NAMED_TONES: Tones = {
  dist: (a, b) => (a === b ? 0 : STRONG_NAMES.has(a) !== STRONG_NAMES.has(b) ? 0.5 : 0.1),
  strong: (bg) => STRONG_NAMES.has(bg),
  distinct: (a, b) => a !== b,
};
