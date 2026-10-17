/**
 * Final CTA — data model shared by the three views (kept apart from index.tsx so the views import
 * the types without a cycle). Field names follow the generator's copy map
 * (src/lib/generator/copy-map.ts: kicker · title · lead · ctaLabel).
 */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import { ICON_NAMES, type IconName } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { bestShot, type Frame } from "./fit";

/** Plain string with a max length and an empty default (optional copy). */
const opt = (max: number) => z.string().max(max).default("");

const IconField = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

const Point = z.object({
  icon: IconField.default("check"),
  text: z.string().max(60).default(""),
});

/** Banner panel color: "auto" contrasts with the section; the others force one color block. */
export const PANEL_TONES = ["auto", "accent", "dark", "pop", "surface"] as const;

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(120),
  lead: opt(240),
  /** button label (empty → the page's built-in “order now”) */
  ctaLabel: opt(60),
  /** live price of the selected pack (button pill, or the price chip of the badge layout) */
  showPrice: z.boolean().default(true),
  /** 0–3 short reassurance points under the button */
  points: z.array(Point).max(3).default([]),
  /** product visual (defaults to the cutout, else an upright product photo) */
  image: AssetRef.optional(),
  /** banner: color of the panel the product breaks out of */
  panel: z.enum(PANEL_TONES).default("auto"),
  /** banner: rating + savings chips over the product (real data only) */
  chips: z.boolean().default(true),
  /** badge layout: text around the order button, “·”-separated (empty → the reassurance lines) */
  ring: opt(110),
  /** poster: the product photo set inline inside the headline */
  inlineImage: z.boolean().default(true),
});

export type CtaData = z.infer<typeof schema>;

export interface ViewProps {
  ctx: RenderContext;
  data: CtaData;
  id: string;
  bg: SectionBg;
  titleId: string;
}

/* ------------------------------------------------------------------ */
/* Product visual                                                      */
/* ------------------------------------------------------------------ */

export interface Visual {
  asset: ResolvedAsset | null;
  /** transparent cutout (stands free) vs. a photo (framed) */
  cutout: boolean;
  /** a landscape photo: framed wide — a tall crop would cut the product out of its own picture */
  wide: boolean;
  /** the exact frame the layout draws the photo in (photos only): Picture fits its crop to it */
  frame?: Frame;
}

/** Landscape threshold: wider than 1.15 × its height. */
export const isWide = (a: ResolvedAsset): boolean => !a.alpha && a.width > a.height * 1.15;

export interface VisualOptions {
  /** the product cutout first (it breaks out of panels and discs best) */
  preferCutout: boolean;
  /** the frame the layout draws a photo in */
  frameOf: (a: ResolvedAsset) => Frame;
  /** extra cost of a photo for this layout (e.g. the banner's taste for upright cards) */
  prefer?: (a: ResolvedAsset) => number;
}

const visual = (asset: ResolvedAsset | null, o: VisualOptions): Visual => ({
  asset,
  cutout: !!asset?.alpha,
  wide: !!asset && isWide(asset),
  ...(asset && !asset.alpha ? { frame: o.frameOf(asset) } : {}),
});

/**
 * The section's own image, else the product cutout (when the layout prefers it), else the product
 * photo the layout's frame shows best — every face whole, a product's top kept, the least cropping
 * (cta/fit.ts) — else the cutout after all.
 */
export function pickVisual(ctx: RenderContext, data: CtaData, o: VisualOptions): Visual {
  const own = ctx.asset(data.image);
  if (own) return visual(own, o);
  const cut = o.preferCutout ? ctx.asset(ctx.product.cutout) : null;
  if (cut?.alpha) return visual(cut, o);
  const photo = bestShot(ctx, o.frameOf, o.prefer);
  if (photo) return visual(photo, o);
  return visual(ctx.asset(ctx.product.cutout), o);
}

/* ------------------------------------------------------------------ */
/* Reassurance                                                         */
/* ------------------------------------------------------------------ */

export interface PointLine {
  icon: IconName;
  text: string;
  path: string;
}

/** Points with something to say, with their data paths. */
export function pointLines(data: CtaData): PointLine[] {
  const out: PointLine[] = [];
  data.points.forEach((p, i) => {
    const text = p.text.trim();
    if (text) out.push({ icon: p.icon, text, path: `points.${i}.text` });
  });
  return out;
}

/** Badge ring phrases: the merchant's “·”-separated text, else the reassurance points. */
export function ringPhrases(data: CtaData, fallback: string): string[] {
  const own = data.ring
    .split(/\s*[·•|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (own.length) return own.slice(0, 4);
  const lines = data.points
    .map((p) => p.text.replace(/[*]/g, "").replace(/[.!؟?:،,;]+$/u, "").trim())
    .filter((s) => s.length > 0 && s.length <= 30);
  const unique = [...new Set(lines)];
  // a small ring reads best with two phrases; three only when they are all short
  const picked = unique.slice(0, unique.slice(0, 3).join("").length <= 54 ? 3 : 2);
  return picked.length ? picked : [fallback];
}

/* ------------------------------------------------------------------ */
/* Savings & rating (real data only)                                   */
/* ------------------------------------------------------------------ */

/** Whole-percent saving of the single product against its real reference price, else null. */
export function productSaving(ctx: RenderContext): number | null {
  const { price, compareAt } = ctx.lead;
  if (compareAt === undefined || !(compareAt > price) || ctx.offers.showSavings === "none") return null;
  const pct = Math.round(((compareAt - price) / compareAt) * 100);
  return pct >= 1 && pct <= 99 ? pct : null;
}

/* ------------------------------------------------------------------ */
/* Headline split (poster: the product sits inline inside the title)   */
/* ------------------------------------------------------------------ */

/**
 * Split a title (with *emphasis* / **strong** markup) at the space closest to its middle that is
 * outside any markup run, preferring a break right after punctuation. Returns [title, ""] when no
 * safe break exists (the inline image then closes the headline).
 */
export function splitTitle(title: string): [string, string] {
  const t = title.trim();
  const cands: { at: number; score: number }[] = [];
  let stars = 0;
  const mid = t.length / 2;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "*") stars++;
    else if (ch === " " && stars % 2 === 0 && i > 0 && i < t.length - 1) {
      const prev = t[i - 1]!;
      // after punctuation reads as a natural pause; otherwise closest to the middle wins
      const punct = /[,،;:—–]/.test(prev) ? 0.55 : 1;
      cands.push({ at: i, score: (Math.abs(i - mid) / Math.max(1, t.length)) * punct });
    }
  }
  if (!cands.length) return [t, ""];
  cands.sort((a, b) => a.score - b.score);
  const at = cands[0]!.at;
  return [t.slice(0, at), t.slice(at + 1)];
}

/** Display size by plain length: short titles go giant, long ones step down (never overflow). */
export function titleScale(title: string): "xl" | "l" | "m" {
  const plain = title.replace(/[*\\]/g, "").trim().length;
  if (plain <= 30) return "xl";
  if (plain <= 52) return "l";
  return "m";
}

/** Words in a markup string (for staggering a split headline's second half). */
export function wordCount(s: string): number {
  return s
    .replace(/[*\\]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
