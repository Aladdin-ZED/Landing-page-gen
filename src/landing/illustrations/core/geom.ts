/**
 * Geometry + compact SVG path serialization.
 * Coordinates are rounded (1 decimal by default) to keep markup small; "-0" never appears.
 */
export type Pt = readonly [number, number];

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Clamp to [lo, hi]; NaN (e.g. a bad numeric prop) falls back to `lo` so markup never carries "NaN". */
export const clamp = (v: number, lo: number, hi: number): number => (v > hi ? hi : v >= lo ? v : lo);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Round to `p` decimals (default 1). Never returns -0. */
export function rnd(v: number, p = 1): number {
  const f = p === 1 ? 10 : 10 ** p;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
}

/** Compact number for path data: rounded, no leading zero (".5", "-.5"). */
export function fmt(v: number, p = 1): string {
  const r = rnd(v, p);
  if (r === 0) return "0";
  const s = String(r);
  if (s.startsWith("0.")) return s.slice(1);
  if (s.startsWith("-0.")) return `-${s.slice(2)}`;
  return s;
}

/** Join path numbers; a space is only needed when the next number is not negative. */
export function join(values: readonly number[], p = 1): string {
  let out = "";
  for (let i = 0; i < values.length; i++) {
    const s = fmt(values[i] as number, p);
    out += i === 0 || s.startsWith("-") ? s : ` ${s}`;
  }
  return out;
}

/**
 * Small path builder with optional scale/translate (used to emit the same shape in user units
 * and in objectBoundingBox units for clip paths).
 */
export class PathBuilder {
  private d = "";
  private readonly p: number;
  private readonly sx: number;
  private readonly sy: number;
  private readonly tx: number;
  private readonly ty: number;

  constructor(opts: { p?: number; sx?: number; sy?: number; tx?: number; ty?: number } = {}) {
    this.p = opts.p ?? 1;
    this.sx = opts.sx ?? 1;
    this.sy = opts.sy ?? 1;
    this.tx = opts.tx ?? 0;
    this.ty = opts.ty ?? 0;
  }
  private X(x: number) {
    return (x + this.tx) * this.sx;
  }
  private Y(y: number) {
    return (y + this.ty) * this.sy;
  }
  M(x: number, y: number) {
    this.d += `M${join([this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  L(x: number, y: number) {
    this.d += `L${join([this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  H(x: number) {
    this.d += `H${fmt(this.X(x), this.p)}`;
    return this;
  }
  V(y: number) {
    this.d += `V${fmt(this.Y(y), this.p)}`;
    return this;
  }
  C(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.d += `C${join([this.X(x1), this.Y(y1), this.X(x2), this.Y(y2), this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  /** Smooth cubic (first control point = reflection of the previous one). */
  S(x2: number, y2: number, x: number, y: number) {
    this.d += `S${join([this.X(x2), this.Y(y2), this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  Q(x1: number, y1: number, x: number, y: number) {
    this.d += `Q${join([this.X(x1), this.Y(y1), this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  /** Elliptical arc. Radii are scaled per axis, so x-axis-rotation must stay 0 when sx ≠ sy. */
  A(rx: number, ry: number, large: 0 | 1, sweep: 0 | 1, x: number, y: number) {
    this.d += `A${join([rx * this.sx, ry * this.sy], this.p)} 0 ${large} ${sweep} ${join([this.X(x), this.Y(y)], this.p)}`;
    return this;
  }
  Z() {
    this.d += "Z";
    return this;
  }
  toString() {
    return this.d;
  }
}

/** Straight polyline / polygon. */
export function polyD(pts: readonly Pt[], closed = false, p = 1): string {
  let s = "";
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i] as Pt;
    s += `${i === 0 ? "M" : "L"}${join([q[0], q[1]], p)}`;
  }
  return closed && pts.length > 2 ? `${s}Z` : s;
}

/**
 * Smooth curve through points: uniform Catmull-Rom converted to cubic Béziers.
 * Catmull-Rom is C1, so every segment after the first uses the "S" shorthand (smaller markup).
 */
export function smoothD(pts: readonly Pt[], closed = false, p = 1): string {
  const n = pts.length;
  if (n < 3) return polyD(pts, closed, p);
  const at = (i: number): Pt => (closed ? (pts[((i % n) + n) % n] as Pt) : (pts[clamp(i, 0, n - 1)] as Pt));
  const first = pts[0] as Pt;
  let s = `M${join([first[0], first[1]], p)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    if (i === 0) {
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      s += `C${join([c1x, c1y, c2x, c2y, p2[0], p2[1]], p)}`;
    } else {
      s += `S${join([c2x, c2y, p2[0], p2[1]], p)}`;
    }
  }
  return closed ? `${s}Z` : s;
}

/** Dense points along the Catmull-Rom curve through `pts` (same curve smoothD draws). */
export function smoothPts(pts: readonly Pt[], closed = false, perSeg = 8): Pt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const at = (i: number): Pt => (closed ? (pts[((i % n) + n) % n] as Pt) : (pts[clamp(i, 0, n - 1)] as Pt));
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    for (let k = 0; k < perSeg; k++) out.push(cubicAt(p1, c1, c2, p2, k / perSeg));
  }
  if (!closed) out.push(pts[n - 1] as Pt);
  return out;
}

export function polyLength(pts: readonly Pt[], closed = false): number {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1] as Pt, pts[i] as Pt);
  if (closed && pts.length > 1) l += dist(pts[pts.length - 1] as Pt, pts[0] as Pt);
  return l;
}

/** Evenly spaced points along a polyline (both ends kept for open lines). */
export function resample(pts: readonly Pt[], step: number, closed = false): Pt[] {
  if (pts.length < 2) return pts.slice();
  const src: Pt[] = closed ? [...pts, pts[0] as Pt] : pts.slice();
  const cum: number[] = [0];
  for (let i = 1; i < src.length; i++) cum.push((cum[i - 1] as number) + dist(src[i - 1] as Pt, src[i] as Pt));
  const total = cum[cum.length - 1] as number;
  if (total === 0) return [src[0] as Pt];
  const m = Math.max(closed ? 3 : 1, Math.round(total / Math.max(0.5, step)));
  const count = closed ? m : m + 1;
  const out: Pt[] = [];
  let seg = 1;
  for (let j = 0; j < count; j++) {
    const d = (total * j) / m;
    while (seg < src.length - 1 && (cum[seg] as number) < d) seg++;
    const a = src[seg - 1] as Pt;
    const b = src[seg] as Pt;
    const sl = (cum[seg] as number) - (cum[seg - 1] as number);
    const t = sl > 0 ? (d - (cum[seg - 1] as number)) / sl : 0;
    out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
  }
  return out;
}

/** Unit normals (left-hand side of travel in y-down screen space is -y for +x travel). */
export function normals(pts: readonly Pt[], closed = false): Pt[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = (closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)]) as Pt;
    const b = (closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)]) as Pt;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l] as Pt;
  });
}

export function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

export function sampleCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, count: number): Pt[] {
  const out: Pt[] = [];
  const n = Math.max(2, Math.round(count));
  for (let i = 0; i <= n; i++) out.push(cubicAt(p0, p1, p2, p3, i / n));
  return out;
}

export function polar(cx: number, cy: number, r: number, a: number): Pt {
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/** Points on an ellipse from angle a0 to a1 (radians, y-down so positive = clockwise). */
export function ellipsePts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, count: number): Pt[] {
  const out: Pt[] = [];
  const n = Math.max(2, Math.round(count));
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** Regular star polygon: n tips at radius R, n notches at radius r. First tip points up (rot = 0). */
export function starPts(cx: number, cy: number, R: number, r: number, n: number, rot = 0): Pt[] {
  const out: Pt[] = [];
  for (let k = 0; k < n * 2; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / n;
    out.push(polar(cx, cy, k % 2 === 0 ? R : r, a));
  }
  return out;
}

export function rotatePt(p: Pt, c: Pt, a: number): Pt {
  const s = Math.sin(a);
  const co = Math.cos(a);
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  return [c[0] + x * co - y * s, c[1] + x * s + y * co];
}

export const angleOf = (from: Pt, to: Pt): number => Math.atan2(to[1] - from[1], to[0] - from[0]);

/** Intersection of segments ab and cd → [point, t along ab] or null. */
export function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): [Pt, number] | null {
  const r: Pt = [b[0] - a[0], b[1] - a[1]];
  const s: Pt = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [[a[0] + r[0] * t, a[1] + r[1] * t], t];
}

/**
 * Mitchell's best-candidate scatter: well-spread, organic-looking positions inside a box.
 * `keepOut` (absolute rect) stays empty so decorations can frame content.
 */
export function scatter(
  next: () => number,
  count: number,
  w: number,
  h: number,
  opts: { margin?: number; keepOut?: { x: number; y: number; w: number; h: number } | null; candidates?: number } = {},
): Pt[] {
  const m = opts.margin ?? 0;
  const ko = opts.keepOut ?? null;
  const k = opts.candidates ?? 12;
  const out: Pt[] = [];
  const inside = (p: Pt) => ko !== null && p[0] > ko.x && p[0] < ko.x + ko.w && p[1] > ko.y && p[1] < ko.y + ko.h;
  for (let i = 0; i < count; i++) {
    let best: Pt | null = null;
    let bestD = -1;
    for (let c = 0; c < k * 3 && (best === null || c < k); c++) {
      const p: Pt = [m + next() * Math.max(1, w - 2 * m), m + next() * Math.max(1, h - 2 * m)];
      if (inside(p)) continue;
      let dmin = Infinity;
      for (const q of out) dmin = Math.min(dmin, dist(p, q));
      if (dmin > bestD) {
        bestD = dmin;
        best = p;
      }
    }
    if (best) out.push(best);
  }
  return out;
}
