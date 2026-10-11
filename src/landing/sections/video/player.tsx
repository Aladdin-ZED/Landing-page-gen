/**
 * The player shared by every composition: a still picture (poster while the file loads, the whole
 * visual when there is no video), the muted inline <video data-autoplay>, a soft shade for legible
 * overlays, an optional caption layer and the glass controls.
 *
 * The poster and the video share one media box: full-screen when the clip covers the screen, and a
 * centered box of the clip's own ratio when it is contained (a landscape clip in a phone) — so the
 * poster never peeks out around the playing video; the rest of the screen is the clip's blurred light.
 *
 * Runtime contract: the figure is [data-video]; the runtime plays its [data-autoplay] video while it
 * is visible. Controls ([data-video-toggle], [data-video-sound]) stay hidden until the runtime marks
 * the figure [data-ready]; it mirrors playback in data-state="playing|paused" and sound in
 * data-sound="on|off". When the runtime falls back to native controls (reduced motion, Data Saver,
 * blocked autoplay) the glass chrome steps aside (video[controls]).
 */
import type { ReactElement, ReactNode } from "react";
import { Picture, cssVars, cx, plainText, type PictureFrame, type RevealAttrs } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { UI, langOf } from "./copy";
import { ratioCss, type Media } from "./model";

interface PlayerProps {
  ctx: RenderContext;
  media: Media;
  /** `sizes` for the still picture */
  sizes: string;
  className?: string;
  /** contain the media inside the screen over its own blurred light (landscape clip in a phone) */
  contain?: boolean;
  /** overlays inside the screen (clipped with it): story chrome, glare */
  children?: ReactNode;
  /** caption layer over the screen (rendered as the figcaption) */
  caption?: ReactNode;
  /** reveal attributes on the figure */
  attrs?: RevealAttrs;
  /** the exact frame the still is shown in (subject-aware crop: faces, hands, a product's top) */
  frame?: PictureFrame;
  /** the still's frame from `frameMin` up (another layout on wide screens) */
  frameLg?: PictureFrame;
  frameMin?: string;
  /** extra custom properties on the figure (layout knobs) */
  vars?: Record<string, string | number | undefined>;
  /** data attributes describing the layout chosen for the media (CSS hooks) */
  data?: Record<`data-${string}`, string | undefined>;
}

export function Player({ ctx, media, sizes, className, contain = false, children, caption, attrs, frame, frameLg, frameMin, vars, data }: PlayerProps): ReactElement {
  const ui = UI[langOf(ctx.locale)];
  const { video, still } = media;
  const name = plainText(ctx.product.name);
  return (
    <figure
      className={cx("lp-video__player", className)}
      data-video=""
      data-shape={media.shape}
      data-fit={contain ? "contain" : "cover"}
      data-kind={video ? "video" : "still"}
      style={cssVars({ "--vr": ratioCss(media.ratio), "--vpos": media.pos, ...vars })}
      {...data}
      {...attrs}
    >
      <div className="lp-video__screen">
        {contain && still ? <Ambient asset={still} className="lp-video__fill" /> : null}
        <div className="lp-video__media">
          <Picture
            asset={still}
            sizes={sizes}
            className={cx("lp-video__poster", !video && "lp-video__still")}
            fit={still?.alpha ? "contain" : "cover"}
            frame={contain || still?.alpha ? undefined : frame}
            frameLg={contain || still?.alpha ? undefined : frameLg}
            frameMin={frameMin}
            alt={video ? "" : still?.alt || name}
          />
          {video ? (
            <video
              className="lp-video__el"
              data-autoplay=""
              muted
              playsInline
              loop
              preload="metadata"
              width={video.width}
              height={video.height}
              aria-label={ui.video.replace("{name}", name)}
            >
              <source src={video.src} type={video.mime} />
            </video>
          ) : null}
        </div>
        <span className="lp-video__shade" aria-hidden="true" />
        {children}
      </div>
      {caption ? <figcaption className="lp-video__fc">{caption}</figcaption> : null}
      {video ? (
        <>
          {/* big glass disc while paused — a pointer shortcut for the toggle below (not a tab stop) */}
          <button type="button" className="lp-video__play" data-bg="dark" data-video-toggle="" tabIndex={-1} aria-hidden="true">
            <span className="lp-video__disc lp-glass">
              <PlayGlyph />
            </span>
          </button>
          <div className="lp-video__ctl" data-bg="dark">
            <button type="button" className="lp-video__btn lp-glass" data-video-toggle="" aria-pressed="false" aria-label={ui.play}>
              <PlayGlyph className="lp-video__i-play" />
              <PauseGlyph />
            </button>
            <button type="button" className="lp-video__sound lp-glass" data-video-sound="" aria-pressed="false" aria-label={ui.sound}>
              <SpeakerGlyph />
              <span className="lp-video__sl" aria-hidden="true">
                <span className="lp-video__sl-off">{ui.soundOff}</span>
                <span className="lp-video__sl-on">{ui.soundOn}</span>
              </span>
            </button>
          </div>
        </>
      ) : null}
    </figure>
  );
}

/** Ambient light: a tiny rendition of the picture, blurred into a glow (decorative). */
export function Ambient({ asset, className }: { asset: ResolvedAsset | null; className?: string }): ReactElement | null {
  if (!asset) return null;
  return (
    <span className={cx("lp-video__amb", className)} aria-hidden="true">
      <Picture asset={asset} sizes="120px" alt="" fit="cover" />
    </span>
  );
}

/* --- glyphs (filled, optically centered; 24-grid) ------------------------------------------------ */

function PlayGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg className={cx("lp-video__glyph", className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8.2 5.3c0-1 1.1-1.6 2-1.1l9.1 5.9c.9.6.9 1.9 0 2.5l-9.1 5.9c-.9.6-2-.1-2-1.1z" />
    </svg>
  );
}

function PauseGlyph(): ReactElement {
  return (
    <svg className="lp-video__glyph lp-video__i-pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="6.5" y="5" width="3.8" height="14" rx="1.3" />
      <rect x="13.7" y="5" width="3.8" height="14" rx="1.3" />
    </svg>
  );
}

/** Speaker with both states drawn: a cross when muted, two waves when sound is on (CSS picks). */
function SpeakerGlyph(): ReactElement {
  return (
    <svg className="lp-video__spk" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="lp-video__spk-body" d="M4 9.6c0-.6.4-1 1-1h2.6l4-3.3c.7-.5 1.6 0 1.6.8v11.8c0 .8-.9 1.3-1.6.8l-4-3.3H5c-.6 0-1-.4-1-1z" />
      <path className="lp-video__spk-x" d="M16.5 9.5l5 5m0-5l-5 5" />
      <path className="lp-video__spk-w" d="M16.4 9.2a4 4 0 0 1 0 5.6M18.9 6.8a7.4 7.4 0 0 1 0 10.4" />
    </svg>
  );
}
