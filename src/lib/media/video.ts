/**
 * Minimal container inspection for uploaded videos (stored as-is, never transcoded).
 *
 *  - MP4 (ISO-BMFF): display size from the video track header (rotation-aware), codec check
 *    (HEVC, incl. Dolby Vision HEVC, is refused — poor browser support), and a privacy scrub built
 *    on an allow-list: at the top, moov, trak and mdia levels every box a player does not need
 *    (udta, meta, uuid/XMP, vendor boxes…) becomes a zero-filled `free` box. Tracks that are not
 *    video or sound (GoPro GPMF, DJI/camm telemetry, timecode, timed metadata) are removed and their
 *    samples zeroed inside mdat. Bytes after the last well-formed top-level box are dropped.
 *  - WebM (Matroska): display size from Tracks › TrackEntry › Video. Tags, Attachments, Chapters,
 *    Info › Title/DateUTC/file names and track names are overwritten with same-length EBML Void
 *    elements (their SeekHead entries too), so every Cues/SeekHead offset stays valid.
 *
 * The buffer is rewritten IN PLACE (callers hand over a private copy). Box and element walks are
 * bounded (no sibling arrays, a visit budget per file): a hostile file made of millions of tiny
 * boxes is rejected in milliseconds instead of building millions of objects.
 */
import { MediaError } from "./errors";

export interface VideoInfo {
  format: "mp4" | "webm";
  width: number;
  height: number;
  /** sanitized bytes to store (the input buffer, possibly shortened) */
  data: Buffer;
}

/** Siblings allowed in one container, and boxes/elements visited per file. Real files stay far below. */
export const MAX_SIBLINGS = 16_384;
export const MAX_VISITS = 262_144;
/** Sample-table steps (chunks + samples) walked when wiping a removed MP4 track. */
const MAX_SAMPLE_STEPS = 2_000_000;

interface Budget {
  left: number;
}

const invalid = () => new MediaError("invalid_video");

/* ------------------------------------------------------------------ */
/* MP4                                                                 */
/* ------------------------------------------------------------------ */

interface Box {
  type: string;
  start: number;
  /** first byte after the box header */
  body: number;
  end: number;
}

/** Child boxes of [start, end), one at a time; stops at the first malformed box. */
function* boxes(buf: Buffer, start: number, end: number, budget: Budget): Generator<Box> {
  let o = start;
  let n = 0;
  while (o + 8 <= end) {
    if (++n > MAX_SIBLINGS || --budget.left < 0) throw invalid();
    let size = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    let header = 8;
    if (size === 1) {
      if (o + 16 > end) return;
      const big = buf.readBigUInt64BE(o + 8);
      if (big > BigInt(end - o)) return;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < header || o + size > end) return;
    yield { type, start: o, body: o + header, end: o + size };
    o += size;
  }
}

function findBox(buf: Buffer, parent: Box | undefined, type: string, budget: Budget): Box | undefined {
  if (!parent) return undefined;
  for (const b of boxes(buf, parent.body, parent.end, budget)) if (b.type === type) return b;
  return undefined;
}

/** HEVC sample entries, incl. Dolby Vision (dvh1/dvhe — what iPhones record in HDR mode). */
const HEVC_ENTRIES = new Set(["hvc1", "hev1", "dvh1", "dvhe"]);

/** Boxes kept per level; anything else is blanked. `free`/`skip`/`wide` are already padding. */
const PAD = ["free", "skip", "wide"];
const KEEP_TOP = new Set(["ftyp", "styp", "moov", "mdat", "moof", "mfra", "sidx", "ssix", "pdin", ...PAD]);
const KEEP_MOOV = new Set(["mvhd", "trak", "mvex", "iods", ...PAD]);
const KEEP_TRAK = new Set(["tkhd", "mdia", "edts", "tref", ...PAD]);
const KEEP_MDIA = new Set(["mdhd", "hdlr", "minf", "elng", ...PAD]);
/** Track handlers kept: everything else (meta, text, sbtl, tmcd, camm…) can carry GPS or identity data. */
const AV_HANDLERS = new Set(["vide", "soun"]);

/** Turn a box into zero-filled padding of the same length (players skip `free`). */
function blank(buf: Buffer, b: Box): void {
  buf.write("free", b.start + 4, "latin1");
  buf.fill(0, b.body, b.end); // the bytes themselves are wiped, not just hidden
}

function scrubLevel(buf: Buffer, parent: Box, keep: ReadonlySet<string>, budget: Budget): void {
  for (const b of boxes(buf, parent.body, parent.end, budget)) if (!keep.has(b.type)) blank(buf, b);
}

const handlerOf = (buf: Buffer, hdlr: Box | undefined) =>
  hdlr && hdlr.body + 12 <= hdlr.end ? buf.toString("latin1", hdlr.body + 8, hdlr.body + 12) : "";

/** Sorted [start, end) byte ranges of the top-level mdat payloads. */
type Ranges = [number, number][];

/** Zero a sample's bytes, only inside an mdat payload (sample data never lives anywhere else). */
function zeroInMdat(buf: Buffer, mdats: Ranges, from: number, to: number): number {
  let lo = 0;
  let hi = mdats.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [s, e] = mdats[mid]!;
    if (from < s) hi = mid - 1;
    else if (from >= e) lo = mid + 1;
    else {
      const stop = Math.min(to, e);
      buf.fill(0, from, stop);
      return stop - from;
    }
  }
  return 0;
}

/**
 * Wipe every sample of a (non-fragmented) track from mdat, following stco/co64 + stsc + stsz/stz2.
 * Malformed or abusive tables (too many steps, overlapping samples) reject the file.
 */
function zeroTrackSamples(buf: Buffer, trak: Box, mdats: Ranges, budget: Budget): void {
  const mdia = findBox(buf, trak, "mdia", budget);
  const minf = findBox(buf, mdia, "minf", budget);
  const stbl = findBox(buf, minf, "stbl", budget);
  if (!stbl) return;
  const table: Partial<Record<"stsz" | "stz2" | "stsc" | "stco" | "co64", Box>> = {};
  for (const b of boxes(buf, stbl.body, stbl.end, budget)) {
    if (b.type === "stsz" || b.type === "stz2" || b.type === "stsc" || b.type === "stco" || b.type === "co64") table[b.type] ??= b;
  }
  const co = table.stco ?? table.co64;
  const sz = table.stsz ?? table.stz2;
  const sc = table.stsc;
  if (!co || !sz || !sc) return; // nothing addressable: the track box itself is blanked by the caller

  const need = (b: Box, bytes: number) => {
    if (b.body + bytes > b.end) throw invalid();
  };
  // chunk offsets
  need(co, 8);
  const chunkCount = buf.readUInt32BE(co.body + 4);
  const wide = co.type === "co64";
  need(co, 8 + chunkCount * (wide ? 8 : 4));
  const chunkOffset = (i: number) =>
    wide ? Number(buf.readBigUInt64BE(co.body + 8 + i * 8)) : buf.readUInt32BE(co.body + 8 + i * 4);
  // sample sizes
  need(sz, 12);
  const sampleCount = buf.readUInt32BE(sz.body + 8);
  let sampleSize: (i: number) => number;
  if (sz.type === "stsz") {
    const constant = buf.readUInt32BE(sz.body + 4);
    if (constant) sampleSize = () => constant;
    else {
      need(sz, 12 + sampleCount * 4);
      sampleSize = (i) => buf.readUInt32BE(sz.body + 12 + i * 4);
    }
  } else {
    const field = buf[sz.body + 7];
    if (field !== 4 && field !== 8 && field !== 16) throw invalid();
    need(sz, 12 + Math.ceil((sampleCount * field) / 8));
    const at = sz.body + 12;
    sampleSize =
      field === 16
        ? (i) => buf.readUInt16BE(at + i * 2)
        : field === 8
          ? (i) => buf[at + i]!
          : (i) => (i % 2 ? buf[at + (i >> 1)]! & 0x0f : buf[at + (i >> 1)]! >> 4);
  }
  // sample-to-chunk runs
  need(sc, 8);
  const runs = buf.readUInt32BE(sc.body + 4);
  need(sc, 8 + runs * 12);

  let sample = 0;
  let steps = 0;
  let zeroed = 0;
  for (let r = 0; r < runs && sample < sampleCount; r++) {
    const first = buf.readUInt32BE(sc.body + 8 + r * 12);
    const perChunk = buf.readUInt32BE(sc.body + 12 + r * 12);
    const nextFirst = r + 1 < runs ? buf.readUInt32BE(sc.body + 8 + (r + 1) * 12) : chunkCount + 1;
    for (let c = Math.max(1, first); c < nextFirst && c <= chunkCount && sample < sampleCount; c++) {
      if (++steps > MAX_SAMPLE_STEPS) throw invalid();
      let offset = chunkOffset(c - 1);
      for (let s = 0; s < perChunk && sample < sampleCount; s++) {
        if (++steps > MAX_SAMPLE_STEPS) throw invalid();
        const size = sampleSize(sample++);
        if (size && offset < buf.length) {
          zeroed += zeroInMdat(buf, mdats, offset, Math.min(buf.length, offset + size));
          if (zeroed > buf.length) throw invalid(); // overlapping samples: not a real file
        }
        offset += size;
      }
    }
  }
}

function inspectMp4(buf: Buffer): VideoInfo {
  const budget: Budget = { left: MAX_VISITS };
  let moov: Box | undefined;
  let hasMdat = false;
  let cleanEnd = 0;
  const mdats: Ranges = [];
  for (const b of boxes(buf, 0, buf.length, budget)) {
    cleanEnd = b.end;
    if (b.type === "moov") {
      if (moov) blank(buf, b); // players read the first movie box; a second one is only baggage
      else moov = b;
    } else if (b.type === "mdat") {
      hasMdat = true;
      mdats.push([b.body, b.end]);
    } else if (!KEEP_TOP.has(b.type)) blank(buf, b);
  }
  if (!moov || !hasMdat) throw invalid();

  const traks: Box[] = [];
  let fragmented = false;
  for (const b of boxes(buf, moov.body, moov.end, budget)) {
    if (b.type === "trak") traks.push(b);
    else if (b.type === "mvex") fragmented = true;
    else if (!KEEP_MOOV.has(b.type)) blank(buf, b);
  }

  let width = 0;
  let height = 0;
  let codec = "";
  for (const trak of traks) {
    const mdia = findBox(buf, trak, "mdia", budget);
    const handler = handlerOf(buf, findBox(buf, mdia, "hdlr", budget));
    if (!AV_HANDLERS.has(handler)) {
      // telemetry / metadata track: its samples sit in mdat — wipe them, then drop the track
      if (fragmented) throw new MediaError("video_track"); // samples spread over moof/traf runs
      zeroTrackSamples(buf, trak, mdats, budget);
      blank(buf, trak);
      continue;
    }
    scrubLevel(buf, trak, KEEP_TRAK, budget);
    if (mdia) scrubLevel(buf, mdia, KEEP_MDIA, budget);
    const tkhd = findBox(buf, trak, "tkhd", budget);
    if (handler !== "vide" || width || !mdia || !tkhd) continue;

    const v = buf[tkhd.body];
    const matrixAt = tkhd.body + (v === 1 ? 52 : 40);
    const sizeAt = tkhd.body + (v === 1 ? 88 : 76);
    if (sizeAt + 8 > tkhd.end) continue;
    let w = buf.readUInt32BE(sizeAt) >>> 16;
    let h = buf.readUInt32BE(sizeAt + 4) >>> 16;
    const a = buf.readInt32BE(matrixAt);
    const b = buf.readInt32BE(matrixAt + 4);
    if (a === 0 && Math.abs(b) === 0x10000) [w, h] = [h, w]; // 90°/270° rotation (portrait phone video)
    width = w;
    height = h;

    const minf = findBox(buf, mdia, "minf", budget);
    const stbl = findBox(buf, minf, "stbl", budget);
    const stsd = findBox(buf, stbl, "stsd", budget);
    if (stsd && stsd.body + 16 <= stsd.end) codec = buf.toString("latin1", stsd.body + 12, stsd.body + 16);
  }

  if (!width || !height || width > 8192 || height > 8192) throw invalid();
  if (HEVC_ENTRIES.has(codec)) throw new MediaError("video_codec");
  // trailing bytes after the last well-formed box can hide anything: they are not stored
  return { format: "mp4", width, height, data: cleanEnd < buf.length ? buf.subarray(0, cleanEnd) : buf };
}

/* ------------------------------------------------------------------ */
/* WebM                                                                */
/* ------------------------------------------------------------------ */

const ID = {
  ebml: 0x1a45dfa3,
  segment: 0x18538067,
  seekHead: 0x114d9b74,
  seek: 0x4dbb,
  seekId: 0x53ab,
  info: 0x1549a966,
  tracks: 0x1654ae6b,
  trackEntry: 0xae,
  trackName: 0x536e,
  video: 0xe0,
  pixelWidth: 0xb0,
  pixelHeight: 0xba,
  cluster: 0x1f43b675,
  cues: 0x1c53bb6b,
  chapters: 0x1043a770,
  attachments: 0x1941a469,
  tags: 0x1254c367,
  title: 0x7ba9,
  dateUtc: 0x4461,
  segmentFilename: 0x7384,
  prevFilename: 0x3c83bb,
  nextFilename: 0x3e83bb,
  crc32: 0xbf,
  void: 0xec,
} as const;

/** Segment children: inside an unknown-size Cluster, the first of these ends the cluster. */
const SEGMENT_LEVEL = new Set<number>([
  ID.seekHead, ID.info, ID.tracks, ID.cluster, ID.cues, ID.chapters, ID.attachments, ID.tags, ID.ebml, ID.segment,
]);
/** Whole Segment children removed: free-form metadata (location, names, dates, embedded files). */
const STRIP_SEGMENT = new Set<number>([ID.chapters, ID.attachments, ID.tags]);
/** Info children removed (MuxingApp/WritingApp are mandatory and only name the tool). */
const STRIP_INFO = new Set<number>([ID.title, ID.dateUtc, ID.segmentFilename, ID.prevFilename, ID.nextFilename]);

function vint(buf: Buffer, o: number, keepMarker: boolean): { value: number; len: number; unknown: boolean } | null {
  const first = buf[o];
  if (first === undefined || first === 0) return null;
  let len = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    mask >>= 1;
    len++;
  }
  if (len > 8 || o + len > buf.length) return null;
  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) {
    const byte = buf[o + i]!;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, len, unknown: !keepMarker && allOnes };
}

interface El {
  id: number;
  start: number;
  body: number;
  /** end of the element, clamped to its parent */
  end: number;
  /** size field is "unknown" (live/streamed files: Segment and Cluster only) */
  unknown: boolean;
}

function readEl(buf: Buffer, o: number, end: number): El | null {
  const id = vint(buf, o, true);
  if (!id || id.len > 4) return null;
  const size = vint(buf, o + id.len, false);
  if (!size) return null;
  const body = o + id.len + size.len;
  if (body > end) return null;
  return { id: id.value, start: o, body, end: size.unknown ? end : Math.min(end, body + size.value), unknown: size.unknown };
}

/** Children of a master element, one at a time; stops at the first malformed or unknown-size child. */
function* elements(buf: Buffer, start: number, end: number, budget: Budget): Generator<El> {
  let o = start;
  let n = 0;
  while (o < end) {
    if (++n > MAX_SIBLINGS || --budget.left < 0) throw invalid();
    const el = readEl(buf, o, end);
    if (!el) return;
    yield el;
    if (el.unknown) return;
    o = el.end;
  }
}

/** First Segment-level element after an unknown-size Cluster (or `end` when it runs to the end). */
function unknownClusterEnd(buf: Buffer, cluster: El, end: number, budget: Budget): number {
  for (const child of elements(buf, cluster.body, end, budget)) {
    if (SEGMENT_LEVEL.has(child.id)) return child.start;
    if (child.unknown) return end;
  }
  return end;
}

/** Overwrite [start, end) with one EBML Void element of exactly that length (≥ 2 bytes). */
function voidOut(buf: Buffer, start: number, end: number): void {
  const len = end - start;
  if (len < 2) return;
  buf.fill(0, start, end);
  buf[start] = ID.void;
  if (len - 2 <= 126) {
    buf[start + 1] = 0x80 | (len - 2); // 1-byte size (127 would mean "unknown")
  } else {
    buf[start + 1] = 0x01; // 8-byte size: payload length len - 9
    let v = len - 9;
    for (let i = 8; i >= 2; i--) {
      buf[start + i] = v % 256;
      v = Math.floor(v / 256);
    }
  }
}

/** Void the listed children of a master element (and its CRC-32, which would no longer match). */
function stripChildren(buf: Buffer, master: El, budget: Budget, drop: (child: El) => boolean): void {
  let crc: El | undefined;
  let changed = false;
  for (const child of elements(buf, master.body, master.end, budget)) {
    if (child.id === ID.crc32) crc ??= child;
    else if (drop(child)) {
      voidOut(buf, child.start, child.end);
      changed = true;
    }
  }
  if (changed && crc) voidOut(buf, crc.start, crc.end);
}

const uint = (buf: Buffer, el: El) => {
  let v = 0;
  for (let i = el.body; i < el.end && i < el.body + 8; i++) v = v * 256 + buf[i]!;
  return v;
};

function inspectWebm(buf: Buffer): VideoInfo {
  const budget: Budget = { left: MAX_VISITS };
  let segment: El | undefined;
  for (const el of elements(buf, 0, buf.length, budget)) {
    if (el.id === ID.segment) {
      segment = el;
      break;
    }
  }
  if (!segment) throw invalid();

  let width = 0;
  let height = 0;
  const seekHeads: El[] = [];
  let o = segment.body;
  let n = 0;
  while (o < segment.end) {
    if (++n > MAX_SIBLINGS || --budget.left < 0) throw invalid();
    const el = readEl(buf, o, segment.end);
    if (!el) break;
    if (STRIP_SEGMENT.has(el.id)) {
      if (el.unknown) throw invalid();
      voidOut(buf, el.start, el.end);
    } else if (el.id === ID.info) {
      stripChildren(buf, el, budget, (c) => STRIP_INFO.has(c.id));
    } else if (el.id === ID.seekHead) {
      seekHeads.push(el);
    } else if (el.id === ID.tracks) {
      for (const entry of elements(buf, el.body, el.end, budget)) {
        if (entry.id !== ID.trackEntry) continue;
        stripChildren(buf, entry, budget, (c) => c.id === ID.trackName);
        if (width) continue;
        const video = (() => {
          for (const c of elements(buf, entry.body, entry.end, budget)) if (c.id === ID.video) return c;
          return undefined;
        })();
        if (!video) continue;
        let w = 0;
        let h = 0;
        for (const f of elements(buf, video.body, video.end, budget)) {
          if (f.id === ID.pixelWidth) w = uint(buf, f);
          else if (f.id === ID.pixelHeight) h = uint(buf, f);
        }
        if (w > 0 && h > 0 && w <= 8192 && h <= 8192) [width, height] = [w, h];
      }
    }
    if (!el.unknown) o = el.end;
    else if (el.id === ID.cluster) o = unknownClusterEnd(buf, el, segment.end, budget);
    else break; // only Segment/Cluster may have an unknown size; nothing readable follows
  }

  // SeekHead entries that pointed at removed elements now point at Void: drop them too
  for (const head of seekHeads) {
    stripChildren(buf, head, budget, (seek) => {
      if (seek.id !== ID.seek) return false;
      for (const f of elements(buf, seek.body, seek.end, budget)) {
        if (f.id === ID.seekId) {
          const target = vint(buf, f.body, true);
          return !!target && STRIP_SEGMENT.has(target.value);
        }
      }
      return false;
    });
  }

  if (!width || !height) throw invalid();
  return { format: "webm", width, height, data: buf };
}

/** Inspect and scrub an uploaded video. `buf` is rewritten in place (pass a private copy). */
export function inspectVideo(buf: Buffer, format: "mp4" | "webm"): VideoInfo {
  try {
    return format === "mp4" ? inspectMp4(buf) : inspectWebm(buf);
  } catch (err) {
    if (err instanceof MediaError) throw err;
    throw invalid();
  }
}
