/**
 * phone — a vertical customer video in a modern phone: story progress, the creator's initials,
 * name · city and a verified pill on top, their own words at the bottom, a faint glass glare over
 * the screen. The phone stands on a disc of the product's light with a lit floor under it (it breaks
 * out of the disc top and bottom), turns gently in 3D as the page scrolls, and two frosted COD chips
 * float over its edges (on phones they line up under it, clear of the story chrome). Landscape and
 * square media sit in the screen as a shared-post card over their own blurred light; a cutout still
 * stands on a lit stage filling the screen.
 */
import type { ReactElement } from "react";
import { Container, Icon, RichText, SectionHeader, cssVars, editAttr, frameRegions, pictureCrop, reveal, seededRotation } from "../../primitives";
import type { ResolvedAsset } from "../../types";
import { initials, type Media, type ViewProps } from "./model";
import { Action } from "./parts";
import { Player } from "./player";

/** The phone screen (9:19) and the depth of its top chrome: island, story bars, creator row. */
const SCREEN = 9 / 19;
const CHROME = 0.17;

/**
 * A still of a person fills the screen only when every head starts below the story chrome (the
 * top third of a head box is hair or a veil, which may brush it); otherwise it is shown like a
 * shared post — a card in the middle of the story over its own light — and nothing covers the face.
 */
function headsUnderChrome(still: ResolvedAsset | null): boolean {
  if (!still || still.alpha || still.subjectKind !== "person") return false;
  const crop = pictureCrop(still, { frame: { shape: "rounded", ratio: SCREEN, maxZoom: 1 } });
  return frameRegions(still, SCREEN, crop).heads.some((h) => h.y + h.h / 3 < CHROME);
}

/** Landscape / square clips, and stills of people the chrome would cover, sit in the screen as a post. */
const asPost = (m: Media): boolean =>
  m.video ? m.shape !== "tall" : !m.still?.alpha && (m.shape !== "tall" || headsUnderChrome(m.still));

export function Phone({ ctx, data, id, titleId, media }: ViewProps): ReactElement {
  const name = data.creatorName.trim();
  const city = data.creatorCity.trim();
  const quote = data.quote.trim();
  const rng = ctx.rng(`${id}:phone`);
  // which edge the first chip hugs, and how high each one floats (seeded, stable per page)
  const flip = rng() < 0.5;
  const y1 = 30 + Math.round(rng() * 10);
  const y2 = 56 + Math.round(rng() * 8);
  const tilt = seededRotation(ctx, `${id}:phone`, 0.8);

  const story =
    name || quote ? (
      <>
        {name ? (
          <span className="lp-video__who" {...reveal("fade", 420)}>
            <span className="lp-video__av" aria-hidden="true">
              {initials(name)}
            </span>
            <span className="lp-video__id">
              <b {...editAttr(ctx, "creatorName")}>{name}</b>
              {city ? <span {...editAttr(ctx, "creatorCity")}>{city}</span> : null}
            </span>
            {/* "verified" only for a real, merchant-confirmed customer video — never on sample content */}
            {data.sample ? null : (
              <span className="lp-video__ver">
                <Icon name="check" size="0.95em" strokeWidth={2.4} />
                {ctx.t("reviews.verified")}
              </span>
            )}
          </span>
        ) : null}
        {quote ? <RichText as="blockquote" className="lp-video__quote" text={quote} ctx={ctx} decorate={false} editPath="quote" reveal="rise" delay={560} /> : null}
      </>
    ) : null;

  return (
    <Container className="lp-video__wrap lp-video__wrap--phone">
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} titleId={titleId} editBase="" className="lp-video__head" />
      <div
        className="lp-video__stage lp-video__stage--phone"
        data-flip={flip ? "" : undefined}
        style={cssVars({ "--y1": `${y1}%`, "--y2": `${y2}%`, "--tilt": `${tilt}deg` })}
      >
        <div className="lp-video__lift" {...reveal("tilt-in", 80)}>
          <span className="lp-video__halo" aria-hidden="true" />
          <span className="lp-video__floor" aria-hidden="true" />
          <div className="lp-video__phone">
            <Player
              ctx={ctx}
              media={media}
              contain={asPost(media)}
              className="lp-video__ugc"
              sizes="(min-width: 64rem) 300px, 66vw"
              frame={{ shape: "rounded", ratio: SCREEN, maxZoom: 1 }}
              caption={story}
            >
              <span className="lp-video__bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="lp-video__island" aria-hidden="true" />
              <span className="lp-video__glare" aria-hidden="true" />
            </Player>
          </div>
        </div>
        <ul className="lp-video__floats" role="list">
          <li className="lp-video__float" data-at="1" {...reveal("blur-in", 640)}>
            <span className="lp-video__chip lp-glass">
              <span className="lp-video__chip-i" aria-hidden="true">
                <Icon name="cash" size="1.1em" />
              </span>
              {ctx.t("trust.cod")}
            </span>
          </li>
          <li className="lp-video__float" data-at="2" {...reveal("blur-in", 780)}>
            <span className="lp-video__chip lp-glass">
              <span className="lp-video__chip-i" aria-hidden="true">
                <Icon name="eye" size="1.1em" />
              </span>
              {ctx.t("trust.check")}
            </span>
          </li>
        </ul>
      </div>
      <Action ctx={ctx} data={data} delay={300} assure={false} />
    </Container>
  );
}
