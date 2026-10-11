/**
 * Product-photo palette extraction: deterministic k-means (seeded k-means++) in OKLab over the
 * non-transparent, non-background pixels of a downscaled RGBA buffer (e.g. 96×96 from a canvas).
 * Pure & allocation-light — runs in the admin's browser, a worker, or Node.
 */
import { z } from "zod";
import { clamp, fromOklab, hueDistance, normHue, rgb8ToOklab } from "./color";
import { mulberry32 } from "./rng";
import type { ExtractedPalette } from "./types";

const unit = z.number().finite().min(0).max(1);
/** Runtime schema for an ExtractedPalette coming back from storage / the network. */
export const ExtractedPaletteSchema = z.object({
  colors: z
    .array(
      z.object({
        hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        weight: unit,
        chroma: z.number().finite().min(0).max(0.5),
        lightness: unit,
        hue: z.number().finite().min(0).max(360),
      }),
    )
    .max(16),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  transparent: z.boolean(),
  colorfulness: unit,
  brightness: unit,
  warmth: z.number().finite().min(-1).max(1),
}) satisfies z.ZodType<ExtractedPalette>;

/** Validated palette, or null when the value is missing or malformed. */
export function parseExtractedPalette(value: unknown): ExtractedPalette | null {
  if (value == null) return null;
  const r = ExtractedPaletteSchema.safeParse(value);
  return r.success ? r.data : null;
}

const K = 6;
const MAX_SAMPLES = 16384;
const ALPHA_MIN = 128;
/** ΔEOK under which a pixel counts as "background" */
const BG_DIST = 0.055;
/** clusters closer than this are merged */
const MERGE_DIST = 0.04;

interface Px {
  l: number;
  a: number;
  b: number;
  w: number;
}

const dist2 = (p: Px, q: { l: number; a: number; b: number }) => (p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

function emptyPalette(transparent: boolean): ExtractedPalette {
  return { colors: [], background: null, transparent, colorfulness: 0, brightness: 0.5, warmth: 0 };
}

/**
 * Background = the dominant color of the border ring, if it covers most of the ring and is uniform
 * (studio sweep, white seamless, flat color). Returns its OKLab mean or null.
 */
function detectBackground(border: Px[]): { l: number; a: number; b: number } | null {
  if (border.length < 8) return null;
  // coarse OKLab binning → mode
  const bins = new Map<string, { n: number; l: number; a: number; b: number }>();
  for (const p of border) {
    const key = `${Math.round(p.l / 0.05)}:${Math.round(p.a / 0.03)}:${Math.round(p.b / 0.03)}`;
    const bin = bins.get(key) ?? { n: 0, l: 0, a: 0, b: 0 };
    bin.n++;
    bin.l += p.l;
    bin.a += p.a;
    bin.b += p.b;
    bins.set(key, bin);
  }
  let top: { n: number; l: number; a: number; b: number } | null = null;
  for (const bin of bins.values()) if (!top || bin.n > top.n) top = bin;
  if (!top) return null;
  const mean = { l: top.l / top.n, a: top.a / top.n, b: top.b / top.n };
  const close = border.filter((p) => dist2(p, mean) < BG_DIST * BG_DIST).length;
  return close / border.length >= 0.55 ? mean : null;
}

/** Seeded k-means++ initialisation + Lloyd iterations (weighted). */
function kmeans(px: Px[], k: number): { l: number; a: number; b: number; w: number }[] {
  const rng = mulberry32(0x5eed ^ px.length);
  const centers: { l: number; a: number; b: number }[] = [];
  const first = px[Math.floor(rng() * px.length)]!;
  centers.push({ l: first.l, a: first.a, b: first.b });
  const d2 = new Float64Array(px.length).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1]!;
    let total = 0;
    for (let i = 0; i < px.length; i++) {
      const v = Math.min(d2[i]!, dist2(px[i]!, c));
      d2[i] = v;
      total += v * px[i]!.w;
    }
    if (total <= 1e-12) break;
    let r = rng() * total;
    let idx = px.length - 1;
    for (let i = 0; i < px.length; i++) {
      r -= d2[i]! * px[i]!.w;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    const p = px[idx]!;
    centers.push({ l: p.l, a: p.a, b: p.b });
  }
  const assign = new Int32Array(px.length);
  const sums = centers.map(() => ({ l: 0, a: 0, b: 0, w: 0 }));
  for (let iter = 0; iter < 24; iter++) {
    for (const s of sums) s.l = s.a = s.b = s.w = 0;
    for (let i = 0; i < px.length; i++) {
      const p = px[i]!;
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const v = dist2(p, centers[c]!);
        if (v < bd) {
          bd = v;
          best = c;
        }
      }
      assign[i] = best;
      const s = sums[best]!;
      s.l += p.l * p.w;
      s.a += p.a * p.w;
      s.b += p.b * p.w;
      s.w += p.w;
    }
    let moved = 0;
    for (let c = 0; c < centers.length; c++) {
      const s = sums[c]!;
      if (s.w <= 0) continue;
      const n = { l: s.l / s.w, a: s.a / s.w, b: s.b / s.w };
      moved = Math.max(moved, dist2({ ...n, w: 1 }, centers[c]!));
      centers[c] = n;
    }
    if (moved < 1e-8) break;
  }
  return centers.map((c, i) => ({ ...c, w: sums[i]!.w })).filter((c) => c.w > 0);
}

/**
 * k-means palette extraction from raw RGBA pixels (downscaled, e.g. 96×96).
 * Deterministic: same pixels → same palette.
 */
export function extractPalette(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): ExtractedPalette {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error("extractPalette: invalid dimensions");
  if (rgba.length < width * height * 4) throw new Error("extractPalette: buffer smaller than width*height*4");

  const total = width * height;
  const step = Math.max(1, Math.ceil(Math.sqrt(total / MAX_SAMPLES)));
  const lab = [0, 0, 0];
  const fg: Px[] = [];
  const border: Px[] = [];
  let transparentPx = 0;
  let borderTransparent = 0;
  let borderCount = 0;
  let sampled = 0;
  const ring = Math.max(1, Math.round(Math.min(width, height) * 0.03));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const alpha = rgba[i + 3]!;
      const onBorder = x < ring || y < ring || x >= width - ring || y >= height - ring;
      sampled++;
      if (onBorder) borderCount++;
      if (alpha < ALPHA_MIN) {
        transparentPx++;
        if (onBorder) borderTransparent++;
        continue;
      }
      rgb8ToOklab(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, lab);
      const p = { l: lab[0]!, a: lab[1]!, b: lab[2]!, w: alpha / 255 };
      fg.push(p);
      if (onBorder) border.push(p);
    }
  }

  const transparent = transparentPx / sampled > 0.04 && (borderCount === 0 || borderTransparent / borderCount > 0.3);
  if (fg.length === 0) return emptyPalette(transparent);

  const bgLab = transparent ? null : detectBackground(border);
  let subject = bgLab ? fg.filter((p) => dist2(p, bgLab) >= BG_DIST * BG_DIST) : fg;
  // a white product on a white sweep: too little left — analyse everything instead
  if (subject.length < fg.length * 0.04) subject = fg;

  let clusters = kmeans(subject, Math.min(K, subject.length));
  // merge near-duplicates (heavier absorbs lighter)
  clusters.sort((x, y) => y.w - x.w);
  const merged: typeof clusters = [];
  for (const c of clusters) {
    const host = merged.find((m) => dist2({ ...c }, m) < MERGE_DIST * MERGE_DIST);
    if (host) {
      const w = host.w + c.w;
      host.l = (host.l * host.w + c.l * c.w) / w;
      host.a = (host.a * host.w + c.a * c.w) / w;
      host.b = (host.b * host.w + c.b * c.w) / w;
      host.w = w;
    } else merged.push({ ...c });
  }
  clusters = merged;

  const wSum = clusters.reduce((s, c) => s + c.w, 0) || 1;
  // visual importance: pixel share boosted by chroma (a small vivid label beats a large gray cap)
  const colors = clusters
    .map((c) => {
      const chroma = Math.hypot(c.a, c.b);
      const hue = chroma < 1e-4 ? 0 : normHue((Math.atan2(c.b, c.a) * 180) / Math.PI);
      const weight = c.w / wSum;
      const color = {
        hex: fromOklab({ l: c.l, a: c.a, b: c.b }),
        weight: Math.round(weight * 1000) / 1000,
        chroma: Math.round(chroma * 1000) / 1000,
        lightness: Math.round(clamp(c.l, 0, 1) * 1000) / 1000,
        hue: Math.round(hue * 10) / 10,
      };
      return { color, importance: weight * (1 + (3 * Math.min(chroma, 0.25)) / 0.25) };
    })
    .sort((x, y) => y.importance - x.importance)
    .map((x) => x.color);

  // global metrics over subject pixels
  let wTot = 0;
  let cSum = 0;
  let lSum = 0;
  let warmSum = 0;
  for (const p of subject) {
    const c = Math.hypot(p.a, p.b);
    wTot += p.w;
    cSum += c * p.w;
    lSum += p.l * p.w;
    if (c > 0.01) {
      const h = (Math.atan2(p.b, p.a) * 180) / Math.PI;
      // +1 at orange (~55°), −1 at cyan-blue (~235°)
      warmSum += c * p.w * (1 - hueDistance(h, 55) / 90);
    }
  }
  const meanC = cSum / wTot;
  const direction = cSum > 0 ? warmSum / cSum : 0;

  return {
    colors,
    background: bgLab ? fromOklab(bgLab) : null,
    transparent,
    colorfulness: Math.round(clamp(meanC / 0.2, 0, 1) * 1000) / 1000,
    brightness: Math.round(clamp(lSum / wTot, 0, 1) * 1000) / 1000,
    warmth: Math.round(clamp(direction * Math.min(1, meanC / 0.06), -1, 1) * 1000) / 1000,
  };
}
