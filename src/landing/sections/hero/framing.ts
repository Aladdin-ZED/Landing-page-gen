/**
 * Hero framing — the geometry behind every hero composition's crops and overlays, so a photo is
 * shown whole and nothing lands on a face:
 *
 *  - visualFacts(): what a visual needs (cutout / photo, a person, the frame aspect that shows its
 *    subject whole with a margin — a massage gun lying on its side needs a landscape window).
 *  - pageMaskShape(): the media mask the theme gives this archetype (arch, pill, rounded…).
 *  - headsClear(): are all heads inside a mask (arch head, blob, circle) once the photo is fitted?
 *  - stageCalloutTops(): vertical slots of the stage's glass callouts, clear of faces, hands and
 *    the product as the stage really shows it (the fitted zoom included).
 *  - collageChipSpots(): where the collage's glass chips go, clear of faces, hands and the sticker.
 *  - posterFlip(): whether the poster's badge and price tag swap sides to stay off faces / product.
 *
 * Pure functions of the resolved assets (subject analysis from the upload, src/lib/media/focus.ts),
 * read through the Picture helpers so overlays line up with the crop <Picture> really applies.
 */
import type { Box, FrameShape } from "@/lib/media/focus";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import { frameRegions, pictureCrop, stageCutoutBox, stagePhotoFrame, type FrameRegions } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";

/* ------------------------------------------------------------------ */
/* What a visual needs                                                 */
/* ------------------------------------------------------------------ */

export interface VisualFacts {
  kind: "cutout" | "photo" | "empty";
  /** a photo of people (heads were found): faces must stay clear of chips and curved mask edges */
  person: boolean;
  /** frame aspect (width / height) that shows the subject whole with a comfortable margin */
  need: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

export function visualFacts(asset: ResolvedAsset | null | undefined): VisualFacts {
  if (!asset) return { kind: "empty", person: false, need: 0.8 };
  const A = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  if (asset.alpha) return { kind: "cutout", person: false, need: A };
  const heads = (asset.keep ?? []).some((k) => k.k === "head");
  const person = asset.subjectKind === "person" && heads;
  const b = asset.subject ?? { x: 0, y: 0, w: 1, h: 1 };
  // people are framed tall whatever the photo (a standing figure); a product or a scene needs its
  // box plus a margin on each side (a little more across than down: products rest on a floor)
  const need = person ? Math.min(0.8, (b.w * A) / Math.max(0.05, b.h)) : (b.w * A * 1.14) / Math.min(1, Math.max(0.05, b.h * 1.06));
  return { kind: "photo", person, need: r4(clamp(need, 0.3, 3)) };
}

/** A frame aspect for a composition whose own shape is `base` (4:5…), widened up to `max` for a
    subject that would not fit it (never narrower than `base`). */
export function frameAspect(facts: VisualFacts, base: number, max: number): number {
  if (facts.kind !== "photo") return base;
  return r4(clamp(facts.need, base, Math.max(base, max)));
}

/** The media mask the theme draws for this archetype (html[data-mask]). */
export function pageMask(ctx: RenderContext): FrameShape {
  return ARCHETYPE_DEFS[ctx.archetype].mask;
}

/* ------------------------------------------------------------------ */
/* Mask geometry (mirrors src/lib/media/focus.ts inShape)              */
/* ------------------------------------------------------------------ */

/** Is a point of a frame (X in 0..F, Y in 0..1 — frame units, height = 1) inside the mask, `m` from its edge? */
function inMask(shape: FrameShape, F: number, X: number, Y: number, m: number): boolean {
  if (X < m || X > F - m || Y < m || Y > 1 - m) return false;
  switch (shape) {
    case "arch": {
      const rx = F / 2;
      const ry = Math.min(F / 2, 1);
      if (Y >= ry) return true;
      const dx = (X - rx) / Math.max(1e-6, rx - m);
      const dy = (Y - ry) / Math.max(1e-6, ry - m);
      return dx * dx + dy * dy <= 1;
    }
    case "circle": {
      const r = Math.min(F, 1) / 2 - m;
      return (X - F / 2) ** 2 + (Y - 0.5) ** 2 <= r * r;
    }
    case "blob": {
      const rx = (F / 2) * 0.92 - m;
      const ry = 0.46 - m;
      return ((X - F / 2) / rx) ** 2 + ((Y - 0.5) / ry) ** 2 <= 1;
    }
    case "pill": {
      const r = Math.min(F, 1) / 2;
      const cx = F <= 1 ? r : X < r ? r : X > F - r ? F - r : X;
      const cy = F <= 1 ? (Y < r ? r : Y > 1 - r ? 1 - r : Y) : 0.5;
      return (X - cx) ** 2 + (Y - cy) ** 2 <= (r - m) ** 2;
    }
    default:
      return true;
  }
}

const RING = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)] as const);

/**
 * The regions of a photo fitted into a frame of mask `shape` and aspect `ratio`, as <Picture frame>
 * crops it — once at the fitted zoom and once without it: Picture writes the zoom as --pic-zoom, which
 * only some engines / kit versions apply (the position alone is the un-zoomed view), so anything laid
 * over the photo must suit both views.
 */
export function fittedRegions(asset: ResolvedAsset, shape: FrameShape, ratio: number): FrameRegions[] {
  const F = shape === "circle" ? 1 : ratio;
  const crop = pictureCrop(asset, { frame: { shape, ratio: F } });
  const flat = frameRegions(asset, F, crop ? { ...crop, zoom: 1 } : crop);
  return crop && crop.zoom > 1.005 ? [flat, frameRegions(asset, F, crop)] : [flat];
}

/**
 * Every head stays inside the mask (its round outline, a small margin from the edge) once the photo
 * is fitted to that frame — false when the photo itself leaves no room (a head at the very top of a
 * wide photo under an arch or a blob).
 */
export function headsClear(asset: ResolvedAsset, shape: FrameShape, ratio: number): boolean {
  const F = shape === "circle" ? 1 : ratio;
  const heads = fittedRegions(asset, shape, F).flatMap((r) => r.heads);
  const m = 0.015 * Math.min(F, 1);
  for (const h of heads) {
    const cx = h.x + h.w / 2;
    const cy = h.y + h.h / 2;
    for (const [c, s] of RING) {
      if (!inMask(shape, F, (cx + (c * h.w) / 2) * F, cy + (s * h.h) / 2, m)) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Overlays that must stay off faces                                   */
/* ------------------------------------------------------------------ */

interface Obstacle {
  b: Box;
  w: number;
}

const area = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const grow = (b: Box, dx: number, dy: number): Box => ({ x: b.x - dx, y: b.y - dy, w: b.w + 2 * dx, h: b.h + 2 * dy });

/** Faces (a margin around each head) and hands, mapped from a frame into the box that holds it. */
function obstacles(regions: readonly FrameRegions[], into: Box): Obstacle[] {
  const map = (b: Box): Box => ({ x: into.x + b.x * into.w, y: into.y + b.y * into.h, w: b.w * into.w, h: b.h * into.h });
  return regions.flatMap((r) => [
    ...r.heads.map((b) => ({ b: grow(map(b), 0.035, 0.03), w: 100 })),
    ...r.hands.map((b) => ({ b: grow(map(b), 0.015, 0.015), w: 35 })),
  ]);
}

const cost = (zone: Box, obs: readonly Obstacle[]) => obs.reduce((c, o) => c + o.w * area(zone, o.b) / Math.max(1e-4, Math.min(zone.w * zone.h, o.b.w * o.b.h)), 0);

/** Rough glass-chip footprint from its text: width (fraction of `px`) and line count. */
function chipSize(chars: number, px: number, maxFrac: number, charPx: number, padPx: number): { w: number; lines: number } {
  const natural = chars * charPx + padPx;
  const maxPx = maxFrac * px;
  const w = Math.min(natural, maxPx);
  return { w: w / px, lines: Math.max(1, Math.ceil((chars * charPx) / Math.max(40, w - padPx))) };
}

const clip01 = (b: Box): Box | null => {
  const x0 = clamp(b.x, 0, 1);
  const y0 = clamp(b.y, 0, 1);
  const x1 = clamp(b.x + b.w, 0, 1);
  const y1 = clamp(b.y + b.h, 0, 1);
  return x1 - x0 > 0.01 && y1 - y0 > 0.01 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
};

/**
 * What the stage shows of a visual, in stage fractions (x of its width, y of its height): faces and
 * hands of a photo (both the fitted-zoom and the plain view), and the visible product — a product
 * photo's subject through the crop <Picture> really applies (zoom included), or a cutout contained
 * bottom-aligned in its box.
 */
function stageVisual(asset: ResolvedAsset, stage: string, R: number): { obs: Obstacle[]; product: Box | null } {
  if (asset.alpha) {
    const b = stageCutoutBox(stage);
    const A = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
    // stage units: height 1, width R; object-fit: contain, centred across, standing on the bottom edge
    const bw = b.w * R;
    const dw = Math.min(bw, b.h * A);
    const dh = dw / A;
    const x0 = b.x * R + (bw - dw) / 2;
    const y0 = b.y + b.h - dh;
    const s = asset.subject ?? { x: 0, y: 0, w: 1, h: 1 };
    const product = { x: (x0 + s.x * dw) / R, y: y0 + s.y * dh, w: (s.w * dw) / R, h: s.h * dh };
    return { obs: [], product };
  }
  const f = stagePhotoFrame(stage, R);
  const regions = fittedRegions(asset, f.shape, f.ratio);
  const into = f.box;
  const zoomed = regions[regions.length - 1]!;
  const vis = asset.subjectKind === "person" || asset.subjectKind === "none" ? null : clip01(zoomed.subject);
  const product = vis ? { x: into.x + vis.x * into.w, y: into.y + vis.y * into.h, w: vis.w * into.w, h: vis.h * into.h } : null;
  return { obs: obstacles(regions, into), product };
}

export interface CalloutText {
  title: string;
  detail: string;
}

/**
 * Vertical position (fraction of the stage height) of each stage callout, kept off faces, hands and
 * the product: the chip and its leader sweep a band beside the product (end-side chips on the end
 * edge, start-side chips on the start edge — both overhang the stage by 9%); each slot slides from
 * its default height to the nearest band that covers no face and the least of the product as the
 * stage shows it (a photo's fitted zoom included; the leader may reach onto it), same-side chips
 * never overlapping. Null when nothing needs avoiding (the default slots then stand).
 */
export function stageCalloutTops(
  ctx: RenderContext,
  asset: ResolvedAsset | null,
  stage: string,
  R: number,
  notes: readonly CalloutText[],
  sides: readonly ("start" | "end")[],
  defaults: readonly number[],
): number[] | null {
  if (!asset || !notes.length) return null;
  if (visualFacts(asset).kind === "empty") return null;
  const { obs, product } = stageVisual(asset, stage, R);
  if (!obs.length && !product) return null;
  const prodArea = product ? Math.max(1e-4, product.w * product.h) : 1;
  const rtl = ctx.dir === "rtl";
  // worst case of the two layouts: a 300px phone stage (chips ≤ 46%, titles only) and a 540px desktop
  // stage (chips ≤ 36%, details shown); the leader reaches ≈ 9.5% of the stage toward the product
  const layouts = [
    { px: 300, max: 0.46, details: false },
    { px: 540, max: 0.36, details: true },
  ];
  const lead = 0.095;
  const out: number[] = [];
  const placed: { right: boolean; y0: number; y1: number }[] = [];
  notes.forEach((n, k) => {
    const right = (sides[k] === "end") !== rtl;
    const zones = layouts.map((l) => {
      const t = chipSize([...n.title].length, l.px, l.max, 6.9, 26);
      const d = l.details && n.detail.trim() ? chipSize([...n.detail].length, l.px, l.max, 6.2, 26) : null;
      const w = Math.max(t.w, d?.w ?? 0);
      const hPx = 18 + 16.5 * t.lines + (d ? 15.5 * d.lines + 2 : 0);
      const h = hPx / (l.px / R);
      const x = right ? 1.09 - w - lead : -0.09;
      // the chip alone (its leader is meant to land on the product)
      const cx = right ? 1.09 - w : -0.09;
      return { x, w: w + lead, cx, cw: w, h };
    });
    const h = Math.max(...zones.map((z) => z.h));
    const def = defaults[k] ?? 0.5;
    let best = def;
    let bestCost = Infinity;
    for (let t = 0.02; t <= 0.98 - h + 1e-9; t += 0.01) {
      let c = 0;
      for (const z of zones) {
        c += cost({ x: z.x, y: t, w: z.w, h }, obs);
        // each percent of the visible product under the chip weighs like half a stage-height move
        if (product) c += (0.75 * 100 * area({ x: z.cx, y: t, w: z.cw, h }, product)) / prodArea;
      }
      for (const p of placed) if (p.right === right && t < p.y1 + 0.035 && t + h > p.y0 - 0.035) c += 500;
      c += 1.5 * Math.abs(t - def);
      if (c < bestCost - 1e-9) [best, bestCost] = [t, c];
    }
    out.push(Math.round(best * 1000) / 10);
    placed.push({ right, y0: best, y1: best + h });
  });
  return out;
}

export interface CollageCard {
  asset: ResolvedAsset | null;
  /** card box in the collage, logical (x from the inline start), fractions of width / height */
  box: Box;
  ratio: number;
}

export interface ChipSpot {
  side: "start" | "end";
  /** fraction of the collage height */
  top: number;
}

/**
 * Collage glass chips placed off every visible face and hand (and off the savings sticker and each
 * other), starting from their default spots. Null when no card shows people.
 */
export function collageChipSpots(
  ctx: RenderContext,
  cards: readonly CollageCard[],
  notes: readonly CalloutText[],
  defaults: readonly ChipSpot[],
  sticker: Box | null,
  collageRatio: number,
): ChipSpot[] | null {
  const rtl = ctx.dir === "rtl";
  const phys = (b: Box): Box => (rtl ? { ...b, x: 1 - b.x - b.w } : b);
  const obs: Obstacle[] = [];
  for (const c of cards) {
    if (!c.asset) continue;
    const f = visualFacts(c.asset);
    if (f.kind !== "photo" || !f.person) continue;
    obs.push(...obstacles(fittedRegions(c.asset, "rounded", c.ratio), phys(c.box)));
  }
  if (!obs.length || !notes.length) return null;
  if (sticker) obs.push({ b: grow(phys(sticker), 0.02, 0.02), w: 60 });
  // a 358px phone collage: chips ≤ 52% wide; titles and details at 0.76rem
  const px = 358;
  const out: ChipSpot[] = [];
  const taken: Obstacle[] = [];
  notes.forEach((n, k) => {
    const t = chipSize([...n.title].length, px, 0.52, 7, 30);
    const d = n.detail.trim() ? chipSize([...n.detail].length, px, 0.52, 6.3, 30) : null;
    const w = Math.max(t.w, d?.w ?? 0);
    const h = (20 + 16.5 * t.lines + (d ? 15.5 * d.lines + 2 : 0)) / (px / collageRatio);
    const def = defaults[k] ?? { side: "end", top: 0.5 };
    let best = def;
    let bestCost = Infinity;
    let bestZone: Box | null = null;
    for (const side of ["start", "end"] as const) {
      const right = (side === "end") !== rtl;
      const x = right ? 1 - (side === "end" ? 0.04 : 0) - w : side === "start" ? 0 : 0.04;
      for (let top = 0.02; top <= 0.98 - h + 1e-9; top += 0.01) {
        const zone = { x, y: top, w, h };
        let c = cost(zone, obs) + cost(zone, taken);
        c += 1.2 * Math.abs(top - def.top) + (side === def.side ? 0 : 0.35);
        if (c < bestCost - 1e-9) [best, bestCost, bestZone] = [{ side, top }, c, zone];
      }
    }
    out.push({ side: best.side, top: Math.round(best.top * 1000) / 10 });
    if (bestZone) taken.push({ b: grow(bestZone, 0.02, 0.02), w: 400 });
  });
  return out;
}

/**
 * The poster's badge (top end corner of the print) and price tag (bottom start corner) cover the
 * fewest faces, hands — and the least of the product — in their usual corners or mirrored. True
 * when the mirrored pair is clearly better.
 */
export function posterFlip(ctx: RenderContext, asset: ResolvedAsset | null, ratio: number): boolean {
  if (!asset || asset.alpha) return false;
  const f = visualFacts(asset);
  if (f.kind !== "photo") return false;
  const regions = fittedRegions(asset, "rounded", ratio);
  const obs: Obstacle[] = [
    ...obstacles(regions, { x: 0, y: 0, w: 1, h: 1 }),
    // the product itself (products only): a tag over it hides what is sold
    ...(f.person ? [] : regions.map((r) => ({ b: r.subject, w: 8 }))),
  ];
  const rtl = ctx.dir === "rtl";
  // phone geometry, fractions of the print: tag ≈ 50% × 21% hanging off its start corner, badge a
  // disc ≈ 35% wide hanging off its end corner
  const tagAt = (left: boolean): Box => (left ? { x: -0.14, y: 0.855, w: 0.49, h: 0.215 } : { x: 0.65, y: 0.855, w: 0.49, h: 0.215 });
  const badgeAt = (left: boolean): Box => (left ? { x: -0.19, y: -0.06, w: 0.35, h: 0.28 } : { x: 0.85, y: -0.06, w: 0.35, h: 0.28 });
  const pair = (mirrored: boolean) => {
    const tagLeft = !rtl !== mirrored; // the tag sits on the start side
    return cost(tagAt(tagLeft), obs) + cost(badgeAt(!tagLeft), obs);
  };
  return pair(true) + 2 < pair(false);
}
