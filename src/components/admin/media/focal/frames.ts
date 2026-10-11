/**
 * The frame shapes landing pages crop images into (DESIGN.md §5: arch, circle, rounded, portrait,
 * landscape), cropped by the kit's own engine (src/lib/media/focus.ts fitFrame) so the previews
 * show exactly what pages show, and a check of what each crop keeps: heads, hands, the product.
 *
 * Two modes, as in the renderer: AUTO (the AssetRef has no fx/fy) — the engine fits every frame to
 * the analysed subject, heads and hands; CUSTOM (fx/fy set by the team) — every frame centres on
 * that point as well as it can, nothing else.
 */
import { CENTER_CROP, FRAME_PRESETS, FULL_BOX, fitFrame, framePointOf, type AssetFocus, type Box, type Crop, type CropSubject, type FrameSpec as EngineFrame } from "@/lib/media/focus";

export type FrameId = "arch" | "circle" | "rounded" | "portrait" | "landscape";

export interface PreviewFrame {
  id: FrameId;
  label: string;
  /** width / height */
  ratio: number;
  spec: EngineFrame & { ratio: number };
}

export interface FocalPoint {
  x: number;
  y: number;
}

export const FRAMES: readonly PreviewFrame[] = [
  { id: "arch", label: "Arch", ratio: 3 / 4, spec: { shape: "arch", ratio: 3 / 4 } },
  { id: "circle", label: "Circle", ratio: 1, spec: { ...FRAME_PRESETS.circle, ratio: 1 } },
  { id: "rounded", label: "Square", ratio: 1, spec: { ...FRAME_PRESETS.square, ratio: 1 } },
  { id: "portrait", label: "Portrait", ratio: 4 / 5, spec: { ...FRAME_PRESETS.portrait, ratio: 4 / 5 } },
  { id: "landscape", label: "Wide", ratio: 16 / 10, spec: { ...FRAME_PRESETS.landscape, ratio: 16 / 10 } },
];

/** CSS border-radius of a frame drawn at w×h px (the kit's media radius, a touch rounder at thumbnail size). */
export function frameRadius(f: PreviewFrame, w: number, h: number): string {
  const r = Math.round(Math.max(3, 0.1 * Math.min(w, h)) * 10) / 10;
  if (f.spec.shape === "circle") return "50%";
  if (f.spec.shape === "arch") return `${w / 2}px ${w / 2}px ${r}px ${r}px`;
  return `${r}px`;
}

/** Is a frame point (u, v = fractions of the frame) inside the mask? Same geometry as the engine. */
export function insideFrame(f: PreviewFrame, u: number, v: number): boolean {
  if (u < 0 || u > 1 || v < 0 || v > 1) return false;
  if (f.spec.shape === "circle") return (u - 0.5) ** 2 + (v - 0.5) ** 2 <= 0.25;
  if (f.spec.shape === "arch") {
    const F = f.ratio;
    const rx = F / 2;
    const ry = Math.min(F / 2, 1);
    if (v >= ry) return true;
    return ((u * F - rx) / rx) ** 2 + ((v - ry) / ry) ** 2 <= 1;
  }
  return true;
}

/** What the engine needs about an image, in auto (point null) or custom mode. */
export function cropSubject(aspect: number, focus: AssetFocus | null, point: FocalPoint | null): CropSubject {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  if (point) {
    return { aspect: a, focal: point, subject: focus?.box ?? FULL_BOX, keep: focus?.keep ?? [], kind: focus?.kind ?? "none", fixed: true };
  }
  if (!focus) return { aspect: a, focal: { x: 0.5, y: 0.5 }, subject: FULL_BOX, keep: [], kind: "none" };
  return { aspect: a, focal: { x: focus.x, y: focus.y }, subject: focus.box, keep: focus.keep ?? [], kind: focus.kind };
}

/** The crop a page uses for this frame (transparent cutouts keep the classic centred crop in auto). */
export function cropFor(frame: PreviewFrame, s: CropSubject, alpha: boolean): Crop {
  if (alpha && !s.fixed) return CENTER_CROP;
  return fitFrame(s, frame.spec);
}

/** CSS for an <img> showing `crop` (object-position + the engine's zoom around the same anchor). */
export function cropStyle(c: Crop): { objectPosition: string; transform?: string; transformOrigin?: string } {
  const p = `${Math.round(c.x * 1000) / 10}% ${Math.round(c.y * 1000) / 10}%`;
  return c.zoom > 1.001 ? { objectPosition: p, transform: `scale(${c.zoom})`, transformOrigin: p } : { objectPosition: p };
}

/** The part of the image (0..1) a frame shows with `crop`. */
export function cropWindow(aspect: number, frame: PreviewFrame, c: Crop): Box {
  const ratio = frame.spec.shape === "circle" ? 1 : frame.ratio;
  // framePointOf maps image → frame (linear per axis): invert it from two corners
  const [u0, v0] = framePointOf(aspect, ratio, c, 0, 0);
  const [u1, v1] = framePointOf(aspect, ratio, c, 1, 1);
  const w = 1 / Math.max(1e-6, u1 - u0);
  const h = 1 / Math.max(1e-6, v1 - v0);
  return { x: -u0 * w, y: -v0 * h, w, h };
}

/** Share of the ellipse inscribed in `b` that the frame keeps (outline, inner ring, centre). */
function keptRound(aspect: number, frame: PreviewFrame, c: Crop, b: Box): number {
  const ratio = frame.spec.shape === "circle" ? 1 : frame.ratio;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  let inside = 0;
  let total = 0;
  const test = (x: number, y: number, w: number) => {
    total += w;
    const [u, v] = framePointOf(aspect, ratio, c, x, y);
    if (insideFrame(frame, u, v)) inside += w;
  };
  test(cx, cy, 1);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    test(cx + (Math.cos(a) * b.w) / 2, cy + (Math.sin(a) * b.h) / 2, 1);
    test(cx + (Math.cos(a) * b.w) / 4, cy + (Math.sin(a) * b.h) / 4, 0.5);
  }
  return inside / total;
}

export type FrameState = "ok" | "cut" | "tight";

export interface FrameVerdict {
  frame: PreviewFrame;
  crop: Crop;
  /** visible part of the image */
  window: Box;
  state: FrameState;
  /** what is cut when not ok */
  cut: "head" | "hand" | "product" | null;
}

/** What one crop cuts: a head (any part), a hand in half, or more than a sliver of the product. */
function cutOf(aspect: number, frame: PreviewFrame, c: Crop, focus: AssetFocus | null): FrameVerdict["cut"] {
  if (!focus) return null;
  for (const k of focus.keep ?? []) if (k.k === "head" && keptRound(aspect, frame, c, k.b) < 0.999) return "head";
  for (const k of focus.keep ?? []) {
    if (k.k !== "hand") continue;
    const f = keptRound(aspect, frame, c, k.b);
    if (f > 0.02 && f < 0.98) return "hand";
  }
  if (focus.kind === "product" || focus.kind === "cutout") {
    const item = focus.keep?.find((k) => k.k === "item")?.b ?? focus.box;
    if (keptRound(aspect, frame, c, item) < 0.9) return "product";
  }
  return null;
}

/**
 * Every preview frame with its crop and verdict. A cut the auto crop avoids is "cut" (fixable);
 * one the auto crop can't avoid either (the frame is too small for the photo) is "tight".
 */
export function judgeFrames(aspect: number, focus: AssetFocus | null, point: FocalPoint | null, alpha: boolean): FrameVerdict[] {
  const s = cropSubject(aspect, focus, point);
  const autoS = point ? cropSubject(aspect, focus, null) : s;
  return FRAMES.map((frame) => {
    const crop = cropFor(frame, s, alpha);
    const cut = cutOf(aspect, frame, crop, focus);
    let state: FrameState = cut ? "cut" : "ok";
    if (cut && (!point || cutOf(aspect, frame, cropFor(frame, autoS, alpha), focus))) state = "tight";
    return { frame, crop, window: cropWindow(aspect, frame, crop), state, cut };
  });
}

const list = (names: string[]) => (names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** One plain sentence about the crops, for the line under the previews. */
export function verdictSummary(verdicts: readonly FrameVerdict[], focus: AssetFocus | null, custom: boolean): string {
  if (!focus) return custom ? "Every frame centers on your point." : "Not analysed yet — frames center the photo. Click it to choose a point.";
  const heads = (focus.keep ?? []).filter((k) => k.k === "head").length;
  const cut = verdicts.filter((v) => v.state === "cut");
  const tight = verdicts.filter((v) => v.state === "tight");
  const what = heads > 1 ? "Every face stays" : heads === 1 ? "The face stays" : focus.kind === "scene" ? "The busiest part stays" : "The product stays";
  if (!cut.length && !tight.length) return `${what} whole in every frame.`;
  if (cut.length) {
    const thing = cut.some((v) => v.cut === "head") ? "a head" : cut.some((v) => v.cut === "hand") ? "a hand" : "the product";
    const who = cut.length === verdicts.length ? "Every frame cuts" : `${list(cut.map((v) => v.frame.label))} ${cut.length === 1 ? "cuts" : "cut"}`;
    return `${who} ${thing} at this point — Reset to auto keeps it whole.`;
  }
  const thing = tight.some((v) => v.cut === "head") ? "every head" : tight.some((v) => v.cut === "hand") ? "the hands" : "the whole product";
  return `${what} whole except in ${list(tight.map((v) => v.frame.label))} — too small to hold ${thing} in this photo.`;
}

/** The crop of one named preview frame (thumbnails cropped like the page crops them). */
export function previewCrop(id: FrameId, aspect: number, focus: AssetFocus | null, point: FocalPoint | null, alpha: boolean): Crop {
  const frame = FRAMES.find((f) => f.id === id) ?? FRAMES[2]!;
  return cropFor(frame, cropSubject(aspect, focus, point), alpha);
}
