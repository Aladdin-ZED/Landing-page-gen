/**
 * seal → badge — the promise as an object. A raised card spells the promises out; a big rotating
 * badge (a giant “0” upfront in the page currency) sits on a pool of product-hued light and crosses
 * the card's end edge — the ragged side of the text, so the overlap never fights the reading line —
 * with hairline rings drawing out around it into the open end of the grid. Desktop: split heading
 * (title | lead) over the card + badge row. Phone: heading, then the badge hanging over the card's
 * top edge. The light (and, on souk pages, a whisper of zellige line geometry) lives in its own layer
 * under the card; only the badge crosses over it, drifting gently on scroll.
 */
import type { ReactElement } from "react";
import { GlowOrb, Rings, ZelligeLines } from "@/landing/illustrations";
import { SectionHeader, reveal } from "@/landing/primitives";
import { promiseLines, typo, type ViewProps } from "./model";
import { Foot, GuaranteeBadge, PromiseList } from "./parts";

export function Seal({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const lines = promiseLines(data);
  return (
    <div className="lp-container lp-guarantee__wrap lp-cq">
      <SectionHeader
        ctx={ctx}
        kicker={data.kicker}
        title={typo(ctx.locale, data.title)}
        lead={typo(ctx.locale, data.lead)}
        size="m"
        align="split"
        titleId={titleId}
        editBase=""
        className="lp-guarantee__head"
      />
      <div className="lp-guarantee__grid">
        <div className="lp-guarantee__halo" aria-hidden="true">
          {ctx.archetype === "souk" ? (
            <ZelligeLines uid={`${id}-zl`} variant="rosette" tile={72} opacity={0.06} layer={false} className="lp-guarantee__zellige" />
          ) : null}
          <GlowOrb size="150%" intensity="medium" place="center" className="lp-guarantee__glow" />
          <Rings count={3} spread={0.72} tone="line" reveal delay={160} className="lp-guarantee__rings" />
        </div>
        <div className="lp-guarantee__card" {...reveal("rise", 60)}>
          <PromiseList ctx={ctx} lines={lines} delay={220} />
          <Foot ctx={ctx} data={data} delay={460} />
        </div>
        <div className="lp-guarantee__seal" aria-hidden="true" data-parallax="0.06">
          <GuaranteeBadge ctx={ctx} data={data} lines={lines} uid={`${id}-seal`} delay={280} />
        </div>
      </div>
    </div>
  );
}
