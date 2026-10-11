/**
 * gallery/carousel — a product viewer. One photo per view in a large rounded frame (swipe, arrows,
 * keyboard); the photo drifts with a soft parallax while it slides and settles from a slight zoom
 * when it lands. Signature: ambient light — the active photo, blurred, glows around the frame and
 * crossfades to the next photo's colors as you browse. Beside it (under it on phones) a HUD: a big
 * rolling "01", the photo's caption crossfading beside it, the total and a hairline that fills with
 * progress; then thumbnails with a morphing accent ring and the order button.
 * Phones: the strip bleeds to the screen edges and the next photo peeks in (swipe affordance).
 * Landscape sets: a wide frame under a split heading, the rail as one bar.
 */
import type { ReactElement } from "react";
import { cssVars, cx, Picture, plainText, reveal } from "@/landing/primitives";
import { bgFamily } from "../benefits/kit";
import { Ambient, Arrows, Caption, GalleryCta, Head, Hud, Media, mediaReveal, micro } from "./parts";
import { isLandscape, isTall, type ViewProps } from "./model";

export function Carousel({ ctx, data, titleId, shots, bg }: ViewProps): ReactElement {
  const many = shots.length > 1;
  const land = isLandscape(shots);
  const tall = !land && isTall(shots);
  // the heading shares a narrow column with the HUD (or half the row in a landscape set's split
  // heading): a long title steps down one size
  const long = plainText(data.title).length > (land ? 32 : 40);
  return (
    <div
      className={cx("lp-container lp-gallery__car", land && "lp-gallery__car--land", tall && "lp-gallery__car--tall", !many && "lp-gallery__car--solo")}
      data-gallery=""
      data-tone={bgFamily(ctx, bg)}
      style={cssVars({ "--gn": shots.length })}
    >
      <Head ctx={ctx} data={data} titleId={titleId} size={long ? "m" : "l"} align={land ? "split" : "start"} />
      <div className="lp-gallery__stage">
        <Ambient shots={shots} reveal={600} />
        <div className="lp-gallery__viewer" {...reveal(mediaReveal(ctx), 120)}>
          <div className="lp-gallery__track" data-gallery-track="" tabIndex={0} role="region" aria-label={ctx.t("gallery.label")}>
            {shots.map((s) => (
              <figure
                key={s.n}
                className="lp-gallery__slide"
                data-slide=""
                data-active={s.n === 0 ? "" : undefined}
                role="group"
                aria-label={`${s.n + 1} / ${shots.length}`}
              >
                {/* the picture overscans its slide by 18% (room for the swipe parallax): its frame is the
                    slide's ratio × 1.18 — 4:5 → 0.944, 3:4 (tall sets) → 0.885; landscape 4:3 on
                    phones, 16:9 from 48rem */}
                <Media
                  ctx={ctx}
                  shot={s}
                  sizes={land ? "(min-width: 62rem) 72rem, 88vw" : "(min-width: 62rem) 40rem, 88vw"}
                  frame={{ shape: "rounded", ratio: (land ? 4 / 3 : tall ? 3 / 4 : 4 / 5) * 1.18 }}
                  frameLg={land ? { shape: "rounded", ratio: (16 / 9) * 1.18 } : undefined}
                  frameMin={land ? "48rem" : undefined}
                />
                {/* one photo: the caption is a glass chip on it; several: the HUD shows it */}
                <Caption ctx={ctx} shot={s} className={many ? "lp-visually-hidden" : "lp-glass"} />
              </figure>
            ))}
          </div>
          {many ? <Arrows ctx={ctx} /> : null}
        </div>
      </div>
      <div className="lp-gallery__rail">
        {many ? (
          <>
            <div className="lp-gallery__hud-wrap" {...reveal("fade", 200)}>
              <Hud ctx={ctx} shots={shots} />
            </div>
            <div className="lp-gallery__thumbs" data-stagger="45">
              {shots.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  className="lp-gallery__thumb"
                  data-thumb={s.n}
                  data-active={s.n === 0 ? "" : undefined}
                  aria-current={s.n === 0 ? "true" : undefined}
                  aria-label={micro(ctx, "thumb", s.n + 1)}
                  {...reveal("rise")}
                >
                  <Picture asset={s.asset} sizes="4rem" fit={s.asset?.alpha ? "contain" : "cover"} ratio="1" alt="" />
                </button>
              ))}
            </div>
          </>
        ) : null}
        <GalleryCta ctx={ctx} data={data} delay={240} />
      </div>
    </div>
  );
}
