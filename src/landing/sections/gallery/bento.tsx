/**
 * gallery/masonry → bento — an asymmetric rounded grid. The heading is a tile of its own, the photos
 * fill hand-tuned templates (1–8 photos: one hero tile, a tall, small squares, a wide), and a color
 * tile closes the set with the price and the order button (or the product's name and tagline when
 * the button is off) under a soft light, with the cash-on-delivery promise. Tiles
 * cascade in, lift on hover while the photo slowly zooms and a soft sheen passes over it.
 */
import type { ReactElement } from "react";
import { Cta, cssVars, cx, Icon, Price, reveal, RichText } from "@/landing/primitives";
import { nestedBg, shortName } from "../benefits/kit";
import { fitSteps } from "../reviews/frames";
import { Caption, Head, Media, mediaReveal } from "./parts";
import type { Shot, ViewProps } from "./model";

/** [column, column span, row, row span] on the 4-column desktop grid. */
type Cell = readonly [number, number, number, number];

/**
 * Desktop templates by photo count: [heading, color tile, ...photos]. Every template fills its rows
 * completely (no holes) and keeps the big photo at the top end, next to the heading.
 */
const TEMPLATES: Record<number, readonly Cell[]> = {
  1: [[1, 2, 1, 1], [1, 2, 2, 1], [3, 2, 1, 2]],
  2: [[1, 2, 1, 1], [2, 1, 2, 1], [3, 2, 1, 2], [1, 1, 2, 1]],
  3: [[1, 2, 1, 1], [4, 1, 3, 1], [3, 2, 1, 2], [1, 2, 2, 2], [3, 1, 3, 1]],
  4: [[1, 2, 1, 1], [4, 1, 3, 1], [3, 2, 1, 2], [1, 1, 2, 2], [2, 1, 2, 1], [2, 2, 3, 1]],
  5: [[1, 2, 1, 1], [4, 1, 3, 1], [3, 2, 1, 2], [1, 1, 2, 2], [2, 1, 2, 1], [2, 1, 3, 1], [3, 1, 3, 1]],
  6: [[1, 2, 1, 1], [1, 1, 4, 1], [3, 2, 1, 2], [1, 1, 2, 2], [2, 1, 2, 1], [2, 1, 3, 1], [3, 2, 3, 2], [2, 1, 4, 1]],
  7: [[1, 2, 1, 1], [3, 1, 4, 1], [3, 2, 1, 2], [1, 1, 2, 2], [2, 1, 2, 1], [2, 1, 3, 1], [3, 1, 3, 1], [4, 1, 3, 2], [1, 2, 4, 1]],
  8: [[1, 2, 1, 1], [3, 1, 4, 1], [3, 2, 1, 2], [1, 1, 2, 2], [2, 1, 2, 1], [2, 1, 3, 1], [3, 1, 3, 1], [4, 1, 3, 2], [1, 1, 4, 1], [2, 1, 4, 1]],
};

const place = (c: Cell) => ({ "--gc": `${c[0]} / span ${c[1]}`, "--gr": `${c[2]} / span ${c[3]}` });

/**
 * Phone / tablet (2 columns): the first photo full width, then pairs with a wide photo every third
 * slot; a photo left alone at the end goes wide so the grid never ends on a hole.
 */
function mobileSpans(count: number): number[] {
  const spans = Array.from({ length: count }, (_, i) => (i % 3 === 0 ? 2 : 1));
  let run = 0;
  for (let i = 1; i <= count; i++) {
    if (i < count && spans[i] === 1) {
      run++;
      continue;
    }
    // an odd run of half-width tiles would leave a hole: its last tile goes wide
    if (run % 2) spans[i - 1] = 2;
    run = 0;
  }
  return spans;
}

/** Desktop shape of a tile → frame ratio hint for `sizes` (wide tiles get more pixels). */
const sizesFor = (c: Cell) => (c[1] === 2 ? "(min-width: 62rem) 36rem, 92vw" : "(min-width: 62rem) 18rem, 46vw");

/** Phones / tablets: the tile's own aspect-ratio (CSS) — the crop engines without container queries keep. */
const phoneRatio = (span: number, hero: boolean) => (span === 2 ? (hero ? 1 : 16 / 11) : 3 / 4);

export function Bento({ ctx, data, bg, titleId, shots }: ViewProps): ReactElement {
  const tpl = TEMPLATES[Math.min(Math.max(shots.length, 1), 8)]!;
  const [headCell, tileCell, ...cells] = tpl;
  const spans = mobileSpans(shots.length);
  const kind = mediaReveal(ctx);
  const tone = nestedBg(ctx, bg, ["accent", "dark", "pop"]);
  const short = shortName(ctx.product.name);
  const tagline = ctx.product.tagline?.trim();

  return (
    <div className="lp-container lp-gallery__bento" data-stagger="70">
      <div className="lp-gallery__tile lp-gallery__tile--head" style={cssVars(place(headCell!))}>
        <Head ctx={ctx} data={data} titleId={titleId} size="m" />
      </div>

      {shots.map((s: Shot, i) => {
        const cell = cells[i]!;
        return (
          <figure
            key={s.n}
            className={cx("lp-gallery__tile", "lp-gallery__tile--photo", i === 0 && "lp-gallery__tile--hero")}
            // desktop rows grow with the heading and price tiles, so a tile's shape is only known at
            // run time: the tile picks its crop from a ladder of fitted ones (container query, CSS)
            style={cssVars({ ...place(cell), "--ms": `span ${spans[i]}`, ...fitSteps(s.asset) })}
            data-w={spans[i] === 2 ? "" : undefined}
            {...reveal(kind)}
          >
            <Media
              ctx={ctx}
              shot={s}
              fill
              sizes={sizesFor(cell)}
              frame={{ shape: "rounded", ratio: phoneRatio(spans[i]!, i === 0) }}
            />
            <Caption ctx={ctx} shot={s} className="lp-glass" />
          </figure>
        );
      })}

      <div
        className="lp-gallery__tile lp-gallery__tile--buy"
        data-bg={tone}
        style={cssVars(place(tileCell!))}
        {...reveal("scale-in")}
      >
        <span className="lp-gallery__buy-light" aria-hidden="true" />
        <p className="lp-gallery__buy-name">{short}</p>
        {data.cta ? (
          <>
            <Price ctx={ctx} amount={ctx.lead.price} compareAt={ctx.lead.compareAt} size="l" />
            <div className="lp-gallery__buy-go">
              <Cta ctx={ctx} label={data.ctaLabel.trim() || ctx.t("cta.order")} editPath="ctaLabel" size="m" />
              <p className="lp-gallery__buy-cod">
                <Icon name="cash-hand" size="1.05em" />
                <span>{ctx.t("trust.cod")}</span>
              </p>
            </div>
          </>
        ) : tagline ? (
          <RichText as="p" className="lp-gallery__buy-tag" text={tagline} ctx={ctx} decorate={false} />
        ) : null}
      </div>
    </div>
  );
}
