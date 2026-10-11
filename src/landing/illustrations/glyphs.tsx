/**
 * Glyphs — a small set of crisp geometric marks (separators, list bullets, badge centers) and the
 * Sparkle accent. Pure vector geometry: no hand jitter, no ornament.
 */
import type { ReactElement } from "react";
import { PathBuilder, polar, polyD, rnd, starPts, TAU } from "./core/geom";
import { createRng, type Seed } from "./core/rng";
import { SvgRoot, type IllBase, type Tone } from "./core/svg";

export type GlyphKind = "dot" | "spark" | "diamond" | "star8" | "asterisk" | "check" | "heart" | "bolt" | "leaf" | "flower";

export const GLYPH_KINDS: readonly GlyphKind[] = ["dot", "spark", "diamond", "star8", "asterisk", "check", "heart", "bolt", "leaf", "flower"];

/** 4-point star with smooth concave sides (cubic), tips at ±rv / ±rh. `waist` = 0.1 slim … 0.4 plump. */
export function sparkD(cx: number, cy: number, rv: number, rh: number, waist = 0.16, p = 1): string {
  const wv = rv * waist;
  const wh = rh * waist;
  return new PathBuilder({ p })
    .M(cx, cy - rv)
    .C(cx + wh * 0.35, cy - wv * 1.6, cx + wh * 1.6, cy - wv * 0.35, cx + rh, cy)
    .C(cx + wh * 1.6, cy + wv * 0.35, cx + wh * 0.35, cy + wv * 1.6, cx, cy + rv)
    .C(cx - wh * 0.35, cy + wv * 1.6, cx - wh * 1.6, cy + wv * 0.35, cx - rh, cy)
    .C(cx - wh * 1.6, cy - wv * 0.35, cx - wh * 0.35, cy - wv * 1.6, cx, cy - rv)
    .Z()
    .toString();
}

const STAR8_INNER = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);

/**
 * A glyph as an SVG element centred on (x, y) inside a circle of radius r, painted with
 * currentColor (set `color` on an ancestor to recolor). Embed in your own <svg>.
 */
export function glyph(kind: GlyphKind, x: number, y: number, r: number, key?: string | number): ReactElement {
  const k = key ?? `${kind}-${rnd(x)}-${rnd(y)}`;
  switch (kind) {
    case "spark":
      return <path key={k} d={sparkD(x, y, r, r * 0.92)} fill="currentColor" />;
    case "diamond":
      return <path key={k} d={polyD([[x, y - r], [x + r * 0.66, y], [x, y + r], [x - r * 0.66, y]], true, 2)} fill="currentColor" stroke="currentColor" strokeWidth={rnd(r * 0.16, 2)} strokeLinejoin="round" />;
    case "star8":
      return <path key={k} d={polyD(starPts(x, y, r, r * STAR8_INNER, 8), true, 2)} fill="currentColor" />;
    case "asterisk": {
      const P = new PathBuilder({ p: 2 });
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const p0 = polar(x, y, r * 0.86, a);
        const p1 = polar(x, y, r * 0.86, a + Math.PI);
        P.M(p0[0], p0[1]).L(p1[0], p1[1]);
      }
      return <path key={k} d={P.toString()} fill="none" stroke="currentColor" strokeWidth={rnd(r * 0.3, 2)} strokeLinecap="round" />;
    }
    case "check":
      return (
        <path
          key={k}
          d={new PathBuilder({ p: 2 }).M(x - r * 0.72, y + r * 0.02).L(x - r * 0.2, y + r * 0.54).L(x + r * 0.76, y - r * 0.5).toString()}
          fill="none"
          stroke="currentColor"
          strokeWidth={rnd(r * 0.3, 2)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "heart": {
      const s = r / 17;
      const P = new PathBuilder({ p: 2, sx: s, sy: s, tx: x / s - 24, ty: y / s - 24 });
      P.M(24, 39).C(13, 31.5, 7, 25.5, 7, 18).C(7, 12.6, 11, 9, 15.6, 9).C(19.2, 9, 22.2, 11.1, 24, 14.4).C(25.8, 11.1, 28.8, 9, 32.4, 9).C(37, 9, 41, 12.6, 41, 18).C(41, 25.5, 35, 31.5, 24, 39).Z();
      return <path key={k} d={P.toString()} fill="currentColor" />;
    }
    case "bolt": {
      const s = r / 18;
      const P = new PathBuilder({ p: 2, sx: s, sy: s, tx: x / s - 24, ty: y / s - 24 });
      P.M(27.5, 6).L(11.5, 27.5).H(22.5).L(20.5, 42).L(36.5, 20.5).H(25.5).Z();
      return <path key={k} d={P.toString()} fill="currentColor" stroke="currentColor" strokeWidth={rnd(r * 0.1, 2)} strokeLinejoin="round" />;
    }
    case "leaf": {
      const P = new PathBuilder({ p: 2 });
      P.M(x - r * 0.7, y + r * 0.7)
        .C(x - r * 0.7, y - r * 0.15, x - r * 0.15, y - r * 0.7, x + r * 0.78, y - r * 0.78)
        .C(x + r * 0.7, y + r * 0.15, x + r * 0.15, y + r * 0.7, x - r * 0.7, y + r * 0.7)
        .Z();
      return <path key={k} d={P.toString()} fill="currentColor" />;
    }
    case "flower":
      return (
        <g key={k} fill="currentColor">
          {[0, 1, 2, 3, 4].map((i) => {
            const c = polar(x, y, r * 0.52, -Math.PI / 2 + (i * TAU) / 5);
            return <circle key={i} cx={rnd(c[0], 2)} cy={rnd(c[1], 2)} r={rnd(r * 0.42, 2)} />;
          })}
        </g>
      );
    default:
      return <circle key={k} cx={rnd(x, 2)} cy={rnd(y, 2)} r={rnd(r * 0.42, 2)} fill="currentColor" />;
  }
}

export interface GlyphProps extends Omit<IllBase, "reveal" | "delay"> {
  kind: GlyphKind;
}

/** Inline glyph — 1em square by default (separators, bullets). */
export function Glyph({ kind, tone = "accent", ...base }: GlyphProps): ReactElement {
  return (
    <SvgRoot vb="0 0 24 24" kind="glyph" tone={tone} {...base}>
      {glyph(kind, 12, 12, 10, "g")}
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkle                                                             */
/* ------------------------------------------------------------------ */

export interface SparkleProps extends Omit<IllBase, "idle"> {
  seed?: Seed;
  /** a small companion sparkle (seeded side) */
  twin?: boolean;
  /** companion color (default: same as tone) */
  tone2?: Tone;
  /** gentle shimmer (motion-gated) */
  twinkle?: boolean;
}

/** Clean 4-point star — use sparingly (one per section at most): bloom, maison, playground. */
export function Sparkle({ seed = 1, twin = false, tone = "accent", tone2, twinkle = false, ...base }: SparkleProps): ReactElement {
  const rng = createRng(seed, "sparkle");
  const side = rng.sign();
  const tx = 50 + side * rng.range(30, 36);
  const ty = rng.range(16, 24);
  return (
    <SvgRoot vb="0 0 100 100" kind="sparkle" tone={tone} tone2={tone2} {...base}>
      {/* pop (reveal) and shimmer (idle) live on different elements so their animations never clash */}
      <g className={twinkle ? "lp-idle-twinkle" : undefined}>
        <g className="lp-draw-pop">
          <path d={sparkD(50, 54, 44, 40)} fill="currentColor" className="lp-twk" />
        </g>
        {twin ? (
          <g className="lp-draw-pop" data-d={2}>
            <path d={sparkD(tx, ty, 13, 12)} className={tone2 ? "i-f2 lp-twk" : "lp-twk"} fill={tone2 ? undefined : "currentColor"} data-tw={2} />
          </g>
        ) : null}
      </g>
    </SvgRoot>
  );
}
