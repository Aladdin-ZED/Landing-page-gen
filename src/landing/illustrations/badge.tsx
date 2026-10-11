/**
 * Badge — a clean circular badge with text running around it (crisp vector, no ink): the modern
 * "rotating text" seal for guarantees, COD promises and poster heroes.
 *
 * Two stacked SVGs in an HTML box: the text ring (rotates when `spin`, composited — cheap) and the
 * static core (the label stays upright). Every phrase gets its own arc, separated by a small glyph
 * (never an emoji). Latin is fitted to its arc exactly with textLength; Arabic is never
 * letter-spaced, so it is sized from a conservative width estimate and short phrases repeat onto
 * more arcs instead. Size: --badge-size (default 8.5rem) or the `size` prop.
 *
 * Arabic rings (and any ring with `upright`) are set like a printed seal: arcs over the top run
 * clockwise, arcs under the bottom counter-clockwise, so every phrase reads upright; such a ring sways
 * (±6°) instead of spinning, because upright text turned upside down is unreadable. Bidi: Latin and numeric strings are set
 * left-to-right in their own isolate ("−25%" stays "−25%" on RTL pages), and numbers inside Arabic
 * phrases keep their order ("24–48" never flips to "48–24").
 *
 * The class is lp-ringbadge (lp-badge belongs to the primitives' text badge).
 */
import type { ReactElement } from "react";
import { clamp, PathBuilder, polar, rnd, TAU } from "./core/geom";
import { cssLength, cx, delayAttr, estimateEm, hasArabic, illId, isolateNumbers, toneAttr, vars, type Tone } from "./core/svg";
import { glyph, type GlyphKind } from "./glyphs";

/** solid = filled disc (text knocked out) · outline = hairline ring · glass = frosted disc */
export type BadgeVariant = "solid" | "outline" | "glass";

export interface BadgeProps {
  /** unique per page (section id + key) — arc ids */
  uid: string;
  /** ring text: one phrase or 2–4 phrases (each gets its own arc) */
  text: string | readonly string[];
  /** big center text, e.g. "100%", "COD", "مضمون" */
  label?: string;
  /** small line under the label */
  sublabel?: string;
  /** center glyph ("none" to omit). Shown small above the label when both are set. */
  glyph?: GlyphKind | "none";
  /** separator glyph between phrases */
  sep?: GlyphKind;
  variant?: BadgeVariant;
  /** disc color (solid) or line/text color (outline; glass defaults to the glass ink, AA over any backdrop) */
  tone?: Tone;
  /** center glyph color for outline / glass (default accent) */
  tone2?: Tone;
  /** slow rotation of the text ring (motion-gated); an upright ring sways gently instead */
  spin?: boolean;
  /**
   * Seal layout: arcs under the bottom run counter-clockwise so every phrase reads upright (needs 2+
   * arcs; a lone phrase that fits half the ring is set twice). Default: on for Arabic rings, off for
   * Latin ones (the classic rotating badge).
   */
  upright?: boolean;
  /** data-reveal="stamp": the badge pops in with a spring when scrolled into view */
  reveal?: boolean;
  /** reveal delay in ms */
  delay?: number;
  /** width (number → px or CSS length); default --badge-size / 8.5rem */
  size?: number | string;
  className?: string;
}

const C = 100;
const R_TEXT = 79;
const BAND = 20;
/** Latin cap-height budget inside the band; Arabic (no caps, open forms) reads at a larger size */
const MAX_FS = BAND * 0.68;
const MAX_FS_AR = BAND * 0.8;
const MIN_FS = 8.5;
/** Arabic width margin (covers the widest kit faces): text may sit a little short, never truncated. */
const AR_MARGIN = 1.3;
/** width available to the center label (~85% of the inner disc) */
const LABEL_W = 100;
/** angular gap around each separator */
const GAP = (13 * Math.PI) / 180;

/**
 * Arc from a0 to a1 (radians, y down, a0 < a1). Clockwise runs over the top of the ring with the
 * glyphs standing outward; `upright` draws it the other way round (a1 → a0, counter-clockwise), so
 * text under the bottom of the ring stands upright, tops toward the centre.
 */
function arcD(r: number, a0: number, a1: number, upright = false): string {
  const [from, to] = upright ? [a1, a0] : [a0, a1];
  const p0 = polar(C, C, r, from);
  const p1 = polar(C, C, r, to);
  return new PathBuilder({ p: 2 }).M(p0[0], p0[1]).A(r, r, a1 - a0 > Math.PI ? 1 : 0, upright ? 0 : 1, p1[0], p1[1]).toString();
}

/** Bidi for one SVG string: Latin / numeric strings isolated left-to-right; Arabic right-to-left with its numbers kept whole. */
function bidi(s: string): { text: string; direction: "ltr" | "rtl"; unicodeBidi: "isolate" } {
  const ar = hasArabic(s);
  return { text: ar ? isolateNumbers(s) : s, direction: ar ? "rtl" : "ltr", unicodeBidi: "isolate" };
}

export function Badge({
  uid,
  text,
  label,
  sublabel,
  glyph: centerGlyph = "spark",
  sep = "dot",
  variant = "solid",
  tone,
  tone2,
  spin = false,
  upright: uprightProp,
  reveal = false,
  delay,
  size,
  className,
}: BadgeProps): ReactElement {
  // glass: the glass ink (AA over any backdrop) unless a tone is asked for
  const t = tone ?? (variant === "solid" ? "accent" : variant === "glass" ? "current" : "ink");

  // phrases → arcs; short phrases repeat rather than stretch thin
  let items = (typeof text === "string" ? [text] : [...text]).map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const seal = uprightProp ?? items.some(hasArabic);
  /** width of a phrase in em, with its safety margin */
  const emOf = (s: string) => {
    const ar = hasArabic(s);
    return Math.max(1, estimateEm(s, !ar)) * (ar ? AR_MARGIN : 1.08);
  };
  const maxFsOf = (s: string) => (hasArabic(s) ? MAX_FS_AR : MAX_FS);
  const fill = (list: string[]) => {
    const arc = R_TEXT * (TAU / list.length - GAP);
    return Math.max(...list.map((s) => (emOf(s) * maxFsOf(s)) / arc));
  };
  while (items.length > 0 && items.length <= 2 && fill(items) < 0.5) items = [...items, ...items];
  // in a seal, a phrase that fits half the ring takes both halves, so it reads upright all round
  if (seal && items.length === 1 && emOf(items[0]!) * MIN_FS <= R_TEXT * (Math.PI - GAP)) items = [items[0]!, items[0]!];
  const n = items.length;
  const upright = seal && n >= 2;
  const slice = n ? TAU / n : TAU;
  // an upright ring with 4 arcs turns by half a slice: two arcs over the top, two under the bottom
  const top = -Math.PI / 2 - (upright && n === 4 ? slice / 2 : 0);
  const arcs = items.map((s, i) => {
    const mid = top + i * slice;
    const a0 = mid - (slice - GAP) / 2;
    const a1 = mid + (slice - GAP) / 2;
    const len = R_TEXT * (a1 - a0);
    const ar = hasArabic(s);
    const fs = clamp(len / emOf(s), MIN_FS, maxFsOf(s));
    const flip = upright && Math.sin(mid) > 0.01;
    return { id: illId(uid, `arc${i}`), d: arcD(R_TEXT, a0, a1, flip), s, len, ar, fs, sepAt: mid + slice / 2 };
  });
  // an upright ring reads as one line of type: one size for every phrase
  if (upright) {
    const fs = Math.min(...arcs.map((a) => a.fs));
    for (const a of arcs) a.fs = fs;
  }
  const turn = spin ? (upright ? "lp-idle-sway" : "lp-idle-spin") : undefined;

  const ring = (
    <svg className={cx("lp-ringbadge__ring", turn)} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        {arcs.map((a) => (
          <path key={a.id} id={a.id} d={a.d} fill="none" />
        ))}
      </defs>
      <g className="lp-ringbadge__ink">
        {arcs.length > 1 ? arcs.map((a, i) => {
          const p = polar(C, C, R_TEXT, a.sepAt);
          return glyph(sep, p[0], p[1], 3.6, `sep${i}`);
        }) : null}
        {arcs.map((a) => {
          const b = bidi(a.s);
          // when even the minimum size is too long, Latin glyphs condense too (spacing alone would overlap)
          const squeeze = !a.ar && Math.max(1, estimateEm(a.s)) * a.fs > a.len * 0.97;
          return (
            <text
              key={`t${a.id}`}
              className="lp-ringbadge__t"
              fill="currentColor"
              fontSize={rnd(a.fs)}
              textAnchor="middle"
              dominantBaseline="central"
              direction={b.direction}
              unicodeBidi={b.unicodeBidi}
              textLength={a.ar ? undefined : rnd(a.len * 0.97)}
              lengthAdjust={a.ar ? undefined : squeeze ? "spacingAndGlyphs" : "spacing"}
            >
              <textPath href={`#${a.id}`} startOffset="50%">
                {b.text}
              </textPath>
            </text>
          );
        })}
      </g>
    </svg>
  );

  // center: glyph and/or label
  const lbl = label?.trim() ?? "";
  const core: ReactElement[] = [];
  if (centerGlyph !== "none") {
    core.push(
      <g key="g" className="lp-ringbadge__glyph">
        {glyph(centerGlyph, C, lbl ? 66 : C, lbl ? 8 : 26, "g")}
      </g>,
    );
  }
  if (lbl) {
    const ar = hasArabic(lbl);
    const fs = clamp(LABEL_W / (Math.max(1, estimateEm(lbl, !ar)) * (ar ? AR_MARGIN : 1)), 14, 46);
    const y = sublabel ? 97 : centerGlyph !== "none" ? 106 : 101;
    const b = bidi(lbl);
    core.push(
      <text
        key="l"
        className="lp-ringbadge__label"
        fill="currentColor"
        x={C}
        y={y}
        fontSize={Math.round(fs)}
        textAnchor="middle"
        dominantBaseline="central"
        direction={b.direction}
        unicodeBidi={b.unicodeBidi}
      >
        {b.text}
      </text>,
    );
    const sub = sublabel?.trim();
    if (sub) {
      const subAr = hasArabic(sub);
      const sfs = clamp((LABEL_W * 0.9) / (Math.max(1, estimateEm(sub, !subAr)) * (subAr ? AR_MARGIN : 1)), 8, 12);
      const sb = bidi(sub);
      core.push(
        <text
          key="s"
          className="lp-ringbadge__sub"
          fill="currentColor"
          x={C}
          y={rnd(y + fs * 0.5 + 11)}
          fontSize={rnd(sfs)}
          textAnchor="middle"
          dominantBaseline="central"
          direction={sb.direction}
          unicodeBidi={sb.unicodeBidi}
        >
          {sb.text}
        </text>,
      );
    }
  }

  return (
    <span
      className={cx("lp-ill lp-ringbadge", variant === "glass" && "lp-glass", className)}
      data-tone={toneAttr(t)}
      data-tone2={toneAttr(tone2)}
      data-variant={variant}
      data-reveal={reveal ? "stamp" : undefined}
      data-delay={delayAttr(reveal, delay)}
      style={vars({ "--badge-size": cssLength(size) })}
      aria-hidden="true"
    >
      {ring}
      <svg className="lp-ringbadge__core" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        {variant === "outline" ? <circle cx={C} cy={C} r={99} fill="none" stroke="currentColor" strokeOpacity={0.4} vectorEffect="non-scaling-stroke" /> : null}
        <circle className="lp-ringbadge__rule" cx={C} cy={C} r={R_TEXT - BAND / 2 - 3} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" />
        {core}
      </svg>
    </span>
  );
}
