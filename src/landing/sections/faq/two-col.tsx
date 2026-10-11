/**
 * faq/two-col — editorial reading layout. A sticky column holds the heading and an index of every
 * question (in-page links); the other column reads like an article: numbered questions set in the
 * display face, answers at a calm measure, all open. Signature: a progress rail runs down the
 * answers and fills as you read, and the index lights the question you are on — both driven by CSS
 * scroll timelines where the engine has them (no JS; a quiet static index elsewhere).
 */
import type { ReactElement } from "react";
import { Container, RichText, reveal } from "@/landing/primitives";
import { ui } from "./copy";
import { Head, Help, channelOf, num2, type ViewProps } from "./parts";

export function TwoCol({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const channel = channelOf(ctx);
  const anchor = (i: number) => `${id}-q${i + 1}`;
  return (
    <Container className="lp-faq__cols">
      <div className="lp-faq__aside">
        <Head ctx={ctx} data={data} titleId={titleId} size="m" />
        {data.items.length > 2 ? (
          <nav className="lp-faq__toc" aria-label={ui(ctx.locale).toc} {...reveal("fade", 380)}>
            <ol role="list" className="lp-faq__toc-list">
              {data.items.map((it, i) => (
                <li key={i}>
                  <a className="lp-faq__toc-link" href={`#${anchor(i)}`}>
                    <span className="lp-faq__toc-n" aria-hidden="true">
                      {num2(i)}
                    </span>
                    <RichText as="span" className="lp-faq__toc-t" text={it.q} ctx={ctx} decorate={false} />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
      </div>
      <div className="lp-faq__main">
        <ol role="list" className="lp-faq__entries" data-stagger="90">
          {data.items.map((it, i) => (
            <li key={i} id={anchor(i)} className="lp-faq__entry" {...reveal("rise")}>
              <span className="lp-faq__n" aria-hidden="true">
                {num2(i)}
              </span>
              <RichText as="h3" className="lp-faq__eq" text={it.q} ctx={ctx} decorate={false} editPath={`items.${i}.q`} />
              <RichText block className="lp-faq__ea" text={it.a} ctx={ctx} decorate={false} editPath={`items.${i}.a`} />
            </li>
          ))}
        </ol>
        <Help ctx={ctx} data={data} channel={channel} className="lp-faq__help--card" buttonIcon={false} />
      </div>
    </Container>
  );
}
