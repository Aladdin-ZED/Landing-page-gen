/**
 * rings — one concentric cluster, like activity rings: every share-type figure (%, x/5, 12 h of 24)
 * is a ring that draws to its value, outer ring first, around the product in its own light. Quiet
 * archetypes get fine rings on hairline tracks with a bead of light at each end; the others bold
 * rings on tinted tracks. Without a product image the outer ring's own figure takes the core (a
 * donut read) with its caption beneath. The legend carries the readable numbers, each keyed by a
 * small ring of its own share; hovering a key lights its ring and dims the rest.
 */
import { GlowOrb } from "@/landing/illustrations";
import { Container, cssVars, cx, editAttr, reveal, round } from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { density, fitProps } from "../benefits/kit";
import { figureLength, fractionOf, statsVisual, type ViewProps } from "./model";
import { Figure, Foot, Head, Label, Visual, hasSource } from "./parts";

/** Archetypes drawn in fine rings (luxury, clinical, editorial restraint); the rest are bold. */
const FINE = new Set<RenderContext["archetype"]>(["maison", "apothecary", "bloom", "editorial", "field"]);

/** Cluster geometry in a 200 × 200 viewBox: stroke width, ring radii (outer first), free core radius. */
function geometry(n: number, fine: boolean): { sw: number; radii: number[]; core: number } {
  if (n === 0) return { sw: 0, radii: [], core: 74 };
  const sw = fine ? [4.2, 3.8, 3.4, 3.1][n - 1]! : [15, 13, 11.5, 10][n - 1]!;
  const gap = fine ? (n <= 2 ? 12 : 9.5) : n <= 2 ? 7 : 5.5;
  // fine rings keep room around the outer one for its bead
  const outer = fine ? 92 - sw / 2 : 96 - sw / 2;
  const radii = Array.from({ length: n }, (_, k) => outer - k * (sw + gap));
  return { sw, radii, core: radii[n - 1]! - sw / 2 - (fine ? 10 : 7) };
}

/** Ring slot → its tone (stats.css --ring-0..3); none for figures without a ring. */
const ringColor = (k: number): string | undefined => (k >= 0 ? `var(--ring-${k})` : undefined);

/** Point on a circle of radius r around (c, c) at share f, clockwise from 12 o'clock. */
function pointAt(f: number, r: number, c: number): [number, number] {
  const a = -Math.PI / 2 + f * Math.PI * 2;
  return [round(c + r * Math.cos(a), 2), round(c + r * Math.sin(a), 2)];
}

/** Clockwise arc from 12 o'clock covering `f` of a ring of radius r (RTL mirrors the whole cluster). */
function arcPath(f: number, r: number, c = 100): string {
  const top = round(c - r, 2);
  if (f >= 0.9995) return `M${c} ${top}A${r} ${r} 0 1 1 ${c} ${round(c + r, 2)}A${r} ${r} 0 1 1 ${c} ${top}`;
  const [x, y] = pointAt(f, r, c);
  return `M${c} ${top}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

/** A dot at the arc's end: a hair-long stroke along the tangent, drawn round by its cap. */
function beadPath(f: number, r: number): string {
  const [x, y] = pointAt(Math.min(f, 0.9995), r, 100);
  const a = -Math.PI / 2 + f * Math.PI * 2;
  return `M${x} ${y}l${round(-Math.sin(a) * 0.05, 3)} ${round(Math.cos(a) * 0.05, 3)}`;
}

/** Legend key: a small ring of the figure's own share (or a hairline dash for a figure without a whole). */
function MiniRing({ f }: { f: number | null }) {
  if (f === null) return <span className="lp-stats__swatch" aria-hidden="true" />;
  return (
    <svg className="lp-stats__mini" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...reveal("draw", 360)}>
      <circle className="lp-stats__minitrack" cx="12" cy="12" r="9" />
      {f > 0 ? <path className="lp-stats__miniarc lp-draw" d={arcPath(f, 9, 12)} pathLength={1} /> : null}
    </svg>
  );
}

export function Rings({ ctx, data, titleId }: ViewProps) {
  const marked = hasSource(data);
  const visual = statsVisual(ctx, data);
  const fine = FINE.has(ctx.archetype);
  // ring slot per item (outer ring = first share-type figure); -1 = no ring
  let next = 0;
  const slots = data.items.map((it) => (fractionOf(it) !== null ? next++ : -1));
  const g = geometry(next, fine);
  // no product image: the outer ring's figure (else the first figure) takes the core
  const core = visual ? -1 : Math.max(0, slots.indexOf(0));
  const coreItem = core >= 0 ? data.items[core] : undefined;
  const keys = data.items.map((it, i) => ({ it, i })).filter(({ i }) => i !== core);
  return (
    <Container className={cx("lp-stats__rg", fine && "lp-stats__rg--fine")}>
      <Head ctx={ctx} data={data} titleId={titleId} />
      <div className="lp-stats__dialwrap">
        <div className="lp-stats__cluster" style={cssVars({ "--core": `${round(g.core, 2)}%` })} {...reveal("scale-in", 80)}>
          {density(ctx) > 0 ? <GlowOrb place="center" size="118%" intensity="medium" idle="pulse" /> : null}
          <svg className="lp-stats__dial" viewBox="0 0 200 200" aria-hidden="true" focusable="false" {...reveal("draw", 260)}>
            {next === 0 ? (
              <>
                <circle className="lp-stats__hair lp-draw" cx="100" cy="100" r="95" pathLength={1} />
                <circle className="lp-stats__hair lp-draw" cx="100" cy="100" r="83" pathLength={1} style={cssVars({ "--i": 1 })} />
              </>
            ) : null}
            {data.items.map((it, i) => {
              const k = slots[i]!;
              const f = fractionOf(it);
              if (k < 0 || f === null) return null;
              const r = g.radii[k]!;
              return (
                <g key={i} className="lp-stats__ring" data-k={k} strokeWidth={g.sw} style={cssVars({ "--rc": ringColor(k), "--sw": g.sw })}>
                  <circle className="lp-stats__track" cx="100" cy="100" r={r} />
                  {f > 0 ? <path className="lp-stats__arc lp-draw" d={arcPath(f, r)} pathLength={1} style={cssVars({ "--i": k })} /> : null}
                  {fine && f > 0 ? (
                    <>
                      <path className="lp-stats__bead lp-stats__bead--halo lp-draw" d={beadPath(f, r)} pathLength={1} style={cssVars({ "--i": k })} />
                      <path className="lp-stats__bead lp-draw" d={beadPath(f, r)} pathLength={1} style={cssVars({ "--i": k })} />
                    </>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {visual ? (
            <span className="lp-stats__core" data-kind={visual.alpha ? "cutout" : "photo"} aria-hidden="true" {...editAttr(ctx, "image")}>
              <Visual asset={visual} mask="circle" sizes="(min-width: 64rem) 17rem, 50vw" fit={fitProps(visual, "circle", 1)} />
            </span>
          ) : coreItem ? (
            <span className="lp-stats__core" data-kind="figure">
              <span className="lp-stats__fit lp-stats__corenum" style={cssVars({ "--len": figureLength(ctx, coreItem), "--rc": ringColor(slots[core]!) })}>
                <Figure ctx={ctx} it={coreItem} i={core} delay={200} />
              </span>
            </span>
          ) : null}
        </div>
        {coreItem ? <Label ctx={ctx} it={coreItem} i={core} marked={marked} className="lp-stats__label--core" /> : null}
      </div>
      {keys.length ? (
        <ul className="lp-stats__keys" role="list" data-count={keys.length}>
          {keys.map(({ it, i }, n) => {
            const k = slots[i]!;
            return (
              <li key={i} className="lp-stats__key" data-k={k >= 0 ? k : undefined} style={cssVars({ "--rc": ringColor(k) })} {...reveal("rise", 120 + n * 110)}>
                <MiniRing f={k >= 0 ? fractionOf(it) : null} />
                <p className="lp-stats__fit lp-stats__keynum" style={cssVars({ "--len": figureLength(ctx, it) })}>
                  <Figure ctx={ctx} it={it} i={i} delay={160 + n * 110} />
                </p>
                <Label ctx={ctx} it={it} i={i} marked={marked} />
              </li>
            );
          })}
        </ul>
      ) : null}
      <Foot ctx={ctx} data={data} />
    </Container>
  );
}
