/**
 * showcase/hotspots — the product photo with numbered pins; on desktop each pin runs a precise
 * leader line (diagonal + level shelf, rounded knee) to a raised note card that overlaps the
 * photo's edge. Hovering a note or a pin lights up its pair. Phones and tablets: the pinned photo,
 * then the notes as one grouped list.
 *
 * The desktop composition is solved at render time in one coordinate system (% of the stage
 * width): plate size from the photo ratio, notes balanced left/right, their heights estimated
 * from the copy, the stage made tall enough for the fuller side, notes spread so they never
 * collide while staying level with their pin when they can. Every value is pure math on the
 * data, so publish, preview and export render identical markup.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Picture, clamp, cssVars, reveal, round, safeHex } from "@/landing/primitives";
import type { ResolvedAsset } from "../../types";
import { Action, DetailIndex, Head, PointCopy, framePoint, photoCrop, productVisual, type ViewProps } from "./shared";
import type { PointData } from "./schema";

/** Narrowest desktop stage width in rem (62rem viewport minus gutters and panel inset). */
const S0 = 55;
/** How far the notes reach over the photo, % of the stage width. */
const OVERLAP = 4;
/** Vertical gap between two notes on the same side, rem. */
const GAP = 1.25;

interface NoteBox {
  i: number;
  side: "l" | "r";
  /** estimated height at the narrowest desktop width, rem */
  h: number;
  /** wanted centre (level with the pin), rem from the stage top */
  want: number;
  /** final centre, rem */
  c: number;
}

export interface HotspotLayout {
  /** stage aspect ratio (width / height) */
  stage: number;
  /** plate box, % of the stage: left, width (of the width), top (of the height) */
  px0: number;
  pw: number;
  pt: number;
  /** note width, % of the stage width */
  nw: number;
  /** viewBox height of the leader overlay (the width is 100) */
  vbh: number;
  /** plate box in overlay units (for the photo / ground split of the lines) */
  box: { x: number; y: number; w: number; h: number };
  notes: { i: number; side: "l" | "r"; ly: number }[];
  lines: { i: number; d: string; ax: number; ay: number }[];
}

/**
 * Estimated note height (rem) at the narrowest desktop stage, from its copy: card padding, the
 * label lines and the text lines (metrics of showcase.css; Arabic sets taller lines).
 */
function noteHeight(p: PointData, nw: number, ar: boolean): number {
  const col = (nw / 100) * S0 - 2.3 - 2.25; // card padding, number badge + gap
  const labelLh = ar ? 1.68 : 1.5;
  const textLh = ar ? 1.75 : 1.45;
  const lines = (chars: number, cw: number) => Math.max(1, Math.ceil((chars * cw) / col));
  const text = p.text.trim();
  return 2.1 + lines(p.label.length, 0.64) * labelLh + (text ? 0.35 + lines(text.length, 0.45) * textLh : 0);
}

/** Notes keep their pin's height when they can and never overlap: a forward then a backward pass. */
function spread(list: NoteBox[], height: number): void {
  list.sort((a, b) => a.want - b.want);
  list.forEach((n, k) => {
    const prev = list[k - 1];
    n.c = Math.max(n.want, n.h / 2, prev ? prev.c + prev.h / 2 + GAP + n.h / 2 : 0);
  });
  for (let k = list.length - 1; k >= 0; k--) {
    const n = list[k]!;
    const next = list[k + 1];
    n.c = Math.min(n.c, height - n.h / 2, next ? next.c - next.h / 2 - GAP - n.h / 2 : Infinity);
  }
}

/** Diagonal from the pin to a knee level with the note, then a shelf into the note's edge. */
function leader(px: number, py: number, ax: number, ay: number): string | null {
  const dir = Math.sign(ax - px);
  const avail = Math.abs(ax - px);
  if (!dir || avail < 2.5) return null; // the pin sits under its note
  const dy = ay - py;
  const r2 = (v: number) => round(v, 2);
  if (Math.abs(dy) < 0.6) return `M${r2(px)} ${r2(py)}H${r2(ax)}`;
  const diag = Math.min(Math.abs(dy), avail - 2);
  if (diag < 0.6) return `M${r2(px)} ${r2(py)}L${r2(ax)} ${r2(ay)}`;
  const kx = px + dir * diag;
  const len = Math.hypot(kx - px, dy);
  const r = Math.min(1.4, len * 0.4, (avail - diag) * 0.5);
  const bx = kx - ((kx - px) / len) * r;
  const by = ay - (dy / len) * r;
  return `M${r2(px)} ${r2(py)}L${r2(bx)} ${r2(by)}Q${r2(kx)} ${r2(ay)} ${r2(kx + dir * r)} ${r2(ay)}H${r2(ax)}`;
}

export function hotspotLayout(points: readonly PointData[], ratio: number, ar: boolean): HotspotLayout {
  const r = clamp(ratio, 0.66, 1.6);
  // portrait photos stay narrower so the stage never towers over the viewport; wide shots get room
  const pw = r >= 1 ? Math.min(56, 52 + (r - 1) * 8) : 42 + ((r - 0.66) / 0.34) * 10;
  const px0 = (100 - pw) / 2;
  const nw = px0 + OVERLAP;
  const plateH = ((pw / 100) * S0) / r;

  // sides: by the pin's side of the photo, balanced so neither side holds more than half (+1)
  const order = points.map((p, i) => ({ i, x: p.x }));
  const left = order.filter((p) => p.x < 50);
  const right = order.filter((p) => p.x >= 50);
  const cap = Math.ceil(points.length / 2);
  while (left.length > cap) right.push(left.sort((a, b) => b.x - a.x).shift()!);
  while (right.length > cap) left.push(right.sort((a, b) => a.x - b.x).shift()!);

  const box = (side: "l" | "r") => (p: { i: number }): NoteBox => ({ i: p.i, side, h: noteHeight(points[p.i]!, nw, ar), want: 0, c: 0 });
  const sides = [left.map(box("l")), right.map(box("r"))];
  const need = (list: NoteBox[]) => list.reduce((s, n) => s + n.h, 0) + Math.max(0, list.length - 1) * GAP;
  const height = Math.max(plateH, ...sides.map(need));
  const top = (height - plateH) / 2;
  for (const list of sides) {
    for (const n of list) n.want = top + (points[n.i]!.y / 100) * plateH;
    spread(list, height);
  }

  const u = (rem: number) => (rem / S0) * 100; // rem → overlay units (1 = 1% of the stage width)
  const notes: HotspotLayout["notes"] = [];
  const lines: HotspotLayout["lines"] = [];
  for (const n of sides.flat().sort((a, b) => a.i - b.i)) {
    const p = points[n.i]!;
    notes.push({ i: n.i, side: n.side, ly: round((n.c / height) * 100, 2) });
    const ax = n.side === "l" ? nw : 100 - nw;
    const ay = u(n.c);
    const d = leader(px0 + (p.x / 100) * pw, u(top + (p.y / 100) * plateH), ax, ay);
    if (d) lines.push({ i: n.i, d, ax: round(ax, 2), ay: round(ay, 2) });
  }
  return {
    stage: round(S0 / height, 4),
    px0: round(px0, 2),
    pw: round(pw, 2),
    pt: round((top / height) * 100, 2),
    nw: round(nw, 2),
    vbh: round(u(height), 2),
    box: { x: round(px0, 2), y: round(u(top), 2), w: round(pw, 2), h: round(u(plateH), 2) },
    notes,
    lines,
  };
}

/** Tone of a photo from its dominant color: lines crossing a light photo are drawn dark, and vice versa. */
function photoTone(asset: ResolvedAsset | null): "light" | "dark" {
  const hex = safeHex(asset?.dominant);
  if (!hex) return "light";
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]! > 0.3 ? "light" : "dark";
}

export function Hotspots({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const img = productVisual(ctx, data);
  // no shot to pin the details on: an editorial index rather than pins over an empty frame
  if (!img) {
    return (
      <Container>
        <Head ctx={ctx} data={data} titleId={titleId} align="split" />
        <DetailIndex ctx={ctx} data={data} />
        <Action ctx={ctx} data={data} center />
      </Container>
    );
  }
  const ratio = round(img ? clamp(img.width / img.height, 0.66, 1.6) : 0.8, 3);
  // the plate shows the shot whole when it can; outside the plate's range it is fitted subject-first,
  // and the pins follow the photo through that exact crop
  const fit = img?.alpha ? "contain" : "cover";
  const crop = photoCrop(img, "rounded", ratio);
  const points = data.points.map((p) => {
    const [u, v] = framePoint(img, ratio, fit, p.x, p.y, { crop });
    return { ...p, x: round(clamp(u, 0.04, 0.96) * 100, 2), y: round(clamp(v, 0.04, 0.96) * 100, 2) };
  });
  const L = hotspotLayout(points, ratio, ctx.locale === "ar");
  // details are numbered in reading order: top to bottom by where their note settles (the page's
  // start side first on a tie) — pins, notes and the phone list share that number
  const start = ctx.dir === "rtl" ? "r" : "l";
  const byNote = new Map(L.notes.map((n) => [n.i, n]));
  const order = data.points
    .map((_, i) => i)
    .sort((a, b) => {
      const na = byNote.get(a)!;
      const nb = byNote.get(b)!;
      return na.ly - nb.ly || (na.side === nb.side ? a - b : na.side === start ? -1 : 1);
    });
  const rank = new Map(order.map((i, k) => [i, k]));
  const num = (i: number) => (rank.get(i) ?? i) + 1;
  const pinDelay = (k: number) => 300 + k * 110;
  const noteDelay = (k: number) => 560 + k * 110;
  const { x, y, w, h } = L.box;
  const on = `${id}-hs-on`;
  const off = `${id}-hs-off`;
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="center" />
      {/* geometry is physical (pins are photo coordinates): the stage is LTR, each note card reads in the page direction */}
      <div
        className="lp-showcase__hs"
        dir="ltr"
        style={cssVars({
          "--stage": L.stage,
          "--px0": `${L.px0}%`,
          "--pw": `${L.pw}%`,
          "--pt": `${L.pt}%`,
          "--nw": `${L.nw}%`,
        })}
      >
        <figure className="lp-showcase__plate" data-kind={img?.alpha ? "cutout" : "photo"}>
          <div className="lp-showcase__photo" {...reveal("scale-in")}>
            <span className="lp-showcase__aura" aria-hidden="true">
              <GlowOrb place="center" size="100%" intensity="medium" />
            </span>
            <Picture
              asset={img}
              sizes="(min-width: 62rem) 30rem, 92vw"
              ratio={ratio}
              fit={fit}
              frame={fit === "cover" ? { shape: "rounded", ratio, maxZoom: 1 } : undefined}
              className="lp-showcase__pic"
              alt={img?.alt || ctx.product.name}
            />
          </div>
          {points.map((p, i) => (
            <span key={i} className="lp-showcase__pin" data-k={i + 1} style={cssVars({ "--x": `${p.x}%`, "--y": `${p.y}%` })} aria-hidden="true" {...reveal("stamp", pinDelay(num(i) - 1))}>
              {num(i)}
            </span>
          ))}
        </figure>
        {L.lines.length ? (
          // each line is stroked twice: over the photo in a color read from the photo, over the ground in the section ink
          <svg className="lp-showcase__leaders" viewBox={`0 0 100 ${L.vbh}`} data-tone={photoTone(img)} aria-hidden="true" focusable="false" {...reveal("draw", 420)}>
            <defs>
              <clipPath id={on}>
                <rect x={x} y={y} width={w} height={h} />
              </clipPath>
              <clipPath id={off}>
                <path d={`M-5 -5H105V${round(L.vbh + 5, 2)}H-5Z M${x} ${y}V${round(y + h, 2)}H${round(x + w, 2)}V${y}Z`} clipRule="evenodd" />
              </clipPath>
            </defs>
            {L.lines.map((l) => (
              <g key={l.i} data-k={l.i + 1} style={cssVars({ "--i": num(l.i) - 1 })}>
                <path className="lp-showcase__ray lp-showcase__ray--photo lp-draw" d={l.d} pathLength={1} clipPath={`url(#${on})`} />
                <path className="lp-showcase__ray lp-draw" d={l.d} pathLength={1} clipPath={`url(#${off})`} />
                <circle className="lp-showcase__end lp-draw-pop" data-d={3} cx={l.ax} cy={l.ay} r={0.5} />
              </g>
            ))}
          </svg>
        ) : null}
        <ol className="lp-showcase__notes" role="list">
          {order.map((i) => {
            const { side, ly } = byNote.get(i)!;
            return (
            <li key={i} className="lp-showcase__note" data-k={i + 1} data-side={side} style={cssVars({ "--ly": `${ly}%` })} {...reveal("blur-in", noteDelay(num(i) - 1))}>
              <div className="lp-showcase__card" dir={ctx.dir}>
                <span className="lp-showcase__badge" aria-hidden="true">
                  {num(i)}
                </span>
                <div className="lp-showcase__body">
                  <PointCopy ctx={ctx} p={data.points[i]!} i={i} />
                </div>
              </div>
            </li>
            );
          })}
        </ol>
      </div>
      <Action ctx={ctx} data={data} center />
    </Container>
  );
}
