/**
 * Modern Moroccan geometry — exact constructions drawn as thin, precise lines (never tiles,
 * never ornament clutter) and clean arch masks for media.
 *
 * Zellige: the star-and-cross tessellation. Stars {8/2} (two squares of circumradius R rotated
 * 45°, notch radius R·cos45°/cos22.5°) on a square lattice of pitch L with R = L/2 touch tip to
 * tip; the space between four stars is exactly a Greek cross with pointed arms, so drawing the star
 * outlines draws the whole pattern.
 *
 * Arches (box w × h, apex at y = 0), all with softly rounded feet:
 *  round      semicircle on jambs
 *  pointed    gentle drop arch: two arcs of radius 0.7w from the springing line
 *  horseshoe  circle wider than its opening (opening = 0.8 × diameter)
 *  keyhole    pointed horseshoe: two arcs (r = 0.6w) centred 0.1w past the axis, jambs 0.09w in
 */
import type { ReactElement, ReactNode } from "react";
import { clamp, PathBuilder, polyD, rnd, starPts } from "./core/geom";
import { cx, delayAttr, illId, toneAttr, urlRef, vars, type Tone } from "./core/svg";
import type { Fade } from "./lines";

/* ------------------------------------------------------------------ */
/* ZelligeLines                                                        */
/* ------------------------------------------------------------------ */

const STAR8_INNER = Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8);

export interface ZelligeLinesProps {
  /** unique per page (section id + key) — pattern id */
  uid: string;
  /** lattice pitch in px (default 96) */
  tile?: number;
  /** star = star-and-cross outlines · rosette = + an inner octagram in every star */
  variant?: "star" | "rosette";
  /** line color (default accent) */
  tone?: Tone;
  /** layer opacity, 0–0.12 (default 0.06): felt, not read */
  opacity?: number;
  /** stroke in px (default 1) */
  weight?: number;
  fade?: Fade;
  /** absolute full-bleed layer (default) */
  layer?: boolean;
  className?: string;
}

/** Abstract zellige geometry as hairlines at very low opacity, masked to fade out (souk, maison). */
export function ZelligeLines({ uid, tile = 96, variant = "star", tone = "accent", opacity, weight = 1, fade = "radial", layer = true, className }: ZelligeLinesProps): ReactElement {
  const L = Math.round(clamp(tile, 24, 400));
  const c = L / 2;
  const id = illId(uid, "zl");
  const star = polyD(starPts(c, c, c, c * STAR8_INNER, 8), true, 2);
  const inner = variant === "rosette" ? polyD(starPts(c, c, L * 0.22, L * 0.22 * STAR8_INNER, 8, Math.PI / 8), true, 2) : null;
  return (
    <svg
      className={cx("lp-ill lp-zellige", layer && "lp-layer", className)}
      data-tone={toneAttr(tone)}
      data-fade={fade === "none" ? undefined : fade}
      style={vars({ "--ill-o": opacity === undefined ? undefined : rnd(clamp(opacity, 0, 0.12), 3) })}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={L} height={L} x="50%" y="50%">
          <g fill="none" stroke="currentColor" strokeWidth={rnd(clamp(weight, 0.5, 3), 2)} strokeLinejoin="miter">
            <path d={star} />
            {inner ? <path d={inner} /> : null}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={urlRef(id)} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Arches                                                              */
/* ------------------------------------------------------------------ */

export type ArchKind = "round" | "pointed" | "horseshoe" | "keyhole";

export interface ArchPathOpts {
  /** decimals */
  p?: number;
  /** scale applied after translate (use 1/w, 1/h for objectBoundingBox) */
  sx?: number;
  sy?: number;
  tx?: number;
  ty?: number;
  /** leave the bottom edge open (keylines) */
  open?: boolean;
  /** radius of the rounded feet as a fraction of w (default 0.06; 0 = square) */
  foot?: number;
}

/**
 * Continuous foot corner (the kit's squircle, base.css §2b): a cubic whose handles sit 82% of the way
 * to the box corner, over an extent 1.6× the circular radius — the same perceived roundness as a
 * circle of `r`, with a curvature that grows out of the straight edges instead of starting abruptly.
 */
const FOOT_K = 1.6;
const FOOT_Q = 0.82;

/** Closed (or open-bottom) arch outline in a w × h box. */
export function archPath(kind: ArchKind, w: number, h: number, o: ArchPathOpts = {}): string {
  const P = new PathBuilder({ p: o.p ?? 1, sx: o.sx, sy: o.sy, tx: o.tx, ty: o.ty });
  // jamb x positions and the arch head, drawn from the left jamb to the right one
  let xl = 0;
  let xr = w;
  let head: (b: PathBuilder) => void;
  let spring: number;
  switch (kind) {
    case "pointed": {
      const rho = 0.7 * w;
      const sy0 = Math.sqrt(rho * rho - (w / 2 - rho) ** 2);
      const f = Math.min(1, (h * 0.78) / sy0);
      spring = sy0 * f;
      head = (b) => b.A(rho, rho * f, 0, 1, w / 2, 0).A(rho, rho * f, 0, 1, w, spring);
      break;
    }
    case "horseshoe": {
      const R = w / 2;
      const ho = R * 0.8;
      const jy = R + Math.sqrt(R * R - ho * ho);
      const f = Math.min(1, (h * 0.85) / jy);
      xl = w / 2 - ho;
      xr = w / 2 + ho;
      spring = jy * f;
      head = (b) => b.A(R, R * f, 1, 1, xr, spring);
      break;
    }
    case "keyhole": {
      const e = 0.1 * w;
      const rho = w / 2 + e;
      const yc = Math.sqrt((w * w) / 4 + w * e);
      const jx = 0.09 * w;
      const jy = yc + Math.sqrt(rho * rho - (jx - (w / 2 + e)) ** 2);
      const f = Math.min(1, (h * 0.85) / jy);
      xl = jx;
      xr = w - jx;
      spring = jy * f;
      head = (b) => b.A(rho, rho * f, 0, 1, w / 2, 0).A(rho, rho * f, 0, 1, xr, spring);
      break;
    }
    default: {
      const r = w / 2;
      const ry = Math.min(r, h * 0.62);
      spring = ry;
      head = (b) => b.A(r, ry, 0, 1, w, ry);
    }
  }
  const foot = o.open ? 0 : Math.min(clamp(o.foot ?? 0.06, 0, 0.25) * w * FOOT_K, (h - spring) / 2, (xr - xl) / 2);
  const hq = foot * (1 - FOOT_Q);
  P.M(xl, h - foot).V(spring);
  head(P);
  if (o.open) {
    P.V(h);
    return P.toString();
  }
  P.V(h - foot);
  if (foot > 0) P.C(xr, h - hq, xr - hq, h, xr - foot, h).H(xl + foot).C(xl + hq, h, xl, h - hq, xl, h - foot);
  else P.V(h).H(xl);
  return P.Z().toString();
}

/**
 * none · line = 1px keyline on the edge · offset = 1px keyline floating just outside the arch ·
 * inset = a closed 1px passe-partout line just inside the arch, concentric with it (light, over the
 * media: tone `bg` by default)
 */
export type Keyline = "none" | "line" | "offset" | "inset";

export interface ArchFrameProps {
  /** unique per page (section id + key) — clipPath id */
  uid: string;
  kind?: ArchKind;
  /** width / height (default 0.8 = 4:5 portrait) */
  ratio?: number;
  keyline?: Keyline;
  /** keyline color (default line; bg for the inset keyline) */
  tone?: Tone;
  /**
   * data-reveal="mask-arch": the frame rises open from its base when scrolled into view while the
   * media settles from 1.06 to 1 inside the arch, then the keyline fades in
   */
  reveal?: boolean;
  /** reveal delay in ms */
  delay?: number;
  className?: string;
  /** the media (Picture / video / color block) */
  children?: ReactNode;
}

const clipRatio = (ratio: number) => clamp(Number.isFinite(ratio) ? ratio : 0.8, 0.35, 2.5);

/**
 * Arch-window media mask: clips its child to a clean arch (objectBoundingBox clipPath computed for
 * the frame's aspect ratio, so curves never distort) with an optional hairline keyline.
 */
export function ArchFrame({ uid, kind = "round", ratio = 0.8, keyline = "none", tone, reveal = false, delay, className, children }: ArchFrameProps): ReactElement {
  const r = clipRatio(ratio);
  const W = 100;
  const H = W / r;
  const id = illId(uid, "arch");
  const d = 3.5;
  // inset: the same arch drawn d inside (its head is the half-circle of its own width, so the two
  // heads share one centre), feet radius reduced by the same gap
  const line =
    keyline === "line"
      ? archPath(kind, W - 0.4, H - 0.2, { open: true, tx: 0.2, ty: 0.2 })
      : keyline === "offset"
        ? archPath(kind, W + 2 * d, H + d, { open: true, tx: -d, ty: -d })
        : keyline === "inset"
          ? archPath(kind, W - 2 * d, H - 2 * d, { tx: d, ty: d, foot: Math.max(0, (0.06 * W - 1.15 * d) / (W - 2 * d)) })
          : null;
  const lineTone: Tone = tone ?? (keyline === "inset" ? "bg" : "line");
  return (
    <div
      className={cx("lp-frame", className)}
      data-shape={`arch-${kind}`}
      data-reveal={reveal ? "mask-arch" : undefined}
      data-delay={delayAttr(reveal, delay)}
      style={vars({ "--frame-ratio": rnd(r, 3), "--frame-clip": urlRef(id) })}
    >
      <svg className="lp-frame__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <clipPath id={id} clipPathUnits="objectBoundingBox">
          <path d={archPath(kind, W, H, { p: 4, sx: 1 / W, sy: 1 / H })} />
        </clipPath>
      </svg>
      <div className="lp-frame__media">{children}</div>
      {line ? (
        <svg
          className="lp-ill lp-frame__line"
          viewBox={`0 0 ${W} ${rnd(H)}`}
          preserveAspectRatio="none"
          data-tone={toneAttr(lineTone)}
          data-reveal={reveal ? "draw" : undefined}
          data-delay={reveal ? (delayAttr(true, delay) ?? 0) + 480 : undefined}
          aria-hidden="true"
          focusable="false"
        >
          {/* a non-scaling hairline (lp-nss): illustrations.css fades it in whole instead of drawing it */}
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" pathLength={1} className="lp-draw lp-nss" />
        </svg>
      ) : null}
    </div>
  );
}

/** Just the clipPath (custom compositions): reference it with clip-path: url(#illId(uid, "arch")). */
export function ArchClip({ uid, kind = "round", ratio = 0.8 }: { uid: string; kind?: ArchKind; ratio?: number }): ReactElement {
  const r = clipRatio(ratio);
  const H = 100 / r;
  return (
    <svg className="lp-frame__defs" width="0" height="0" aria-hidden="true" focusable="false">
      <clipPath id={illId(uid, "arch")} clipPathUnits="objectBoundingBox">
        <path d={archPath(kind, 100, H, { p: 4, sx: 1 / 100, sy: 1 / H })} />
      </clipPath>
    </svg>
  );
}
