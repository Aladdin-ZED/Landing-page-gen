/**
 * Subject analysis at upload (server side — sharp; no "server-only" marker so the backfill script
 * runs under plain `npx tsx`). Produces the AssetFocus stored per asset (see ./focus.ts).
 *
 *   analyzeImageFocus(pixels, { alpha })  → AssetFocus   (sharp input: raw RGBA or an encoded file)
 *   analyzeRgba(rgba, w, h, { alpha })    → AssetFocus   (pure: tests, tools)
 *
 * Transparent cutouts: the subject is the alpha bounding box (robust quantiles, stray specks
 * ignored), the focal point slightly above its middle, the footprint measured where it meets the floor.
 *
 * Photos, on a ≤ 256 px proxy in OKLab:
 *  1. backdrop model — k-means of the top and side borders (the bottom border is usually floor,
 *     table or the subject itself); every pixel's distance to the nearest backdrop colour;
 *  2. detail (Sobel energy of lightness, blurred) and colour prominence (chroma above the backdrop);
 *  3. skin — OKLCH hue 30–52°, chroma ≥ 0.048, chroma/lightness ≥ 0.07: separates faces and hands
 *     from beige/nude fabrics (chroma ≈ 0.035) and lace (hue ≈ 56°) on real abaya photos;
 *  4. saliency = backdrop distance ⊕ detail ⊕ prominence ⊕ skin, a mild centre prior, and sharp's
 *     attention point as a weak vote; components touching a side border in the outer band (plants,
 *     baskets, vases) are props and dropped unless they hold skin;
 *  5. people — skin components shaped like a face (compact, holes of darker features) are faces; the
 *     head box grows from the face up to where the silhouette ends (veil, hair) and out to the sides;
 *     the remaining skin blobs below a face are hands;
 *  6. subject box = weighted quantiles of the kept saliency mass (+ heads and hands), focal point =
 *     eyes level for people, saliency centroid nudged upward for products. A busy frame-filling
 *     photo is a "scene" (no cut-out subject): the focal point still follows the saliency.
 */
import sharp from "sharp";
import { FOCUS_VERSION, cleanBox, type AssetFocus, type Box, type KeepRegion } from "./focus";

const MAX_SIDE = 256;

export interface AnalyzeOptions {
  /** the image has real transparency (a background-removed cutout) */
  alpha: boolean;
  /** sharp attention point (0..1), used as a weak saliency vote */
  attention?: { x: number; y: number } | null;
}

/** sharp input → proxy RGBA → AssetFocus. `input` may be raw pixels (with `raw`) or an encoded image. */
export async function analyzeImageFocus(
  input: Buffer,
  opts: AnalyzeOptions & { raw?: { width: number; height: number; channels: 1 | 2 | 3 | 4 } },
): Promise<AssetFocus> {
  const base = () => (opts.raw ? sharp(input, { raw: opts.raw }) : sharp(input, { failOn: "error" }));
  const { data, info } = await base()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let attention: { x: number; y: number } | null = null;
  if (!opts.alpha) {
    try {
      // a square attention crop of the proxy: sharp reports the focal point it chose
      const side = Math.max(8, Math.round(Math.min(info.width, info.height) * 0.6));
      const att = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .removeAlpha()
        .resize(side, side, { fit: "cover", position: sharp.strategy.attention })
        .toBuffer({ resolveWithObject: true });
      const ax = (att.info as { attentionX?: number }).attentionX;
      const ay = (att.info as { attentionY?: number }).attentionY;
      if (typeof ax === "number" && typeof ay === "number") attention = { x: ax / info.width, y: ay / info.height };
    } catch {
      attention = null;
    }
  }
  return analyzeRgba(new Uint8Array(data.buffer, data.byteOffset, data.length), info.width, info.height, { alpha: opts.alpha, attention });
}

/* ------------------------------------------------------------------ */
/* colour                                                              */
/* ------------------------------------------------------------------ */

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

interface Lab {
  L: Float32Array;
  a: Float32Array;
  b: Float32Array;
  C: Float32Array;
  H: Float32Array;
  alpha: Uint8Array;
}

function toLab(rgba: Uint8Array, n: number): Lab {
  const L = new Float32Array(n);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  const C = new Float32Array(n);
  const H = new Float32Array(n);
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const R = LIN[rgba[i * 4]!]!;
    const G = LIN[rgba[i * 4 + 1]!]!;
    const B = LIN[rgba[i * 4 + 2]!]!;
    alpha[i] = rgba[i * 4 + 3]!;
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    const LL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const aa = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    L[i] = LL;
    a[i] = aa;
    b[i] = bb;
    C[i] = Math.hypot(aa, bb);
    H[i] = ((Math.atan2(bb, aa) * 180) / Math.PI + 360) % 360;
  }
  return { L, a, b, C, H, alpha };
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Separable box blur (radius r) of a w×h float map. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    let cnt = 0;
    for (let x = -r; x <= r; x++) if (x >= 0 && x < w) {
      acc += src[y * w + x]!;
      cnt++;
    }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / cnt;
      const xo = x - r;
      const xi = x + r + 1;
      if (xo >= 0) {
        acc -= src[y * w + xo]!;
        cnt--;
      }
      if (xi < w) {
        acc += src[y * w + xi]!;
        cnt++;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    let cnt = 0;
    for (let y = -r; y <= r; y++) if (y >= 0 && y < h) {
      acc += tmp[y * w + x]!;
      cnt++;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / cnt;
      const yo = y - r;
      const yi = y + r + 1;
      if (yo >= 0) {
        acc -= tmp[yo * w + x]!;
        cnt--;
      }
      if (yi < h) {
        acc += tmp[yi * w + x]!;
        cnt++;
      }
    }
  }
  return out;
}

function percentile(values: ArrayLike<number>, p: number): number {
  const arr = Array.from(values).sort((x, y) => x - y);
  if (!arr.length) return 0;
  return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))]!;
}

/** Weighted quantile of a 1-D mass distribution (index units). */
function massQuantile(mass: Float64Array, q: number): number {
  let total = 0;
  for (let i = 0; i < mass.length; i++) total += mass[i]!;
  if (total <= 0) return q < 0.5 ? 0 : mass.length - 1;
  const target = total * q;
  let acc = 0;
  for (let i = 0; i < mass.length; i++) {
    acc += mass[i]!;
    if (acc >= target) return i;
  }
  return mass.length - 1;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function box01(x0: number, y0: number, x1: number, y1: number, w: number, h: number): Box {
  const bx0 = Math.max(0, x0 / w);
  const by0 = Math.max(0, y0 / h);
  const bx1 = Math.min(1, (x1 + 1) / w);
  const by1 = Math.min(1, (y1 + 1) / h);
  return { x: r3(bx0), y: r3(by0), w: r3(Math.max(0.005, bx1 - bx0)), h: r3(Math.max(0.005, by1 - by0)) };
}

function unionBox(a: Box, b: Box): Box {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ------------------------------------------------------------------ */
/* connected components                                                */
/* ------------------------------------------------------------------ */

interface Component {
  n: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** member pixel indices */
  px: Int32Array;
}

function components(mask: Uint8Array, w: number, h: number, minSize: number): Component[] {
  const label = new Int32Array(mask.length).fill(-1);
  const out: Component[] = [];
  const stack = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    let sp = 0;
    stack[sp++] = start;
    label[start] = out.length;
    const members: number[] = [];
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    while (sp) {
      const p = stack[--sp]!;
      members.push(p);
      const x = p % w;
      const y = (p - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (mask[q] && label[q] === -1) {
            label[q] = out.length;
            stack[sp++] = q;
          }
        }
    }
    if (members.length >= minSize) out.push({ n: members.length, x0, y0, x1, y1, px: Int32Array.from(members) });
    else for (const p of members) label[p] = -2;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* cutouts                                                             */
/* ------------------------------------------------------------------ */

function analyzeCutout(lab: Lab, w: number, h: number): AssetFocus | null {
  const rows = new Float64Array(h);
  const cols = new Float64Array(w);
  let total = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = lab.alpha[y * w + x]! / 255;
      if (a < 0.1) continue;
      rows[y] += a;
      cols[x] += a;
      total += a;
    }
  if (total < w * h * 0.01) return null;
  const x0 = massQuantile(cols, 0.003);
  const x1 = massQuantile(cols, 0.997);
  const y0 = massQuantile(rows, 0.003);
  const y1 = massQuantile(rows, 0.997);
  const box = box01(x0, y0, x1, y1, w, h);
  let cx = 0;
  for (let x = 0; x < w; x++) cx += cols[x]! * (x + 0.5);
  cx /= total;
  // footprint: the opaque span along the bottom 6 % of the subject
  const fy0 = Math.max(y0, Math.round(y1 - (y1 - y0) * 0.06));
  const foot = new Float64Array(w);
  for (let y = fy0; y <= y1; y++) for (let x = 0; x < w; x++) if (lab.alpha[y * w + x]! >= 128) foot[x] += 1;
  const f0 = massQuantile(foot, 0.04);
  const f1 = massQuantile(foot, 0.96);
  return {
    v: FOCUS_VERSION,
    kind: "cutout",
    x: r3(cx / w),
    y: r3(box.y + box.h * 0.42),
    box,
    keep: [{ k: "item", b: box }],
    foot: [r3(f0 / w), r3(Math.min(1, (f1 + 1) / w))],
    conf: 0.95,
  };
}

/* ------------------------------------------------------------------ */
/* photos                                                              */
/* ------------------------------------------------------------------ */

/** k-means (deterministic farthest-point init) of OKLab samples → cluster centres with their share. */
function kmeans(samples: number[][], k: number): { c: number[]; share: number }[] {
  if (!samples.length) return [];
  const d2 = (p: number[], q: number[]) => (p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2 + (p[2]! - q[2]!) ** 2;
  // init: the sample closest to the mean, then farthest points
  const mean = [0, 0, 0];
  for (const s of samples) for (let i = 0; i < 3; i++) mean[i] += s[i]! / samples.length;
  let first = samples[0]!;
  for (const s of samples) if (d2(s, mean) < d2(first, mean)) first = s;
  const centres: number[][] = [first.slice()];
  while (centres.length < k) {
    let far = samples[0]!;
    let farD = -1;
    for (const s of samples) {
      let m = Infinity;
      for (const c of centres) m = Math.min(m, d2(s, c));
      if (m > farD) [farD, far] = [m, s];
    }
    if (farD < 1e-5) break;
    centres.push(far.slice());
  }
  const assign = new Int32Array(samples.length);
  for (let it = 0; it < 12; it++) {
    samples.forEach((s, i) => {
      let best = 0;
      let bd = Infinity;
      centres.forEach((c, j) => {
        const d = d2(s, c);
        if (d < bd) [bd, best] = [d, j];
      });
      assign[i] = best;
    });
    const sums = centres.map(() => [0, 0, 0, 0]);
    samples.forEach((s, i) => {
      const t = sums[assign[i]!]!;
      t[0] += s[0]!;
      t[1] += s[1]!;
      t[2] += s[2]!;
      t[3] += 1;
    });
    centres.forEach((c, j) => {
      const t = sums[j]!;
      if (t[3]) for (let q = 0; q < 3; q++) c[q] = t[q]! / t[3]!;
    });
  }
  const counts = new Array<number>(centres.length).fill(0);
  for (let i = 0; i < samples.length; i++) counts[assign[i]!]!++;
  return centres.map((c, j) => ({ c, share: counts[j]! / samples.length }));
}

interface Face {
  face: Box;
  head: Box;
  area: number;
}

function analyzePhoto(lab: Lab, w: number, h: number, attention: { x: number; y: number } | null): AssetFocus {
  const n = w * h;
  const { L, a, b, C, H } = lab;

  /* 1. backdrop model from the top and side borders */
  const bt = Math.max(2, Math.round(h * 0.03));
  const bs = Math.max(2, Math.round(w * 0.03));
  const samples: number[][] = [];
  const push = (i: number) => samples.push([L[i]!, a[i]!, b[i]!]);
  for (let y = 0; y < bt; y++) for (let x = 0; x < w; x += 1) push(y * w + x);
  for (let y = bt; y < Math.round(h * 0.85); y++) {
    for (let x = 0; x < bs; x++) push(y * w + x);
    for (let x = w - bs; x < w; x++) push(y * w + x);
  }
  const clusters = kmeans(samples, 4).filter((c) => c.share >= 0.1);
  const bgChroma = clusters.reduce((s, c) => s + Math.hypot(c.c[1]!, c.c[2]!) * c.share, 0) / Math.max(1e-6, clusters.reduce((s, c) => s + c.share, 0));
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = Infinity;
    for (const { c } of clusters) {
      const dL = L[i]! - c[0]!;
      const da = a[i]! - c[1]!;
      const db = b[i]! - c[2]!;
      // shading and soft shadows change lightness more than colour: weigh colour up
      m = Math.min(m, Math.sqrt(0.55 * dL * dL + 1.8 * (da * da + db * db)));
    }
    dist[i] = m;
  }
  const fg = new Float32Array(n);
  for (let i = 0; i < n; i++) fg[i] = smooth(0.03, 0.1, dist[i]!);

  /* 2. detail + colour prominence */
  const grad = new Float32Array(n);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = L[i - w + 1]! + 2 * L[i + 1]! + L[i + w + 1]! - L[i - w - 1]! - 2 * L[i - 1]! - L[i + w - 1]!;
      const gy = L[i + w - 1]! + 2 * L[i + w]! + L[i + w + 1]! - L[i - w - 1]! - 2 * L[i - w]! - L[i - w + 1]!;
      grad[i] = Math.hypot(gx, gy);
    }
  const gb = blur(grad, w, h, 2);
  const g95 = Math.max(0.02, percentile(gb, 0.95));
  const det = new Float32Array(n);
  for (let i = 0; i < n; i++) det[i] = Math.min(1, gb[i]! / g95);
  const prom = new Float32Array(n);
  for (let i = 0; i < n; i++) prom[i] = smooth(bgChroma + 0.02, bgChroma + 0.1, C[i]!);

  /* 3. skin */
  const skinRaw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const l = L[i]!;
    const c = C[i]!;
    const hue = H[i]!;
    skinRaw[i] = l >= 0.4 && l <= 0.95 && c >= 0.048 && c <= 0.17 && c / l >= 0.07 && hue >= 30 && hue <= 52 ? 1 : 0;
  }
  const skinB = blur(skinRaw, w, h, 1);
  const skin = new Uint8Array(n);
  for (let i = 0; i < n; i++) skin[i] = skinB[i]! >= 0.56 ? 1 : 0;

  /* 4. saliency */
  const S = new Float32Array(n);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = (x + 0.5) / w - 0.5;
      const dy = (y + 0.5) / h - 0.5;
      const centre = 0.72 + 0.28 * Math.exp(-(dx * dx) / 0.09 - (dy * dy) / 0.14);
      let s = Math.max(fg[i]! * (0.7 + 0.3 * det[i]!), 0.65 * det[i]! * (0.4 + 0.6 * fg[i]!), 0.8 * prom[i]!);
      if (skin[i]) s = Math.max(s, 1);
      if (attention) {
        const ax = (x + 0.5) / w - attention.x;
        const ay = (y + 0.5) / h - attention.y;
        s *= 1 + 0.12 * Math.exp(-(ax * ax + ay * ay) / 0.02);
      }
      S[i] = s * centre;
    }
  const Sb = blur(S, w, h, 2);
  const sMax = percentile(Sb, 0.995) || 1;
  const thr = Math.max(0.22, 0.3 * sMax);
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = Sb[i]! >= thr ? 1 : 0;
  const comps = components(mask, w, h, Math.max(4, Math.round(n * 0.002)));

  /* 5. people */
  const skinComps = components(skin, w, h, Math.max(3, Math.round(n * 0.0008)));
  const candidates: Face[] = [];
  for (const c of skinComps) {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    const aspect = bw / bh;
    const fill = c.n / (bw * bh);
    // a face is compact (amber bottles and arms are long), filled with skin around its features
    if (c.n < n * 0.0018 || aspect < 0.55 || aspect > 1.6 || fill < 0.32) continue;
    let mean = 0;
    for (const p of c.px) mean += L[p]!;
    mean /= c.n;
    // dark amber glass and wood pass the skin hue test: below this lightness ask for a clear face shape
    if (mean < 0.5 && (aspect < 0.62 || aspect > 1.4 || fill > 0.85)) continue;
    // darker features inside (eyes, brows, mouth): non-skin pixels clearly darker than the skin
    let dark = 0;
    let inner = 0;
    for (let y = c.y0 + Math.round(bh * 0.15); y <= c.y1 - Math.round(bh * 0.1); y++)
      for (let x = c.x0 + Math.round(bw * 0.12); x <= c.x1 - Math.round(bw * 0.12); x++) {
        const i = y * w + x;
        inner++;
        if (!skin[i] && L[i]! < mean - 0.12) dark++;
      }
    const darkShare = inner ? dark / inner : 0;
    if (darkShare < 0.006 || darkShare > 0.4) continue;
    // skin is a quiet colour (amber glass and honey are far more saturated), and a face has skin
    // down its middle between the eyes (the nose bridge) — a bottle's centre is its dark liquid
    let chroma = 0;
    for (const p of c.px) chroma += C[p]!;
    chroma /= c.n;
    let mid = 0;
    let midN = 0;
    for (let y = c.y0 + Math.round(bh * 0.22); y <= c.y0 + Math.round(bh * 0.55); y++)
      for (let x = c.x0 + Math.round(bw * 0.42); x <= c.x0 + Math.round(bw * 0.58); x++) {
        midN++;
        mid += skin[y * w + x]!;
      }
    if (chroma > 0.105 || (midN && mid / midN < 0.45)) continue;
    const face = box01(c.x0, c.y0, c.x1, c.y1, w, h);
    // grow the head up to where the silhouette ends (veil, hair), at most 0.95 face heights
    const cx0 = Math.max(0, Math.round(c.x0 + bw * 0.15));
    const cx1 = Math.min(w - 1, Math.round(c.x1 - bw * 0.15));
    let top = c.y0;
    let misses = 0;
    for (let y = c.y0 - 1; y >= Math.max(0, Math.round(c.y0 - bh * 0.95)); y--) {
      let on = 0;
      for (let x = cx0; x <= cx1; x++) if (fg[y * w + x]! > 0.5 || det[y * w + x]! > 0.35) on++;
      if (on / Math.max(1, cx1 - cx0 + 1) >= 0.3) {
        top = y;
        misses = 0;
      } else if (++misses >= 2) break;
    }
    top = Math.min(top, Math.round(c.y0 - bh * 0.2)); // hair or veil always rises above the skin
    const head = box01(Math.round(c.x0 - bw * 0.28), Math.max(0, top), Math.round(c.x1 + bw * 0.28), Math.min(h - 1, Math.round(c.y1 + bh * 0.1)), w, h);
    candidates.push({ face, head, area: c.n });
  }
  // clasped hands look like a face to a colour test: a candidate under another one (and overlapping
  // it sideways) belongs to that person's body — mother and daughter side by side stay two faces
  candidates.sort((p, q) => p.face.y - q.face.y);
  const faces: Face[] = [];
  for (const f of candidates) {
    const under = faces.some((g) => {
      const below = f.face.y > g.face.y + g.face.h * 1.15;
      const ox = Math.min(f.face.x + f.face.w, g.face.x + g.face.w) - Math.max(f.face.x, g.face.x);
      return below && ox > 0.3 * Math.min(f.face.w, g.face.w);
    });
    if (!under) faces.push(f);
  }
  // a face must be a real share of the largest one (drops skin-coloured specks that look like faces)
  const maxFace = faces.reduce((m, f) => Math.max(m, f.area), 0);
  const people = faces.filter((f) => f.area >= maxFace * 0.18).slice(0, 4);
  const keep: KeepRegion[] = people.map((f) => ({ k: "head" as const, b: f.head }));
  if (people.length) {
    const lowestFace = Math.min(...people.map((f) => f.face.y));
    for (const c of skinComps) {
      const bx = box01(c.x0, c.y0, c.x1, c.y1, w, h);
      if (people.some((f) => overlap(bx, f.head) > 0.3)) continue;
      if (bx.y < lowestFace || c.n < n * 0.0006) continue;
      // a hand is a real share of a face (≈ 25–50 %) and skin-quiet in colour; smaller warm patches
      // (a shadowed hem, a tan rug) are not
      let chroma = 0;
      for (const p of c.px) chroma += C[p]!;
      if (c.n < maxFace * 0.12 || chroma / c.n > 0.105) continue;
      const pad = 0.012;
      keep.push({ k: "hand", b: { x: bx.x - pad, y: bx.y - pad, w: bx.w + 2 * pad, h: bx.h + 2 * pad } });
      if (keep.length >= 10) break;
    }
  }

  /* 6. subject: drop props, weigh the rest */
  const total = comps.reduce((s, c) => s + c.n, 0) || 1;
  const kept = comps.filter((c) => {
    let skinN = 0;
    for (const p of c.px) skinN += skin[p]!;
    const cx = (c.x0 + c.x1 + 1) / 2 / w;
    const side = c.x0 <= 1 || c.x1 >= w - 2;
    const outer = cx < 0.24 || cx > 0.76;
    const holdsHead = keep.some((k) => k.k === "head" && overlap(box01(c.x0, c.y0, c.x1, c.y1, w, h), k.b) > 0.2);
    if (holdsHead) return true;
    if (side && outer && skinN < c.n * 0.02 && c.n < total * 0.4) return false;
    return c.n >= total * 0.015;
  });
  const colMass = new Float64Array(w);
  const rowMass = new Float64Array(h);
  let cx = 0;
  let cy = 0;
  let mass = 0;
  for (const c of kept)
    for (const p of c.px) {
      const s = Sb[p]!;
      const x = p % w;
      const y = (p - x) / w;
      colMass[x] += s;
      rowMass[y] += s;
      cx += s * (x + 0.5);
      cy += s * (y + 0.5);
      mass += s;
    }
  let box: Box;
  if (mass > 0) {
    box = box01(massQuantile(colMass, 0.02), massQuantile(rowMass, 0.02), massQuantile(colMass, 0.98), massQuantile(rowMass, 0.98), w, h);
    cx /= mass * w;
    cy /= mass * h;
  } else {
    box = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    cx = attention?.x ?? 0.5;
    cy = attention?.y ?? 0.5;
  }
  if (!people.length && mass > 0) {
    const stand = protrusion(kept, w, h);
    if (stand) {
      box = stand;
      cx = box.x + box.w / 2;
      cy = box.y + box.h * 0.45;
    }
  }
  for (const k of keep) box = unionBox(box, k.b);
  // breathing room around the subject
  const padX = Math.min(0.03, box.w * 0.04);
  const padY = Math.min(0.03, box.h * 0.04);
  box = cleanBox({ x: box.x - padX, y: box.y - padY, w: box.w + 2 * padX, h: box.h + 2 * padY }) ?? { x: 0, y: 0, w: 1, h: 1 };

  // separation: saliency inside the kept mass vs the backdrop
  let inS = 0;
  let inN = 0;
  let outS = 0;
  let outN = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i]) {
      inS += Sb[i]!;
      inN++;
    }
    else {
      outS += Sb[i]!;
      outN++;
    }
  }
  const conf = r3(Math.min(1, Math.max(0, (inN ? inS / inN : 0) - (outN ? outS / outN : 0)) * 1.4));

  const cleanKeep = keep.map((k) => ({ k: k.k, b: cleanBox(k.b) })).filter((k): k is KeepRegion => !!k.b);
  if (people.length) {
    // eyes level of the faces, weighted by size
    let fx = 0;
    let fy = 0;
    let fw = 0;
    for (const f of people) {
      fx += (f.face.x + f.face.w / 2) * f.area;
      fy += (f.face.y + f.face.h * 0.4) * f.area;
      fw += f.area;
    }
    return { v: FOCUS_VERSION, kind: "person", x: r3(fx / fw), y: r3(fy / fw), box, keep: cleanKeep, conf };
  }
  const scene = box.w * box.h > 0.7;
  let fx = scene ? cx : 0.65 * cx + 0.35 * (box.x + box.w / 2);
  let fy = scene ? cy : 0.6 * cy + 0.4 * (box.y + box.h * 0.45);
  if (scene) {
    // a busy frame-filling photo: the eye goes to its most salient compact spot (the product in a
    // hand, the glass on the table), not to the centre of everything — the core of the top 3 %
    const wide = blur(Sb, w, h, Math.max(2, Math.round(Math.max(w, h) * 0.04)));
    const cut = percentile(wide, 0.97);
    let sx = 0;
    let sy = 0;
    let sm = 0;
    for (let i = 0; i < n; i++) {
      if (wide[i]! < cut) continue;
      const x = i % w;
      const wgt = wide[i]! - cut + 1e-6;
      sx += wgt * (x + 0.5);
      sy += wgt * ((i - x) / w + 0.5);
      sm += wgt;
    }
    if (sm > 0) {
      fx = 0.7 * (sx / sm / w) + 0.3 * cx;
      fy = 0.7 * (sy / sm / h) + 0.3 * cy;
    }
  }
  return {
    v: FOCUS_VERSION,
    kind: scene ? "scene" : "product",
    x: r3(fx),
    y: r3(fy),
    box,
    ...(scene ? {} : { keep: [{ k: "item" as const, b: box }] }),
    conf,
  };
}

/**
 * A product standing on a surface that fills the bottom of the frame (fur, a table top, a floor):
 * the salient mass spans the whole width, so its box would be the surface. The product is where the
 * silhouette rises above the surface line — the widest contiguous run of columns whose top sits
 * clearly above the median top. Null when the mass is not shaped like that.
 */
function protrusion(kept: Component[], w: number, h: number): Box | null {
  if (!kept.length) return null;
  const x0 = Math.min(...kept.map((c) => c.x0));
  const x1 = Math.max(...kept.map((c) => c.x1));
  const y1 = Math.max(...kept.map((c) => c.y1));
  if (x0 > w * 0.04 || x1 < w * 0.96) return null;
  const tops = new Int32Array(w).fill(h);
  for (const c of kept)
    for (const p of c.px) {
      const x = p % w;
      const y = (p - x) / w;
      if (y < tops[x]!) tops[x] = y;
    }
  const sorted = Array.from(tops).sort((a, b) => a - b);
  const base = sorted[Math.floor(sorted.length / 2)]!;
  // the surface must be a lower band, and fairly flat at its edges
  if (base < h * 0.35) return null;
  const edge = [...Array.from(tops.slice(0, Math.round(w * 0.12))), ...Array.from(tops.slice(Math.round(w * 0.88)))];
  if (!edge.length || Math.min(...edge) < base - h * 0.08) return null;
  // clear glass lets the surface show through: tolerate short dips inside the product
  const maxGap = Math.max(2, Math.round(w * 0.03));
  let best: [number, number] | null = null;
  let start = -1;
  let gap = 0;
  for (let x = 0; x <= w; x++) {
    const up = x < w && tops[x]! < base - h * 0.06;
    if (up) {
      if (start < 0) start = x;
      gap = 0;
    } else if (start >= 0 && (++gap > maxGap || x === w)) {
      const end = x - gap;
      if (!best || end - start > best[1] - best[0]) best = [start, end];
      start = -1;
      gap = 0;
    }
  }
  if (!best) return null;
  const runW = best[1] - best[0] + 1;
  if (runW < w * 0.05 || runW > w * 0.75) return null;
  let top = h;
  for (let x = best[0]; x <= best[1]; x++) top = Math.min(top, tops[x]!);
  const padX = Math.round(runW * 0.06);
  return box01(Math.max(0, best[0] - padX), top, Math.min(w - 1, best[1] + padX), y1, w, h);
}

function overlap(p: Box, q: Box): number {
  const x0 = Math.max(p.x, q.x);
  const y0 = Math.max(p.y, q.y);
  const x1 = Math.min(p.x + p.w, q.x + q.w);
  const y1 = Math.min(p.y + p.h, q.y + q.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return ((x1 - x0) * (y1 - y0)) / Math.min(p.w * p.h, q.w * q.h);
}

/** Pure analysis of an RGBA proxy (≤ 256 px recommended). */
export function analyzeRgba(rgba: Uint8Array, width: number, height: number, opts: AnalyzeOptions): AssetFocus {
  const lab = toLab(rgba, width * height);
  if (opts.alpha) {
    const cut = analyzeCutout(lab, width, height);
    if (cut) return cut;
  }
  return analyzePhoto(lab, width, height, opts.attention ?? null);
}
