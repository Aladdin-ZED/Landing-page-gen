/**
 * Theme engine public API.
 * Pure & isomorphic (server, browser, worker). No DOM, no Node APIs.
 *
 *   themeFromProduct()  product (category + photo palette + AI vibe + keywords) → ThemeSpec (deterministic per seed)
 *   buildTheme()        ThemeSpec + locale → CSS tokens, [data-bg] color + material maps, <html> attributes, font ids
 *   fontFaceCss()       @font-face rules (+ metric-matched fallbacks) for the theme's fonts
 *   fontPreloads()      ≤ 2 <link rel=preload> candidates
 *   extractPalette()    RGBA pixels → dominant colors + photo metrics
 *   rankArchetypes()    explainable archetype ranking
 *   isQuietProduct()    calm photo or modest/devotional/baby keywords → the page should stay quiet
 *
 * Owner rule (2026-10-10): no emitted UI color is ever orange — OKLCH hue 25–75° with chroma > 0.06
 * (ORANGE_BAND / isOrange / noOrange). buildTheme() enforces it for any spec, hand-edited included,
 * and for what the page BLENDS from its tokens too (CSS color-mix tints, washes, shadows, the accent ↔
 * pop ring, fades between grounds): orangeMixes() / orangeBlend() audit it (blend.ts).
 */
import type { Archetype, Locale, ThemeSpec } from "@/lib/page/schema";
import { ARCHETYPE_DEFS, type ArchetypeDef } from "./archetypes";
import { extractPalette as extract } from "./extract";
import { fontFaceCss as faces, fontPreloads as preloads } from "./fonts";
import { orangeMixesInTokens } from "./blend";
import { buildThemeTokens } from "./tokens";
import type { ArchetypeScore, BuiltTheme, ExtractedPalette, ThemeFromProductInput } from "./types";
import { isQuietProduct as quietProduct, rankArchetypes as rank, themeFromProduct as fromProduct } from "./vibe";

export type { ArchetypeScore, BuiltTheme, ExtractedPalette, ThemeFromProductInput } from "./types";
export {
  ARCHETYPE_DEFS,
  EASE,
  THEME_ATTR_VALUES,
  THEME_SECTION_TYPES,
  findPairing,
  type ArchetypeDef,
  type BaseMood,
  type ButtonStyle,
  type CardStyle,
  type Density,
  type EmphasisStyle,
  type FontPairing,
  type GlassDef,
  type GlyphStyle,
  type Harmony,
  type MaskStyle,
  type MotionKind,
  type RadiusDef,
  type RadiusKind,
  type ShadowKind,
  type SignaturePair,
  type SurfacesKind,
  type TextureKind,
  type ThemeSectionType,
} from "./archetypes";
export { HARMONY_RECIPES, accentPopClean, buildPalette, cleanAccentPop, contrastAudit, paletteBlendIssues, type Palette, type SectionColors } from "./palette";
export {
  BLEND_GUARD,
  EXACT_BAND,
  GROUND_TOKENS,
  PAGE_MIXES,
  SECTION_MIXES,
  SECTION_WASHES,
  blendHit,
  orangeBlend,
  orangeMixesInTokens,
  type BandMargin,
  type BlendHit,
  type MixPair,
} from "./blend";
export { FONT_DATA, FONT_IDS, fontData, fontStack, isKnownFont, type FontData, type KnownFontId } from "./fonts";
export {
  ORANGE_BAND,
  contrast,
  ensureContrast,
  fromOklch,
  inOrangeBand,
  isOrange,
  leaveOrangeBand,
  mix,
  noOrange,
  parseColor,
  toOklch,
  uiColor,
  type Hex,
  type Oklch,
  type OrangeSide,
} from "./color";
export { CALM_ARCHETYPES, isCalmPalette } from "./vibe";
export { ExtractedPaletteSchema, parseExtractedPalette } from "./extract";

export function buildTheme(spec: ThemeSpec, locale: Locale): BuiltTheme {
  return buildThemeTokens(spec, locale);
}

const mixesCache = new WeakMap<ThemeSpec, Map<Locale, string[]>>();

/**
 * Every orange blend the page would paint from this theme (the owner's exact band): accent tints into
 * every ground, washes, shadows, glows, aurora overlaps, the accent ↔ pop ring and fades between any
 * two grounds — at the ratios the landing CSS uses. buildTheme() keeps it empty for any valid spec;
 * generators and checks use it as the audit. Cached per spec object and locale.
 */
export function orangeMixes(spec: ThemeSpec, locale: Locale = "fr"): string[] {
  let byLocale = mixesCache.get(spec);
  if (!byLocale) mixesCache.set(spec, (byLocale = new Map()));
  const hit = byLocale.get(locale);
  if (hit) return [...hit];
  let out: string[];
  try {
    out = orangeMixesInTokens(buildThemeTokens(spec, locale).tokens);
  } catch {
    out = [];
  }
  byLocale.set(locale, out);
  return [...out];
}

/** @font-face rules for the given font ids; `base` is the URL prefix for /fonts (e.g. "/" or "./"). */
export function fontFaceCss(fontIds: string[], locale: Locale, base: string): string {
  return faces(fontIds, locale, base);
}

/**
 * <link rel=preload> candidates for the most important font files (max 2: display, then body —
 * never the accent face; Arabic pages only preload faces that carry Arabic).
 * Render as `<link rel="preload" as="font" type={type} href={href} crossOrigin="anonymous">`.
 * Pass `BuiltTheme.fontWeights` as `weights` so static families preload the weight actually used.
 */
export function fontPreloads(fontIds: string[], locale: Locale, base: string, weights?: number[]): { href: string; type: string }[] {
  return preloads(fontIds, locale, base, weights);
}

/** k-means palette extraction from raw RGBA pixels (downscaled, e.g. 96×96). */
export function extractPalette(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): ExtractedPalette {
  return extract(rgba, width, height);
}

/**
 * Rank archetypes for a product (category + photo palette + optional AI vibe + optional keywords:
 * product name + tagline + description in any language). A calm photo or modest/devotional/baby
 * keywords put the calm archetypes first (never playground).
 */
export function rankArchetypes(input: Omit<ThemeFromProductInput, "seed" | "archetype">): ArchetypeScore[] {
  return rank(input);
}

/**
 * True when the product should get the quiet treatment: a calm, low-color photo (beige, sand, cream,
 * gray, white, black) or modest / devotional / baby keywords. themeFromProduct already applies it to
 * the palette; generators can use it to keep copy and decoration calm too (no shouting urgency).
 */
export function isQuietProduct(input: { palette?: ExtractedPalette | null; keywords?: string | null }): boolean {
  return quietProduct(input);
}

/** Produce a complete ThemeSpec for a product (palette harmony, fonts, dividers…) — deterministic per seed. */
export function themeFromProduct(input: ThemeFromProductInput): ThemeSpec {
  return fromProduct(input);
}

/**
 * Archetype definition (fonts, preferred section variants, color moments, glyph, mask, tilt…) for
 * generators, admin and components. Components that only need the look of an archetype can import
 * ARCHETYPE_DEFS from "@/lib/theme/archetypes" directly (pure data, type-only dependencies).
 */
export function getArchetype(id: Archetype): ArchetypeDef {
  return ARCHETYPE_DEFS[id];
}
