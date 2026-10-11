/**
 * Pieces shared by the showcase variants: heading, closing action, a detail's copy, the product
 * visual, the editorial index, and the details index that stands in for a pinned photo.
 */
import type { ReactElement } from "react";
import { Cta, RichText, SectionHeader, cx, pictureCrop, reveal } from "@/landing/primitives";
import { CENTER_CROP, framePointOf, type Crop, type FrameShape } from "@/lib/media/focus";
import type { SectionBg } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../../types";
import { productPhotos } from "../benefits/kit";
import type { Data, PointData } from "./schema";

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  id: string;
  titleId: string;
  /** the section's own color block (nested surfaces pick a contrasting one) */
  bg: SectionBg;
}

/** The product visual: the section's own image, else the cutout, else the first photo. */
export function productVisual(ctx: RenderContext, data: Data): ResolvedAsset | null {
  return ctx.asset(data.image) ?? productPhotos(ctx)[0] ?? null;
}

export function Head({ ctx, data, titleId, align = "start" }: { ctx: RenderContext; data: Data; titleId: string; align?: "start" | "center" | "split" }): ReactElement {
  return <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} align={align} className="lp-showcase__head" />;
}

export function Action({ ctx, data, center }: { ctx: RenderContext; data: Data; center?: boolean }): ReactElement | null {
  if (!data.cta) return null;
  return (
    <div className={cx("lp-showcase__cta", center && "lp-showcase__cta--center")} {...reveal("rise", 120)}>
      <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" />
    </div>
  );
}

/** A detail's label (h3) and its explanation. */
export function PointCopy({ ctx, p, i }: { ctx: RenderContext; p: PointData; i: number }): ReactElement {
  return (
    <>
      <RichText as="h3" className="lp-showcase__label" text={p.label} ctx={ctx} editPath={`points.${i}.label`} decorate={false} />
      {p.text.trim() ? <RichText as="p" className="lp-showcase__text" text={p.text} ctx={ctx} editPath={`points.${i}.text`} /> : null}
    </>
  );
}

/** "01", "02"… in Latin digits, like every figure on the page. */
export const num2 = (i: number): string => String(i + 1).padStart(2, "0");

/**
 * The crop a cover photo shows in a frame of aspect `frameAspect`, fitted subject-first to that frame
 * (heads, hands and a product's top kept) — the same call the Picture makes when given `frame`, so
 * pins and callouts drawn over the photo land on the pixels they describe. `zoomable`: the frame was
 * given without a zoom cap (ProductStage's photo window) — the crop's position is the same one the
 * Picture writes; overlays are placed on the plain (un-zoomed) window.
 */
export function photoCrop(asset: ResolvedAsset | null, shape: FrameShape, frameAspect: number, zoomable = false): Crop | null {
  if (!asset || asset.alpha) return null;
  return pictureCrop(asset, { frame: { shape, ratio: frameAspect, maxZoom: zoomable ? undefined : 1 } });
}

/**
 * Where a detail pinned at x / y (% of the photo) lands in the frame that shows the photo, as
 * fractions of that frame: `cover` crops at `crop` (the frame's fitted crop), `contain` letterboxes
 * at `pos`. A point cropped away comes back outside 0..1 — callers keep it in view.
 */
export function framePoint(
  asset: ResolvedAsset | null,
  frameAspect: number,
  fit: "cover" | "contain",
  x: number,
  y: number,
  at: { crop?: Crop | null; pos?: readonly [number, number] } = {},
): [number, number] {
  const r = asset && asset.width > 0 && asset.height > 0 ? asset.width / asset.height : frameAspect;
  if (fit === "cover") {
    const c = at.crop ?? (asset ? (pictureCrop(asset, { frame: { shape: "rect", ratio: frameAspect, maxZoom: 1 } }) ?? CENTER_CROP) : CENTER_CROP);
    return framePointOf(r, frameAspect, { x: c.x, y: c.y, zoom: 1 }, x / 100, y / 100);
  }
  const pos = at.pos ?? [0.5, 0.5];
  const sx = Math.min(1, r / frameAspect);
  const sy = Math.min(1, frameAspect / r);
  return [pos[0] * (1 - sx) + (x / 100) * sx, pos[1] * (1 - sy) + (y / 100) * sy];
}

/**
 * The details without a photo to pin them on (a product with no shot yet): an editorial index —
 * a drawn hairline, the numeral and the copy per detail, two columns from tablets up — instead of
 * numbered pins floating over an empty frame.
 */
export function DetailIndex({ ctx, data }: { ctx: RenderContext; data: Data }): ReactElement {
  return (
    <ol className="lp-showcase__dindex" role="list" data-count={data.points.length}>
      {data.points.map((p, i) => (
        <li key={i} className="lp-showcase__dentry" {...reveal("rise", 120 + i * 90)}>
          <span className="lp-showcase__drule" aria-hidden="true" {...reveal("wipe-side", 160 + i * 90)} />
          <span className="lp-showcase__dnum" aria-hidden="true">
            {num2(i)}
          </span>
          <div className="lp-showcase__dbody">
            <PointCopy ctx={ctx} p={p} i={i} />
          </div>
        </li>
      ))}
    </ol>
  );
}
