/**
 * Precise lines — the modern mark-making of the kit: one clean vector stroke, uniform weight,
 * round caps, mathematically smooth curves (cubic Béziers, never jittered). Strokes carry
 * pathLength="1" + .lp-draw so data-reveal="draw" draws them on; end dots and heads "pop" after
 * their stroke (.lp-draw-pop, staged with data-d).
 *
 * Grids are CSS backgrounds (crisp 1px lines/dots, tiny markup) with fade masks.
 */
import type { ReactElement } from "react";
import { angleOf, clamp, lerp, PathBuilder, rnd, smoothD, type Pt } from "./core/geom";
import { createRng, type Seed } from "./core/rng";
import { cx, illId, SvgRoot, toneAttr, urlRef, vars, type IllBase, type Tone, type Tone3 } from "./core/svg";

/* ------------------------------------------------------------------ */
/* Grids (CSS)                                                         */
/* ------------------------------------------------------------------ */

/** Fade mask of a background layer. start/end are logical (mirror in RTL). */
export type Fade = "none" | "radial" | "down" | "up" | "edges" | "start" | "end";

interface GridBase {
  /** cell pitch in px (default: 40 for lines, 22 for dots) */
  cell?: number;
  /** line / dot color (default "line") */
  tone?: Tone;
  /** layer opacity 0–1 (default 0.7 lines, 0.8 dots) */
  opacity?: number;
  fade?: Fade;
  /** absolute full-bleed layer (default) — false = block sized by your CSS */
  layer?: boolean;
  className?: string;
}

export interface GridLinesProps extends GridBase {
  /** every Nth line is a stronger major line (0 = none) */
  major?: number;
}

/** Hairline grid (circuit, editorial, spec heroes), fading out so it never boxes content in. */
export function GridLines({ cell = 40, major = 0, tone = "line", opacity, fade = "radial", layer = true, className }: GridLinesProps): ReactElement {
  const c = Math.round(clamp(cell, 8, 240));
  const m = Math.round(clamp(major, 0, 12));
  return (
    <span
      className={cx("lp-ill lp-gridlines", layer && "lp-layer", className)}
      data-tone={toneAttr(tone)}
      data-fade={fade === "none" ? undefined : fade}
      data-major={m > 1 ? "" : undefined}
      style={vars({
        "--ill-cell": `${c}px`,
        "--ill-major": m > 1 ? `${c * m}px` : undefined,
        "--ill-o": opacity === undefined ? undefined : rnd(clamp(opacity, 0, 1), 2),
      })}
      aria-hidden="true"
    />
  );
}

export interface DotGridProps extends GridBase {
  /** dot radius in px (default 1.1) */
  dot?: number;
}

/** Fine dot matrix (apothecary, circuit, playground backdrops), fading out. */
export function DotGrid({ cell = 22, dot = 1.1, tone = "line", opacity, fade = "radial", layer = true, className }: DotGridProps): ReactElement {
  return (
    <span
      className={cx("lp-ill lp-dotgrid", layer && "lp-layer", className)}
      data-tone={toneAttr(tone)}
      data-fade={fade === "none" ? undefined : fade}
      style={vars({
        "--ill-cell": `${Math.round(clamp(cell, 6, 120))}px`,
        "--ill-dot": `${rnd(clamp(dot, 0.4, 6), 2)}px`,
        "--ill-o": opacity === undefined ? undefined : rnd(clamp(opacity, 0, 1), 2),
      })}
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* LeaderLine                                                          */
/* ------------------------------------------------------------------ */

/** dot = solid end dot · ring = anchor (ring + core) · arrow = clean chevron · none */
export type LeaderEnd = "dot" | "ring" | "arrow" | "none";

export interface LeaderLineProps extends IllBase {
  /** start point in viewBox units — the anchor on the product (default lower-left) */
  from?: Pt;
  /** end point in viewBox units — where the callout chip sits (default upper-right) */
  to?: Pt;
  /** viewBox size (default 200 × 120) */
  width?: number;
  height?: number;
  /** "curve" = smooth Bézier · "elbow" = diagonal + horizontal shelf (technical callout) */
  shape?: "curve" | "elbow";
  /** bend for "curve": -1…1 (sign = side, 0 = straight) */
  curve?: number;
  start?: LeaderEnd;
  end?: LeaderEnd;
  /** stroke width in viewBox units (default 1.5) */
  weight?: number;
  /** a soft ping around the start anchor (motion-gated) */
  pulse?: boolean;
}

function endMarker(kind: LeaderEnd, at: Pt, dir: number, w: number, stage: number, key: string, pulse = false): ReactElement | null {
  const [x, y] = [rnd(at[0]), rnd(at[1])];
  if (kind === "dot") return <circle key={key} cx={x} cy={y} r={rnd(w * 2.1, 2)} fill="currentColor" stroke="none" className="lp-draw-pop" data-d={stage} />;
  if (kind === "ring") {
    return (
      <g key={key} className="lp-draw-pop" data-d={stage}>
        {pulse ? <circle cx={x} cy={y} r={rnd(w * 3.6, 2)} fill="currentColor" stroke="none" className="lp-ping" /> : null}
        <circle cx={x} cy={y} r={rnd(w * 3.6, 2)} fill="none" strokeWidth={rnd(w * 0.8, 2)} strokeOpacity={0.45} />
        <circle cx={x} cy={y} r={rnd(w * 1.6, 2)} fill="currentColor" stroke="none" />
      </g>
    );
  }
  if (kind === "arrow") {
    const hl = w * 5.2;
    const spread = (27 * Math.PI) / 180;
    const a: Pt = [at[0] - Math.cos(dir - spread) * hl, at[1] - Math.sin(dir - spread) * hl];
    const b: Pt = [at[0] - Math.cos(dir + spread) * hl, at[1] - Math.sin(dir + spread) * hl];
    const d = new PathBuilder().M(a[0], a[1]).L(at[0], at[1]).L(b[0], b[1]).toString();
    return <path key={key} d={d} fill="none" pathLength={1} className="lp-draw" data-d={stage} />;
  }
  return null;
}

/**
 * Precise callout line: anchor on the product → clean curve (or elbow) → end dot / chevron.
 * The anchor pops, the line draws, then the end lands. Mirrored in RTL by default.
 */
export function LeaderLine({
  from,
  to,
  width = 200,
  height = 120,
  shape = "curve",
  curve = 0.25,
  start = "ring",
  end = "dot",
  weight = 1.5,
  pulse = false,
  tone = "ink",
  rtlFlip = true,
  ...base
}: LeaderLineProps): ReactElement {
  const W = clamp(width, 10, 2000);
  const H = clamp(height, 10, 2000);
  const w = clamp(weight, 0.5, 8);
  const p0: Pt = from ?? [W * 0.08, H * 0.82];
  const p1: Pt = to ?? [W * 0.92, H * 0.2];
  const P = new PathBuilder();
  let endDir: number;
  if (shape === "elbow") {
    // diagonal from the anchor up to a knee, then a level shelf to the chip; knee rounded
    const shelf = (p1[0] - p0[0]) * 0.36;
    const knee: Pt = [p1[0] - shelf, p1[1]];
    const r = Math.min(Math.abs(shelf) * 0.4, Math.hypot(knee[0] - p0[0], knee[1] - p0[1]) * 0.3, 14);
    const into = angleOf(p0, knee);
    const before: Pt = [knee[0] - Math.cos(into) * r, knee[1] - Math.sin(into) * r];
    const after: Pt = [knee[0] + Math.sign(shelf || 1) * r, knee[1]];
    P.M(p0[0], p0[1]).L(before[0], before[1]).Q(knee[0], knee[1], after[0], after[1]).L(p1[0], p1[1]);
    endDir = shelf >= 0 ? 0 : Math.PI;
  } else {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const c = clamp(curve, -1, 1);
    const c1: Pt = [p0[0] + dx * 0.3 + nx * c * L * 0.5, p0[1] + dy * 0.3 + ny * c * L * 0.5];
    const c2: Pt = [p0[0] + dx * 0.75 + nx * c * L * 0.3, p0[1] + dy * 0.75 + ny * c * L * 0.3];
    P.M(p0[0], p0[1]).C(c1[0], c1[1], c2[0], c2[1], p1[0], p1[1]);
    endDir = angleOf(c2, p1);
  }
  return (
    <SvgRoot vb={`0 0 ${rnd(W)} ${rnd(H)}`} kind="leader" tone={tone} rtlFlip={rtlFlip} {...base}>
      <g fill="none" stroke="currentColor" strokeWidth={rnd(w, 2)} strokeLinecap="round" strokeLinejoin="round">
        {endMarker(start, p0, 0, w, 0, "s", pulse)}
        <path d={P.toString()} pathLength={1} className="lp-draw" data-d={1} />
        {endMarker(end, p1, endDir, w, 3, "e")}
      </g>
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Swoosh                                                              */
/* ------------------------------------------------------------------ */

/** arc = shallow smile · sweep = confident rising swoosh · line = near-level stroke · wave = smooth sine */
export type SwooshVariant = "arc" | "sweep" | "line" | "wave";

export interface SwooshProps extends IllBase {
  seed?: Seed;
  variant?: SwooshVariant;
  /** box width / height (default 8) — match the word it underlines */
  aspect?: number;
  /** stroke in viewBox units; the box is 24 tall (default 3) */
  weight?: number;
  /** periods of the wave variant (default from the aspect) */
  waves?: number;
  /** run the wave vertically (box height / width = aspect) */
  vertical?: boolean;
}

/** One clean, smooth stroke — the modern underline (and, as "wave", a calm sine line). */
export function Swoosh({ seed = 1, variant = "sweep", aspect = 8, weight = 3, waves, vertical = false, tone = "accent", ...base }: SwooshProps): ReactElement {
  const rng = createRng(seed, `swoosh:${variant}`);
  const H = 24;
  const W = rnd(H * clamp(aspect, 1, 40));
  const w = clamp(weight, 0.5, 10);
  const pad = w / 2 + 0.75;
  const j = (v: number, amt: number) => v + rng.jitter(amt);
  let d: string;
  if (variant === "wave") {
    const n = clamp(Math.round(waves ?? W / (H * 2.4)), 1, 24);
    const amp = H / 2 - pad;
    const pts: Pt[] = [];
    const steps = n * 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([lerp(pad, W - pad, t), H / 2 - Math.sin(t * n * Math.PI * 2) * amp * 0.82]);
    }
    d = smoothD(vertical ? pts.map(([x, y]) => [y, x] as Pt) : pts);
  } else {
    const P = new PathBuilder();
    const x0 = pad;
    const x1 = W - pad;
    if (variant === "arc") {
      P.M(x0, j(H * 0.36, 1)).C(lerp(x0, x1, j(0.28, 0.04)), H - pad, lerp(x0, x1, j(0.7, 0.04)), H - pad, x1, j(H * 0.34, 1));
    } else if (variant === "line") {
      P.M(x0, j(H * 0.62, 0.8)).C(lerp(x0, x1, 0.36), j(H * 0.7, 0.8), lerp(x0, x1, 0.68), j(H * 0.56, 0.8), x1, j(H * 0.42, 0.8));
    } else {
      P.M(x0, j(H * 0.5, 1)).C(lerp(x0, x1, j(0.34, 0.04)), H - pad, lerp(x0, x1, j(0.64, 0.04)), H * 0.72, x1, j(H * 0.16, 1) + pad * 0.4);
    }
    d = P.toString();
  }
  const vb = vertical && variant === "wave" ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;
  return (
    <SvgRoot vb={vb} kind="swoosh" tone={tone} par="none" {...base}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={rnd(w, 2)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="lp-draw" data-d={1} />
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Rings                                                               */
/* ------------------------------------------------------------------ */

export interface RingsProps extends IllBase {
  /** number of concentric rings (default 4) */
  count?: number;
  /** innermost radius as a fraction of the outer one (default 0.4) */
  spread?: number;
  /** fade the rings out toward the edge (default true) */
  fade?: boolean;
}

/**
 * Concentric hairline rings — 1px at any size; draw on in sequence with `reveal`.
 * A drawn ring scales its stroke with the box (1 unit of 200): the draw dash is set in path units
 * (pathLength 1), which a non-scaling stroke would measure in screen pixels instead — the ring
 * would then stop a third of the way round on any box larger than 200px.
 */
export function Rings({ count = 4, spread = 0.4, fade = true, tone = "line", ...base }: RingsProps): ReactElement {
  const n = clamp(Math.round(count), 1, 12);
  const r0 = 99.5 * clamp(spread, 0.05, 0.95);
  const drawn = Boolean(base.reveal);
  const circles: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const r = lerp(r0, 99.5, t);
    circles.push(
      <circle
        key={i}
        cx={100}
        cy={100}
        r={rnd(r, 2)}
        transform="rotate(-90 100 100)"
        strokeOpacity={fade ? rnd(lerp(0.95, 0.3, t), 2) : undefined}
        vectorEffect={drawn ? undefined : "non-scaling-stroke"}
        pathLength={1}
        className="lp-draw"
        data-d={Math.min(4, i + 1)}
      />,
    );
  }
  return (
    <SvgRoot vb="0 0 200 200" kind="rings" tone={tone} {...base}>
      <g fill="none" stroke="currentColor" strokeWidth={1}>
        {circles}
      </g>
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* SpeedLines                                                          */
/* ------------------------------------------------------------------ */

export interface SpeedLinesProps extends IllBase {
  /** unique per page (section id + key) — gradient id */
  uid: string;
  seed?: Seed;
  count?: number;
  /** thickness multiplier (default 1) */
  weight?: number;
}

/**
 * Clean velocity streaks trailing behind an object that moves toward the inline end: rounded
 * lines that fade in from their tail. Mirrored in RTL by default.
 */
export function SpeedLines({ uid, seed = 1, count, weight = 1, tone = "accent", rtlFlip = true, ...base }: SpeedLinesProps): ReactElement {
  const rng = createRng(seed, "speed");
  const W = 240;
  const H = 120;
  const n = clamp(Math.round(count ?? rng.int(5, 7)), 2, 14);
  const gid = illId(uid, "speed");
  const k = clamp(weight, 0.3, 4);
  const lines: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const y = ((i + 0.5) / n) * H + rng.jitter((H / n) * 0.18);
    const w = rnd(rng.range(1.6, 4.2) * k, 2);
    const end = W - w / 2 - rng.range(0, 38);
    const len = W * rng.range(0.34, 0.86);
    const start = Math.max(w, end - len);
    lines.push(
      <path key={i} d={new PathBuilder().M(start, y).H(end).toString()} strokeWidth={w} pathLength={1} className="lp-draw" data-d={(i % 3) + 1} />,
    );
  }
  return (
    <SvgRoot vb={`0 0 ${W} ${H}`} kind="speed" tone={tone} rtlFlip={rtlFlip} {...base}>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={0}>
          <stop offset={0} stopColor="currentColor" stopOpacity={0} />
          <stop offset={0.55} stopColor="currentColor" stopOpacity={0.45} />
          <stop offset={1} stopColor="currentColor" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={urlRef(gid)} strokeLinecap="round">
        {lines}
      </g>
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export interface SparklineProps extends IllBase {
  /** unique per page (section id + key) — area gradient id */
  uid: string;
  /** data points (real, merchant-provided numbers) */
  values: readonly number[];
  /** viewBox size (default 200 × 64) */
  width?: number;
  height?: number;
  /** soft gradient area under the line (default true) */
  area?: boolean;
  /** end dot (default true) */
  dot?: boolean;
  weight?: number;
}

/** Smooth trend line with a soft area and an end dot — a precise data accent for stats. */
export function Sparkline({ uid, values, width = 200, height = 64, area = true, dot = true, weight = 2, tone = "accent", ...base }: SparklineProps): ReactElement {
  const W = clamp(width, 40, 2000);
  const H = clamp(height, 16, 1000);
  const w = clamp(weight, 0.5, 8);
  const vals = values.filter((v) => Number.isFinite(v)).slice(0, 200);
  const list = vals.length >= 2 ? vals : [0, 0];
  const lo = Math.min(...list);
  const hi = Math.max(...list);
  const span = hi - lo || 1;
  const pad = w * 2.6;
  const pts: Pt[] = list.map((v, i) => [lerp(pad, W - pad, i / (list.length - 1)), lerp(H - pad, pad, (v - lo) / span)]);
  const line = smoothD(pts);
  const last = pts[pts.length - 1] as Pt;
  const first = pts[0] as Pt;
  const gid = illId(uid, "spark");
  return (
    <SvgRoot vb={`0 0 ${rnd(W)} ${rnd(H)}`} kind="sparkline" tone={tone} {...base}>
      {area ? (
        <>
          <defs>
            <linearGradient id={gid} x1={0} y1={0} x2={0} y2={1}>
              <stop offset={0} stopColor="currentColor" stopOpacity={0.26} />
              <stop offset={1} stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${line}L${rnd(last[0])} ${rnd(H)}L${rnd(first[0])} ${rnd(H)}Z`} fill={urlRef(gid)} className="lp-draw-pop" data-d={2} />
        </>
      ) : null}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={rnd(w, 2)} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="lp-draw" data-d={1} />
      {dot ? (
        <g className="lp-draw-pop" data-d={3}>
          <circle cx={rnd(last[0])} cy={rnd(last[1])} r={rnd(w * 2.6, 2)} fill="currentColor" opacity={0.2} />
          <circle cx={rnd(last[0])} cy={rnd(last[1])} r={rnd(w * 1.35, 2)} fill="currentColor" />
        </g>
      ) : null}
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* CircleMark — a precise ellipse around a word or a number            */
/* ------------------------------------------------------------------ */

/** oval / loose = clean ellipse · box = pill outline · double (kept for older call sites) = ellipse */
export type CircleVariant = "oval" | "loose" | "double" | "box";

export interface CircleMarkProps extends IllBase {
  seed?: Seed;
  variant?: CircleVariant;
  /** box width / height (default 2.4) */
  aspect?: number;
  /** stroke in viewBox units; the box is 40 tall (default 2.4) */
  weight?: number;
}

/** A clean ellipse (or pill) ring that draws around its target, with a seeded slight tilt. */
export function CircleMark({ seed = 1, variant = "oval", aspect = 2.4, weight = 2.4, tone = "accent", ...base }: CircleMarkProps): ReactElement {
  const H = 40;
  const W = rnd(H * clamp(aspect, 0.6, 12));
  const w = clamp(weight, 0.5, 8);
  const pad = w / 2 + 1;
  let d: string;
  if (variant === "box") {
    const r = H / 2 - pad;
    d = new PathBuilder()
      .M(W / 2, pad)
      .H(W - pad - r)
      .A(r, r, 0, 1, W - pad - r, H - pad)
      .H(pad + r)
      .A(r, r, 0, 1, pad + r, pad)
      .Z()
      .toString();
  } else {
    // starts at the upper-left so the draw-on reads like a pen circling the word
    const rx = W / 2 - pad;
    const ry = H / 2 - pad;
    const a0 = Math.PI * 1.18;
    const start: Pt = [W / 2 + Math.cos(a0) * rx, H / 2 + Math.sin(a0) * ry];
    const opp: Pt = [W - start[0], H - start[1]];
    d = new PathBuilder().M(start[0], start[1]).A(rx, ry, 0, 1, opp[0], opp[1]).A(rx, ry, 0, 1, start[0], start[1]).toString();
  }
  const tilt = variant === "box" ? 0 : createRng(seed, "circlemark").range(-3, -1);
  return (
    <SvgRoot vb={`0 0 ${W} ${H}`} kind="circlemark" tone={tone} par="none" {...base}>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={rnd(w, 2)}
        strokeLinecap="round"
        transform={tilt ? `rotate(${rnd(tilt, 1)} ${rnd(W / 2)} ${H / 2})` : undefined}
        pathLength={1}
        className="lp-draw"
        data-d={1}
      />
    </SvgRoot>
  );
}

/* ------------------------------------------------------------------ */
/* CheckMark / CrossMark                                               */
/* ------------------------------------------------------------------ */

/** plain · ring (hairline circle) · disc (solid circle, knockout mark) · square (soft square) */
export type MarkFrame = "plain" | "ring" | "disc" | "square";

export interface TickProps extends IllBase {
  frame?: MarkFrame;
  /** stroke in viewBox units; the box is 48 (default 3.2) */
  weight?: number;
  /** knockout color of the mark on a disc (default: the readable "on" color of `tone`) */
  tone3?: Tone3;
}

function frameEl(frame: MarkFrame, w: number): ReactElement | null {
  if (frame === "ring") return <circle cx={24} cy={24} r={21} transform="rotate(-90 24 24)" strokeWidth={rnd(w * 0.62, 2)} pathLength={1} className="lp-draw" data-d={1} />;
  if (frame === "square") return <rect x={4} y={4} width={40} height={40} rx={13} strokeWidth={rnd(w * 0.62, 2)} pathLength={1} className="lp-draw" data-d={1} />;
  if (frame === "disc") return <circle cx={24} cy={24} r={22} fill="currentColor" stroke="none" className="lp-draw-pop" />;
  return null;
}

function Tick({ d, frame = "plain", weight = 3.2, tone3, kind, ...base }: TickProps & { d: string; kind: string }): ReactElement {
  const w = clamp(weight, 1, 8);
  const disc = frame === "disc";
  return (
    <SvgRoot vb="0 0 48 48" kind={kind} tone3={tone3} {...base}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {frameEl(frame, w)}
        <path
          d={d}
          strokeWidth={rnd(w, 2)}
          className={cx("lp-draw", disc && (tone3 ? "i-s3" : "i-on"))}
          pathLength={1}
          data-d={frame === "plain" ? 1 : 2}
        />
      </g>
    </SvgRoot>
  );
}

/** Clean geometric check (comparison tables, guarantees, thank-you). */
export function CheckMark({ tone = "accent", ...p }: TickProps): ReactElement {
  return <Tick {...p} tone={tone} kind="check" d={p.frame && p.frame !== "plain" ? "M15.5 24.5l5.6 5.6L33 18" : "M9 25.5l9 9L39 13"} />;
}

/** Clean geometric cross. */
export function CrossMark({ tone = "ink", ...p }: TickProps): ReactElement {
  return <Tick {...p} tone={tone} kind="cross" d={p.frame && p.frame !== "plain" ? "M17.5 17.5l13 13M30.5 17.5l-13 13" : "M12 12l24 24M36 12L12 36"} />;
}
