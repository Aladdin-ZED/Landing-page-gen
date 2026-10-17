import type { ReactElement } from "react";
import {
  CENTER_CROP,
  FRAME_PRESETS,
  FULL_BOX,
  fitFrame,
  framePointOf,
  parseRatio,
  percentPair,
  robustCrop,
  type Box,
  type Crop,
  type CropSubject,
  type FrameName,
  type FrameShape,
} from "@/lib/media/focus";
import type { CropBox } from "@/lib/page/schema";
import type { ResolvedAsset } from "../types";
import { cssVars, cx, safeHex, safePosition, safeRatio } from "./util";

/** Media masks (base.css): `page` = the theme's html[data-mask]; the others force one shape. */
export type MaskKind = "page" | "arch" | "circle" | "pill" | "rounded" | "blob";

/**
 * The frame a picture is shown in, for subject-aware cropping: a preset name
 * (`arch circle rounded pill blob rect square portrait landscape tall wide thumb`) or a spec.
 * `ratio` = visible box width / height ("4/5", 0.8); `tight` frames the subject closely (a product
 * fills the box, a person becomes a head-and-shoulders bust); `maxZoom` caps the zoom (1 = never).
 */
export type PictureFrame = FrameName | { shape?: FrameShape; ratio?: string | number; tight?: boolean; maxZoom?: number };

export interface PictureProps {
  asset: ResolvedAsset | null | undefined;
  /** the `sizes` attribute — always give a real layout hint, e.g. "(min-width: 64rem) 40vw, 92vw" */
  sizes: string;
  /** LCP image: eager + fetchpriority=high */
  priority?: boolean;
  /** class on the <picture> box */
  className?: string;
  /** clip the box to a modern mask (same as adding .lp-mask / .lp-mask-<kind> to className) */
  mask?: MaskKind;
  imgClassName?: string;
  /** override the asset alt ("" = decorative) */
  alt?: string;
  fit?: "cover" | "contain";
  /** box aspect ratio, e.g. "4/5" or 1 — also sizes the empty placeholder */
  ratio?: string | number;
  /** object-position override, e.g. "50% 30%" (wins over every crop computation) */
  position?: string;
  /**
   * art direction by hand: the object-position from `frameMin` up ("x% y%"). Below it the picture
   * keeps `position` (or its fitted crop, without zoom); pure CSS, no extra stylesheet.
   */
  positionLg?: string;
  /**
   * Subject-aware crop for the frame the picture is shown in: heads and hands never cut, a product's
   * top kept, balanced headroom, a small product zoomed to fill (within limits). Defaults: the
   * `mask` shape at `ratio`; small thumbnails (`sizes` ≤ 8rem with a `ratio`) frame tightly; anything
   * else uses the asset's subject-aware default position (fits every usual frame).
   */
  frame?: PictureFrame;
  /** art direction: the frame from `frameMin` up (e.g. landscape on desktop, portrait on phones) */
  frameLg?: PictureFrame;
  /** breakpoint of `frameLg` (rem or px, default "64rem") */
  frameMin?: string;
  /**
   * Crop of the photo (an item cut out of a group photo, AssetRef.box): the picture shows exactly that
   * region — at its own ratio, or cover-fitted to `ratio` — through object-position + --pic-zoom (the
   * fitted-crop path of base.css; no new image files). `fit="contain"` is ignored with a box: the
   * caller sizes the box to the crop's ratio instead (boxRatio).
   */
  box?: CropBox | null;
}

/**
 * Responsive image: <picture> with AVIF + WebP sources, intrinsic width/height (no CLS),
 * lazy by default, dominant-color placeholder behind the pixels. When the asset is missing,
 * renders a quiet placeholder block with an image glyph (never a broken image).
 *
 * Cropping writes custom properties only: `--pic-pos` (object-position; with `frameLg` a
 * viewport-switched value, so art direction needs no extra CSS), `--pic-org` (the same fractions as
 * the transform origin, so the zoom and any hover scale grow from the subject) and, for a fitted
 * zoom, `--pic-zoom` (+ the `lp-pic--zoom` class). base.css draws the zoom with the individual
 * `scale` property where supported; the position alone is already safe without it (the un-zoomed
 * window contains the zoomed one). A section scaling the image itself (hover) should multiply:
 * `scale: calc(var(--pic-zoom, 1) * 1.04)`.
 */
export function Picture({
  asset,
  sizes,
  priority = false,
  className,
  imgClassName,
  alt,
  fit = "cover",
  ratio,
  position,
  positionLg,
  mask,
  frame,
  frameLg,
  frameMin,
  box: crop0,
}: PictureProps): ReactElement {
  const box = cx(mask && (mask === "page" ? "lp-mask" : `lp-mask-${mask}`), className);
  if (!asset) return <EmptyPicture className={box} ratio={ratio} alt={alt} />;
  if (crop0) return <BoxPicture asset={asset} crop={crop0} sizes={sizes} priority={priority} className={box} imgClassName={imgClassName} alt={alt} ratio={ratio} />;
  const lgPos = fit === "contain" ? undefined : safePosition(positionLg);
  const crop = lgPos
    ? steppedPosition(asset, lgPos, { ratio, mask, frame, frameMin, sizes, position: safePosition(position) })
    : position
      ? null
      : pictureCropVars(asset, { fit, ratio, mask, frame, frameLg, frameMin, sizes });
  // a plain "x% y%" position doubles as the transform origin (a hover zoom grows from the subject)
  const plainPos = fit === "contain" || lgPos ? undefined : (safePosition(position) ?? (crop ? undefined : safePosition(asset.position)));
  const style = cssVars({
    "--ph": asset.alpha ? undefined : safeHex(asset.dominant),
    "--ratio": safeRatio(ratio),
    // --pic-pos, not --pos: the before/after runtime writes --pos on [data-compare] ancestors
    "--pic-pos": (lgPos ? crop?.pos : undefined) ?? safePosition(position) ?? crop?.pos ?? safePosition(asset.position),
    "--pic-zoom": crop?.zoom,
    "--pic-org": plainPos ?? crop?.org,
  });
  const imgSizes = crop?.zoom ? scaleSizes(sizes, crop.zoom) : sizes;
  return (
    <picture
      className={cx("lp-pic", fit === "contain" && "lp-pic--contain", asset.alpha && "lp-pic--alpha", crop?.zoom && "lp-pic--zoom", box)}
      style={style}
    >
      {asset.srcsetAvif ? <source type="image/avif" srcSet={asset.srcsetAvif} sizes={imgSizes} /> : null}
      <source type="image/webp" srcSet={asset.srcsetWebp} sizes={imgSizes} />
      <img
        className={cx("lp-pic__img", imgClassName)}
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={alt ?? asset.alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? undefined : "async"}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

/** Width / height of a crop of `asset` (the intrinsic ratio of an item cut out of a group photo). */
export function boxRatio(asset: Pick<ResolvedAsset, "aspect" | "width" | "height">, crop: CropBox): number {
  const A = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  return (A * crop.w) / crop.h;
}

const pct = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10}%`;

/**
 * The window that shows exactly `crop` of the photo, cover-fitted to the frame ratio `R` (default:
 * the crop's own ratio): object-position + scale about the same fractions (base.css fitted crop).
 * In image fractions the frame shows the window (sx, sy, vw, vh); at zoom 1 a cover fit shows
 * (vw1, vh1), so zoom = vw1 / vw and the position fraction f = s / (1 − v) puts the window in place.
 */
export function boxCrop(asset: Pick<ResolvedAsset, "aspect" | "width" | "height">, crop: CropBox, R0?: number): { pos: string; zoom?: number; ratio: number } {
  const A = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  const r = (A * crop.w) / crop.h;
  const R = R0 && R0 > 0 ? R0 : r;
  let vw: number;
  let vh: number;
  let sx: number;
  let sy: number;
  if (r > R) {
    vh = crop.h;
    vw = (crop.h * R) / A;
    sx = crop.x + (crop.w - vw) / 2;
    sy = crop.y;
  } else {
    vw = crop.w;
    vh = (crop.w * A) / R;
    sx = crop.x;
    sy = crop.y + (crop.h - vh) / 2;
  }
  const vw1 = A > R ? R / A : 1;
  const zoom = vw1 / vw;
  const fx = vw < 0.999 ? sx / (1 - vw) : 0.5;
  const fy = vh < 0.999 ? sy / (1 - vh) : 0.5;
  return { pos: `${pct(fx)} ${pct(fy)}`, ...(zoom > 1.001 ? { zoom: Math.round(zoom * 1000) / 1000 } : {}), ratio: Math.round(R * 10000) / 10000 };
}

function BoxPicture({
  asset,
  crop,
  sizes,
  priority,
  className,
  imgClassName,
  alt,
  ratio,
}: {
  asset: ResolvedAsset;
  crop: CropBox;
  sizes: string;
  priority: boolean;
  className?: string;
  imgClassName?: string;
  alt?: string;
  ratio?: string | number;
}): ReactElement {
  const c = boxCrop(asset, crop, parseRatio(ratio));
  const style = cssVars({ "--ph": asset.alpha ? undefined : safeHex(asset.dominant), "--ratio": String(c.ratio), "--pic-pos": c.pos, "--pic-org": c.pos, "--pic-zoom": c.zoom });
  const imgSizes = c.zoom ? scaleSizes(sizes, c.zoom) : sizes;
  return (
    <picture className={cx("lp-pic lp-pic--box", asset.alpha && "lp-pic--alpha", c.zoom && "lp-pic--zoom", className)} style={style}>
      {asset.srcsetAvif ? <source type="image/avif" srcSet={asset.srcsetAvif} sizes={imgSizes} /> : null}
      <source type="image/webp" srcSet={asset.srcsetWebp} sizes={imgSizes} />
      <img
        className={cx("lp-pic__img", imgClassName)}
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={alt ?? asset.alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? undefined : "async"}
        fetchPriority={priority ? "high" : undefined}
      />
    </picture>
  );
}

function EmptyPicture({ className, ratio, alt }: { className?: string; ratio?: string | number; alt?: string }) {
  const label = alt?.trim();
  return (
    <span
      className={cx("lp-pic", "lp-pic--empty", className)}
      style={cssVars({ "--ratio": safeRatio(ratio) })}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <svg className="lp-pic__ph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M9 12.5h30a2 2 0 0 1 2 2v19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-19a2 2 0 0 1 2-2z" />
        <path d="M7.5 31l9.5-9 7 6.5 5-4.5 11.5 10" />
        <path d="M31.5 17.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Subject-aware cropping                                              */
/* ------------------------------------------------------------------ */

/** The crop subject of a resolved asset (tolerates hand-built assets without the crop fields). */
export function cropSubjectOf(asset: ResolvedAsset): CropSubject {
  const aspect = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  return {
    aspect,
    focal: asset.focal ?? { x: 0.5, y: 0.5 },
    subject: asset.subject ?? FULL_BOX,
    keep: asset.keep ?? [],
    kind: asset.subjectKind ?? "none",
    fixed: asset.focalSource === "merchant",
  };
}

const PAGE_SHAPES: readonly FrameShape[] = ["rounded", "arch", "circle", "pill", "blob"];
const MASK_SHAPES: ReadonlySet<string> = new Set(["arch", "circle", "pill", "rounded", "blob"]);
/** thumbnails at most this wide (CSS px) frame their subject tightly by default */
const THUMB_MAX_PX = 128;

interface ResolvedFrame {
  /** null: the theme's page mask (unknown here) */
  shape: FrameShape | null;
  ratio?: number;
  tight?: boolean;
  maxZoom?: number;
}

function resolveFrame(frame: PictureFrame | undefined, mask: MaskKind | undefined, ratio: string | number | undefined, sizes: string | undefined): ResolvedFrame | null {
  // the shape a `mask` prop forces: a mask kind, null for the theme's page mask, undefined for none
  const maskShape: FrameShape | null | undefined = mask === "page" ? null : mask && MASK_SHAPES.has(mask) ? (mask as FrameShape) : undefined;
  const boxRatio = parseRatio(ratio);
  const withRatio = (shape: FrameShape | null, r: number | undefined, extra: { tight?: boolean; maxZoom?: number } = {}): ResolvedFrame => ({
    shape,
    ratio: shape === "circle" ? 1 : r,
    ...extra,
  });
  if (typeof frame === "string") {
    const preset = FRAME_PRESETS[frame];
    if (!preset) return null;
    // a shape name sets the mask geometry; an aspect name (portrait, thumb…) keeps the mask prop's
    const isShape = frame === "rect" || MASK_SHAPES.has(frame);
    const shape = isShape ? preset.shape : maskShape !== undefined ? maskShape : preset.shape;
    return withRatio(shape, preset.ratio ?? boxRatio, { tight: preset.tight, maxZoom: preset.maxZoom });
  }
  if (frame) {
    const shape = frame.shape ?? (maskShape !== undefined ? maskShape : "rounded");
    return withRatio(shape, parseRatio(frame.ratio) ?? boxRatio, { tight: frame.tight, maxZoom: frame.maxZoom });
  }
  if (maskShape) return withRatio(maskShape, boxRatio);
  if (maskShape === null) return boxRatio ? { shape: null, ratio: boxRatio } : null;
  // square thumbnails are often drawn as discs (sticky bar, avatars, timeline dots): a circle-safe
  // crop is safe in a rounded square too
  if (boxRatio && sizes && maxSizePx(sizes) <= THUMB_MAX_PX) return { shape: Math.abs(boxRatio - 1) < 0.02 ? "circle" : "rounded", ratio: boxRatio, tight: true };
  return null;
}

/** Visible share (0..1) of an image box in a frame of aspect F showing the image with crop c. */
function shownShare(s: CropSubject, F: number, c: Crop, b: Box): number {
  const [x0, y0] = framePointOf(s.aspect, F, c, b.x, b.y);
  const [x1, y1] = framePointOf(s.aspect, F, c, b.x + b.w, b.y + b.h);
  const area = Math.max(1e-6, (x1 - x0) * (y1 - y0));
  return (Math.max(0, Math.min(1, x1) - Math.max(0, x0)) * Math.max(0, Math.min(1, y1) - Math.max(0, y0))) / area;
}

/**
 * A fitted zoom never cuts what the plain (un-zoomed) window shows whole: a head, a hand or an item
 * keeps the share it has at zoom 1 — or leaves the frame entirely (a tight bust may drop the hands,
 * a second figure); a product's box (a cutout's or a product photo's subject) always keeps its
 * share. The zoom steps down until that holds (at worst back to 1 — the plain window, which the
 * fitter already made safe): products are never clipped, faces never sliced by a zoom.
 */
function guardZoom(s: CropSubject, F: number, c: Crop): Crop {
  if (c.zoom <= 1.005 || s.fixed || s.kind === "none") return c;
  const boxes: { b: Box; whole: boolean }[] = s.keep.map((k) => ({ b: k.b, whole: false }));
  if (s.kind === "product" || s.kind === "cutout") boxes.push({ b: s.subject, whole: true });
  if (!boxes.length) return c;
  const plain = { ...c, zoom: 1 };
  const base = boxes.map((r) => shownShare(s, F, plain, r.b));
  const ok = (z: number) =>
    boxes.every((r, i) => {
      const v = shownShare(s, F, { ...c, zoom: z }, r.b);
      return v >= base[i]! - 0.005 || (!r.whole && v <= 0.005);
    });
  for (let z = c.zoom; z > 1.005; z = Math.round((z - 0.02) * 1000) / 1000) if (ok(z)) return z === c.zoom ? c : { ...c, zoom: z };
  return plain;
}

function cropOf(subject: CropSubject, f: ResolvedFrame, maxZoom?: number): Crop {
  const mz = maxZoom ?? f.maxZoom;
  if (f.shape && f.ratio) return guardZoom(subject, f.ratio, fitFrame(subject, { shape: f.shape, ratio: f.ratio, tight: f.tight, maxZoom: mz }));
  if (f.shape) return robustCrop(subject, [f.shape]);
  if (f.ratio) return robustCrop(subject, PAGE_SHAPES, [f.ratio]);
  return CENTER_CROP;
}

/**
 * The crop <Picture> applies for these props (null = the asset's default position) — for overlays
 * (pins, chips, callouts) that must line up with the photo.
 */
export function pictureCrop(
  asset: ResolvedAsset,
  opts: { fit?: "cover" | "contain"; ratio?: string | number; mask?: MaskKind; frame?: PictureFrame; sizes?: string },
): Crop | null {
  if ((opts.fit ?? "cover") === "contain") return null;
  const f = resolveFrame(opts.frame, opts.mask, opts.ratio, opts.sizes);
  return f ? cropOf(cropSubjectOf(asset), f) : null;
}

const MIN_RE = /^\d{1,4}(?:\.\d{1,3})?(?:rem|px)$/;
const pctNum = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10;

/**
 * One axis of a viewport-switched object-position: `a` below `min`, `b` from `min` up, in pure CSS.
 * For `cover`, object-position percentages resolve against (box − image) ≤ 0, so a larger percentage
 * is a smaller length; clamp() then picks the right bound from the sign of (100vw − min).
 */
function stepAxis(a: number, b: number, min: string): string {
  const A = pctNum(a);
  const B = pctNum(b);
  if (Math.abs(A - B) < 0.5) return `${A}%`;
  return A >= B ? `clamp(${A}%, (100vw - ${min}) / 0.00001, ${B}%)` : `clamp(${B}%, (${min} - 100vw - 1px) / 0.00001, ${A}%)`;
}

/**
 * The same step for transform-origin, whose percentages resolve against the (positive) box size, so
 * a larger percentage is a larger length: the bounds swap relative to stepAxis.
 */
function stepOrigin(a: number, b: number, min: string): string {
  const A = pctNum(a);
  const B = pctNum(b);
  if (Math.abs(A - B) < 0.5) return `${A}%`;
  return A <= B ? `clamp(${A}%, (100vw - ${min} + 1px) / 0.00001, ${B}%)` : `clamp(${B}%, (${min} - 100vw) / 0.00001, ${A}%)`;
}

function pictureCropVars(
  asset: ResolvedAsset,
  p: { fit: "cover" | "contain"; ratio?: string | number; mask?: MaskKind; frame?: PictureFrame; frameLg?: PictureFrame; frameMin?: string; sizes: string },
): { pos: string; zoom?: number; org: string } | null {
  if (p.fit === "contain") return null;
  const base = resolveFrame(p.frame, p.mask, p.ratio, p.sizes);
  const lg = p.frameLg !== undefined ? resolveFrame(p.frameLg, p.mask, p.ratio, undefined) : null;
  if (!base && !lg) return null;
  const subject = cropSubjectOf(asset);
  if (lg) {
    // two frames: zoom stays 1 (a zoom cannot switch with the viewport in pure CSS)
    const a = base ? cropOf(subject, base, 1) : posCrop(asset.position);
    const b = cropOf(subject, lg, 1);
    const min = p.frameMin && MIN_RE.test(p.frameMin) ? p.frameMin : "64rem";
    return { pos: `${stepAxis(a.x, b.x, min)} ${stepAxis(a.y, b.y, min)}`, org: `${stepOrigin(a.x, b.x, min)} ${stepOrigin(a.y, b.y, min)}` };
  }
  const c = cropOf(subject, base!);
  const pos = percentPair(c.x, c.y);
  // the origin is written for every fitted crop: the zoom (and any scale a section adds on hover)
  // grows from the subject's anchor, exactly as the fitter modelled it
  return c.zoom > 1.005 ? { pos, zoom: Math.round(c.zoom * 1000) / 1000, org: pos } : { pos, org: pos };
}

/**
 * `positionLg`: below `frameMin` the explicit `position`, else the frame's fitted crop (zoom 1), else the
 * asset's default; from `frameMin` up the given position — both as viewport-switched clamp()s.
 */
function steppedPosition(
  asset: ResolvedAsset,
  lg: string,
  p: { ratio?: string | number; mask?: MaskKind; frame?: PictureFrame; frameMin?: string; sizes: string; position?: string },
): { pos: string; zoom?: number; org: string } {
  const f = p.position ? null : resolveFrame(p.frame, p.mask, p.ratio, p.sizes);
  const a = p.position ? posCrop(p.position) : f ? cropOf(cropSubjectOf(asset), f, 1) : posCrop(asset.position);
  const b = posCrop(lg);
  const min = p.frameMin && MIN_RE.test(p.frameMin) ? p.frameMin : "64rem";
  return { pos: `${stepAxis(a.x, b.x, min)} ${stepAxis(a.y, b.y, min)}`, org: `${stepOrigin(a.x, b.x, min)} ${stepOrigin(a.y, b.y, min)}` };
}

/** "50% 12.5%" → a crop (centre when unparsable). */
function posCrop(position: string): Crop {
  const m = /^\s*(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%\s*$/.exec(position);
  return m ? { x: Number(m[1]) / 100, y: Number(m[2]) / 100, zoom: 1 } : CENTER_CROP;
}

/** Largest rendered width a `sizes` attribute allows in CSS px; Infinity when it uses viewport units. */
function maxSizePx(sizes: string): number {
  let max = 0;
  for (const entry of splitTop(sizes)) {
    const len = lengthOf(entry);
    const m = /^(\d+(?:\.\d+)?)(px|rem|em)$/.exec(len);
    if (!m) return Infinity;
    max = Math.max(max, Number(m[1]) * (m[2] === "px" ? 1 : 16));
  }
  return max || Infinity;
}

/** Comma-separated entries at parenthesis depth 0. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The source-size value of one `sizes` entry (after its media condition). */
function lengthOf(entry: string): string {
  const e = entry.trim();
  if (e.endsWith(")")) {
    // a function value (calc/min/max/clamp): from its name to the end
    let depth = 0;
    for (let i = e.length - 1; i >= 0; i--) {
      if (e[i] === ")") depth++;
      else if (e[i] === "(" && --depth === 0) {
        const name = /([a-z-]+)$/i.exec(e.slice(0, i));
        return name ? e.slice(i - name[1]!.length) : e;
      }
    }
    return e;
  }
  const parts = e.split(/\s+/);
  return parts[parts.length - 1]!;
}

/** A zoomed picture needs proportionally more pixels: multiply every source size by the zoom. */
function scaleSizes(sizes: string, zoom: number): string {
  const z = Math.round(zoom * 1000) / 1000;
  const entries = splitTop(sizes);
  if (!entries.length) return sizes;
  return entries
    .map((entry) => {
      const len = lengthOf(entry);
      if (!len) return entry;
      return `${entry.slice(0, entry.length - len.length)}calc(${len} * ${z})`;
    })
    .join(", ");
}

/* ------------------------------------------------------------------ */
/* Overlays on fitted photos                                           */
/* ------------------------------------------------------------------ */

export interface FrameRegions {
  crop: Crop;
  /** heads in frame fractions (0..1, may exceed when cropped away) */
  heads: Box[];
  /** hands in frame fractions */
  hands: Box[];
  /** the subject box in frame fractions */
  subject: Box;
}

/**
 * Where the photo's heads, hands and subject land in a frame of aspect `frameRatio` showing it with
 * `crop` (default: the asset's own default position) — to place chips and callouts beside, never over, a face.
 */
export function frameRegions(asset: ResolvedAsset, frameRatio: number, crop?: Crop | null): FrameRegions {
  const s = cropSubjectOf(asset);
  const c = crop ?? posCrop(asset.position);
  const map = (b: Box): Box => {
    const [x0, y0] = framePointOf(s.aspect, frameRatio, c, b.x, b.y);
    const [x1, y1] = framePointOf(s.aspect, frameRatio, c, b.x + b.w, b.y + b.h);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
  return {
    crop: c,
    heads: s.keep.filter((k) => k.k === "head").map((k) => map(k.b)),
    hands: s.keep.filter((k) => k.k === "hand").map((k) => map(k.b)),
    subject: map(s.subject),
  };
}

export type Corner = { block: "start" | "end"; inline: "start" | "end" };

/**
 * The frame corner where a chip of `chip` size (fractions of the frame) covers the least of the
 * photo's heads and hands (then the subject) — in logical terms for the page direction. Ties keep
 * `prefer` (default: block end, inline end — under the subject's gaze line, out of the face).
 */
export function quietCorner(
  asset: ResolvedAsset | null | undefined,
  frameRatio: number,
  opts: { crop?: Crop | null; chip?: { w: number; h: number }; dir?: "ltr" | "rtl"; prefer?: Corner } = {},
): Corner {
  const prefer = opts.prefer ?? { block: "end", inline: "end" };
  if (!asset || asset.subjectKind === "none") return prefer;
  const r = frameRegions(asset, frameRatio, opts.crop);
  const chip = opts.chip ?? { w: 0.5, h: 0.2 };
  const rtl = opts.dir === "rtl";
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const corners: Corner[] = [prefer, ...(["end", "start"] as const).flatMap((block) => (["end", "start"] as const).map((inline) => ({ block, inline })))];
  let best = prefer;
  let bestCost = Infinity;
  for (const k of corners) {
    const left = (k.inline === "start") !== rtl;
    const top = k.block === "start";
    const zone: Box = { x: left ? 0 : 1 - chip.w, y: top ? 0 : 1 - chip.h, w: chip.w, h: chip.h };
    let cost = 0;
    for (const h of r.heads) cost += 100 * area(zone, h);
    for (const h of r.hands) cost += 30 * area(zone, h);
    cost += 2 * area(zone, r.subject);
    if (cost < bestCost - 1e-9) [best, bestCost] = [k, cost];
  }
  return best;
}
