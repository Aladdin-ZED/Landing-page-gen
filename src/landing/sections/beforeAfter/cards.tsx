/**
 * cards — two photo cards, the after larger, raised and lit by the product's glow. A solid accent
 * disc with an arrow sits on the seam (on the after photo's top edge, pointing down, when the cards
 * stack on phones). Desktop is an
 * asymmetric pair: the credit and result points stand above the smaller before card, the after card
 * spans the full height beside them. Portrait cards take the page's arch mask (souk, maison, bloom
 * → two arches); archetypes that tilt give the cards a slight collage angle that straightens on
 * hover. Reveal: the before card rises, the after lifts in a beat later, then the disc pops.
 */
import { GlowOrb } from "@/landing/illustrations";
import {
  Container,
  Icon,
  cssVars,
  reveal,
  seededRotation,
} from "@/landing/primitives";
import { frameOf, resolveShots, type ViewProps } from "./model";
import { Caption, Credit, Foot, Head, Media, Results, Tag } from "./parts";

export function Cards({ ctx, data, id, titleId }: ViewProps) {
  const shots = resolveShots(ctx, data);
  const frame = frameOf(ctx, shots, true);
  const { before, after } = shots;
  // a slight collage tilt on archetypes that tilt (0 on the straight, gridded ones)
  const tilt = (key: string, k: number) => {
    const deg = seededRotation(ctx, `${id}:ba-${key}`, k);
    return deg ? cssVars({ "--tilt": `${deg}deg` }) : undefined;
  };
  const hasBase = !!data.who.trim() || data.results.some((r) => r.text.trim());
  return (
    <Container className="lp-beforeAfter__wrap">
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <div
        className="lp-beforeAfter__pair"
        data-shape={shots.ratio === "4/5" ? "tall" : "wide"}
        style={cssVars({ "--ratio": shots.ratio.replace("/", " / ") })}
      >
        <figure
          className="lp-beforeAfter__card"
          data-side="before"
          style={tilt("before", 0.7)}
          {...reveal("rise")}
        >
          {/* the lift carries tilt, hover and (arch mask) the drop shadow the mask would clip */}
          <div className="lp-beforeAfter__lift">
            <Media
              ctx={ctx}
              shot={before}
              sizes="(min-width: 64rem) 30vw, (min-width: 48rem) 40vw, 82vw"
              frame={frame}
              className="lp-beforeAfter__photo"
            >
              <Tag ctx={ctx} shot={before} />
            </Media>
          </div>
          {before.caption && before.asset ? (
            <figcaption className="lp-beforeAfter__meta">
              <Caption ctx={ctx} shot={before} />
            </figcaption>
          ) : null}
        </figure>
        <figure
          className="lp-beforeAfter__card"
          data-side="after"
          style={tilt("after", 0.45)}
          {...reveal("rise", 160)}
        >
          {ctx.ornament > 0.3 ? (
            <GlowOrb
              size="120%"
              intensity="medium"
              place="center"
              className="lp-beforeAfter__glow"
            />
          ) : null}
          <div className="lp-beforeAfter__lift">
            <Media
              ctx={ctx}
              shot={after}
              sizes="(min-width: 64rem) 40vw, (min-width: 48rem) 48vw, 92vw"
              frame={frame}
              className="lp-beforeAfter__photo"
            >
              <Tag ctx={ctx} shot={after} look="solid" />
            </Media>
            {/* the disc on the seam rides with the after photo (its edge is the anchor) */}
            <span
              className="lp-beforeAfter__arrow"
              aria-hidden="true"
              {...reveal("stamp", 520)}
            >
              <Icon name="arrow-right" size="1.25em" strokeWidth={2} />
            </span>
          </div>
          {after.caption && after.asset ? (
            <figcaption className="lp-beforeAfter__meta">
              <Caption ctx={ctx} shot={after} />
            </figcaption>
          ) : null}
        </figure>
        {hasBase ? (
          <div className="lp-beforeAfter__base">
            <Credit ctx={ctx} data={data} />
            <Results ctx={ctx} data={data} />
          </div>
        ) : null}
      </div>
      <Foot ctx={ctx} data={data} />
    </Container>
  );
}
