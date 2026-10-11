/**
 * showcase/ingredients — what the product is made of, as a bento: the product photo in the page's
 * mask on a soft glow with a frosted caption chip crossing its lower edge, beside asymmetric
 * ingredient tiles. The first ingredient leads in a wide tile on a contrasting color block with its
 * share set large; every tile carries a minimal line icon, its origin and its share. A real
 * percentage counts up and fills a slim share bar, a figure ("650 g", "2 500 mAh") is set in the
 * display face, a word ("Cœur", "Base") sits in a pill.
 */
import type { ReactElement } from "react";
import { GlowOrb, Leaf, ZelligeLines, type LeafVariant } from "@/landing/illustrations";
import { Container, Counter, Icon, Picture, RichText, cssVars, cx, editAttr, reveal, round } from "@/landing/primitives";
import { density, nestedBg, pageFrame, ratioFor } from "../benefits/kit";
import { Val } from "../benefits/val";
import type { RenderContext } from "../../types";
import type { IngredientData } from "./schema";
import { Action, Head, productVisual, type ViewProps } from "./shared";

/** "97 %", "97%", "12,5 ٪" → 97 / 12.5; anything else (words, "2 500 mAh") → null. */
export function percentOf(share: string): number | null {
  const m = /^\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*[%٪]\s*$/.exec(share);
  if (!m) return null;
  const v = Number(m[1]!.replace(",", "."));
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : null;
}

/** How a share reads: a percentage (counts up, fills a bar), a figure that starts with a number, or a word. */
type ShareKind = "pct" | "fig" | "word";

function shareKind(share: string, pct: number | null): ShareKind {
  if (pct !== null) return "pct";
  return /^[\d٠-٩]/.test(share.trim()) ? "fig" : "word";
}

function Art({ ctx, id, item, i }: { ctx: RenderContext; id: string; item: IngredientData; i: number }): ReactElement {
  if (item.art === "icon") return <Icon name={item.icon} size="100%" strokeWidth={1.5} />;
  const variant: LeafVariant = item.art === "alternate" ? "sprig" : item.art;
  return <Leaf seed={`${ctx.seed}:${id}:leaf:${i}`} variant={variant} tone="accent" weight={1.7} reveal delay={260 + i * 110} />;
}

function Share({ ctx, item, i, pct }: { ctx: RenderContext; item: IngredientData; i: number; pct: number | null }): ReactElement | null {
  const share = item.share.trim();
  if (!share) return null;
  return (
    <span className="lp-showcase__share" data-kind={shareKind(share, pct)} {...editAttr(ctx, `ingredients.${i}.share`)}>
      {pct === null ? (
        <Val ctx={ctx} text={share} />
      ) : (
        // French sets a narrow no-break space before %; the figure stays one LTR unit in Arabic
        <Counter ctx={ctx} to={pct} decimals={Number.isInteger(pct) ? 0 : 1} suffix={ctx.locale === "fr" ? " %" : "%"} delay={280 + i * 110} />
      )}
    </span>
  );
}

export function Ingredients({ ctx, data, id, titleId, bg }: ViewProps): ReactElement {
  const img = productVisual(ctx, data);
  const ratio = ratioFor(img, "4/5", "1/1");
  const caption = data.caption.trim();
  const items = data.ingredients;
  // bento rhythm: the first tile leads full-width; an odd remainder makes the last one wide too
  const lastWide = (items.length - 1) % 2 === 1;
  // a long figure or word ("3 200 cps/min") would squeeze the name beside it on phones: the cells stack
  const longShares = items.slice(1).some((it) => percentOf(it.share) === null && [...it.share.trim()].length > 6);
  const leadBg = nestedBg(ctx, bg, ctx.archetype === "maison" || ctx.archetype === "circuit" ? ["dark", "accent"] : ["accent", "dark"]);
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <div className="lp-showcase__ib">
        <figure className="lp-showcase__media" data-kind={img?.alpha ? "cutout" : "photo"}>
          <GlowOrb place="center" size="104%" intensity="medium" className="lp-showcase__glow" />
          {ctx.archetype === "souk" && density(ctx) > 0 ? <ZelligeLines uid={`${id}-zl`} variant="rosette" className="lp-showcase__zl" /> : null}
          <div className="lp-showcase__frame" {...reveal("mask-arch")}>
            <Picture
              asset={img}
              sizes="(min-width: 60rem) 30rem, 88vw"
              ratio={ratio}
              mask="page"
              frame={img && !img.alpha ? pageFrame(ctx, ratio === "1/1" ? 1 : 0.8) : undefined}
              fit={img?.alpha ? "contain" : "cover"}
              className="lp-showcase__pic"
              alt={img?.alt || ctx.product.name}
            />
          </div>
          {caption ? (
            <figcaption className="lp-showcase__cap lp-glass" {...reveal("rise", 460)}>
              <span className="lp-showcase__capdot" aria-hidden="true" />
              <Val ctx={ctx} text={caption} editPath="caption" />
            </figcaption>
          ) : null}
        </figure>
        {/* the wrapper is the query container: tiles reflow on the column's width, not the viewport's */}
        <div className="lp-showcase__tilewrap">
          <ol className="lp-showcase__tiles" role="list" data-shares={longShares ? "long" : undefined}>
            {items.map((it, i) => {
              const pct = percentOf(it.share);
              const lead = i === 0;
              const wide = lead || (lastWide && i === items.length - 1);
              return (
                <li
                  key={i}
                  className={cx("lp-showcase__tile", !lead && "lp-card", wide && "lp-showcase__tile--wide", lead && "lp-showcase__tile--lead")}
                  data-bg={lead ? leadBg : undefined}
                  {...reveal(lead ? "scale-in" : "rise", 160 + i * 100)}
                >
                  <span className="lp-showcase__art" data-art={it.art === "icon" ? "icon" : "leaf"} aria-hidden="true">
                    <Art ctx={ctx} id={id} item={it} i={i} />
                  </span>
                  <Share ctx={ctx} item={it} i={i} pct={pct} />
                  <div className="lp-showcase__tilebody">
                    <RichText as="h3" className="lp-showcase__label" text={it.name} ctx={ctx} editPath={`ingredients.${i}.name`} decorate={false} />
                    {it.origin.trim() ? (
                      <p className="lp-showcase__origin">
                        <Icon name="map-pin" size="1.05em" />
                        <Val ctx={ctx} text={it.origin} editPath={`ingredients.${i}.origin`} />
                      </p>
                    ) : null}
                    {it.text.trim() ? <RichText as="p" className="lp-showcase__text" text={it.text} ctx={ctx} editPath={`ingredients.${i}.text`} /> : null}
                  </div>
                  {pct !== null ? (
                    <span className="lp-showcase__bar" style={cssVars({ "--p": round(pct / 100, 3) })} aria-hidden="true">
                      <span className="lp-showcase__fill" {...reveal("wipe-side", 380 + i * 110)} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <Action ctx={ctx} data={data} />
    </Container>
  );
}
