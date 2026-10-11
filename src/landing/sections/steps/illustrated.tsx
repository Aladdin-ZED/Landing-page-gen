/**
 * illustrated — one plate per step in the page's media mask: the step's photo, or a lit niche where a
 * glass lens floats in front of a shaded sphere of the product's color (crisp where it clears the
 * lens, soft refracted light behind it), the step's icon etched on the glass. Glass chips carry the
 * number and the duration. Smooth
 * curved connectors draw from plate to plate: a wave across the row on wide screens, an S between
 * the zigzag rows on phones.
 */
import type { ReactElement } from "react";
import { ZelligeLines } from "@/landing/illustrations";
import { Container, Icon, Picture, cssVars, cx, reveal, type PictureFrame } from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { density, idx, pageFrame, pageShape } from "../benefits/kit";
import type { StepItem, ViewProps } from "./model";
import { Head, Outro, Text, Time, Title, itemReveal } from "./parts";

/** The plate's frame: the page mask at the plate's aspect (steps.illustrated.css --pr: pill 1:1.4, circle and blob 1:1, else 4:5). */
function plateFrame(ctx: RenderContext): PictureFrame {
  const shape = pageShape(ctx);
  return pageFrame(ctx, shape === "pill" ? 1 / 1.4 : shape === "circle" || shape === "blob" ? 1 : 0.8);
}

/** Seeded organic radii for blob masks (each plate its own pebble, always smooth). */
function blobVar(ctx: RenderContext, key: string): string {
  const r = ctx.rng(`steps-blob:${key}`);
  const v = () => Math.round(40 + r() * 20);
  const [a, b, c, d] = [v(), v(), v(), v()];
  return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`;
}

/**
 * Lit niche: the sphere peeks out from behind the lens at a seeded angle, on alternating sides, so
 * the row reads as one light moving across the plates rather than a stamped repeat.
 */
function Lit({ ctx, step, i, id }: { ctx: RenderContext; step: StepItem; i: number; id: string }): ReactElement {
  const r = ctx.rng(`steps-orb:${id}:${i}`);
  const side = i % 2 ? -1 : 1;
  // offsets of the sphere's centre from the lens centre, in % of the plate width (unitless)
  const orb = cssVars({
    "--ox": Math.round(side * (11 + r() * 5)),
    "--oy": Math.round(-(11 + r() * 5)),
  });
  return (
    <span className="lp-steps__lit" style={orb}>
      {ctx.archetype === "souk" && density(ctx) > 0 ? <ZelligeLines uid={`${id}-z${i}`} variant="rosette" tile={72} opacity={0.09} /> : null}
      <span className="lp-steps__orb" />
      <span className="lp-steps__lens">
        <Icon name={step.icon} size="100%" strokeWidth={1.6} />
      </span>
    </span>
  );
}

/**
 * Connectors (decorative). `--h`: wide screens, plate edge → next plate edge, rising or falling with
 * the wave. `--v`: phones, plate → next plate on the other side of the zigzag.
 */
function Connector({ i }: { i: number }): ReactElement {
  const down = i % 2 === 0;
  return (
    <>
      <svg className="lp-steps__conn lp-steps__conn--h" viewBox="0 0 100 40" aria-hidden="true" focusable="false" {...reveal("draw", 420)}>
        <path className="lp-draw" d={down ? "M3 3C46 3 54 37 97 37" : "M3 37C46 37 54 3 97 3"} pathLength={1} />
        <circle className="lp-steps__cdot lp-draw-pop" data-d={3} cx={97} cy={down ? 37 : 3} r={2.4} />
      </svg>
      <svg className="lp-steps__conn lp-steps__conn--v" viewBox="0 0 100 20" aria-hidden="true" focusable="false" {...reveal("draw", 260)}>
        <path className="lp-draw" d={down ? "M22 1C22 13 78 7 78 19" : "M78 1C78 13 22 7 22 19"} pathLength={1} />
        <circle className="lp-steps__cdot lp-draw-pop" data-d={3} cx={down ? 78 : 22} cy={19} r={1.3} />
      </svg>
    </>
  );
}

export function Illustrated({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const n = data.steps.length;
  const enter = itemReveal(ctx);
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="center" />
      <ol className="lp-steps__ill" role="list" data-count={n} style={cssVars({ "--n": n })}>
        {data.steps.map((s, i) => {
          const img = ctx.asset(s.image);
          return (
            <li key={i} className="lp-steps__istep" data-side={i % 2 ? "end" : "start"}>
              <div className="lp-steps__plate" {...reveal("mask-arch", i * 140)}>
                <div className={cx("lp-steps__pframe lp-mask", !img && "lp-steps__pframe--lit")} style={cssVars({ "--blob": blobVar(ctx, `${id}:${i}`) })}>
                  {img ? (
                    <Picture
                      asset={img}
                      sizes="(min-width: 60rem) 16rem, 42vw"
                      alt=""
                      fit={img.alpha ? "contain" : "cover"}
                      frame={img.alpha ? undefined : plateFrame(ctx)}
                      className="lp-steps__ppic"
                    />
                  ) : (
                    <Lit ctx={ctx} step={s} i={i} id={id} />
                  )}
                </div>
                <span className="lp-steps__badge lp-glass" aria-hidden="true">
                  {idx(i)}
                </span>
                <Time ctx={ctx} step={s} i={i} className="lp-steps__ptime lp-glass" />
              </div>
              <div className="lp-steps__ibody" {...reveal(enter, 180 + i * 140)}>
                <Title ctx={ctx} step={s} i={i} />
                <Text ctx={ctx} step={s} i={i} />
              </div>
              {i < n - 1 ? <Connector i={i} /> : null}
            </li>
          );
        })}
      </ol>
      <Outro ctx={ctx} data={data} className="lp-steps__outro--center" delay={200} />
    </Container>
  );
}
