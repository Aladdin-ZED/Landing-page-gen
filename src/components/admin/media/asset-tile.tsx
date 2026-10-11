"use client";

import { CheckIcon, FilmIcon, ScissorsIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { useFocalInfo } from "./focal/focal-client";
import { cropStyle, previewCrop } from "./focal/frames";
import { focalFromTags } from "./focal/tags";
import type { MediaAsset } from "./media-client";

/** Subtle checkerboard that reveals transparency (cutouts). */
export const CHECKER =
  "bg-[conic-gradient(color-mix(in_oklab,var(--foreground)_6%,transparent)_25%,transparent_0_50%,color-mix(in_oklab,var(--foreground)_6%,transparent)_0_75%,transparent_0)] bg-[length:14px_14px]";

/**
 * A square tile crops the photo the way pages crop a square frame: the team's default point, else
 * the subject analysis (heads kept whole, a product's top kept). Photos not analysed yet are
 * analysed on first view (lazily, once the tile is on screen).
 */
function useTileCrop(asset: MediaAsset, box: RefObject<HTMLDivElement | null>) {
  const saved = focalFromTags(asset.tags);
  const image = asset.kind === "image" && !asset.alpha && asset.width > 0 && asset.height > 0;
  const wants = image && !saved && !asset.focus;
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!wants || seen || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wants, seen, box]);
  const { info } = useFocalInfo(wants && seen ? asset.id : null);
  const focus = asset.focus ?? info?.focus ?? null;
  return image && (saved || focus) ? cropStyle(previewCrop("rounded", asset.width / asset.height, focus, saved, false)) : undefined;
}

/** Square media tile: soft dominant-color backdrop, cutouts on a checkerboard, kind badges. */
export function AssetTile({
  asset,
  selected = false,
  onClick,
  onDoubleClick,
  overlay,
  className,
  style,
}: {
  asset: MediaAsset;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  /** extra controls over the picture (hover actions) */
  overlay?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const isVideo = asset.kind === "video";
  const tile = useRef<HTMLDivElement>(null);
  const crop = useTileCrop(asset, tile);
  return (
    <div
      ref={tile}
      className={cn(
        "group/tile relative overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/[0.06] transition-all duration-300 ring-inset",
        "hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.45)]",
        selected && "ring-2 ring-brand shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_18%,transparent)]",
        className,
      )}
      style={style}
    >
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        aria-pressed={onDoubleClick ? selected : undefined}
        aria-label={asset.originalName ?? `${asset.kind} ${asset.width}×${asset.height}`}
        className="relative block aspect-square w-full outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset"
        style={!asset.alpha ? { backgroundColor: `color-mix(in oklab, ${asset.dominant} 30%, var(--muted))` } : undefined}
      >
        {asset.alpha && <span aria-hidden="true" className={cn("absolute inset-0", CHECKER)} />}
        {isVideo ? (
          <video src={asset.url ?? undefined} muted playsInline preload="metadata" className="absolute inset-0 size-full object-cover" />
        ) : asset.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- media variants are pre-optimized
          <img
            src={asset.thumbUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={asset.width}
            height={asset.height}
            className={cn(
              "absolute inset-0 size-full transition-[transform,object-position] duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover/tile:scale-[1.04]",
              asset.alpha ? "object-contain p-3 drop-shadow-[0_10px_14px_rgb(0_0_0/0.18)]" : "object-cover",
            )}
            style={crop}
          />
        ) : null}
      </button>
      <span className="pointer-events-none absolute start-2 top-2 flex gap-1">
        {isVideo && (
          <span className="adm-glass inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.68rem] font-medium">
            <FilmIcon className="size-3" /> Video
          </span>
        )}
        {asset.alpha && (
          <span className="adm-glass inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.68rem] font-medium">
            <ScissorsIcon className="size-3" /> Cutout
          </span>
        )}
      </span>
      {selected && (
        <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md">
          <CheckIcon className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {overlay}
    </div>
  );
}
