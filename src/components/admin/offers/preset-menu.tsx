"use client";
/**
 * "+ Offer" preset tiles (docs/OFFERS.md §H.1, §H.2, §H.4: presets first, "Blank" last) and the
 * "Suggest offers" diff dialog: suggestions on the current items and group photos, matched to the
 * page's offers by contents (`offerSignature`) — New · Same contents, price differs · Already there
 * — each accepted on its own, ≤ 8 offers enforced.
 */
import { Boxes, Check, CirclePlus, Gift, Layers, Palette, Plus, Repeat2, Shuffle, Sparkles, SquareDashed, Tags } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { PhotoSource } from "@/components/admin/items/photo-well";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { offerName, offerSignature } from "@/lib/page/catalog";
import { feature } from "@/lib/page/features";
import { formatMoney } from "@/lib/markets/money";
import { fromCents, offerMath } from "@/lib/page/pricing";
import { LIMITS, type Offer, type Offers } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { MiniVisual } from "./mini-visual";
import { blankOffer } from "./model";
import type { OffersDoc } from "./offer-editor";
import { colorTarget, offerId, presetOffer, suggestOffers, type OfferPreset } from "./presets";
import { offerSentence } from "./text";

interface Tile {
  preset: OfferPreset | "blank";
  title: string;
  hint: string;
  icon: ReactNode;
  opts?: { qty?: number };
}

function tilesFor(doc: OffersDoc): Tile[] {
  const n = doc.items.length;
  const multi = feature("MULTI_ITEM");
  const rules = feature("RULES");
  const lead = doc.items[0]!;
  const out: Tile[] = [
    { preset: "single", title: "Single", hint: "One piece at its price", icon: <CirclePlus /> },
    { preset: "multi", title: "Pack ×2", hint: "Two of the same, cheaper per piece", icon: <Repeat2 />, opts: { qty: 2 } },
    { preset: "multi", title: "Pack ×3", hint: "Three of the same", icon: <Boxes />, opts: { qty: 3 } },
  ];
  if (multi && n >= 2) {
    out.push({ preset: "choose-one", title: "Your choice", hint: "One product, the customer picks which", icon: <Shuffle /> });
    if (n >= 3) out.push({ preset: "any-n", title: "Any 2", hint: "Two different ones of their choice", icon: <Tags />, opts: { qty: 2 } });
    out.push({ preset: "combo", title: "Combo", hint: "Two products together", icon: <Layers /> });
    out.push({ preset: "combo-gift", title: "Combo + gift", hint: "The last product is offered", icon: <Gift /> });
    out.push({ preset: "everything", title: "Full set", hint: "Every product, best price", icon: <Sparkles /> });
  }
  if (multi) out.push({ preset: "bogo", title: "1 + 1 free", hint: "Buy one, the second is offered", icon: <Gift /> });
  if (rules && (colorTarget(lead)?.values.length ?? 0) >= 2) out.push({ preset: "pack-colors", title: "Pack of colors", hint: "One piece per color, sizes chosen", icon: <Palette /> });
  out.push({ preset: "blank", title: "Blank", hint: "One piece, build it yourself", icon: <SquareDashed /> });
  return out;
}

export function PresetMenu({ doc, onAdd, children }: { doc: OffersDoc; onAdd: (offer: Offer) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const full = doc.offers.bundles.length >= LIMITS.offers;
  const tiles = useMemo(() => tilesFor(doc), [doc]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={full}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-2">
        <p className="px-1.5 pt-1 pb-2 text-[11.5px] text-muted-foreground">{full ? `${LIMITS.offers} offers is the maximum.` : "Start from a preset — every price is editable."}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {tiles.map((t) => (
            <button
              key={`${t.preset}:${t.opts?.qty ?? ""}`}
              type="button"
              disabled={full}
              onClick={() => {
                const offer = t.preset === "blank" ? blankOffer(doc.offers, doc.items[0]!) : presetOffer(t.preset, doc, t.opts);
                onAdd(offer);
                setOpen(false);
              }}
              className={cn(
                "grid gap-1 rounded-xl p-2.5 text-start ring-1 ring-inset ring-foreground/[0.07] outline-none transition-[background-color,box-shadow] hover:bg-brand-soft/45 hover:ring-brand/30 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45 [&_svg]:size-4 [&_svg]:text-brand",
                t.preset === "blank" && "col-span-2 grid-cols-[auto_1fr] items-center gap-x-2.5",
              )}
            >
              {t.icon}
              <span className="grid gap-0.5">
                <span className="text-[12.5px] font-semibold">{t.title}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{t.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* suggest diff                                                        */
/* ------------------------------------------------------------------ */

type Row = { offer: Offer; kind: "new" | "price" | "same"; match?: Offer };

export function SuggestDialog({ open, onOpenChange, doc, photos, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; doc: OffersDoc; photos: PhotoSource; onApply: (offers: Offers) => void }) {
  const rows = useMemo<Row[]>(() => {
    if (!open) return [];
    const bySig = new Map(doc.offers.bundles.map((o) => [offerSignature(o), o]));
    return suggestOffers(doc, { rules: feature("RULES") }).map((s) => {
      const match = bySig.get(offerSignature(s));
      if (!match) return { offer: s, kind: "new" };
      return Math.abs(match.price - s.price) < 0.005 ? { offer: s, kind: "same", match } : { offer: s, kind: "price", match };
    });
  }, [open, doc]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [offers, setOffers] = useState<Offers>(doc.offers);
  const money = (n: number) => formatMoney(n, doc.currency, "en");
  const accept = (i: number) => {
    const r = rows[i]!;
    let next: Offers = offers;
    if (r.kind === "new") {
      if (offers.bundles.length >= LIMITS.offers) return;
      const id = offerId(offers.bundles.map((o) => o.id), r.offer.id);
      // a suggested "popular" / "best" takes the badge from the page's current one
      const badge = r.offer.badge;
      const bundles = offers.bundles.map((o) => ((badge === "popular" || badge === "best") && o.badge === badge ? { ...o, badge: "none" as const } : o));
      next = { ...offers, bundles: [...bundles, { ...r.offer, id }] };
    } else if (r.kind === "price" && r.match) {
      next = { ...offers, bundles: offers.bundles.map((o) => (o.id === r.match!.id ? { ...o, price: r.offer.price } : o)) };
    }
    setOffers(next);
    onApply(next);
    setDone((d) => new Set(d).add(i));
  };
  return (
    // mount it on open (its state starts from the page's current offers)
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[34rem]">
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Sparkles className="size-4 text-brand" />
            Suggested offers
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">From your products, their prices and group photos. Honest prices only: every pack costs less than its pieces bought alone. Accept the ones you want.</DialogDescription>
        </DialogHeader>
        <ul className="adm-scroll grid min-h-0 flex-1 gap-2 overflow-y-auto px-5 py-4">
          {rows.map((r, i) => {
            const m = offerMath({ items: doc.items, offers: { ...doc.offers, bundles: [r.offer] } }, r.offer);
            const accepted = done.has(i);
            const full = r.kind === "new" && offers.bundles.length >= LIMITS.offers;
            return (
              <li key={i} className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-inset ring-foreground/[0.07]">
                <MiniVisual doc={doc} offer={r.offer} source={photos} className="size-14" />
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-center gap-1.5">
                    <bdi className="truncate text-[13px] font-semibold" dir="auto">
                      {offerName({ doc }, r.offer)}
                    </bdi>
                    <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold", r.kind === "new" ? "bg-brand-soft text-brand" : r.kind === "price" ? "bg-warn/20 text-warn-ink" : "bg-foreground/[0.06] text-muted-foreground")}>
                      {r.kind === "new" ? "New" : r.kind === "price" ? "Same contents, price differs" : "Already there"}
                    </span>
                  </span>
                  <span className="text-[12px] tabular-nums">
                    {money(fromCents(m.from))}
                    {m.showReference ? <span className="ms-1.5 text-[11px] text-muted-foreground line-through">{money(fromCents(m.displayReference))}</span> : null}
                    {r.kind === "price" && r.match ? <span className="ms-1.5 text-[11px] text-muted-foreground">(yours: {money(r.match.price)})</span> : null}
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground" dir="auto">
                    {offerSentence(doc, r.offer)}
                  </span>
                </span>
                {r.kind === "same" ? (
                  <Check className="size-4 shrink-0 text-muted-foreground" aria-label="Already on the page" />
                ) : (
                  <Button type="button" size="sm" variant={accepted ? "ghost" : "outline"} disabled={accepted || full} onClick={() => accept(i)} className="shrink-0 rounded-full" title={full ? `${LIMITS.offers} offers at most` : undefined}>
                    {accepted ? <Check /> : <Plus />}
                    {accepted ? "Added" : r.kind === "price" ? "Use price" : "Add"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-between gap-2 rounded-none border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
          <span className="text-[11.5px] text-muted-foreground tabular-nums">
            {offers.bundles.length}/{LIMITS.offers} offers on the page
          </span>
          <Button type="button" size="sm" className="rounded-full px-4" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
