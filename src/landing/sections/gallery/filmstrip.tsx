/**
 * gallery/filmstrip — a cinematic strip that starts on the content column and runs off the edge of
 * the screen. The leading photo is in focus: full size, lit by its own ambient light, its caption
 * underneath; the photos queued after it recede (smaller, dimmer) toward a shared baseline. With
 * scroll-driven animations the focus follows the finger continuously (a photo grows as it reaches
 * the lead slot); elsewhere it follows the runtime's active slide. Under the strip: story-style
 * segments (progress + direct navigation), a rolling "01 / 06", arrows and the order button.
 *
 * Alignment trick: each slide box starts at the strip's edge and pads its photo in by the content
 * inset (negative margins keep the flow tight), so the runtime's "align the slide with the track
 * start" lands the photo exactly on the content column, at every width and in RTL.
 */
import type { ReactElement } from "react";
import { cssVars, cx, reveal } from "@/landing/primitives";
import { bgFamily } from "../benefits/kit";
import { Ambient, Arrows, Caption, GalleryCta, Head, Media, MiniCount, Segments } from "./parts";
import { isLandscape, type ViewProps } from "./model";

export function Filmstrip({ ctx, data, titleId, shots, bg }: ViewProps): ReactElement {
  const many = shots.length > 1;
  const land = isLandscape(shots);
  return (
    <>
      <div className="lp-container">
        <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      </div>
      <div
        className={cx("lp-gallery__film", land && "lp-gallery__film--land", !many && "lp-gallery__film--solo")}
        data-gallery=""
        data-tone={bgFamily(ctx, bg)}
        style={cssVars({ "--gn": shots.length })}
      >
        <Ambient shots={shots} className="lp-gallery__film-amb" reveal={520} />
        <div
          className="lp-gallery__film-track"
          data-gallery-track=""
          tabIndex={0}
          role="region"
          aria-label={ctx.t("gallery.label")}
          {...reveal("rise", 160)}
        >
          {shots.map((s) => (
            <div key={s.n} className="lp-gallery__frame" data-slide="" data-active={s.n === 0 ? "" : undefined}>
              <figure className="lp-gallery__shot lp-gallery__k" style={cssVars({ "--k": s.n })} role="group" aria-label={`${s.n + 1} / ${shots.length}`}>
                <Media
                  ctx={ctx}
                  shot={s}
                  ratio={land ? "4/3" : "3/4"}
                  frame={{ shape: "rounded", ratio: land ? 4 / 3 : 3 / 4 }}
                  sizes={land ? "(min-width: 48rem) 40rem, 84vw" : "(min-width: 48rem) 26rem, 74vw"}
                />
                <Caption ctx={ctx} shot={s} />
              </figure>
            </div>
          ))}
        </div>
        <div className="lp-container lp-gallery__film-bar">
          {many ? (
            <>
              <div className="lp-gallery__film-nav" {...reveal("fade", 260)}>
                <Segments ctx={ctx} shots={shots} />
              </div>
              <MiniCount shots={shots} />
              <Arrows ctx={ctx} />
            </>
          ) : null}
          <GalleryCta ctx={ctx} data={data} delay={180} />
        </div>
      </div>
    </>
  );
}
