/**
 * Story kit — small pure helpers shared by the product-story sections
 * (benefits, showcase, problem, steps, stats). Copy families, locale fallback, product names,
 * product photo pools and zod field builders. No React, no globals.
 */
import { z } from "zod";
import { ICON_NAMES, cropSubjectOf, frameRegions, pictureCrop, type IconName, type PictureFrame } from "@/landing/primitives";
import { percentPair, robustCrop, type Box, type FrameShape } from "@/lib/media/focus";
import type { Locale, ProductCategory, SectionBg } from "@/lib/page/schema";
// pure data module (type-only imports inside)
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import type { RenderContext, ResolvedAsset } from "../../types";

/* ------------------------------------------------------------------ */
/* Copy families: categories that share a story                        */
/* ------------------------------------------------------------------ */

export type Family = "care" | "scent" | "style" | "active" | "home" | "tech" | "kids" | "natural" | "general";

const FAMILY_OF: Record<ProductCategory, Family> = {
  beauty: "care",
  skincare: "care",
  haircare: "care",
  grooming: "care",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  fitness: "active",
  sport: "active",
  kitchen: "home",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  kids: "kids",
  toys: "kids",
  pets: "kids",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
  other: "general",
};

export function familyOf(category: ProductCategory | undefined): Family {
  return (category && FAMILY_OF[category]) || "general";
}

/** Languages the default copy is written in; every other locale falls back to English. */
export type CopyLang = "ar" | "fr" | "en";
export type Tri<T> = Record<CopyLang, T>;

export function copyLang(locale: Locale): CopyLang {
  return locale === "ar" || locale === "fr" ? locale : "en";
}

/** Deterministic pick (rng from DefaultsInput / ctx.rng). */
export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
}

/**
 * Short product name for headings: drops the size/format tail ("— 50 ml", "(x2)", ", 250 g")
 * and keeps at most ~34 characters on a word boundary.
 */
export function shortName(name: string): string {
  let s = name.split(/\s[—–-]\s|\(|,|·|\|/)[0]!.trim() || name.trim();
  if (s.length > 34) {
    const cut = s.slice(0, 34);
    s = cut.slice(0, Math.max(cut.lastIndexOf(" "), 18)).trim();
  }
  return s;
}

/** Replace {name}/{short} placeholders in default copy. */
export function fill(s: string, vars: { name: string; short: string }): string {
  return s.replace(/\{name\}/g, vars.name).replace(/\{short\}/g, vars.short);
}

/* ------------------------------------------------------------------ */
/* Rendering helpers                                                   */
/* ------------------------------------------------------------------ */

/** "01", "02"… — editorial index (always Latin digits, like the rest of the page's numerals). */
export const idx = (i: number): string => String(i + 1).padStart(2, "0");

/** Decoration density bucket from theme.ornament (0..2): 0 none · 1 normal · 2 rich. */
export function density(ctx: Pick<RenderContext, "ornament">): 0 | 1 | 2 {
  return ctx.ornament < 0.35 ? 0 : ctx.ornament < 1.45 ? 1 : 2;
}

/** Light or dark family of a color block on this page (base/soft/surface are dark on dark-mood pages). */
export function bgFamily(ctx: Pick<RenderContext, "doc">, bg: SectionBg): string {
  if (bg === "accent" || bg === "pop") return bg;
  return bg === "dark" || ctx.doc.theme.palette.base === "dark" ? "dark" : "light";
}

/**
 * Color block for a nested surface (bento tile, stacked card, stat panel): the first preference whose
 * family differs from the section's own background, so the surface never melts into it. Put the
 * result in `data-bg` on the nested element — the theme maps --sec-* (and shadows) for any [data-bg].
 */
export function nestedBg(ctx: Pick<RenderContext, "doc">, section: SectionBg, prefs: readonly SectionBg[]): SectionBg {
  const own = bgFamily(ctx, section);
  return prefs.find((b) => bgFamily(ctx, b) !== own) ?? (own === "accent" ? "pop" : "accent");
}

/** Frame ratio that suits the shot: landscape photos keep a landscape crop. */
export const ratioFor = (a: ResolvedAsset | null | undefined, portrait = "4/5", landscape = "4/3"): string =>
  a && a.width > a.height * 1.08 ? landscape : portrait;

/* ------------------------------------------------------------------ */
/* Subject-aware framing (Picture `frame` / `position`)                */
/* ------------------------------------------------------------------ */

/** The page's media mask (html[data-mask]) — always the archetype's own. */
export function pageShape(ctx: Pick<RenderContext, "archetype">): FrameShape {
  return ARCHETYPE_DEFS[ctx.archetype].mask as FrameShape;
}

/**
 * Zoom cap of every frame these sections fit: 1. The fitter may zoom a small subject in, but the
 * zoom (Picture's --pic-zoom) is not drawn by the kit stylesheet, so a crop must be right on the
 * plain window it actually shows — a hand cropped out of the zoomed window can slide back in,
 * half-cut, on the plain one.
 */
export const NO_ZOOM = 1;

/** The frame of a `mask="page"` picture shown at `ratio` (a circle mask is always square). */
export function pageFrame(ctx: Pick<RenderContext, "archetype">, ratio: number): PictureFrame {
  const shape = pageShape(ctx);
  return { shape, ratio: shape === "circle" ? 1 : ratio, maxZoom: NO_ZOOM };
}

/** Picture props of a subject-aware crop (spread onto <Picture>). */
export interface FitProps {
  frame?: PictureFrame;
  frameLg?: PictureFrame;
  frameMin?: string;
  position?: string;
}

/**
 * Crop props for a photo shown at the exact aspect `base` (phones / tablets) and, from `min` up, in
 * a box whose aspect CSS keeps between `lg[0]` and `lg[1]`. Two exact frames (a fixed desktop aspect:
 * pass the same value twice) are each fitted subject-first (`frame` + `frameLg`). A desktop box whose
 * aspect varies (a photo running the height of a stretched grid cell) gets one position that holds
 * over every frame it can take, the phone frame included: heads, hands and a product's top stay safe
 * at every size — fitting one end of the range alone would let a hand that was cropped out slide
 * back in half-cut at the other. Cutouts are contained, never cropped: no props.
 */
export function fitProps(a: ResolvedAsset | null | undefined, shape: FrameShape, base: number, lg?: readonly [number, number], min = "64rem"): FitProps {
  if (!a || a.alpha) return {};
  const ratio = shape === "circle" ? 1 : base;
  if (!lg) return { frame: { shape, ratio, maxZoom: NO_ZOOM } };
  const lo = Math.min(lg[0], lg[1]);
  const hi = Math.max(lg[0], lg[1]);
  const two = (): FitProps => ({ frame: { shape, ratio, maxZoom: NO_ZOOM }, frameLg: { shape, ratio: (lo + hi) / 2, maxZoom: NO_ZOOM }, frameMin: min });
  if (hi / lo < 1.03) return two();
  const position = rangePosition(a, shape, Math.min(base, lo), Math.max(base, hi), [base]);
  return position ? { position } : two();
}

/**
 * Which end of a photo's edge (block "start" = top, "end" = bottom) a chip crossing that edge should
 * sit at: the one where it covers no face, hand or product. `inline` is the edge it crosses (logical,
 * for the page direction), `chip` its size inside the frame (fractions of the frame). Ties keep
 * `prefer`. Without subject data: `prefer`.
 */
export function quietEdge(
  a: ResolvedAsset | null | undefined,
  frame: { shape: FrameShape; ratio: number },
  opts: { inline: "start" | "end"; dir: "ltr" | "rtl"; chip: { w: number; h: number }; inset?: number; prefer?: "start" | "end" },
): "start" | "end" {
  const prefer = opts.prefer ?? "end";
  if (!a || a.alpha || (a.subjectKind ?? "none") === "none") return prefer;
  const crop = pictureCrop(a, { frame: { ...frame, maxZoom: NO_ZOOM } });
  const r = frameRegions(a, frame.ratio, crop);
  const left = (opts.inline === "start") !== (opts.dir === "rtl");
  const inset = opts.inset ?? 0.08;
  const area = (p: Box, q: Box) => Math.max(0, Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x)) * Math.max(0, Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y));
  const cost = (block: "start" | "end") => {
    const zone: Box = { x: left ? 0 : 1 - opts.chip.w, y: block === "start" ? inset : 1 - inset - opts.chip.h, w: opts.chip.w, h: opts.chip.h };
    let c = 0;
    for (const h of r.heads) c += 100 * area(zone, h);
    for (const h of r.hands) c += 30 * area(zone, h);
    // a product's own box counts double at its top (cap, dropper, label)
    const items = a.keep.filter((k) => k.k === "item");
    c += (items.length ? 12 : 2) * area(zone, r.subject);
    return c;
  };
  const other = prefer === "end" ? "start" : "end";
  return cost(other) < cost(prefer) - 1e-6 ? other : prefer;
}

/** Width / height of an asset (1 when unknown). */
export const aspectOf = (a: ResolvedAsset | null | undefined): number => (a && a.width > 0 && a.height > 0 ? a.width / a.height : 1);

/** An upright shot (portrait, a standing figure, a bottle): it wants a portrait frame. */
export const isUpright = (a: ResolvedAsset | null | undefined): boolean => !!a && a.height > a.width * 1.08;

/** A person is the subject (heads and hands to protect: never a wide strip). */
export const isPerson = (a: ResolvedAsset | null | undefined): boolean => a?.subjectKind === "person";

/**
 * One object-position for a box whose aspect CSS lets vary between `lo` and `hi` (a photo that fills
 * a stretched grid cell, a card capped to the viewport): the crop that stays best across the whole
 * range — heads, hands and a product's top safe at both ends. Pass it as Picture `position`.
 * Undefined for cutouts and `contain` shots (nothing is cropped).
 */
export function rangePosition(a: ResolvedAsset | null | undefined, shape: FrameShape, lo: number, hi = lo, also: readonly number[] = []): string | undefined {
  if (!a || a.alpha) return undefined;
  // never analysed: the asset's own default position already is the safe compromise
  if ((a.subjectKind ?? "none") === "none" && a.focalSource !== "merchant") return undefined;
  const l = Math.min(lo, hi);
  const h = Math.max(lo, hi);
  const ratios = h / l < 1.04 ? [Math.sqrt(l * h)] : [l, Math.sqrt(l * h), h];
  for (const r of also) if (r > l * 1.02 && r < h / 1.02 && !ratios.some((x) => Math.abs(x / r - 1) < 0.03)) ratios.push(r);
  const c = robustCrop(cropSubjectOf(a), [shape], ratios);
  return percentPair(c.x, c.y);
}

/** Every product photo, cutout first (resolved, missing ones dropped). */
export function productPhotos(ctx: RenderContext): ResolvedAsset[] {
  const out: ResolvedAsset[] = [];
  const seen = new Set<string>();
  for (const ref of [ctx.product.cutout, ...ctx.product.images]) {
    const a = ctx.asset(ref);
    if (a && !seen.has(a.id)) {
      seen.add(a.id);
      out.push(a);
    }
  }
  return out;
}

/** Photos only (no cutout) — for framed media where a transparent PNG would look unfinished. */
export function productShots(ctx: RenderContext): ResolvedAsset[] {
  const out: ResolvedAsset[] = [];
  for (const ref of ctx.product.images) {
    const a = ctx.asset(ref);
    if (a && !a.alpha && !out.some((o) => o.id === a.id)) out.push(a);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Schema builders                                                     */
/* ------------------------------------------------------------------ */

/** Plain string with a max length and an empty default (optional copy). */
export const opt = (max: number) => z.string().max(max).default("");

/** Icon from the custom landing set. */
export const IconField = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

export type { IconName };

/* ------------------------------------------------------------------ */
/* Figures                                                             */
/* ------------------------------------------------------------------ */

export interface ParsedFigure {
  prefix: string;
  value: number;
  decimals: number;
  suffix: string;
}

/**
 * Split a short figure like "12 h", "×3", "4,8/5", "-30%" into prefix / number / suffix so it can
 * roll up with a Counter. Returns null when there is no number to animate.
 */
export function parseFigure(s: string): ParsedFigure | null {
  const m = /^([^0-9]{0,4}?)(\d{1,7}(?:[.,]\d{1,2})?)(.{0,12})$/.exec(s.trim());
  if (!m) return null;
  const raw = m[2]!.replace(",", ".");
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const dot = raw.indexOf(".");
  return { prefix: m[1] ?? "", value, decimals: dot === -1 ? 0 : raw.length - dot - 1, suffix: m[3] ?? "" };
}
