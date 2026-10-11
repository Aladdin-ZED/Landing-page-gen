/**
 * Alpha-matte clean-up for product cutouts (pure, runs in the worker):
 *   - de-haze: near-transparent fringe → 0, near-opaque body → 255 (no grey halo on colored stages);
 *   - bounding box of the visible product, for auto-trim with even padding.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * In-place alpha clean-up of straight RGBA pixels. Returns the bounding box of the remaining
 * foreground, or null when nothing is left (no product detected).
 */
export function refineAlpha(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, low = 12, high = 243): Box | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  const span = high - low;
  for (let p = 0, i = 3; p < width * height; p++, i += 4) {
    const a = rgba[i]!;
    // remap the soft edge [low, high] to [0, 255] so edges stay smooth but the haze disappears
    const v = a <= low ? 0 : a >= high ? 255 : Math.round(((a - low) / span) * 255);
    rgba[i] = v;
    if (v > 24) {
      const x = p % width;
      const y = (p / width) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Bounding box grown by `pad` (fraction of the longer side), clamped to the image. */
export function padBox(box: Box, width: number, height: number, pad = 0.04): Box {
  const p = Math.round(Math.max(box.w, box.h) * pad);
  const x = Math.max(0, box.x - p);
  const y = Math.max(0, box.y - p);
  return { x, y, w: Math.min(width, box.x + box.w + p) - x, h: Math.min(height, box.y + box.h + p) - y };
}

/** Share of the image the product covers (0..1) — tiny results usually mean a failed matte. */
export const coverage = (box: Box, width: number, height: number) => (box.w * box.h) / Math.max(1, width * height);
