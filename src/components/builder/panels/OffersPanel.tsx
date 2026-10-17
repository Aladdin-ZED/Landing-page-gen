"use client";
/**
 * Offers panel (docs/OFFERS.md §H.4): what the customer picks, built from the page's products.
 *
 *  - Top: the honesty warnings (`offerWarnings`) and "Suggest offers" (suggestions on the current
 *    products and group photos, diffed by contents, accepted one by one).
 *  - Products on this page (MULTI_ITEM): tiles — tapping one adds a piece to the open offer — and an
 *    inline "New product".
 *  - Offer cards (sortable): 64 px composition, name, card price ("Dès"), struck reference, −%,
 *    badges, sentence; expanded to the OfferEditor (contents, rules, price, visual, details).
 *    Clicking a card selects that offer in the preview; clicking an offer on the canvas opens its
 *    editor (preview bridge, src/components/preview/editor.ts).
 *  - Page level: order extras with their "Applies to" offers, order bump (optional catalog item,
 *    "Show with" offers), thank-you upsell (optional item), delivery fee (raising it from 0 says how
 *    many offers are marked free), urgency.
 *  - Display: combos, offer layout, personalization layout, selected style, media, density.
 *
 * The server always recomputes totals; every edit here keeps the document schema-valid.
 */
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Info, Plus, Sparkles, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DisplayPicker, OfferList, PresetMenu, Shelf, SuggestDialog, addUnit, putOffer, type OffersDoc } from "@/components/admin/offers";
import { VariantsEditor } from "@/components/admin/variants";
import { onOfferClicked, selectOffer } from "@/components/preview/editor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { itemShort, offerName } from "@/lib/page/catalog";
import { feature } from "@/lib/page/features";
import { offerWarnings } from "@/lib/page/pricing";
import { LIMITS, isMatrixGroup, type ExtraGroup, type Offers } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi } from "../context";
import { DateTimeField } from "../fields/DateTimeField";
import { ImageField } from "../fields/ImageField";
import { TextField } from "../fields/TextField";
import { EASE, FieldRow, Hint, NumberInput, PanelHeader, PanelSection } from "../ui";
import { useBuilderPhotos } from "./ProductPanel";

export function OffersPanel() {
  const offers = useEditor((s) => s.doc.offers);
  const items = useEditor((s) => s.doc.items);
  const product = useEditor((s) => s.doc.product);
  const locale = useEditor((s) => s.doc.locale);
  const currency = useEditor((s) => s.doc.currency);
  const archetype = useEditor((s) => s.doc.theme.archetype);
  const formVariant = useEditor((s) => s.doc.sections.find((x) => x.type === "orderForm")?.variant ?? "card");
  const api = useEditorApi();
  const photos = useBuilderPhotos();
  const [open, setOpen] = useState<string | null>(null);
  const [suggest, setSuggest] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const multi = feature("MULTI_ITEM");
  const doc = useMemo<OffersDoc>(() => ({ items, offers, product, locale, currency }), [items, offers, product, locale, currency]);
  const setOffers = (next: Offers, group?: string | null) => api.updateDoc((d) => void (d.offers = next), group ?? null);
  const set = (recipe: (o: Offers) => void, group?: string) => api.updateDoc((d) => recipe(d.offers as Offers), group ?? null);
  const price = items[0]?.price ?? 0;

  const warnings = useMemo(() => offerWarnings({ items, offers, product, locale }), [items, offers, product, locale]);
  const blocking = warnings.filter((w) => w.level === "warning");
  const info = warnings.filter((w) => w.level === "info");

  // canvas → panel: an offer clicked on the preview opens its editor
  useEffect(() => onOfferClicked((id) => setOpen(id)), []);

  const freeMarked = offers.bundles.filter((o) => o.freeShipping).length;

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Offers" description="What customers pick: packs, combos and choices. The server always recomputes the totals." />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        <PanelSection
          title="Offers"
          action={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="xs" onClick={() => setSuggest(true)}>
                <Sparkles />
                Suggest
              </Button>
              <PresetMenu
                doc={doc}
                onAdd={(o) => {
                  setOffers({ ...offers, bundles: [...offers.bundles, o] });
                  setOpen(o.id);
                }}
              >
                <Button variant="ghost" size="xs" disabled={offers.bundles.length >= LIMITS.offers}>
                  <Plus />
                  Offer
                </Button>
              </PresetMenu>
            </div>
          }
        >
          <AnimatePresence initial={false}>
            {blocking.length ? (
              <motion.div key="warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                <Hint tone="warn" icon={<CircleAlert />}>
                  <ul className="space-y-0.5">
                    {blocking.map((w, i) => (
                      <li key={`${w.code}:${i}`}>
                        {w.message}
                        {w.code === "all_free_delivery" ? (
                          <button type="button" className="ms-1.5 font-medium underline underline-offset-2" onClick={() => set((o) => void (o.shippingFee = 0))}>
                            Set delivery to 0
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Hint>
              </motion.div>
            ) : null}
          </AnimatePresence>
          {info.length ? (
            <button type="button" onClick={() => setShowInfo((v) => !v)} aria-expanded={showInfo} className="flex w-full items-start gap-2 rounded-xl px-1 text-start text-[11.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:underline">
              <Info className="mt-px size-3.5 shrink-0 text-brand" />
              {showInfo ? (
                <ul className="grid gap-0.5">
                  {info.map((w, i) => (
                    <li key={`${w.code}:${i}`}>{w.message}</li>
                  ))}
                </ul>
              ) : (
                <span>
                  {info.length} note{info.length === 1 ? "" : "s"} on how prices show
                </span>
              )}
            </button>
          ) : null}

          {multi ? (
            <div className="grid gap-1.5">
              <span className="text-[11.5px] font-medium text-muted-foreground">Products on this page</span>
              <Shelf
                doc={doc}
                photos={photos}
                tapHint="Open an offer to add a piece of it"
                onTap={
                  open
                    ? (itemId) => {
                        const o = offers.bundles.find((x) => x.id === open);
                        if (o) setOffers(putOffer(offers, addUnit(o, itemId)));
                      }
                    : null
                }
                onCreate={(it) => api.updateDoc((d) => void d.items.push(it))}
              />
            </div>
          ) : null}

          <OfferList
            doc={doc}
            photos={photos}
            open={open}
            onOpen={setOpen}
            onSelect={(id) => selectOffer(id)}
            onChange={(next, coalesce) => setOffers(next, coalesce)}
          />
        </PanelSection>

        <PanelSection title="Display" collapsible hint="How the offers are laid out and filled on the order form.">
          <DisplayPicker doc={doc} archetype={archetype} formVariant={formVariant} onChange={(next) => setOffers(next)} />
        </PanelSection>

        <PanelSection title="Delivery" collapsible>
          <FieldRow label="Delivery fee" hint={offers.shippingFee > 0 ? `Added to every order whose offer isn't marked free delivery.${freeMarked ? ` ${freeMarked} offer${freeMarked === 1 ? " is" : "s are"} marked free delivery.` : ""}` : "0 = free delivery on every offer (said once under the offers)."}>
            <NumberInput
              value={offers.shippingFee}
              min={0}
              max={10_000_000}
              suffix={currency}
              onCommit={(v) => set((o) => void (o.shippingFee = Math.round((v ?? 0) * 100) / 100), "offers:shipping")}
            />
          </FieldRow>
          {offers.shippingFee > 0 && freeMarked ? (
            <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <Truck className="size-3.5 text-brand" />
              {offers.bundles
                .filter((o) => o.freeShipping)
                .map((o) => offerName({ doc }, o))
                .join(", ")}
            </p>
          ) : null}
        </PanelSection>

        {multi ? (
          <PanelSection title="Order extras" collapsible defaultOpen={offers.extras.length > 0} hint="Choices made once per order (gift wrap, a card message).">
            <ExtrasEditor offers={offers} doc={doc} onChange={(next, coalesce) => setOffers(next, coalesce)} />
          </PanelSection>
        ) : null}

        <PanelSection title="Order bump" collapsible defaultOpen={!!offers.orderBump?.enabled} hint="A small extra the shopper can tick in the form.">
          <ToggleRow
            label="Offer an extra in the form"
            enabled={!!offers.orderBump?.enabled}
            onToggle={(on) =>
              set((o) => {
                if (o.orderBump) o.orderBump.enabled = on;
                else if (on) o.orderBump = { enabled: true, title: "", price: Math.round(price * 0.3) };
              })
            }
          >
            {offers.orderBump ? (
              <>
                {feature("BUMP_ITEM") && items.length > 1 ? (
                  <ItemPick
                    label="Product added"
                    value={offers.orderBump.item}
                    items={items.map((it) => ({ id: it.id, name: itemShort(doc, it) }))}
                    onChange={(id) =>
                      set((o) => {
                        if (!o.orderBump) return;
                        if (id) {
                          o.orderBump.item = id;
                          if (!o.orderBump.title.trim()) o.orderBump.title = itemShort(doc, items.find((x) => x.id === id)!).slice(0, 80);
                        } else delete o.orderBump.item;
                      })
                    }
                  />
                ) : null}
                <TextField id="bump-title" label="Title" value={offers.orderBump.title} max={80} emphasis={false} onChange={(v) => set((o) => void (o.orderBump!.title = v), "bump:title")} />
                <TextField id="bump-desc" label="Description" value={offers.orderBump.description} max={160} emphasis={false} multiline rows={2} onChange={(v) => set((o) => void (o.orderBump!.description = v || undefined), "bump:desc")} />
                <FieldRow label="Price">
                  <NumberInput value={offers.orderBump.price} min={0} suffix={currency} onCommit={(v) => set((o) => void (o.orderBump!.price = Math.round((v ?? 0) * 100) / 100), "bump:price")} />
                </FieldRow>
                <ImageField compact label="Image" value={offers.orderBump.image} onChange={(v) => set((o) => void (o.orderBump!.image = v), "bump:image")} />
                {feature("BUMP_ITEM") && offers.bundles.length > 1 ? (
                  <OfferScope
                    label="Show with"
                    value={offers.orderBump.offers ?? "all"}
                    offers={offers.bundles.map((b) => ({ id: b.id, name: offerName({ doc }, b) }))}
                    onChange={(scope) =>
                      set((o) => {
                        if (!o.orderBump) return;
                        if (scope === "all") delete o.orderBump.offers;
                        else o.orderBump.offers = scope;
                      })
                    }
                  />
                ) : null}
              </>
            ) : null}
          </ToggleRow>
        </PanelSection>

        <PanelSection title="Thank-you upsell" collapsible defaultOpen={!!offers.upsell?.enabled} hint="One-click add-on on the thank-you page, for a few minutes.">
          <ToggleRow
            label="Offer an add-on after ordering"
            enabled={!!offers.upsell?.enabled}
            onToggle={(on) =>
              set((o) => {
                if (o.upsell) o.upsell.enabled = on;
                else if (on) o.upsell = { enabled: true, title: "", price: Math.round(price * 0.5), windowMinutes: 10 };
              })
            }
          >
            {offers.upsell ? (
              <>
                {feature("BUMP_ITEM") && items.length > 1 ? (
                  <ItemPick
                    label="Product added"
                    value={offers.upsell.item}
                    items={items.map((it) => ({ id: it.id, name: itemShort(doc, it) }))}
                    onChange={(id) =>
                      set((o) => {
                        if (!o.upsell) return;
                        if (id) o.upsell.item = id;
                        else delete o.upsell.item;
                      })
                    }
                  />
                ) : null}
                <TextField id="up-title" label="Title" value={offers.upsell.title} max={80} emphasis={false} onChange={(v) => set((o) => void (o.upsell!.title = v), "upsell:title")} />
                <TextField id="up-desc" label="Description" value={offers.upsell.description} max={240} emphasis={false} multiline rows={2} onChange={(v) => set((o) => void (o.upsell!.description = v || undefined), "upsell:desc")} />
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldRow label="Price">
                    <NumberInput value={offers.upsell.price} min={0} suffix={currency} onCommit={(v) => set((o) => void (o.upsell!.price = Math.round((v ?? 0) * 100) / 100), "upsell:price")} />
                  </FieldRow>
                  <FieldRow label="Compare at">
                    <NumberInput value={offers.upsell.compareAt} min={0} suffix={currency} optional placeholder="—" onCommit={(v) => set((o) => void (o.upsell!.compareAt = v === undefined ? undefined : Math.round(v * 100) / 100), "upsell:compare")} />
                  </FieldRow>
                </div>
                <FieldRow label="Offer window" hint="How long the shopper can accept it.">
                  <NumberInput value={offers.upsell.windowMinutes} min={1} max={120} integer suffix="min" onCommit={(v) => set((o) => void (o.upsell!.windowMinutes = v ?? 10), "upsell:window")} />
                </FieldRow>
                <ImageField compact label="Image" value={offers.upsell.image} onChange={(v) => set((o) => void (o.upsell!.image = v), "upsell:image")} />
              </>
            ) : null}
          </ToggleRow>
        </PanelSection>

        <PanelSection title="Urgency" collapsible defaultOpen={!!offers.urgency.countdownEnd || offers.urgency.stockLeft !== undefined} hint="Only real deadlines and real stock. Nothing resets by itself.">
          <DateTimeField id="urg-end" label="Offer ends" value={offers.urgency.countdownEnd} onChange={(iso) => set((o) => void (o.urgency.countdownEnd = iso), "urgency:end")} help="The countdown hides after it." />
          <FieldRow label="Stock left" hint="Leave empty to hide the stock bar.">
            <NumberInput value={offers.urgency.stockLeft} min={0} max={100_000} integer optional placeholder="—" onCommit={(v) => set((o) => void (o.urgency.stockLeft = v), "urgency:stock")} />
          </FieldRow>
        </PanelSection>
      </div>
      {suggest ? <SuggestDialog open onOpenChange={setSuggest} doc={doc} photos={photos} onApply={(next) => setOffers(next)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* page-level pieces                                                   */
/* ------------------------------------------------------------------ */

function ToggleRow({ label, enabled, onToggle, children }: { label: string; enabled: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <>
      <FieldRow label={label} inline>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </FieldRow>
      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div key="body" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }} className="-mx-1 overflow-hidden px-1">
            <div className="space-y-3 pt-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 max-w-full items-center rounded-full px-2.5 text-[11.5px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
        on ? "bg-foreground text-background ring-foreground" : "text-muted-foreground ring-foreground/12 hover:text-foreground",
      )}
    >
      <bdi className="truncate">{children}</bdi>
    </button>
  );
}

function ItemPick({ label, value, items, onChange }: { label: string; value: string | undefined; items: { id: string; name: string }[]; onChange: (id: string | undefined) => void }) {
  return (
    <FieldRow label={label} hint="A product of the page: its options are asked and it reaches the order and the Sheet.">
      <div className="flex flex-wrap gap-1">
        <Chip on={!value} onClick={() => onChange(undefined)}>
          Text only
        </Chip>
        {items.map((it) => (
          <Chip key={it.id} on={value === it.id} onClick={() => onChange(it.id)}>
            {it.name}
          </Chip>
        ))}
      </div>
    </FieldRow>
  );
}

function OfferScope({ label, value, offers, onChange }: { label: string; value: "all" | string[]; offers: { id: string; name: string }[]; onChange: (v: "all" | string[]) => void }) {
  const list = value === "all" ? [] : value;
  return (
    <FieldRow label={label}>
      <div className="flex flex-wrap gap-1">
        <Chip on={value === "all"} onClick={() => onChange("all")}>
          All offers
        </Chip>
        {offers.map((o) => {
          const on = list.includes(o.id);
          return (
            <Chip
              key={o.id}
              on={on}
              onClick={() => {
                const next = on ? list.filter((x) => x !== o.id) : [...list, o.id];
                onChange(next.length ? next : "all");
              }}
            >
              {o.name}
            </Chip>
          );
        })}
      </div>
    </FieldRow>
  );
}

/** Page extras: the shared options editor (choice groups and custom fields) + "Applies to" per extra. */
function ExtrasEditor({ offers, doc, onChange }: { offers: Offers; doc: OffersDoc; onChange: (next: Offers, coalesce?: string | null) => void }) {
  const photos = useBuilderPhotos();
  const variantPhotos = useMemo(() => photos.photos.map((p) => ({ ref: p.ref, url: p.url })), [photos.photos]);
  const scopes = new Map(offers.extras.map((x) => [x.id, x.scope]));
  return (
    <div className="grid gap-3">
      <VariantsEditor
        value={offers.extras}
        locale={doc.locale}
        currency={doc.currency}
        density="compact"
        photos={variantPhotos}
        photoUrl={(id) => photos.info(id)?.url ?? null}
        onPickPhoto={photos.pick}
        allowMatrix={false}
        maxGroups={LIMITS.extras}
        onChange={(groups, coalesce) =>
          onChange(
            {
              ...offers,
              extras: groups.filter((g) => !isMatrixGroup(g)).slice(0, LIMITS.extras).map((g) => ({ ...g, scope: scopes.get(g.id) ?? "all" }) as ExtraGroup),
            },
            coalesce,
          )
        }
      />
      {offers.extras.length && offers.bundles.length > 1 ? (
        <div className="grid gap-2.5">
          {offers.extras.map((x) => (
            <OfferScope
              key={x.id}
              label={`“${x.name}” applies to`}
              value={x.scope}
              offers={offers.bundles.map((b) => ({ id: b.id, name: offerName({ doc }, b) }))}
              onChange={(scope) => onChange({ ...offers, extras: offers.extras.map((e) => (e.id === x.id ? ({ ...e, scope } as ExtraGroup) : e)) })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
