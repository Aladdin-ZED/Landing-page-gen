/**
 * Subject-first framing for the media of comparison · specs · story · guarantee · faq — built on the
 * kit's fitter (src/lib/media/focus.ts) and Picture's overlay helpers (pictureCrop, frameRegions):
 *
 *   pageShape(ctx)                 the page's media mask (html[data-mask]) as a fitter frame shape
 *   shapeFor(asset, shape, ratio)  that mask, unless it would cut a head (a veil touching the photo's
 *                                  top under an arch, two heads in a circle) that a rounded frame of
 *                                  the same box keeps whole → "rounded"
 *   maskOf(shape, page)            the Picture `mask` prop that draws that shape
 *   bestShot(list, frame)          the photo that suits a frame best (a mother-and-daughter portrait
 *                                  in a wide pill → the single bust) — first wins ties
 *   quietSpot(asset, frame, spots) where an overlay (glass chip, lens) covers no face, no hand and
 *                                  the least of the subject, among the spots a layout allows
 *
 * Pure and deterministic (same props → same markup); no globals.
 */
import type { PictureFrame } from "@/landing/primitives";
import { cropSubjectOf, frameRegions, pictureCrop } from "@/landing/primitives";
import { cropCost, fitFrame, framePointOf, type Box, type FrameShape } from "@/lib/media/focus";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import type { RenderContext, ResolvedAsset } from "../../types";

/** The page's media mask (the archetype's html[data-mask]). */
export function pageShape(ctx: Pick<RenderContext, "archetype">): FrameShape {
  const m = ARCHETYPE_DEFS[ctx.archetype]?.mask ?? "rounded";
  return m === "arch" || m === "circle" || m === "pill" || m === "blob" ? m : "rounded";
}

/** Fitted cost of a photo in a frame (lower is better): the fitter's own objective at its best crop. */
function fittedCost(asset: ResolvedAsset, shape: FrameShape, ratio: number, tight = false): number {
  const s = cropSubjectOf(asset);
  if (s.kind === "none" || s.fixed) return 0;
  const F = shape === "circle" ? 1 : ratio;
  const c = fitFrame(s, { shape, ratio: F, tight, maxZoom: tight ? 1.7 : 1.18 });
  return cropCost(s, shape, F, c.x, c.y, c.zoom, { tight, zoomable: false });
}

/**
 * The page's curved mask, unless it would cut a head that a rounded frame keeps. A head the fitter
 * cannot keep inside the arch / circle / pill / blob costs it ≥ 220 more than the same box with
 * rounded corners (a merely close head costs less than 60): the photo then gets the rounded frame.
 * Products and scenes keep the page's shape (the fitter keeps a product's top whole by zooming).
 */
export function shapeFor(asset: ResolvedAsset | null | undefined, shape: FrameShape, ratio: number): FrameShape {
  if (!asset || asset.alpha || shape === "rounded" || shape === "rect") return shape;
  if (asset.subjectKind !== "person" || asset.focalSource === "merchant") return shape;
  return fittedCost(asset, shape, ratio) - fittedCost(asset, "rounded", ratio) > 120 ? "rounded" : shape;
}

/** The Picture `mask` prop that draws a shape: the page mask when it is the page's own, else forced. */
export function maskOf(shape: FrameShape, page: FrameShape): "page" | "arch" | "circle" | "pill" | "rounded" | "blob" {
  if (shape === page) return "page";
  return shape === "rect" ? "rounded" : shape;
}

/**
 * The photo that suits a frame best: lowest fitted cost, the list order breaking near-ties (a
 * section's preferred shot keeps its place unless another one fits clearly better).
 */
export function bestShot(list: readonly (ResolvedAsset | null | undefined)[], frame: { shape: FrameShape; ratio: number; tight?: boolean }): ResolvedAsset | null {
  let best: ResolvedAsset | null = null;
  let bestCost = Infinity;
  list.forEach((a, i) => {
    if (!a) return;
    const c = (a.alpha ? 0 : fittedCost(a, frame.shape, frame.ratio, frame.tight)) + i * 12;
    if (c < bestCost - 1e-9) [best, bestCost] = [a, c];
  });
  return best;
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

/**
 * An overlay spot, in the page's logical terms: block t(op) · m(iddle) · b(ottom) · x (crossing
 * the photo's foot: half on the photo, half past its edge — over a card that overlaps it, or into
 * the open space under it) and inline s(tart) · e(nd) · c(enter) — "ts" is the top-start corner,
 * "bc" the middle of the bottom edge, "xs" straddles the foot at the start side.
 */
export type Spot = "ts" | "te" | "tc" | "ms" | "me" | "bs" | "be" | "bc" | "xs" | "xe" | "xc";

export interface SpotOptions {
  /** overlay size in fractions of the frame (width, height) */
  chip: { w: number; h: number };
  dir: "ltr" | "rtl";
  /** inset from the frame's edges, fractions of the width (x) and height (y) — CSS percentages of an
   *  absolutely placed overlay resolve the same way; `top` / `bottom` override y for the top / bottom
   *  spots (curved masks hold a chip inside their dome and their foot) */
  inset?: { x: number; y: number; top?: number; bottom?: number };
  /** bottom spots sit this much higher (fractions of the height): a panel overlapping the foot */
  lift?: number;
  /** extra regions to keep clear (frame fractions, physical): a card overlapping the frame */
  avoid?: readonly Box[];
}

/** Does a box (frame fractions) sit inside the mask, a little away from its edge? */
function fitsMask(shape: FrameShape, F: number, b: Box): boolean {
  const pts: [number, number][] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
  ];
  return pts.every(([x, y]) => inside(shape, F, x * F, y));
}

/** Point in frame units (X 0..F, Y 0..1) inside the mask (the kit's shapes, base.css §11). */
function inside(shape: FrameShape, F: number, X: number, Y: number): boolean {
  if (X < 0 || X > F || Y < 0 || Y > 1) return false;
  switch (shape) {
    case "arch": {
      const r = F / 2;
      if (Y >= r) return true;
      return (X - r) ** 2 + (Y - r) ** 2 <= r * r;
    }
    case "circle": {
      const r = Math.min(F, 1) / 2;
      return (X - F / 2) ** 2 + (Y - 0.5) ** 2 <= r * r;
    }
    case "pill": {
      if (F <= 1) {
        const r = F / 2;
        const cy = Y < r ? r : Y > 1 - r ? 1 - r : Y;
        return (X - r) ** 2 + (Y - cy) ** 2 <= r * r;
      }
      const cx = X < 0.5 ? 0.5 : X > F - 0.5 ? F - 0.5 : X;
      return (X - cx) ** 2 + (Y - 0.5) ** 2 <= 0.25;
    }
    case "blob":
      return ((X - F / 2) / (F * 0.46)) ** 2 + ((Y - 0.5) / 0.46) ** 2 <= 1;
    default:
      return true;
  }
}

/** The zone a spot covers, physical frame fractions. */
function zoneOf(spot: Spot, o: SpotOptions): Box {
  const { w, h } = o.chip;
  const ix = o.inset?.x ?? 0.045;
  const iy = o.inset?.y ?? 0.035;
  const it = o.inset?.top ?? iy;
  const ib = o.inset?.bottom ?? iy;
  const startLeft = o.dir !== "rtl";
  const inl = spot[1];
  const blk = spot[0];
  const x = inl === "c" ? 0.5 - w / 2 : (inl === "s") === startLeft ? ix : 1 - ix - w;
  // a crossing spot only covers its upper half of the photo (the rest is past the foot)
  if (blk === "x") return { x, y: 1 - (o.lift ?? 0) - h / 2, w, h: h / 2 };
  const y = blk === "t" ? it : blk === "m" ? 0.5 - h / 2 : 1 - ib - h - (o.lift ?? 0);
  return { x, y, w, h };
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * The first spot (in the layout's order of preference) that covers no head, no hand and almost
 * nothing of a product; else the one that covers least (`clean: false` — the caller may try a
 * smaller overlay). Spots outside a curved mask are skipped. Photos that were never analysed keep
 * the layout's first choice.
 */
export function placeOverlay(
  asset: ResolvedAsset | null | undefined,
  frame: { shape: FrameShape; ratio: number; mask?: Parameters<typeof pictureCrop>[1]["mask"]; pictureFrame?: PictureFrame },
  spots: readonly Spot[],
  o: SpotOptions,
): { spot: Spot; clean: boolean } {
  const F = frame.shape === "circle" ? 1 : frame.ratio;
  // a crossing spot leaves the shape by design; the others must sit inside a curved mask
  const allowed = spots.filter((s) => s[0] === "x" || fitsMask(frame.shape, F, zoneOf(s, o)));
  const list = allowed.length ? allowed : spots;
  if (!asset || asset.alpha || asset.subjectKind === "none") return { spot: list[0]!, clean: true };
  const crop = pictureCrop(asset, { frame: frame.pictureFrame ?? { shape: frame.shape, ratio: F }, mask: frame.mask });
  const r = frameRegions(asset, F, crop);
  const product = asset.subjectKind === "product" || asset.subjectKind === "cutout";
  const wSubject = product ? 14 : asset.subjectKind === "person" ? 1.5 : 0.4;
  const clip = (b: Box): Box => {
    const x0 = Math.max(0, b.x);
    const y0 = Math.max(0, b.y);
    return { x: x0, y: y0, w: Math.max(0, Math.min(1, b.x + b.w) - x0), h: Math.max(0, Math.min(1, b.y + b.h) - y0) };
  };
  // a head's box includes the veil's drape and the air around a face: pad hands a touch (fingers)
  const heads = r.heads.map(clip);
  const hands = r.hands.map((b) => clip({ x: b.x - 0.02, y: b.y - 0.02, w: b.w + 0.04, h: b.h + 0.04 }));
  const subject = clip(r.subject);
  // a scene names no heads or hands: its focal point (the action — a hand at the blender, a face)
  // is kept clear instead
  const focus: Box[] = [];
  if (asset.subjectKind === "scene") {
    const s0 = cropSubjectOf(asset);
    const [fx, fy] = framePointOf(s0.aspect, F, r.crop, s0.focal.x, s0.focal.y);
    focus.push(clip({ x: fx - 0.2, y: fy - 0.2, w: 0.4, h: 0.4 }));
  }
  let best = list[0]!;
  let bestCost = Infinity;
  for (const [i, s] of list.entries()) {
    const z = zoneOf(s, o);
    let hard = 0;
    for (const h of heads) hard += overlap(z, h);
    for (const h of hands) hard += 0.4 * overlap(z, h);
    for (const f of focus) hard += 0.5 * overlap(z, f);
    for (const a of o.avoid ?? []) hard += overlap(z, a);
    // a product's base (its lowest 30%: the stand it rests on, the foot of a bottle) may carry a chip;
    // its body, label and cap may not
    const soft = product
      ? wSubject * overlap(z, { ...subject, h: subject.h * 0.7 }) + 2 * overlap(z, { ...subject, y: subject.y + subject.h * 0.7, h: subject.h * 0.3 })
      : wSubject * overlap(z, subject);
    // clean: no face, no hand, no card; a product barely touched
    if (hard < 1e-4 && (!product || soft < 0.02)) return { spot: s, clean: true };
    const cost = 100 * hard + soft + i * 0.002;
    if (cost < bestCost - 1e-9) [best, bestCost] = [s, cost];
  }
  return { spot: best, clean: false };
}

/** placeOverlay's spot alone. */
export function quietSpot(...args: Parameters<typeof placeOverlay>): Spot {
  return placeOverlay(...args).spot;
}
