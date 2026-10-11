/**
 * Pictograms — a consistent set of clean line icons (48 grid, one stroke weight, round caps and
 * joins) used as small crisp vector stickers in collages and review cards. Exact geometry only.
 */
import type { ReactElement } from "react";
import { clamp, PathBuilder, polar, rnd, smoothD, TAU, type Pt } from "./core/geom";
import { createRng, type Seed } from "./core/rng";
import { SvgRoot, type IllBase } from "./core/svg";
import { sparkD } from "./glyphs";

export type PictogramKind =
  | "heart"
  | "smile"
  | "sun"
  | "cloud"
  | "leaf"
  | "star"
  | "bolt"
  | "drop"
  | "arrowLoop"
  | "underline"
  | "spiral"
  | "flower"
  | "crown"
  | "sparkle"
  | "check";

export const PICTOGRAM_KINDS: readonly PictogramKind[] = [
  "heart",
  "smile",
  "sun",
  "cloud",
  "leaf",
  "star",
  "bolt",
  "drop",
  "arrowLoop",
  "underline",
  "spiral",
  "flower",
  "crown",
  "sparkle",
  "check",
];

/** Upper intersection of two circles (cloud outline). */
function meet(a: Pt, ra: number, b: Pt, rb: number): Pt {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (d * d - rb * rb + ra * ra) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - x * x));
  const ux = (b[0] - a[0]) / d;
  const uy = (b[1] - a[1]) / d;
  const m: Pt = [a[0] + ux * x, a[1] + uy * x];
  const p1: Pt = [m[0] - uy * h, m[1] + ux * h];
  const p2: Pt = [m[0] + uy * h, m[1] - ux * h];
  return p1[1] < p2[1] ? p1 : p2;
}

/** Clockwise arc on circle (c, r) from point a to point b (large-arc flag from the real span). */
function cwArc(P: PathBuilder, c: Pt, r: number, a: Pt, b: Pt): void {
  const span = (((Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0])) % TAU) + TAU) % TAU;
  P.A(r, r, span > Math.PI ? 1 : 0, 1, b[0], b[1]);
}

/** Strokes of one pictogram; `stage` 2 strokes draw after stage 1 (heads, details). */
function strokes(kind: PictogramKind): { d: string; stage?: number }[] {
  switch (kind) {
    case "heart":
      return [{ d: "M24 39C13 31.5 7 25.5 7 18C7 12.6 11 9 15.6 9C19.2 9 22.2 11.1 24 14.4C25.8 11.1 28.8 9 32.4 9C37 9 41 12.6 41 18C41 25.5 35 31.5 24 39Z" }];
    case "smile":
      return [
        { d: "M24 7a17 17 0 1 1 0 34a17 17 0 1 1 0-34Z" },
        { d: "M17 27.5Q24 34 31 27.5", stage: 2 },
        { d: "M18.5 19.5v1.2M29.5 19.5v1.2", stage: 2 },
      ];
    case "sun": {
      const P = new PathBuilder({ p: 2 });
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        const p0 = polar(24, 24, 13.5, a);
        const p1 = polar(24, 24, 18.5, a);
        P.M(p0[0], p0[1]).L(p1[0], p1[1]);
      }
      return [{ d: "M24 16a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z" }, { d: P.toString(), stage: 2 }];
    }
    case "cloud": {
      const c1: Pt = [15.5, 28.5];
      const c2: Pt = [24, 20.5];
      const c3: Pt = [33, 27];
      const m1 = meet(c1, 6.5, c2, 10);
      const m2 = meet(c2, 10, c3, 8);
      const P = new PathBuilder({ p: 2 }).M(15.5, 35);
      cwArc(P, c1, 6.5, [15.5, 35], m1);
      cwArc(P, c2, 10, m1, m2);
      cwArc(P, c3, 8, m2, [33, 35]);
      return [{ d: P.Z().toString() }];
    }
    case "leaf":
      return [{ d: "M11 37C11 22 22 11 38 10C38 26 27 37 11 37Z" }, { d: "M8 40L29 19", stage: 2 }];
    case "star": {
      const pts: Pt[] = [];
      for (let k = 0; k < 10; k++) pts.push(polar(24, 25.5, k % 2 ? 7.6 : 17, -Math.PI / 2 + (k * Math.PI) / 5));
      const P = new PathBuilder({ p: 2 });
      pts.forEach((p, i) => (i ? P.L(p[0], p[1]) : P.M(p[0], p[1])));
      return [{ d: P.Z().toString() }];
    }
    case "bolt":
      return [{ d: "M27.5 6L11.5 27.5H22.5L20.5 42L36.5 20.5H25.5Z" }];
    case "drop":
      return [{ d: "M24 7C24 7 12 20.5 12 29A12 12 0 0 0 36 29C36 20.5 24 7 24 7Z" }, { d: "M18.5 29.5A6 6 0 0 0 23 34.6", stage: 2 }];
    case "arrowLoop":
      return [{ d: "M8 36C13 20 25 12.5 39 13.5" }, { d: "M32.6 8.8L39 13.5L33.4 19.2", stage: 2 }];
    case "underline":
      return [{ d: "M7 31C17 38.5 30 37 41 21" }];
    case "spiral": {
      const pts: Pt[] = [];
      for (let i = 0; i <= 64; i++) {
        const th = (i / 64) * 2.6 * TAU;
        const r = 1.2 + (16.5 * th) / (2.6 * TAU);
        pts.push(polar(24, 24, r, th - Math.PI / 2));
      }
      return [{ d: smoothD(pts, false, 2) }];
    }
    case "flower": {
      const P = new PathBuilder({ p: 2 });
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        const b = polar(24, 24, 4.5, a);
        const tip = polar(24, 24, 18.5, a);
        const l = polar(24, 24, 15, a - 0.42);
        const r = polar(24, 24, 15, a + 0.42);
        P.M(b[0], b[1]).Q(l[0], l[1], tip[0], tip[1]).Q(r[0], r[1], b[0], b[1]);
      }
      return [{ d: P.toString() }, { d: "M24 21.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6Z", stage: 2 }];
    }
    case "crown":
      return [{ d: "M9 34L11 15L18.5 23.5L24 11L29.5 23.5L37 15L39 34Z" }, { d: "M10 40H38", stage: 2 }];
    case "sparkle":
      return [{ d: sparkD(24, 24, 18, 16, 0.18, 2) }];
    default:
      return [{ d: "M10 25L19 34L38 14" }];
  }
}

export interface PictogramProps extends IllBase {
  /** omit to let the seed choose (from `pool` or every kind) */
  kind?: PictogramKind;
  pool?: readonly PictogramKind[];
  seed?: Seed;
  /** stroke in viewBox units (48 grid; default 2.4) */
  weight?: number;
}

export function pickPictogram(seed: Seed, pool: readonly PictogramKind[] = PICTOGRAM_KINDS): PictogramKind {
  const list = pool.length ? pool : PICTOGRAM_KINDS;
  return createRng(seed, "pictogram").pick(list);
}

/** One clean line icon; draws on with `reveal` (outline first, details second). */
export function Pictogram({ kind, pool, seed = 1, weight = 2.4, tone = "accent", ...base }: PictogramProps): ReactElement {
  const k = kind ?? pickPictogram(seed, pool);
  const w = rnd(clamp(weight, 1, 5), 2);
  return (
    <SvgRoot vb="0 0 48 48" kind="pictogram" tone={tone} data={{ k }} {...base}>
      <g fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
        {strokes(k).map((s, i) => (
          <path key={i} d={s.d} pathLength={1} className="lp-draw" data-d={s.stage ?? 1} />
        ))}
      </g>
    </SvgRoot>
  );
}
