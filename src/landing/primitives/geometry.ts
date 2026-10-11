/**
 * Tiny path-building helpers for the hand-drawn decorations, glyphs and star shapes.
 * Output strings are compact (2 decimals max) and fully deterministic.
 */
export type Pt = readonly [number, number];

/** Format a coordinate: max 2 decimals, no trailing zeros, no "-0". */
export function f(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) || r === 0 ? "0" : String(r);
}

export const pt = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

/** Points of a regular star / polygon around (cx, cy). `n` tips alternate outer/inner radius. */
export function starPoints(n: number, cx: number, cy: number, outer: number, inner: number, rotDeg = -90): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rotDeg + (i * 180) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

export function polygonPath(pts: readonly Pt[]): string {
  return `M${pts.map(pt).join("L")}Z`;
}

/**
 * Closed polygon with rounded corners: each vertex is replaced by a quadratic curve that
 * starts/ends `radius(i)` units along the adjacent edges (clamped to half the edge length).
 */
export function roundedPolygonPath(pts: readonly Pt[], radius: (i: number) => number): string {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const prev = pts[(i - 1 + n) % n]!;
    const next = pts[(i + 1) % n]!;
    const r = radius(i);
    const a = toward(p, prev, r);
    const b = toward(p, next, r);
    d += `${i === 0 ? "M" : "L"}${pt(a)}Q${pt(p)} ${pt(b)}`;
  }
  return d + "Z";
}

function toward(from: Pt, to: Pt, dist: number): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.min(dist / len, 0.5);
  return [from[0] + dx * t, from[1] + dy * t];
}

/** Smooth open curve through points (Catmull-Rom → cubic Bézier, tension 0.5). */
export function smoothPath(pts: readonly Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M${pt(pts[0]!)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d;
}

/** Smooth closed curve through points (periodic Catmull-Rom → cubic Bézier), e.g. organic blobs. */
export function smoothClosedPath(pts: readonly Pt[]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M${pt(pts[0]!)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!;
    const p1 = pts[i]!;
    const p2 = pts[(i + 1) % n]!;
    const p3 = pts[(i + 2) % n]!;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + "Z";
}

/** Translate every absolute coordinate pair of a path built only from M/L/Q/C/Z commands. */
export function translatePath(d: string, dx: number, dy: number): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${f(Number(x) + dx)} ${f(Number(y) + dy)}`);
}
