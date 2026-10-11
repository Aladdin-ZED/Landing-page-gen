/**
 * Overlays on fitted photos, shared by the proof and media sections (reviews, socialProof, gallery,
 * video, beforeAfter): where a chip, a sticker or a phone's chrome lands on the photo's people.
 * Frame fractions come from the subject analysis (`frameRegions`): heads, hands and the subject box
 * mapped into the exact frame the Picture shows. Pure.
 */
import { fitFrame, percentPair, type FrameShape } from "@/lib/media/focus";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import { cropSubjectOf, frameRegions, pictureCrop } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";

/** The media mask the theme draws for this page (html[data-mask] = the archetype's mask). */
export function pageMask(ctx: Pick<RenderContext, "archetype">): FrameShape {
  return ARCHETYPE_DEFS[ctx.archetype]?.mask ?? "rounded";
}

interface Band {
  /** top edge, frame fraction */
  y: number;
  /** height, frame fraction */
  h: number;
  /** inline span (frame fractions, physical left → right); default the whole width */
  x?: number;
  w?: number;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * How much of the photo's heads (weighted ×3), hands and — on a product shot — the product a band
 * covers, as a share of their own area (0 = clear). `frame` is the frame the Picture uses (cover
 * crops only).
 */
export function coverOf(asset: ResolvedAsset | null | undefined, frame: { ratio: number; shape?: FrameShape; maxZoom?: number }, band: Band): number {
  if (!asset || asset.alpha || !asset.subjectKind || asset.subjectKind === "none") return 0;
  const crop = pictureCrop(asset, { frame: { shape: frame.shape ?? "rounded", ratio: frame.ratio, maxZoom: frame.maxZoom } });
  const r = frameRegions(asset, frame.ratio, crop);
  const x0 = band.x ?? 0;
  const x1 = x0 + (band.w ?? 1);
  let cost = 0;
  const add = (b: { x: number; y: number; w: number; h: number }, weight: number) => {
    const area = b.w * b.h;
    if (area <= 0) return;
    cost += (weight * overlap(x0, x1, b.x, b.x + b.w) * overlap(band.y, band.y + band.h, b.y, b.y + b.h)) / area;
  };
  for (const b of r.heads) add(b, 3);
  for (const b of r.hands) add(b, 1);
  if (asset.subjectKind === "product") add(r.subject, 1);
  return cost;
}

/** Does a band (a chip's footprint, frame fractions) leave every face, hand and product clear? */
export function bandClear(asset: ResolvedAsset | null | undefined, ratio: number, band: Band, shape: FrameShape = "rounded"): boolean {
  return coverOf(asset, { ratio, shape, maxZoom: 1 }, band) < 0.04;
}

/**
 * The calmest place for a full-width chip of height `h` (frame fraction) over a fitted photo:
 * the bottom edge when it covers no face and no hands, else the top edge when that is clear, else
 * `null` (the chip belongs beside the photo, not on it).
 */
export function chipBand(asset: ResolvedAsset | null | undefined, ratio: number, h: number, shape: FrameShape = "rounded"): "top" | "bottom" | null {
  const frame = { ratio, shape, maxZoom: 1 } as const;
  if (coverOf(asset, frame, { y: 1 - h, h }) < 0.04) return "bottom";
  if (coverOf(asset, frame, { y: 0, h }) < 0.04) return "top";
  return null;
}

/**
 * Frames whose shape the layout decides at run time (a bento tile whose rows grow with their
 * content, a window that fills a column): the crop is precomputed for a ladder of aspect ratios and
 * the frame — a size container — picks the step matching its real shape in CSS:
 *
 *   .frame { container: lp-fit / size }
 *   .frame .lp-pic__img { object-position: var(--fit-0); scale: var(--fiz-0); transform-origin: var(--fit-0) }
 *   @container lp-fit (aspect-ratio >= 139/200) { … var(--fit-1) … }  …one rule per FIT_STEPS boundary
 *
 * Each step is the exact subject-aware fit (heads and hands never sliced, a product's top kept,
 * a zoom when a person cannot otherwise be framed without cutting a hand).
 */
export const FIT_STEPS = [0.62, 0.78, 0.95, 1.18, 1.45, 1.85, 2.5] as const;

export function fitSteps(asset: ResolvedAsset | null | undefined, shape: FrameShape = "rounded"): Record<string, string | number> | undefined {
  if (!asset || asset.alpha) return undefined;
  const subject = cropSubjectOf(asset);
  const out: Record<string, string | number> = {};
  FIT_STEPS.forEach((ratio, k) => {
    const c = fitFrame(subject, { shape, ratio });
    out[`--fit-${k}`] = percentPair(c.x, c.y);
    if (c.zoom > 1.005) out[`--fiz-${k}`] = Math.round(c.zoom * 1000) / 1000;
  });
  return out;
}
