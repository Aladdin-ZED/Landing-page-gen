/**
 * cards — frosted glass cards climbing like a staircase. Each giant numeral stands behind its
 * card's top edge: crisp above the glass, and below it the glass catches its light — a diffused
 * copy of the glyph glows inside the card, so the effect holds even where backdrop-filter is
 * missing or the theme's glass is nearly opaque. Hover lifts the card on a spring while its numeral
 * rises further out of the glass.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Picture, cssVars, reveal } from "@/landing/primitives";
import type { ViewProps } from "./model";
import { Head, Outro, Text, Time, Title, itemReveal } from "./parts";

export function Cards({ ctx, data, titleId }: ViewProps): ReactElement {
  const n = data.steps.length;
  const enter = itemReveal(ctx);
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <div className="lp-steps__deck lp-decor-host">
        {/* product light behind the glass: what the frost has to diffuse */}
        <GlowOrb className="lp-steps__glow" shape="wide" size="88%" place="center" intensity="medium" idle={ctx.motion === "lively" ? "drift" : undefined} />
        <ol className="lp-steps__cards" role="list" data-count={n} style={cssVars({ "--n": n })}>
          {data.steps.map((s, i) => {
            const img = ctx.asset(s.image);
            return (
              <li key={i} className="lp-steps__card" style={cssVars({ "--rise": n - 1 - i })} {...reveal(enter, i * 130)}>
                <span className="lp-steps__giant" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="lp-steps__glass lp-glass">
                  <span className="lp-steps__giant lp-steps__giant--lit" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Time ctx={ctx} step={s} i={i} />
                  <Title ctx={ctx} step={s} i={i} />
                  <Text ctx={ctx} step={s} i={i} />
                  {img ? <Picture asset={img} sizes="(min-width: 60rem) 22rem, 86vw" ratio="16/10" frame={img.alpha ? undefined : { shape: "rounded", ratio: 1.6, maxZoom: 1 }} alt="" className="lp-steps__cpic" /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <Outro ctx={ctx} data={data} className="lp-steps__outro--split" delay={160} />
    </Container>
  );
}
