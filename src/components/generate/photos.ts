/**
 * Browser-side photo handling for the generator: decode (EXIF-aware), downscale to ≤ 2400 px before
 * upload, read the palette instantly from a 96 px copy, and pick the photo that will cut out best.
 * Browser only (canvas, createImageBitmap).
 */
import { extractPalette, type ExtractedPalette } from "@/lib/theme";

/** Longest side sent to the server (the server re-encodes and builds its own renditions). */
export const MAX_SIDE = 2400;
/** Dropped files above this are refused before decoding (they are downscaled before upload anyway). */
export const MAX_INPUT_MB = 40;
/** Palette sample size (the theme engine's k-means wants a small image). */
const SAMPLE = 96;
/** Formats the media API accepts as they are. */
const PASS_THROUGH = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
/** Small, accepted originals are uploaded untouched; anything heavier is re-encoded (server limit 15 MB). */
const PASS_THROUGH_MAX_BYTES = 6 * 1024 * 1024;

export interface PreparedPhoto {
  /** what to upload (the original file when it is already small enough and in an accepted format) */
  blob: Blob;
  width: number;
  height: number;
  palette: ExtractedPalette | null;
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(width));
  c.height = Math.max(1, Math.round(height));
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => c.toBlob(resolve, type, quality));
}

function paletteOf(source: CanvasImageSource, width: number, height: number): ExtractedPalette | null {
  try {
    const s = Math.min(1, SAMPLE / Math.max(width, height));
    const c = canvas(width * s, height * s);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    return extractPalette(data, c.width, c.height);
  } catch {
    // tainted canvas or a decoder hiccup: the theme engine works without a palette
    return null;
  }
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This file isn't an image the browser can read.");
  }
}

/** Decode, read the palette and downscale a dropped photo. */
export async function preparePhoto(file: Blob): Promise<PreparedPhoto> {
  const bitmap = await decode(file);
  try {
    const { width, height } = bitmap;
    const palette = paletteOf(bitmap, width, height);
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    if (scale === 1 && PASS_THROUGH.has(file.type) && file.size <= PASS_THROUGH_MAX_BYTES) return { blob: file, width, height, palette };
    const c = canvas(width * scale, height * scale);
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't resize this photo.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    // WebP keeps transparency; older encoders fall back to PNG (alpha) or JPEG
    let blob = await toBlob(c, "image/webp", 0.92);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(c, file.type === "image/png" ? "image/png" : "image/jpeg", 0.92);
    if (!blob) throw new Error("Your browser couldn't resize this photo.");
    return { blob, width: c.width, height: c.height, palette };
  } finally {
    bitmap.close();
  }
}

/** Fetch an image the admin already has (library asset, cutout) as a Blob. */
export async function fetchImage(url: string, signal?: AbortSignal): Promise<Blob> {
  const res = await fetch(url, { signal, credentials: "same-origin" });
  if (!res.ok) throw new Error("Couldn't read this photo from the library.");
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("This file isn't an image.");
  return blob;
}

/** Palette of an image blob (cutouts and library photos). */
export async function paletteOfBlob(blob: Blob): Promise<ExtractedPalette | null> {
  try {
    const bitmap = await decode(blob);
    try {
      return paletteOf(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

export interface CutoutCandidate {
  key: string;
  width: number;
  height: number;
  palette: ExtractedPalette | null;
}

/**
 * The photo most likely to give a clean cutout: a plain studio background (uniform corners, which
 * the palette extractor reports as `background`) and enough resolution, the main photo on ties.
 */
export function bestCutoutCandidate(photos: readonly CutoutCandidate[], mainKey: string | null): string | null {
  let best: { key: string; score: number } | null = null;
  for (const p of photos) {
    const plain = p.palette?.background ? 2 : 0;
    const sharp = Math.min(1, (p.width * p.height) / (1400 * 1400));
    const score = plain + sharp + (p.key === mainKey ? 0.35 : 0);
    if (!best || score > best.score) best = { key: p.key, score };
  }
  return best?.key ?? null;
}

/** Up to five swatches worth showing (heaviest first, near-duplicates dropped). */
export function swatches(palette: ExtractedPalette | null, max = 5): string[] {
  if (!palette) return [];
  const out: { hex: string; hue: number; lightness: number }[] = [];
  for (const c of palette.colors) {
    if (out.length >= max) break;
    const close = out.some((o) => Math.abs(o.lightness - c.lightness) < 0.06 && Math.min(Math.abs(o.hue - c.hue), 360 - Math.abs(o.hue - c.hue)) < 14);
    if (!close) out.push(c);
  }
  return out.map((c) => c.hex);
}
