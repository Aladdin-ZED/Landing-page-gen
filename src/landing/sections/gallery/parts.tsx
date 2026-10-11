/**
 * Gallery — pieces shared by the compositions: heading, framed photo, captions, controls, ambient
 * light, the viewer HUD, story segments, rolling counters and the order button.
 */
import type { ReactElement } from "react";
import { Cta, Icon, Picture, RichText, SectionHeader, cssVars, cx, plainText, reveal, type PictureFrame, type RevealKind } from "@/landing/primitives";
import type { Archetype } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { copyLang, idx } from "../benefits/kit";
import { MICRO } from "./copy";
import type { Data, Shot } from "./model";

export function micro(ctx: RenderContext, key: keyof (typeof MICRO)["fr"], n?: number): string {
  const s = MICRO[copyLang(ctx.locale)][key];
  return n === undefined ? s : s.replace("{n}", String(n));
}

export function Head({
  ctx,
  data,
  titleId,
  align = "start",
  size = "l",
  className,
}: {
  ctx: RenderContext;
  data: Data;
  titleId: string;
  align?: "start" | "center" | "split";
  /** m in narrow columns (viewer rail, bento tile, lookbook side) */
  size?: "m" | "l";
  className?: string;
}): ReactElement | null {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      editBase=""
      titleId={titleId}
      align={align}
      size={size}
      className={cx("lp-gallery__head", className)}
    />
  );
}

/** Alt text: the photo's own, else its caption, else "<product> (n)". */
function altOf(ctx: RenderContext, s: Shot): string {
  return s.asset?.alt.trim() || plainText(s.caption) || `${ctx.product.name} (${s.n + 1})`;
}

/**
 * A photo filling its frame. Cutouts (transparent PNG) stand on a lit studio tile instead of being
 * cropped. `fill` = absolutely fills a sized parent (bento tiles); otherwise the frame keeps `ratio`.
 * `frame` / `frameLg` = the exact frame the photo is shown in (phones / from `frameMin` up): the crop
 * keeps faces, hands and a product whole inside it.
 */
export function Media({
  ctx,
  shot,
  sizes,
  ratio,
  fill = false,
  mask,
  frame,
  frameLg,
  frameMin,
  className,
}: {
  ctx: RenderContext;
  shot: Shot;
  sizes: string;
  ratio?: string;
  fill?: boolean;
  mask?: "page";
  frame?: PictureFrame;
  frameLg?: PictureFrame;
  frameMin?: string;
  className?: string;
}): ReactElement {
  const cut = !!shot.asset?.alpha;
  return (
    <Picture
      asset={shot.asset}
      sizes={sizes}
      ratio={fill ? undefined : ratio}
      fit={cut ? "contain" : "cover"}
      mask={mask}
      frame={cut ? undefined : frame}
      frameLg={cut ? undefined : frameLg}
      frameMin={frameMin}
      alt={altOf(ctx, shot)}
      className={cx("lp-gallery__pic", fill && "lp-gallery__pic--fill", cut && "lp-gallery__pic--cut", className)}
    />
  );
}

/** Caption with its editorial index ("02 · In detail"); null when the photo has no caption. */
export function Caption({
  ctx,
  shot,
  className,
  index = true,
  as = "figcaption",
}: {
  ctx: RenderContext;
  shot: Shot;
  className?: string;
  index?: boolean;
  as?: "figcaption" | "p";
}): ReactElement | null {
  if (!shot.caption) return null;
  const Tag = as;
  return (
    <Tag className={cx("lp-gallery__cap", className)}>
      {index ? (
        <span className="lp-gallery__cap-n" aria-hidden="true">
          {idx(shot.n)}
        </span>
      ) : null}
      <RichText as="span" className="lp-gallery__cap-t" text={shot.caption} ctx={ctx} decorate={false} editPath={shot.path ?? undefined} />
    </Tag>
  );
}

/** Previous / next glass buttons (runtime: disabled at the ends, arrows mirror in RTL). */
export function Arrows({ ctx, className }: { ctx: RenderContext; className?: string }): ReactElement {
  return (
    <div className={cx("lp-gallery__arrows", className)}>
      <button type="button" className="lp-gallery__arrow lp-glass" data-gallery-prev="" aria-label={ctx.t("gallery.prev")} disabled>
        <Icon name="chevron-left" size="1.15rem" strokeWidth={2} />
      </button>
      <button type="button" className="lp-gallery__arrow lp-glass" data-gallery-next="" aria-label={ctx.t("gallery.next")}>
        <Icon name="chevron-right" size="1.15rem" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Ambient light: every photo, blurred into a soft halo behind the stage; only the active one glows
 * (CSS crossfades on --gi; the others are visibility:hidden, so their blur costs nothing). Same
 * `sizes` as the thumbnails, so it reuses their small files.
 */
export function Ambient({
  shots,
  className,
  reveal: delay,
}: {
  shots: Shot[];
  className?: string;
  /** fade the light in after the media entrance (delay in ms) */
  reveal?: number;
}): ReactElement | null {
  const lit = shots.filter((s) => s.asset && !s.asset.alpha);
  if (!lit.length) return null;
  return (
    <div className={cx("lp-gallery__amb", className)} aria-hidden="true" {...(delay === undefined ? {} : reveal("fade", delay))}>
      {lit.map((s) => (
        <span key={s.n} className="lp-gallery__amb-l lp-gallery__k" data-k={s.n} style={cssVars({ "--k": s.n })}>
          <Picture asset={s.asset} sizes="4rem" alt="" />
        </span>
      ))}
    </div>
  );
}

/** The rolling current number of a counter ("01" → "02" rolls up like an odometer). */
export function Roll({ shots }: { shots: Shot[] }): ReactElement {
  return (
    <span className="lp-gallery__now">
      <span className="lp-gallery__roll">
        {shots.map((s) => (
          <span key={s.n}>{idx(s.n)}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * Viewer HUD: a big rolling number indexed with the total ("01 /06"), the active photo's caption
 * crossfading beside it, and a hairline that fills with progress. Visual only (aria-hidden): the slides carry "n / N" and their
 * own figcaptions for assistive tech.
 */
export function Hud({ ctx, shots, className }: { ctx: RenderContext; shots: Shot[]; className?: string }): ReactElement {
  const captioned = shots.some((s) => s.caption);
  return (
    <div className={cx("lp-gallery__hud", className)} aria-hidden="true">
      <span className="lp-gallery__num">
        <Roll shots={shots} />
      </span>
      <span className="lp-gallery__all">{idx(shots.length - 1)}</span>
      {captioned ? (
        <span className="lp-gallery__deck">
          {shots.map((s) => (
            <span key={s.n} className="lp-gallery__deck-i lp-gallery__k" style={cssVars({ "--k": s.n })}>
              {s.caption ? (
                <RichText as="span" text={s.caption} ctx={ctx} decorate={false} editPath={s.path ?? undefined} />
              ) : null}
            </span>
          ))}
        </span>
      ) : null}
      <span className="lp-gallery__bar" />
    </div>
  );
}

/**
 * Segmented progress (one segment per photo, story-style): every segment is a button; segments up
 * to the active one are filled, so the bar reads as progress and as direct navigation at once.
 */
export function Segments({ ctx, shots, className }: { ctx: RenderContext; shots: Shot[]; className?: string }): ReactElement {
  return (
    <div className={cx("lp-gallery__segs", className)}>
      {shots.map((s) => (
        <button
          key={s.n}
          type="button"
          className="lp-gallery__seg lp-gallery__k"
          style={cssVars({ "--k": s.n })}
          data-dot={s.n}
          data-active={s.n === 0 ? "" : undefined}
          aria-current={s.n === 0 ? "true" : undefined}
          aria-label={micro(ctx, "thumb", s.n + 1)}
        />
      ))}
    </div>
  );
}

/** Compact "01 / 06" with a rolling current number (filmstrip bar). */
export function MiniCount({ shots, className }: { shots: Shot[]; className?: string }): ReactElement {
  return (
    <p className={cx("lp-gallery__mini", className)} aria-hidden="true">
      <Roll shots={shots} />
      <span className="lp-gallery__mini-sep">/</span>
      <span>{idx(shots.length - 1)}</span>
    </p>
  );
}

/** Order button after the gallery (optional). */
export function GalleryCta({
  ctx,
  data,
  className,
  delay = 0,
}: {
  ctx: RenderContext;
  data: Data;
  className?: string;
  delay?: number;
}): ReactElement | null {
  if (!data.cta) return null;
  return (
    <div className={cx("lp-gallery__cta", className)} {...reveal("rise", delay)}>
      {/* the short "Order" keeps label + price pill on one line, even on phones */}
      <Cta ctx={ctx} label={data.ctaLabel.trim() || ctx.t("cta.order")} editPath="ctaLabel" withPrice wide />
    </div>
  );
}

/** Media entrance per archetype: soft scale for the quiet/soft ones, a clean wipe for the graphic ones. */
const MEDIA_REVEAL: Record<Archetype, RevealKind> = {
  maison: "scale-in",
  apothecary: "wipe-up",
  souk: "mask-arch",
  playground: "tilt-in",
  kinetic: "wipe-up",
  circuit: "blur-in",
  hearth: "scale-in",
  bloom: "scale-in",
  field: "wipe-up",
  editorial: "wipe-up",
  garage: "wipe-up",
};

export const mediaReveal = (ctx: RenderContext): RevealKind => MEDIA_REVEAL[ctx.archetype] ?? "wipe-up";
