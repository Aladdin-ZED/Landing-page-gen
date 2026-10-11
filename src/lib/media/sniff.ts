/**
 * Content sniffing by magic bytes — the file name and client-declared MIME type are never trusted.
 * Accepted images: JPEG, PNG, WebP, AVIF. Accepted videos: MP4 (ISO-BMFF) and WebM (Matroska).
 */

export type SniffedKind =
  | { kind: "image"; format: "jpeg" | "png" | "webp" | "avif" }
  | { kind: "video"; format: "mp4" | "webm" };

const ascii = (buf: Buffer, start: number, end: number) => buf.toString("latin1", start, end);

/** ISO-BMFF "ftyp" brands (major + compatible). */
function ftypBrands(buf: Buffer): string[] | null {
  if (buf.length < 16 || ascii(buf, 4, 8) !== "ftyp") return null;
  const size = buf.readUInt32BE(0);
  if (size < 16 || size > 4096 || size > buf.length) return null;
  const brands = [ascii(buf, 8, 12)];
  for (let o = 16; o + 4 <= size; o += 4) brands.push(ascii(buf, o, o + 4));
  return brands;
}

const AVIF_BRANDS = new Set(["avif", "avis"]);
// HEIC/HEIF (iPhone default) is intentionally not accepted: no reliable decoder in prebuilt sharp.
const HEIF_ONLY = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
const MP4_BRANDS = new Set([
  "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso7", "iso8", "iso9",
  "mp41", "mp42", "mp71", "avc1", "dash", "M4V ", "M4VP", "MSNV", "mmp4", "f4v ",
]);

/** EBML header → DocType "webm" (searched within the header element only). */
function isWebm(buf: Buffer): boolean {
  if (buf.length < 32 || buf.readUInt32BE(0) !== 0x1a45dfa3) return false;
  const head = buf.subarray(0, Math.min(buf.length, 128));
  // DocType element id 0x4282, then a 1-byte size VINT (0x84 = 4 bytes) and "webm"
  const i = head.indexOf(Buffer.from([0x42, 0x82]));
  if (i < 0) return false;
  const j = head.indexOf("webm", i + 2, "latin1");
  return j > i && j <= i + 10;
}

export function sniff(buf: Buffer): SniffedKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: "image", format: "jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", format: "png" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { kind: "image", format: "webp" };
  const brands = ftypBrands(buf);
  if (brands) {
    if (brands.some((b) => AVIF_BRANDS.has(b))) return { kind: "image", format: "avif" };
    if (brands.some((b) => HEIF_ONLY.has(b))) return null;
    if (brands.some((b) => MP4_BRANDS.has(b))) return { kind: "video", format: "mp4" };
    return null;
  }
  if (isWebm(buf)) return { kind: "video", format: "webm" };
  return null;
}
