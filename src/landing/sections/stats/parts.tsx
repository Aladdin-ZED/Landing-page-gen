/**
 * Pieces shared by the stats compositions: the rolling figure, its caption, the source footnote,
 * the heading, the order button, the share meter and the product visual.
 */
import { Counter, Cta, Picture, SectionHeader, cssVars, cx, editAttr, reveal, round, type MaskKind } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import type { FitProps } from "../benefits/kit";
import { Val } from "../benefits/val";
import { decimalsOf, scaleEnd, type Data, type StatItem } from "./model";

interface FigureProps {
  ctx: RenderContext;
  it: StatItem;
  i: number;
  className?: string;
  delay?: number;
}

/**
 * Figure that rolls up on reveal. Counter keeps "+12 400" / "94%" in one LTR isolate on Arabic
 * pages; symbolic affixes are set small and raised, word units small on the baseline (stats.css).
 */
export function Figure({ ctx, it, i, className, delay }: FigureProps) {
  return (
    <span className={cx("lp-stats__fig", className)} {...editAttr(ctx, `items.${i}.value`)}>
      <Counter ctx={ctx} to={it.value} decimals={decimalsOf(it.value)} prefix={it.prefix || undefined} suffix={it.suffix || undefined} delay={delay} />
    </span>
  );
}

/**
 * Still figure for decorative copies (the ticker band repeats its items): same typography as the
 * rolling one, plain text, one LTR isolate so "+12 400" never reorders on Arabic pages.
 */
export function StaticFigure({ ctx, it, className }: { ctx: RenderContext; it: StatItem; className?: string }) {
  // word units ("h", "dB") sit on the baseline like the rolling figure's; symbols are raised
  const affix = (s: string) =>
    s.trim() ? (
      <span className="lp-counter__affix" data-word={/\p{L}/u.test(s) ? "" : undefined}>
        {s.trim()}
      </span>
    ) : null;
  return (
    <bdi className={cx("lp-stats__fig", "lp-stats__fig--static", className)} dir="ltr">
      {affix(it.prefix)}
      {ctx.num(round(it.value, decimalsOf(it.value)))}
      {affix(it.suffix)}
    </bdi>
  );
}

/** Caption under a figure; `marked` keys it to the source footnote. */
export function Label({ ctx, it, i, marked, className }: { ctx: RenderContext; it: StatItem; i: number; marked: boolean; className?: string }) {
  return (
    <p className={cx("lp-stats__label", className)}>
      <Val ctx={ctx} text={it.label} editPath={`items.${i}.label`} />
      {marked ? (
        <sup className="lp-stats__mark" aria-hidden="true">
          *
        </sup>
      ) : null}
    </p>
  );
}

/** Editorial index ("01"): Latin digits on every page, like the figures. */
export const idx = (i: number): string => String(i + 1).padStart(2, "0");

export const hasSource = (data: Data): boolean => !!data.source.trim();

/** Footnote: where the numbers come from, keyed to the marks on the captions. */
export function Source({ ctx, data }: { ctx: RenderContext; data: Data }) {
  if (!hasSource(data)) return null;
  return (
    <p className="lp-stats__source" {...reveal("fade", 240)}>
      <span className="lp-stats__srcmark" aria-hidden="true">
        *
      </span>
      <Val ctx={ctx} text={data.source} editPath="source" />
    </p>
  );
}

export function Head({ ctx, data, titleId, align = "start" }: { ctx: RenderContext; data: Data; titleId: string; align?: "start" | "split" }) {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      editBase=""
      titleId={titleId}
      align={align}
      size="m"
      className="lp-stats__head"
    />
  );
}

/** Source footnote + optional order button, on one line when there is room. */
export function Foot({ ctx, data }: { ctx: RenderContext; data: Data }) {
  if (!hasSource(data) && !data.cta) return null;
  return (
    <div className="lp-stats__foot">
      <Source ctx={ctx} data={data} />
      {data.cta ? (
        <div {...reveal("rise", 200)}>
          <Cta ctx={ctx} label={data.ctaLabel || undefined} editPath="ctaLabel" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Product visual: a cutout stands in its own light (contact shadow, no frame); a photo sits in a
 * clean mask. Decorative — the numbers carry the meaning.
 */
export function Visual({ asset, mask, sizes, fit }: { asset: ResolvedAsset; mask: MaskKind; sizes: string; fit?: FitProps }) {
  const cut = asset.alpha;
  return (
    <span className="lp-stats__vis" data-kind={cut ? "cutout" : "photo"}>
      <Picture asset={asset} sizes={sizes} alt="" fit={cut ? "contain" : "cover"} mask={cut ? undefined : mask} className="lp-stats__pic" {...(cut ? {} : fit)} />
    </span>
  );
}

interface MeterProps {
  f: number;
  delay?: number;
  className?: string;
  /** "0 … whole" under the bar (the lead panel): gives the share its context */
  scale?: { ctx: RenderContext; it: StatItem };
}

/**
 * Slim progress meter (decorative: the figure states the claim). The fill wipes in along the reading
 * direction and ends in a soft point of light; the optional scale names both ends of the whole.
 */
export function Meter({ f, delay, className, scale }: MeterProps) {
  return (
    <span className={cx("lp-stats__meter", className)} style={cssVars({ "--f": round(f, 4) })} aria-hidden="true">
      <span className="lp-stats__bar">
        <span className="lp-stats__meterfill" {...reveal("wipe-side", delay)} />
      </span>
      {scale ? (
        <span className="lp-stats__scale">
          <bdi dir="ltr">{scale.ctx.num(0)}</bdi>
          <bdi dir="ltr">{scaleEnd(scale.ctx, scale.it)}</bdi>
        </span>
      ) : null}
    </span>
  );
}
