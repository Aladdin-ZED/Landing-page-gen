/**
 * Building blocks shared by the four review layouts: heading, score capsule, review atoms
 * (stars row, verified pill, quote, byline, customer photo, order detail), the quote mark and the
 * CTA row. All pure; every class is styled in reviews.css.
 */
import type { ReactElement, ReactNode } from "react";
import { Counter, Cta, Icon, Picture, RichText, SectionHeader, Stars, cx, editAttr, reveal, round } from "../../primitives";
import type { RenderContext } from "../../types";
import { UI, type Data, type Item } from "./model";
import { Avatar, CheckSeal, countLabel, say, scoreOf, type Score } from "./parts";

export const titleId = (id: string) => `${id}-title`;

/**
 * The section score: the product's real rating when the merchant set one, else the plain average of
 * the reviews shown — but only once the merchant confirmed those reviews are real. Sample reviews
 * (`sample: true`) never produce an average presented as a store rating.
 */
export const sectionScore = (ctx: RenderContext, data: Data): Score | null => {
  if (!data.showSummary) return null;
  if (data.sample && !ctx.product.rating) return null;
  return scoreOf(ctx, data.items.map((x) => x.rating));
};

/** "01 / 06" with the page's digits, isolated left-to-right. */
export function SlideCount({ ctx, i, n, className }: { ctx: RenderContext; i: number; n: number; className?: string }) {
  const two = (k: number) => ctx.num(k).padStart(2, ctx.num(0));
  return (
    <bdi dir="ltr" className={cx("lp-rv__count", className)} aria-hidden="true">
      {two(i + 1)}
      <span className="lp-rv__count-of"> / {two(n)}</span>
    </bdi>
  );
}

export function Header({
  ctx,
  data,
  id,
  align = "start",
  size = "l",
  className,
  children,
}: {
  ctx: RenderContext;
  data: Data;
  id: string;
  align?: "start" | "center" | "split";
  size?: "m" | "l" | "xl";
  className?: string;
  children?: ReactNode;
}): ReactElement | null {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      editBase=""
      titleId={titleId(id)}
      align={align}
      size={size}
      className={cx("lp-rv__sh", className)}
    >
      {children}
    </SectionHeader>
  );
}

/** "4,7 ★★★★★ 312 avis" — the compact score capsule used in headers. */
export function ScoreCapsule({ ctx, score, delay = 280 }: { ctx: RenderContext; score: Score; delay?: number }) {
  return (
    <p className="lp-rv__cap" {...reveal("rise", delay)}>
      <span className="lp-rv__cap-num lp-num">
        <Counter ctx={ctx} to={score.value} decimals={1} />
      </span>
      <span className="lp-rv__cap-meta">
        <Stars ctx={ctx} value={score.value} size="s" />
        <span className="lp-rv__cap-count">{score.fromProduct ? countLabel(ctx, score.count) : say(ctx, UI.shown)}</span>
      </span>
    </p>
  );
}

/** "Verified purchase" — only on merchant-confirmed reviews (never on sample content). */
export function Verified({ ctx, item, data }: { ctx: RenderContext; item: Item; data: Pick<Data, "sample"> }) {
  if (!item.verified || data.sample) return null;
  return (
    <span className="lp-rv__ok">
      <CheckSeal className="lp-rv__ok-ic" />
      {ctx.t("reviews.verified")}
    </span>
  );
}

/**
 * "city · date" breaks only after the dot: a short part ("La semaine dernière", "قبل يومين") keeps its
 * words together (no-break spaces) and the dot stays with the city, so a narrow byline reads
 * "Témara ·" / "La semaine dernière", never "Témara · La" / "semaine dernière". A long part keeps its
 * normal spaces and wraps as usual.
 */
const META_KEEP = 22;
const keepTogether = (s: string) => (s.length <= META_KEEP ? s.replace(/ /g, " ") : s);

/** Avatar + name + "city · date". */
export function Byline({ ctx, item, i, size = "m" }: { ctx: RenderContext; item: Item; i: number; size?: "m" | "l" }) {
  const meta = [item.city, item.date]
    .map((s) => s.trim())
    .filter(Boolean)
    .map(keepTogether);
  return (
    <span className={cx("lp-rv__by", size === "l" && "lp-rv__by--l")}>
      <Avatar name={item.name} className="lp-rv__av" />
      <span className="lp-rv__who">
        <span className="lp-rv__name" {...editAttr(ctx, `items.${i}.name`)}>
          {item.name}
        </span>
        {/* RichText: numbers in merchant text ("قبل 2–3 أيام") keep their order on Arabic pages */}
        {meta.length ? <RichText as="span" className="lp-rv__meta" text={meta.join(" · ")} ctx={ctx} decorate={false} /> : null}
      </span>
    </span>
  );
}

/**
 * Display-size quotes scale with length: a one-liner gets poster type, a long review steps down so
 * it never turns into a wall of huge type.
 */
export const quoteLength = (text: string): "xs" | "s" | "m" | "l" =>
  text.length <= 90 ? "xs" : text.length <= 150 ? "s" : text.length <= 290 ? "m" : "l";

export function Quote({ ctx, item, i, className }: { ctx: RenderContext; item: Item; i: number; className?: string }) {
  return (
    <blockquote className={cx("lp-rv__quote", className)} data-len={quoteLength(item.text)}>
      <RichText as="p" text={item.text} ctx={ctx} decorate={false} editPath={`items.${i}.text`} />
    </blockquote>
  );
}

export function ReviewTitle({ ctx, item, i, className }: { ctx: RenderContext; item: Item; i: number; className?: string }) {
  if (!item.title.trim()) return null;
  return (
    <RichText as="p" className={cx("lp-rv__title", className)} text={item.title} ctx={ctx} decorate={false} editPath={`items.${i}.title`} />
  );
}

/** "Commande : Pack Duo" with a bag glyph. */
export function Detail({ ctx, item, i }: { ctx: RenderContext; item: Item; i: number }) {
  if (!item.detail.trim()) return null;
  return (
    <p className="lp-rv__detail">
      <Icon name="bag" size={15} className="lp-rv__detail-ic" />
      <RichText as="span" text={item.detail} ctx={ctx} decorate={false} editPath={`items.${i}.detail`} />
    </p>
  );
}

/**
 * The customer's photo in a rounded frame (nothing when there is none), cropped for that exact frame:
 * a face or a pair of hands is never cut by the frame edge, a product keeps its top. `ratioLg`: the
 * frame the photo takes from `lg` up when the layout reshapes it (a side column, a portrait window).
 */
export function Photo({
  ctx,
  item,
  sizes,
  ratio = "4/3",
  ratioLg,
  lg = "64rem",
  className,
}: {
  ctx: RenderContext;
  item: Item;
  sizes: string;
  ratio?: string;
  ratioLg?: string;
  lg?: string;
  className?: string;
}) {
  const a = ctx.asset(item.photo);
  if (!a) return null;
  const alt = a.alt.trim() || say(ctx, UI.photoOf).replace("{name}", item.name);
  return (
    <Picture
      asset={a}
      sizes={sizes}
      ratio={ratio}
      frame={{ shape: "rounded", ratio }}
      frameLg={ratioLg ? { shape: "rounded", ratio: ratioLg } : undefined}
      frameMin={ratioLg ? lg : undefined}
      className={cx("lp-rv__photo", className)}
      alt={alt}
    />
  );
}

/** The order button under the reviews (`className` places it in a layout's own grid area). */
export function CtaRow({ ctx, data, className }: { ctx: RenderContext; data: Data; className?: string }) {
  if (!data.cta.trim()) return null;
  return (
    <div className={cx("lp-rv__cta", className)} {...reveal("rise", 120)}>
      <Cta ctx={ctx} label={data.cta} withPrice editPath="cta" />
    </div>
  );
}

/** A clean geometric opening quote (two rounded blocks with a curved tail), mirrored in RTL. */
export function QuoteMark({ className }: { className?: string }) {
  const d =
    "M0 40V26C0 12 7 3.5 19 .5c1.1-.3 2.2.3 2.5 1.4l.9 3c.3 1-.2 2-1.2 2.4C15.4 9.6 12 14 11.4 20H20a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z";
  return (
    <svg className={cx("lp-rv__qm", className)} viewBox="0 0 58 44" aria-hidden="true" focusable="false">
      <path d={d} />
      <path d={d} transform="translate(34 0)" />
    </svg>
  );
}

/** Point on a gauge circle (120×120 box) after `fraction` of a clockwise turn from 12 o'clock. */
export function gaugePoint(fraction: number, r = 52, c = 60): { x: number; y: number } {
  const a = -Math.PI / 2 + Math.min(1, Math.max(0, fraction)) * 2 * Math.PI;
  return { x: round(c + r * Math.cos(a), 2), y: round(c + r * Math.sin(a), 2) };
}

/**
 * SVG path of a gauge arc on a 120×120 box: starts at 12 o'clock, runs clockwise for `fraction`
 * of the circle (a full circle is drawn as two half arcs).
 */
export function gaugeArc(fraction: number, r = 52, c = 60): string {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= 0) return "";
  if (f >= 0.9999) return `M${c} ${c - r}A${r} ${r} 0 1 1 ${c} ${c + r}A${r} ${r} 0 1 1 ${c} ${c - r}`;
  const { x, y } = gaugePoint(f, r, c);
  return `M${c} ${c - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y}`;
}

/** The product picture for proof tiles: the cutout when there is one, else the first photo. */
export const productVisual = (ctx: RenderContext) => ctx.asset(ctx.product.cutout) ?? ctx.asset(ctx.product.images[0]);
