/**
 * quote — one huge statement in the shopper's words under an accent quote mark. The words
 * resolve from blur one by one, then a highlight block sweeps across the key words (*emphasis*),
 * whatever the page's emphasis style. Below, an asymmetric pair: the pains as a quiet numbered
 * index on the start side, and on the end side a raised answer card — product photo, the turn
 * label, the solution and the order button — lifted toward the statement it answers.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Kicker, RichText, cssVars, cx, plainText, reveal } from "@/landing/primitives";
import { density, idx } from "../benefits/kit";
import { Val } from "../benefits/val";
import type { ViewProps } from "./model";
import { Turn, pickVisual } from "./parts";

const STATEMENT_DELAY = 160;
/** must match the word cascade of split headings in base.css (--rv-word-gap) */
const WORD_GAP = 55;

export function Quote({ ctx, data, titleId }: ViewProps): ReactElement {
  // without a statement the first pain becomes it, and the index starts after it
  const own = !!data.quote.trim();
  const quote = own ? data.quote.trim() : (data.pains[0]?.text ?? "");
  const entries = data.pains.map((p, i) => ({ text: p.text, i })).slice(own ? 0 : 1);
  const words = plainText(quote).split(/\s+/).filter(Boolean).length;
  const visual = pickVisual(ctx, data, "second");
  const turn = !!(data.solution.trim() || data.cta);
  return (
    <Container>
      <div className="lp-problem__qhead" {...reveal("fade")}>
        {data.kicker.trim() ? <Kicker ctx={ctx} text={data.kicker} as="span" look="label" editPath="kicker" /> : null}
        <RichText as="h2" id={titleId} className="lp-problem__qtitle lp-h4" text={data.title} ctx={ctx} decorate={false} editPath="title" />
      </div>

      <figure className="lp-problem__quote">
        {density(ctx) > 0 ? <GlowOrb className="lp-problem__glow" size="62%" place="top-start" intensity="medium" /> : null}
        <blockquote className="lp-problem__statement" style={cssVars({ "--hl-d": `${STATEMENT_DELAY + words * WORD_GAP + 260}ms` })}>
          <svg className="lp-problem__qmark lp-flip-rtl" viewBox="0 0 64 48" aria-hidden="true" focusable="false" {...reveal("blur-in")}>
            <path d="M27 6C14.6 8.9 6 18.7 6 31.2 6 39 10.9 44 17.4 44c6 0 10.6-4.4 10.6-10.3 0-5.6-4.2-9.8-9.7-9.8-1 0-2 .1-2.8.4C17.3 18 21.8 13.3 28.8 11zM61 6C48.6 8.9 40 18.7 40 31.2 40 39 44.9 44 51.4 44c6 0 10.6-4.4 10.6-10.3 0-5.6-4.2-9.8-9.7-9.8-1 0-2 .1-2.8.4 1.8-6.3 6.3-11 13.3-13.3z" />
          </svg>
          <RichText as="p" className="lp-problem__say lp-display-3" text={quote} ctx={ctx} editPath={own ? "quote" : "pains.0.text"} reveal="blur-in" delay={STATEMENT_DELAY} split />
        </blockquote>
        {data.quoteCite.trim() ? (
          <figcaption className="lp-problem__cite lp-label" {...reveal("fade", 520)}>
            <Val ctx={ctx} text={data.quoteCite} editPath="quoteCite" />
          </figcaption>
        ) : null}
      </figure>

      <div className={cx("lp-problem__qbody", turn && "lp-problem__qbody--turn")}>
        <div className="lp-problem__qlist">
          {data.lead.trim() ? <RichText as="p" className="lp-problem__qlead" text={data.lead} ctx={ctx} editPath="lead" reveal="fade" delay={200} /> : null}
          {entries.length ? (
            <ol className="lp-problem__index" role="list">
              {entries.map((e, k) => (
                <li key={e.i} className="lp-problem__entry" {...reveal("rise", k * 80)}>
                  <span className="lp-problem__idx lp-label" aria-hidden="true">
                    {idx(k)}
                  </span>
                  <RichText as="span" text={e.text} ctx={ctx} decorate={false} editPath={`pains.${e.i}.text`} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <Turn ctx={ctx} data={data} look="card" visual={visual} delay={160} />
      </div>
    </Container>
  );
}
