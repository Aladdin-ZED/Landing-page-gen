/**
 * Theme selection for generated pages. Wraps the theme engine so that:
 *
 *   - the engine reads the product's own words (`keywords`: name, tagline, description, facts);
 *   - a calm product (see mood.ts) gets a calm theme whatever the archetype: the engine's quiet
 *     palette (it reads the same keywords), then hard limits — low-chroma accent, pastel pop, light
 *     or tinted page, calm motion, sparse decoration, soft transitions;
 *   - no generated theme ever carries orange (owner rule, 2026-10-10): OKLCH hue 25°–75° with chroma
 *     above 0.06 — red-orange, tomato, coral, terracotta, orange, amber, saffron, ochre. The theme
 *     is built and every color token it emits is checked; the accent / pop that produce orange are
 *     moved to crimson (below 25°) or gold (above 75°), and to a warm neutral as a last resort.
 *     What the page blends from the tokens is checked too (CSS color-mix tints and stages, fade
 *     transitions, accent ↔ pop glows): a crimson accent over a butter field is re-paired (berry,
 *     a cooler pop) until no blend crosses the band — see orangeMixes();
 *   - a failure in the engine (bad palette data, an engine regression) never blocks generation:
 *     the fallback builds a plain, valid ThemeSpec from the archetype's own definition.
 */
import { DIVIDERS, ThemeSpec, type Archetype, type Divider, type Locale, type ProductCategory } from "@/lib/page/schema";
import { ARCHETYPE_DEFS, fromOklch, parseColor, themeFromProduct, toOklch, type ExtractedPalette, type ThemeFromProductInput } from "@/lib/theme";
import type { ProductMood } from "./mood";
import { rngFor, weighted } from "./rng";
import { themeTokens } from "./tones";

export interface ThemeInput {
  category: ProductCategory;
  palette: ExtractedPalette | null;
  aiVibe?: string | null;
  /** the product's own words (see productKeywords) */
  keywords?: string | null;
  /** the product's mood (see readMood); "calm" shapes the theme */
  mood?: ProductMood;
  archetype: Archetype;
  seed: number;
  /** page locale (token check); colors do not depend on it */
  locale?: Locale;
}

const isDivider = (d: string): d is Divider => (DIVIDERS as readonly string[]).includes(d);
const HEX = /^#[0-9a-fA-F]{6}$/;

/* ------------------------------------------------------------------ */
/* No orange                                                           */
/* ------------------------------------------------------------------ */

/** Forbidden UI hue band (OKLCH degrees, inclusive) and the chroma above which a color counts. */
export const ORANGE_BAND = { from: 25, to: 75, chroma: 0.06 } as const;

/** True for a single CSS color (hex or rgb()/hsl()/oklch()…) in the forbidden orange family. */
export function isOrange(color: string): boolean {
  let hex: string | null = null;
  try {
    hex = parseColor(color);
  } catch {
    hex = null;
  }
  if (!hex) return false;
  const o = toOklch(hex);
  return o.c > ORANGE_BAND.chroma && o.h >= ORANGE_BAND.from && o.h <= ORANGE_BAND.to;
}

/** Every color literal inside a CSS value ("0 8px 24px rgba(…)", "radial-gradient(#…, …)"). */
const COLOR_LITERAL = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\b(?:rgba?|hsla?|oklch|oklab)\([^()]*\)/g;

/** Status tokens (success / danger / warn) are fixed by the theme engine, not by the product. */
const STATUS_TOKEN = /(success|danger|warn)/;

/**
 * Color tokens of a built theme with an orange color in them — colors inside shadows, glows and
 * gradients included. Status tokens are listed apart (the engine owns them).
 */
export function orangeTokens(spec: ThemeSpec, locale: Locale = "fr"): { product: string[]; status: string[] } {
  const product: string[] = [];
  const status: string[] = [];
  const tokens = themeTokens(spec, locale);
  if (!tokens) return { product, status };
  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value !== "string") continue;
    const hit = (value.match(COLOR_LITERAL) ?? []).find(isOrange);
    if (!hit) continue;
    (STATUS_TOKEN.test(key) ? status : product).push(`${key}=${hit}`);
  }
  return { product, status };
}

/* ------------------------------------------------------------------ */
/* Orange the page itself blends                                       */
/* ------------------------------------------------------------------ */

/*
 * Two tokens that are not orange can still paint orange: the landing CSS mixes them
 * (`color-mix(in oklab, var(--sec-accent) 7–52%, var(--sec-bg))` for tints, stages and glows; the
 * highlighter over the section ground) and draws gradients between them (fade transitions between
 * neighbor sections, aurora glows from accent and pop — hex stops interpolate in sRGB). A crimson
 * accent over a butter field, or a gold accent next to a rose pop, crosses the band on the way
 * (blender on "warm-butter": accent #c04558 × soft #ecdaa2 at 42% → OKLCH h 35°, c 0.079).
 */

/** Mix ratios sampled along every blended pair (covers the CSS's 7–52% tints and gradient midpoints). */
const BLEND_STEPS = [0.08, 0.15, 0.22, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;

/** Token pairs the CSS mixes inside one section (sec-* of the same data-bg). */
const SECTION_BLENDS: readonly (readonly [string, string])[] = [
  ["sec-accent", "sec-bg"],
  ["sec-accent", "sec-card"],
  ["sec-accent", "sec-chip"],
  ["sec-accent", "sec-ink"],
  ["sec-highlight", "sec-bg"],
  ["sec-ink", "sec-bg"],
  ["sec-card", "sec-bg"],
];

/** Page-level pairs: accent ↔ pop (aurora, rings, conic glows). Section grounds are paired below. */
const PAGE_BLENDS: readonly (readonly [string, string])[] = [["lp-accent", "lp-pop"]];

const BLEND_GROUNDS = ["base", "soft", "surface", "accent", "dark", "pop"] as const;

type Lab3 = readonly [number, number, number];

function labOf(hex: string): Lab3 {
  const o = toOklch(hex);
  const r = (o.h * Math.PI) / 180;
  return [o.l, o.c * Math.cos(r), o.c * Math.sin(r)];
}

function rgbOf(hex: string): Lab3 {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const toHex2 = (v: number) =>
  Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16)
    .padStart(2, "0");

function labInBand(l: Lab3): boolean {
  const c = Math.hypot(l[1], l[2]);
  if (c <= ORANGE_BAND.chroma) return false;
  let h = (Math.atan2(l[2], l[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return h >= ORANGE_BAND.from && h <= ORANGE_BAND.to;
}

/** First color literal of a token value as hex (shadows, gradients, rgba…), null when none. */
function tokenHex(value: string | undefined): string | null {
  if (!value) return null;
  const lit = value.match(COLOR_LITERAL)?.[0];
  if (!lit) return null;
  try {
    return parseColor(lit);
  } catch {
    return null;
  }
}

/** The first orange blend between two colors (oklab mix, then sRGB gradient), as "t=0.42 oklab". */
export function orangeBlend(a: string, b: string): string | null {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y || x === y) return null;
  const A = labOf(x);
  const B = labOf(y);
  const P = rgbOf(x);
  const Q = rgbOf(y);
  for (const t of BLEND_STEPS) {
    const lab: Lab3 = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
    if (labInBand(lab)) return `t=${t} oklab`;
    const rgb = `#${toHex2(P[0] + (Q[0] - P[0]) * t)}${toHex2(P[1] + (Q[1] - P[1]) * t)}${toHex2(P[2] + (Q[2] - P[2]) * t)}`;
    if (isOrange(rgb)) return `t=${t} srgb`;
  }
  return null;
}

/**
 * Orange the page would blend from this theme's tokens: section tints and stages, highlighters,
 * accent ↔ pop glows and fade transitions between any two section grounds (any two may meet).
 */
export function orangeMixes(spec: ThemeSpec, locale: Locale = "fr"): string[] {
  const tokens = themeTokens(spec, locale);
  if (!tokens) return [];
  const out: string[] = [];
  const test = (label: string, a: string | null, b: string | null) => {
    if (!a || !b) return;
    const hit = orangeBlend(a, b);
    if (hit) out.push(`${label} ${a}×${b} ${hit}`);
  };
  for (const bg of BLEND_GROUNDS) {
    for (const [p, q] of SECTION_BLENDS) test(`${bg}:${p}×${q}`, tokenHex(tokens[`${bg}:${p}`]), tokenHex(tokens[`${bg}:${q}`]));
  }
  for (const [p, q] of PAGE_BLENDS) test(`${p}×${q}`, tokenHex(tokens[p]), tokenHex(tokens[q]));
  for (let i = 0; i < BLEND_GROUNDS.length; i++) {
    for (let j = i + 1; j < BLEND_GROUNDS.length; j++) {
      const a = BLEND_GROUNDS[i]!;
      const b = BLEND_GROUNDS[j]!;
      test(`ground ${a}×${b}`, tokenHex(tokens[`${a}:sec-bg`]), tokenHex(tokens[`${b}:sec-bg`]));
    }
  }
  return out;
}

/** Hue-shifted / softened variants of a color, nearest first (candidates for the blend repair). */
function blendVariants(hex: string, role: "accent" | "pop"): string[] {
  const parsed = parseColor(hex);
  if (!parsed) return [hex];
  const o = toOklch(parsed);
  const out: string[] = [hex];
  const add = (l: number, c: number, h: number) => {
    const next = fromOklch({ l, c, h: ((h % 360) + 360) % 360 });
    if (!out.includes(next) && !isOrange(next)) out.push(next);
  };
  // away from the band: reds toward berry, yellows toward lemon / olive, anything else stays put
  const redSide = o.h < ORANGE_BAND.from || o.h >= 300;
  const yellowSide = o.h > ORANGE_BAND.to && o.h < 150;
  const dir = redSide ? -1 : yellowSide ? 1 : 0;
  for (const k of [1, 0.8, 0.62]) {
    if (dir !== 0) for (const step of [10, 20, 32]) add(o.l, o.c * k, o.h + dir * step);
    if (k < 1) add(o.l, o.c * k, o.h);
  }
  // a pop may also turn to the cool side (sage, teal, cobalt, orchid) at its own lightness
  if (role === "pop") for (const h of [150, 195, 245, 320]) add(o.l, Math.min(o.c, 0.12), h);
  return out;
}

/**
 * The nearest accent / pop pair whose blends stay out of the band: berry instead of crimson over a
 * butter field, a lemon gold instead of an amber one, a sage pop instead of a rose one beside gold;
 * the neutrals may take the accent's own hue (a crimson accent over crimson-tinted creams never
 * blends into brick). Tried in three passes, nearest first — pop only, then accent (± neutral hue),
 * then both — at most `budget` theme builds (≈ 3 ms each). Returns the cleanest theme found (fewest
 * orange blends), or null when nothing beats the input.
 */
function repairBlends(spec: ThemeSpec, issues: (s: ThemeSpec) => number, budget = 110): ThemeSpec | null {
  const { accent: a0, pop: p0, neutralHue: n0 } = spec.palette;
  const hueOf = (hex: string) => {
    const h = parseColor(hex);
    return h ? Math.round(toOklch(h).h) : undefined;
  };
  type Cand = { accent: string; pop: string; neutralHue: number | undefined; cost: number };
  const cand = (accent: string, pop: string, neutralHue: number | undefined): Cand => ({
    accent,
    pop,
    neutralHue,
    // the product's own color (the accent) weighs double; re-tinting neutrals is a small move
    cost: colorDistance(accent, a0) * 2 + colorDistance(pop, p0) + (neutralHue === n0 ? 0 : 0.02),
  });
  let best = { spec, n: issues(spec) };
  let left = budget;
  /** one greedy pass over candidates built from the best theme so far; true once clean */
  const pass = (make: (s: ThemeSpec) => Cand[]): boolean => {
    const from = best.spec;
    const list = make(from)
      .filter((c) => c.accent !== from.palette.accent || c.pop !== from.palette.pop || c.neutralHue !== from.palette.neutralHue)
      .sort((x, y) => x.cost - y.cost);
    for (const c of list) {
      if (left-- <= 0) return false;
      const palette: ThemeSpec["palette"] = { ...from.palette, accent: c.accent, pop: c.pop };
      if (c.neutralHue === undefined) delete palette.neutralHue;
      else palette.neutralHue = c.neutralHue;
      const r = ThemeSpec.safeParse({ ...from, palette });
      if (!r.success) continue;
      const n = issues(r.data);
      if (n < best.n) best = { spec: r.data, n };
      if (n === 0) return true;
    }
    return false;
  };
  const popPass = (s: ThemeSpec) => blendVariants(s.palette.pop, "pop").map((p) => cand(s.palette.accent, p, s.palette.neutralHue));
  const accentPass = (s: ThemeSpec) =>
    blendVariants(s.palette.accent, "accent").flatMap((a) => [cand(a, s.palette.pop, s.palette.neutralHue), cand(a, s.palette.pop, hueOf(a))]);
  // pop first (the cheapest change), then the accent (± neutral hue) over the best so far, then pop again
  for (const p of [popPass, accentPass, popPass, accentPass]) if (pass(p)) break;
  return best.spec === spec ? null : best.spec;
}

/**
 * Move one color out of the orange family. `step` widens the margin (the engine's scales shift
 * hue as they darken, so a gold right at the edge can still produce amber darks): red-oranges go to
 * crimson, ambers to a clean gold; from step 3 on, the color becomes a warm neutral (sand, taupe).
 */
function deOrange(hex: string, step: number): string {
  const parsed = parseColor(hex);
  if (!parsed) return hex;
  const o = toOklch(parsed);
  const margin = 7 + step * 8;
  const near = o.c > ORANGE_BAND.chroma - 0.01 && o.h >= ORANGE_BAND.from - margin && o.h <= ORANGE_BAND.to + margin + 10;
  if (!near) return hex;
  if (step >= 3) return fromOklch({ l: o.l, c: Math.min(o.c, 0.045), h: o.h });
  const h = o.h < 50 ? ORANGE_BAND.from - margin : ORANGE_BAND.to + margin + 6;
  return fromOklch({ l: o.l, c: o.c * (1 - step * 0.12), h: (h + 360) % 360 });
}

/**
 * The theme with accent and/or pop moved out of the orange family until no product-derived token is
 * orange and nothing the page blends from them is either (see orangeMixes). Only the color
 * responsible moves (a crimson accent is not bent because of an amber pop); warm neutrals are the
 * last resort. Orange the product colors cannot explain (an engine constant) is left to the engine:
 * the colors are then moved the minimum.
 */
export function withoutOrange(spec: ThemeSpec, locale: Locale = "fr"): ThemeSpec {
  const tokensClean = (s: ThemeSpec) => !isOrange(s.palette.accent) && !isOrange(s.palette.pop) && orangeTokens(s, locale).product.length === 0;
  // 0 = clean; an orange token always outweighs any number of orange blends
  const issues = (s: ThemeSpec) => (tokensClean(s) ? orangeMixes(s, locale).length : 1000);
  if (issues(spec) === 0) return spec;
  // the tokens are clean, only their blends cross the band: re-pair accent and pop
  const moved = tokensClean(spec) ? spec : moveOutOfBand(spec, tokensClean);
  return issues(moved) === 0 ? moved : (repairBlends(moved, issues) ?? moved);
}

/** The token-level repair: accent / pop that are (or produce) orange tokens step out of the band. */
function moveOutOfBand(spec: ThemeSpec, clean: (s: ThemeSpec) => boolean): ThemeSpec {
  if (clean(spec)) return spec;
  const withColors = (s: ThemeSpec, accent: string, pop: string): ThemeSpec | null => {
    if (accent === s.palette.accent && pop === s.palette.pop) return null;
    const r = ThemeSpec.safeParse({ ...s, palette: { ...s.palette, accent, pop } });
    return r.success ? r.data : null;
  };
  let current = spec;
  let firstMove: ThemeSpec | null = null;
  for (let step = 0; step <= 3; step++) {
    const { accent, pop } = current.palette;
    const nextAccent = deOrange(accent, step);
    const nextPop = deOrange(pop, step);
    for (const candidate of [withColors(current, nextAccent, pop), withColors(current, accent, nextPop)]) {
      if (candidate && clean(candidate)) return candidate;
    }
    const both = withColors(current, nextAccent, nextPop);
    if (!both) break;
    if (clean(both)) return both;
    firstMove ??= both;
    current = both;
  }
  return firstMove ?? spec;
}

/** OKLab distance between two colors (0 = same; ≈ 0.1 = clearly another color); 1 when unreadable. */
export function colorDistance(a: string, b: string): number {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return 1;
  const lab = (hex: string) => {
    const o = toOklch(hex);
    const r = (o.h * Math.PI) / 180;
    return [o.l, o.c * Math.cos(r), o.c * Math.sin(r)] as const;
  };
  const [l1, a1, b1] = lab(x);
  const [l2, a2, b2] = lab(y);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/* ------------------------------------------------------------------ */
/* Calm                                                                */
/* ------------------------------------------------------------------ */

/** Calm limits: an accent with presence but no shout, a pop that stays a pastel (never a highlighter), a warm pop that stays sand (never peach). */
export const CALM_LIMITS = { accentChroma: 0.11, accentL: [0.26, 0.72], popChroma: 0.07, popMinL: 0.8, sandBand: [20, 80], sandChroma: 0.028 } as const;

/**
 * Calm accent: chroma ≤ 0.11, lightness 0.26–0.72. The engine's own quiet accents (plum, dusty rose,
 * sage, ink, the product's deepened hue) are already inside and come back untouched.
 */
function calmAccent(hex: string): string {
  const parsed = parseColor(hex);
  if (!parsed) return hex;
  const o = toOklch(parsed);
  const [lo, hi] = CALM_LIMITS.accentL;
  if (o.c <= CALM_LIMITS.accentChroma && o.l >= lo && o.l <= hi) return hex;
  return fromOklch({ l: Math.min(hi, Math.max(lo, o.l)), c: Math.min(o.c, CALM_LIMITS.accentChroma), h: o.h });
}

/**
 * Calm pop: a pastel (lightness ≥ 0.8, chroma ≤ 0.07) of its own hue — a butter highlighter or a
 * cobalt chip next to a dusty rose is exactly the loudness calm pages avoid. Engine quiet pops pass.
 * A pastel inside the warm band (hue 20°–80°) is a peach or an apricot even below the orange
 * threshold: it becomes a sand / cream (chroma ≤ 0.028), the warm neutral a modest page wants.
 */
function calmPop(hex: string): string {
  const parsed = parseColor(hex);
  if (!parsed) return hex;
  const o = toOklch(parsed);
  const warm = o.h >= CALM_LIMITS.sandBand[0] && o.h <= CALM_LIMITS.sandBand[1];
  const maxC = warm ? CALM_LIMITS.sandChroma : CALM_LIMITS.popChroma;
  if (o.c <= maxC && (o.l >= CALM_LIMITS.popMinL || o.c <= 0.03)) return hex;
  return fromOklch({ l: Math.max(CALM_LIMITS.popMinL, o.l), c: Math.min(o.c, maxC), h: o.h });
}

/**
 * Angular transitions read as energy; calm pages keep the soft shapes. The fade is left out too: a
 * long gradient from an ivory field into a plum or ink block is a muddy smear, not a transition (a
 * calm page changes field with a clean curve, or with space and color alone).
 */
const CALM_DIVIDERS = new Set<Divider>(["curve", "arch", "wave", "none"]);

/** A calm reading of a theme: same archetype and fonts, quieter color, light page, calm motion. */
export function calmTheme(spec: ThemeSpec): ThemeSpec {
  const accent = calmAccent(spec.palette.accent);
  const dividers = spec.dividers.filter((d) => CALM_DIVIDERS.has(d));
  const next = ThemeSpec.safeParse({
    ...spec,
    palette: {
      ...spec.palette,
      accent,
      pop: calmPop(spec.palette.pop),
      base: spec.palette.base === "dark" ? "tinted" : spec.palette.base,
    },
    motion: spec.motion === "off" ? "off" : "calm",
    ornament: Math.min(spec.ornament, 0.7),
    dividers: dividers.length ? dividers : ["none"],
  });
  return next.success ? next.data : spec;
}

/* ------------------------------------------------------------------ */
/* Theme for a product                                                 */
/* ------------------------------------------------------------------ */

function fallbackTheme(input: ThemeInput): ThemeSpec {
  const def = ARCHETYPE_DEFS[input.archetype];
  const rng = rngFor(input.seed, "fallback-theme");
  const sig = def.signature[Math.floor(rng() * def.signature.length)] ?? { accent: "#3f6f63", pop: "#a8bea0" };
  const colored = input.palette?.colors.find((c) => HEX.test(c.hex) && c.chroma >= 0.05 && c.weight >= 0.06);
  const pairing = def.fonts[Math.floor(rng() * def.fonts.length)] ?? def.fonts[0]!;
  const base = weighted(
    rng,
    (["light", "tinted", "dark"] as const).map((k) => ({ value: k, weight: def.baseMood[k] })),
  );
  const dividers = (def.dividers as readonly string[]).filter(isDivider).filter((d) => d !== "none").slice(0, 3);
  return ThemeSpec.parse({
    archetype: input.archetype,
    seed: input.seed,
    palette: { accent: colored?.hex ?? sig.accent, pop: sig.pop, base, harmony: def.harmony },
    fonts: {
      display: pairing.display,
      body: pairing.body,
      ...(pairing.accent ? { accent: pairing.accent } : {}),
      displayAr: pairing.displayAr,
      bodyAr: pairing.bodyAr,
    },
    motion: def.defaultMotion,
    dividers: dividers.length ? dividers : ["curve", "fade"],
    ornament: def.ornament,
  });
}

/** Engine input: the product's own words ride along as `keywords` (modest, luxury, tech… groups). */
function engineInput(input: ThemeInput): ThemeFromProductInput {
  return {
    category: input.category,
    palette: input.palette,
    aiVibe: input.aiVibe ?? null,
    keywords: input.keywords?.trim() || null,
    archetype: input.archetype,
    seed: input.seed,
  };
}

/**
 * themeFromProduct with a forced archetype, shaped by the product's mood, never orange; never throws.
 * `scout: true` skips the token check (≈ 3 ms: a full theme build) for callers that only compare
 * candidate seeds — the theme they finally use always goes through the full path.
 */
export function productTheme(input: ThemeInput, opts: { scout?: boolean } = {}): ThemeSpec {
  let spec: ThemeSpec;
  try {
    spec = themeFromProduct(engineInput(input));
  } catch {
    spec = fallbackTheme(input);
  }
  const shaped = input.mood === "calm" ? calmTheme(spec) : spec;
  return opts.scout ? shaped : withoutOrange(shaped, input.locale);
}

export interface RerollOptions {
  keywords?: string | null;
  mood?: ProductMood;
  locale?: Locale;
}

/**
 * Design re-roll of an existing theme: same archetype and product colors, new seed, font pairing,
 * page mood, transitions and decoration density (the admin's motion preference is kept). A calm
 * product stays calm and the result is never orange.
 */
export function rerollTheme(spec: ThemeSpec, category: ProductCategory, seed: number, opts: RerollOptions = {}): ThemeSpec {
  const fresh = productTheme({ category, palette: null, archetype: spec.archetype, seed, ...opts });
  const sameFonts = fresh.fonts.display === spec.fonts.display && fresh.fonts.body === spec.fonts.body;
  let fonts = fresh.fonts;
  if (sameFonts) {
    // prefer a different pairing of the same archetype when one exists
    const other = ARCHETYPE_DEFS[spec.archetype].fonts.find((f) => f.display !== spec.fonts.display || f.body !== spec.fonts.body);
    if (other) {
      fonts = {
        display: other.display,
        body: other.body,
        ...(other.accent ? { accent: other.accent } : {}),
        displayAr: other.displayAr,
        bodyAr: other.bodyAr,
      };
    }
  }
  const next = ThemeSpec.safeParse({
    ...fresh,
    fonts,
    palette: { ...spec.palette, base: fresh.palette.base },
    motion: opts.mood === "calm" && spec.motion !== "off" ? "calm" : spec.motion,
  });
  if (!next.success) return spec;
  // the kept product colors were checked when the page was made; the new mood is checked again
  return withoutOrange(next.data, opts.locale);
}
