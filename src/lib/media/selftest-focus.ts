/**
 * Subject-aware cropping self-test (no database, no Next runtime):
 *   npx tsx src/lib/media/selftest-focus.ts
 *
 *  1. parseFocus — hostile / malformed JSON is clamped or rejected, never trusted.
 *  2. analyzeRgba — synthetic cutouts (alpha box, focal above the middle, footprint) and product
 *     photos on a plain backdrop (tight box, product focal).
 *  3. fitFrame — on the owner's real abaya analyses (child alone; mother + daughter): heads are never
 *     cut in rect / rounded / arch / circle / pill frames from 9:16 to 2:1 where they can fit, the
 *     un-zoomed window always contains the zoomed one, a product's top is kept when it cannot fit,
 *     tight thumbnails zoom a small product, merchant focal points are centred, `contain` never crops.
 *  4. robustCrop — one position that keeps the child's head in every everyday frame.
 *  5. <Picture> — frame / thumb / art direction emit the right custom properties and sizes.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Picture } from "@/landing/primitives/Picture";
import type { ResolvedAsset } from "@/landing/types";
import { FOCUS_VERSION, cropCost, fitFrame, framePointOf, parseFocus, robustCrop, type AssetFocus, type Box, type Crop, type CropSubject, type FrameShape } from "./focus";
import { analyzeRgba } from "./focus-analyze";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) passes++;
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (title: string) => console.log(`\n${title}`);

/* the owner's abaya photos, as analysed and stored (DB, FOCUS_VERSION 1) */
const BEIGE: AssetFocus = { v: 1, kind: "person", x: 0.497, y: 0.191, box: { x: 0.192, y: 0.009, w: 0.644, h: 0.989 }, keep: [{ k: "head", b: { x: 0.316, y: 0.039, w: 0.363, h: 0.289 } }, { k: "hand", b: { x: 0.485, y: 0.652, w: 0.17, h: 0.11 } }], conf: 0.538 };
const NAVY: AssetFocus = { v: 1, kind: "person", x: 0.418, y: 0.324, box: { x: 0.095, y: 0, w: 0.801, h: 1 }, keep: [{ k: "head", b: { x: 0.471, y: 0.004, w: 0.188, h: 0.258 } }, { k: "head", b: { x: 0.204, y: 0.344, w: 0.204, h: 0.211 } }, { k: "hand", b: { x: 0.576, y: 0.644, w: 0.124, h: 0.098 } }, { k: "hand", b: { x: 0.251, y: 0.808, w: 0.107, h: 0.087 } }], conf: 0.869 };
const ARGAN: AssetFocus = { v: 1, kind: "product", x: 0.489, y: 0.673, box: { x: 0.304, y: 0.355, w: 0.335, h: 0.645 }, keep: [{ k: "item", b: { x: 0.304, y: 0.355, w: 0.335, h: 0.645 } }], conf: 0.877 };

const subjectOf = (f: AssetFocus, aspect: number): CropSubject => ({ aspect, focal: { x: f.x, y: f.y }, subject: f.box, keep: f.keep ?? [], kind: f.kind });

/** Independent mask geometry (frame units: height 1, width F). */
function inMask(shape: FrameShape, F: number, X: number, Y: number): boolean {
  const e = 1e-6;
  if (X < -e || X > F + e || Y < -e || Y > 1 + e) return false;
  if (shape === "circle") return (X - F / 2) ** 2 + (Y - 0.5) ** 2 <= (Math.min(F, 1) / 2) ** 2 + e;
  if (shape === "arch") {
    const r = F / 2;
    return Y >= Math.min(r, 1) || ((X - r) / r) ** 2 + ((Y - Math.min(r, 1)) / Math.min(r, 1)) ** 2 <= 1 + e;
  }
  if (shape === "pill" && F <= 1) {
    const r = F / 2;
    const cy = Math.min(Math.max(Y, r), 1 - r);
    return (X - r) ** 2 + (Y - cy) ** 2 <= r * r + e;
  }
  return true; // rect / rounded (corner radius irrelevant for central heads)
}

/** Share of a head's inscribed ellipse inside the masked frame. */
function headShown(aspect: number, shape: FrameShape, F: number, c: Crop, b: Box): number {
  let n = 0;
  let inside = 0;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 12;
    const [u, t] = framePointOf(aspect, F, c, b.x + b.w / 2 + (Math.cos(a) * b.w) / 2, b.y + b.h / 2 + (Math.sin(a) * b.h) / 2);
    n++;
    if (inMask(shape, F, u * F, t)) inside++;
  }
  return inside / n;
}

/** Most heads one position can show whole (zoom 1) — two people may not both fit a banner. */
function bestHeadCount(aspect: number, shape: FrameShape, F: number, heads: readonly Box[]): number {
  let best = 0;
  for (let x = 0; x <= 1.0001; x += 0.02)
    for (let y = 0; y <= 1.0001; y += 0.02) best = Math.max(best, heads.filter((b) => headShown(aspect, shape, F, { x, y, zoom: 1 }, b) === 1).length);
  return best;
}

async function main(): Promise<void> {
  section("1. parseFocus");
  check("null / junk rejected", parseFocus(null) === null && parseFocus("x") === null && parseFocus({ v: 1 }) === null);
  const clamped = parseFocus({ v: 1, kind: "evil", x: 7, y: -3, box: { x: -1, y: 0.2, w: 5, h: 0.5 }, keep: [{ k: "head", b: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } }, { k: "script", b: {} }, "x"], conf: 9 });
  check("numbers clamped, kind defaulted, bad regions dropped", !!clamped && clamped.x === 1 && clamped.y === 0 && clamped.kind === "product" && clamped.box.x === 0 && clamped.box.w === 1 && clamped.keep?.length === 1 && clamped.conf === 1, JSON.stringify(clamped));
  check("degenerate box rejected", parseFocus({ v: 1, kind: "person", x: 0.5, y: 0.5, box: { x: 0.5, y: 0.5, w: 0, h: 0.3 }, conf: 0.5 }) === null);
  check("FOCUS_VERSION is a positive integer", Number.isInteger(FOCUS_VERSION) && FOCUS_VERSION >= 1);

  section("2. analyzeRgba");
  {
    // cutout: a T-shaped product standing on a narrow stem, transparent margins
    const W = 200;
    const H = 200;
    const px = new Uint8Array(W * H * 4);
    const fill = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          px[i] = 40;
          px[i + 1] = 42;
          px[i + 2] = 48;
          px[i + 3] = 255;
        }
    };
    fill(40, 40, 160, 80);
    fill(90, 80, 110, 180);
    const f = analyzeRgba(px, W, H, { alpha: true });
    check("cutout kind", f.kind === "cutout", f.kind);
    check("cutout box = alpha bounds", Math.abs(f.box.x - 0.2) < 0.02 && Math.abs(f.box.y - 0.2) < 0.02 && Math.abs(f.box.w - 0.6) < 0.03 && Math.abs(f.box.h - 0.7) < 0.03, JSON.stringify(f.box));
    check("cutout focal slightly above the middle", f.y < f.box.y + f.box.h / 2 && f.y > f.box.y + f.box.h * 0.3, String(f.y));
    check("cutout footprint = the stem", !!f.foot && Math.abs(f.foot[0] - 0.45) < 0.03 && Math.abs(f.foot[1] - 0.55) < 0.03, JSON.stringify(f.foot));
  }
  {
    // product photo: a dark bottle right of centre on a plain warm backdrop
    const W = 240;
    const H = 160;
    const px = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const bottle = x >= 150 && x < 182 && y >= 40 && y < 136;
        const cap = x >= 159 && x < 173 && y >= 26 && y < 40;
        px[i] = bottle ? 107 : cap ? 28 : 233;
        px[i + 1] = bottle ? 58 : cap ? 28 : 228;
        px[i + 2] = bottle ? 31 : cap ? 30 : 220;
        px[i + 3] = 255;
      }
    const f = analyzeRgba(px, W, H, { alpha: false });
    check("product kind", f.kind === "product", f.kind);
    check("product box hugs the bottle + cap", f.box.x > 0.55 && f.box.x + f.box.w < 0.83 && f.box.y < 0.2 && f.box.y + f.box.h > 0.8, JSON.stringify(f.box));
    check("product focal on the bottle", f.x > 0.6 && f.x < 0.76, String(f.x));
  }

  section("3. fitFrame — heads never cut");
  const shapes: FrameShape[] = ["rect", "rounded", "arch", "circle", "pill"];
  const ratios = [9 / 16, 3 / 4, 4 / 5, 1, 5 / 4, 3 / 2, 16 / 10, 2];
  let tested = 0;
  for (const [name, f, aspect] of [["beige", BEIGE, 853 / 1280], ["navy", NAVY, 1214 / 1295]] as const) {
    const s = subjectOf(f, aspect);
    for (const shape of shapes)
      for (const F0 of ratios) {
        const F = shape === "circle" ? 1 : F0;
        if (shape === "pill" && F > 1) continue;
        const heads = (f.keep ?? []).filter((k) => k.k === "head").map((k) => k.b);
        const possible = bestHeadCount(aspect, shape, F, heads);
        for (const maxZoom of [1, 1.18]) {
          const c = fitFrame(s, { shape, ratio: F, maxZoom });
          tested++;
          const shown = heads.filter((b) => headShown(aspect, shape, F, c, b) === 1).length;
          check(`${name} ${shape} ${F.toFixed(2)} z≤${maxZoom}: ${possible} head(s) whole`, shown >= possible, `${shown}/${possible} at ${JSON.stringify(c)}`);
          // engines without the zoom hook: the same position un-zoomed still shows them
          if (c.zoom > 1) check(`${name} ${shape} ${F.toFixed(2)}: heads whole un-zoomed`, heads.filter((b) => headShown(aspect, shape, F, { ...c, zoom: 1 }, b) === 1).length >= possible);
        }
      }
  }
  check(`frame cases exercised (${tested})`, tested > 120, String(tested));

  section("3a. fitFrame — never slice one face to save another");
  {
    // the face inside a head box (independent of the fitter's own faceCore): middle 60 % across,
    // from ~0.28 of the box height (below the veil / hair) to ~0.95
    const core = (b: Box): Box => ({ x: b.x + b.w * 0.2, y: b.y + b.h * 0.28, w: b.w * 0.6, h: b.h * 0.67 });
    const n = subjectOf(NAVY, 1214 / 1295);
    const heads = NAVY.keep!.filter((k) => k.k === "head").map((k) => k.b);
    for (const shape of ["rect", "rounded", "pill"] as FrameShape[])
      for (const F of [1.9, 2, 2.15, 2.4, 3])
        for (const maxZoom of [1, 1.18]) {
          const c = fitFrame(n, { shape, ratio: F, maxZoom });
          const faces = heads.map((b) => headShown(n.aspect, shape, F, c, core(b)));
          const sliced = faces.filter((f) => f > 0 && f < 1).length;
          check(`navy ${shape} ${F.toFixed(2)} z≤${maxZoom}: every face whole or fully out`, sliced === 0, `faces ${faces.map((f) => f.toFixed(2)).join("/")} at ${JSON.stringify(c)}`);
          check(`navy ${shape} ${F.toFixed(2)} z≤${maxZoom}: at least one face whole`, faces.some((f) => f === 1), `faces ${faces.map((f) => f.toFixed(2)).join("/")}`);
          // a head left out is left out entirely: no crown, veil or chin peeking in at the edge
          const peeks = heads.filter((b, i) => faces[i] === 0 && headShown(n.aspect, shape, F, c, b) > 0).length;
          check(`navy ${shape} ${F.toFixed(2)} z≤${maxZoom}: no head peeks in with its face out`, peeks === 0, `heads ${heads.map((b) => headShown(n.aspect, shape, F, c, b).toFixed(2)).join("/")} faces ${faces.map((f) => f.toFixed(2)).join("/")}`);
        }
    // the objective itself: a 1:2 portrait frame crops the photo across only, the mother's head whole in
    // every window below; the left edge moves right to left over the child's head:
    // child fully out < the veil's side in, face out < face half cut
    const o = { tight: false, zoomable: false };
    const F = 0.5;
    const vw = F / n.aspect;
    const [mother, child] = [heads[0]!, heads[1]!];
    const childFace = core(child);
    const at = (left: number) => cropCost(n, "rect", F, (left / (1 - vw)), 0.5, 1, o);
    const lefts = { out: child.x + child.w + 0.005, veil: childFace.x + childFace.w + (child.x + child.w - childFace.x - childFace.w) * 0.4, cut: childFace.x + childFace.w / 2 };
    check("objective setup: the mother's head is whole in every window", Object.values(lefts).every((l) => l <= mother.x && l + vw >= mother.x + mother.w), JSON.stringify(lefts));
    const [out, veil, cut] = [at(lefts.out), at(lefts.veil), at(lefts.cut)];
    check("cropCost: a head peeking in (face out) costs more than the second head fully excluded", veil > out, `veil ${veil.toFixed(0)} vs out ${out.toFixed(0)}`);
    check("cropCost: a half-cut second face costs more than a head peeking in", cut > veil, `cut ${cut.toFixed(0)} vs veil ${veil.toFixed(0)}`);
  }

  section("3b. fitFrame — windows, products, thumbs, merchant, contain");
  {
    const s = subjectOf(BEIGE, 853 / 1280);
    let contained = true;
    for (const z of [1.06, 1.18, 1.42])
      for (const x of [0, 0.3, 0.7, 1])
        for (const y of [0, 0.4, 1]) {
          const c: Crop = { x, y, zoom: z };
          const [zu0, zt0] = framePointOf(s.aspect, 1, c, 0, 0);
          const [u0, t0] = framePointOf(s.aspect, 1, { ...c, zoom: 1 }, 0, 0);
          // the image origin sits further out in the zoomed frame (its window is inside the plain one)
          if (zu0 > u0 + 1e-9 || zt0 > t0 + 1e-9) contained = false;
        }
    check("un-zoomed window contains the zoomed one", contained);
    const argan = subjectOf(ARGAN, 1440 / 2160);
    const wide = fitFrame(argan, { shape: "rounded", ratio: 16 / 10, maxZoom: 1 });
    const [, capT] = framePointOf(argan.aspect, 16 / 10, wide, 0.47, ARGAN.box.y + 0.01);
    check("a product too tall for the frame keeps its top (dropper)", capT >= 0 && capT < 0.3, `cap at ${capT.toFixed(3)} ${JSON.stringify(wide)}`);
    const small: CropSubject = { aspect: 1, focal: { x: 0.5, y: 0.5 }, subject: { x: 0.4, y: 0.35, w: 0.2, h: 0.3 }, keep: [{ k: "item", b: { x: 0.4, y: 0.35, w: 0.2, h: 0.3 } }], kind: "product" };
    const thumb = fitFrame(small, { shape: "rounded", ratio: 1, tight: true });
    check("thumb zooms a small product", thumb.zoom >= 1.5, JSON.stringify(thumb));
    const plain = fitFrame(small, { shape: "rounded", ratio: 1 });
    check("normal frames zoom with restraint", plain.zoom <= 1.18 + 1e-9, JSON.stringify(plain));
    const merchant = fitFrame({ ...small, focal: { x: 0.9, y: 0.2 }, fixed: true }, { shape: "rounded", ratio: 2 });
    check("merchant focal is centred (clamped)", merchant.zoom === 1 && merchant.y < 0.1, JSON.stringify(merchant));
    const contain = fitFrame(s, { shape: "circle", ratio: 1 }, "contain");
    check("contain never crops", contain.zoom === 1 && contain.x === s.focal.x);
    const none = fitFrame({ ...s, kind: "none", keep: [] }, { shape: "arch", ratio: 0.8 });
    check("unanalysed images keep the classic centred crop", none.x === 0.5 && none.y === 0.5 && none.zoom === 1);
  }

  section("4. robustCrop");
  {
    const s = subjectOf(BEIGE, 853 / 1280);
    const c = robustCrop(s);
    for (const shape of ["rect", "rounded", "arch"] as FrameShape[])
      for (const F of [9 / 16, 3 / 4, 4 / 5, 1, 5 / 4, 3 / 2, 16 / 10]) {
        check(`beige default position, ${shape} ${F.toFixed(2)}: head shown`, headShown(s.aspect, shape, F, c, BEIGE.keep![0]!.b) === 1, JSON.stringify(c));
      }
    const n = subjectOf(NAVY, 1214 / 1295);
    const cn = robustCrop(n);
    for (const F of [1, 5 / 4, 3 / 2, 16 / 10]) check(`navy default position, rect ${F.toFixed(2)}: mother's veil not cut`, headShown(n.aspect, "rect", F, cn, NAVY.keep![0]!.b) === 1, JSON.stringify(cn));
  }

  section("5. <Picture>");
  {
    const asset: ResolvedAsset = {
      id: "144e0e8df3fd4040fe8e70c15babe76d",
      alt: "Abaya",
      width: 853,
      height: 1280,
      alpha: false,
      dominant: "#c4bcb8",
      src: "/media/a-853.webp",
      srcsetWebp: "/media/a-360.webp 360w, /media/a-853.webp 853w",
      position: "40% 2%",
      aspect: 853 / 1280,
      focal: { x: BEIGE.x, y: BEIGE.y },
      focalSource: "auto",
      subject: BEIGE.box,
      keep: BEIGE.keep!,
      subjectKind: "person",
    };
    const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(Picture, { asset, sizes: "(min-width: 64rem) 30rem, 90vw", ...props } as never));
    const plain = html({ ratio: "4/5" });
    check("no frame → the asset's default position", plain.includes("--pic-pos:40% 2%") && !plain.includes("--pic-zoom"), plain);
    const circle = html({ frame: "circle" });
    check("frame → fitted position", /--pic-pos:[\d.]+% [\d.]+%/.test(circle) && !circle.includes("--pic-pos:40% 2%"), circle);
    const thumb = html({ ratio: 1, sizes: "56px" });
    check("small ratio'd picture → tight thumb with zoom + scaled sizes", thumb.includes("--pic-zoom") && thumb.includes("--pic-org") && thumb.includes("calc(56px * "), thumb);
    const art = html({ frame: "portrait", frameLg: "landscape" });
    check("art direction → viewport-switched clamp(), no zoom", art.includes("clamp(") && art.includes("100vw") && !art.includes("--pic-zoom"), art);
    const forced = html({ frame: "circle", position: "10% 90%" });
    check("explicit position wins", forced.includes("--pic-pos:10% 90%"), forced);
    const legacy = html({ ratio: 1, sizes: "56px", fit: "contain" });
    check("contain → untouched", legacy.includes("--pic-pos:40% 2%") && !legacy.includes("--pic-zoom"), legacy);
    const bare = renderToStaticMarkup(createElement(Picture, { asset: { ...asset, aspect: undefined, focal: undefined, subject: undefined, keep: undefined, subjectKind: undefined, focalSource: undefined } as unknown as ResolvedAsset, sizes: "56px", ratio: 1 }));
    check("hand-built assets without crop fields still render", bare.includes("<img") && bare.includes("--pic-pos:50% 50%"), bare);
  }

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
