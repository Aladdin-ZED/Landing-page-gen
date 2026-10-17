"use client";
/**
 * "Products on this page" (docs/OFFERS.md §H.4): item tiles (photo, short name, price) — tapping one
 * adds a piece to the offer being edited — and an inline "New product" (name, price, photo) that
 * creates an item without leaving the Offers panel. Needs the MULTI_ITEM editor feature.
 */
import { ImagePlus, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { CroppedImg } from "@/components/admin/items/crop-dialog";
import { newItem } from "@/components/admin/items/model";
import type { PhotoSource } from "@/components/admin/items/photo-well";
import { MoneyInput } from "@/components/admin/variants/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { itemShort, itemVisual } from "@/lib/page/catalog";
import { formatMoney } from "@/lib/markets/money";
import { LIMITS, type AssetRef, type Item, type PageDoc } from "@/lib/page/schema";
import { cn } from "@/lib/utils";

export function Shelf({
  doc,
  photos,
  onTap,
  onCreate,
  tapHint,
}: {
  doc: Pick<PageDoc, "items" | "product" | "currency">;
  photos: PhotoSource;
  /** a tile was tapped (null: no offer is open) */
  onTap: ((itemId: string) => void) | null;
  onCreate: (item: Item) => void;
  tapHint: string;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [photo, setPhoto] = useState<AssetRef | null>(null);
  const ids = { name: useId() };
  const full = doc.items.length >= LIMITS.items;
  const ok = name.trim() && (price ?? 0) > 0;
  const create = () => {
    if (!ok) return;
    onCreate(newItem({ name: name.trim(), price: price!, images: photo ? [photo] : [], taken: doc.items.map((x) => x.id) }));
    setAdding(false);
    setName("");
    setPrice(undefined);
    setPhoto(null);
  };
  const photoInfo = photo ? photos.info(photo.id) : null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 adm-scroll" role="list" aria-label="Products on this page">
        {doc.items.map((it) => {
          const v = itemVisual(doc, it, { asset: (r) => (r && photos.info(r.id)?.url ? ({ id: r.id } as never) : null) });
          const info = v.ref ? photos.info(v.ref.id) : null;
          return (
            <button
              key={it.id}
              type="button"
              role="listitem"
              onClick={() => onTap?.(it.id)}
              title={onTap ? `Add a piece of ${itemShort(doc, it)} to the open offer` : tapHint}
              className={cn(
                "grid w-[4.25rem] shrink-0 gap-1 rounded-xl p-1.5 text-start ring-1 ring-inset ring-foreground/[0.07] outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
                onTap ? "hover:bg-brand-soft/45 hover:ring-brand/30" : "cursor-default",
                it.soldOut && "opacity-55",
              )}
            >
              <span className="relative block aspect-square overflow-hidden rounded-lg bg-muted">
                {info?.url ? <CroppedImg src={info.url} box={v.box} ratio={info.width / Math.max(1, info.height)} className="size-full" /> : <span className="grid size-full place-items-center text-[15px] font-semibold text-muted-foreground">{itemShort(doc, it).slice(0, 1)}</span>}
                {onTap ? (
                  <span className="absolute end-1 bottom-1 grid size-5 place-items-center rounded-full bg-background text-foreground shadow-sm">
                    <Plus className="size-3" />
                  </span>
                ) : null}
              </span>
              <bdi className="truncate text-[11px] font-medium" dir="auto">
                {itemShort(doc, it)}
              </bdi>
              <span className="text-[10.5px] text-muted-foreground tabular-nums">{formatMoney(it.price, doc.currency, "en")}</span>
            </button>
          );
        })}
        {!full ? (
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            aria-expanded={adding}
            className="grid w-14 shrink-0 place-content-center justify-items-center gap-1 rounded-xl border border-dashed border-foreground/20 p-1.5 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:border-brand/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <Plus className="size-4" />
            New
          </button>
        ) : null}
      </div>
      {adding ? (
        <form
          className="grid gap-2 rounded-xl bg-foreground/[0.025] p-2.5 ring-1 ring-inset ring-foreground/[0.06]"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="grid grid-cols-[auto_minmax(0,1fr)_6.5rem] items-end gap-2">
            <button
              type="button"
              aria-label={photo ? "Change the photo" : "Pick a photo"}
              disabled={!photos.pick && !photos.photos.length}
              onClick={async () => {
                const ref = photos.pick ? await photos.pick("Photo of the new product") : (photos.photos[0]?.ref ?? null);
                if (ref) setPhoto(ref);
              }}
              className="grid size-8 place-items-center overflow-hidden rounded-lg bg-background text-muted-foreground ring-1 ring-foreground/12 outline-none hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {photoInfo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                <img src={photoInfo.url} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
            </button>
            <div className="grid gap-1">
              <label htmlFor={ids.name} className="text-[11px] font-medium text-foreground/80">
                Name
              </label>
              <Input id={ids.name} dir="auto" autoFocus value={name} maxLength={120} placeholder="e.g. Sérum éclat" onChange={(e) => setName(e.target.value)} className="h-8 text-[12.5px]" />
            </div>
            <div className="grid gap-1">
              <span className="text-[11px] font-medium text-foreground/80">Price</span>
              <MoneyInput value={price} optional currency={doc.currency} ariaLabel="Price of the new product" onCommit={setPrice} />
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              <X />
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!ok}>
              <Plus />
              Create product
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
