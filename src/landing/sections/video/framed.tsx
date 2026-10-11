/**
 * framed — the video in a large lit frame.
 *  Landscape clips: the heading row (title + lead, the order button at the far end on desktop), then
 *  a cinematic frame across the container with the chapters on a frosted glass dock straddling its
 *  bottom edge.
 *  Square and vertical clips: the copy column beside a tall frame (arched on arch-mask themes) that
 *  stands in front of a larger panel of its own blurred light — the frame breaks out over the panel's
 *  top edge (concentric arches on arch themes); the chapters run on an upright segmented rail.
 * The frame scales into place as it scrolls in.
 */
import type { ReactElement } from "react";
import { Container, SectionHeader, cssVars, cx } from "../../primitives";
import { ratioCss, type ViewProps } from "./model";
import { Action, Chapters, captionChip } from "./parts";
import { Ambient, Player } from "./player";

export function Framed({ ctx, data, titleId, media }: ViewProps): ReactElement {
  const side = media.shape !== "land";
  return (
    <Container className={cx("lp-video__wrap", side ? "lp-video__wrap--side" : "lp-video__wrap--wide")}>
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} titleId={titleId} editBase="" className="lp-video__head" />
      <div className="lp-video__stage" style={cssVars({ "--vr": ratioCss(media.ratio) })}>
        <Ambient asset={media.still} className={side ? "lp-video__plate" : undefined} />
        <Player
          ctx={ctx}
          media={media}
          className="lp-video__frame"
          sizes={side ? "(min-width: 64rem) 34rem, 88vw" : "(min-width: 80rem) 76rem, 94vw"}
          caption={captionChip(ctx, data, media, 520)}
          attrs={{ "data-reveal": "scale-in", "data-delay": "120" }}
        />
        {side ? null : <Chapters ctx={ctx} data={data} media={media} look="dock" delay={300} />}
      </div>
      {side ? <Chapters ctx={ctx} data={data} media={media} look="rail" delay={260} /> : null}
      <Action ctx={ctx} data={data} delay={side ? 380 : 200} />
    </Container>
  );
}
