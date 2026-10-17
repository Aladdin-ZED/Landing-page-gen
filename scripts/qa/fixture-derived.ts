/**
 * Derived dev-fixture photos for the Offers v2 fixtures (src/lib/page/fixtures.ts: duo, tshirt, colors),
 * built offline from the Unsplash masters already in public/dev-fixtures (CREDITS.md) and from SVG:
 *
 *   duo-pair    16:9  two bottles side by side (argan-amber + parfum-glass): one photo, two products
 *   duo-serum   4:5   one amber dropper bottle (argan-stand, cropped)
 *   tee-noir    4:5   t-shirt mockup (vector, rendered), black
 *   tee-blanc   4:5   t-shirt mockup, off-white
 *   tee-gris    4:5   t-shirt mockup, grey
 *
 *   npx tsx scripts/qa/fixture-derived.ts      # writes the WebP renditions, prints the FIXTURE_ASSETS rows
 *
 * Same naming as real media keys ("<assetId>-<width>.webp", assetId = sha256(master WebP)[0..32]).
 * scripts/qa/fixture-images.ts runs it after rebuilding the sources.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { extractPalette } from "@/lib/theme";

const ROOT = resolve(__dirname, "..", "..");
const OUT_DEFAULT = join(ROOT, "public", "dev-fixtures");
const WIDTHS = [480, 960, 1440];

/** Source masters (1440 px renditions of the Unsplash photos). */
const SRC = {
  arganAmber: "998b0718f328c3caadde3ff7afbafd16",
  arganStand: "5fee6bf12dbbef51d30f2c9d5f251674",
  parfumGlass: "55e4c8246376fe46c9055d88b1387baf",
};

const master = (dir: string, id: string) => readFileSync(join(dir, `${id}-1440.webp`));

/** A region of a source photo resized to w × h (cover). */
async function region(buf: Buffer, crop: { left: number; top: number; width: number; height: number }, w: number, h: number): Promise<Buffer> {
  return sharp(buf).extract(crop).resize(w, h, { fit: "cover" }).toBuffer();
}

async function duoPair(dir: string): Promise<Buffer> {
  // left: the amber bottle (subject x 438–920, y 767–2160 of 1440×2160); right: the clear bottle (x 635–1089, y 853–1920 of 1440×1920)
  const left = await region(master(dir, SRC.arganAmber), { left: 12, top: 660, width: 1333, height: 1500 }, 720, 810);
  const right = await region(master(dir, SRC.parfumGlass), { left: 329, top: 720, width: 1067, height: 1200 }, 720, 810);
  return sharp({ create: { width: 1440, height: 810, channels: 3, background: "#e9e6e1" } })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: 720, top: 0 },
    ])
    .webp({ quality: 80 })
    .toBuffer();
}

async function duoSerum(dir: string): Promise<Buffer> {
  // the bottle on its stand (subject y 721–2151 of 1440×2160): a 4:5 frame from y 360
  return sharp(master(dir, SRC.arganStand)).extract({ left: 0, top: 360, width: 1440, height: 1800 }).webp({ quality: 80 }).toBuffer();
}

/** A clean front-view t-shirt mockup on a soft backdrop (no photo, no orange). */
function teeSvg(fill: string, edge: string, collar: string): string {
  const shirt =
    "M600 330 Q720 420 840 330 L1012 372 Q1060 386 1094 420 L1222 590 Q1236 610 1218 628 L1120 700 Q1100 714 1082 700 L1010 640 " +
    "L1012 1470 Q1012 1500 982 1500 L458 1500 Q428 1500 428 1470 L430 640 L358 700 Q340 714 320 700 L222 628 Q204 610 218 590 " +
    "L346 420 Q380 386 428 372 Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1800" viewBox="0 0 1440 1800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1efeb"/><stop offset="1" stop-color="#e3e0db"/></linearGradient>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.10"/></linearGradient>
    <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000000" stop-opacity="0.16"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="1440" height="1800" fill="url(#bg)"/>
  <ellipse cx="720" cy="1560" rx="430" ry="46" fill="url(#floor)"/>
  <path d="${shirt}" transform="translate(10 26)" fill="#000000" opacity="0.14" filter="url(#soft)"/>
  <path d="${shirt}" fill="${fill}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>
  <path d="${shirt}" fill="url(#shade)"/>
  <path d="M600 330 Q720 420 840 330 Q720 452 600 330 Z" fill="${collar}"/>
  <path d="M430 640 L430 700 M1010 640 L1010 700" stroke="${edge}" stroke-width="2" opacity="0.5"/>
</svg>`;
}

const tee = (fill: string, edge: string, collar: string) => sharp(Buffer.from(teeSvg(fill, edge, collar))).webp({ quality: 82 }).toBuffer();

interface Derived {
  name: string;
  alt: string;
  build: (dir: string) => Promise<Buffer>;
}

export const DERIVED: readonly Derived[] = [
  { name: "duo-pair", alt: "An amber dropper bottle and a clear glass bottle side by side", build: duoPair },
  { name: "duo-serum", alt: "Amber dropper bottle on a turned wooden stand", build: duoSerum },
  { name: "tee-noir", alt: "Black crew-neck t-shirt, front view", build: () => tee("#1c1c1e", "#0e0e0f", "#2a2a2d") },
  { name: "tee-blanc", alt: "Off-white crew-neck t-shirt, front view", build: () => tee("#f5f3ef", "#d6d2cb", "#e7e4de") },
  { name: "tee-gris", alt: "Grey crew-neck t-shirt, front view", build: () => tee("#8b8e93", "#6f7277", "#7c7f84") },
];

/** Writes every derived photo's renditions into `dir`; returns the FIXTURE_ASSETS rows. */
export async function buildDerived(dir = OUT_DEFAULT): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (const d of DERIVED) {
    const buf = await d.build(dir);
    const meta = await sharp(buf).metadata();
    const W = meta.width ?? 1440;
    const H = meta.height ?? 1440;
    const id = createHash("sha256").update(buf).digest("hex").slice(0, 32);
    const widths = [...new Set([...WIDTHS.filter((w) => w < W), W])];
    const variants = [];
    for (const w of widths) {
      const out = w === W ? buf : await sharp(buf).resize({ width: w }).webp({ quality: 78 }).toBuffer();
      const key = `${id}-${w}.webp`;
      writeFileSync(join(dir, key), out);
      variants.push({ key, w, h: Math.round((H * w) / W), fmt: "webp" as const });
    }
    const { data, info } = await sharp(buf).resize(96, 96, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const palette = extractPalette(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
    const { dominant } = await sharp(buf).stats();
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    rows.push({
      name: d.name,
      id,
      width: W,
      height: H,
      dominant: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
      alt: d.alt,
      widths,
      palette: {
        ...palette,
        colors: palette.colors.slice(0, 5).map((c) => ({ hex: c.hex, weight: +c.weight.toFixed(3), chroma: +c.chroma.toFixed(3), lightness: +c.lightness.toFixed(3), hue: Math.round(c.hue) })),
        colorfulness: +palette.colorfulness.toFixed(3),
        brightness: +palette.brightness.toFixed(3),
        warmth: +palette.warmth.toFixed(3),
      },
    });
    console.error(`  ${d.name}: ${id} ${W}×${H} → ${widths.join(", ")}`);
  }
  return rows;
}

if (process.argv[1] && /fixture-derived\.ts$/.test(process.argv[1])) {
  buildDerived()
    .then((rows) => process.stdout.write(JSON.stringify(rows, null, 2) + "\n"))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
