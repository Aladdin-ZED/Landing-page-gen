"use client";
/**
 * An item's photo well (docs/OFFERS.md §B.4): tap the page's photos this product appears in (or
 * pick one from the library). A photo picked uncropped by 2+ products is a GROUP photo — offered as
 * the combo visual, never as one product's own picture — so the well offers "Crop {item} from this
 * photo" on it: the crop becomes the product's own photo (its first, so it leads).
 */
import { Check, Crop, ImagePlus, Layers, X } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LIMITS, type AssetRef, type CropBox, type Item } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { CropDialog, CroppedImg } from "./crop-dialog";
import { groupPhotoIds, hasOwnPhoto, togglePhoto, withCrop, withoutCrop } from "./model";

export interface PhotoInfo {
  ref: AssetRef;
  /** thumbnail */
  url: string | null;
  /** large rendition (crop dialog) */
  large?: string | null;
  width: number;
  height: number;
}

export interface PhotoSource {
  /** the page's product photos: the wells pick among them */
  photos: readonly PhotoInfo[];
  /** any asset by id (a photo picked from the library) */
  info(id: string): PhotoInfo | null;
  /** media library picker */
  pick?(title: string): Promise<AssetRef | null>;
}

export function PhotoWell({
  item,
  items,
  name,
  source,
  onChange,
  compact,
}: {
  item: Item;
  items: readonly Item[];
  /** the item's display name (crop titles) */
  name: string;
  source: PhotoSource;
  onChange: (next: Item) => void;
  compact: boolean;
}) {
  const [crop, setCrop] = useState<{ ref: AssetRef; box: CropBox | null } | null>(null);
  const group = groupPhotoIds(items);
  const own = hasOwnPhoto(item, items);
  const crops = item.images.filter((r) => r.box);
  const picked = new Set(item.images.filter((r) => !r.box).map((r) => r.id));
  const library = item.images.filter((r) => !r.box && !source.photos.some((p) => p.ref.id === r.id));
  const tiles: PhotoInfo[] = [...source.photos, ...library.map((r) => source.info(r.id) ?? { ref: r, url: null, width: 1, height: 1 })];
  const index = items.findIndex((x) => x.id === item.id);
  const full = item.images.length >= LIMITS.itemPhotos;
  const cropInfo = crop ? (source.info(crop.ref.id) ?? tiles.find((t) => t.ref.id === crop.ref.id) ?? null) : null;
  const size = compact ? "size-14" : "size-[4.5rem]";
  const groupPicked = tiles.filter((t) => picked.has(t.ref.id) && group.has(t.ref.id));

  return (
    <div className="grid gap-2">
      <div role="group" aria-label={`Photos of ${name}`} className="flex flex-wrap gap-2">
        {crops.map((r) => {
          const info = source.info(r.id) ?? tiles.find((t) => t.ref.id === r.id);
          return (
            <div key={`crop:${r.id}`} className={cn("group/tile relative shrink-0 overflow-hidden rounded-xl ring-2 ring-brand", size)}>
              <button type="button" aria-label={`Edit the crop of ${name}`} onClick={() => setCrop({ ref: r, box: r.box ?? null })} className="block size-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <CroppedImg src={info?.url ?? null} box={r.box} ratio={(info?.width ?? 1) / (info?.height ?? 1)} className="size-full" />
              </button>
              <span className="pointer-events-none absolute start-1 top-1 grid size-5 place-items-center rounded-full bg-brand text-brand-foreground shadow-sm [&_svg]:size-3">
                <Crop />
              </span>
              <button
                type="button"
                aria-label="Remove this crop"
                onClick={() => onChange(withoutCrop(item, r.id))}
                className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm outline-none transition-opacity group-hover/tile:opacity-100 focus-visible:opacity-100 [&_svg]:size-3"
              >
                <X />
              </button>
            </div>
          );
        })}
        {tiles.map((t) => {
          const on = picked.has(t.ref.id);
          const isGroup = on && group.has(t.ref.id);
          const sharedWith = items.filter((x) => x.id !== item.id && x.images.some((r) => r.id === t.ref.id && !r.box)).length;
          return (
            <div key={t.ref.id} className={cn("group/tile relative shrink-0", size)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`${on ? "Remove" : "Add"} this photo ${on ? "from" : "to"} ${name}${sharedWith ? ` (also in ${sharedWith} other product${sharedWith === 1 ? "" : "s"})` : ""}`}
                    disabled={!on && full}
                    onClick={() => onChange(togglePhoto(item, t.ref))}
                    className={cn(
                      "relative block size-full overflow-hidden rounded-xl bg-muted outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
                      on ? "ring-2 ring-foreground/70" : "opacity-55 ring-1 ring-foreground/10 hover:opacity-100",
                    )}
                  >
                    {t.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                      <img src={t.url} alt="" draggable={false} className="size-full object-cover" />
                    ) : null}
                    {on ? (
                      <span className="absolute end-1 top-1 grid size-5 place-items-center rounded-full bg-foreground text-background shadow-sm [&_svg]:size-3">
                        <Check />
                      </span>
                    ) : null}
                    {isGroup ? (
                      <span className="absolute start-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-background/90 px-1.5 py-0.5 text-[9.5px] font-semibold text-foreground shadow-sm [&_svg]:size-2.5">
                        <Layers />
                        Group
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-pretty">
                  {isGroup ? "A group photo: it shows several products, so it is used for the combos, not as this product's own photo." : on ? "In this product's photos" : "Tap to add it to this product's photos"}
                </TooltipContent>
              </Tooltip>
              {isGroup ? (
                <button
                  type="button"
                  onClick={() => setCrop({ ref: t.ref, box: null })}
                  aria-label={`Crop ${name} from this photo`}
                  className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full bg-brand text-brand-foreground shadow-md ring-2 ring-background outline-none transition-transform hover:scale-105 focus-visible:ring-ring [&_svg]:size-3.5"
                >
                  <Crop />
                </button>
              ) : null}
            </div>
          );
        })}
        {source.pick ? (
          <button
            type="button"
            disabled={full}
            onClick={async () => {
              const ref = await source.pick!(`Photo of ${name}`);
              if (ref) onChange(togglePhoto(item, ref));
            }}
            className={cn(
              "grid shrink-0 place-items-center rounded-xl border border-dashed border-foreground/20 text-muted-foreground outline-none transition-colors hover:border-brand/50 hover:bg-brand-soft/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 [&_svg]:size-4",
              size,
            )}
            aria-label="Add a photo from the library"
          >
            <ImagePlus />
          </button>
        ) : null}
      </div>
      {!own && groupPicked.length ? (
        <button
          type="button"
          onClick={() => setCrop({ ref: groupPicked[0]!.ref, box: null })}
          className="inline-flex items-center gap-1.5 justify-self-start rounded-full bg-brand-soft px-3 py-1.5 text-[12px] font-medium text-brand outline-none transition-colors hover:bg-brand-soft/70 focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:size-3.5"
        >
          <Crop />
          Crop <bdi>{name}</bdi> from this photo
        </button>
      ) : !item.images.length ? (
        <p className="text-[11.5px] leading-snug text-muted-foreground">Tap the photos this product appears in. A photo shared by two products becomes their group photo.</p>
      ) : null}

      {crop ? (
        <CropDialog
          open
          onOpenChange={(o) => !o && setCrop(null)}
          src={cropInfo?.large ?? cropInfo?.url ?? null}
          width={cropInfo?.width ?? 1}
          height={cropInfo?.height ?? 1}
          value={crop.box}
          // the owner's case: two products side by side — the first starts on the left half
          initial={index === 0 ? { x: 0.02, y: 0.04, w: 0.48, h: 0.92 } : { x: 0.5, y: 0.04, w: 0.48, h: 0.92 }}
          title={`Crop ${name} from this photo`}
          onDone={(box) => onChange(withCrop(item, crop.ref, box, name))}
          onRemove={crop.box ? () => onChange(withoutCrop(item, crop.ref.id)) : undefined}
        />
      ) : null}
    </div>
  );
}
