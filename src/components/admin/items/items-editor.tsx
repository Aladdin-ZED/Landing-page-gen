"use client";
/**
 * "What you sell" (docs/OFFERS.md §B, §H.2, §H.3): one card per item — photo well with crops, name,
 * short name with its Google Sheets preview, price, compare-at, SKU, sold out and its options — for
 * the generate wizard's Offers step and the builder's "Product & items" panel.
 *
 * Several products need the MULTI_ITEM editor feature. Going from one product to two asks for the
 * first one's name (prefilled with the product name: with 2+ items every item is named). Cards
 * reorder freely (dnd-kit, handle + keyboard: content ids follow the id, never the position); the
 * menu has Show first, Duplicate, Copy options from… and Delete, which lists the offers, bump and
 * upsell using the product and removes their lines on confirm.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpToLine, ChevronDown, Copy, CopyPlus, GripVertical, Layers, MoreHorizontal, PackagePlus, Plus, Sheet, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DraftInput, MoneyInput, VariantsEditor, type Rekey, type VariantPhoto } from "@/components/admin/variants";
import { EASE } from "@/components/admin/variants/parts";
import { itemName, itemShort, offerName } from "@/lib/page/catalog";
import { feature } from "@/lib/page/features";
import { formatMoney } from "@/lib/markets/money";
import { LIMITS, type Item, type Locale, type Offers } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { CroppedImg } from "./crop-dialog";
import { copyOptions, duplicateItem, groupPhotoIds, inChoiceLine, hasOwnPhoto, itemUsage, newItem, pruneRules, rekeyRules, removeItem, showFirst } from "./model";
import { PhotoWell, type PhotoSource } from "./photo-well";

export interface ItemsChange {
  items: Item[];
  /** offers changed with the items (delete cascade, rule keys after a merge / split) */
  offers?: Offers;
}

export interface ItemsEditorProps {
  items: readonly Item[];
  /** the page's offers: usage on delete and the cascade (absent in the wizard while offers are automatic) */
  offers?: Offers;
  onChange: (next: ItemsChange, coalesce?: string | null) => void;
  locale: Locale;
  currency: string;
  /** the page's product name: a single item's name falls back to it */
  productName: string;
  photos: PhotoSource;
  density?: "comfortable" | "compact";
  /** free reorder (builder) */
  reorder?: boolean;
  /** the lead's price and options are edited elsewhere (wizard Details step) */
  leadElsewhere?: boolean;
  /** photo palettes for the options' color suggestions */
  palettes?: Readonly<Record<string, VariantPhoto["palette"]>>;
}

export function ItemsEditor(p: ItemsEditorProps) {
  const { items, onChange } = p;
  const compact = (p.density ?? "comfortable") === "compact";
  const multi = feature("MULTI_ITEM");
  const [open, setOpen] = useState<string | null>(items.length === 1 ? (items[0]?.id ?? null) : null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Item | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId();
  const doc = useMemo(() => ({ items: [...items], product: { name: p.productName } as never }), [items, p.productName]);
  const offers = p.offers;

  const setItem = (id: string, next: Item, coalesce?: string | null) => {
    const list = items.map((it) => (it.id === id ? next : it));
    // options edited: rules naming removed options are dropped from the offers
    const groupsChanged = items.find((it) => it.id === id)?.groups !== next.groups;
    onChange(groupsChanged && offers ? { items: list, offers: { ...offers, bundles: pruneRules(offers.bundles, list) } } : { items: list }, coalesce);
  };
  const onRekey = (id: string, rekey: Rekey) => {
    if (offers) onChange({ items: [...items], offers: { ...offers, bundles: rekeyRules(offers.bundles, id, rekey) } });
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((x) => x.id === e.active.id);
    const to = items.findIndex((x) => x.id === e.over!.id);
    if (from >= 0 && to >= 0) onChange({ items: arrayMove([...items], from, to) });
  };

  const cards = items.map((it, i) => (
    <ItemCard
      key={it.id}
      item={it}
      index={i}
      p={p}
      doc={doc}
      open={open === it.id}
      onToggle={() => setOpen((o) => (o === it.id ? null : it.id))}
      onChange={(next, coalesce) => setItem(it.id, next, coalesce)}
      onRekey={(rk) => onRekey(it.id, rk)}
      onShowFirst={() => onChange({ items: showFirst(items, it.id) })}
      onDuplicate={() => {
        const next = duplicateItem(items, it.id);
        if (next) {
          onChange({ items: next });
          setOpen(next[i + 1]?.id ?? null);
        }
      }}
      onCopyFrom={(fromId) => {
        const from = items.find((x) => x.id === fromId);
        if (from) setItem(it.id, copyOptions(from, it));
      }}
      onRemove={() => setRemoving(it)}
      sortable={!!p.reorder && items.length > 1}
      multi={multi}
    />
  ));

  return (
    <div className={cn("grid", compact ? "gap-2.5" : "gap-3")}>
      {p.reorder && items.length > 1 ? (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            <ul className={cn("grid grid-cols-1", compact ? "gap-2.5" : "gap-3")}>{cards}</ul>
          </SortableContext>
        </DndContext>
      ) : (
        <ul className={cn("grid grid-cols-1", compact ? "gap-2.5" : "gap-3")}>{cards}</ul>
      )}

      {multi && items.length < LIMITS.items ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/[0.18] font-medium text-muted-foreground outline-none transition-colors hover:border-brand/45 hover:bg-brand-soft/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 [&_svg]:size-4",
            compact ? "h-10 text-[12.5px]" : "h-12 text-[13.5px]",
          )}
        >
          <PackagePlus />
          {items.length === 1 ? "Sell another product on this page" : "Add a product"}
          <span className="text-[11px] font-normal tabular-nums opacity-70">
            {items.length}/{LIMITS.items}
          </span>
        </button>
      ) : null}

      {adding ? (
      <AddItemDialog
        open
        onOpenChange={setAdding}
        first={items.length === 1 ? items[0]! : null}
        productName={p.productName}
        currency={p.currency}
        onAdd={(name, price, firstName) => {
          const list = items.map((it, i) => (i === 0 && firstName !== undefined ? { ...it, name: firstName } : it));
          const it = newItem({ name, price, taken: list.map((x) => x.id) });
          onChange({ items: [...list, it] });
          setOpen(it.id);
        }}
      />
      ) : null}
      <RemoveDialog
        item={removing}
        name={removing ? itemName(doc, removing) : ""}
        usage={removing && offers ? itemUsage(offers, removing.id) : null}
        offerLabel={(o) => offerName({ doc: { ...doc, locale: p.locale } }, o)}
        onOpenChange={(o) => !o && setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          if (offers) {
            const res = removeItem({ items, offers }, removing.id);
            if (res) onChange(res);
          } else onChange({ items: items.filter((x) => x.id !== removing.id) });
          toast(`${itemName(doc, removing)} removed`);
          setRemoving(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* card                                                                */
/* ------------------------------------------------------------------ */

function ItemCard({
  item,
  index,
  p,
  doc,
  open,
  onToggle,
  onChange,
  onRekey,
  onShowFirst,
  onDuplicate,
  onCopyFrom,
  onRemove,
  sortable,
  multi,
}: {
  item: Item;
  index: number;
  p: ItemsEditorProps;
  doc: { items: Item[]; product: never };
  open: boolean;
  onToggle: () => void;
  onChange: (next: Item, coalesce?: string | null) => void;
  onRekey: (rk: Rekey) => void;
  onShowFirst: () => void;
  onDuplicate: () => void;
  onCopyFrom: (id: string) => void;
  onRemove: () => void;
  sortable: boolean;
  multi: boolean;
}) {
  const compact = (p.density ?? "comfortable") === "compact";
  const items = p.items;
  const several = items.length > 1;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !sortable });
  const style = sortable ? { transform: CSS.Translate.toString(transform), transition } : undefined;
  const name = itemName({ items: doc.items, product: { name: p.productName } as never }, item);
  const short = itemShort({ items: doc.items, product: { name: p.productName } as never }, item);
  const money = (n: number) => formatMoney(n, p.currency, "en");
  const visual = item.images.find((r) => r.box) ?? item.images.find((r) => !groupPhotoIds(items).has(r.id)) ?? item.images[0];
  const info = visual ? p.photos.info(visual.id) : null;
  const leadElsewhere = !!p.leadElsewhere && index === 0;
  const needsPhoto = several && p.offers && inChoiceLine(p.offers.bundles, item.id) && !hasOwnPhoto(item, items);
  const ids = { short: useId(), compare: useId(), sku: useId(), sold: useId() };
  const variantPhotos = useMemo<VariantPhoto[]>(
    () => p.photos.photos.map((ph) => ({ ref: ph.ref, url: ph.url, palette: p.palettes?.[ph.ref.id] ?? null })),
    [p.photos.photos, p.palettes],
  );
  const priceControl = leadElsewhere ? (
    <span className="shrink-0 text-end text-[13px] font-semibold tabular-nums">{money(item.price)}</span>
  ) : (
    <MoneyInput value={item.price} currency={p.currency} ariaLabel={`Price of ${name}`} className={cn("shrink-0", compact ? "w-[6.5rem]" : "w-32")} onCommit={(v) => onChange({ ...item, price: v ?? 0 }, `item:${item.id}:price`)} />
  );
  const facts = [
    item.images.length ? `${item.images.length} photo${item.images.length === 1 ? "" : "s"}` : "No photo",
    item.groups.length ? `${item.groups.length} option${item.groups.length === 1 ? "" : "s"}` : null,
    item.soldOut ? "Sold out" : null,
  ].filter(Boolean);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative grid min-w-0 rounded-2xl bg-background ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-20px_rgb(0_0_0/0.22)] dark:bg-foreground/[0.03]",
        isDragging && "z-10 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35)] ring-brand/40",
        item.soldOut && "opacity-80",
      )}
    >
      <div className={cn("flex items-center", compact ? "gap-2 p-2.5" : "gap-3 p-3.5")}>
        {sortable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${name}`}
            className="-ms-1 grid h-8 w-5 shrink-0 cursor-grab place-items-center rounded-md text-muted-foreground/70 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing [&_svg]:size-4"
          >
            <GripVertical />
          </button>
        ) : null}
        <span className={cn("relative shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10", compact ? "size-11" : "size-14")}>
          {info?.url ? <CroppedImg src={info.url} box={visual?.box} ratio={info.width / info.height} className="size-full" /> : <span className="grid size-full place-items-center font-display text-[18px] font-semibold text-muted-foreground">{name.slice(0, 1).toUpperCase()}</span>}
          {index === 0 && several ? <span className="absolute inset-x-0 bottom-0 bg-foreground/75 py-px text-center text-[9px] font-semibold tracking-[0.06em] text-background uppercase">First</span> : null}
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <DraftInput
            dir="auto"
            value={item.name}
            maxLength={120}
            placeholder={several ? "Name this product" : p.productName || "Product name"}
            aria-label="Product name"
            aria-invalid={several && !item.name.trim() ? true : undefined}
            clean={(raw) => raw.replace(/\s+/g, " ").slice(0, 120)}
            onCommit={(v) => onChange({ ...item, name: v.trim() ? v : "" }, `item:${item.id}:name`)}
            className={cn(
              "border-transparent bg-transparent font-semibold tracking-[-0.01em] shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent",
              compact ? "h-8 px-2 text-[13px]" : "h-9 px-2.5 text-[15px]",
            )}
          />
          {/* compact (324 px panel): the price sits under the name, so the name keeps the width */}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-w-0 items-center gap-1.5 px-2 text-start text-[11.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
              <span className="truncate">{facts.join(" · ")}</span>
              <ChevronDown className={cn("size-3.5 shrink-0 transition-transform duration-300", open && "rotate-180")} />
            </button>
            {compact ? priceControl : null}
          </div>
        </div>
        {compact ? null : priceControl}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size={compact ? "icon-xs" : "icon-sm"} aria-label={`${name}: actions`} className="shrink-0 text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {multi && p.reorder ? (
              <DropdownMenuItem disabled={index === 0} onSelect={onShowFirst}>
                <ArrowUpToLine />
                Show first
              </DropdownMenuItem>
            ) : null}
            {multi ? (
              <DropdownMenuItem disabled={items.length >= LIMITS.items} onSelect={onDuplicate}>
                <CopyPlus />
                Duplicate
              </DropdownMenuItem>
            ) : null}
            {several ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Copy />
                  Copy options from…
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {items
                    .filter((x) => x.id !== item.id)
                    .map((x) => (
                      <DropdownMenuItem key={x.id} disabled={!x.groups.length} onSelect={() => onCopyFrom(x.id)}>
                        <bdi className="truncate">{itemName({ items: doc.items, product: { name: p.productName } as never }, x)}</bdi>
                        <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">{x.groups.length}</span>
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {several ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                  <Trash2 />
                  Delete product
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuLabel className="text-[11.5px] font-normal text-muted-foreground">A page sells at least one product.</DropdownMenuLabel>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {needsPhoto ? (
        <p className="mx-3.5 -mt-1 mb-3 flex items-center gap-1.5 rounded-lg bg-destructive/8 px-2.5 py-1.5 text-[11.5px] font-medium text-destructive">
          <Layers className="size-3.5 shrink-0" />
          Customers choose this product: give it a photo of its own (crop it from the group photo).
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
            <div className={cn("grid border-t border-foreground/[0.06]", compact ? "gap-3.5 px-3 pt-3 pb-3.5" : "gap-5 px-4 pt-4 pb-5")}>
              <Section title="Photos" hint="Tap the photos this product is in.">
                <PhotoWell item={item} items={items} name={name} source={p.photos} compact={compact} onChange={(next) => onChange(next)} />
              </Section>
              <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
                <Section title="Short name" htmlFor={ids.short}>
                  <DraftInput
                    id={ids.short}
                    dir="auto"
                    value={item.short ?? ""}
                    maxLength={40}
                    placeholder={name.slice(0, 40)}
                    clean={(raw) => raw.slice(0, 40)}
                    onCommit={(v) => {
                      const next = { ...item };
                      if (v.trim()) next.short = v.trim();
                      else delete next.short;
                      onChange(next, `item:${item.id}:short`);
                    }}
                    className="h-8 text-[13px]"
                  />
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Sheet className="size-3.5 shrink-0 text-brand" />
                    <span className="min-w-0 truncate">
                      In Google Sheets: <bdi className="font-medium text-foreground">{short}</bdi>
                    </span>
                  </p>
                </Section>
                {!leadElsewhere ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Section title="Compare at" htmlFor={ids.compare}>
                      <MoneyInput
                        id={ids.compare}
                        value={item.compareAt}
                        optional
                        placeholder="—"
                        currency={p.currency}
                        ariaLabel="Previous price"
                        onCommit={(v) => {
                          const next = { ...item };
                          if (v !== undefined && v > 0) next.compareAt = v;
                          else delete next.compareAt;
                          onChange(next, `item:${item.id}:compare`);
                        }}
                      />
                    </Section>
                    <Section title="SKU" htmlFor={ids.sku}>
                      <DraftInput
                        id={ids.sku}
                        value={item.sku ?? ""}
                        maxLength={60}
                        dir="ltr"
                        spellCheck={false}
                        placeholder="Optional"
                        onCommit={(v) => {
                          const next = { ...item };
                          if (v.trim()) next.sku = v.trim();
                          else delete next.sku;
                          onChange(next, `item:${item.id}:sku`);
                        }}
                        className="h-8 font-mono text-[12px]"
                      />
                    </Section>
                  </div>
                ) : null}
              </div>
              {!leadElsewhere && item.compareAt !== undefined && item.compareAt <= item.price ? (
                <p className="-mt-1 text-[11.5px] text-warn-ink">“Compare at” must be a real, higher previous price — otherwise no saving is shown.</p>
              ) : null}
              {several ? (
                <label htmlFor={ids.sold} className="flex cursor-pointer items-start gap-2.5">
                  <Switch id={ids.sold} size="sm" checked={item.soldOut} onCheckedChange={(soldOut) => onChange({ ...item, soldOut })} className="mt-[3px]" />
                  <span className="grid gap-0.5">
                    <span className="text-[12.5px] font-medium">Sold out</span>
                    <span className="text-[11.5px] leading-snug text-muted-foreground">Choosers skip it; offers that always include it can’t be ordered.</span>
                  </span>
                </label>
              ) : null}
              {leadElsewhere ? (
                <p className="text-[11.5px] text-muted-foreground">Price and options of the first product are set in the Details step.</p>
              ) : (
                <Section title="Options" hint="Colors, sizes, combined options or a name to print.">
                  <VariantsEditor
                    value={item.groups}
                    locale={p.locale}
                    currency={p.currency}
                    density="compact"
                    photos={variantPhotos}
                    photoUrl={(id) => p.photos.info(id)?.url ?? null}
                    onPickPhoto={p.photos.pick}
                    onChange={(groups, coalesce) => onChange({ ...item, groups }, coalesce)}
                    onRekey={onRekey}
                  />
                </Section>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

function Section({ title, hint, htmlFor, children }: { title: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-foreground/85">
          {title}
        </label>
        {hint ? <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* dialogs                                                             */
/* ------------------------------------------------------------------ */

function AddItemDialog({
  open,
  onOpenChange,
  first,
  productName,
  currency,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** the page's only item (its name is asked: with 2+ items every item is named) */
  first: Item | null;
  productName: string;
  currency: string;
  onAdd: (name: string, price: number, firstName?: string) => void;
}) {
  const ids = { first: useId(), name: useId(), price: useId() };
  // mounted on open: the fields start from the page's current product
  const [firstName, setFirstName] = useState(() => first?.name || productName);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | undefined>(() => first?.price);
  // the first product is still named after the page (or not at all): name it now, prefilled
  const needFirst = !!first && (!first.name.trim() || first.name.trim() === productName.trim());
  const ok = name.trim().length > 0 && (price ?? 0) > 0 && (!needFirst || firstName.trim().length > 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[26rem]">
        <DialogHeader className="gap-1 border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Plus className="size-4 text-brand" />
            Add a product
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">It gets its own name, price, photos and options; offers combine your products.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 px-5 py-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            onAdd(name.trim(), price!, needFirst ? firstName.trim() : undefined);
            onOpenChange(false);
          }}
        >
          {needFirst ? (
            <div className="grid gap-1.5 rounded-xl bg-brand-soft/50 p-3 ring-1 ring-inset ring-brand/15">
              <label htmlFor={ids.first} className="text-[12px] font-medium">
                First, name the product you already sell
              </label>
              <Input id={ids.first} dir="auto" value={firstName} maxLength={120} onChange={(e) => setFirstName(e.target.value)} className="h-9 bg-background text-[13px]" />
              <p className="text-[11px] text-muted-foreground">Customers see both names when they choose (e.g. “Crème jour” and “Crème nuit”).</p>
            </div>
          ) : null}
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-2.5">
            <div className="grid gap-1.5">
              <label htmlFor={ids.name} className="text-[12px] font-medium">
                New product
              </label>
              <Input id={ids.name} dir="auto" autoFocus={!needFirst} value={name} maxLength={120} placeholder="e.g. Crème nuit" onChange={(e) => setName(e.target.value)} className="h-9 text-[13px]" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={ids.price} className="text-[12px] font-medium">
                Price
              </label>
              <MoneyInput id={ids.price} value={price} currency={currency} optional ariaLabel="Price" onCommit={setPrice} />
            </div>
          </div>
          <DialogFooter className="-mx-5 -mb-5 flex-row justify-end gap-2 border-t border-border/70 bg-muted/30 px-5 py-3">
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="rounded-full px-4" disabled={!ok}>
              Add product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  item,
  name,
  usage,
  offerLabel,
  onOpenChange,
  onConfirm,
}: {
  item: Item | null;
  name: string;
  usage: ReturnType<typeof itemUsage> | null;
  offerLabel: (o: Offers["bundles"][number]) => string;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
}) {
  const used = usage && (usage.offers.length || usage.bump || usage.upsell);
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[26rem]">
        <DialogHeader className="gap-1 px-5 pt-5 pb-3">
          <DialogTitle className="text-[15px]">
            Delete <bdi>{name}</bdi>?
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {used ? "It is part of what the page sells. Deleting it also changes:" : "It isn’t used by any offer. Its photos stay in your media library."}
          </DialogDescription>
        </DialogHeader>
        {used ? (
          <ul className="mx-5 mb-4 grid gap-1 rounded-xl bg-foreground/[0.03] p-3 text-[12.5px] ring-1 ring-inset ring-foreground/[0.06]">
            {usage!.offers.map((o) => (
              <li key={o.id} className="flex gap-2">
                <span aria-hidden="true" className="mt-[0.5em] size-1 shrink-0 rounded-full bg-foreground/40" />
                <span>
                  Offer <bdi className="font-medium">{offerLabel(o)}</bdi>: its lines with this product are removed (an offer left empty is deleted)
                </span>
              </li>
            ))}
            {usage!.bump ? <li className="flex gap-2">• The order bump no longer adds this product</li> : null}
            {usage!.upsell ? <li className="flex gap-2">• The thank-you upsell no longer adds this product</li> : null}
          </ul>
        ) : null}
        <DialogFooter className="flex-row justify-end gap-2 border-t border-border/70 bg-muted/30 px-5 py-3">
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" size="sm" className="rounded-full px-4" onClick={onConfirm}>
            Delete product
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
