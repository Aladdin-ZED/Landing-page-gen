/**
 * split — the promises next to the thing they protect. The product photo opens inside the theme's
 * mask (a rounded frame when that mask would cut a head), fitted subject-first; a frosted chip
 * carries the live price “payable at the door” in the photo's quiet spot — never over a face, a
 * hand or the product's top. The heading and a raised panel of promises share the column beside
 * the photo, the panel stepping over the photo's edge; one precise hairline threads the icons and
 * grows from disc to disc as the rows arrive.
 * Phone: heading, photo, then the panel rising over the photo's foot. Without any photo the panel
 * stands alone under the heading and the promises run side by side.
 */
import type { ReactElement } from "react";
import { defaultBundleId } from "@/lib/page/pricing";
import { Icon, Picture, SectionHeader, cx, reveal } from "@/landing/primitives";
import { maskOf, pageShape, placeOverlay, shapeFor, type Spot, type SpotOptions } from "../story/fit";
import { UI, langOf } from "./copy";
import { promiseLines, typo, type ViewProps } from "./model";
import { Foot, PromiseList, pickPhoto } from "./parts";

/** Chip spots in order of preference — phone (the panel covers the photo's foot) and wide screens
 *  (the panel covers the photo's end edge below the heading, so the chip stays on the open side). */
const SPOTS_PHONE: readonly Spot[] = ["ts", "te", "tc", "bs", "be", "bc", "ms", "me"];
const SPOTS_WIDE: readonly Spot[] = ["ts", "tc", "bs", "bc", "ms", "te"];
/** Last resort: across the photo's foot (phones: onto the panel's top edge; wide: into the open air). */
const SEAM: readonly Spot[] = ["xs", "xc", "xe"];

export function Split({ ctx, data, titleId }: ViewProps): ReactElement {
  const lines = promiseLines(data);
  const photo = pickPhoto(ctx, data);
  const bundle = ctx.offers.bundles.find((b) => b.id === defaultBundleId(ctx.offers));
  const ui = UI[langOf(ctx.locale)];
  // landscape shots keep a landscape frame (a portrait crop would cut the product in half); one
  // frame at every width, so the crop and the chip's spot hold from phone to desktop
  const wide = !!photo && !photo.alpha && photo.width > photo.height * 1.15;
  const page = pageShape(ctx);
  const ratio = page === "circle" ? 1 : wide ? 4 / 3 : 4 / 5;
  const shape = photo ? shapeFor(photo, page, ratio) : page;
  const frame = { shape, ratio };
  const dir = ctx.dir === "rtl" ? "rtl" : "ltr";
  const chip = data.priceChip && bundle && photo;
  // curved masks hold a chip inside their dome (9% from the top) — and, on pills, circles and blobs,
  // inside their rounded foot too (split CSS: --ft / --fb)
  const curved = shape !== "rounded" && shape !== "rect";
  const inset = { x: 0.045, y: 0.035, top: curved ? 0.09 : 0.035, bottom: curved && shape !== "arch" ? 0.09 : 0.035 };
  // a crowded photo (two people filling the frame, a bottle filling a pill) may leave no clean spot
  // for the full chip: the compact chip (price only) gets a second chance; else the chip crosses
  // the photo's foot, where it covers only a hem or a product's base
  const place = (spots: readonly Spot[], w: number, wCompact: number, h: number, extra: Partial<SpotOptions>) => {
    if (!chip) return { spot: undefined, compact: false };
    const full = placeOverlay(photo, frame, spots, { chip: { w, h }, dir, inset, ...extra });
    if (full.clean) return { spot: full.spot, compact: false };
    const small = placeOverlay(photo, frame, spots, { chip: { w: wCompact, h: h * 0.85 }, dir, inset, ...extra });
    if (small.clean) return { spot: small.spot, compact: true };
    return { spot: placeOverlay(photo, frame, SEAM, { chip: { w, h }, dir, inset, ...extra }).spot, compact: false };
  };
  const phone = place(SPOTS_PHONE, 0.58, 0.34, 0.13, { lift: 0.12 });
  // side by side, the panel steps over the photo's end edge below the heading
  const lg = place(SPOTS_WIDE, wide ? 0.27 : 0.36, wide ? 0.17 : 0.22, 0.1, {
    avoid: [dir === "rtl" ? { x: 0, y: 0.3, w: 0.2, h: 0.7 } : { x: 0.8, y: 0.3, w: 0.2, h: 0.7 }],
  });
  return (
    <div className={cx("lp-container lp-guarantee__wrap lp-cq", !photo && "lp-guarantee__wrap--solo")}>
      <div
        className={cx("lp-guarantee__stage", wide && "lp-guarantee__stage--wide")}
        data-shape={photo ? shape : undefined}
        data-seam={phone.spot?.startsWith("x") ? "" : undefined}
      >
        <SectionHeader
          ctx={ctx}
          kicker={data.kicker}
          title={typo(ctx.locale, data.title)}
          lead={typo(ctx.locale, data.lead)}
          size="m"
          align={photo && !wide ? "start" : "split"}
          titleId={titleId}
          editBase=""
          className="lp-guarantee__head"
        />
        {photo ? (
          // the reveal lives on the photo's own wrapper: an animated figure would become a stacking
          // context and sink a chip that crosses the photo's foot under the panel
          <figure className="lp-guarantee__media">
            <div className="lp-guarantee__frame" {...reveal(shape === "arch" ? "mask-arch" : "scale-in")}>
              <Picture
                asset={photo}
                sizes={wide ? "(min-width: 64rem) 44rem, 92vw" : "(min-width: 64rem) 34rem, (min-width: 40rem) 46vw, 92vw"}
                ratio={ratio}
                mask={maskOf(shape, page)}
                frame={frame}
                fit={photo.alpha ? "contain" : "cover"}
                className="lp-guarantee__pic"
                alt={photo.alt || ctx.product.name}
              />
            </div>
            {chip ? (
              <figcaption
                className="lp-guarantee__float"
                data-at={phone.spot}
                data-at-lg={lg.spot}
                data-compact={phone.compact ? "" : undefined}
                data-compact-lg={lg.compact ? "" : undefined}
              >
                <span className="lp-guarantee__chip lp-glass" data-parallax="-0.04" {...reveal("rise", 420)}>
                  <span className="lp-guarantee__chip-ico" aria-hidden="true">
                    <Icon name="cash-hand" size="1.3rem" />
                  </span>
                  <span className="lp-guarantee__chip-txt">
                    {/* the runtime rewrites this text when the shopper picks another bundle */}
                    <bdi className="lp-guarantee__chip-price" data-lp-price="current">
                      {ctx.money(bundle.price)}
                    </bdi>
                    <span className="lp-guarantee__chip-note">{ui.atDoor}</span>
                  </span>
                </span>
              </figcaption>
            ) : null}
          </figure>
        ) : null}
        <div className="lp-guarantee__panel" {...reveal("rise", 140)}>
          <div className="lp-guarantee__thread">
            <PromiseList ctx={ctx} lines={lines} delay={240} step={110} iconSize="1.5rem" />
          </div>
          <Foot ctx={ctx} data={data} delay={520} />
        </div>
      </div>
    </div>
  );
}
