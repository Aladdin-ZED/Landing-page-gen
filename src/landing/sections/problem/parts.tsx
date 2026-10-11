/**
 * Pieces shared by the problem views: the product visual pick and "the turn" — the moment the
 * section swings from the pains to the product (label, solution line, order button).
 */
import type { ReactElement } from "react";
import { Cta, Icon, Picture, RichText, cssVars, cx, editAttr, pictureCrop, quietCorner, reveal, type Corner } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { isPerson, productShots } from "../benefits/kit";
import { Val } from "../benefits/val";
import type { ProblemData } from "./model";

/** A frame for a shot: cutouts float on a lit stage, landscape shots stay whole in tall frames. */
export const isLandscape = (a: ResolvedAsset | null | undefined): boolean => !!a && a.width > a.height * 1.08;

/**
 * The corner of a photo (frame of aspect `ratio`, crop fitted to it) where a chip of `chip` size
 * (fractions of the frame) covers no face, hand or product — as "ss" … "ee" (block, inline).
 */
export function chipCorner(ctx: RenderContext, a: ResolvedAsset, ratio: number, chip: { w: number; h: number }, prefer: Corner): string {
  const crop = a.alpha ? null : pictureCrop(a, { frame: { shape: "rounded", ratio, maxZoom: 1 } });
  const c = quietCorner(a, ratio, { crop, chip, dir: ctx.dir, prefer });
  return `${c.block[0]}${c.inline[0]}`;
}

/**
 * Aspect of the image pill set in a line of type: as wide as the subject allows — a person a
 * head-and-shoulders oval, an upright product a pill just wide enough to hold it whole (cap to
 * base), a wide product or a scene the full 9:4 capsule.
 */
function pillRatio(a: ResolvedAsset): number {
  if (a.alpha) return 2.28;
  if (isPerson(a)) return 1.5;
  if (a.subjectKind === "product") {
    const box = a.subject;
    const aspect = (box.w * (a.width || 1)) / Math.max(1, box.h * (a.height || 1));
    return Math.round(Math.min(2.28, Math.max(1.15, aspect * 2.2)) * 100) / 100;
  }
  return 2.28;
}

/** The answer card's photo: a person keeps a square (head to hands), a product 4:3, a cutout 5:4. */
const cardRatio = (a: ResolvedAsset): number => (a.alpha ? 5 / 4 : isPerson(a) ? 1 : 4 / 3);

/**
 * The product visual of a view: the section's own image, else — per `prefer` — the cutout, the
 * second shot (so the section doesn't repeat the hero photo), an upright shot (a tall frame would
 * crop a landscape photo down to a detail) or a wide shot (for a pill inset in a line of type); then
 * any product photo.
 */
export function pickVisual(ctx: RenderContext, data: ProblemData, prefer: "cutout" | "second" | "upright" | "wide"): ResolvedAsset | null {
  const own = ctx.asset(data.image);
  if (own) return own;
  const shots = productShots(ctx);
  const cutout = ctx.asset(ctx.product.cutout);
  if (prefer === "cutout" && cutout) return cutout;
  if (prefer === "second" && shots.length > 1) return shots[1]!;
  if (prefer === "upright") {
    const tall = shots.find((a) => a.height >= a.width * 0.9) ?? cutout;
    if (tall) return tall;
  }
  if (prefer === "wide") {
    // a small inset frame holds one subject: never a group shot when a single one exists
    const heads = (a: ResolvedAsset) => a.keep.filter((k) => k.k === "head").length;
    const single = shots.filter((a) => heads(a) <= 1);
    const wide = single.find(isLandscape) ?? single[1] ?? single[0] ?? shots.find(isLandscape) ?? shots[1];
    if (wide) return wide;
  }
  return shots[0] ?? cutout ?? ctx.asset(ctx.product.images[0]);
}

/** Small label that opens the turn ("Fini, tout ça."): an accent check disc (unless `mark` is off) + the text. */
export function TurnLabel({ ctx, text, mark = true }: { ctx: RenderContext; text: string; mark?: boolean }): ReactElement | null {
  if (!text.trim()) return null;
  return (
    <p className="lp-problem__note lp-label" {...editAttr(ctx, "note")}>
      {mark ? (
        <span className="lp-problem__notemark" aria-hidden="true">
          <Icon name="check" size="0.95em" strokeWidth={2.4} />
        </span>
      ) : null}
      <Val ctx={ctx} text={text} />
    </p>
  );
}

export type TurnLook = "line" | "center" | "card";

interface TurnProps {
  ctx: RenderContext;
  data: ProblemData;
  /**
   * line   — the one line of the ledger left standing: a check where the number was, the solution
   *          in display type with the product inset as an image pill (crossed)
   * center — label, solution and button centered under a composition (split)
   * card   — a raised answer card: product photo, label, solution, full-width button (quote)
   */
  look: TurnLook;
  visual?: ResolvedAsset | null;
  delay?: number;
}

export function Turn({ ctx, data, look, visual = null, delay = 0 }: TurnProps): ReactElement | null {
  const solution = data.solution.trim();
  const note = data.note.trim();
  if (!solution && !data.cta) return null;
  const media = look === "center" ? null : visual;
  const cutout = !!media?.alpha;
  // the card's label rides its photo as a glass chip (in the corner where it covers no face or
  // product); everywhere else it opens the text
  const chip = !!note && !!media && look === "card";
  const ratio = media ? cardRatio(media) : 4 / 3;
  const corner = chip && media ? chipCorner(ctx, media, ratio, { w: 0.42, h: 0.17 }, { block: "start", inline: "start" }) : undefined;
  const cta = data.cta ? (
    <div className="lp-problem__tcta" {...reveal("rise", delay + 320)}>
      <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" size={look === "card" ? "m" : "l"} />
    </div>
  ) : null;

  if (look === "line") {
    // laid on the ledger's grid: label over the text column, the check in the number column
    return (
      <div className="lp-problem__turn lp-problem__turn--line">
        {note ? (
          <div className="lp-problem__tnote" {...reveal("fade", delay)}>
            <TurnLabel ctx={ctx} text={note} mark={false} />
          </div>
        ) : null}
        {solution ? (
          <>
            <span className="lp-problem__ok" aria-hidden="true">
              <span className="lp-problem__okdisc" {...reveal("stamp", delay + 80)}>
                <Icon name="check" size="56%" strokeWidth={2.6} />
              </span>
            </span>
            <p className="lp-problem__solution lp-h3">
              {media ? (
                // the pill takes the subject's width: a product whole, a person as a head-and-shoulders portrait
                <span
                  className={cx("lp-problem__pill", cutout && "lp-problem__pill--cutout")}
                  style={cssVars({ "--pr": pillRatio(media) })}
                  {...reveal("scale-in", delay + 140)}
                >
                  <Picture
                    asset={media}
                    sizes="10rem"
                    fit={cutout ? "contain" : "cover"}
                    frame={cutout ? undefined : { shape: "pill", ratio: pillRatio(media), tight: true, maxZoom: 1 }}
                    alt=""
                  />
                </span>
              ) : null}
              <RichText as="span" text={solution} ctx={ctx} editPath="solution" reveal="rise" delay={delay + 180} split />
            </p>
          </>
        ) : null}
        {cta}
      </div>
    );
  }

  return (
    <div
      className={cx("lp-problem__turn", `lp-problem__turn--${look}`, media && "lp-problem__turn--media", cutout && "lp-problem__turn--cutout")}
      {...reveal(look === "card" ? "tilt-in" : "fade", delay)}
    >
      {media ? (
        <div className="lp-problem__tmedia">
          <Picture
            asset={media}
            sizes="(min-width: 60rem) 24rem, 92vw"
            ratio={cutout ? "5/4" : ratio === 1 ? "1/1" : "4/3"}
            fit={cutout ? "contain" : "cover"}
            frame={cutout ? undefined : { shape: "rounded", ratio, maxZoom: 1 }}
            className="lp-problem__tpic"
            alt=""
          />
          {chip ? (
            <span className="lp-problem__tchip lp-glass" data-corner={corner} {...reveal("stamp", delay + 420)}>
              <TurnLabel ctx={ctx} text={note} />
            </span>
          ) : null}
        </div>
      ) : null}
      {(note && !chip) || solution ? (
        <div className="lp-problem__tbody">
          {note && !chip ? <TurnLabel ctx={ctx} text={note} /> : null}
          {solution ? (
            <RichText as="p" className="lp-problem__solution lp-h3" text={solution} ctx={ctx} editPath="solution" reveal="rise" delay={delay + 120} />
          ) : null}
        </div>
      ) : null}
      {cta}
    </div>
  );
}
