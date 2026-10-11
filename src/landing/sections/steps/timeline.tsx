/**
 * timeline — a vertical rail. A hairline track runs node to node; an accent line fills it as the
 * page scrolls and every node lights up as the line reaches it (scroll-driven, progressive: the
 * fill draws on reveal elsewhere). Wide screens: the heading and a lit product photo with a glass
 * "3 steps · ≈ 2 min" chip stay pinned beside the rail. Phones: the same summary rides on a glass
 * pill with a thumbnail, between the heading and the rail.
 */
import type { ReactElement } from "react";
import { GlassChip } from "@/landing/illustrations";
import { Container, Icon, Picture, ProductStage, cssVars, cx, reveal, type StageKind } from "@/landing/primitives";
import type { Archetype } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../../types";
import { copyLang, idx, pageFrame, productPhotos, productShots, ratioFor } from "../benefits/kit";
import { COMMON, totalMinutes } from "./copy";
import type { Data, ViewProps } from "./model";
import { DoneCheck, Head, Note, OrderButton, Text, Time, Title, itemReveal } from "./parts";

/** Stage for a cutout-only product, in the archetype's own shape language. */
const CUTOUT_STAGE: Partial<Record<Archetype, StageKind>> = {
  maison: "arch",
  souk: "arch",
  field: "arch",
  apothecary: "arch",
  bloom: "blob",
  playground: "blob",
};

/** "3 steps · ≈ 2 min" — the total only when every step has a short, parseable duration. */
function Summary({ ctx, data }: { ctx: RenderContext; data: Data }): ReactElement {
  const c = COMMON[copyLang(ctx.locale)];
  const mins = totalMinutes(data.steps.map((s) => s.time));
  return (
    <>
      <Icon name="clock" size="1.15em" strokeWidth={2} />
      <span>{c.count(data.steps.length)}</span>
      {mins ? (
        <>
          <span className="lp-steps__sep" aria-hidden="true" />
          <bdi>{c.total(mins)}</bdi>
        </>
      ) : null}
    </>
  );
}

/** Wide screens: the pinned photo (or the lit cutout) carrying the summary chip. */
function Media({ ctx, data, asset }: { ctx: RenderContext; data: Data; asset: ResolvedAsset }): ReactElement {
  const chip = (
    <GlassChip className="lp-steps__mchip" glass={asset.alpha ? "auto" : "dark"}>
      <Summary ctx={ctx} data={data} />
    </GlassChip>
  );
  if (asset.alpha) {
    return (
      <div className="lp-steps__media lp-steps__media--cutout">
        <ProductStage ctx={ctx} stage={CUTOUT_STAGE[ctx.archetype] ?? "halo"} asset={asset} size="s" ratio="4/5" seedKey="steps-media">
          {chip}
        </ProductStage>
      </div>
    );
  }
  // landscape shots keep most of the frame on a square; portraits get the tall 4:5
  return (
    <figure className="lp-steps__media" {...reveal("mask-arch", 160)}>
      <Picture
        asset={asset}
        sizes="(min-width: 60rem) 24rem, 1px"
        ratio={ratioFor(asset, "4/5", "1/1")}
        mask="page"
        frame={pageFrame(ctx, ratioFor(asset, "4/5", "1/1") === "1/1" ? 1 : 0.8)}
        className="lp-steps__mpic"
      />
      <figcaption>{chip}</figcaption>
    </figure>
  );
}

/** Phones: a glass pill with a round thumbnail — the photo's summary without the photo's height. */
function Pill({ ctx, data, asset }: { ctx: RenderContext; data: Data; asset: ResolvedAsset }): ReactElement {
  return (
    <p className="lp-steps__pill lp-glass" {...reveal("rise", 120)}>
      <Picture asset={asset} sizes="3rem" ratio="1/1" fit={asset.alpha ? "contain" : "cover"} alt="" className="lp-steps__pthumb" />
      <Summary ctx={ctx} data={data} />
    </p>
  );
}

export function Timeline({ ctx, data, titleId }: ViewProps): ReactElement {
  const n = data.steps.length;
  const enter = itemReveal(ctx);
  const asset = data.media ? (ctx.asset(data.image) ?? productShots(ctx)[0] ?? productPhotos(ctx)[0] ?? null) : null;
  const note = data.note.trim();
  return (
    <Container className={cx("lp-steps__tl", asset && "lp-steps__tl--media")}>
      <div className="lp-steps__aside">
        <Head ctx={ctx} data={data} titleId={titleId} />
        {asset ? <Media ctx={ctx} data={data} asset={asset} /> : null}
      </div>
      <div className="lp-steps__main">
        {asset ? <Pill ctx={ctx} data={data} asset={asset} /> : null}
        <ol className="lp-steps__rail" role="list" style={cssVars({ "--n": n })}>
          {data.steps.map((s, i) => {
            const img = ctx.asset(s.image);
            return (
              // "draw" never hides the node: it only triggers the segment fill (and strokes) once in view
              <li key={i} className="lp-steps__node" {...reveal("draw", 260)}>
                <span className="lp-steps__mark" aria-hidden="true" {...reveal("stamp", 60)}>
                  <span className="lp-steps__disc">{idx(i)}</span>
                </span>
                <div className="lp-steps__nbody" {...reveal(enter, 140)}>
                  {/* the title always lines up with its node; the duration rides on its baseline */}
                  <div className="lp-steps__thead">
                    <Title ctx={ctx} step={s} i={i} />
                    <Time ctx={ctx} step={s} i={i} />
                  </div>
                  <Text ctx={ctx} step={s} i={i} />
                  {img ? <Picture asset={img} sizes="(min-width: 60rem) 26rem, 80vw" ratio="16/10" frame={img.alpha ? undefined : { shape: "rounded", ratio: 1.6, maxZoom: 1 }} alt="" className="lp-steps__npic" /> : null}
                </div>
              </li>
            );
          })}
          {note ? (
            // the rail lands on a check: the moment it's done
            <li className="lp-steps__node lp-steps__node--done" {...reveal("draw", 220)}>
              <span className="lp-steps__mark" aria-hidden="true" {...reveal("stamp", 60)}>
                <span className="lp-steps__disc">
                  <DoneCheck />
                </span>
              </span>
              <Note ctx={ctx} data={data} className="lp-steps__nbody" delay={160} />
            </li>
          ) : null}
        </ol>
        <OrderButton ctx={ctx} data={data} className="lp-steps__cta--tl" delay={120} />
      </div>
    </Container>
  );
}
