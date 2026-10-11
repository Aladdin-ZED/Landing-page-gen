/**
 * checklist — ours checked, the alternatives struck. Each criterion becomes one line of a ledger:
 * a small label, our answer large with an accent check disc, and right under it what the usual
 * alternative gives, struck through by one clean accent line that draws across once the check has
 * landed (every wrapped line gets its own stroke; longer answers draw a little slower). A product photo in the theme's mask, with a glass chip, holds
 * the start column on desktop and stays in view while the ledger scrolls by (landscape photos keep
 * a landscape crop and get the wider column); on phones it sits between the heading and the ledger.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Icon, Picture, RichText, SectionHeader, cssVars, cx, reveal } from "@/landing/primitives";
import { density, ratioFor, shortName } from "../benefits/kit";
import { maskOf, pageShape, placeOverlay, shapeFor } from "../story/fit";
import type { ViewProps } from "./model";
import { Foot, Label, Mark, pickVisual } from "./parts";

/** Pace: lines land 110ms apart; each strike starts once its check has drawn. */
const ROW_START = 160;
const ROW_STEP = 110;

export function Checklist({ ctx, data, titleId }: ViewProps): ReactElement {
  const visual = pickVisual(ctx, data, "upright");
  const wide = !!visual && visual.width > visual.height * 1.08;
  const n = data.rows.length;
  // the page's mask at the photo's own ratio — rounded when the curved mask would cut a head; the
  // chip crosses the photo's foot on the side where it covers no hand
  const page = pageShape(ctx);
  const ratio = ratioFor(visual, "4/5", "4/3");
  const F = page === "circle" ? 1 : wide ? 4 / 3 : 4 / 5;
  const shape = visual ? shapeFor(visual, page, F) : page;
  const chipAt =
    visual && !visual.alpha
      ? placeOverlay(visual, { shape, ratio: F }, ["xc", "xs", "xe"], { chip: { w: wide ? 0.5 : 0.72, h: 0.13 }, dir: ctx.dir === "rtl" ? "rtl" : "ltr" }).spot
      : "xc";
  return (
    <Container className={cx("lp-comparison__split", !visual && "lp-comparison__split--bare", wide && "lp-comparison__split--wide")}>
      {visual ? (
        <figure className={cx("lp-comparison__figure", wide && "lp-comparison__figure--wide")}>
          {density(ctx) > 0 ? <GlowOrb className="lp-comparison__glow" size="115%" place="center" intensity="soft" /> : null}
          <div className="lp-comparison__frame" {...reveal("mask-arch", 80)}>
            <Picture
              asset={visual}
              sizes="(min-width: 60rem) 30rem, 92vw"
              ratio={ratio}
              fit={visual.alpha ? "contain" : "cover"}
              mask={maskOf(shape, page)}
              frame={visual.alpha ? undefined : { shape, ratio: F }}
              className="lp-comparison__fpic"
            />
          </div>
          <figcaption className="lp-comparison__chip lp-glass" data-at={chipAt} {...reveal("rise", 420)}>
            <span className="lp-comparison__chipmark" aria-hidden="true">
              <Icon name="check" size="0.95em" strokeWidth={2.6} />
            </span>
            <span className="lp-comparison__chiptext">
              <Label ctx={ctx} text={data.usLabel} path="usLabel" className="lp-comparison__chipus" />
              <bdi className="lp-comparison__chipname">{shortName(ctx.product.name)}</bdi>
            </span>
          </figcaption>
        </figure>
      ) : null}

      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} size="m" className="lp-comparison__head" />

      <div className="lp-comparison__body">
        <div className="lp-comparison__legend" {...reveal("fade", 120)}>
          <span className="lp-comparison__key lp-comparison__key--us">
            <Mark ctx={ctx} kind="yes" quiet />
            <Label ctx={ctx} text={data.usLabel} path="usLabel" />
          </span>
          <span className="lp-comparison__key lp-comparison__key--them">
            <span className="lp-comparison__keystrike" aria-hidden="true" />
            <Label ctx={ctx} text={data.themLabel} path="themLabel" />
          </span>
        </div>

        <ul className="lp-comparison__checks" role="list">
          {data.rows.map((row, i) => {
            const us = row.us.trim();
            const them = row.them.trim();
            const delay = ROW_START + i * ROW_STEP;
            return (
              <li
                key={i}
                className={cx("lp-comparison__check", row.partial && "lp-comparison__check--partial")}
                style={cssVars({ "--sd": `${delay + 420}ms`, "--sdur": `${Math.round(420 + Math.min(them.length, 40) * 9)}ms` })}
                {...reveal("rise", delay)}
              >
                <Mark ctx={ctx} kind="yes" delay={delay + 120} quiet={!!us} />
                <div className="lp-comparison__cbody">
                  {us ? <RichText as="span" className="lp-comparison__clabel" text={row.label} ctx={ctx} decorate={false} editPath={`rows.${i}.label`} /> : null}
                  <RichText as="span" className="lp-comparison__cus" text={us || row.label} ctx={ctx} decorate={false} editPath={us ? `rows.${i}.us` : `rows.${i}.label`} />
                  {them || row.partial ? (
                    <span className="lp-comparison__cthem">
                      {row.partial ? <Mark ctx={ctx} kind="partial" /> : null}
                      {/* the flex item is this wrapper, so the struck text stays inline and every
                          wrapped line gets its own stroke */}
                      <span className="lp-comparison__ctext">
                        <span className="lp-visually-hidden">{data.themLabel}: </span>
                        {them ? <RichText as="span" className="lp-comparison__struck" text={them} ctx={ctx} decorate={false} editPath={`rows.${i}.them`} /> : null}
                      </span>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        <Foot ctx={ctx} data={data} delay={ROW_START + n * ROW_STEP} />
      </div>
    </Container>
  );
}
