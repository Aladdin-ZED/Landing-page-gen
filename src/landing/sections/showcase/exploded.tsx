/**
 * showcase/exploded — an exploded-view diagram: the product on its archetype set in the middle, the
 * details pulled out to both sides as open callouts (numeral, name, why it matters). Each callout
 * hangs under a hairline that runs the width of its column and swings, in one smooth stroke, onto
 * the exact point of the product it describes (the detail's pin) — the stroke draws out of the
 * product on reveal. Hovering a callout or its anchor lights up the pair. Phones and tablets: the
 * set with numbered pins, then the details as a numbered list.
 *
 * The desktop diagram is solved at render time in one coordinate system (% of its width), like
 * hotspots: the photo window inside the set mirrors ProductStage's geometry, pins go through the
 * photo's crop and are kept inside its mask, callouts are balanced left / right by their pin and
 * ordered by height (leaders never cross), then spread from the top corner to the bottom corner of
 * their column. Pure math on the data: publish, preview and export render identical markup.
 */
import type { ReactElement } from "react";
import { Container, ProductStage, clamp, cssVars, reveal, round, type StageKind } from "@/landing/primitives";
import type { Archetype } from "@/lib/page/schema";
import type { ResolvedAsset } from "../../types";
import type { PointData } from "./schema";
import { Action, DetailIndex, Head, PointCopy, framePoint, num2, photoCrop, productVisual, type ViewProps } from "./shared";
import type { FrameShape } from "@/lib/media/focus";

/** The set that suits each archetype's modern language (halo rings by default). */
const STAGE: Partial<Record<Archetype, StageKind>> = {
  playground: "blob",
  bloom: "blob",
  hearth: "arch",
  souk: "arch",
  maison: "arch",
  field: "podium",
  apothecary: "podium",
  editorial: "frame",
  circuit: "frame",
};

/** Narrowest desktop diagram, rem (a 60rem viewport minus gutters and panel inset). */
const S0 = 53;
/** Column plan, % of the diagram width: callouts · gutter · set · gutter · callouts. */
const COL = 25;
const SET = 38;
const SET_X = (100 - SET) / 2;
/** Space between a callout's hairline and its numeral, rem (CSS padding-block-start). */
const RULE_PAD = 1.1;
/** Minimum gap between two callouts of a column, rem. */
const GAP = 2;

type Box = readonly [x: number, y: number, w: number, h: number];
type Mask = "rect" | "round" | "arch";

/**
 * Where ProductStage shows a regular photo, as fractions of the set box, and the mask that clips it
 * (mirrors the photo rules of .lp-stage in base.css; R = set aspect, width / height).
 */
function photoWindow(stage: StageKind, R: number): { box: Box; mask: Mask; shape: FrameShape } {
  switch (stage) {
    case "arch":
      return { box: [0.06, 0, 0.88, 1], mask: "arch", shape: "arch" };
    case "halo":
      return { box: [0.08, 0.5 - 0.42 * R, 0.84, 0.84 * R], mask: "round", shape: "circle" };
    case "slab":
      return { box: [0.05, 0.03, 0.9, 0.94], mask: "rect", shape: "rounded" };
    case "blob":
      return { box: [0.03, 0.03, 0.94, 0.94], mask: "round", shape: "blob" };
    case "podium":
      return { box: [0.04, 0, 0.92, 1], mask: "rect", shape: "rounded" };
    case "frame":
      return { box: [0.05, 0.05, 0.9, 0.9], mask: "rect", shape: "rounded" };
    default:
      return { box: [0, 0, 1, 1], mask: "rect", shape: "rounded" };
  }
}

/** The box a cutout stands in, per set: [inline inset, top, bottom] (base.css --pr-*). */
const CUTOUT: Record<StageKind, readonly [number, number, number]> = {
  arch: [0.13, 0.02, 0.1],
  halo: [0.14, 0.05, 0.12],
  slab: [0.13, 0.02, 0.11],
  blob: [0.14, 0.04, 0.13],
  podium: [0.19, 0.04, 0.19],
  frame: [0.14, 0.02, 0.13],
  none: [0.07, 0.03, 0.06],
};

/** Keep a point (fractions of its window) inside the visible mask, a little off the edge. */
function inView(u: number, v: number, mask: Mask, ry: number): [number, number] {
  const m = 0.08;
  let x = clamp(u, m, 1 - m);
  let y = clamp(v, m, 1 - m);
  const pull = (cx: number, cy: number, rx: number, rv: number) => {
    const d = Math.hypot((x - cx) / rx, (y - cy) / rv);
    if (d > 1) {
      x = cx + (x - cx) / d;
      y = cy + (y - cy) / d;
    }
  };
  if (mask === "round") pull(0.5, 0.5, 0.5 - m, 0.5 - m);
  if (mask === "arch" && y < ry) pull(0.5, ry, 0.5 - m, ry - m);
  return [x, y];
}

/** Every detail's anchor on the set, as fractions of the set box. */
export function setPins(points: readonly PointData[], img: ResolvedAsset | null, stage: StageKind, R: number): [number, number][] {
  if (img?.alpha) {
    const [i, t, b] = CUTOUT[stage];
    const box: Box = [i, t, 1 - 2 * i, 1 - t - b];
    // contained, standing on the floor of its box (object-position 50% 100%)
    return points.map((p) => {
      const [u, v] = framePoint(img, (box[2] * R) / box[3], "contain", p.x, p.y, { pos: [0.5, 1] });
      const [x, y] = inView(u, v, "rect", 0);
      return [box[0] + x * box[2], box[1] + y * box[3]];
    });
  }
  const { box, mask, shape } = photoWindow(stage, R);
  const aspect = (box[2] * R) / box[3];
  // the stage fits the photo to this exact window (ProductStage → Picture frame): pin through that crop
  const crop = photoCrop(img, shape, Math.round(aspect * 10000) / 10000, true);
  // the arch's top is a half-ellipse as wide as the window (base.css --arch-ry)
  const ry = clamp((box[2] * R) / 2 / box[3], 0.01, 0.5);
  return points.map((p) => {
    const [u, v] = framePoint(img, aspect, "cover", p.x, p.y, { crop });
    const [x, y] = inView(u, v, mask, ry);
    return [box[0] + x * box[2], box[1] + y * box[3]];
  });
}

/**
 * Estimated callout height (rem) at the narrowest desktop width: hairline padding, numeral, label
 * and text lines (metrics of showcase.css; Arabic sets taller lines).
 */
function calloutHeight(p: PointData, ar: boolean): number {
  const col = (COL / 100) * S0;
  const lines = (chars: number, cw: number) => Math.max(1, Math.ceil((chars * cw) / col));
  const text = p.text.trim();
  const label = lines(p.label.length, ar ? 0.6 : 0.64) * (ar ? 2.15 : 1.6);
  const body = text ? 0.5 + lines(text.length, ar ? 0.47 : 0.5) * (ar ? 1.9 : 1.65) : 0;
  // + 5 %: the estimate errs on the tall side, a callout never runs into the next one
  return (RULE_PAD + 2.9 + label + body) * 1.05;
}

export interface ExplodedLayout {
  /** diagram aspect ratio (width / height) */
  ratio: number;
  /** set box top, % of the diagram height */
  st: number;
  /** viewBox height of the leader overlay (its width is 100) */
  vbh: number;
  /**
   * callouts: side, the level of their hairline in % of the diagram height, and their reading
   * order (rows top to bottom, the page's start column first) — the number each one displays
   */
  calls: { i: number; side: "l" | "r"; ly: number; order: number }[];
  /** one stroke per callout: from the pin, across the gutter, along the hairline */
  lines: { i: number; d: string; order: number }[];
}

export function explodedLayout(points: readonly PointData[], pins: readonly (readonly [number, number])[], R: number, ar: boolean, rtl = ar): ExplodedLayout {
  const u = S0 / 100; // rem per unit (1 unit = 1% of the diagram width)
  const setH = (SET / R) * u; // rem

  // sides by the pin's half of the set, balanced so neither holds more than half (+1)
  const order = points.map((_, i) => ({ i, x: pins[i]![0] }));
  const left = order.filter((p) => p.x < 0.5);
  const right = order.filter((p) => p.x >= 0.5);
  const cap = Math.ceil(points.length / 2);
  while (left.length > cap) right.push(left.sort((a, b) => b.x - a.x).shift()!);
  while (right.length > cap) left.push(right.sort((a, b) => a.x - b.x).shift()!);
  const sides = (
    [
      ["l", left],
      ["r", right],
    ] as const
  ).map(([side, list]) => ({
    side,
    list: list.map((p) => ({ i: p.i, h: calloutHeight(points[p.i]!, ar), y: pins[p.i]![1] })).sort((a, b) => a.y - b.y),
  }));

  // rows line up across the columns: every column of two or more opens on the same top rule and
  // closes on the same bottom rule (sized for the taller last callout), evenly spaced in between;
  // a lone callout stays level with its pin
  const pad = setH * 0.04;
  const stacks = sides.filter((s) => s.list.length > 1).map((s) => s.list);
  const lastH = Math.max(0, ...stacks.map((l) => l[l.length - 1]!.h));
  const span = (l: { h: number }[]) => (l.length - 1) * Math.max(...l.slice(0, -1).map((c) => c.h + GAP));
  const lone = sides.filter((s) => s.list.length === 1).map((s) => s.list[0]!.h);
  const H = Math.max(setH, ...stacks.map((l) => 2 * pad + span(l) + lastH), ...lone);
  const top = (H - setH) / 2;
  const first = pad;
  const final = H - pad - lastH;

  const placed: { i: number; side: "l" | "r"; y: number }[] = [];
  for (const { side, list } of sides) {
    list.forEach((c, j) => {
      const y = list.length === 1 ? clamp(top + c.y * setH, 0, H - c.h) : first + ((final - first) * j) / (list.length - 1);
      placed.push({ i: c.i, side, y });
    });
  }
  // reading order (reveals and numbering) follows the rows, the page's start column first (the
  // diagram box is physical: its right column is the start in RTL)
  const start = rtl ? "r" : "l";
  placed.sort((a, b) => a.y - b.y || (a.side === start ? -1 : 1));

  const r2 = (v: number) => round(v, 2);
  const calls: ExplodedLayout["calls"] = [];
  const lines: ExplodedLayout["lines"] = [];
  placed.forEach(({ i, side, y }, order) => {
    const ly = y / u; // hairline level, units
    const [sx, sy] = pins[i]!;
    const px = SET_X + sx * SET;
    const py = top / u + sy * (SET / R);
    // knee at the column's inner edge: the stroke arrives level, then runs along the hairline
    const kx = side === "l" ? COL : 100 - COL;
    const ox = side === "l" ? 0 : 100;
    const dx = kx - px;
    const dy = ly - py;
    const d =
      Math.abs(dy) < 0.4
        ? `M${r2(px)} ${r2(py)}H${ox}`
        : `M${r2(px)} ${r2(py)}C${r2(px + dx * 0.3)} ${r2(py + dy * 0.2)} ${r2(kx - dx * 0.45)} ${r2(ly)} ${r2(kx)} ${r2(ly)}H${ox}`;
    calls.push({ i, side, ly: round((y / H) * 100, 3), order });
    lines.push({ i, d, order });
  });
  calls.sort((a, b) => a.i - b.i);
  return {
    ratio: round(S0 / H, 4),
    st: round((top / H) * 100, 3),
    vbh: round(H / u, 2),
    calls,
    lines,
  };
}

export function Exploded({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const img = productVisual(ctx, data);
  // no shot to pin the details on: an editorial index rather than strokes into an empty set
  if (!img) {
    return (
      <Container>
        <Head ctx={ctx} data={data} titleId={titleId} align="split" />
        <DetailIndex ctx={ctx} data={data} />
        <Action ctx={ctx} data={data} center />
      </Container>
    );
  }
  const stage = STAGE[ctx.archetype] ?? "halo";
  // landscape shots get a square set so the crop keeps the product
  const R = img && img.width > img.height * 1.08 ? 1 : 0.8;
  const pins = setPins(data.points, img, stage, R);
  const L = explodedLayout(data.points, pins, R, ctx.locale === "ar", ctx.dir === "rtl");
  const byIndex = new Map(L.calls.map((c) => [c.i, c]));
  // details are numbered in reading order — "01" is the top callout of the start column — and the
  // phone list follows the same order; data-k keeps the pin ↔ callout link
  const rank = (i: number) => byIndex.get(i)?.order ?? i;
  const listed = data.points.map((p, i) => ({ p, i })).sort((a, b) => rank(a.i) - rank(b.i));
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="center" />
      {/* the diagram is physical (pins are photo coordinates): the box is LTR, every callout reads in the page direction */}
      <div className="lp-showcase__ex" dir="ltr" style={cssVars({ "--ex-ratio": L.ratio, "--st": `${L.st}%` })}>
        <div className="lp-showcase__exstage">
          <ProductStage
            ctx={ctx}
            stage={stage}
            asset={img}
            size="m"
            ratio={R === 1 ? "1/1" : "4/5"}
            rings={stage === "halo" || ctx.archetype === "kinetic" || ctx.archetype === "garage" ? true : undefined}
            seedKey={`${id}-ex`}
            sizes="(min-width: 60rem) 28rem, 80vw"
          />
          <ol className="lp-showcase__xpins" role="list" aria-hidden="true">
            {pins.map(([x, y], i) => (
              <li
                key={i}
                className="lp-showcase__xpin"
                data-k={i + 1}
                style={cssVars({ "--x": `${round(x * 100, 2)}%`, "--y": `${round(y * 100, 2)}%` })}
                {...reveal("stamp", 380 + rank(i) * 110)}
              >
                {rank(i) + 1}
              </li>
            ))}
          </ol>
        </div>
        <svg className="lp-showcase__xleaders" viewBox={`0 0 100 ${L.vbh}`} aria-hidden="true" focusable="false" {...reveal("draw", 520)}>
          {L.lines.map((l) => (
            <g key={l.i} data-k={l.i + 1} style={cssVars({ "--i": l.order })}>
              <path className="lp-showcase__xcase lp-draw" d={l.d} pathLength={1} />
              <path className="lp-showcase__xray lp-draw" d={l.d} pathLength={1} />
            </g>
          ))}
        </svg>
        <ol className="lp-showcase__xlist" role="list" dir={ctx.dir}>
          {listed.map(({ p, i }) => {
            const c = byIndex.get(i);
            return (
              <li
                key={i}
                className="lp-showcase__xcall"
                data-k={i + 1}
                data-side={c?.side}
                dir={ctx.dir}
                style={cssVars({ "--ly": c ? `${c.ly}%` : undefined })}
                {...reveal("blur-in", 620 + rank(i) * 110)}
              >
                <span className="lp-showcase__xnum" aria-hidden="true">
                  {num2(rank(i))}
                </span>
                <div className="lp-showcase__xbody">
                  <PointCopy ctx={ctx} p={p} i={i} />
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
