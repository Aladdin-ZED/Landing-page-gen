/**
 * image-text — a large photo in the theme's mask (arch, pill, blob or rounded — rounded whenever the
 * curved mask would cut a head) with a frosted glass card overlapping its edge. The mask opens while
 * the photo settles from a slight zoom; on scroll the photo keeps settling into its frame
 * (scroll-driven, where supported, zooming about the heads so they never leave it) and drifts with
 * a subtle parallax (desktop). A glass place chip captions the photo and, when the product has
 * another shot, a round detail sits in a frosted glass bezel on the frame's edge — a lens over the
 * photo. Chip and lens take the photo's quiet spots: never over a face or a hand (a crowded photo
 * simply keeps its lens off). The media side is seeded per page. The card only overlaps the photo
 * where it covers no face or hand (and little of a product): otherwise it sits beside / below it.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Icon, Kicker, Picture, RichText, TITLE_REVEAL, cssVars, cx, editAttr, frameRegions, pictureCrop, plainText, reveal } from "@/landing/primitives";
import type { Box } from "@/lib/media/focus";
import type { ResolvedAsset } from "../../types";
import { density } from "../benefits/kit";
import { placeOverlay, type Spot } from "./fit";
import type { ViewProps } from "./model";
import { Facts, Signature, StoryCta, frameRatio, pickInset, pickMedia, placeOf, ratioNum, storyFrame, type StoryFrame } from "./parts";

/**
 * Lens seats (the lens is a disc ≈ 26% of the frame's width): `t` crossing the top edge (rounded
 * frames), `u` / `l` crossing the side at 30% / 58% of the height; `a` = inline end, `b` = start.
 */
type Seat = "ta" | "tb" | "ua" | "ub" | "la" | "lb";
const LENS_W = 0.26;

/** The part of the photo a lens seat covers (physical frame fractions). */
function seatZone(seat: Seat, F: number, rtl: boolean): Box {
  const h = LENS_W * F; // the disc's diameter in height units
  const end = seat[1] === "a";
  const right = end !== rtl;
  if (seat[0] === "t") return { x: right ? 1 - 0.05 - LENS_W : 0.05, y: 0, w: LENS_W, h: h * 0.6 };
  const y = seat[0] === "u" ? 0.3 : 0.58;
  return { x: right ? 1 - LENS_W * 0.62 : 0, y, w: LENS_W * 0.62, h };
}

const pad = (b: Box, d: number): Box => ({ x: b.x - d, y: b.y - d, w: b.w + 2 * d, h: b.h + 2 * d });

/** The first seat whose disc covers no head or hand of the photo; null when every seat would. */
function lensSeat(media: ResolvedAsset, fr: StoryFrame, F: number, rtl: boolean, seats: readonly Seat[]): Seat | null {
  if (media.alpha || media.subjectKind === "none") return seats[0] ?? null;
  const reg = frameRegions(media, F, pictureCrop(media, { frame: { shape: fr.shape, ratio: F } }));
  const hit = (a: Box, b: Box) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  for (const seat of seats) {
    const z = seatZone(seat, F, rtl);
    if (reg.heads.some((b) => hit(z, pad(b, 0.02))) || reg.hands.some((b) => hit(z, pad(b, 0.02)))) continue;
    // a product keeps its own box clear too (the lens would read as a sticker on the bottle)
    if ((media.subjectKind === "product" || media.subjectKind === "cutout") && hit(z, pad(reg.subject, -0.02))) continue;
    return seat;
  }
  return null;
}

/** Area of the overlap of two boxes. */
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Would the card, laid over `zone` of the frame, cover a head or a hand of the photo — or more than an
 * eighth of the product shown? (the photo fitted to the frame as <Picture> crops it, zoom included)
 */
function cardCovers(media: ResolvedAsset | null, fr: StoryFrame, F: number, frameZone: Box): boolean {
  if (!media || media.alpha || media.subjectKind === "none") return false;
  // the photo rides a parallax layer 10% taller than the frame (inset: -5% 0) unless it is still
  const k = fr.still ? 1 : 1.1;
  const L = fr.still ? F : F / k;
  const zone: Box = { x: frameZone.x, y: (frameZone.y + (k - 1) / 2) / k, w: frameZone.w, h: frameZone.h / k };
  const reg = frameRegions(media, L, pictureCrop(media, { frame: { shape: fr.shape, ratio: L } }));
  if ([...reg.heads, ...reg.hands].some((b) => overlap(zone, pad(b, 0.01)) > 0)) return true;
  if (media.subjectKind !== "product") return false;
  // the product as the frame shows it (the layer's slack above and below is hidden)
  const s = reg.subject;
  const m = (k - 1) / 2 / k;
  const x0 = Math.max(0, s.x);
  const y0 = Math.max(m, s.y);
  const vis: Box = { x: x0, y: y0, w: Math.min(1, s.x + s.w) - x0, h: Math.min(1 - m, s.y + s.h) - y0 };
  return vis.w > 0 && vis.h > 0 && overlap(zone, vis) / (vis.w * vis.h) > 0.12;
}

export function ImageText({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const media = pickMedia(ctx, data);
  const cutout = !!media?.alpha;
  const deco = density(ctx);
  const place = placeOf(ctx, data);
  const flip = ctx.rng(`story:${id}:side`)() < 0.5;
  const ratio = frameRatio(media);
  const F = ratioNum(ratio);
  const fr = storyFrame(ctx, media, F);
  const rtl = ctx.dir === "rtl";
  const dir = rtl ? "rtl" : "ltr";
  // lens: phones keep it on the top edge (rounded) or the curved side (domes); side by side it sits
  // on the frame's outer side, away from the card
  const inset = deco > 0 && media ? pickInset(ctx, media) : null;
  const outer: "a" | "b" = flip ? "a" : "b";
  const seatsPhone: Seat[] = fr.dome ? ["ua", "ub", "la", "lb"] : ["ta", "tb", "ua", "ub"];
  const seatsWide: Seat[] = fr.dome ? [`u${outer}`, `l${outer}`] : [`t${outer}`, `u${outer}`, `l${outer}`];
  const lens = inset && media ? lensSeat(media, fr, F, rtl, seatsPhone) : null;
  const lensLg = inset && media ? lensSeat(media, fr, F, rtl, seatsWide) : null;
  const showLens = !!inset && (!!lens || !!lensLg);
  // place chip: inside the dome on curved frames; never over a face, the lens or the card. On
  // phones the card covers the photo's foot; side by side it covers the photo's inner side
  const o = outer === "a" ? "e" : "s";
  const chipSpots: Spot[] = fr.dome ? ["tc", "ms", "me"] : ["ts", "te", "tc", "ms", "me"];
  const chipSpotsLg = (fr.dome ? ["tc", `m${o}`, fr.shape === "arch" ? `b${o}` : "bc"] : [`b${o}`, `t${o}`, "tc"]) as Spot[];
  const chipOpts = { chip: { w: 0.42, h: 0.08 }, dir, inset: { x: 0.04, y: 0.035, top: fr.dome ? 0.15 : 0.035, bottom: fr.dome && fr.shape !== "arch" ? 0.1 : 0.035 } } as const;
  const lensZone = (seat: Seat | null): Box[] => (seat ? [pad(seatZone(seat, F, rtl), 0.03)] : []);
  const innerRight = (outer === "b") !== rtl; // the card overlaps the side facing it
  const cardZone: Box = { x: innerRight ? 0.7 : 0, y: 0.3, w: 0.3, h: 0.7 };
  // phones: the card rises over the photo's foot (≈ 16% of a portrait frame, 12% of a landscape one)
  const footZone: Box = ratio === "4/3" ? { x: 0.03, y: 0.88, w: 0.94, h: 0.12 } : { x: 0.03, y: 0.83, w: 0.94, h: 0.17 };
  // side by side the card covers the frame's inner two columns (a landscape frame: centred on its edge)
  const sideZone: Box = ratio === "4/3" ? { x: innerRight ? 0.75 : 0, y: 0.15, w: 0.25, h: 0.7 } : cardZone;
  const clear = cardCovers(media, fr, F, footZone);
  const clearLg = cardCovers(media, fr, F, sideZone);
  const at = place && media ? placeOverlay(media, { shape: fr.shape, ratio: F }, chipSpots, { ...chipOpts, lift: 0.16, avoid: lensZone(showLens ? lens : null) }).spot : undefined;
  const atLg =
    place && media ? placeOverlay(media, { shape: fr.shape, ratio: F }, chipSpotsLg, { ...chipOpts, avoid: [...lensZone(showLens ? lensLg : null), cardZone] }).spot : undefined;
  return (
    <Container
      className={cx(
        "lp-story__it",
        !media && "lp-story__it--solo",
        flip && "lp-story__it--flip",
        showLens && "lp-story__it--inset",
        fr.dome && "lp-story__it--dome",
        ratio === "4/3" && "lp-story__it--wide",
        clear && "lp-story__it--clear",
        clearLg && "lp-story__it--clear-lg",
      )}
    >
      {/* no product photo at all: the card stands alone rather than over an empty frame */}
      {media ? (
        <figure className="lp-story__media" data-shape={fr.shape} data-parallax={fr.still && !cutout ? "0.04" : undefined}>
          {deco > 0 ? <GlowOrb className="lp-story__glow" size="95%" place="center" intensity="medium" /> : null}
          <div
            className={cx("lp-story__frame", fr.cls, cutout && "lp-story__frame--cutout", fr.still && "lp-story__frame--still")}
            style={cssVars({ "--ratio": ratio.replace("/", " / "), "--settle-org": fr.org })}
            {...reveal(fr.reveal)}
            {...editAttr(ctx, "image")}
          >
            <div className="lp-story__par" data-parallax={fr.still ? undefined : "0.05"}>
              <Picture asset={media} sizes="(min-width: 48rem) 56vw, 92vw" fit={cutout ? "contain" : "cover"} {...fr.fit} className="lp-story__pic" />
            </div>
          </div>
          {place ? (
            <figcaption className="lp-story__place lp-glass" data-at={at} data-at-lg={atLg} {...reveal("blur-in", 420)} {...editAttr(ctx, "place")}>
              <Icon name="map-pin" size="1.05em" strokeWidth={2} />
              <RichText as="span" className="lp-story__placetext" text={place} ctx={ctx} decorate={false} />
            </figcaption>
          ) : null}
          {showLens && inset ? (
            <span className="lp-story__lens" data-seat={lens ?? "none"} data-seat-lg={lensLg ?? "none"} aria-hidden="true" {...reveal("scale-in", 560)}>
              <Picture asset={inset} sizes="10rem" ratio={1} frame={{ shape: "circle", ratio: 1, tight: true }} alt="" className="lp-story__lenspic" />
            </span>
          ) : null}
        </figure>
      ) : null}

      {!media && deco > 0 ? <GlowOrb className="lp-story__glow" size="70%" shape="wide" place="center" intensity="soft" /> : null}
      <div className="lp-story__card lp-glass" {...reveal("rise", 180)}>
        <Kicker ctx={ctx} text={data.kicker} editPath="kicker" />
        <RichText
          as="h2"
          id={titleId}
          className={cx("lp-story__title lp-h2", plainText(data.title).length > 70 && "lp-story__title--long")}
          text={data.title}
          ctx={ctx}
          editPath="title"
          reveal={TITLE_REVEAL[ctx.archetype]}
          delay={260}
          split
        />
        <RichText block className="lp-story__body" text={data.text} ctx={ctx} editPath="text" reveal="fade" delay={360} />
        <Signature ctx={ctx} data={data} look="row" />
        <Facts ctx={ctx} data={data} delay={480} />
        <StoryCta ctx={ctx} data={data} delay={560} />
      </div>
    </Container>
  );
}
