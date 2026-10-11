/**
 * Subject-aware framing for the final CTA (and the marquee's photo pills): which product photo suits
 * a frame best, the exact frame each layout draws, and where a chip can sit over a photo without
 * covering a face. Pure, deterministic; everything is computed from the asset's stored subject
 * analysis (src/lib/media/focus.ts) through the kit's Picture helpers, never measured in the browser.
 *
 *  - cardShape / cardFrame   the banner's photo card: the theme's mask (a circle page draws a stadium:
 *                            a disc would crop a standing product or person) at an aspect close to the
 *                            photo's own, inside the shape's range — a near-square photo of two people
 *                            is never squeezed into a narrow pill. POSTER_PILL / STRIP_PILL / stampDisc:
 *                            the poster's inline pill, the marquee's pills, the stamp's disc + orb.
 *  - bestShot                among the product photos, the one this frame shows best: every head whole
 *                            (a head sliced by the frame edge is the worst outcome, a head simply out of
 *                            frame is better), hands whole or out, a product's top kept, and the least
 *                            cropping. The photo order breaks ties (the main photo first).
 *  - tagZone                 the stamp's price chip: the free corner of the product disc (a face, a
 *                            hand or a cutout's neck is never under it).
 */
import { cropSubjectOf, frameRegions, pictureCrop, type PictureFrame } from "@/landing/primitives";
import type { FrameShape } from "@/lib/media/focus";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import type { RenderContext, ResolvedAsset } from "../../types";

/** A frame a photo is drawn in: mask geometry, visible aspect (width / height), tight framing. */
export interface Frame {
  shape: FrameShape;
  ratio: number;
  tight?: boolean;
  /** discs laid over the frame (frame fractions: centre x/y, radius in widths) — the stamp's orb */
  over?: readonly { x: number; y: number; r: number }[];
}

export const asPictureFrame = (f: Frame): PictureFrame => ({ shape: f.shape, ratio: f.ratio, ...(f.tight ? { tight: true } : {}) });

/**
 * The stamp's product disc with the order orb laid over its bottom-end edge (cta.stamp.css at phone
 * size, where the orb is largest against the disc): a face must not sit half under it.
 */
export const stampDisc = (dir: "ltr" | "rtl"): Frame => ({
  shape: "circle",
  ratio: 1,
  over: [{ x: dir === "rtl" ? 0.16 : 0.84, y: 0.855, r: 0.33 }],
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ------------------------------------------------------------------ */
/* Banner card                                                         */
/* ------------------------------------------------------------------ */

/** Shapes the banner card is drawn in. */
export type CardShape = "rounded" | "arch" | "pill" | "blob";

/** The page mask as a card shape: circle and pill pages draw a stadium (a disc is no card). */
export function cardShape(ctx: Pick<RenderContext, "archetype">): CardShape {
  const m = ARCHETYPE_DEFS[ctx.archetype]?.mask ?? "rounded";
  return m === "circle" || m === "pill" ? "pill" : m === "arch" || m === "blob" ? m : "rounded";
}

/** Aspect range (width / height) of an upright card per shape: a stadium reads tall, a rounded card less so. */
const UPRIGHT: Readonly<Record<CardShape, readonly [number, number]>> = {
  pill: [0.62, 0.8],
  arch: [0.7, 0.86],
  rounded: [0.74, 0.9],
  blob: [0.74, 0.9],
};

/**
 * The poster's inline pill (cta.poster.css: 1.72em × 0.8em, the same aspect on phones): framed tightly —
 * a product fills it, a person becomes a head-and-shoulders bust.
 */
export const POSTER_PILL: Frame = { shape: "pill", ratio: 2.15, tight: true };

/** The marquee's photo pills (marquee.css: 1.6em × 0.88em; outline 1.3em × 0.72em). */
export const STRIP_PILL: Frame = { shape: "pill", ratio: 1.8, tight: true };

/** The kit mask (Picture `mask`) that draws a card frame. */
export const cardMask = (f: Frame | undefined): CardShape =>
  f && (f.shape === "arch" || f.shape === "pill" || f.shape === "blob") ? f.shape : "rounded";

/** Desktop: the card runs from above the panel's top edge to its padding line — taller than on phones. */
export const CARD_RATIO_LG = 0.66;

/** Landscape photos: a 4:3 card (a 3:2 stadium on pill / circle pages); an arch or a blob never goes wide. */
export const wideFrame = (shape: CardShape): Frame => (shape === "pill" ? { shape: "pill", ratio: 3 / 2 } : { shape: "rounded", ratio: 4 / 3 });

/** The upright card for this photo: as close to the photo's own aspect as the shape allows. */
export function cardFrame(asset: ResolvedAsset, shape: CardShape): Frame {
  const [lo, hi] = UPRIGHT[shape];
  return { shape, ratio: Math.round(clamp(asset.aspect || asset.width / Math.max(1, asset.height), lo, hi) * 1000) / 1000 };
}

/* ------------------------------------------------------------------ */
/* Mask geometry (frame units: width F, height 1)                      */
/* ------------------------------------------------------------------ */

function inShape(shape: FrameShape, F: number, X: number, Y: number): boolean {
  if (X < 0 || Y < 0 || X > F || Y > 1) return false;
  switch (shape) {
    case "circle": {
      const r = Math.min(F, 1) / 2;
      return (X - F / 2) ** 2 + (Y - 0.5) ** 2 <= r * r;
    }
    case "pill": {
      if (F >= 1) {
        const cx = clamp(X, 0.5, F - 0.5);
        return (X - cx) ** 2 + (Y - 0.5) ** 2 <= 0.25;
      }
      const r = F / 2;
      const cy = clamp(Y, r, 1 - r);
      return (X - r) ** 2 + (Y - cy) ** 2 <= r * r;
    }
    case "arch": {
      const r = F / 2;
      return Y >= r || (X - r) ** 2 + (Y - r) ** 2 <= r * r;
    }
    case "blob":
      return ((X - F / 2) / (F / 2)) ** 2 + ((Y - 0.5) / 0.5) ** 2 <= 1.04;
    default:
      return true;
  }
}

interface FBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Share of a box (frame fractions) inside the mask, sampled on a 6 × 6 grid. */
function shareInside(shape: FrameShape, F: number, b: FBox, over: Frame["over"] = []): number {
  let n = 0;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const u = b.x + (b.w * (i + 0.5)) / 6;
      const v = b.y + (b.h * (j + 0.5)) / 6;
      if (inShape(shape, F, u * F, v) && !over.some((o) => ((u - o.x) * F) ** 2 + (v - o.y) ** 2 <= (o.r * F) ** 2)) n++;
    }
  return n / 36;
}

/** Share of a box hidden under the frame's overlays. */
function shareUnder(F: number, b: FBox, over: Frame["over"] = []): number {
  if (!over.length) return 0;
  let n = 0;
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 6; j++) {
      const u = b.x + (b.w * (i + 0.5)) / 6;
      const v = b.y + (b.h * (j + 0.5)) / 6;
      if (over.some((o) => ((u - o.x) * F) ** 2 + (v - o.y) ** 2 <= (o.r * F) ** 2)) n++;
    }
  return n / 36;
}

/** The crop as displayed: the fitted position at zoom 1 (the zoom is progressive; the position alone is what every engine shows). */
function shownCrop(asset: ResolvedAsset, f: Frame) {
  const c = pictureCrop(asset, { frame: asPictureFrame(f) });
  return c ? { ...c, zoom: 1 } : null;
}

/* ------------------------------------------------------------------ */
/* Choosing the photo                                                  */
/* ------------------------------------------------------------------ */

/**
 * How badly `frame` shows `asset` (0 = perfectly; lower is better). Heads: sliced by the edge = very
 * bad, out of frame = mildly bad, every head gone = bad. Hands: sliced = a little bad. Products: a lost
 * top = bad. Plus the amount of cropping (aspect mismatch).
 */
export function shotScore(asset: ResolvedAsset, frame: Frame): number {
  const F = frame.shape === "circle" ? 1 : frame.ratio;
  const A = asset.aspect || asset.width / Math.max(1, asset.height);
  let s = 1.2 * Math.abs(Math.log(A / F));
  if (asset.alpha) return s;
  const r = frameRegions(asset, F, shownCrop(asset, frame));
  let seen = 0;
  // a face half under an overlay (the stamp's orb) is as sliced as one cut by the mask
  for (const h of r.heads) {
    const k = shareInside(frame.shape, F, h, frame.over);
    if (k >= 0.97) seen++;
    else if (k > 0.03) s += 6 + 10 * (1 - k);
    else s += 1.5;
  }
  if (r.heads.length && !seen) s += 6;
  // balanced headroom: a head pressed against the top edge (a photo shot with none) reads cramped —
  // most under a curved top (arch, stadium, disc), where the curve closes in on it
  if (r.heads.length) {
    const top = Math.max(0, Math.min(...r.heads.map((h) => h.y)));
    const curved = frame.shape !== "rect" && frame.shape !== "rounded";
    const want = curved ? 0.05 : 0.025;
    if (top < want) s += (curved ? 1.6 : 0.8) * ((want - top) / want);
  }
  // hands wholly under an overlay are simply hidden
  for (const h of r.hands) {
    if (shareUnder(F, h, frame.over) > 0.6) continue;
    const k = shareInside(frame.shape, F, h, frame.over);
    if (k > 0.05 && k < 0.95) s += 1.5;
  }
  const kind = cropSubjectOf(asset).kind;
  if ((kind === "product" || kind === "cutout") && r.subject.y < -0.01) s += 4 + 8 * Math.min(1, -r.subject.y);
  return s;
}

/**
 * The product photo `frameOf` shows best (null when the product has no photo). `prefer` scores a
 * photo's fit to the layout itself (e.g. the banner's taste for upright cards); the main photo wins ties.
 */
export function bestShot(
  ctx: RenderContext,
  frameOf: (a: ResolvedAsset) => Frame,
  prefer: (a: ResolvedAsset) => number = () => 0,
): ResolvedAsset | null {
  let best: ResolvedAsset | null = null;
  let bestScore = Infinity;
  ctx.product.images.forEach((ref, i) => {
    const a = ctx.asset(ref);
    if (!a || a.alpha) return;
    const s = shotScore(a, frameOf(a)) + prefer(a) + 0.4 * i;
    if (s < bestScore - 1e-9) [best, bestScore] = [a, s];
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* Stamp: the price chip's corner                                      */
/* ------------------------------------------------------------------ */

/** Where the stamp's frosted price chip sits on the product disc (logical: start = reading start). */
export type TagZone = "top-start" | "top-end" | "mid-start";

/**
 * Chip zones in disc fractions (LTR; mirrored for RTL), from cta.stamp.css — at phone size, where the
 * chip is widest against the disc (~0.6 of it).
 */
const ZONES: Readonly<Record<TagZone, FBox>> = {
  "top-start": { x: -0.15, y: -0.08, w: 0.6, h: 0.25 },
  "top-end": { x: 0.55, y: -0.08, w: 0.6, h: 0.25 },
  "mid-start": { x: -0.22, y: 0.33, w: 0.6, h: 0.25 },
};

const overlap = (a: FBox, b: FBox) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Cutout on the disc: drawn `contain` in a box from 16% above the disc to 8% above its floor and
 * 10% in from each side (cta.stamp.css), resting on the box floor — the product's own box in disc units.
 */
function cutoutBox(asset: ResolvedAsset): FBox {
  const A = asset.aspect || asset.width / Math.max(1, asset.height);
  const bw = 0.8;
  const bh = 1.08;
  const w = Math.min(bw, bh * A);
  const h = w / A;
  const x0 = 0.5 - w / 2;
  const y0 = 0.92 - h;
  const s = asset.subject ?? { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0 + s.x * w, y: y0 + s.y * h, w: s.w * w, h: s.h * h };
}

/** The chip zone that covers the least of the faces, hands and product (the top-start corner on ties). */
export function tagZone(asset: ResolvedAsset | null, dir: "ltr" | "rtl"): TagZone {
  if (!asset) return "top-start";
  const mirror = (b: FBox): FBox => (dir === "rtl" ? { ...b, x: 1 - b.x - b.w } : b);
  const heads: FBox[] = [];
  const hands: FBox[] = [];
  let subject: FBox;
  if (asset.alpha) subject = cutoutBox(asset);
  else {
    const r = frameRegions(asset, 1, shownCrop(asset, { shape: "circle", ratio: 1 }));
    // the face, not the whole head box (a veil or hair at its rim may pass under the chip's edge)
    heads.push(...r.heads.map((h) => ({ x: h.x + h.w * 0.18, y: h.y + h.h * 0.12, w: h.w * 0.64, h: h.h * 0.76 })));
    hands.push(...r.hands);
    subject = r.subject;
  }
  let best: TagZone = "top-start";
  let bestCost = Infinity;
  for (const z of Object.keys(ZONES) as TagZone[]) {
    const zone = mirror(ZONES[z]);
    let c = 0;
    for (const h of heads) c += 100 * overlap(zone, h);
    for (const h of hands) c += 30 * overlap(zone, h);
    c += (asset.alpha ? 40 : 2) * overlap(zone, subject);
    // the corners read best; the side position only when both corners are taken
    if (z === "mid-start") c += 0.4;
    if (z === "top-end") c += 0.2;
    if (c < bestCost - 1e-9) [best, bestCost] = [z, c];
  }
  return best;
}
