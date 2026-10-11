/**
 * Leaf — minimal single-weight botanical line icons (field, apothecary, souk olive, bloom).
 * Exact geometry: every leaf is the same almond construction (two mirrored cubics), stems are
 * smooth cubics; a seed only nudges angles and lengths a few percent so repeated icons feel alive
 * without ever looking sketched. Stem draws first, then leaves, then buds/fruit pop.
 */
import type { ReactElement } from "react";
import { clamp, cubicAt, PathBuilder, polar, rnd, TAU, type Pt } from "./core/geom";
import { createRng, type Rng, type Seed } from "./core/rng";
import { SvgRoot, type IllBase, type Tone } from "./core/svg";

/** single leaf · sprigs (64×96): sprig olive round fern lavender wild · blooms (64×64): flower daisy */
export type LeafVariant = "leaf" | "sprig" | "olive" | "round" | "fern" | "lavender" | "wild" | "flower" | "daisy";

export interface LeafProps extends IllBase {
  seed?: Seed;
  variant?: LeafVariant;
  /** stroke in viewBox units (box is 64 wide; default 1.6) */
  weight?: number;
  /** buds, olives and flower centres (default: same as tone) */
  tone2?: Tone;
}

/** Almond leaf from `base` along angle `a` (radians), with an optional midrib. */
function almond(base: Pt, a: number, len: number, width: number, rib: boolean): string {
  const u: Pt = [Math.cos(a), Math.sin(a)];
  const n: Pt = [-u[1], u[0]];
  const at = (t: number, k: number): [number, number] => [base[0] + u[0] * len * t + n[0] * width * k, base[1] + u[1] * len * t + n[1] * width * k];
  const tip = at(1, 0);
  const P = new PathBuilder({ p: 2 })
    .M(base[0], base[1])
    .C(...at(0.18, 1), ...at(0.62, 0.92), ...tip)
    .C(...at(0.62, -0.92), ...at(0.18, -1), base[0], base[1])
    .Z();
  if (rib) P.M(base[0], base[1]).L(...at(0.7, 0));
  return P.toString();
}

interface Stem {
  p0: Pt;
  c1: Pt;
  c2: Pt;
  p3: Pt;
}

const stemD = (s: Stem): string => new PathBuilder({ p: 2 }).M(s.p0[0], s.p0[1]).C(s.c1[0], s.c1[1], s.c2[0], s.c2[1], s.p3[0], s.p3[1]).toString();

/** Point and tangent angle on the stem at t. */
function onStem(s: Stem, t: number): [Pt, number] {
  const p = cubicAt(s.p0, s.c1, s.c2, s.p3, t);
  const q = cubicAt(s.p0, s.c1, s.c2, s.p3, Math.min(1, t + 0.01));
  const r = cubicAt(s.p0, s.c1, s.c2, s.p3, Math.max(0, t - 0.01));
  return [p, Math.atan2(q[1] - r[1], q[0] - r[0])];
}

const DEG = Math.PI / 180;

interface Parts {
  stems: string[];
  leaves: string[];
  buds: ReactElement[];
}

function sprigParts(variant: LeafVariant, rng: Rng): Parts {
  const v = (x: number, amt = 0.06) => x * (1 + rng.jitter(amt));
  const tilt = () => rng.jitter(4) * DEG;
  const stem: Stem = { p0: [30, 93], c1: [27, 66], c2: [38, 38], p3: [32, 7] };
  const parts: Parts = { stems: [stemD(stem)], leaves: [], buds: [] };
  const side0 = rng.sign();
  const leafAt = (t: number, side: number, ang: number, len: number, wk: number, rib = true) => {
    const [p, a] = onStem(stem, t);
    parts.leaves.push(almond(p, a + side * ang * DEG + tilt(), v(len), v(len * wk), rib));
  };
  if (variant === "olive") {
    [0.24, 0.4, 0.56, 0.72, 0.86].forEach((t, i) => leafAt(t, i % 2 ? -side0 : side0, 36, 27 - i * 2.4, 0.2, false));
    leafAt(1, 0, 0, 13, 0.22, false);
    [0.47, 0.64].forEach((t, i) => {
      const [p, a] = onStem(stem, t);
      const dir = a + (i % 2 ? side0 : -side0) * 62 * DEG;
      const end = polar(p[0], p[1], 6, dir);
      const c = polar(p[0], p[1], 12, dir);
      parts.stems.push(new PathBuilder({ p: 2 }).M(p[0], p[1]).L(end[0], end[1]).toString());
      parts.buds.push(<ellipse key={`o${i}`} cx={rnd(c[0], 2)} cy={rnd(c[1], 2)} rx={4.4} ry={6.2} transform={`rotate(${rnd(dir / DEG - 90, 1)} ${rnd(c[0], 2)} ${rnd(c[1], 2)})`} />);
    });
  } else if (variant === "round") {
    [0.2, 0.42, 0.62, 0.8].forEach((t, i) => {
      const len = 15 - i * 1.6;
      leafAt(t, 1, 72, len, 0.62, false);
      leafAt(t, -1, 72, len, 0.62, false);
    });
    leafAt(1, 0, 0, 9, 0.6, false);
  } else if (variant === "fern") {
    for (let i = 0; i < 8; i++) {
      const t = 0.12 + i * 0.105;
      const len = 15 - i * 1.3;
      leafAt(t, 1, 62, len, 0.3, false);
      leafAt(t, -1, 62, len, 0.3, false);
    }
    leafAt(1, 0, 0, 6, 0.32, false);
  } else if (variant === "lavender") {
    stem.c1 = [31, 66];
    stem.c2 = [33, 38];
    parts.stems[0] = stemD(stem);
    [-1, 1].forEach((s) => leafAt(0.06, s, 16, 30, 0.13, false));
    for (let i = 0; i < 7; i++) {
      const t = 0.56 + i * 0.065;
      const [p, a] = onStem(stem, t);
      [-1, 1].forEach((s) => parts.buds.push(<path key={`b${i}${s}`} d={almond(p, a + s * 30 * DEG, 7.5 - i * 0.4, 2.6, false)} />));
    }
    const [tip, ta] = onStem(stem, 1);
    parts.buds.push(<path key="bt" d={almond(tip, ta, 6, 2.4, false)} />);
  } else if (variant === "wild") {
    const [bp, ba] = onStem(stem, 0.46);
    const bend = polar(bp[0], bp[1], 16, ba - side0 * 34 * DEG);
    const bEnd = polar(bend[0], bend[1], 10, ba - side0 * 8 * DEG);
    parts.stems.push(new PathBuilder({ p: 2 }).M(bp[0], bp[1]).Q(bend[0], bend[1], bEnd[0], bEnd[1]).toString());
    leafAt(0.24, side0, 52, 22, 0.32);
    leafAt(0.66, -side0, 48, 17, 0.32);
    const tip = stem.p3;
    parts.buds.push(<circle key="t" cx={tip[0]} cy={rnd(tip[1] - 3.4, 2)} r={4} />);
    parts.buds.push(<circle key="b" cx={rnd(bEnd[0], 2)} cy={rnd(bEnd[1], 2)} r={2.8} />);
  } else {
    [0.22, 0.38, 0.54, 0.7, 0.84].forEach((t, i) => leafAt(t, i % 2 ? -side0 : side0, 50, 24 - i * 2.3, 0.34));
    leafAt(1, 0, 0, 12, 0.34);
  }
  return parts;
}

function bloomParts(variant: "flower" | "daisy" | "leaf", rng: Rng): Parts {
  const parts: Parts = { stems: [], leaves: [], buds: [] };
  const rot = rng.range(0, TAU);
  if (variant === "leaf") {
    parts.stems.push("M8 57L15 50");
    parts.leaves.push(almond([15, 50], -45 * DEG + rng.jitter(3) * DEG, 46, 14, true));
    return parts;
  }
  const n = variant === "flower" ? 5 : 12;
  const r0 = variant === "flower" ? 5.5 : 7;
  for (let i = 0; i < n; i++) {
    const a = rot + (i * TAU) / n;
    const base = polar(32, 32, r0, a);
    parts.leaves.push(variant === "flower" ? almond(base, a, 22, 10, false) : almond(base, a, 20, 3.4, false));
  }
  parts.buds.push(<circle key="c" cx={32} cy={32} r={variant === "flower" ? 4.2 : 5.4} />);
  return parts;
}

/** Minimal line botanical; draws on (stem → leaves → buds) with `reveal`. */
export function Leaf({ seed = 1, variant = "sprig", weight = 1.6, tone = "accent", tone2, ...base }: LeafProps): ReactElement {
  const rng = createRng(seed, `leaf:${variant}`);
  const bloom = variant === "flower" || variant === "daisy" || variant === "leaf";
  const parts = bloom ? bloomParts(variant, rng) : sprigParts(variant, rng);
  const w = rnd(clamp(weight, 0.6, 4), 2);
  return (
    <SvgRoot vb={bloom ? "0 0 64 64" : "0 0 64 96"} kind="leaf" tone={tone} tone2={tone2} data={{ v: variant }} {...base}>
      <g fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
        {parts.stems.map((d, i) => (
          <path key={`s${i}`} d={d} pathLength={1} className="lp-draw" data-d={1} />
        ))}
        {parts.leaves.map((d, i) => (
          <path key={`l${i}`} d={d} pathLength={1} className="lp-draw" data-d={bloom ? 1 : 2} />
        ))}
        {parts.buds.length ? (
          <g className={tone2 ? "i-s2 lp-draw-pop" : "lp-draw-pop"} data-d={3}>
            {parts.buds}
          </g>
        ) : null}
      </g>
    </SvgRoot>
  );
}
