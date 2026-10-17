/**
 * Rebuilds the dev-fixture photos in public/dev-fixtures from their recorded sources
 * (royalty-free, see public/dev-fixtures/CREDITS.md) and prints the asset rows that
 * src/lib/page/fixtures.ts embeds (FIXTURE_ASSETS).
 *
 *   npx tsx scripts/qa/fixture-images.ts            # download + process all
 *   npx tsx scripts/qa/fixture-images.ts --offline  # reprocess cached originals only
 *
 * Each photo becomes WebP renditions named like real media keys: "<assetId>-<width>.webp", where
 * assetId = sha256(master WebP)[0..32] — so fixtures exercise exactly the same srcset logic as live
 * assets. Originals are cached in qa/.fixture-cache (git-ignored). The derived photos of the Offers v2
 * fixtures (scripts/qa/fixture-derived.ts) are rebuilt from the new masters at the end.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { extractPalette } from "@/lib/theme";
import { buildDerived } from "./fixture-derived";

const ROOT = resolve(__dirname, "..", "..");
const OUT = join(ROOT, "public", "dev-fixtures");
const CACHE = join(ROOT, "qa", ".fixture-cache");
const WIDTHS = [480, 960, 1440];
const MASTER_MAX = 1440;

interface Source {
  name: string;
  /** Unsplash photo id */
  unsplash: string;
  alt: string;
}

const SOURCES: Source[] = [
  { name: "argan-amber", unsplash: "GDSNp1RJyLE", alt: "Amber dropper bottle on a wooden pedestal in palm-leaf shadows" },
  { name: "argan-stand", unsplash: "9nh0lK1FqGE", alt: "Amber dropper bottle on a turned wooden stand, close-up" },
  { name: "argan-flat", unsplash: "5lVlt93fn7w", alt: "Amber serum bottle with a white dropper, botanicals steeping inside" },
  { name: "massage-side", unsplash: "lG3CRe9sjuE", alt: "Matte black massage gun with a red ring, side view" },
  { name: "massage-detail", unsplash: "hMQsX8iGNQU", alt: "Close-up of the massage gun barrel and red accent ring" },
  { name: "blender-hand", unsplash: "daa-gr83Mf0", alt: "Portable blender filled with raspberries held outdoors" },
  { name: "blender-fruit", unsplash: "loyxR74E4vU", alt: "Blender cup filled with strawberries and mango on a cutting board" },
  { name: "parfum-glass", unsplash: "j1vg92xdoX4", alt: "Clear perfume bottle with a black cap on soft white fur" },
  { name: "parfum-tray", unsplash: "jSoc-A8rwfo", alt: "Amber perfume bottle on a mirrored tray with roses and pearls" },
];

async function original(src: Source, offline: boolean): Promise<Buffer> {
  const file = join(CACHE, `${src.unsplash}.jpg`);
  if (existsSync(file)) return readFileSync(file);
  if (offline) throw new Error(`${src.name}: no cached original (run without --offline)`);
  const res = await fetch(`https://unsplash.com/photos/${src.unsplash}/download?force=true&w=1800`, { redirect: "follow" });
  if (!res.ok) throw new Error(`${src.name}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, buf);
  return buf;
}

async function main() {
  const offline = process.argv.includes("--offline");
  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (f.endsWith(".webp")) rmSync(join(OUT, f));

  const rows: unknown[] = [];
  for (const src of SOURCES) {
    const input = await original(src, offline);
    const master = await sharp(input).rotate().resize({ width: MASTER_MAX, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const meta = await sharp(master).metadata();
    const W = meta.width ?? MASTER_MAX;
    const H = meta.height ?? MASTER_MAX;
    const id = createHash("sha256").update(master).digest("hex").slice(0, 32);
    const widths = [...new Set([...WIDTHS.filter((w) => w < W), W])];
    const variants = [];
    for (const w of widths) {
      const buf = w === W ? master : await sharp(master).resize({ width: w }).webp({ quality: 78 }).toBuffer();
      const h = Math.round((H * w) / W);
      const key = `${id}-${w}.webp`;
      writeFileSync(join(OUT, key), buf);
      variants.push({ key, w, h, fmt: "webp" as const });
    }
    const { data, info } = await sharp(master).resize(96, 96, { fit: "cover" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const palette = extractPalette(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), info.width, info.height);
    const { dominant } = await sharp(master).stats();
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    rows.push({
      name: src.name,
      id,
      width: W,
      height: H,
      alpha: false,
      dominant: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
      alt: src.alt,
      variants,
      palette: {
        ...palette,
        colors: palette.colors.slice(0, 5).map((c) => ({
          hex: c.hex,
          weight: +c.weight.toFixed(3),
          chroma: +c.chroma.toFixed(3),
          lightness: +c.lightness.toFixed(3),
          hue: Math.round(c.hue),
        })),
        colorfulness: +palette.colorfulness.toFixed(3),
        brightness: +palette.brightness.toFixed(3),
        warmth: +palette.warmth.toFixed(3),
      },
    });
    console.error(`  ${src.name}: ${id} ${W}×${H} → ${widths.join(", ")}`);
  }
  rows.push(...(await buildDerived(OUT)));
  process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
