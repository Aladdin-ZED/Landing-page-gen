/**
 * ticker — the figures glide across a full-bleed color band at display size, each with its caption
 * set small beside it like a scoreboard; on the energetic archetypes an outlined echo row drifts the
 * other way underneath.
 * The band is decoration (aria-hidden, pauses on hover and off-screen): a still, readable
 * scoreboard below carries the same numbers, rolling up as it enters, each share over its meter.
 */
import { Container, MarqueeTrack, cssVars, reveal } from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { density, nestedBg } from "../benefits/kit";
import { Val } from "../benefits/val";
import { figureLength, fractionOf, type ViewProps } from "./model";
import { Figure, Foot, Head, Label, Meter, StaticFigure, hasSource, idx } from "./parts";

/** Captions longer than this would be cut in the band: the figure runs alone (the scoreboard has the words). */
const BAND_LABEL_MAX = 52;

/** Band tilt (deg, LTR; mirrored in RTL): sport and play lean into motion, the rest run level. */
const TILT: Partial<Record<RenderContext["archetype"], number>> = { kinetic: -2, playground: -1.5 };

/** Archetypes that get the outlined echo row (speed and play); quieter ones keep one clean band. */
const ECHO = new Set<RenderContext["archetype"]>(["kinetic", "garage", "playground", "circuit"]);

export function Ticker({ ctx, data, bg, titleId }: ViewProps) {
  const marked = hasSource(data);
  const band = data.items.map((it, i) => (
    <span key={i} className="lp-stats__tk">
      <StaticFigure ctx={ctx} it={it} className="lp-stats__fig--tk" />
      {it.label.length <= BAND_LABEL_MAX ? <Val ctx={ctx} text={it.label} className="lp-stats__tklab" /> : null}
    </span>
  ));
  const echo = density(ctx) > 0 && ECHO.has(ctx.archetype) ? data.items.map((it, i) => <StaticFigure key={i} ctx={ctx} it={it} className="lp-stats__fig--echo" />) : null;
  return (
    <>
      <Container>
        <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      </Container>
      {/* decorative: the scoreboard below carries the same numbers for reading and assistive tech */}
      <div className="lp-stats__strip" aria-hidden="true" style={cssVars({ "--tk-rot": `${TILT[ctx.archetype] ?? 0}deg` })}>
        <div className="lp-stats__band" data-bg={nestedBg(ctx, bg, ["accent", "dark", "pop"])} {...reveal("wipe-side", 120)}>
          <MarqueeTrack ctx={ctx} items={band} speed="slow" minItems={6} />
        </div>
        {echo ? (
          <div className="lp-stats__echo" {...reveal("fade", 420)}>
            <MarqueeTrack ctx={ctx} items={echo} speed="slow" reverse fade minItems={8} />
          </div>
        ) : null}
      </div>
      <Container>
        <ul className="lp-stats__board" role="list">
          {data.items.map((it, i) => {
            const f = fractionOf(it);
            return (
              <li key={i} className="lp-stats__cell" {...reveal("rise", i * 100)}>
                <span className="lp-stats__idx" aria-hidden="true">
                  {idx(i)}
                </span>
                <p className="lp-stats__fit lp-stats__cellnum" style={cssVars({ "--len": figureLength(ctx, it) })}>
                  <Figure ctx={ctx} it={it} i={i} className="lp-stats__fig--cell" delay={40 + i * 100} />
                </p>
                {f !== null ? <Meter f={f} delay={360 + i * 100} className="lp-stats__meter--cell" /> : null}
                <Label ctx={ctx} it={it} i={i} marked={marked} />
              </li>
            );
          })}
        </ul>
        <Foot ctx={ctx} data={data} />
      </Container>
    </>
  );
}
