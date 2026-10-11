/**
 * carousel — one voice at a time. A large raised panel holds the quote in display type, lit from
 * its top corner; a geometric quote disc crosses the panel's top edge. Under it, the reviewers'
 * faces are the pagination on wide screens (the active face lifts out of the group with an accent
 * ring), progress segments on phones; the round arrows sit together at the end. Scroll-snap track
 * driven by the gallery runtime; slides blur/scale through the transition where the engine has
 * scroll-driven animations.
 */
import type { ReactElement } from "react";
import { Container, Icon, SectionShell, Stars, cx, reveal } from "../../primitives";
import { UI, type Props } from "./model";
import { Avatar, say } from "./parts";
import { Byline, CtaRow, Detail, Header, Photo, Quote, QuoteMark, ScoreCapsule, SlideCount, Verified, sectionScore, titleId } from "./shared";

/** Beyond this many reviewers the face group gets crowded: the segment bar navigates everywhere. */
const FACES_MAX = 7;

export function Carousel({ id, ctx, data, bg }: Props): ReactElement {
  const n = data.items.length;
  const score = sectionScore(ctx, data);
  const faces = n > 1 && n <= FACES_MAX;
  const slideLabel = (i: number) => say(ctx, UI.slide).replace("{n}", ctx.num(i + 1)).replace("{total}", ctx.num(n));
  return (
    <SectionShell id={id} ctx={ctx} type="reviews" variant="carousel" bg={bg} labelledBy={titleId(id)}>
      <Container>
        <div
          className={cx("lp-rv__car", n > 1 && "lp-rv__car--multi", faces && "lp-rv__car--faces", data.cta.trim() && "lp-rv__car--cta")}
          data-gallery=""
        >
          <Header ctx={ctx} data={data} id={id} size="m" className="lp-rv__car-head">
            {score ? <ScoreCapsule ctx={ctx} score={score} /> : null}
          </Header>
          <div className="lp-rv__car-main">
            <div className="lp-rv__panel" {...reveal("rise", 140)}>
              <span className="lp-rv__qm-wrap" {...reveal("stamp", 420)}>
                <QuoteMark />
              </span>
              <div className="lp-rv__track" data-gallery-track="">
                {data.items.map((item, i) => {
                  const hasPhoto = !!ctx.asset(item.photo);
                  return (
                    <div key={i} className="lp-rv__slide" data-slide="" role="group" aria-label={slideLabel(i)}>
                      <figure className={cx("lp-rv__big", hasPhoto && "lp-rv__big--photo")}>
                        <div className="lp-rv__top">
                          <Stars ctx={ctx} value={item.rating} size="m" />
                          {n > 1 ? <SlideCount ctx={ctx} i={i} n={n} /> : null}
                        </div>
                        <Quote ctx={ctx} item={item} i={i} className="lp-rv__quote--big" />
                        <Photo ctx={ctx} item={item} ratio="4/5" sizes="(min-width: 56rem) 10rem, 40vw" className="lp-rv__big-photo" />
                        <figcaption className="lp-rv__sign">
                          <Byline ctx={ctx} item={item} i={i} size="l" />
                          <span className="lp-rv__sign-end">
                            <Verified ctx={ctx} item={item} data={data} />
                            <Detail ctx={ctx} item={item} i={i} />
                          </span>
                        </figcaption>
                      </figure>
                    </div>
                  );
                })}
              </div>
            </div>
            {n > 1 ? (
              <div className="lp-rv__nav" {...reveal("fade", 360)}>
                {faces ? (
                  <ol className="lp-rv__faces" role="list" aria-label={say(ctx, UI.pick)}>
                    {data.items.map((item, i) => (
                      <li key={i}>
                        <button type="button" className="lp-rv__face" data-dot={i} aria-label={`${slideLabel(i)}: ${item.name}`}>
                          <Avatar name={item.name} className="lp-rv__av" />
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <ol className="lp-rv__segs" role="list" aria-label={say(ctx, UI.pick)}>
                  {data.items.map((item, i) => (
                    <li key={i}>
                      <button type="button" className="lp-rv__seg" data-dot={i} aria-label={`${slideLabel(i)}: ${item.name}`} />
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
          </div>
          {/* desktop: under the heading, beside the panel; phones: after the reviews */}
          <CtaRow ctx={ctx} data={data} className="lp-rv__cta--side" />
        </div>
      </Container>
    </SectionShell>
  );
}
