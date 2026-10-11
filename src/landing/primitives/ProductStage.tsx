import type { ReactElement, ReactNode } from "react";
import type { FrameShape } from "@/lib/media/focus";
import type { Archetype } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../types";
import { Picture, type PictureFrame } from "./Picture";
import { clamp, cssVars, cx, reveal, round, safeRatio, seededRotation } from "./util";

export const STAGES = ["arch", "halo", "slab", "blob", "podium", "frame", "none"] as const;
export type StageKind = (typeof STAGES)[number];

export interface ProductStageProps {
  ctx: RenderContext;
  stage: StageKind;
  /** explicit visual; default = product cutout, else first product photo */
  asset?: ResolvedAsset | null;
  /** hero/LCP usage: eager image and the product itself is never hidden for a reveal */
  priority?: boolean;
  size?: "s" | "m" | "l";
  /** override the computed `sizes` attribute */
  sizes?: string;
  /** stage box aspect ratio (default 4/5) */
  ratio?: string | number;
  alt?: string;
  /** seed key for the stage's own variation (blob outline, slab tilt) — unique per placement */
  seedKey?: string;
  animate?: boolean;
  /** cutouts hover gently on lively pages (default true) */
  float?: boolean;
  /** concentric halo rings around the backdrop (default: halo stage only) */
  rings?: boolean;
  className?: string;
  /** overlay layer (glass chips, callouts, leader lines) positioned over the stage */
  children?: ReactNode;
}

export type VisualKind = "cutout" | "photo" | "empty";

/** Pick the product visual: transparent cutout → light it on a set; regular photo → frame it. */
export function resolveProductVisual(
  ctx: RenderContext,
  asset?: ResolvedAsset | null,
): { asset: ResolvedAsset | null; kind: VisualKind } {
  const pick = (a: ResolvedAsset | null): { asset: ResolvedAsset | null; kind: VisualKind } =>
    a ? { asset: a, kind: a.alpha ? "cutout" : "photo" } : { asset: null, kind: "empty" };
  if (asset !== undefined) return pick(asset);
  return pick(ctx.asset(ctx.product.cutout) ?? ctx.asset(ctx.product.images[0]));
}

const SIZES = {
  s: "(min-width: 64rem) 22rem, 72vw",
  m: "(min-width: 64rem) 30rem, 86vw",
  l: "(min-width: 64rem) 38rem, 94vw",
} as const;

/** Box insets as fractions of the stage box: [inline (each side), top, bottom]. */
type Box = readonly [number, number, number];

/**
 * Cutout set geometry per stage — mirrored by the --st-* / --pr-* insets in base.css (keep both in
 * sync). `shape` is the backdrop, `product` the box the cutout is contained in (standing on its
 * floor); products taller than their backdrop break out over its top edge.
 */
const CUTOUT: Record<StageKind, { shape: Box | null; product: Box }> = {
  arch: { shape: [0.1, 0.14, 0.04], product: [0.13, 0.02, 0.1] },
  halo: { shape: null, product: [0.14, 0.05, 0.12] },
  slab: { shape: [0.08, 0.15, 0.05], product: [0.13, 0.02, 0.11] },
  blob: { shape: [0.04, 0.08, 0.05], product: [0.14, 0.04, 0.13] },
  podium: { shape: [0.09, 0.06, 0.24], product: [0.19, 0.04, 0.19] },
  frame: { shape: [0.08, 0.17, 0.06], product: [0.14, 0.02, 0.13] },
  none: { shape: null, product: [0.07, 0.03, 0.06] },
};

/** Photo frame geometry for the arch window (other stages fill the box or use a square circle). */
const PHOTO_ARCH: Box = [0.06, 0, 0];

/**
 * The window a regular photo is shown in per stage — mirrored from base.css §12 (photo insets and
 * radii): mask shape and the window's aspect as a factor of the stage aspect R. The photo is
 * fitted to it subject-first (heads, hands and a product's top never cut by the arch or circle).
 */
const PHOTO_WINDOW: Record<StageKind, { shape: FrameShape; ratio: (R: number) => number }> = {
  arch: { shape: "arch", ratio: (R) => R * (1 - 2 * PHOTO_ARCH[0]) },
  halo: { shape: "circle", ratio: () => 1 },
  slab: { shape: "rounded", ratio: (R) => (R * 0.9) / 0.94 },
  blob: { shape: "blob", ratio: (R) => R },
  podium: { shape: "rounded", ratio: (R) => R * 0.92 },
  frame: { shape: "rounded", ratio: (R) => R },
  none: { shape: "rounded", ratio: (R) => R },
};

/** Podium backdrop: an arched niche for the soft languages, a rounded panel for the precise ones. */
const NICHE: ReadonlySet<Archetype> = new Set<Archetype>(["maison", "souk", "bloom", "field", "hearth", "apothecary", "playground"]);

/** "4 / 5" → 0.8 (width / height); invalid → undefined. */
function ratioValue(r: string | undefined): number | undefined {
  if (!r) return undefined;
  const [a, b] = r.split("/").map((p) => Number(p.trim()));
  const v = b === undefined ? a! : a! / b;
  return Number.isFinite(v) && v > 0.2 && v < 5 ? v : undefined;
}

/**
 * Vertical radius (% of the box height) that turns the top of a box of `box` insets into a true
 * half-circle on a stage of aspect R — percentages of border-radius resolve against each axis.
 */
function archRy(R: number, box: Box): string {
  const w = R * (1 - 2 * box[0]);
  const h = 1 - box[1] - box[2];
  return `${round(clamp(((w / 2) / h) * 100, 1, 50), 2)}%`;
}

/** Seeded smooth organic outline as an 8-value border-radius ("58% 42% 55% 45% / 47% 56% 44% 53%"). */
function blobRadius(r: () => number): string {
  const v = () => Math.round(38 + r() * 24);
  const a = v();
  const b = v();
  const c = v();
  const d = v();
  return `${a}% ${100 - a}% ${b}% ${100 - b}% / ${c}% ${d}% ${100 - d}% ${100 - c}%`;
}

/**
 * The product as the hero of the page, lit like a 2026 studio shot. Cutouts stand on a set:
 * an ambient glow in the product's own hue (--lp-stage-glow), a backdrop with a soft top light and a
 * 1px rim, a floor pool and a two-layer contact shadow sized to the product footprint
 * (--lp-shadow-product under it, --lp-shadow-product-filter on the cutout), hovering gently on
 * lively pages.
 *
 *   arch   — tall arch backdrop; the product rises out of its top edge
 *   halo   — glow disc framed by concentric hairline rings with an orbiting bead
 *   slab   — a large rounded panel set at the archetype's tilt
 *   blob   — a smooth seeded organic shape that slowly morphs
 *   podium — a lit cylinder plinth in front of a niche (soft archetypes) or panel
 *   frame  — a frosted glass panel the product breaks out of
 *   none   — light, floor and shadow only
 *
 * Regular photos become large masked media with a soft shadow instead (arch window, circle with a
 * ring, tilted rounded slab, blob, glass mat). Layering contract (sections rely on it): the set
 * paints at z-index −2 inside the stage's own stacking context, so overlay children with z-index −1
 * (a giant background word) slide between the set and the product; `.lp-stage__over` sits on top.
 */
export function ProductStage({
  ctx,
  stage,
  asset,
  priority = false,
  size = "l",
  sizes,
  ratio,
  alt,
  seedKey = "stage",
  animate = true,
  float = true,
  rings,
  className,
  children,
}: ProductStageProps): ReactElement {
  const visual = resolveProductVisual(ctx, asset);
  const kind = visual.kind;
  const cutout = kind === "cutout";
  const stageRatio = safeRatio(ratio);
  const R = ratioValue(stageRatio) ?? 0.8;
  const geo = CUTOUT[stage];
  // contact shadow ≈ the product's footprint: its aspect against the product box of this stage
  let shadowW: number | undefined;
  if (cutout && visual.asset && visual.asset.height > 0) {
    const [pi, pt, pb] = geo.product;
    const boxAspect = (R * (1 - 2 * pi)) / (1 - pt - pb);
    const fill = Math.min(1, visual.asset.width / visual.asset.height / boxAspect);
    // the measured footprint (where the product meets the floor) when the upload analysed it: a
    // massage gun stands on its narrow handle, a jar on its full width
    const foot = visual.asset.foot;
    const footW = foot && foot[1] > foot[0] ? clamp((foot[1] - foot[0]) * 1.15, 0.3, 1) : 0.82;
    shadowW = round(clamp(fill * footW, 0.2, 0.9), 3);
  }
  // regular photos: fitted to the stage's window (mask + aspect)
  const photoFrame: PictureFrame | undefined =
    kind === "photo" ? { shape: PHOTO_WINDOW[stage].shape, ratio: round(PHOTO_WINDOW[stage].ratio(R), 4) } : undefined;
  const rng = ctx.rng(`stage:${seedKey}`);
  const blob = stage === "blob" ? blobRadius(rng) : undefined;
  const blob2 = stage === "blob" ? blobRadius(rng) : undefined;
  const niche = stage === "podium" && NICHE.has(ctx.archetype);
  const archBox: Box | null = cutout
    ? stage === "arch"
      ? geo.shape
      : niche
        ? geo.shape
        : null
    : stage === "arch"
      ? PHOTO_ARCH
      : null;
  const showRings = rings ?? stage === "halo";
  const style = cssVars({
    "--stage-ratio": stageRatio,
    // padding fallback for engines without aspect-ratio (Safari 14)
    "--stage-pad": `${round(100 / R, 2)}%`,
    "--arch-ry": archBox ? archRy(R, archBox) : undefined,
    "--blob": blob,
    "--blob-2": blob2,
    "--stage-rot": stage === "slab" ? `${seededRotation(ctx, `stage:${seedKey}`, 0.7)}deg` : undefined,
    "--shadow-w": shadowW,
  });
  const productReveal = !animate || priority ? undefined : cutout ? "rise" : stage === "arch" ? "mask-arch" : "scale-in";
  return (
    <div
      className={cx("lp-stage", className)}
      data-stage={stage}
      data-kind={kind}
      data-size={size}
      data-backdrop={stage === "podium" ? (niche ? "niche" : "panel") : undefined}
      data-rings={showRings ? "" : undefined}
      data-float={cutout && float ? "" : undefined}
      style={style}
    >
      <div className="lp-stage__set" aria-hidden="true" {...reveal(animate && "fade")}>
        <span className="lp-stage__glow" />
        {cutout ? <CutoutSet stage={stage} /> : <PhotoSet stage={stage} />}
        {showRings ? (
          <span className="lp-stage__rings">
            <span className="lp-stage__ring" />
            <span className="lp-stage__ring" />
            <span className="lp-stage__bead" />
          </span>
        ) : null}
      </div>
      <div className="lp-stage__product" {...reveal(productReveal, 140)}>
        {cutout ? <span className="lp-stage__shadow" aria-hidden="true" /> : null}
        <div className="lp-stage__float">
          <Picture
            asset={visual.asset}
            sizes={sizes ?? SIZES[size]}
            priority={priority}
            fit={cutout ? "contain" : "cover"}
            frame={photoFrame}
            className="lp-stage__pic"
            alt={alt ?? (visual.asset?.alt || ctx.product.name)}
          />
        </div>
      </div>
      {children ? <div className="lp-stage__over">{children}</div> : null}
    </div>
  );
}

/** Backdrop, floor pool (or plinth) behind a transparent cutout. */
function CutoutSet({ stage }: { stage: StageKind }): ReactNode {
  if (stage === "none") return <span className="lp-stage__floor" />;
  return (
    <>
      <span className="lp-stage__shape" />
      {stage === "podium" ? <span className="lp-stage__plinth" /> : <span className="lp-stage__floor" />}
    </>
  );
}

/** Decoration behind a regular photo (the photo itself is masked in CSS). */
function PhotoSet({ stage }: { stage: StageKind }): ReactNode {
  return stage === "frame" ? <span className="lp-stage__shape" /> : null;
}
