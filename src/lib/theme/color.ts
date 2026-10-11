/**
 * Color science for the theme engine — OKLab/OKLCH, CSS Color 4 gamut mapping, WCAG 2 contrast.
 *
 * Parsing/formatting of arbitrary CSS colors goes through culori (tree-shaken `culori/fn`).
 * The hot paths (palette solving runs hundreds of contrast searches per theme, extraction converts
 * thousands of pixels) use allocation-free numeric conversions with the exact OKLab matrices culori
 * uses; scripts/check-theme.ts cross-checks `fromOklch` against culori's `toGamut("rgb","oklch")`.
 *
 * Pure & isomorphic. All public colors are lowercase "#rrggbb".
 */
// culori's mode registration (not a React hook — renamed so lint rules don't mistake it for one)
import { formatHex, modeLrgb, modeOklab, modeOklch, modeRgb, parse, useMode as registerMode } from "culori/fn";

registerMode(modeRgb);
registerMode(modeLrgb);
registerMode(modeOklab);
registerMode(modeOklch);

export type Hex = string;
export interface Oklch {
  /** lightness 0..1 */
  l: number;
  /** chroma 0..~0.37 */
  c: number;
  /** hue in degrees 0..360 */
  h: number;
}
export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export const HEX_RE = /^#[0-9a-f]{6}$/;

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const normHue = (h: number) => ((h % 360) + 360) % 360;
/** shortest angular distance 0..180 */
export const hueDistance = (a: number, b: number) => {
  const d = Math.abs(normHue(a) - normHue(b));
  return d > 180 ? 360 - d : d;
};
/** shortest-path hue interpolation */
export const lerpHue = (a: number, b: number, t: number) => {
  let d = normHue(b) - normHue(a);
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return normHue(normHue(a) + d * t);
};

/* ------------------------------------------------------------------ */
/* sRGB <-> linear <-> OKLab                                           */
/* ------------------------------------------------------------------ */

const toLinear = (v: number) => {
  const a = Math.abs(v);
  return a <= 0.04045 ? v / 12.92 : Math.sign(v) * ((a + 0.055) / 1.055) ** 2.4;
};
const toGammaRaw = (v: number) => {
  const a = Math.abs(v);
  return a > 0.0031308 ? Math.sign(v) * (1.055 * a ** (1 / 2.4) - 0.055) : v * 12.92;
};

/** 8-bit sRGB → linear lookup (pixel conversion speed). */
const LIN8 = new Float64Array(256);
for (let i = 0; i < 256; i++) LIN8[i] = toLinear(i / 255);

function linearToOklab(r: number, g: number, b: number, out: number[]): number[] {
  const l = Math.cbrt(0.412221469470763 * r + 0.5363325372617348 * g + 0.0514459932675022 * b);
  const m = Math.cbrt(0.2119034958178252 * r + 0.6806995506452344 * g + 0.1073969535369406 * b);
  const s = Math.cbrt(0.0883024591900564 * r + 0.2817188391361215 * g + 0.6299787016738222 * b);
  out[0] = 0.210454268309314 * l + 0.7936177747023054 * m - 0.0040720430116193 * s;
  out[1] = 1.9779985324311684 * l - 2.42859224204858 * m + 0.450593709617411 * s;
  out[2] = 0.0259040424655478 * l + 0.7827717124575296 * m - 0.8086757549230774 * s;
  return out;
}

function oklabToLinear(L: number, a: number, b: number, out: number[]): number[] {
  const l = (L + 0.3963377773761749 * a + 0.2158037573099136 * b) ** 3;
  const m = (L - 0.1055613458156586 * a - 0.0638541728258133 * b) ** 3;
  const s = (L - 0.0894841775298119 * a - 1.2914855480194092 * b) ** 3;
  out[0] = 4.0767416360759583 * l - 3.3077115392580629 * m + 0.2309699031821043 * s;
  out[1] = -1.2684379732850315 * l + 2.6097573492876882 * m - 0.341319376002657 * s;
  out[2] = -0.0041960761386756 * l - 0.7034186179359362 * m + 1.7076146940746117 * s;
  return out;
}

/**
 * OKLab → 8-bit sRGB channels (clipped, rounded): the color a browser actually paints for a mixed
 * value (blend.ts re-measures near-band mixes this way — 8-bit rounding swings dark colors' hue).
 */
export function oklabToRgb8(L: number, a: number, b: number, out: number[] = [0, 0, 0]): number[] {
  oklabToLinear(L, a, b, out);
  for (let i = 0; i < 3; i++) out[i] = Math.round(clamp(toGammaRaw(out[i]!), 0, 1) * 255);
  return out;
}

/** Fast 8-bit sRGB → OKLab (used per pixel by the extractor). */
export function rgb8ToOklab(r: number, g: number, b: number, out: number[] = [0, 0, 0]): number[] {
  return linearToOklab(LIN8[r]!, LIN8[g]!, LIN8[b]!, out);
}

/* ------------------------------------------------------------------ */
/* Hex                                                                 */
/* ------------------------------------------------------------------ */

const hexByte = (v: number) => {
  const n = Math.round(clamp(v, 0, 1) * 255);
  return (n < 16 ? "0" : "") + n.toString(16);
};

/** gamma-encoded sRGB 0..1 channels → "#rrggbb" (clamped). */
export function rgbToHex(r: number, g: number, b: number): Hex {
  return `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
}

/** "#rrggbb" → gamma-encoded sRGB channels 0..1. Throws on malformed input. */
export function hexToRgb(hex: Hex): [number, number, number] {
  const h = hex.toLowerCase();
  if (!HEX_RE.test(h)) throw new Error(`invalid hex color: ${JSON.stringify(hex)}`);
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const isHex = (v: unknown): v is Hex => typeof v === "string" && HEX_RE.test(v.toLowerCase());

/** Parse any CSS color (hex, rgb(), hsl(), oklch(), named…) via culori → "#rrggbb", or null. */
export function parseColor(input: string): Hex | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const c = parse(input.trim());
  if (!c) return null;
  const hex = formatHex(c);
  return isHex(hex) ? hex.toLowerCase() : null;
}

/* ------------------------------------------------------------------ */
/* OKLCH                                                               */
/* ------------------------------------------------------------------ */

const tmp3: number[] = [0, 0, 0];
const tmp3b: number[] = [0, 0, 0];

export function hexToOklab(hex: Hex): Oklab {
  const [r, g, b] = hexToRgb(hex);
  linearToOklab(toLinear(r), toLinear(g), toLinear(b), tmp3);
  return { l: tmp3[0]!, a: tmp3[1]!, b: tmp3[2]! };
}

export function oklabToOklch(o: Oklab): Oklch {
  const c = Math.hypot(o.a, o.b);
  const h = c < 1e-6 ? 0 : normHue((Math.atan2(o.b, o.a) * 180) / Math.PI);
  return { l: o.l, c, h };
}

export function toOklch(hex: Hex): Oklch {
  return oklabToOklch(hexToOklab(hex));
}

const EPS_GAMUT = 1e-6;
const inGamut = (rgb: number[]) =>
  rgb[0]! >= -EPS_GAMUT && rgb[0]! <= 1 + EPS_GAMUT && rgb[1]! >= -EPS_GAMUT && rgb[1]! <= 1 + EPS_GAMUT && rgb[2]! >= -EPS_GAMUT && rgb[2]! <= 1 + EPS_GAMUT;

/** OKLCH → gamma sRGB channels (unclamped). */
function oklchToRgbRaw(l: number, c: number, h: number, out: number[]): number[] {
  const hr = (h * Math.PI) / 180;
  oklabToLinear(l, c * Math.cos(hr), c * Math.sin(hr), out);
  out[0] = toGammaRaw(out[0]!);
  out[1] = toGammaRaw(out[1]!);
  out[2] = toGammaRaw(out[2]!);
  return out;
}

/** ΔEOK between a gamma-sRGB triple (clipped) and an OKLCH color. */
function deltaClip(rgb: number[], l: number, c: number, h: number): number {
  const r = clamp(rgb[0]!, 0, 1);
  const g = clamp(rgb[1]!, 0, 1);
  const b = clamp(rgb[2]!, 0, 1);
  linearToOklab(toLinear(r), toLinear(g), toLinear(b), tmp3b);
  const hr = (h * Math.PI) / 180;
  return Math.hypot(tmp3b[0]! - l, tmp3b[1]! - c * Math.cos(hr), tmp3b[2]! - c * Math.sin(hr));
}

/**
 * OKLCH → "#rrggbb" with the CSS Color 4 gamut-mapping algorithm (chroma reduction in OKLCH with a
 * ΔEOK 0.02 "roughly in gamut" test, then clip) — same behavior as culori `toGamut("rgb","oklch")`.
 */
export function fromOklch(o: Oklch): Hex {
  const l = o.l;
  const h = normHue(o.h);
  const c = Math.max(0, o.c);
  if (l >= 1) return "#ffffff";
  if (l <= 0) return "#000000";
  const rgb: number[] = [0, 0, 0];
  oklchToRgbRaw(l, c, h, rgb);
  if (inGamut(rgb)) return rgbToHex(rgb[0]!, rgb[1]!, rgb[2]!);
  const JND = 0.02;
  const EPS = 0.0001;
  if (deltaClip(rgb, l, c, h) < JND) return rgbToHex(rgb[0]!, rgb[1]!, rgb[2]!);
  let min = 0;
  let max = c;
  let minInGamut = true;
  while (max - min > EPS) {
    const chroma = (min + max) / 2;
    oklchToRgbRaw(l, chroma, h, rgb);
    if (minInGamut && inGamut(rgb)) {
      min = chroma;
      continue;
    }
    const e = deltaClip(rgb, l, chroma, h);
    if (e < JND) {
      if (JND - e < EPS) break;
      minInGamut = false;
      min = chroma;
    } else {
      max = chroma;
    }
  }
  return rgbToHex(rgb[0]!, rgb[1]!, rgb[2]!);
}

/** OKLab → "#rrggbb" (gamut-mapped). */
export function fromOklab(o: Oklab): Hex {
  return fromOklch(oklabToOklch(o));
}

/* ------------------------------------------------------------------ */
/* No orange — the owner's standing rule (2026-10-10)                  */
/* ------------------------------------------------------------------ */

/**
 * The forbidden band: any UI color whose OKLCH hue is in [25°, 75°] with chroma > 0.06 (red-orange,
 * tomato, coral, terracotta, orange, amber, saffron, ochre). Low-chroma warm neutrals (cream, sand,
 * beige, taupe, cocoa: chroma ≤ 0.06), crimson/berry reds (< 25°) and yellows (> 75°) are fine.
 * Product photos may contain anything — the rule covers every color the engine emits.
 */
export const ORANGE_BAND = {
  hueMin: 25,
  hueMax: 75,
  maxChroma: 0.06,
  /** aliases of hueMin / hueMax / maxChroma (the generator's original names) */
  from: 25,
  to: 75,
  chroma: 0.06,
} as const;

export const inOrangeBand = (o: Oklch) => o.c > ORANGE_BAND.maxChroma && o.h >= ORANGE_BAND.hueMin && o.h <= ORANGE_BAND.hueMax;
/** True for a CSS color (hex, rgb(), hsl(), oklch()…) in the forbidden band; false when unreadable. */
export const isOrange = (color: string): boolean => {
  const hex = HEX_RE.test(color) ? color : parseColor(color);
  return hex ? inOrangeBand(toOklch(hex)) : false;
};

/**
 * The engine's own guard is the band plus a perceptual margin, so nothing it creates sits on the edge
 * of the rule (scripts/check-theme.ts reports the margin kept):
 *  - hue 22–80°: a vivid red at 23° still reads red-orange; 75–80° is where dark gold turns ochre and
 *    bright gold turns amber;
 *  - light colors (L ≥ 0.65) from 15°: a light red at 18° reads salmon/coral — it goes rose instead;
 *  - pastels (L ≥ 0.8) from chroma 0.04: a peach or apricot pastel reads orange long before 0.06.
 */
export const ORANGE_GUARD = { hueMin: 22, hueMinLight: 15, hueMax: 80, maxChroma: ORANGE_BAND.maxChroma, maxChromaPastel: 0.04 } as const;
export function nearOrange(o: Oklch): boolean {
  if (o.c <= (o.l >= 0.8 ? ORANGE_GUARD.maxChromaPastel : ORANGE_GUARD.maxChroma)) return false;
  return o.h >= (o.l >= 0.65 ? ORANGE_GUARD.hueMinLight : ORANGE_GUARD.hueMin) && o.h <= ORANGE_GUARD.hueMax;
}
const nearOrangeHex = (hex: Hex) => nearOrange(toOklch(hex));

/** Which side a color leaves the band to: "low" = crimson / berry, "high" = golden yellow. */
export type OrangeSide = "low" | "high";

/**
 * Hue targets that leave the guard with a margin (8-bit rounding swings the hue of a chroma-0.06 color
 * by a few degrees) — tried in order until the 8-bit result measures outside it. Light reds go rose
 * (12°) rather than salmon; deeper ones stay crimson (19°); the warm side lands on golden yellow (88°+),
 * never on amber.
 */
const ESCAPE_HUES = {
  low: [19, 15, 10, 4],
  lowLight: [12, 8, 4, 0],
  high: [88, 92, 96, 101],
} as const;

/** Largest chroma at (l, h) that sRGB holds without clipping (so a rotated hue stays exact). */
function maxInGamutChroma(l: number, h: number): number {
  const rgb: number[] = [0, 0, 0];
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    oklchToRgbRaw(l, mid, h, rgb);
    if (inGamut(rgb)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The closest non-orange color at (about) the same lightness — the engine's safety net, applied to
 * every UI color it creates (the ORANGE_GUARD band):
 *  - a muted warm tone (tan, caramel, apricot pastel; or a deep amber that would turn olive) keeps its
 *    hue and drops to neutral chroma: it reads as sand / cream / taupe / cocoa;
 *  - a real color rotates to the nearer side (crimson/berry — rose when light — or golden yellow),
 *    keeping as much chroma as the gamut allows at the new hue;
 * `side` forces the rotation direction (a harmony that wants berry rather than gold).
 * Colors outside the band come back unchanged (same string).
 */
export function noOrange(hex: Hex, side?: OrangeSide): Hex {
  const o = toOklch(hex);
  if (!nearOrange(o)) return hex;
  // warm tones (≥ 25°) mute to sand/taupe; a light red under 25° is a rose, not a tan: it rotates
  const mutedFirst = !side && o.h >= ORANGE_BAND.hueMin && (o.c <= 0.1 || (o.l < 0.5 && o.h >= 50));
  const muted = (): Hex | null => {
    for (const c of o.l >= 0.8 ? [0.038, 0.032, 0.025] : [0.056, 0.05, 0.042]) {
      const x = fromOklch({ l: o.l, c, h: o.h });
      if (!nearOrangeHex(x)) return x;
    }
    return null;
  };
  if (mutedFirst) {
    const m = muted();
    if (m) return m;
  }
  const first: OrangeSide = side ?? (o.h < 50 ? "low" : "high");
  for (const s of [first, first === "low" ? "high" : "low"] as const) {
    for (const h of s === "high" ? ESCAPE_HUES.high : o.l >= 0.65 ? ESCAPE_HUES.lowLight : ESCAPE_HUES.low) {
      const x = fromOklch({ l: o.l, c: Math.min(o.c, maxInGamutChroma(o.l, h)), h });
      if (!nearOrangeHex(x)) return x;
    }
  }
  return muted() ?? fromOklch({ l: o.l, c: 0.02, h: o.h });
}

/** OKLCH → "#rrggbb" for the UI: gamut-mapped (CSS Color 4) and never in the orange band. */
export function uiColor(o: Oklch, side?: OrangeSide): Hex {
  return noOrange(fromOklch(o), side);
}

/** Band exit for color *design* (before solving): the OKLCH of noOrange's clean 8-bit color. */
export function leaveOrangeBand(o: Oklch, side?: OrangeSide): Oklch {
  if (!nearOrange(o)) return o;
  return toOklch(noOrange(fromOklch(o), side));
}

/** Euclidean ΔE in OKLab (0 = same, ~0.02 = just noticeable, 0.1+ clearly different). */
export function deltaE(a: Hex, b: Hex): number {
  const x = hexToOklab(a);
  const y = hexToOklab(b);
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}

/**
 * Interpolate in OKLab (perceptually even), result gamut-mapped. t=0 → a, t=1 → b. A UI color: a mix
 * of crimson and gold that would pass through orange leaves the band (noOrange).
 */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const x = hexToOklab(a);
  const y = hexToOklab(b);
  return noOrange(fromOklab({ l: lerp(x.l, y.l, t), a: lerp(x.a, y.a, t), b: lerp(x.b, y.b, t) }));
}

/* ------------------------------------------------------------------ */
/* WCAG 2 contrast                                                     */
/* ------------------------------------------------------------------ */

const lumCache = new Map<string, number>();

/** WCAG relative luminance of an 8-bit sRGB color. */
export function luminance(hex: Hex): number {
  const key = hex.toLowerCase();
  const hit = lumCache.get(key);
  if (hit !== undefined) return hit;
  const [r, g, b] = hexToRgb(key);
  const y = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  if (lumCache.size > 20000) lumCache.clear();
  lumCache.set(key, y);
  return y;
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrast(a: Hex, b: Hex): number {
  const x = luminance(a);
  const y = luminance(b);
  return x > y ? (x + 0.05) / (y + 0.05) : (y + 0.05) / (x + 0.05);
}

/** Minimum contrast of `fg` against several backgrounds. */
export function minContrast(fg: Hex, bgs: readonly Hex[]): number {
  let m = 21;
  for (const bg of bgs) m = Math.min(m, contrast(fg, bg));
  return m;
}

/** Rough "is this a light color" — WCAG luminance midpoint where black/white text tie (≈0.179). */
export const isLight = (hex: Hex) => luminance(hex) > 0.179;

/**
 * Move `fg`'s OKLCH lightness (hue kept, chroma gamut-mapped) until it reaches `min` contrast
 * against every background. Searches the direction away from the backgrounds first, then the other
 * one; returns the closest passing color. If no lightness works (backgrounds on both sides of
 * mid-gray), falls back to the best of tinted-black / tinted-white / black / white.
 */
export function ensureContrast(fgIn: Hex, bgs: Hex | readonly Hex[], min: number): Hex {
  const list = typeof bgs === "string" ? [bgs] : bgs;
  const fg = noOrange(fgIn);
  if (minContrast(fg, list) >= min) return fg;
  const o = toOklch(fg);
  const fgLum = luminance(fg);
  const bgLums = list.map(luminance);
  const avgBg = bgLums.reduce((s, v) => s + v, 0) / bgLums.length;
  const darkerFirst = fgLum <= avgBg || avgBg > 0.5;
  for (const darker of darkerFirst ? [true, false] : [false, true]) {
    const target = darker ? 0 : 1;
    const ok = (l: number) => {
      const hex = uiColor({ l, c: o.c, h: o.h });
      const lum = luminance(hex);
      for (let i = 0; i < list.length; i++) {
        if (darker ? lum >= bgLums[i]! : lum <= bgLums[i]!) return null;
        if (contrast(hex, list[i]!) < min) return null;
      }
      return hex;
    };
    // the extreme must pass, otherwise this direction is impossible
    const extreme = ok(darker ? 0.0001 : 0.9999);
    if (!extreme) continue;
    let near = o.l; // failing side
    let far = target; // passing side
    let best = extreme;
    for (let i = 0; i < 20; i++) {
      const mid = (near + far) / 2;
      const hit = ok(mid);
      if (hit) {
        far = mid;
        best = hit;
      } else near = mid;
      if (Math.abs(far - near) < 0.0005) break;
    }
    return best;
  }
  const h = o.h;
  const candidates = [uiColor({ l: 0.16, c: Math.min(o.c, 0.03), h }), uiColor({ l: 0.985, c: Math.min(o.c, 0.012), h }), "#000000", "#ffffff"];
  let best = candidates[0]!;
  let bestC = 0;
  for (const c of candidates) {
    const v = minContrast(c, list);
    if (v >= min) return c;
    if (v > bestC) {
      bestC = v;
      best = c;
    }
  }
  return best;
}

/**
 * Readable text color for a background, tinted with `hue`. Prefers light text on saturated
 * mid/dark colors (reads "designed"), dark text otherwise; always ≥ `min` (falls back to pure
 * black/white, which guarantees ≥ 4.58:1 against any single color).
 */
export function onColor(bg: Hex, opts: { hue?: number; chroma?: number; min?: number; prefer?: "auto" | "light" | "dark" } = {}): Hex {
  const min = opts.min ?? 4.5;
  const bgO = toOklch(bg);
  const hue = opts.hue ?? bgO.h;
  const chroma = opts.chroma ?? Math.min(0.03, bgO.c * 0.35);
  const light = uiColor({ l: 0.985, c: Math.min(chroma, 0.014), h: hue });
  const dark = uiColor({ l: 0.2, c: Math.min(chroma, 0.045), h: hue });
  const cl = contrast(light, bg);
  const cd = contrast(dark, bg);
  let pick: Hex;
  if (opts.prefer === "light") pick = cl >= min ? light : cd >= min ? dark : cl >= cd ? light : dark;
  else if (opts.prefer === "dark") pick = cd >= min ? dark : cl >= min ? light : cd >= cl ? dark : light;
  else if (cl >= min && bgO.l < 0.7) pick = light;
  else pick = cd >= cl ? dark : light;
  if (contrast(pick, bg) >= min) return pick;
  const fixed = ensureContrast(pick, bg, min);
  if (contrast(fixed, bg) >= min) return fixed;
  return contrast("#ffffff", bg) >= contrast("#000000", bg) ? "#ffffff" : "#000000";
}

/* ------------------------------------------------------------------ */
/* Scales                                                              */
/* ------------------------------------------------------------------ */

export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];
export type Scale = Record<ScaleStep, Hex>;

/** Target lightness per step (perceptually even in OKLCH, with tighter spacing at the ends). */
const SCALE_L: Record<ScaleStep, number> = {
  50: 0.975,
  100: 0.94,
  200: 0.885,
  300: 0.81,
  400: 0.72,
  500: 0.63,
  600: 0.545,
  700: 0.46,
  800: 0.38,
  900: 0.3,
  950: 0.22,
};

/**
 * 11-step scale (50…950) around a color. The step whose lightness is closest to the source keeps
 * the exact source color; chroma eases out toward the light end (pastels stay delicate) and less
 * toward the dark end. Yellows warm as they darken (avoids muddy olive darks) — into deep bronze, at
 * neutral chroma: a dark yellow never turns amber or brown-orange (no-orange rule). Every step is a
 * UI color (outside the orange band).
 */
export function colorScale(sourceIn: Hex): Scale {
  const source = noOrange(sourceIn.toLowerCase());
  const o = toOklch(source);
  const out = {} as Scale;
  let anchor: ScaleStep = 500;
  let best = Infinity;
  for (const s of SCALE_STEPS) {
    const d = Math.abs(SCALE_L[s] - o.l);
    if (d < best) {
      best = d;
      anchor = s;
    }
  }
  const isYellow = o.c > 0.04 && o.h > 70 && o.h < 115;
  for (const s of SCALE_STEPS) {
    if (s === anchor) {
      out[s] = source;
      continue;
    }
    const L = SCALE_L[s];
    const lighter = L > o.l;
    const span = lighter ? Math.max(0.985 - o.l, 0.02) : Math.max(o.l - 0.16, 0.02);
    const t = clamp(Math.abs(L - o.l) / span, 0, 1);
    const ease = 1 - t ** 1.6 * (lighter ? 0.86 : 0.42);
    const h = isYellow && !lighter ? lerpHue(o.h, 62, t * 0.6) : o.h;
    // warmed into the band → bronze at neutral chroma (the band only allows ≤ 0.06 there)
    const c = h >= ORANGE_GUARD.hueMin && h <= ORANGE_GUARD.hueMax + 4 ? Math.min(o.c * ease, 0.052) : o.c * ease;
    out[s] = uiColor({ l: L, c, h });
  }
  return out;
}

/**
 * Tinted neutral scale for a hue: never pure gray (chroma ≥ 0.004), slightly more chroma in the
 * darks so inks read as "colored black" rather than dead gray.
 */
export function neutralScale(hue: number, chroma: number): Scale {
  const out = {} as Scale;
  const c0 = Math.max(0.004, chroma);
  for (const s of SCALE_STEPS) {
    const L = SCALE_L[s];
    const c = Math.max(0.004, c0 * (0.75 + 0.55 * (1 - L)));
    out[s] = uiColor({ l: L, c, h: hue });
  }
  return out;
}

/** Alpha as emitted in CSS (3 decimals) — solvers use it so checks see exactly what browsers get. */
export const roundAlpha = (alpha: number) => Math.round(clamp(alpha, 0, 1) * 1000) / 1000;

/** "#rrggbb" + alpha → `rgb(r g b / a)` (for shadows, glass and light fields). */
export function rgba(hex: Hex, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${roundAlpha(alpha).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")})`;
}

/**
 * `fg` at `alpha` over an opaque `bg`, blended the way browsers composite CSS colors (source-over in
 * gamma-encoded sRGB) and quantized to 8 bits — the color a reader actually sees.
 */
export function composite(fg: Hex, alpha: number, bg: Hex): Hex {
  const a = roundAlpha(alpha);
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return rgbToHex(f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a));
}
