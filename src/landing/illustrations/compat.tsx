/**
 * Compatibility names (v1 → v2 · modern). Sections written against the first, craft-styled kit
 * import these names; each one now renders the closest MODERN component, so old call sites keep
 * compiling and immediately look current. New code should use the modern components directly
 * (README.md → "Renamed in v2").
 *
 *   HandArrow → LeaderLine (clean curve + chevron)   HandCheck / HandCross → CheckMark / CrossMark
 *   Squiggle / ScribbleUnderline → Swoosh            Stamp → Badge (vector, no ink)
 *   PriceTag → clean price chip (no string)          Rays → Beam (a fan of soft stage beams)
 *   Pattern → GridLines / DotGrid / ZelligeLines     Tape → nothing (tape has no modern form)
 *   Doodle → Pictogram                               Botanical / LeafSprig → Leaf
 *   BlueprintGrid → GridLines
 */
import type { ReactElement, ReactNode } from "react";
import { clamp, type Pt } from "./core/geom";
import { seededTilt, type Seed } from "./core/rng";
import { cx, toneAttr, type IllBase, type Tone, type Tone3 } from "./core/svg";
import { Badge } from "./badge";
import { Leaf } from "./botanical";
import type { GlyphKind } from "./glyphs";
import { Beam } from "./light";
import { CheckMark, CrossMark, DotGrid, GridLines, LeaderLine, Swoosh, type Fade, type MarkFrame, type SwooshVariant } from "./lines";
import { ZelligeLines } from "./moroccan";
import { Pictogram, type PictogramKind } from "./pictograms";

/** The shared IllBase props of a v1 call site, passed through unchanged. */
const pass = (p: IllBase): IllBase => ({ className: p.className, tone: p.tone, size: p.size, reveal: p.reveal, delay: p.delay, idle: p.idle, rtlFlip: p.rtlFlip });

/* ------------------------------------------------------------------ */
/* HandArrow → LeaderLine                                              */
/* ------------------------------------------------------------------ */

export type ArrowHead = "open" | "closed" | "barb" | "none";
export type ArrowTail = "none" | "dot" | "loop";

export interface HandArrowProps extends IllBase {
  seed?: Seed;
  uid?: string;
  from?: Pt;
  to?: Pt;
  curve?: number;
  head?: ArrowHead;
  tail?: ArrowTail;
  width?: number;
  height?: number;
  weight?: number;
  dashed?: boolean;
}

/** @deprecated use LeaderLine — renders a clean curved leader with a chevron head. */
export function HandArrow(p: HandArrowProps): ReactElement {
  return (
    <LeaderLine
      {...pass(p)}
      tone={p.tone ?? "ink"}
      rtlFlip={p.rtlFlip ?? true}
      from={p.from}
      to={p.to}
      width={p.width}
      height={p.height}
      curve={p.curve ?? 0.35}
      weight={clamp((p.weight ?? 3) * 0.62, 1, 3.2)}
      start={p.tail === "dot" ? "dot" : "none"}
      end={p.head === "none" ? "none" : "arrow"}
    />
  );
}

/* ------------------------------------------------------------------ */
/* HandCheck / HandCross → CheckMark / CrossMark                       */
/* ------------------------------------------------------------------ */

export type TickFrame = "plain" | "circled" | "boxed";

export interface HandTickProps extends IllBase {
  seed?: Seed;
  frame?: TickFrame;
  weight?: number;
}

const FRAME: Record<TickFrame, MarkFrame> = { plain: "plain", circled: "ring", boxed: "square" };

/** @deprecated use CheckMark. */
export function HandCheck(p: HandTickProps): ReactElement {
  return <CheckMark {...pass(p)} tone={p.tone ?? "accent"} frame={FRAME[p.frame ?? "plain"]} weight={p.weight} />;
}

/** @deprecated use CrossMark. */
export function HandCross(p: HandTickProps): ReactElement {
  return <CrossMark {...pass(p)} tone={p.tone ?? "ink"} frame={FRAME[p.frame ?? "plain"]} weight={p.weight} />;
}

/* ------------------------------------------------------------------ */
/* Squiggle / ScribbleUnderline → Swoosh                               */
/* ------------------------------------------------------------------ */

export type SquiggleVariant = "wave" | "loop" | "zigzag" | "coil";

export interface SquiggleProps extends IllBase {
  seed?: Seed;
  variant?: SquiggleVariant;
  count?: number;
  weight?: number;
  vertical?: boolean;
}

/** @deprecated use Swoosh variant="wave" — a calm, smooth sine line. */
export function Squiggle(p: SquiggleProps): ReactElement {
  const waves = clamp(Math.round(p.count ?? 3), 1, 12);
  return (
    <Swoosh
      {...pass(p)}
      tone={p.tone ?? "accent"}
      seed={p.seed}
      variant="wave"
      waves={waves}
      aspect={waves * 2.6}
      vertical={p.vertical}
      weight={clamp((p.weight ?? 4) * 0.7, 1, 5)}
    />
  );
}

export type UnderlineVariant = "line" | "double" | "scribble" | "swash" | "wave" | "zigzag";

export interface ScribbleUnderlineProps extends IllBase {
  seed?: Seed;
  variant?: UnderlineVariant;
  aspect?: number;
  weight?: number;
}

const UNDERLINE: Record<UnderlineVariant, SwooshVariant> = { line: "line", double: "arc", scribble: "sweep", swash: "sweep", wave: "wave", zigzag: "wave" };

/** @deprecated use Swoosh. */
export function ScribbleUnderline(p: ScribbleUnderlineProps): ReactElement {
  return (
    <Swoosh
      {...pass(p)}
      tone={p.tone ?? "accent"}
      seed={p.seed}
      variant={UNDERLINE[p.variant ?? "scribble"]}
      aspect={p.aspect ?? 8}
      weight={clamp((p.weight ?? 3) * 0.85, 1, 5)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Stamp → Badge                                                       */
/* ------------------------------------------------------------------ */

export type StampVariant = "classic" | "badge" | "seal";

export interface StampProps {
  uid: string;
  seed?: Seed;
  text: string | readonly string[];
  label?: string;
  sublabel?: string;
  glyph?: GlyphKind | "none";
  sep?: GlyphKind;
  variant?: StampVariant;
  /** ignored (v2 badges are clean vector) */
  texture?: boolean;
  tone?: Tone;
  tone3?: Tone3;
  spin?: boolean;
  /** ignored (v2 badges sit straight) */
  tilt?: number;
  reveal?: boolean;
  delay?: number;
  className?: string;
}

/** @deprecated use Badge — classic → outline, badge / seal → solid. */
export function Stamp(p: StampProps): ReactElement {
  return (
    <Badge
      uid={p.uid}
      text={p.text}
      label={p.label}
      sublabel={p.sublabel}
      glyph={p.glyph ?? "spark"}
      sep={p.sep ?? "dot"}
      variant={p.variant === "badge" || p.variant === "seal" ? "solid" : "outline"}
      tone={p.tone}
      spin={p.spin}
      reveal={p.reveal}
      delay={p.delay}
      className={p.className}
    />
  );
}

/* ------------------------------------------------------------------ */
/* PriceTag → price chip                                               */
/* ------------------------------------------------------------------ */

export interface PriceTagProps {
  seed?: Seed;
  /** chip color (text uses the matching readable "on" color) */
  tone?: Tone;
  /** ignored (no string in v2) */
  stringTone?: Tone;
  /** tag = pill · label = soft rectangle */
  variant?: "tag" | "label";
  /** seeded tilt max in degrees (capped at 3) */
  tilt?: number;
  /** gentle float (idle) */
  swing?: boolean;
  className?: string;
  /** price markup (e.g. <span data-lp-price="current">249 DH</span>) */
  children: ReactNode;
}

/** @deprecated a clean price chip: solid pill, soft colored shadow, inner highlight. */
export function PriceTag({ seed = 1, tone = "pop", variant = "tag", tilt = 3, swing = false, className, children }: PriceTagProps): ReactElement {
  const max = Math.min(3, Math.round(clamp(tilt, 0, 3)));
  const rot = max > 0 ? seededTilt(seed, "pricetag", max, 1) : 0;
  return (
    <span className={cx("lp-ill lp-pricetag", className)} data-tone={toneAttr(tone === "paper" ? "card" : tone)} data-variant={variant} data-rot={rot || undefined}>
      <span className={cx("lp-pricetag__body", swing && "lp-idle-float")}>{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Rays → Beam fan                                                     */
/* ------------------------------------------------------------------ */

export type RaysVariant = "wedges" | "lines" | "burst" | "dashed";

export interface RaysProps extends IllBase {
  seed?: Seed;
  variant?: RaysVariant;
  count?: number;
  cover?: boolean;
  weight?: number;
}

/**
 * @deprecated use Beam — a fan of soft stage beams from the top of the box (never a sunburst). The
 * v1 tone is ignored: rays are light, so they always take the section's light color.
 */
export function Rays(p: RaysProps): ReactElement {
  const n = clamp(Math.round((p.count ?? 16) / 3), 3, 6);
  return <Beam seed={p.seed} count={n} origin="top" fan={70} intensity="soft" layer={p.cover ?? false} className={p.className} />;
}

/* ------------------------------------------------------------------ */
/* Pattern → GridLines / DotGrid / ZelligeLines                        */
/* ------------------------------------------------------------------ */

/** v1 pattern ids; each maps to the closest modern layer (zellige → lines, dot-like → DotGrid, the rest → GridLines). */
export type PatternKind = "zellige" | "checker" | "gingham" | "dots" | "blueprint" | "stripes" | "halftone" | "waves" | "terrazzo" | "grid";
export type PatternFade = "none" | "down" | "up" | "start" | "end" | "radial";

export interface PatternProps {
  kind: PatternKind;
  uid: string;
  opacity?: number;
  scale?: number;
  tone?: Tone;
  tone2?: Tone;
  tone3?: Tone3;
  seed?: Seed;
  angle?: number;
  fade?: PatternFade;
  filled?: boolean;
  layer?: boolean;
  height?: number | string;
  className?: string;
}

/** @deprecated use GridLines, DotGrid or ZelligeLines directly. */
export function Pattern({ kind, uid, opacity, scale = 1, tone, fade = "none", layer = true, className }: PatternProps): ReactElement {
  const k = clamp(scale, 0.25, 4);
  const f: Fade = fade;
  if (kind === "zellige") return <ZelligeLines uid={uid} tile={Math.round(96 * k)} tone={tone ?? "accent"} opacity={opacity === undefined ? undefined : Math.min(0.12, opacity * 0.12)} fade={f} layer={layer} className={className} />;
  if (kind === "dots" || kind === "halftone" || kind === "terrazzo") {
    return <DotGrid cell={Math.round(22 * k)} tone={tone ?? "line"} opacity={opacity} fade={f} layer={layer} className={className} />;
  }
  return <GridLines cell={Math.round(40 * k)} major={kind === "blueprint" ? 4 : 0} tone={tone ?? "line"} opacity={opacity} fade={f} layer={layer} className={className} />;
}

/* ------------------------------------------------------------------ */
/* Tape → frosted glass tab                                            */
/* ------------------------------------------------------------------ */

export type TapeVariant = "masking" | "washi" | "clear";
export type TapeCorner = "top-start" | "top-end" | "bottom-start" | "bottom-end" | "top";

/** v1 props, accepted and ignored. */
export interface TapeProps extends IllBase {
  uid: string;
  seed?: Seed;
  variant?: TapeVariant;
  ratio?: number;
  tone2?: Tone;
  corner?: TapeCorner;
}

/**
 * @deprecated tape is a craft motif with no modern form: renders nothing. Overlap media with a
 * GlassChip carrying real content instead.
 */
export const Tape: (props: TapeProps) => null = () => null;

/* ------------------------------------------------------------------ */
/* Doodle → Pictogram · Botanical / LeafSprig → Leaf                   */
/* ------------------------------------------------------------------ */

export type DoodleKind = PictogramKind;

export interface DoodleProps extends IllBase {
  kind?: DoodleKind;
  pool?: readonly DoodleKind[];
  seed?: Seed;
  weight?: number;
}

/** @deprecated use Pictogram — a clean line icon. */
export function Doodle(p: DoodleProps): ReactElement {
  return <Pictogram {...pass(p)} tone={p.tone ?? "accent"} kind={p.kind} pool={p.pool} seed={p.seed} weight={p.weight} />;
}

export type SprigVariant = "alternate" | "olive" | "round" | "fern";
export type BotanicalVariant = "flower" | "lavender" | "daisy" | "wild";

export interface LeafSprigProps extends IllBase {
  seed?: Seed;
  variant?: SprigVariant;
  weight?: number;
  tone2?: Tone;
}

/** @deprecated use Leaf (alternate → sprig). */
export function LeafSprig(p: LeafSprigProps): ReactElement {
  const v = p.variant ?? "alternate";
  return <Leaf {...pass(p)} tone={p.tone ?? "accent"} tone2={p.tone2} seed={p.seed} weight={p.weight} variant={v === "alternate" ? "sprig" : v} />;
}

export interface BotanicalProps extends IllBase {
  seed?: Seed;
  variant?: BotanicalVariant;
  weight?: number;
  tone2?: Tone;
}

/** @deprecated use Leaf. */
export function Botanical(p: BotanicalProps): ReactElement {
  return <Leaf {...pass(p)} tone={p.tone ?? "accent"} tone2={p.tone2} seed={p.seed} weight={p.weight} variant={p.variant ?? "flower"} />;
}

/* ------------------------------------------------------------------ */
/* BlueprintGrid → GridLines                                           */
/* ------------------------------------------------------------------ */

export interface BlueprintGridProps extends IllBase {
  width?: number;
  height?: number;
  minor?: number;
  major?: number;
  labels?: "letters" | "numbers" | "none";
  crosses?: boolean;
  cover?: boolean;
}

/** @deprecated use GridLines — a hairline grid with major lines, fading out. */
export function BlueprintGrid({ minor = 12, major = 48, cover = true, tone = "line", className }: BlueprintGridProps): ReactElement {
  const ratio = minor > 0 ? Math.round(major / minor) : 4;
  return <GridLines cell={28} major={clamp(ratio, 2, 8)} tone={tone} fade="radial" layer={cover} className={className} />;
}
