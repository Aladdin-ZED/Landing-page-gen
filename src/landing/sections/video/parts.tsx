/**
 * Small pieces shared by the compositions: the glass caption chip, the segmented chapter track and
 * the order block (CTA + cash-on-delivery line).
 */
import type { ReactElement } from "react";
import { Cta, Icon, RichText, cssVars, cx, pad2, reveal } from "../../primitives";
import type { RenderContext } from "../../types";
import { UI, langOf } from "./copy";
import type { Data, Media } from "./model";

/** Smoked glass chip over the media: a soft recording dot (real video only) + the caption. */
export function captionChip(ctx: RenderContext, data: Data, media: Media, delay = 0): ReactElement | null {
  if (!data.caption.trim()) return null;
  return (
    <span className="lp-video__cap lp-glass" data-bg="dark" {...reveal("blur-in", delay)}>
      {media.video ? <span className="lp-video__live" aria-hidden="true" /> : null}
      <RichText as="span" text={data.caption} ctx={ctx} decorate={false} editPath="caption" />
    </span>
  );
}

/**
 * Chapters on a segmented track — one segment per chapter, like a story/scrubber bar. With a real
 * video the playhead fills the segments in turn while it plays and the chapter it is crossing
 * lights up (one CSS clock, --vt; the real playhead when the runtime writes --vp).
 *  dock  frosted glass bar straddling the frame's bottom edge on desktop, plain under it on phones
 *        (framed, landscape)
 *  rail  in the section's colors; upright beside a portrait frame on desktop (framed, portrait)
 *  bar   a hairline credit bar on the film, under the headline (fullbleed)
 */
export function Chapters({
  ctx,
  data,
  media,
  look,
  delay = 0,
}: {
  ctx: RenderContext;
  data: Data;
  media: Media;
  look: "dock" | "rail" | "bar";
  delay?: number;
}): ReactElement | null {
  const items = data.chapters.map((c, i) => ({ text: c.text.trim(), i })).filter((c) => c.text);
  if (!items.length) return null;
  const ui = UI[langOf(ctx.locale)];
  const live = !!media.video;
  const dock = look === "dock";
  return (
    <div
      className={cx("lp-video__ch", `lp-video__ch--${look}`, live && "lp-video__ch--live", dock && "lp-glass")}
      data-n={items.length}
      style={cssVars({ "--n": items.length })}
      {...reveal(dock ? "rise" : "fade", delay)}
    >
      {look === "rail" && live ? (
        <p className="lp-video__ch-label lp-label" aria-hidden="true">
          {ui.chapters}
        </p>
      ) : null}
      <ol className="lp-video__chapters" role="list" aria-label={ui.chapters}>
        {items.map(({ text, i }, k) => (
          <li key={i} className="lp-video__chapter" style={cssVars({ "--i": k })} {...reveal("rise", delay + 140 + k * 80)}>
            <span className="lp-video__seg" aria-hidden="true">
              {live ? <span className="lp-video__prog" /> : null}
            </span>
            <span className="lp-video__idx" aria-hidden="true">
              {pad2(k + 1)}
            </span>
            <RichText as="span" className="lp-video__cht" text={text} ctx={ctx} decorate={false} editPath={`chapters.${i}.text`} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Order button with the live price + the cash-on-delivery reassurance (off where a chip already says it). */
export function Action({ ctx, data, delay = 0, assure = true }: { ctx: RenderContext; data: Data; delay?: number; assure?: boolean }): ReactElement | null {
  if (!data.cta) return null;
  return (
    <div className="lp-video__act" {...reveal("rise", delay)}>
      {/* the short default ("Commander") keeps label + price pill on one line, even on a 360px phone */}
      <Cta ctx={ctx} label={data.ctaLabel.trim() || ctx.t("cta.order")} editPath="ctaLabel" withPrice wide />
      {assure ? (
        <p className="lp-video__assure">
          <Icon name="cash" size="1.15em" />
          <span>{ctx.t("trust.cod")}</span>
        </p>
      ) : null}
    </div>
  );
}
