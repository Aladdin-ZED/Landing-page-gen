/**
 * fullbleed — the video as a film, edge to edge. It opens from a rounded inset card to the full
 * width as it scrolls in, the picture settling from a slight zoom.
 *  Desktop: the headline, order button and a hairline chapter bar (the film's credits, with the
 *  playhead running through it) lie over the film's lower half, on a deep scrim.
 *  Phones: the film owns the top of the block, unobstructed; the headline rises over its lower edge
 *  and the copy continues on the dark block below — the picture is never buried under text.
 *  Vertical clips on desktop stand as a tall panel at the inline end, over a field of their own
 *  light, with the headline beside them.
 * The block always grows with its content (long titles, Arabic) — the film never crops the copy.
 */
import type { ReactElement } from "react";
import { Container, SectionHeader, frameRegions, pictureCrop, plainText, round } from "../../primitives";
import type { ResolvedAsset } from "../../types";
import { bandClear } from "../reviews/frames";
import type { Media, ViewProps } from "./model";
import { Action, Chapters, captionChip } from "./parts";
import { Ambient, Player } from "./player";

/** Phones: the film is 4:5 (a person still: its own proportions, 2:3 at the tallest). */
const PHONE_FILM = 4 / 5;
/** Phones: the headline rises over the film's lowest ~22% (overlap + fade). */
const TEXT_ZONE = 0.78;

interface FilmPlan {
  /** the film's ratio on phones */
  ratio: number;
  /** a head or hands reach into the text zone: the headline rises less */
  low: boolean;
  /** phones: the caption chip on the film's top edge, or opening the copy (the film's bottom is the headline's) */
  capPhone: "top" | "copy";
  /** desktop: on the film's top edge, the tall panel's bottom edge, or opening the copy */
  capDesk: "top" | "bottom" | "copy";
}

/**
 * The chip's footprint on the film (frame fractions), at its inline-start corner: phones ~62% of the
 * film's width, the wide desktop film ~28% (it sits at the container's edge), the tall panel ~80%.
 */
const chipAt = (rtl: boolean, w: number, top: boolean) => ({ x: rtl ? 1 - w - 0.03 : 0.03, w, y: top ? 0 : 0.88, h: 0.12 });

/**
 * Desktop layout: a wide film, or a panel at the inline end showing the media at its own ratio.
 * Vertical clips take the panel — and so does a still of people that is not landscape: a 16:9 film
 * would crop it hard and lay the headline over a face.
 */
function deskPanel(still: ResolvedAsset | null, media: Media): boolean {
  if (media.shape === "tall") return true;
  return !media.video && media.shape === "square" && !!still && !still.alpha && still.subjectKind === "person";
}

function plan(still: ResolvedAsset | null, media: Media, rtl: boolean): FilmPlan {
  const person = !!still && !still.alpha && still.subjectKind === "person" && !media.video;
  const ratio = person ? round(Math.min(PHONE_FILM, Math.max(2 / 3, still!.width / still!.height)), 3) : PHONE_FILM;
  let low = false;
  if (person) {
    const r = frameRegions(still!, ratio, pictureCrop(still!, { frame: { shape: "rect", ratio, maxZoom: 1 } }));
    low = [...r.heads, ...r.hands].some((b) => b.y + b.h > TEXT_ZONE);
  }
  // desktop: a tall panel keeps the media's own ratio, a wide film is ~16:9; phones: the film's
  // bottom belongs to the headline, so a chip that cannot sit on the top edge joins the copy
  const tall = deskPanel(still, media);
  const deskRatio = tall ? media.ratio : 16 / 9;
  const deskW = tall ? 0.8 : 0.28;
  const capDesk = bandClear(still, deskRatio, chipAt(rtl, deskW, true), "rect")
    ? "top"
    : tall && bandClear(still, deskRatio, chipAt(rtl, deskW, false), "rect")
      ? "bottom"
      : "copy";
  return { ratio, low, capPhone: bandClear(still, ratio, chipAt(rtl, 0.62, true), "rect") ? "top" : "copy", capDesk };
}

/** Display size for short titles; long ones step down a size so the film stays visible. */
const XL_MAX = 30;

export function Fullbleed({ ctx, data, titleId, media }: ViewProps): ReactElement {
  const tall = deskPanel(media.still, media);
  const size = plainText(data.title).length <= XL_MAX ? "xl" : "l";
  const p = plan(media.still, media, ctx.dir === "rtl");
  const chip = captionChip(ctx, data, media, 600);
  return (
    <div
      className="lp-video__bleed"
      // the panel layout's hook (vertical clips, people stills); "square" narrows the copy beside a wider panel
      data-shape={tall ? "tall" : media.shape}
      data-panel={tall && media.shape !== "tall" ? "square" : undefined}
      data-low={p.low ? "" : undefined}
    >
      <Ambient asset={media.still} className="lp-video__backdrop" />
      <Player
        ctx={ctx}
        media={media}
        className="lp-video__wide"
        sizes={tall ? "(min-width: 48rem) 30rem, 100vw" : "100vw"}
        caption={p.capPhone === "top" || p.capDesk !== "copy" ? chip : null}
        // phones: the film's own frame (desktop sizes the film from the block; its crop follows)
        frame={{ shape: "rect", ratio: p.ratio, maxZoom: 1 }}
        frameLg={{ shape: tall ? "rounded" : "rect", ratio: tall ? media.ratio : 16 / 9, maxZoom: 1 }}
        frameMin="48rem"
        vars={{ "--film-ar": p.ratio }}
        data={{ "data-cap": p.capDesk, "data-cap-phone": p.capPhone }}
      />
      <div className="lp-video__over" data-bg="dark">
        <Container className="lp-video__over-in">
          {/* a chip that would cover a face on the film opens the copy instead */}
          {(p.capPhone === "copy" || p.capDesk === "copy") && chip ? (
            <div className="lp-video__cap-row" data-phone={p.capPhone === "copy" ? "" : undefined} data-desk={p.capDesk === "copy" ? "" : undefined}>
              {chip}
            </div>
          ) : null}
          <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} titleId={titleId} editBase="" size={size} className="lp-video__head" />
          <Action ctx={ctx} data={data} delay={420} />
          <Chapters ctx={ctx} data={data} media={media} look="bar" delay={520} />
        </Container>
      </div>
    </div>
  );
}
