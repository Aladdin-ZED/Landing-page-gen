"use client";
/**
 * The offer cards (docs/OFFERS.md §H.4): sortable (dnd-kit, handle + keyboard), collapsed to a 64 px
 * composition, the name, the card price ("Dès" when it can rise), the struck reference, −%, badges,
 * "Épuisé" and the one-line sentence; expanded to the OfferEditor. Clicking a card selects that
 * offer in the preview (`onSelect`); the menu has Duplicate · Move up / down · Sold out · Delete.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Ban, CopyPlus, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import type { PhotoSource } from "@/components/admin/items/photo-well";
import { EASE } from "@/components/admin/variants/parts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { offerName, offerAvailable } from "@/lib/page/catalog";
import { formatMoney } from "@/lib/markets/money";
import { fromCents, offerMath } from "@/lib/page/pricing";
import { LIMITS, type Offer, type Offers } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { MiniVisual } from "./mini-visual";
import { duplicateOffer, moveOffer, putOffer, removeOffer } from "./model";
import { OfferEditor, type OffersDoc } from "./offer-editor";
import { offerSentence } from "./text";

export interface OfferListProps {
  doc: OffersDoc;
  photos: PhotoSource;
  onChange: (offers: Offers, coalesce?: string | null) => void;
  /** expanded offer id */
  open: string | null;
  onOpen: (id: string | null) => void;
  /** the offer to show selected in the preview */
  onSelect?: (id: string) => void;
  /** offers switched off (wizard suggestions) */
  off?: ReadonlySet<string>;
  onToggleOff?: (id: string, on: boolean) => void;
}

export function OfferList(p: OfferListProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId();
  const offers = p.doc.offers;
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = offers.bundles.findIndex((o) => o.id === e.active.id);
    const to = offers.bundles.findIndex((o) => o.id === e.over!.id);
    if (from >= 0 && to >= 0) p.onChange({ ...offers, bundles: arrayMove([...offers.bundles], from, to) });
  };
  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={offers.bundles.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <ul className="grid grid-cols-1 gap-2.5">
          {offers.bundles.map((o, i) => (
            <OfferCard key={o.id} offer={o} index={i} {...p} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function OfferCard({ offer: o, index, doc, photos, onChange, open, onOpen, onSelect, off, onToggleOff }: OfferListProps & { offer: Offer; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: o.id });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const offers = doc.offers;
  const m = offerMath(doc, o);
  const money = (c: number) => formatMoney(fromCents(c), doc.currency, "en");
  const name = offerName({ doc }, o);
  const expanded = open === o.id;
  const disabled = off?.has(o.id) ?? false;
  const available = offerAvailable(o, doc.items);
  const sentence = offerSentence(doc, o);
  const badge = o.badge === "popular" ? "Popular" : o.badge === "best" ? "Best price" : o.badge === "custom" ? o.badgeText || "Badge" : null;
  const set = (next: Offers, coalesce?: string | null) => onChange(next, coalesce);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl bg-background ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-20px_rgb(0_0_0/0.22)] transition-shadow dark:bg-foreground/[0.03]",
        o.preselected && "ring-[1.5px] ring-brand/60",
        expanded && "ring-foreground/20",
        isDragging && "z-10 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35)]",
        disabled && "opacity-55",
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${name}`}
          className="grid w-6 shrink-0 cursor-grab place-items-center text-muted-foreground/60 outline-none hover:text-foreground focus-visible:bg-foreground/[0.04] active:cursor-grabbing [&_svg]:size-4"
        >
          <GripVertical />
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => {
            onOpen(expanded ? null : o.id);
            onSelect?.(o.id);
          }}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pe-1 text-start outline-none focus-visible:bg-foreground/[0.03]"
        >
          <MiniVisual doc={doc} offer={o} source={photos} className="size-16" />
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <bdi className="truncate text-[13.5px] font-semibold tracking-[-0.01em]" dir="auto">
                {name}
              </bdi>
              {badge ? <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-px text-[10px] font-semibold text-brand">{badge}</span> : null}
              {!available ? <span className="shrink-0 rounded-full bg-foreground/[0.07] px-1.5 py-px text-[10px] font-semibold text-muted-foreground">Épuisé</span> : null}
            </span>
            <span className="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
              <span className="text-[13px] font-semibold whitespace-nowrap">
                {m.variable ? <span className="text-[11px] font-medium text-muted-foreground">from </span> : null}
                {money(m.from)}
              </span>
              {m.showReference ? <span className="text-[11.5px] text-muted-foreground line-through">{money(m.displayReference)}</span> : null}
              {m.showReference ? <span className="rounded-full bg-success/12 px-1.5 text-[10.5px] font-semibold text-success-ink">−{m.savingsPct}%</span> : null}
            </span>
            <span className="truncate text-[11px] text-muted-foreground" dir="auto" title={sentence}>
              {sentence}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-center justify-center gap-1 pe-1.5">
          {onToggleOff ? (
            <button
              type="button"
              role="switch"
              aria-checked={!disabled}
              aria-label={disabled ? `Use ${name}` : `Don't use ${name}`}
              onClick={() => onToggleOff(o.id, disabled)}
              className={cn("relative h-5 w-9 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60", disabled ? "bg-foreground/15" : "bg-brand")}
            >
              <span className={cn("absolute top-0.5 size-4 rounded-full bg-background shadow transition-[inset-inline-start]", disabled ? "start-0.5" : "start-[1.125rem]")} />
            </button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`${name}: actions`} className="text-muted-foreground">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem disabled={offers.bundles.length >= LIMITS.offers} onSelect={() => set(duplicateOffer(offers, o.id))}>
                <CopyPlus />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === 0} onSelect={() => set(moveOffer(offers, o.id, -1))}>
                <ArrowUp />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === offers.bundles.length - 1} onSelect={() => set(moveOffer(offers, o.id, 1))}>
                <ArrowDown />
                Move down
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => set(putOffer(offers, { ...o, soldOut: !o.soldOut }))}>
                <Ban />
                {o.soldOut ? "Back in stock" : "Sold out"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={offers.bundles.length <= 1}
                onSelect={() => {
                  const next = removeOffer(offers, o.id);
                  if (next) set(next);
                }}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div key="editor" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden border-t border-foreground/[0.06]">
            <OfferEditor offer={o} doc={doc} photos={photos} onChange={(next, coalesce) => set(putOffer(offers, next), coalesce)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
