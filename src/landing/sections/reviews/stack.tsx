/**
 * stack (variant id "notes") — a swipeable deck. The dealt card sits almost straight (a hint of the
 * archetype's tilt) on two real cards receding below it, which fan out when the deck enters; swiping
 * (scroll-snap, gallery runtime) deals the next card in while the previous one tips back and fades.
 * Cards cycle through plain / accent / inverse surfaces for rhythm. Desktop: heading, score and
 * controls beside the deck.
 */
import type { ReactElement } from "react";
import { Container, Icon, SectionShell, Stars, cssVars, cx, reveal, seededRotation } from "../../primitives";
import { UI, type Props } from "./model";
import { say } from "./parts";
import { Byline, CtaRow, Detail, Header, Photo, Quote, ReviewTitle, ScoreCapsule, SlideCount, Verified, sectionScore, titleId } from "./shared";

const TONES = ["plain", "accent", "ink"] as const;

export function Stack({ id, ctx, data, bg }: Props): ReactElement {
  const n = data.items.length;
  const score = sectionScore(ctx, data);
  const tilt = seededRotation(ctx, `${id}:deck`, 0.75);
  const slideLabel = (i: number) => say(ctx, UI.slide).replace("{n}", ctx.num(i + 1)).replace("{total}", ctx.num(n));
  return (
    <SectionShell id={id} ctx={ctx} type="reviews" variant="notes" bg={bg} labelledBy={titleId(id)}>
      <Container>
        <div className={cx("lp-rv__stack", n > 1 && "lp-rv__stack--multi", data.cta.trim() && "lp-rv__stack--cta")} data-gallery="">
          <Header ctx={ctx} data={data} id={id} size="m" className="lp-rv__stack-head">
            {score ? <ScoreCapsule ctx={ctx} score={score} /> : null}
          </Header>
          <div className="lp-rv__deck" style={cssVars({ "--tilt": `${tilt}deg` })} {...reveal("rise", 120)}>
            {/* the cards waiting behind: one per remaining review, two at most */}
            {n > 2 ? <span className="lp-rv__ghost" data-k="2" aria-hidden="true" /> : null}
            {n > 1 ? <span className="lp-rv__ghost" data-k="1" aria-hidden="true" /> : null}
            <div className="lp-rv__deck-track" data-gallery-track="">
              {data.items.map((item, i) => (
                <div key={i} className="lp-rv__deck-slide" data-slide="" role="group" aria-label={slideLabel(i)}>
                  <figure className="lp-rv__note" data-tone={TONES[i % TONES.length]}>
                    <div className="lp-rv__top">
                      <Stars ctx={ctx} value={item.rating} size="m" />
                      {n > 1 ? <SlideCount ctx={ctx} i={i} n={n} /> : null}
                    </div>
                    <ReviewTitle ctx={ctx} item={item} i={i} className="lp-rv__note-title" />
                    <Quote ctx={ctx} item={item} i={i} className="lp-rv__note-quote" />
                    <Photo ctx={ctx} item={item} ratio="16/10" sizes="(min-width: 56rem) 26rem, 80vw" className="lp-rv__note-photo" />
                    <figcaption className="lp-rv__note-foot">
                      <Byline ctx={ctx} item={item} i={i} />
                      <span className="lp-rv__sign-end">
                        <Verified ctx={ctx} item={item} data={data} />
                        <Detail ctx={ctx} item={item} i={i} />
                      </span>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>
          {n > 1 ? (
            <div className="lp-rv__stack-nav" {...reveal("fade", 300)}>
              <ol className="lp-rv__pips" role="list" aria-label={say(ctx, UI.pick)}>
                {data.items.map((item, i) => (
                  <li key={i}>
                    <button type="button" className="lp-rv__pip" data-dot={i} aria-label={`${slideLabel(i)}: ${item.name}`} />
                  </li>
                ))}
              </ol>
              <span className="lp-rv__arrows">
                <button type="button" className="lp-rv__arrow" data-gallery-prev="" aria-label={say(ctx, UI.prev)}>
                  <Icon name="chevron-left" size={20} />
                </button>
                <button type="button" className="lp-rv__arrow" data-gallery-next="" aria-label={say(ctx, UI.next)}>
                  <Icon name="chevron-right" size={20} />
                </button>
              </span>
            </div>
          ) : null}
          {/* desktop: closes the heading group beside the deck; phones: after the controls */}
          <CtaRow ctx={ctx} data={data} className="lp-rv__cta--side" />
        </div>
      </Container>
    </SectionShell>
  );
}
