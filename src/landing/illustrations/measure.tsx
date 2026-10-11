/**
 * Measurement — precise technical lines for showcase/dimensions and spec heroes: a scale with
 * real subdivisions and a dimension line with a chip label. Hairlines, mono numerals, no texture.
 */
import type { ReactElement, ReactNode } from "react";
import { clamp, PathBuilder } from "./core/geom";
import { cx, SvgRoot, toneAttr, type IllBase, type Tone, type Tone3 } from "./core/svg";

export interface RulerProps extends IllBase {
  /** number of major units (cm or inches) */
  length?: number;
  unit?: "cm" | "in";
  orientation?: "h" | "v";
  /** first number */
  from?: number;
  /** a soft translucent strip behind the scale (default true) */
  body?: boolean;
  /** strip color (default card) */
  tone3?: Tone3;
  /** print the unit after the last number */
  unitLabel?: boolean;
}

/**
 * Measuring scale with real subdivisions (mm; or 1/2, 1/4, 1/8 inch). Each tick class is one
 * dashed stroke, so a 30 cm scale is still tiny markup. 40 viewBox units per unit.
 */
export function Ruler({ length = 10, unit = "cm", orientation = "h", from = 0, body = true, tone = "ink", tone3 = "card", unitLabel = true, ...base }: RulerProps): ReactElement {
  const U = 40;
  const n = clamp(Math.round(length), 1, 60);
  const pad = 14;
  const L = n * U;
  const depth = 32;
  const h = orientation === "h";
  const tw = 0.75;
  const scales: { step: number; len: number; w: number; o: number }[] =
    unit === "cm"
      ? [
          { step: U / 10, len: 5, w: tw, o: 0.55 },
          { step: U / 2, len: 8, w: tw, o: 0.75 },
          { step: U, len: 12, w: 1.1, o: 1 },
        ]
      : [
          { step: U / 8, len: 4, w: tw, o: 0.5 },
          { step: U / 4, len: 6, w: tw, o: 0.6 },
          { step: U / 2, len: 8.5, w: tw, o: 0.75 },
          { step: U, len: 12, w: 1.1, o: 1 },
        ];
  const total = L + pad * 2;
  const vb = h ? `0 0 ${total} ${depth}` : `0 0 ${depth} ${total}`;
  const ticks = scales.map((sc, i) => {
    const P = new PathBuilder({ p: 2 });
    const start = pad - sc.w / 2;
    const end = pad + L + sc.w / 2;
    if (h) P.M(start, 4 + sc.len / 2).H(end);
    else P.M(4 + sc.len / 2, start).V(end);
    return <path key={i} d={P.toString()} strokeWidth={sc.len} strokeOpacity={sc.o} strokeDasharray={`${sc.w} ${Math.round((sc.step - sc.w) * 100) / 100}`} />;
  });
  const labels: ReactElement[] = [];
  const lab = (key: string | number, pos: number, txt: string, mute = false) =>
    h ? (
      <text key={key} x={pos} y={25} textAnchor="middle" opacity={mute ? 0.6 : undefined}>
        {txt}
      </text>
    ) : (
      <text key={key} x={20} y={pos} dominantBaseline="central" opacity={mute ? 0.6 : undefined}>
        {txt}
      </text>
    );
  for (let k = 0; k <= n; k++) labels.push(lab(k, pad + k * U, String(from + k)));
  if (unitLabel) labels.push(lab("u", pad + L - U / 2, unit, true));
  return (
    <SvgRoot vb={vb} kind="ruler" tone={tone} tone3={tone3} data={{ o: orientation }} {...base}>
      {body ? <rect x={0.5} y={0.5} width={(h ? total : depth) - 1} height={(h ? depth : total) - 1} rx={8} className="i-f3 lp-ruler__body" /> : null}
      <g fill="none" stroke="currentColor">
        <path d={h ? `M${pad} 4H${pad + L}` : `M4 ${pad}V${pad + L}`} strokeWidth={0.75} strokeOpacity={0.6} />
        {ticks}
      </g>
      <g className="lp-ill-mono" fill="currentColor" fontSize={8}>
        {labels}
      </g>
    </SvgRoot>
  );
}

export interface DimensionProps {
  /** label shown in the middle, e.g. "24 cm" */
  children: ReactNode;
  orientation?: "h" | "v";
  /** end caps: small chevrons or perpendicular ticks */
  ends?: "arrow" | "tick";
  tone?: Tone;
  className?: string;
}

function DimCap({ ends, at, h }: { ends: "arrow" | "tick"; at: "start" | "end"; h: boolean }): ReactElement {
  const d = ends === "tick" ? (h ? "M6 1V11" : "M1 6H11") : h ? (at === "start" ? "M9 2.5L4 6L9 9.5" : "M3 2.5L8 6L3 9.5") : at === "start" ? "M2.5 9L6 4L9.5 9" : "M2.5 3L6 8L9.5 3";
  return (
    <svg className={`lp-dim__cap lp-dim__cap--${at}`} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Dimension line spanning its box: hairline + end caps + a centred chip label (real HTML text:
 * editable, translatable, read by screen readers). Logical positioning — RTL safe.
 */
export function Dimension({ children, orientation = "h", ends = "tick", tone = "ink", className }: DimensionProps): ReactElement {
  const h = orientation === "h";
  return (
    <span className={cx("lp-ill lp-dim", className)} data-o={orientation} data-tone={toneAttr(tone)}>
      <svg className="lp-dim__line" aria-hidden="true" focusable="false">
        <line x1={h ? 0 : "50%"} y1={h ? "50%" : 0} x2={h ? "100%" : "50%"} y2={h ? "50%" : "100%"} stroke="currentColor" strokeWidth={1} />
      </svg>
      <DimCap ends={ends} at="start" h={h} />
      <DimCap ends={ends} at="end" h={h} />
      <span className="lp-dim__label">{children}</span>
    </span>
  );
}
