"use client";
/**
 * The offer's composed visual in miniature (docs/OFFERS.md §E.6) for the editors: the same plan the
 * landing page renders (`visualPlan`) — copies (depth stack + ×n), choice ("ou" chip, the second
 * item peeking), duo / trio / grid with "+" joins, custom photos (lead + side, row, grid), gift
 * chips on free tiles and monogram tiles for products without a photo. Group photos are always
 * contained, never cover-cropped; crops render through their box.
 */
import { Gift } from "lucide-react";
import { itemName, itemVisual, visualPlan, type VisualTile } from "@/lib/page/catalog";
import type { AssetRef, Item, Locale, Offer, PageDoc } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { CroppedImg } from "@/components/admin/items/crop-dialog";
import type { PhotoSource } from "@/components/admin/items/photo-well";

const OR: Partial<Record<Locale, string>> = { fr: "ou", ar: "أو", en: "or", es: "o", de: "oder", it: "o", nl: "of", pt: "ou" };

type VisualDoc = Pick<PageDoc, "items" | "product" | "locale">;

function Photo({ refAt, source, className, contain }: { refAt: AssetRef | undefined; source: PhotoSource; className?: string; contain?: boolean }) {
  const info = refAt ? source.info(refAt.id) : null;
  if (!info?.url) return <span className={cn("block bg-muted", className)} />;
  if (contain && !refAt?.box) {
    return (
      <span className={cn("grid place-items-center overflow-hidden bg-[color-mix(in_oklab,var(--foreground)_5%,var(--background))]", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- media-library rendition */}
        <img src={info.url} alt="" draggable={false} className="size-full object-contain" />
      </span>
    );
  }
  return <CroppedImg src={info.url} box={refAt?.box} ratio={info.width / Math.max(1, info.height)} className={className} />;
}

function ItemTile({ doc, item, source, className }: { doc: VisualDoc; item: Item | undefined; source: PhotoSource; className?: string }) {
  if (!item) return <span className={cn("block bg-muted", className)} />;
  const v = itemVisual(doc, item, { asset: (r) => (r && source.info(r.id)?.url ? ({ id: r.id } as never) : null) });
  if (!v.ref) {
    return (
      <span className={cn("grid place-items-center bg-[color-mix(in_oklab,var(--foreground)_6%,var(--background))] font-display font-semibold text-muted-foreground", className)}>
        {itemName(doc, item).slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return <Photo refAt={v.ref} source={source} className={className} contain={v.kind === "cutout"} />;
}

const Join = ({ children, size }: { children: React.ReactNode; size: "sm" | "md" }) => (
  <span
    aria-hidden="true"
    className={cn(
      "absolute top-1/2 z-10 grid -translate-y-1/2 place-items-center rounded-full bg-background font-semibold text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.2)] ring-1 ring-foreground/10",
      size === "sm" ? "size-4 text-[9px]" : "size-6 text-[11px]",
    )}
  >
    {children}
  </span>
);

export function MiniVisual({ doc, offer, source, size = "sm", className }: { doc: VisualDoc; offer: Pick<Offer, "lines" | "visual" | "gift">; source: PhotoSource; size?: "sm" | "md"; className?: string }) {
  const plan = visualPlan(doc, offer);
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const r = size === "sm" ? "rounded-[8px]" : "rounded-xl";
  const qty = (n: number) =>
    n > 1 ? (
      <span className={cn("absolute end-1 bottom-1 z-10 rounded-full bg-foreground/85 px-1.5 font-semibold text-background tabular-nums", size === "sm" ? "text-[9px] leading-4" : "text-[11px] leading-5")}>
        <bdi dir="ltr">×{n}</bdi>
      </span>
    ) : null;
  const gift = (t: VisualTile) =>
    t.free ? (
      <span className={cn("absolute start-1 top-1 z-10 grid place-items-center rounded-full bg-background text-brand shadow-sm", size === "sm" ? "size-4 [&_svg]:size-2.5" : "size-5 [&_svg]:size-3")}>
        <Gift />
      </span>
    ) : null;

  let body: React.ReactNode;
  if (plan.mode === "custom") {
    const imgs = plan.images ?? [];
    if (imgs.length === 1) body = <Photo refAt={imgs[0]} source={source} contain className={cn("size-full", r)} />;
    else if (imgs.length === 2 && plan.arrange !== "row" && plan.arrange !== "grid") {
      body = (
        <span className="relative flex size-full gap-[3px]">
          <Photo refAt={imgs[0]} source={source} contain className={cn("h-full w-2/3", r)} />
          <Photo refAt={imgs[1]} source={source} contain className={cn("h-full w-1/3", r)} />
          <span className="absolute start-2/3 top-1/2 -translate-x-1/2 rtl:translate-x-1/2">
            <Join size={size}>+</Join>
          </span>
        </span>
      );
    } else {
      body = (
        <span className={cn("grid size-full gap-[3px]", imgs.length > 2 ? "grid-cols-2 grid-rows-2" : "grid-cols-2")}>
          {imgs.slice(0, 4).map((im, i) => (
            <Photo key={`${im.id}:${i}`} refAt={im} source={source} contain className={cn("size-full", r, imgs.length === 3 && i === 0 && "row-span-2")} />
          ))}
        </span>
      );
    }
  } else if (plan.mode === "copies") {
    const t = plan.tiles[0] as Extract<VisualTile, { kind: "item" }>;
    const n = Math.min(3, t.qty);
    body = (
      <span className="relative block size-full">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="absolute inset-0" style={{ transform: `translate(${(n - 1 - i) * -6}%, ${(n - 1 - i) * -6}%) scale(${1 - (n - 1 - i) * 0.08})`, zIndex: i, opacity: i === n - 1 ? 1 : 0.85 }}>
            <ItemTile doc={doc} item={byId.get(t.item)} source={source} className={cn("size-full shadow-[0_2px_6px_rgb(0_0_0/0.15)]", r)} />
          </span>
        ))}
        {qty(t.qty)}
        {gift(t)}
      </span>
    );
  } else if (plan.mode === "choice") {
    const t = plan.tiles[0] as Extract<VisualTile, { kind: "choice" }>;
    const list = t.items.slice(0, 4);
    body = (
      <span className="relative block size-full">
        {list.length === 2 ? (
          <>
            <span className="absolute inset-y-[8%] end-0 w-[62%] opacity-80">
              <ItemTile doc={doc} item={byId.get(list[1]!)} source={source} className={cn("size-full", r)} />
            </span>
            <span className="absolute inset-y-0 start-0 w-[66%] shadow-[0_4px_10px_-2px_rgb(0_0_0/0.25)]">
              <ItemTile doc={doc} item={byId.get(list[0]!)} source={source} className={cn("size-full", r)} />
            </span>
            <span className="absolute start-[66%] top-1/2 -translate-x-1/2 rtl:translate-x-1/2">
              <Join size={size}>{OR[doc.locale] ?? "or"}</Join>
            </span>
          </>
        ) : (
          list.map((id, i) => (
            <span key={id} className="absolute inset-y-[6%] w-[52%] shadow-[0_3px_8px_-2px_rgb(0_0_0/0.25)]" style={{ insetInlineStart: `${(i * 48) / Math.max(1, list.length - 1)}%`, transform: `rotate(${(i - (list.length - 1) / 2) * 6}deg)`, zIndex: i }}>
              <ItemTile doc={doc} item={byId.get(id)} source={source} className={cn("size-full", r)} />
            </span>
          ))
        )}
        {t.items.length > 4 ? <span className="absolute end-1 top-1 z-10 rounded-full bg-background px-1 text-[9px] font-semibold">+{t.items.length - 4}</span> : null}
        {qty(t.qty)}
        {gift(t)}
      </span>
    );
  } else {
    const tiles = plan.tiles.slice(0, plan.mode === "grid" ? 4 : 3);
    const grid = plan.mode === "grid";
    body = (
      <span className={cn("relative grid size-full gap-[3px]", grid ? "grid-cols-2 grid-rows-2" : plan.mode === "trio" ? "grid-cols-3" : "grid-cols-2")}>
        {tiles.map((t, i) => (
          <span key={i} className="relative min-w-0">
            {t.kind === "item" ? <ItemTile doc={doc} item={byId.get(t.item)} source={source} className={cn("size-full", r)} /> : <ItemTile doc={doc} item={byId.get(t.items[0]!)} source={source} className={cn("size-full", r)} />}
            {qty(t.qty)}
            {gift(t)}
            {!grid && i > 0 ? (
              <span className="absolute start-0 top-1/2 -translate-x-1/2 rtl:translate-x-1/2">
                <Join size={size}>+</Join>
              </span>
            ) : null}
          </span>
        ))}
        {grid && plan.tiles.length > 4 ? <span className="absolute end-1 bottom-1 z-10 rounded-full bg-foreground/85 px-1.5 text-[9px] font-semibold text-background">+{plan.tiles.length - 4}</span> : null}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn("relative block shrink-0 overflow-visible", className)}>
      {body}
    </span>
  );
}
