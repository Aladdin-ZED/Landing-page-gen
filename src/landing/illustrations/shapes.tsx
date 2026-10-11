/**
 * Shapes — soft 3D forms (CSS gradient shading: sphere, pill, torus) and crisp vector stickers
 * (smooth modern silhouettes with a soft shadow and a hairline sheen — never a die-cut rim).
 */
import type { ReactElement, ReactNode } from "react";
import { clamp, polar, smoothD, TAU, type Pt } from "./core/geom";
import { createRng, seededTilt, type Seed } from "./core/rng";
import { cssLength, cx, delayAttr, toneAttr, vars, type Tone } from "./core/svg";
import { sparkD } from "./glyphs";
import type { LightPlace } from "./light";

/* ------------------------------------------------------------------ */
/* Shape3D                                                             */
/* ------------------------------------------------------------------ */

export type Shape3DKind = "sphere" | "pill" | "torus";

export interface Shape3DProps {
  shape?: Shape3DKind;
  /** body color (default accent) */
  tone?: Tone;
  /** matte = soft clay light · gloss = crisp specular highlight */
  finish?: "matte" | "gloss";
  /** width (number → px or CSS length); default 6rem */
  size?: number | string;
  /** seeds the pill / torus orientation */
  seed?: Seed;
  /** absolute placement inside the nearest positioned host */
  place?: LightPlace;
  idle?: "float";
  className?: string;
}

/**
 * Soft 3D primitive with gradient shading, rim light and a contact shadow — playful, tactile
 * accents for playground and bloom. Pure CSS paint (crisp at any size, no images).
 */
export function Shape3D({ shape = "sphere", tone = "accent", finish = "matte", size, seed = 1, place, idle, className }: Shape3DProps): ReactElement {
  const rot = shape === "sphere" ? undefined : `${Math.round(createRng(seed, `shape3d:${shape}`).range(-38, 38))}deg`;
  return (
    <span
      className={cx("lp-ill lp-shape3d", className)}
      data-shape={shape}
      data-tone={toneAttr(tone)}
      data-finish={finish}
      data-place={place}
      style={vars({ "--ill-size": cssLength(size), "--ill-rot": rot })}
      aria-hidden="true"
    >
      {/* placement (root) · idle (body) · orientation + paint (form): three transforms, three elements */}
      <span className={cx("lp-shape3d__body", idle && `lp-idle-${idle}`)}>
        <span className="lp-shape3d__form" />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sticker                                                             */
/* ------------------------------------------------------------------ */

/**
 * circle · cookie (6–8 soft lobes, the contemporary "cookie" shape) · burst (8–9 rounded points,
 * a soft burst) · blob (smooth organic squircle) · spark (plump 4-point star) · scallop = cookie
 * (kept for older call sites)
 */
export type StickerShape = "circle" | "cookie" | "burst" | "blob" | "spark" | "scallop";

export interface StickerProps {
  seed?: Seed;
  shape?: StickerShape;
  /** sticker color; its content uses the matching readable "on" color */
  tone?: Tone;
  /** soft (default) or none; "hard" is accepted for older call sites and renders soft */
  shadow?: "soft" | "none" | "hard";
  /** seeded tilt range in degrees (max 6; 0 = straight) */
  tilt?: number;
  idle?: "float";
  /** data-reveal="stamp": the sticker pops in with a spring */
  reveal?: boolean;
  delay?: number;
  className?: string;
  /** real text (e.g. "−30%", "Nouveau", "جديد") — wrap numbers in <bdi> */
  children?: ReactNode;
}

const C = 100;

/** Radial silhouette r(θ) sampled densely and smoothed (closed Catmull-Rom). */
function radial(fn: (a: number) => number, samples: number, rot: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const a = rot + (i / samples) * TAU;
    pts.push(polar(C, C, fn(a - rot), a));
  }
  return smoothD(pts, true, 2);
}

function stickerPath(shape: StickerShape, seed: Seed): string {
  const rng = createRng(seed, `sticker:${shape}`);
  const rot = rng.range(0, TAU);
  // few, fat lobes read as a contemporary soft shape; many small ones read as a vintage seal
  if (shape === "cookie" || shape === "scallop") {
    const n = rng.int(6, 8);
    return radial((a) => 90 * (1 + 0.06 * Math.cos(n * a)), n * 10, rot);
  }
  if (shape === "burst") {
    const n = rng.int(8, 9);
    return radial((a) => 86 * (1 + 0.1 * Math.cos(n * a)), n * 10, rot);
  }
  if (shape === "blob") {
    const h = [rng.range(0.03, 0.06), rng.range(0.02, 0.045), rng.range(0.01, 0.025)];
    const ph = [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)];
    return radial((a) => 88 * (1 + (h[0] as number) * Math.cos(2 * a + (ph[0] as number)) + (h[1] as number) * Math.cos(3 * a + (ph[1] as number)) + (h[2] as number) * Math.cos(5 * a + (ph[2] as number))), 48, 0);
  }
  if (shape === "spark") return sparkD(C, C, 96, 96, 0.4, 2);
  return "M100 9a91 91 0 1 1 0 182a91 91 0 1 1 0-182Z";
}

/**
 * Crisp vector sticker with real HTML content centred on top. The root carries the tilt and the
 * reveal; the idle loop runs on the inner body so both can coexist.
 */
export function Sticker({ seed = 1, shape = "circle", tone = "pop", shadow = "soft", tilt = 4, idle, reveal = false, delay, className, children }: StickerProps): ReactElement {
  const d = stickerPath(shape, seed);
  const max = Math.min(6, Math.round(clamp(tilt, 0, 6)));
  const rot = max > 0 ? seededTilt(seed, "sticker", max, 1) : 0;
  return (
    <span
      className={cx("lp-ill lp-sticker", className)}
      data-shape={shape === "scallop" ? "cookie" : shape}
      data-tone={toneAttr(tone)}
      data-shadow={shadow === "none" ? "none" : undefined}
      data-rot={rot || undefined}
      data-reveal={reveal ? "stamp" : undefined}
      data-delay={delayAttr(reveal, delay)}
    >
      <span className={cx("lp-sticker__body", idle && `lp-idle-${idle}`)}>
        <svg className="lp-sticker__bg" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
          <path d={d} fill="currentColor" />
          <path d={d} className="lp-sticker__sheen" fill="none" transform="translate(5 5) scale(.95)" vectorEffect="non-scaling-stroke" />
        </svg>
        {children !== undefined && children !== null ? <span className="lp-sticker__content">{children}</span> : null}
      </span>
    </span>
  );
}
