/**
 * A product photo in its planned window (fit.ts photoPlan): fitted subject-first to the exact frame
 * (heads, faces, hands and the product kept whole), or — for a product too wide for any window — shown
 * whole on its own dominant-color backdrop. Decorative (alt=""): the surrounding text carries the meaning.
 */
import type { ReactElement } from "react";
import type { FrameShape } from "@/lib/media/focus";
import { Picture, cx, type PictureFrame } from "../../primitives";
import type { ResolvedAsset } from "../../types";
import { LETTERBOX, type PhotoPlan } from "./fit";

export function PlannedPhoto({
  asset,
  sizes,
  plan,
  shape = "rounded",
  frameLg,
  frameMin,
  className,
}: {
  asset: ResolvedAsset;
  sizes: string;
  plan: PhotoPlan;
  /** the window's mask geometry (its safe area) */
  shape?: FrameShape;
  /** art direction: the window from `frameMin` up when the section reshapes it (positions only) */
  frameLg?: PictureFrame;
  frameMin?: string;
  className?: string;
}): ReactElement {
  return plan.fit === "contain" ? (
    <Picture asset={asset} sizes={sizes} alt="" fit="contain" className={cx(LETTERBOX, className)} />
  ) : (
    <Picture asset={asset} sizes={sizes} alt="" frame={{ shape, ratio: plan.ratio }} frameLg={frameLg} frameMin={frameMin} className={className} />
  );
}
