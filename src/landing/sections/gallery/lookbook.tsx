/**
 * gallery/lookbook — editorial spreads of 1 large + 2 small photos with indexed captions. The first
 * spread carries the heading beside the large photo; the second small photo steps over the large
 * one's edge (a layered, boundary-crossing moment), the small photos drift at their own pace on
 * scroll and the opening photo glows with its own ambient light. Further photos open spreads that
 * alternate sides (no heading: the first small photo moves up beside the large one), so 4–9 photos
 * read like turning pages. A small photo left alone steps to the end, wider.
 */
import type { ReactElement } from "react";
import { cx, reveal } from "@/landing/primitives";
import { bgFamily } from "../benefits/kit";
import { Ambient, Caption, GalleryCta, Head, Media, mediaReveal } from "./parts";
import { isLandscape, type Shot, type ViewProps } from "./model";
import { pageMask } from "../reviews/frames";

function Figure({
  ctx,
  shot,
  role,
  ratio,
  delay,
  parallax,
  glow = false,
}: Pick<ViewProps, "ctx"> & {
  shot: Shot;
  role: "main" | "a" | "b";
  ratio: string;
  delay: number;
  parallax?: string;
  /** the photo's own ambient light behind it (the opening spread's large photo) */
  glow?: boolean;
}) {
  const main = role === "main";
  return (
    <div className={`lp-gallery__lk lp-gallery__lk--${role}`} data-parallax={parallax}>
      {glow ? <Ambient shots={[shot]} reveal={delay + 520} /> : null}
      <figure className="lp-gallery__lk-fig" {...reveal(main ? mediaReveal(ctx) : "rise", delay)}>
        <Media
          ctx={ctx}
          shot={shot}
          ratio={ratio}
          mask={main ? "page" : undefined}
          // the large photo wears the page's mask (an arch loses its top corners, a circle all four)
          frame={{ shape: main ? pageMask(ctx) : "rounded", ratio }}
          sizes={main ? "(min-width: 62rem) 40rem, 92vw" : "(min-width: 62rem) 22rem, 46vw"}
        />
        <Caption ctx={ctx} shot={shot} />
      </figure>
    </div>
  );
}

export function Lookbook({ ctx, data, titleId, shots, bg }: ViewProps): ReactElement {
  // landscape sets keep landscape frames (a portrait crop would cut the product in half)
  const land = isLandscape(shots);
  const spreads: Shot[][] = [];
  for (let i = 0; i < shots.length; i += 3) spreads.push(shots.slice(i, i + 3));
  return (
    <div className="lp-container lp-gallery__look" data-tone={bgFamily(ctx, bg)}>
      {spreads.map((group, k) => {
        const [main, a, b] = group;
        const wideMain = k > 0 && group.length === 1;
        return (
          <div
            key={k}
            className={cx(
              "lp-gallery__spread",
              `lp-gallery__spread--${k === 0 ? "a" : k % 2 ? "b" : "c"}`,
              wideMain && "lp-gallery__spread--solo",
              group.length === 2 && "lp-gallery__spread--pair",
              land && "lp-gallery__spread--land",
            )}
          >
            {k === 0 ? (
              <div className="lp-gallery__lk lp-gallery__lk--head">
                <Head ctx={ctx} data={data} titleId={titleId} size="m" />
                <GalleryCta ctx={ctx} data={data} delay={380} />
              </div>
            ) : null}
            {main ? (
              <Figure ctx={ctx} shot={main} role="main" ratio={wideMain ? "16/9" : land ? "4/3" : "4/5"} delay={100} glow={k === 0} />
            ) : null}
            {a ? <Figure ctx={ctx} shot={a} role="a" ratio={land ? "4/3" : "4/5"} delay={220} parallax="0.05" /> : null}
            {b ? <Figure ctx={ctx} shot={b} role="b" ratio={land ? "4/3" : "1"} delay={320} parallax="0.09" /> : null}
          </div>
        );
      })}
    </div>
  );
}
