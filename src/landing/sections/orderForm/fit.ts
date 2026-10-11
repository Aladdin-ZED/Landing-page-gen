/**
 * The window a product photo is shown in — shared by the conversion sections (order form, offer,
 * urgency). A subject-aware cover crop (Picture `frame`) keeps faces, heads and hands whole, but it
 * cannot zoom OUT: a wide product (a massage gun shot side-on) in a portrait 4:5 window would lose its
 * ends. So a product that does not fit the portrait window takes a landscape one (the section CSS
 * reads `data-wide`), and one too wide even for that is shown whole (`contain`) on a backdrop of its
 * own dominant color (`.lp-pic--letterbox`). People and scenes always keep the portrait, fitted crop.
 */
import type { ResolvedAsset } from "../../types";

/** Room the fitted crop needs around a product, as a fraction of the visible window. */
const SLACK = 0.985;

/** Portrait window (width / height) of the stacks, passes, tiles and the drop card. */
export const TALL = 4 / 5;
/** Landscape window a wide product switches to. */
export const WIDE = 5 / 4;

/** Does the product fit a `ratio` window under a plain cover crop (zoom 1)? People and scenes: yes. */
export function fitsCover(asset: ResolvedAsset | null | undefined, ratio: number): boolean {
  if (!asset || asset.alpha || !(ratio > 0)) return true;
  if (asset.subjectKind !== "product") return true;
  const A = asset.aspect > 0 ? asset.aspect : asset.width > 0 && asset.height > 0 ? asset.width / asset.height : 1;
  const item = asset.keep?.find((k) => k.k === "item")?.b ?? asset.subject;
  if (!item) return true;
  // the window a plain cover crop shows, in fractions of the photo
  const vw = Math.min(1, ratio / A);
  const vh = Math.min(1, A / ratio);
  return item.w <= vw * SLACK && item.h <= vh * SLACK;
}

export interface PhotoPlan {
  /** the landscape window (CSS: [data-wide]) */
  wide: boolean;
  fit: "cover" | "contain";
  /** the window's width / height */
  ratio: number;
}

/** Portrait when the product fits it, else landscape, else the whole product on its backdrop. */
export function photoPlan(asset: ResolvedAsset | null | undefined, tall = TALL, wide = WIDE): PhotoPlan {
  if (fitsCover(asset, tall)) return { wide: false, fit: "cover", ratio: tall };
  return { wide: true, fit: fitsCover(asset, wide) ? "cover" : "contain", ratio: wide };
}

/** The class that gives a contained photo its dominant-color backdrop (the section CSS draws it). */
export const LETTERBOX = "lp-pic--letterbox";
