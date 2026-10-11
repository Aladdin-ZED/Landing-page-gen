/**
 * crossed — a redline ledger. The pains stand in big display type; each row's hairline draws across,
 * one clean accent strike runs through the pain (line after line when it wraps), the words recede,
 * and the fix writes itself in underneath like a tracked change. The ledger ends on the one line left
 * standing: a check where the next number would be, the solution with the product inset as an
 * image pill in the type, and the order button.
 */
import type { ReactElement } from "react";
import { Container, Icon, RichText, SectionHeader, cssVars, reveal } from "@/landing/primitives";
import { idx } from "../benefits/kit";
import type { ViewProps } from "./model";
import { Turn, pickVisual } from "./parts";

/** Pace of the cascade: rows land 90ms apart, strikes follow one another every 300ms. */
const ROW_STEP = 90;
const STRIKE_START = 380;
const STRIKE_STEP = 300;
const TURN_DELAY = 420;

/** Strike duration: longer pains take a little longer, so the line keeps a steady speed. */
const strikeMs = (text: string) => Math.round(520 + Math.min([...text].length, 90) * 7);

export function Crossed({ ctx, data, titleId }: ViewProps): ReactElement {
  const visual = pickVisual(ctx, data, "wide");
  return (
    <Container>
      <SectionHeader
        ctx={ctx}
        kicker={data.kicker}
        title={data.title}
        lead={data.lead}
        editBase=""
        titleId={titleId}
        align="split"
        className="lp-problem__head"
      />
      <ol className="lp-problem__ledger" role="list">
        {data.pains.map((p, i) => {
          const dur = strikeMs(p.text);
          const at = STRIKE_START + i * STRIKE_STEP;
          const fix = p.fix.trim();
          return (
            <li key={i} className="lp-problem__row" {...reveal("rise", i * ROW_STEP)}>
              <span className="lp-problem__idx lp-label" aria-hidden="true">
                {idx(i)}
              </span>
              <div className="lp-problem__rbody">
                <span className="lp-problem__pain lp-h3" style={cssVars({ "--strike-dur": `${dur}ms` })} {...reveal("draw", at)}>
                  <RichText as="span" className="lp-problem__strike" text={p.text} ctx={ctx} decorate={false} editPath={`pains.${i}.text`} />
                </span>
                {fix ? (
                  <span className="lp-problem__fix" {...reveal("blur-in", at + Math.round(dur * 0.7))}>
                    <Icon name="arrow-right" size="1em" strokeWidth={2.2} className="lp-problem__fixmark" />
                    <RichText as="span" text={p.fix} ctx={ctx} decorate={false} editPath={`pains.${i}.fix`} />
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {/* the turn reveals on its own entry; a short beat lets the last strike land first on tall screens */}
      <Turn ctx={ctx} data={data} look="line" visual={visual} delay={TURN_DELAY} />
    </Container>
  );
}
