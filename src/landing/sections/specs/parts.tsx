/**
 * Pieces shared by the specs variants: heading, buy row (price + order button), attribute chips,
 * the spec list (hairline rows or a cell grid), a group's body, the product tile with its glass
 * key-figure callout, framed product media and the footnote.
 */
import type { ReactElement } from "react";
import { DotGrid, GlowOrb, ZelligeLines } from "@/landing/illustrations";
import { Cta, Icon, Picture, Price, RichText, SectionHeader, cx, editAttr, plainText, reveal } from "@/landing/primitives";
import type { FrameShape } from "@/lib/media/focus";
import type { SectionBg } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../../types";
import { density, fitProps, parseFigure, productPhotos, shortName, type FitProps } from "../benefits/kit";
import { maskOf, pageShape, placeOverlay, shapeFor, type Spot } from "../story/fit";
import type { Data, GroupData, RowData } from "./schema";

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  /** section instance id (unique DOM ids for tabs and accordion names) */
  id: string;
  titleId: string;
  /** the section's own color block */
  bg: SectionBg;
}

/** "01", "02"… — Latin digits, like every figure on the page. */
export const num2 = (i: number): string => String(i + 1).padStart(2, "0");

/**
 * Color block for raised cards inside the section (tab stage, accordion items, spec card): the
 * card always carries its own data-bg so every --sec-* token inside it is solved for the card.
 */
export const cardBg = (bg: SectionBg): SectionBg => (bg === "surface" ? "base" : "surface");

/** Product visuals: the section's own image first, then the cutout and the product photos. */
export function visuals(ctx: RenderContext, data: Data): ResolvedAsset[] {
  const own = ctx.asset(data.image);
  const rest = productPhotos(ctx);
  return own ? [own, ...rest.filter((a) => a.id !== own.id)] : rest;
}

/**
 * How a photo sits in a frame: a cutout on its lit stage, a portrait photo filling the frame, or a
 * landscape photo on a backdrop of its own color ("mat") so a tall frame never crops it thin.
 */
export type Fit = "cutout" | "fill" | "mat";
export const fitOf = (a: ResolvedAsset): Fit => (a.alpha ? "cutout" : a.width > a.height * 1.08 ? "mat" : "fill");

/** Frame ratio for the photo's natural shape (landscape kept, clamped to 2:1). */
export const naturalRatio = (a: ResolvedAsset): string => `${Math.round(Math.min(2, Math.max(1, a.width / a.height)) * 1000) / 1000}`;

export function Head({
  ctx,
  data,
  titleId,
  align = "start",
  className,
}: {
  ctx: RenderContext;
  data: Data;
  titleId: string;
  align?: "start" | "center";
  className?: string;
}): ReactElement {
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
      className={cx("lp-specs__head", className)}
    />
  );
}

/**
 * The buy row: the real price (struck reference only when genuinely higher) beside the order
 * button. Shown with the button; `always` keeps the price when the button is off (the spec card).
 */
export function Buy({
  ctx,
  data,
  look = "bar",
  delay = 160,
  always = false,
  cod = false,
}: {
  ctx: RenderContext;
  data: Data;
  /** bar: a soft tinted bar (wide screens) · line: on a hairline, inside a card */
  look?: "bar" | "line";
  delay?: number;
  always?: boolean;
  /** with the button off: a cash-on-delivery line beside the price */
  cod?: boolean;
}): ReactElement | null {
  if (!data.cta && !always) return null;
  const p = ctx.product;
  return (
    <div className={cx("lp-specs__buy", `lp-specs__buy--${look}`)} {...reveal("rise", delay)}>
      <Price ctx={ctx} amount={p.price} compareAt={p.compareAt} size="m" className="lp-specs__price" />
      {data.cta ? (
        <Cta ctx={ctx} label={data.ctaLabel.trim() || undefined} editPath="ctaLabel" wide className="lp-specs__btn" />
      ) : cod ? (
        <span className="lp-specs__cod">
          <Icon name="cash-hand" size="1.15em" />
          {ctx.t("trust.cod")}
        </span>
      ) : null}
    </div>
  );
}

/** Short attribute chips with a check disc ("Sans parabènes"). */
export function Highlights({ ctx, data, className, delay = 200 }: { ctx: RenderContext; data: Data; className?: string; delay?: number }): ReactElement | null {
  const items = data.highlights.filter((h) => h.text.trim());
  if (!items.length) return null;
  return (
    <ul className={cx("lp-specs__chips", className)} role="list" data-stagger="60">
      {items.map((h, i) => (
        <li key={i} className="lp-specs__chip" {...reveal("scale-in", delay)}>
          <span className="lp-specs__tick" aria-hidden="true">
            <Icon name="check" size="0.8em" strokeWidth={2.6} />
          </span>
          <RichText as="span" text={h.text} ctx={ctx} decorate={false} editPath={`highlights.${i}.text`} />
        </li>
      ))}
    </ul>
  );
}

/** Right-to-left script anywhere in the text → the value reads RTL, else LTR ("ARG-30", "USB-C"). */
const RTL_TEXT = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const textDir = (s: string): "rtl" | "ltr" => (RTL_TEXT.test(s) ? "rtl" : "ltr");

/** A figure ("30 ml", "6 niveaux", "< 45 dB") is set in the display face; descriptive values in the text face. */
const isFigure = (s: string): boolean => {
  const v = s.trim();
  // a number first (after at most a symbol such as "<" or "×"): "ARG-30" is a reference, not a figure
  return v.length <= 14 && /^[^\p{L}\d]{0,3}\d/u.test(v);
};

const NBSP = String.fromCharCode(0xa0);

/** Number / unit split of a figure value — null when the value is not a clean figure. */
function figureParts(value: string) {
  const v = value.trim();
  const f = isFigure(v) ? parseFigure(v) : null;
  if (!f || /[\p{L}\d]/u.test(f.prefix) || /\d/.test(f.suffix)) return null;
  return { f, digits: v.slice(f.prefix.length, v.length - f.suffix.length), pre: f.prefix.trim(), unit: f.suffix.trim() };
}

/**
 * A spec value. A figure ("30 ml", "6 niveaux", "< 45 dB") is split into number and unit so the
 * unit can sit smaller beside a large number; whole numbers roll up on reveal — only when the page's
 * own number format reproduces the merchant's digits, so the final text is exactly what was typed.
 */
function Value({ ctx, value, count }: { ctx: RenderContext; value: string; count: boolean }) {
  const parts = figureParts(value);
  // "Rose · Crème": the dot stays with the word before it, so a wrapped line never starts with "·"
  if (!parts) return <RichText as="span" text={value.trim().replace(/ · /g, `${NBSP}· `)} ctx={ctx} decorate={false} />;
  const { f, digits, pre, unit } = parts;
  const roll = count && f.decimals === 0 && f.value >= 3 && ctx.num(f.value) === digits;
  return (
    <span className="lp-specs__fig">
      {pre ? <span className="lp-specs__unit">{pre}</span> : null}
      <span className="lp-specs__num" {...(roll ? { "data-count-to": String(f.value), "data-count-decimals": "0", ...reveal("count") } : {})}>
        {digits}
      </span>
      {unit ? <span className="lp-specs__unit">{unit}</span> : null}
    </span>
  );
}

/** The first spec whose value is a clean figure ("30 ml") — the tile's key-figure callout. */
export function keyFigure(rows: readonly RowData[]): RowData | null {
  return rows.find((r) => r.label.trim() && figureParts(r.value) !== null) ?? null;
}

export interface SpecListProps {
  ctx: RenderContext;
  rows: readonly RowData[];
  /** rows: label | value on hairlines · grid: cells (label over value) */
  layout: "rows" | "grid";
  /** index of rows[0] inside data.rows (edit paths) */
  offset?: number;
  /** roll numeric values up on reveal */
  count?: boolean;
  /** reveal rows as they scroll in (off inside tab panels and closed groups) */
  animate?: boolean;
  /** set the first row large (spec card) */
  hero?: boolean;
  className?: string;
}

export function SpecList({ ctx, rows, layout, offset = 0, count = false, animate = true, hero = false, className }: SpecListProps): ReactElement | null {
  const list = rows.filter((r) => r.label.trim() && r.value.trim());
  if (!list.length) return null;
  const isLong = (r: RowData) => r.value.length > (layout === "grid" ? 26 : 40);
  // grid: half cells pair up (dense flow); an odd one out spans the row instead of leaving a hole
  const halves = layout === "grid" ? list.filter((r, i) => !(hero && i === 0) && !isLong(r)) : [];
  const lone = halves.length % 2 === 1 ? halves[halves.length - 1] : undefined;
  return (
    <dl className={cx("lp-specs__dl", `lp-specs__dl--${layout}`, className)} data-stagger={animate ? "70" : undefined}>
      {list.map((r, i) => {
        const at = offset + rows.indexOf(r);
        const big = hero && i === 0;
        return (
          <div
            key={at}
            className={cx("lp-specs__row", big && "lp-specs__row--hero")}
            data-long={isLong(r) || r === lone ? "" : undefined}
            data-fig={figureParts(r.value) ? "" : undefined}
            {...reveal(animate && "rise")}
          >
            <dt className="lp-specs__k">
              <span className="lp-specs__i" aria-hidden="true">
                {num2(at)}
              </span>
              <bdi dir={textDir(r.label)} {...editAttr(ctx, `rows.${at}.label`)}>
                <RichText as="span" text={r.label} ctx={ctx} decorate={false} />
              </bdi>
            </dt>
            <dd className="lp-specs__v" {...editAttr(ctx, `rows.${at}.value`)}>
              <bdi dir={textDir(r.value)}>
                <Value ctx={ctx} value={r.value} count={count && animate} />
              </bdi>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** A group's content: its text, or the spec rows (with the text as a short intro). */
export function GroupBody({ ctx, data, g, gi, layout = "grid" }: { ctx: RenderContext; data: Data; g: GroupData; gi: number; layout?: "rows" | "grid" }): ReactElement {
  const body = g.body.trim() ? (
    <RichText as="div" block text={g.body} ctx={ctx} editPath={`groups.${gi}.body`} className={cx("lp-specs__body", g.kind === "specs" && "lp-specs__body--intro")} />
  ) : null;
  if (g.kind !== "specs") return body ?? <div className="lp-specs__body" {...editAttr(ctx, `groups.${gi}.body`)} />;
  return (
    <>
      {body}
      <SpecList ctx={ctx} rows={data.rows} layout={layout} animate={false} />
      <Note ctx={ctx} data={data} animate={false} />
    </>
  );
}

/** One-line preview of a group for its closed header: the text's opening words, or the spec labels. */
export function groupPeek(data: Data, g: GroupData): string {
  const text =
    g.kind === "specs"
      ? data.rows
          .filter((r) => r.label.trim())
          .map((r) => r.label.trim())
          .join(" · ")
      : plainText(g.body);
  return text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text;
}

/** The product photo or cutout. */
export function Visual({
  ctx,
  asset,
  sizes,
  ratio,
  className,
  priority,
  fit,
  mask,
}: {
  ctx: RenderContext;
  asset: ResolvedAsset;
  sizes: string;
  ratio: string;
  className?: string;
  priority?: boolean;
  /** subject-aware crop for the frame(s) CSS gives the picture (fill photos only) */
  fit?: FitProps;
  /** the kit mask that draws the frame (tiles: the page's own, or rounded when it would cut a head) */
  mask?: ReturnType<typeof maskOf>;
}): ReactElement {
  return (
    <Picture
      asset={asset}
      sizes={sizes}
      ratio={ratio}
      fit={asset.alpha ? "contain" : "cover"}
      priority={priority}
      mask={mask}
      {...(fitOf(asset) === "fill" ? fit : undefined)}
      className={cx("lp-specs__pic", className)}
      alt={asset.alt || ctx.product.name}
    />
  );
}

/**
 * Framed product media: the picture box takes the frame's shape (CSS, per breakpoint). A landscape
 * photo ("mat") keeps its natural proportions, centered on the box's own dominant-color backdrop
 * (the Picture placeholder) with feathered edges, so a tall frame never crops the product thin.
 */
export function Media({
  ctx,
  asset,
  sizes,
  ratio,
  className,
  revealKind,
  delay,
  crop,
  mask,
}: {
  ctx: RenderContext;
  asset: ResolvedAsset;
  sizes: string;
  /** the picture's own box ratio (CSS may re-shape the frame per breakpoint) */
  ratio?: string;
  className?: string;
  revealKind?: "mask-arch" | "scale-in" | false;
  delay?: number;
  /** subject-aware crop for the frame(s) CSS gives the picture */
  crop?: FitProps;
  mask?: ReturnType<typeof maskOf>;
}): ReactElement {
  const fit = fitOf(asset);
  return (
    <div className={cx("lp-specs__frame", className)} data-fit={fit} {...reveal(revealKind, delay)}>
      <Visual ctx={ctx} asset={asset} ratio={ratio ?? (fit === "fill" ? "4/5" : fit === "mat" ? naturalRatio(asset) : "1/1")} sizes={sizes} fit={crop} mask={mask} />
    </div>
  );
}

/** Archetypes whose product tile sits on a fine dot field. */
const DOTTED = new Set(["circuit", "garage", "editorial", "apothecary"]);

/**
 * The tile's proportions (width / height) on phones and from `min` up, per variant and page mask —
 * mirrors --tile-r in specs.css / specs.sheet.css / specs.accordion.css.
 */
export function tileRatios(ctx: RenderContext, variant: "sheet" | "accordion", upright = false): { base: number; lg: number; min: string } {
  const m = pageShape(ctx);
  const round = m === "circle" || m === "blob";
  if (variant === "sheet") return { base: m === "pill" ? 0.8 : 1, lg: m === "pill" ? 0.75 : round ? 1 : 0.8, min: "48rem" };
  // an upright shot (a bottle, a standing figure) keeps a portrait tile: a landscape band (or even a
  // square) would cut it or press its top against the edge
  if (upright && !round && m !== "pill") return { base: 0.8, lg: 0.8, min: "60rem" };
  return { base: m === "pill" ? 0.8 : round ? 1 : 4 / 3, lg: m === "pill" ? 0.8 : round ? 1 : 1.2, min: "60rem" };
}

/** Tag and key-figure spots, phones (`at`) and wide screens (`lg`). */
interface TileSpots {
  tag: { at: Spot; lg: Spot };
  kf: { at: Spot; lg: Spot };
}

/**
 * Where the name tag and the key figure sit on the tile: the tag at the foot, the key figure up the
 * end side (breaking over the tile's edge on wide screens) — each moved to the quiet side when it
 * would cover a face, a hand or the product itself.
 */
function tileSpots(asset: ResolvedAsset, shape: FrameShape, r: { base: number; lg: number }, dir: "ltr" | "rtl", hasKf: boolean): TileSpots {
  const curved = shape !== "rounded" && shape !== "rect";
  const inset = { x: 0.045, y: 0.04, top: curved ? 0.1 : 0.05, bottom: curved && shape !== "arch" ? 0.09 : 0.04 };
  const tagSpots: Spot[] = ["bs", "be", "bc", "ts"];
  const kfSpots: Spot[] = ["te", "me", "ts", "ms"];
  const at = (ratio: number, big: boolean) => {
    const frame = { shape, ratio };
    const tag = placeOverlay(asset, frame, tagSpots, { chip: { w: big ? 0.42 : 0.56, h: 0.1 }, dir, inset }).spot;
    if (!hasKf) return { tag, kf: "te" as Spot };
    // the key figure leaves the tag's band alone; on wide screens it hangs half outside the tile
    const tagZone = tag[0] === "b" ? { x: 0, y: 0.82, w: 1, h: 0.18 } : { x: 0, y: 0, w: 1, h: 0.18 };
    const kf = placeOverlay(asset, frame, kfSpots, { chip: { w: big ? 0.2 : 0.36, h: 0.18 }, dir, inset, avoid: [tagZone] }).spot;
    return { tag, kf };
  };
  const phone = at(r.base, false);
  const wide = at(r.lg, true);
  return { tag: { at: phone.tag, lg: wide.tag }, kf: { at: phone.kf, lg: wide.kf } };
}

/**
 * The product tile: the photo on its lit field in the page's mask (rounded when that mask would cut
 * a head), fitted subject-first to the tile's exact frame on phones and wide screens, a frosted
 * name/SKU tag and the key figure in a glass callout that breaks over the tile's edge.
 */
export function Tile({
  ctx,
  data,
  id,
  asset,
  sizes,
  variant,
  className,
}: {
  ctx: RenderContext;
  data: Data;
  id: string;
  asset: ResolvedAsset;
  sizes: string;
  variant: "sheet" | "accordion";
  className?: string;
}): ReactElement {
  const sku = ctx.product.sku?.trim();
  const decor = density(ctx) > 0;
  const kf = keyFigure(data.rows);
  const page = pageShape(ctx);
  const fill = fitOf(asset) === "fill";
  const upright = fill && asset.height > asset.width * 1.08;
  const r = tileRatios(ctx, variant, upright);
  const shape: FrameShape = fill && (shapeFor(asset, page, r.base) !== page || shapeFor(asset, page, r.lg) !== page) ? "rounded" : page;
  const crop = fill ? fitProps(asset, shape, r.base, [r.lg, r.lg], r.min) : undefined;
  const spots = tileSpots(asset, shape, r, ctx.dir === "rtl" ? "rtl" : "ltr", !!kf);
  return (
    <figure className={cx("lp-specs__visual", className)} data-fit={fitOf(asset)} data-shape={shape} data-upright={upright ? "" : undefined}>
      <span className="lp-specs__aura" aria-hidden="true">
        <GlowOrb place="center" size="92%" intensity="soft" />
        {decor && DOTTED.has(ctx.archetype) ? <DotGrid cell={18} fade="radial" /> : null}
        {decor && ctx.archetype === "souk" ? <ZelligeLines uid={`${id}-z`} variant="rosette" tile={84} /> : null}
      </span>
      <Media ctx={ctx} asset={asset} sizes={sizes} revealKind="mask-arch" delay={80} crop={crop} mask={maskOf(shape, page)} />
      <figcaption className="lp-specs__tag lp-glass" data-at={spots.tag.at} data-at-lg={spots.tag.lg} {...reveal("fade", 520)}>
        {/* a Latin name on an Arabic page keeps its own direction: a long one ends in "…", never starts with it */}
        <bdi className="lp-specs__tagname">{shortName(ctx.product.name)}</bdi>
        {sku ? (
          <span className="lp-specs__tagsku">
            <bdi>{sku}</bdi>
          </span>
        ) : null}
      </figcaption>
      {kf ? <KeyFigure ctx={ctx} row={kf} at={spots.kf.at} lg={spots.kf.lg} /> : null}
    </figure>
  );
}

/** Glass callout of the key figure (a visual echo of its spec row, hidden from assistive tech). */
function KeyFigure({ ctx, row, at, lg }: { ctx: RenderContext; row: RowData; at: Spot; lg: Spot }): ReactElement {
  return (
    <span className="lp-specs__kf lp-glass" data-at={at} data-at-lg={lg} aria-hidden="true" {...reveal("blur-in", 420)}>
      <span className="lp-specs__kfv" dir={textDir(row.value)}>
        <Value ctx={ctx} value={row.value} count />
      </span>
      <RichText as="span" className="lp-specs__kfl" text={row.label.trim()} ctx={ctx} decorate={false} />
    </span>
  );
}

export function Note({ ctx, data, animate = true }: { ctx: RenderContext; data: Data; animate?: boolean }): ReactElement | null {
  if (!data.note.trim()) return null;
  return (
    <p className="lp-specs__note" {...editAttr(ctx, "note")} {...reveal(animate && "fade", 240)}>
      <Icon name="info" size="1.1em" />
      <RichText as="span" text={data.note} ctx={ctx} decorate={false} />
    </p>
  );
}
