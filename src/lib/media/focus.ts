/**
 * Subject-aware cropping — the isomorphic half (no Node APIs, no DOM): the focus data stored per
 * asset, its validation, and the frame fitter used by the renderer (Picture, ProductStage) in every
 * delivery mode (server publish/export, admin preview in the browser, QA scripts).
 *
 * The analysis that produces the data runs at upload (./focus-analyze.ts, server only):
 *
 *   AssetFocus = {
 *     v      algorithm version (FOCUS_VERSION) — rows with an older v are recomputed by the backfill
 *     kind   "person" | "product" | "cutout" | "scene"
 *     x, y   focal point (0..1 of the image): eyes level for people, just above the middle of a product
 *     box    subject box {x, y, w, h} (0..1): the person / product, props and empty backdrop excluded
 *     keep   regions a frame edge must never slice: heads (always inside), hands (inside or fully out),
 *            items (a product, kept whole when possible)
 *     foot   cutouts: x-span of the footprint, where the product meets the floor
 *     conf   0..1, how clearly the subject separated from its background
 *   }
 *
 * Frame fitting (fitFrame): given the frame's aspect ratio and mask, choose the object-position (and,
 * within limits, a zoom) so the subject stays inside the mask's safe area — an arch loses the top
 * corners, a circle all four, a rounded rect almost nothing — heads never touch an edge, hands are
 * never cut in half, headroom is balanced, a product sits on the optical centre.
 *
 * Coordinates: image space is 0..1 on both axes. A `cover` frame shows a window of the image of size
 * (vw, vh) = (F/A, 1) or (1, A/F) (A = image w/h, F = frame w/h), divided by the zoom. CSS
 * object-position p (as a fraction) puts the window at start = p · (1 − v); with transform-origin at
 * the same fraction a zoom z keeps that relation (start = p · (1 − v/z)), so one pair of fractions
 * describes position and zoom anchor alike — and the un-zoomed window always CONTAINS the zoomed one
 * (an engine that ignores the zoom still shows everything the zoomed crop shows).
 */

export const FOCUS_VERSION = 1;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FocusKind = "person" | "product" | "cutout" | "scene";
export type KeepKind = "head" | "hand" | "item";

export interface KeepRegion {
  k: KeepKind;
  b: Box;
}

export interface AssetFocus {
  v: number;
  kind: FocusKind;
  x: number;
  y: number;
  box: Box;
  keep?: KeepRegion[];
  foot?: [number, number];
  conf: number;
}

export const FULL_BOX: Box = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });

const FOCUS_KINDS: readonly FocusKind[] = ["person", "product", "cutout", "scene"];
const KEEP_KINDS: readonly KeepKind[] = ["head", "hand", "item"];

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** A finite box clipped to the image (null when empty or malformed). */
export function cleanBox(v: unknown): Box | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const x = num(o.x);
  const y = num(o.y);
  const w = num(o.w);
  const h = num(o.h);
  if (x === null || y === null || w === null || h === null) return null;
  const x0 = clamp01(x);
  const y0 = clamp01(y);
  const x1 = clamp01(x + w);
  const y1 = clamp01(y + h);
  if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return null;
  return { x: r3(x0), y: r3(y0), w: r3(x1 - x0), h: r3(y1 - y0) };
}

/**
 * Validate focus data read from the database, admin JSON or a fixture (never trust a JSON column):
 * clamps every number to 0..1, drops malformed regions, caps their count. Null when unusable.
 */
export function parseFocus(v: unknown): AssetFocus | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const ver = num(o.v);
  const x = num(o.x);
  const y = num(o.y);
  const box = cleanBox(o.box);
  if (ver === null || x === null || y === null || !box) return null;
  const kind = FOCUS_KINDS.includes(o.kind as FocusKind) ? (o.kind as FocusKind) : "product";
  const keep: KeepRegion[] = [];
  if (Array.isArray(o.keep)) {
    for (const k of o.keep.slice(0, 12)) {
      if (!k || typeof k !== "object") continue;
      const kk = (k as Record<string, unknown>).k;
      const b = cleanBox((k as Record<string, unknown>).b);
      if (b && KEEP_KINDS.includes(kk as KeepKind)) keep.push({ k: kk as KeepKind, b });
    }
  }
  let foot: [number, number] | undefined;
  if (Array.isArray(o.foot) && o.foot.length === 2) {
    const a = num(o.foot[0]);
    const b = num(o.foot[1]);
    if (a !== null && b !== null && b > a) foot = [r3(clamp01(a)), r3(clamp01(b))];
  }
  const conf = num(o.conf);
  return {
    v: Math.round(ver),
    kind,
    x: r3(clamp01(x)),
    y: r3(clamp01(y)),
    box,
    ...(keep.length ? { keep } : {}),
    ...(foot ? { foot } : {}),
    conf: conf === null ? 0.5 : r3(clamp01(conf)),
  };
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

/** Mask geometry of a frame (base.css §11 masks, ProductStage photo windows). */
export type FrameShape = "rect" | "rounded" | "arch" | "circle" | "pill" | "blob";

/** Named frames sections can pass to <Picture frame="…">. */
export type FrameName = FrameShape | "square" | "portrait" | "landscape" | "tall" | "wide" | "thumb";

export interface FrameSpec {
  shape: FrameShape;
  /** visible box width / height; unknown → a position that suits the usual ratios */
  ratio?: number;
  /** thumbnails: frame the subject tightly (a product fills the box, a person becomes a bust) */
  tight?: boolean;
  /** zoom ceiling (≥ 1); default 1.18, tight 1.7 */
  maxZoom?: number;
}

export const FRAME_SHAPES: readonly FrameShape[] = ["rect", "rounded", "arch", "circle", "pill", "blob"];

export const FRAME_PRESETS: Readonly<Record<FrameName, FrameSpec>> = {
  rect: { shape: "rect" },
  rounded: { shape: "rounded" },
  arch: { shape: "arch" },
  circle: { shape: "circle", ratio: 1 },
  pill: { shape: "pill" },
  blob: { shape: "blob" },
  square: { shape: "rounded", ratio: 1 },
  portrait: { shape: "rounded", ratio: 4 / 5 },
  landscape: { shape: "rounded", ratio: 16 / 10 },
  tall: { shape: "rounded", ratio: 9 / 16 },
  wide: { shape: "rounded", ratio: 21 / 9 },
  thumb: { shape: "rounded", ratio: 1, tight: true },
};

/** "4/5", "4 / 5", 0.8, "1.5" → 0.8 / 1.5 (width / height); invalid or absurd → undefined. */
export function parseRatio(v: string | number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined;
  let r: number;
  if (typeof v === "number") r = v;
  else {
    const m = /^\s*(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?)\s*)?$/.exec(v);
    if (!m) return undefined;
    r = m[2] === undefined ? Number(m[1]) : Number(m[1]) / Number(m[2]);
  }
  return Number.isFinite(r) && r >= 0.2 && r <= 5 ? r : undefined;
}

/* ------------------------------------------------------------------ */
/* The fitter                                                          */
/* ------------------------------------------------------------------ */

/** What the fitter needs to know about an image (ResolvedAsset carries all of it). */
export interface CropSubject {
  /** intrinsic width / height */
  aspect: number;
  focal: { x: number; y: number };
  subject: Box;
  keep: readonly KeepRegion[];
  /** "none": nothing analysed — the fitter keeps the classic centred crop */
  kind: FocusKind | "none";
  /** the focal point was set by the merchant (AssetRef fx/fy): centre on it, nothing else */
  fixed?: boolean;
}

/** A crop: object-position (and zoom anchor) as fractions, and the zoom (1 = plain cover). */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export const CENTER_CROP: Crop = Object.freeze({ x: 0.5, y: 0.5, zoom: 1 });

/** Classic object-position of a focal point ("50% 40%"), the fallback when no frame is known. */
export const percentPair = (x: number, y: number) => `${pct(x)} ${pct(y)}`;
export const pct = (v: number) => `${Math.round(clamp01(v) * 1000) / 10}%`;

function windowSize(A: number, F: number, z: number): [number, number] {
  // cover: the image is scaled to cover the frame; the frame shows this much of it
  const vw = A > F ? F / A : 1;
  const vh = A > F ? 1 : A / F;
  return [vw / z, vh / z];
}

/**
 * Is a point of the frame (X in 0..F, Y in 0..1 — frame units where the height is 1) inside the
 * mask, at least `m` away from its edge?
 */
function inShape(shape: FrameShape, F: number, X: number, Y: number, m: number): boolean {
  if (X < m || X > F - m || Y < m || Y > 1 - m) return false;
  switch (shape) {
    case "rect":
      return true;
    case "rounded": {
      // corner radius ≈ --lp-radius-media (24–40px on a 300–600px frame)
      const r = 0.075 * Math.min(F, 1);
      const cx = Math.min(Math.max(X, m + r), F - m - r);
      const cy = Math.min(Math.max(Y, m + r), 1 - m - r);
      const dx = X - cx;
      const dy = Y - cy;
      return dx * dx + dy * dy <= r * r;
    }
    case "arch": {
      // a true half-circle top (radius = half the width), rounded feet negligible
      const rx = F / 2;
      const ry = Math.min(F / 2, 1);
      if (Y >= ry) return true;
      const dx = (X - rx) / Math.max(1e-6, rx - m);
      const dy = (Y - ry) / Math.max(1e-6, ry - m);
      return dx * dx + dy * dy <= 1;
    }
    case "circle": {
      const r = Math.min(F, 1) / 2 - m;
      const dx = X - F / 2;
      const dy = Y - 0.5;
      return dx * dx + dy * dy <= r * r;
    }
    case "pill": {
      if (F <= 1) {
        const r = F / 2;
        const cy = Y < r ? r : Y > 1 - r ? 1 - r : Y;
        const dx = X - r;
        const dy = Y - cy;
        return dx * dx + dy * dy <= (r - m) * (r - m);
      }
      const r = 0.5;
      const cx = X < r ? r : X > F - r ? F - r : X;
      const dx = X - cx;
      const dy = Y - r;
      return dx * dx + dy * dy <= (r - m) * (r - m);
    }
    case "blob": {
      // seeded organic radii (38–62 %): roughly an ellipse a little inside the box
      const rx = (F / 2) * 0.92 - m;
      const ry = 0.46 - m;
      const dx = (X - F / 2) / rx;
      const dy = (Y - 0.5) / ry;
      return dx * dx + dy * dy <= 1;
    }
  }
}

interface View {
  shape: FrameShape;
  F: number;
  X0: number;
  Y0: number;
  vw: number;
  vh: number;
}

/**
 * Share of a box (image coords) inside the mask. `edges`: sample on the box outline and interior
 * including the corners (keep regions — a corner out counts); otherwise cell centres (coverage).
 * `rowWeight` weighs rows from the top (people: the upper body matters more than the legs).
 */
function visible(v: View, b: Box, n: number, m: number, edges: boolean, rowWeight = 0): number {
  let inside = 0;
  let total = 0;
  for (let j = 0; j < n; j++) {
    const fy = edges ? j / (n - 1) : (j + 0.5) / n;
    const Y = (b.y + fy * b.h - v.Y0) / v.vh;
    const w = rowWeight ? 1 + rowWeight * (0.5 - fy) * 2 : 1;
    for (let i = 0; i < n; i++) {
      const fx = edges ? i / (n - 1) : (i + 0.5) / n;
      const X = ((b.x + fx * b.w - v.X0) / v.vw) * v.F;
      total += w;
      if (inShape(v.shape, v.F, X, Y, m)) inside += w;
    }
  }
  return total ? inside / total : 0;
}

const RING = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)] as const);

/**
 * Share of the ellipse inscribed in a box that is inside the mask (outline at 16 angles + an inner
 * ring + centre) — heads and hands are round: the corners of their box (a veil's drape, the air
 * between fingers) may meet a curved mask, the head itself may not.
 */
function visibleRound(v: View, b: Box, m: number): number {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  let inside = 0;
  let total = 0;
  const test = (ix: number, iy: number, w: number) => {
    total += w;
    if (inShape(v.shape, v.F, ((ix - v.X0) / v.vw) * v.F, (iy - v.Y0) / v.vh, m)) inside += w;
  };
  test(cx, cy, 1);
  for (const [c, s] of RING) {
    test(cx + (c * b.w) / 2, cy + (s * b.h) / 2, 1);
    test(cx + (c * b.w) / 4, cy + (s * b.h) / 4, 0.5);
  }
  return inside / total;
}

/** What a head left fully out of the frame costs (every head term at its maximum). */
const HEAD_OUT = 900 + 220 + 160 + 40;

/**
 * The face inside a head region. The analyser grows a head box from the skin up through the veil or
 * hair (0.2–0.95 face heights), out by 28 % of the face width on each side and down by 0.1 face
 * heights, so the face is the middle of the box down to ~0.95 of its height: an edge that only takes
 * the crown or a veil's drape leaves this core whole, one that takes an eye, a cheek or the chin
 * does not.
 */
function faceCore(b: Box): Box {
  return { x: b.x + b.w * 0.2, y: b.y + b.h * 0.28, w: b.w * 0.6, h: b.h * 0.67 };
}

/** cropCost options: `tight` = thumbnail framing, `zoomable` = the zoom terms count. */
export interface FitOptions {
  tight: boolean;
  zoomable: boolean;
}

/** The subject a tight frame wraps: the product itself, or a person's head-and-shoulders bust. */
function tightBox(s: CropSubject): Box {
  const heads = s.keep.filter((k) => k.k === "head").map((k) => k.b);
  if (s.kind !== "person" || !heads.length) return s.subject;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const h of heads) {
    x0 = Math.min(x0, h.x - h.w * 0.3);
    x1 = Math.max(x1, h.x + h.w * 1.3);
    y0 = Math.min(y0, h.y);
    y1 = Math.max(y1, h.y + h.h * 1.7);
  }
  x0 = Math.max(x0, s.subject.x);
  x1 = Math.min(x1, s.subject.x + s.subject.w);
  y1 = Math.min(y1, s.subject.y + s.subject.h);
  return { x: clamp01(x0), y: clamp01(y0), w: Math.max(0.01, clamp01(x1) - clamp01(x0)), h: Math.max(0.01, clamp01(y1) - clamp01(y0)) };
}

/**
 * Cost of showing the window at object-position (px, py) and zoom z in a frame of mask `shape` and
 * aspect F — lower is better. The fitter's objective, exported for diagnostics and QA tools.
 */
export function cropCost(s: CropSubject, shape: FrameShape, F: number, px: number, py: number, z: number, o: FitOptions): number {
  return costParts(s, shape, F, px, py, z, o).cost;
}

/** cropCost, plus the share of it that comes from faces sliced while another face is whole. */
function costParts(s: CropSubject, shape: FrameShape, F: number, px: number, py: number, z: number, o: FitOptions): { cost: number; slice: number } {
  const [vw, vh] = windowSize(s.aspect, F, z);
  const v: View = { shape, F, X0: px * (1 - vw), Y0: py * (1 - vh), vw, vh };
  const unit = Math.min(F, 1);
  const person = s.kind === "person";
  const subject = o.tight ? tightBox(s) : s.subject;
  let c = 0;

  // heads first: whether one face is shown whole changes what slicing another one costs
  const heads: { seen: number; safe: number; face: number; top: number; cx: number }[] = [];
  for (const r of s.keep) {
    if (r.k !== "head") continue;
    heads.push({
      seen: visibleRound(v, r.b, 0),
      safe: visibleRound(v, r.b, 0.03 * unit),
      face: visibleRound(v, faceCore(r.b), 0),
      top: (r.b.y - v.Y0) / vh,
      cx: (r.b.x + r.b.w / 2 - v.X0) / vw,
    });
  }
  const facesWhole = heads.filter((h) => h.face >= 0.999).length;
  let slice = 0;
  // composition (headroom, centring) follows the faces the frame shows; a head deliberately left
  // out must not drag the window back towards it. Nothing shown → all heads (pull them in).
  const framed = heads.some((h) => h.face > 0.001) ? heads.filter((h) => h.face > 0.001) : heads;
  const headN = framed.length;
  const headTop = framed.reduce((m, h) => Math.min(m, h.top), Infinity);
  const headCx = framed.reduce((sum, h) => sum + h.cx, 0);
  for (const h of heads) {
    // actually cut (dominant) vs merely closer to the edge than the comfort margin — a veil that
    // touches the photo's own top edge can never get the margin, but must still never be cut
    let hc = 900 * (1 - h.seen) + (h.seen < 0.999 ? 220 : 0) + 160 * (1 - h.safe) + (h.safe < 0.999 ? 40 : 0);
    // a head partly in the frame, its face not whole, in a photo of several people: leaving this head
    // fully out (HEAD_OUT) must always be the cheaper choice. Worst, a face sliced by the edge: never
    // slice one face to save another, and show one face whole rather than two faces half. Then a
    // crown, a veil or a chin peeking in at the edge, the face itself out. (A lone head has no such
    // alternative: its ordinary cut cost already pulls it in.) A veil or crown that merely touches a
    // curved mask, the face itself whole, is neither.
    if (heads.length > 1 && h.seen > 0.001 && h.face < 0.999) {
      const partial =
        h.face > 0.001
          ? HEAD_OUT + 260 + 400 * (1 - h.face) + (facesWhole > 0 ? 0 : 120)
          : HEAD_OUT + 140 + 120 * h.seen;
      const cut = Math.max(hc, partial);
      slice += cut;
      hc = cut;
    }
    c += hc;
  }
  for (const r of s.keep) {
    if (r.k === "head") continue;
    if (r.k === "hand") {
      const f = visibleRound(v, r.b, 0.012 * unit);
      if (f > 0.001 && f < 0.999) c += 70 + 120 * Math.min(f, 1 - f);
      else if (f <= 0.001) c += o.tight ? 2 : 14;
    } else {
      const f = visible(v, r.b, 4, 0.02 * unit, true);
      if (f < 0.999) c += 30 + 70 * (1 - f);
    }
  }

  // how much of the subject the frame shows (people: the upper body weighs more; products: the cap,
  // the dropper, the label matter more than the stand they rest on)
  const product = s.kind === "product" || s.kind === "cutout";
  const shown = visible(v, subject, 8, 0.02 * unit, false, person ? 0.45 : product ? 0.35 : 0);
  c += 160 * (1 - shown);

  // subject box in frame units (unclipped)
  const u0 = (subject.x - v.X0) / vw;
  const u1 = (subject.x + subject.w - v.X0) / vw;
  const t0 = (subject.y - v.Y0) / vh;
  const t1 = (subject.y + subject.h - v.Y0) / vh;
  const fitsV = t0 >= -0.001 && t1 <= 1.001;

  if (person && headN) {
    const cu = 0.6 * (headCx / headN) + 0.4 * ((Math.max(0, u0) + Math.min(1, u1)) / 2);
    c += 220 * (cu - 0.5) * (cu - 0.5);
    // headroom: the curved masks already hold heads away from the top through the safe margin
    const want = shape === "arch" ? 0.1 : shape === "circle" || shape === "pill" || shape === "blob" ? 0.12 : 0.065;
    if (fitsV && !o.tight) {
      const mid = (Math.max(0, t0) + Math.min(1, t1)) / 2;
      c += 160 * (mid - 0.5) * (mid - 0.5);
    } else {
      const d = headTop - want;
      c += (d < 0 ? 1600 : 420) * d * d;
    }
  } else {
    // a product that cannot fit loses its base, never its top
    if (product && t0 < 0) c += 70 + 320 * Math.min(1, -t0);
    // a product rests on the optical centre (a touch above the geometric one)
    const cu = (Math.max(0, u0) + Math.min(1, u1)) / 2;
    const ct = (Math.max(0, t0) + Math.min(1, t1)) / 2;
    c += 240 * ((cu - 0.5) * (cu - 0.5) + (ct - 0.47) * (ct - 0.47));
    const fu = (s.focal.x - v.X0) / vw;
    const ft = (s.focal.y - v.Y0) / vh;
    c += 60 * ((fu - 0.5) * (fu - 0.5) + (ft - 0.47) * (ft - 0.47));
  }

  if (o.zoomable) {
    // a small subject in a big frame reads as an empty frame: fill it (tight: almost edge to edge)
    const occ = Math.max(subject.w / vw, subject.h / vh);
    const target = o.tight ? 0.86 : 0.66;
    if (occ < target) c += (o.tight ? 700 : 260) * ((target - occ) / target) ** 2;
    c += 40 * (z - 1) * (z - 1) + (person && !o.tight ? 30 * (z - 1) : 0);
  }
  return { cost: c, slice };
}

const ZOOMS = [1, 1.06, 1.12, 1.18, 1.25, 1.33, 1.42, 1.52, 1.62, 1.72, 1.85, 2];

/**
 * Best crop of `s` in a frame of mask `shape` and aspect `ratio` (width / height).
 * Merchant focal points (`s.fixed`) are centred as well as the frame allows, nothing else.
 * `fit: "contain"` never crops: the classic focal object-position, zoom 1.
 */
export function fitFrame(s: CropSubject, frame: FrameSpec & { ratio: number }, fit: "cover" | "contain" = "cover"): Crop {
  const A = s.aspect > 0 && Number.isFinite(s.aspect) ? s.aspect : 1;
  const F = frame.shape === "circle" ? 1 : frame.ratio;
  if (fit === "contain") return { x: clamp01(s.focal.x), y: clamp01(s.focal.y), zoom: 1 };
  if (s.kind === "none" && !s.fixed) return CENTER_CROP;
  if (s.fixed) {
    const [vw, vh] = windowSize(A, F, 1);
    const start = (f: number, v: number) => (v >= 0.999 ? 0.5 : clamp01((f - v / 2) / (1 - v)));
    return { x: r3(start(s.focal.x, vw)), y: r3(start(s.focal.y, vh)), zoom: 1 };
  }
  const tight = !!frame.tight;
  const maxZoom = Math.min(2, Math.max(1, frame.maxZoom ?? (tight ? 1.7 : 1.18)));
  const key = memoKey(s, frame.shape, F, tight, maxZoom);
  const hit = MEMO.get(key);
  if (hit) return hit;
  const o: FitOptions = { tight, zoomable: maxZoom > 1 };

  // a zoomed crop must stay good where the zoom is ignored (the un-zoomed window contains it): its
  // position is chosen for both views. At zoom 1 only one axis moves, so that half is cached per axis.
  const [vw1, vh1] = windowSize(A, F, 1);
  const plain = new Map<number, number>();
  // A face the plain window slices (while it shows another face whole) counts in full: an engine
  // that ignores the zoom shows exactly that slice.
  const plainCost = (px: number, py: number) => {
    const k = vw1 < 0.999 ? Math.round(px * 400) : vh1 < 0.999 ? Math.round(py * 400) : 0;
    let c = plain.get(k);
    if (c === undefined) {
      const p = costParts(s, frame.shape, F, px, py, 1, o);
      plain.set(k, (c = 0.35 * p.cost + 0.65 * p.slice));
    }
    return c;
  };
  const objective = (px: number, py: number, z: number) =>
    costParts(s, frame.shape, F, px, py, z, o).cost + (o.zoomable ? plainCost(px, py) : 0);

  let best = { x: 0.5, y: 0.5, zoom: 1, c: Infinity };
  for (const z of ZOOMS) {
    if (z > maxZoom + 1e-9) break;
    const [vw, vh] = windowSize(A, F, z);
    const freeX = vw < 0.999;
    const freeY = vh < 0.999;
    const steps = freeX && freeY ? 10 : 32;
    const xs = freeX ? grid(0, 1, steps) : [0.5];
    const ys = freeY ? grid(0, 1, steps) : [0.5];
    for (const px of xs)
      for (const py of ys) {
        const c = objective(px, py, z);
        if (c < best.c - 1e-9) best = { x: px, y: py, zoom: z, c };
      }
  }
  // refine around the winner (two passes, each a finer grid)
  for (const span of [1 / 10, 1 / 50]) {
    const [vw, vh] = windowSize(A, F, best.zoom);
    const xs = vw < 0.999 ? grid(best.x - span, best.x + span, 8) : [best.x];
    const ys = vh < 0.999 ? grid(best.y - span, best.y + span, 8) : [best.y];
    const z = best.zoom;
    for (const px of xs)
      for (const py of ys) {
        const c = objective(px, py, z);
        if (c < best.c - 1e-9) best = { x: px, y: py, zoom: z, c };
      }
  }
  const out: Crop = { x: r3(best.x), y: r3(best.y), zoom: best.zoom };
  remember(key, out);
  return out;
}

/* Same subject + same frame → same crop: a page shows one photo in several places, and the admin
   preview re-renders on every edit. Bounded, insertion-ordered (oldest out first). */
const MEMO = new Map<string, Crop>();
const MEMO_MAX = 600;
function remember(key: string, c: Crop): void {
  if (MEMO.size >= MEMO_MAX) MEMO.delete(MEMO.keys().next().value as string);
  MEMO.set(key, c);
}
function memoKey(s: CropSubject, shape: string, F: number | string, tight: boolean, maxZoom: number): string {
  const b = (x: Box) => `${x.x},${x.y},${x.w},${x.h}`;
  return `${shape}|${typeof F === "number" ? r3(F) : F}|${tight ? 1 : 0}|${maxZoom}|${r3(s.aspect)}|${s.kind}|${s.focal.x},${s.focal.y}|${b(s.subject)}|${s.keep.map((k) => k.k + b(k.b)).join(";")}`;
}

function grid(a: number, b: number, steps: number): number[] {
  const lo = clamp01(Math.min(a, b));
  const hi = clamp01(Math.max(a, b));
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push(lo + ((hi - lo) * i) / steps);
  return out;
}

/** Frames a section is likely to show an image in when it does not say (base masks × usual ratios). */
const USUAL_RATIOS = [9 / 16, 3 / 4, 4 / 5, 1, 5 / 4, 3 / 2, 16 / 10, 2, 2.4];

/**
 * One object-position that suits every likely frame (the frame is unknown: a section sizes the box
 * in CSS, often differently per breakpoint). Per axis, minimise the worst regret — how much worse
 * than its own best crop each candidate frame gets — over the frames that crop along that axis.
 * object-position fractions keep their meaning at any frame size, which is what makes this work.
 */
export function robustCrop(s: CropSubject, shapes: readonly FrameShape[] = ["rounded", "arch"], ratios: readonly number[] = USUAL_RATIOS): Crop {
  if (s.kind === "none" && !s.fixed) return CENTER_CROP;
  if (s.fixed) return { x: clamp01(s.focal.x), y: clamp01(s.focal.y), zoom: 1 };
  const A = s.aspect > 0 && Number.isFinite(s.aspect) ? s.aspect : 1;
  const key = memoKey(s, `robust:${shapes.join(",")}`, ratios.map(r3).join(","), false, 1);
  const hit = MEMO.get(key);
  if (hit) return hit;
  const o: FitOptions = { tight: false, zoomable: false };
  const frames: { shape: FrameShape; F: number }[] = [];
  for (const shape of shapes) {
    if (shape === "circle") frames.push({ shape, F: 1 });
    else for (const F of ratios) frames.push({ shape, F });
  }
  const solve = (axis: "x" | "y"): number => {
    const relevant = frames.filter((f) => {
      const [vw, vh] = windowSize(A, f.F, 1);
      return axis === "x" ? vw < 0.999 : vh < 0.999;
    });
    if (!relevant.length) return axis === "x" ? clamp01(s.focal.x) : clamp01(s.focal.y);
    const at = (f: { shape: FrameShape; F: number }, p: number) => cropCost(s, f.shape, f.F, axis === "x" ? p : 0.5, axis === "y" ? p : 0.5, 1, o);
    // each frame's own best (coarse, then refined) is the reference its regret is measured from
    const bests = relevant.map((f) => {
      let bp = 0.5;
      let bc = Infinity;
      for (const p of grid(0, 1, 25)) {
        const c = at(f, p);
        if (c < bc) [bc, bp] = [c, p];
      }
      for (const p of grid(bp - 0.04, bp + 0.04, 8)) bc = Math.min(bc, at(f, p));
      return bc;
    });
    // candidates: a coarse grid plus the neighbourhood of every frame's own optimum
    const ps = [...new Set([...grid(0, 1, 25), ...grid(0, 0.08, 8)].map(r3))].sort((p, q) => p - q);
    const table = relevant.map((f) => ps.map((p) => at(f, p)));
    // banners (2:1 and wider) and the rare blob count less: they must not cost a veil or a cap in
    // the everyday portrait, square and landscape frames
    const weight = relevant.map((f) => (Math.max(f.F, 1 / f.F) >= 1.9 ? 0.4 : 1) * (f.shape === "blob" ? 0.5 : 1));
    const scoreOf = (costs: readonly number[]) => {
      let worst = 0;
      let sum = 0;
      costs.forEach((c, f) => {
        const regret = (c - bests[f]!) * weight[f]!;
        worst = Math.max(worst, regret);
        sum += regret;
      });
      return worst + 0.15 * (sum / costs.length);
    };
    let bestP = 0.5;
    let bestScore = Infinity;
    ps.forEach((p, i) => {
      const score = scoreOf(table.map((row) => row[i]!));
      if (score < bestScore - 1e-9) [bestScore, bestP] = [score, p];
    });
    // settle between grid steps: a cap or a veil is often a hair away from the coarse optimum
    for (const p of grid(bestP - 0.04, bestP + 0.04, 16)) {
      const score = scoreOf(relevant.map((f) => at(f, p)));
      if (score < bestScore - 1e-9) [bestScore, bestP] = [score, p];
    }
    return bestP;
  };
  const out: Crop = { x: r3(solve("x")), y: r3(solve("y")), zoom: 1 };
  remember(key, out);
  return out;
}

/** The frame-free subject of an image that was never analysed (old rows, fixtures without data). */
export function plainSubject(aspect: number, focal?: { x: number; y: number }): CropSubject {
  return focal
    ? { aspect, focal, subject: FULL_BOX, keep: [], kind: "none", fixed: true }
    : { aspect, focal: { x: 0.5, y: 0.5 }, subject: FULL_BOX, keep: [], kind: "none" };
}

/**
 * Where an image point lands in a frame showing it with crop `c` (fractions of the frame; outside
 * 0..1 = cropped away) — for pins, callouts and chips placed over a fitted photo.
 */
export function framePointOf(aspect: number, frameRatio: number, c: Crop, x: number, y: number): [number, number] {
  const [vw, vh] = windowSize(aspect > 0 ? aspect : 1, frameRatio, c.zoom);
  return [(x - c.x * (1 - vw)) / vw, (y - c.y * (1 - vh)) / vh];
}
