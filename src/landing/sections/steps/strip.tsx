/**
 * strip — measured frames. Each frame carries one segment of a progress track that fills as the
 * frame swipes into view on phones (scroll-driven) or in sequence on reveal on wide screens. The
 * strip lands on a colored "done" frame with the closing line and the order button.
 */
import type { ReactElement } from "react";
import { Container, Icon, Picture, cssVars, reveal } from "@/landing/primitives";
import { copyLang, idx, nestedBg } from "../benefits/kit";
import { COMMON } from "./copy";
import type { ViewProps } from "./model";
import { DoneCheck, Head, Note, OrderButton, Text, Time, Title, itemReveal } from "./parts";

export function Strip({ ctx, data, titleId, bg }: ViewProps): ReactElement {
  const n = data.steps.length;
  const c = COMMON[copyLang(ctx.locale)];
  const enter = itemReveal(ctx);
  const end = !!data.note.trim() || data.cta;
  // wide-screen grid: up to 4 frames in a row, else 3 per row; with a done frame, 3 per row and the
  // done frame fills what the last row leaves (a full row turns it into a banner)
  const cols = end ? Math.min(n + 1, 3) : n <= 4 ? n : 3;
  const span = n % cols === 0 ? cols : cols - (n % cols);
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      {/* a scroll region on phones: focusable so the keyboard can scroll it too */}
      <div className="lp-steps__track" role="region" aria-labelledby={titleId} tabIndex={0}>
        <ol className="lp-steps__frames" role="list" data-count={n} style={cssVars({ "--n": n, "--cols": cols, "--span": span })}>
          {data.steps.map((s, i) => {
            const img = ctx.asset(s.image);
            return (
              <li key={i} className="lp-steps__frame" {...reveal(enter, i * 110)}>
                <span className="lp-steps__seg" aria-hidden="true" style={cssVars({ "--k": i + 1 })} {...reveal("wipe-side", 240 + i * 200)}>
                  <span className="lp-steps__segfill" />
                </span>
                <div className="lp-steps__fhead" aria-hidden="true">
                  {/* the track above already counts the frames: the numeral stands alone */}
                  <span className="lp-steps__fnum" dir="ltr">
                    {idx(i)}
                  </span>
                  <span className="lp-steps__ficon">
                    <Icon name={s.icon} size="100%" strokeWidth={1.75} />
                  </span>
                </div>
                {img ? <Picture asset={img} sizes="(min-width: 60rem) 20rem, 76vw" ratio="4/3" frame={img.alpha ? undefined : { shape: "rounded", ratio: 4 / 3, maxZoom: 1 }} alt="" className="lp-steps__fpic" /> : null}
                <Title ctx={ctx} step={s} i={i} />
                <Text ctx={ctx} step={s} i={i} />
                <Time ctx={ctx} step={s} i={i} className="lp-steps__ftime" />
              </li>
            );
          })}
          {end ? (
            <li
              className="lp-steps__frame lp-steps__frame--end"
              data-bg={nestedBg(ctx, bg, ["accent", "dark", "pop"])}
              data-wide={span > 1 ? "" : undefined}
              {...reveal(enter, n * 110)}
            >
              <span className="lp-steps__done" aria-hidden="true" {...reveal("draw", 260 + n * 110)}>
                <DoneCheck />
              </span>
              <Note ctx={ctx} data={data} delay={200 + n * 110} />
              <OrderButton ctx={ctx} data={data} delay={300 + n * 110} />
            </li>
          ) : null}
        </ol>
      </div>
      <p className="lp-steps__swipe" aria-hidden="true">
        <span>{c.swipe}</span>
        <Icon name="arrow-right" size="1.1em" strokeWidth={2} />
      </p>
    </Container>
  );
}
