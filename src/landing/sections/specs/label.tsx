/**
 * specs/label — the spec card: a modern product card read like a label. The product in its well
 * (a portrait photo fills one side on wide screens; a landscape one runs across the top as a banner;
 * a cutout stands up out of the card), a frosted cash-on-delivery chip over it, store · reference
 * line, the product name, the first spec set large, the remaining specs in a hairline grid,
 * attribute chips, then price and order button. The card tilts in and a soft band of light sweeps
 * across it once; a product-tinted glow sits behind.
 */
import type { ReactElement } from "react";
import { DotGrid, GlowOrb, ZelligeLines } from "@/landing/illustrations";
import { Container, Icon, RichText, cssVars, reveal, seededRotation } from "@/landing/primitives";
import { density, fitProps, shortName } from "../benefits/kit";
import { hasStoreName } from "../persona";
import { Buy, Head, Highlights, Media, Note, SpecList, cardBg, fitOf, visuals, type ViewProps } from "./parts";

/** Rows printed on the card. */
export const CARD_ROWS = 7;

export function Label({ ctx, data, id, titleId, bg }: ViewProps): ReactElement {
  const img = visuals(ctx, data)[0] ?? null;
  const p = ctx.product;
  const sku = p.sku?.trim();
  const decor = density(ctx);
  const rot = seededRotation(ctx, `${id}:card`, 0.45);
  const fit = img ? fitOf(img) : null;
  // side: a portrait photo beside the label · banner: a landscape photo across the top · cutout
  const layout = !img ? "plain" : fit === "cutout" ? "cutout" : fit === "mat" ? "banner" : "side";
  const named = hasStoreName(ctx);
  return (
    <Container className="lp-specs__grid lp-specs__lab">
      <div className="lp-specs__lead">
        <Head ctx={ctx} data={data} titleId={titleId} />
        <Note ctx={ctx} data={data} />
      </div>
      <div className="lp-specs__cardwrap" data-layout={layout}>
        <span className="lp-specs__aura" aria-hidden="true">
          <GlowOrb place="center" size="96%" intensity="medium" />
          {decor > 0 && ctx.archetype === "souk" ? <ZelligeLines uid={`${id}-z`} variant="rosette" tile={84} /> : null}
          {decor > 0 && (ctx.archetype === "circuit" || ctx.archetype === "garage") ? <DotGrid cell={18} fade="radial" /> : null}
        </span>
        <article
          className="lp-specs__card"
          data-layout={layout}
          data-bg={cardBg(bg)}
          style={cssVars({ "--rot": rot ? `${rot}deg` : undefined })}
          {...reveal("tilt-in", 140)}
        >
          {img ? (
            <div className="lp-specs__well">
              <Media
                ctx={ctx}
                asset={img}
                ratio={layout === "side" ? "4/5" : undefined}
                sizes={layout === "banner" ? "(min-width: 60rem) 40rem, 88vw" : "(min-width: 60rem) 26rem, 88vw"}
                // side: a square well on phones, the card's full height beside the label on wide screens
                crop={layout === "side" ? fitProps(img, "rounded", 1, [0.4, 0.75], "60rem") : undefined}
              />
              <span className="lp-specs__codchip lp-glass" {...reveal("blur-in", 560)}>
                <Icon name="cash-hand" size="1.1em" />
                {ctx.t("trust.cod")}
              </span>
            </div>
          ) : null}
          <div className="lp-specs__cbody">
            {/* the store and the reference — never the product standing in for a store without a name */}
            {named || sku ? (
              <p className="lp-specs__brand">
                {named ? <bdi>{ctx.store.name.trim()}</bdi> : null}
                {sku ? (
                  <span className="lp-specs__sku">
                    <bdi>{sku}</bdi>
                  </span>
                ) : null}
              </p>
            ) : null}
            <h3 className="lp-specs__pname">
              {/* the size tail of the name ("— 50 ml") is already the card's key figure */}
              <RichText as="span" text={shortName(p.name)} ctx={ctx} decorate={false} />
            </h3>
            {/* a label stays concise: the key figure and six more (every row shows in the other variants) */}
            <SpecList ctx={ctx} rows={data.rows.slice(0, CARD_ROWS)} layout="grid" hero count />
            <Highlights ctx={ctx} data={data} delay={320} />
            {/* without a photo the cash-on-delivery promise moves beside the price */}
            <Buy ctx={ctx} data={data} look="line" delay={0} always cod={!img} />
          </div>
        </article>
      </div>
    </Container>
  );
}
