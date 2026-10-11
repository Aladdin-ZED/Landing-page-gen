/**
 * Section transitions — modern only (DESIGN.md §4.6): one smooth curve, a subtle clean angle, a
 * clean offset step, one smooth arch, one gentle wave, or a soft color fade. Never torn, zigzag,
 * scalloped, stitched or ornamental.
 *
 * <div class="lp-divider" data-kind data-from data-to> sits between two sections; CSS paints it
 * with the raw section colors (base → --lp-bg, soft → --lp-soft, surface → --lp-surface,
 * accent → --lp-accent, dark → --lp-dark, pop → --lp-pop). Geometry is drawn "rising" (the lower
 * section's color swells up into the upper one) in a stretched 1440 × 100 box; by default CSS
 * mirrors it vertically so the upper section hangs into the lower one, and `flip` keeps it rising
 * (use it when the lower section is the heavier color). Asymmetric kinds mirror in RTL; the seed
 * picks the side, the curvature and the split. Heights are responsive per kind (--div-h).
 */
import type { ReactElement } from "react";
import type { Divider as DividerKind, SectionBg } from "@/lib/page/schema";
import { lerp, PathBuilder, rnd, smoothD, TAU, type Pt } from "./core/geom";
import { createRng, type Seed } from "./core/rng";
import { illId, vars } from "./core/svg";

export type DividerSize = "sm" | "md" | "lg";

export interface DividerProps {
  kind: DividerKind;
  /** unique per page (e.g. "dv-" + the lower section id) — becomes the element id */
  uid: string;
  /** background of the section above */
  from: SectionBg;
  /** background of the section below */
  to: SectionBg;
  seed?: Seed;
  /** the lower section's color rises into the upper one (default: the upper one hangs down) */
  flip?: boolean;
  /** sm / md / lg presets of the responsive height, or a fixed height in px */
  height?: DividerSize | number;
  className?: string;
}

const W = 1440;
const H = 100;
/** bleed below the box so the shape fully covers its base row (no hairline seam when scaled) */
const B = H + 2;

/** Rising shape for each kind, in a W × H box (shape fills below the edge). */
function shapeD(kind: Exclude<DividerKind, "none" | "fade">, seed: Seed): string {
  const rng = createRng(seed, `divider:${kind}`);
  const mirror = rng.chance(0.5);
  const X = (x: number) => (mirror ? W - x : x);
  const P = new PathBuilder();
  switch (kind) {
    case "diagonal": {
      const low = H * rng.range(0, 0.08);
      return P.M(X(0), B).L(X(0), H).L(X(W), low).L(X(W), B).Z().toString();
    }
    case "steps": {
      // a clean offset: flush on one side, full height on the other, joined by a smooth S
      const s = W * rng.range(0.36, 0.62);
      const sw = H * rng.range(1.5, 2.1);
      return P.M(X(0), B)
        .L(X(0), H)
        .L(X(s - sw / 2), H)
        .C(X(s), H, X(s), 0, X(s + sw / 2), 0)
        .L(X(W), 0)
        .L(X(W), B)
        .Z()
        .toString();
    }
    case "arch": {
      // one soft dome across the full width: a sine profile (fullness 0.8–1), so the curvature
      // changes continuously from the shoulders to the crown — it reads as one arch on a 390px
      // phone (where the box is relatively tall) as on a 1440px screen, never as a flat-topped tab
      const top = H * rng.range(0, 0.06);
      const full = rng.range(0.8, 1);
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push([t * W, H - (H - top) * Math.sin(Math.PI * t) ** full]);
      }
      const edge = smoothD(pts);
      return `M0 ${B}L0 ${H}${edge.replace(/^M[^A-Za-z]*/, "")}L${W} ${B}Z`;
    }
    case "wave": {
      // one gentle period; the phase decides which side swells
      const phase = rng.range(0.15, 0.35) * TAU;
      const amp = H * rng.range(0.36, 0.42);
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push([X(t * W), H / 2 + amp * Math.sin(t * TAU + phase)]);
      }
      if (mirror) pts.reverse();
      const edge = smoothD(pts);
      return `M0 ${B}L0 ${rnd((pts[0] as Pt)[1])}${edge.replace(/^M[^A-Za-z]*/, "")}L${W} ${B}Z`;
    }
    default: {
      // curve: one large asymmetric swoop rising from flush to near full height
      const end = H * rng.range(0, 0.12);
      return P.M(X(0), B)
        .L(X(0), H)
        .C(X(W * rng.range(0.34, 0.46)), H, X(W * rng.range(0.58, 0.7)), lerp(end, H, rng.range(0, 0.12)), X(W), end)
        .L(X(W), B)
        .Z()
        .toString();
    }
  }
}

/** Section divider (renders nothing for "none"). Decorative: aria-hidden. */
export function Divider({ kind, uid, from, to, seed = 1, flip = false, height, className }: DividerProps): ReactElement | null {
  if (kind === "none") return null;
  const px = typeof height === "number" && Number.isFinite(height) ? Math.round(Math.min(400, Math.max(8, height))) : undefined;
  return (
    <div
      id={illId(uid, "dv")}
      className={className ? `lp-divider ${className}` : "lp-divider"}
      data-kind={kind}
      data-from={from}
      data-to={to}
      data-flip={flip ? "" : undefined}
      data-size={typeof height === "string" && height !== "md" ? height : undefined}
      style={vars({ "--div-h": px === undefined ? undefined : `${px}px` })}
      aria-hidden="true"
    >
      {kind === "fade" ? null : (
        <svg className="lp-divider__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" focusable="false" aria-hidden="true">
          <path className="lp-dv-shape" d={shapeD(kind, seed)} />
        </svg>
      )}
    </div>
  );
}
