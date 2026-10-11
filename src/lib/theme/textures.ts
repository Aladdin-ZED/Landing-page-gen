/**
 * Film grain as a tiny deterministic SVG data URI (no network, CSP-safe as `img-src data:`).
 * The modern direction allows exactly one material texture: an ultra-fine monochrome grain laid over
 * gradient and dark fields at ≤ 3% opacity (it kills gradient banding and adds a photographic finish).
 * Built only from numbers and constant markup — no user input — then percent-encoded for url("…").
 */
import type { TextureKind } from "./archetypes";
import { hexToRgb, type Hex } from "./color";

const encode = (svg: string) =>
  svg
    .replace(/\s{2,}/g, " ")
    .replace(/"/g, "'")
    .replace(/[%#<>{}|\\^`\n\r]/g, (c) => encodeURIComponent(c));

/** Feature color matrix that outputs `color` with alpha driven by the noise (contrast-stretched). */
function matrix(color: Hex, gain: number, offset: number): string {
  const [r, g, b] = hexToRgb(color);
  return `0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} ${gain} 0 0 0 ${offset}`;
}

/** `url("data:image/svg+xml,…")` of a seamless 200px grain tile tinted `color`, or "none". */
export function textureUrl(kind: TextureKind, color: Hex, seed: number): string {
  if (kind === "none") return "none";
  const s = Math.abs(Math.trunc(seed)) % 997;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="g" x="0" y="0"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${s}" stitchTiles="stitch"/><feColorMatrix values="${matrix(color, 2.4, -0.75)}"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>`;
  return `url("data:image/svg+xml,${encode(svg)}")`;
}
