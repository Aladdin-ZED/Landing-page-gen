/**
 * The product shown ×quantity (pure markup, styled in offer.css). Decorative (alt=""): the pack's
 * text carries the meaning.
 *  - Stack: photo sheets stacked in depth, iOS-style — the front sheet, its copies peeking out above
 *    it, each narrower and further into the light; they slide out on reveal and breathe apart on
 *    hover / selection.
 *  - Lineup: cutout copies standing in depth (front centre, the others behind on alternate sides)
 *    on a lit floor or a podium.
 * A merchant photo of the pack itself (bundle.image) replaces the composition.
 */
import type { ReactElement } from "react";
import { Picture, cssVars, cx, round, type PictureFrame, type VisualKind } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { photoPlan } from "../orderForm/fit";
import { PlannedPhoto } from "../orderForm/photo";
import type { Pack } from "./packs";

export interface ProductVisual {
  asset: ResolvedAsset | null;
  kind: VisualKind;
}

/** Depth slots of a lineup: [side, level] — front centre, then alternate sides further back. */
const SLOTS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 1],
  [1, 1],
  [-2, 2],
  [2, 2],
];

/** The window of a stacked sheet / a standing photo copy (offer.css: 4:5, rounded). */
const SHEET: PictureFrame = { shape: "rounded", ratio: 4 / 5 };

/** Horizontal offset between neighbouring standing copies, in copy widths. */
const LINEUP_STEP = 0.46;

/** Copies drawn for a quantity (the rest becomes a "+n" chip). */
export const copiesOf = (qty: number, max: number) => Math.max(1, Math.min(qty, max, SLOTS.length));

/** Lateral span of a lineup of n copies, in copy widths (0 for a single copy). */
export function lineupSpan(n: number): number {
  const xs = SLOTS.slice(0, copiesOf(n, SLOTS.length)).map(([s]) => s * LINEUP_STEP);
  return Math.max(...xs) - Math.min(...xs);
}

/** Slots of n copies, recentred so the group is balanced (a pair straddles the centre). */
function slotsOf(n: number) {
  const slots = SLOTS.slice(0, n);
  const sides = slots.map(([s]) => s);
  const shift = -(Math.max(...sides) + Math.min(...sides)) / 2;
  return slots.map(([s, l]) => ({ s: round(s + shift, 2), l }));
}

function More({ ctx, n }: { ctx: RenderContext; n: number }) {
  return n > 0 ? (
    <span className="lp-ofv__more">
      <bdi dir="ltr">+{ctx.num(n)}</bdi>
    </span>
  ) : null;
}

interface VisualProps {
  ctx: RenderContext;
  pack: Pack;
  visual: ProductVisual;
  sizes: string;
  /** most copies drawn */
  max?: number;
  className?: string;
}

export function Stack({ ctx, pack, visual, sizes, max = 4, className }: VisualProps): ReactElement | null {
  const own = pack.image;
  const asset = own ?? visual.asset;
  if (!asset) return null;
  const n = own ? 1 : copiesOf(pack.qty, max);
  // every sheet is a rounded window — 4:5, or 5:4 for a wide product — the photo fitted subject-first to it
  const plan = photoPlan(asset);
  return (
    <span className={cx("lp-ofv lp-ofv--stack", className)} data-n={n} data-wide={plan.wide ? "" : undefined} aria-hidden="true">
      {Array.from({ length: n }, (_, l) => (
        <span key={l} className="lp-ofv__sheet" data-l={l} style={cssVars({ "--l": l })}>
          <PlannedPhoto asset={asset} sizes={sizes} plan={plan} />
        </span>
      ))}
      {own ? null : <More ctx={ctx} n={pack.qty - n} />}
    </span>
  );
}

interface LineupProps extends VisualProps {
  /** copy width as a fraction of the box; default: the widest that fits the box */
  width?: number;
}

export function Lineup({ ctx, pack, visual, sizes, max = 5, width, className }: LineupProps): ReactElement | null {
  const own = pack.image;
  const asset = own ?? visual.asset;
  if (!asset) return null;
  const cutout = asset.alpha;
  const n = own ? 1 : copiesOf(pack.qty, max);
  const w = width ?? Math.min(0.62, 0.96 / (1 + lineupSpan(n)));
  return (
    <span
      className={cx("lp-ofv lp-ofv--line", className)}
      data-kind={cutout ? "cutout" : "photo"}
      data-n={n}
      // --lr: the box ratio (width / height) at which the front copy fills 92% of the height — lets a
      // well size the lineup by its height instead of its width
      style={cssVars({ "--w": `${round(w * 100, 2)}%`, "--gw": `${round(w * (1 + lineupSpan(n)) * 100, 2)}%`, "--lr": round(0.92 / (1.25 * w), 4) })}
      aria-hidden="true"
    >
      {slotsOf(n).map(({ s, l }, k) => (
        <span key={k} className="lp-ofv__item" data-l={l} style={cssVars({ "--x": round(s * LINEUP_STEP, 3), "--l": l })}>
          <Picture asset={asset} sizes={sizes} alt="" fit={cutout ? "contain" : "cover"} ratio="4/5" frame={cutout ? undefined : SHEET} />
        </span>
      ))}
      {own ? null : <More ctx={ctx} n={pack.qty - n} />}
    </span>
  );
}
