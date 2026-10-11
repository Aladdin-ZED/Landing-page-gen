/**
 * Favicon set + web app manifest for an export: favicon.ico (16/32/48 PNG-in-ICO), the 180 px
 * apple-touch-icon, 192/512 px manifest icons and a maskable 512 px icon.
 *
 * Source: the store logo (contained on a rounded tile of the page background) or, without a logo,
 * the same monogram the renderer uses as the tab icon — the store initial on a soft-lit accent tile.
 * Node only (sharp).
 */
import sharp from "sharp";

export interface IconInput {
  /** store logo bytes (any format sharp reads), or null for the monogram */
  logo: Uint8Array | null;
  /** monogram letter (already upper-cased for the locale) */
  letter: string;
  /** #rrggbb theme colors */
  accent: string;
  accentInk: string;
  background: string;
}

export interface IconFiles {
  "favicon.ico": Uint8Array;
  "apple-touch-icon.png": Uint8Array;
  "icon-192.png": Uint8Array;
  "icon-512.png": Uint8Array;
  "icon-maskable-512.png": Uint8Array;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const color = (v: string, fallback: string) => (HEX6.test(v) ? v : fallback);
const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Tile SVG (512 × 512). `bleed` fills the whole square (maskable icons: the OS applies its own mask,
 * content stays inside the 80% safe zone); otherwise a continuous rounded square.
 */
function tileSvg(fill: string, opts: { bleed: boolean; glow: boolean }): string {
  const r = opts.bleed ? 0 : 116;
  const glow = opts.glow
    ? `<defs><radialGradient id="g" cx="28%" cy="22%" r="85%"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="512" height="512" rx="${r}" fill="url(#g)"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="${r}" fill="${fill}"/>${glow}</svg>`;
}

function monogramSvg(i: IconInput, bleed: boolean): string {
  const accent = color(i.accent, "#222222");
  const ink = color(i.accentInk, "#ffffff");
  const size = bleed ? 236 : 300;
  const letter = xml(i.letter || "*");
  return tileSvg(accent, { bleed, glow: true }).replace(
    "</svg>",
    `<text x="256" y="256" dy=".355em" text-anchor="middle" font-family="DejaVu Sans, Segoe UI, Helvetica Neue, Arial, Noto Sans Arabic, sans-serif" font-size="${size}" font-weight="700" fill="${ink}">${letter}</text></svg>`,
  );
}

async function render(i: IconInput, size: number, opts: { bleed?: boolean; transparent?: boolean } = {}): Promise<Buffer> {
  const bleed = !!opts.bleed;
  if (!i.logo) {
    return sharp(Buffer.from(monogramSvg(i, bleed))).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  }
  // logo: contained in the safe zone of a tile in the page background (transparent for tiny favicons)
  const inner = Math.round(size * (bleed ? 0.62 : opts.transparent ? 1 : 0.74));
  const logo = await sharp(Buffer.from(i.logo))
    .resize({ width: inner, height: inner, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const base = opts.transparent
    ? sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    : sharp(Buffer.from(tileSvg(color(i.background, "#ffffff"), { bleed, glow: false }))).resize(size, size);
  return base
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** ICO container holding PNG images (supported by every browser since IE Vista-era). */
export function packIco(images: { size: number; png: Uint8Array }[]): Uint8Array {
  const head = 6 + images.length * 16;
  const total = head + images.reduce((n, im) => n + im.png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = head;
  images.forEach((im, k) => {
    const e = 6 + k * 16;
    out[e] = im.size >= 256 ? 0 : im.size;
    out[e + 1] = im.size >= 256 ? 0 : im.size;
    out[e + 2] = 0;
    out[e + 3] = 0;
    view.setUint16(e + 4, 1, true);
    view.setUint16(e + 6, 32, true);
    view.setUint32(e + 8, im.png.length, true);
    view.setUint32(e + 12, offset, true);
    out.set(im.png, offset);
    offset += im.png.length;
  });
  return out;
}

export async function buildIcons(i: IconInput): Promise<IconFiles> {
  const icoSizes = [16, 32, 48];
  const ico = await Promise.all(icoSizes.map(async (size) => ({ size, png: new Uint8Array(await render(i, size, { transparent: !!i.logo })) })));
  const [apple, i192, i512, maskable] = await Promise.all([
    render(i, 180),
    render(i, 192),
    render(i, 512),
    render(i, 512, { bleed: true }),
  ]);
  return {
    "favicon.ico": packIco(ico),
    "apple-touch-icon.png": new Uint8Array(apple),
    "icon-192.png": new Uint8Array(i192),
    "icon-512.png": new Uint8Array(i512),
    "icon-maskable-512.png": new Uint8Array(maskable),
  };
}

export interface ManifestInput {
  name: string;
  lang: string;
  dir: "ltr" | "rtl";
  background: string;
  themeColor: string;
}

/** site.webmanifest — icons and colors; start_url/scope are the site root (relative to the manifest). */
export function webManifest(m: ManifestInput): string {
  const name = m.name.trim().slice(0, 60) || "Store";
  const short = Array.from(name).slice(0, 12).join("").trim();
  return `${JSON.stringify(
    {
      name,
      short_name: short,
      lang: m.lang,
      dir: m.dir,
      start_url: "./",
      scope: "./",
      display: "browser",
      background_color: color(m.background, "#ffffff"),
      theme_color: color(m.themeColor, "#ffffff"),
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  )}\n`;
}

/** Monogram letter exactly like the renderer's tab icon (first character, locale upper case). */
export function monogramLetter(storeName: string, productName: string, locale: string): string {
  return Array.from((storeName || productName).trim())[0]?.toLocaleUpperCase(locale) ?? "*";
}
