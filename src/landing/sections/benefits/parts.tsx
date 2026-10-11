/**
 * Pieces shared by the benefits variants: heading, item title/text, rolling figure, order button,
 * the product photo pool (never repeated) and the lit "plate" that stands in for a photo.
 */
import type { ReactElement } from "react";
import { Counter, Cta, Icon, RichText, SectionHeader, cx, editAttr, reveal, type RevealKind } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { idx, parseFigure, productPhotos, productShots } from "./kit";
import type { BenefitItem, Data } from "./model";
import { Val } from "./val";

/** Framed media prefers real photos; a page with only a cutout still gets its product. */
export function photoPool(ctx: RenderContext): ResolvedAsset[] {
  const shots = productShots(ctx);
  return shots.length ? shots : productPhotos(ctx);
}

/**
 * Hands out media item by item: the item's own image, else the next product photo not shown yet,
 * else null (the caller draws a plate or a figure). A photo never appears twice in one section —
 * repeated or zoomed-in copies of the same shot look like filler — so pool photos that an item
 * already uses as its own image are skipped too.
 */
export function photoPicker(ctx: RenderContext, items: readonly BenefitItem[]): (item: BenefitItem, usePool?: boolean) => ResolvedAsset | null {
  const own = new Set(items.map((it) => ctx.asset(it.image)?.id).filter(Boolean));
  const pool = photoPool(ctx).filter((a) => !own.has(a.id));
  let next = 0;
  return (item, usePool = true) => ctx.asset(item.image) ?? (usePool ? (pool[next++] ?? null) : null);
}

export function Head({ ctx, data, titleId, align = "start" }: { ctx: RenderContext; data: Data; titleId: string; align?: "start" | "center" | "split" }) {
  return <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} align={align} className="lp-benefits__head" />;
}

export function Title({ ctx, item, i, className }: { ctx: RenderContext; item: BenefitItem; i: number; className?: string }) {
  return <RichText as="h3" className={cx("lp-benefits__t", className)} text={item.title} ctx={ctx} editPath={`items.${i}.title`} decorate={false} />;
}

export function Text({ ctx, item, i, className }: { ctx: RenderContext; item: BenefitItem; i: number; className?: string }) {
  return item.text.trim() ? <RichText as="p" className={cx("lp-benefits__p", className)} text={item.text} ctx={ctx} editPath={`items.${i}.text`} /> : null;
}

/** Big product figure: rolls up when it parses as a number, else set as text in reading order ("2–3", "24/7"). */
export function Figure({ ctx, value, i, className, delay }: { ctx: RenderContext; value: string; i: number; className?: string; delay?: number }): ReactElement {
  const f = parseFigure(value);
  if (!f) {
    return <Val ctx={ctx} text={value} className={className} editPath={`items.${i}.stat`} />;
  }
  const edit = editAttr(ctx, `items.${i}.stat`);
  return (
    <span className={className} {...edit}>
      <Counter ctx={ctx} to={f.value} decimals={f.decimals} prefix={f.prefix || undefined} suffix={f.suffix ? f.suffix.replace(/^\s+/, " ") : undefined} delay={delay} />
    </span>
  );
}

/** Caption under a figure (number ranges keep their order in Arabic). */
export function FigLabel({ ctx, item, i, className }: { ctx: RenderContext; item: BenefitItem; i: number; className: string }) {
  return <Val ctx={ctx} text={item.statLabel} className={className} editPath={`items.${i}.statLabel`} />;
}

/** Figure + caption pair ("12 h · on the skin"); null when the item has no figure. */
export function Fact({
  ctx,
  item,
  i,
  className,
  delay,
  enter,
  corner,
}: {
  ctx: RenderContext;
  item: BenefitItem;
  i: number;
  className?: string;
  delay?: number;
  /** entrance of the whole pair (the number itself always rolls up) */
  enter?: RevealKind;
  /** a chip over a photo: the frame corner it takes on phones and on desktop ("ss" block-start /
   * inline-start … "ee") */
  corner?: readonly [string, string];
}) {
  if (!item.stat.trim()) return null;
  return (
    <p className={cx("lp-benefits__fact", className)} data-corner={corner?.[0]} data-corner-lg={corner?.[1]} {...reveal(enter, delay)}>
      <Figure ctx={ctx} value={item.stat} i={i} className="lp-benefits__fig" delay={delay} />
      <FigLabel ctx={ctx} item={item} i={i} className="lp-benefits__figlabel" />
    </p>
  );
}

/**
 * A lit plate in place of a photo — light and type, no clip-art: a studio sweep in the product's
 * hues (one soft light drifting across it when motion allows) carrying the item's key figure set
 * large, or, without one, its index as a tone-on-tone supergraphic cropped by the frame with the
 * benefit's icon in a frosted disc. Takes the shape of its frame (page mask, card corner…) from
 * the caller's class; content stays centered so circle, pill and blob masks never clip it.
 */
export function Plate({ ctx, item, i, className, figure = true }: { ctx: RenderContext; item: BenefitItem; i: number; className?: string; figure?: boolean }) {
  const showFigure = figure && !!item.stat.trim();
  return (
    <div className={cx("lp-benefits__plate", className)} data-figure={showFigure ? "" : undefined}>
      {showFigure ? (
        <p className="lp-benefits__platefig" {...reveal("blur-in", 200)}>
          <Figure ctx={ctx} value={item.stat} i={i} className="lp-benefits__bigfig" delay={260} />
          <FigLabel ctx={ctx} item={item} i={i} className="lp-benefits__biglabel" />
        </p>
      ) : (
        <>
          <span className="lp-benefits__platenum" aria-hidden="true" {...reveal("wipe-up", 120)}>
            {idx(i)}
          </span>
          <span className="lp-benefits__plateico lp-glass" aria-hidden="true" {...reveal("stamp", 320)}>
            <Icon name={item.icon} size="100%" strokeWidth={1.5} />
          </span>
        </>
      )}
    </div>
  );
}

export function Action({ ctx, data, center }: { ctx: RenderContext; data: Data; center?: boolean }) {
  if (!data.cta) return null;
  return (
    <div className={cx("lp-benefits__cta", center && "lp-benefits__cta--center")} {...reveal("rise", 120)}>
      <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" />
    </div>
  );
}
