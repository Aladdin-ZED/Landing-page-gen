/**
 * faq/accordion — a hairline list of big, calm questions. Opening one lifts it out of the list into a
 * raised card (fill, radius and tinted shadow ease in, the neighbouring hairlines fade) while the
 * answer eases open and the +/− folds into a minus on a spring. Native <details> (works without JS);
 * one answer open at a time via the exclusive `name` and [data-accordion="single"].
 */
import type { ReactElement } from "react";
import { Container, RichText, reveal } from "@/landing/primitives";
import { Head, Help, channelOf, num2, type ViewProps } from "./parts";

export function Accordion({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const channel = channelOf(ctx);
  return (
    <Container className="lp-faq__acc">
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <div className="lp-faq__list" data-accordion="single" data-stagger="70">
        {data.items.map((it, i) => (
          <details key={i} className="lp-faq__item" name={`${id}-faq`} open={data.openFirst && i === 0} {...reveal("rise")}>
            <summary className="lp-faq__sum">
              <span className="lp-faq__n" aria-hidden="true">
                {num2(i)}
              </span>
              <RichText as="h3" className="lp-faq__q" text={it.q} ctx={ctx} decorate={false} editPath={`items.${i}.q`} />
              <span className="lp-faq__pm" aria-hidden="true" />
            </summary>
            <div className="lp-faq__body">
              <RichText block className="lp-faq__a" text={it.a} ctx={ctx} decorate={false} editPath={`items.${i}.a`} />
            </div>
          </details>
        ))}
      </div>
      <Help ctx={ctx} data={data} channel={channel} className="lp-faq__help--bar" />
    </Container>
  );
}
