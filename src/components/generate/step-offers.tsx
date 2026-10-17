"use client";
/**
 * Step 4 — Offers (docs/OFFERS.md §H.2): what the page sells and how the customer buys it.
 *
 *  1. What does this page sell? One product, or several (MULTI_ITEM): item cards with photo wells —
 *     a photo picked by two products is their group photo, "Crop {item} from this photo" cuts each
 *     product out of it (the owner's case: one photo with two creams). The first product's price
 *     and options stay in the Details step.
 *  2. Offers: the suggestions for these products and group photos (on / off, price, title, visual,
 *     sentence); editing one keeps the list as edited, "Suggest again" goes back to automatic.
 *     "+ Offer" opens the preset tiles ("Blank" last).
 *  3. Look: the combos (Classique / Boutique / Compact) or "Auto (each design chooses)"; the real
 *     previews are the Directions step.
 */
import { LayersIcon, PackageIcon, PlusIcon, RotateCcwIcon, ShoppingBasketIcon, SparklesIcon, SwatchBookIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ItemsEditor, type PhotoSource } from "@/components/admin/items";
import { COMBOS, OfferList, PresetMenu, offerSentence, type OffersDoc } from "@/components/admin/offers";
import { Button } from "@/components/ui/button";
import { defaultOfferId, offerName } from "@/lib/page/catalog";
import { feature } from "@/lib/page/features";
import { formatMoney } from "@/lib/markets/money";
import { fromCents, offerMath } from "@/lib/page/pricing";
import { DEFAULT_OFFER_DISPLAY, LIMITS, type AssetRef, type Item, type Offer, type Offers, type PageDoc } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { Panel } from "./parts";
import type { Details, OfferLook } from "./state";

export interface StepOffersProps {
  details: Details;
  onChange(patch: Partial<Details>): void;
  /** the page's products (lead first) */
  items: Item[];
  onItems(items: Item[]): void;
  /** the offers shown (automatic suggestions or the edited list), switched-off ones included */
  offers: Offer[];
  auto: boolean;
  currency: string;
  locale: PageDoc["locale"];
  productName: string;
  /** the page's photos (a single product's visuals fall back to them) */
  productImages: AssetRef[];
  photos: PhotoSource;
  palettes: Readonly<Record<string, { colors: readonly { hex: string; weight: number }[]; background: string | null } | null>>;
  shippingFee: number;
}

export function StepOffers(p: StepOffersProps) {
  const { details, onChange } = p;
  const multi = feature("MULTI_ITEM");
  const [open, setOpen] = useState<string | null>(null);
  const off = useMemo(() => new Set(details.offersOff), [details.offersOff]);
  const offers: Offers = useMemo(
    () => ({ bundles: p.offers, display: { ...DEFAULT_OFFER_DISPLAY }, extras: [], showPerUnit: true, showSavings: "both", shippingFee: p.shippingFee, urgency: {} }),
    [p.offers, p.shippingFee],
  );
  const doc = useMemo<OffersDoc>(
    () => ({ items: p.items, offers, product: { name: p.productName, category: "other", images: p.productImages }, locale: p.locale, currency: p.currency }),
    [p.items, offers, p.productName, p.productImages, p.locale, p.currency],
  );
  const on = p.offers.filter((o) => !off.has(o.id));
  const shown = { ...doc, offers: { ...offers, bundles: on.length ? on : p.offers.slice(0, 1) } };
  const def = shown.offers.bundles.length ? shown.offers.bundles.find((o) => o.id === defaultOfferId(shown.offers, p.items)) : undefined;
  const setOffers = (bundles: Offer[]) => onChange({ offers: bundles.slice(0, LIMITS.offers), offersOff: details.offersOff.filter((id) => bundles.some((o) => o.id === id)) });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="min-w-0">
        <div className="grid gap-9 p-5 sm:p-8">
          {multi ? (
            <Group title="What does this page sell?" icon={<ShoppingBasketIcon />}>
              <div role="radiogroup" aria-label="What the page sells" className="grid gap-3 sm:grid-cols-2">
                <SellCard on={details.sells === "one"} onClick={() => onChange({ sells: "one", offers: details.sells === "one" ? details.offers : null, offersOff: [] })} icon={<PackageIcon />} title="One product" hint="Packs of the same product (×1, ×2, ×3…), colors and sizes per piece." />
                <SellCard
                  on={details.sells === "several"}
                  onClick={() => onChange({ sells: "several", offers: details.sells === "several" ? details.offers : null, offersOff: [], lead: { ...details.lead, name: details.lead.name || p.productName } })}
                  icon={<LayersIcon />}
                  title="Several products"
                  hint="Choose one, combos, a set, a gift — even two products shown in one photo."
                />
              </div>
              {details.sells === "several" ? (
                <ItemsEditor
                  items={p.items}
                  locale={p.locale}
                  currency={p.currency}
                  productName={p.productName}
                  photos={p.photos}
                  palettes={p.palettes}
                  leadElsewhere
                  onChange={(next) => p.onItems(next.items)}
                />
              ) : null}
            </Group>
          ) : null}

          <Group
            title="Offers"
            icon={<SwatchBookIcon />}
            description={p.auto ? "Suggested from your products, their prices and photos. Every pack costs less than its pieces bought alone. Switch off what you don't want, or tap one to edit it." : "Your offers. Tap one to edit its contents, price, visual and details."}
            action={
              <div className="flex items-center gap-1.5">
                {!p.auto ? (
                  <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => onChange({ offers: null, offersOff: [] })}>
                    <RotateCcwIcon />
                    Suggest again
                  </Button>
                ) : null}
                <PresetMenu
                  doc={doc}
                  onAdd={(o) => {
                    setOffers([...p.offers, o]);
                    setOpen(o.id);
                  }}
                >
                  <Button variant="outline" size="sm" className="rounded-full" disabled={p.offers.length >= LIMITS.offers}>
                    <PlusIcon />
                    Offer
                  </Button>
                </PresetMenu>
              </div>
            }
          >
            <OfferList
              doc={doc}
              photos={p.photos}
              open={open}
              onOpen={setOpen}
              off={off}
              onToggleOff={(id, turnOn) => {
                const next = turnOn ? details.offersOff.filter((x) => x !== id) : [...details.offersOff, id];
                // keep at least one offer on
                if (!turnOn && p.offers.every((o) => next.includes(o.id))) return;
                onChange({ offersOff: next });
              }}
              onChange={(next) => setOffers(next.bundles)}
            />
          </Group>

          <Group title="Look" icon={<SparklesIcon />} description="How the offers are laid out on the order form. You see it for real in the next step and can change it in the builder.">
            <div role="radiogroup" aria-label="Offer look" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...COMBOS.filter((c) => c.id !== "auto"), COMBOS.find((c) => c.id === "auto")!].map((c) => {
                const active = details.look === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ look: c.id as OfferLook })}
                    className={cn(
                      "grid gap-1 rounded-2xl p-3.5 text-start ring-1 ring-inset outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
                      active ? "bg-brand-soft ring-brand/40" : "ring-foreground/[0.08] hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="text-[0.88rem] font-semibold">{c.id === "auto" ? "Auto" : c.label}</span>
                    <span className="text-[0.75rem] leading-snug text-muted-foreground">{c.id === "auto" ? "Each design chooses" : c.hint}</span>
                  </button>
                );
              })}
            </div>
          </Group>
        </div>
      </Panel>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="adm-surface grid gap-4 p-5 sm:p-6">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-brand uppercase">On the order form</p>
          <ul className="grid gap-2.5">
            {shown.offers.bundles.map((o) => {
              const m = offerMath(shown, o);
              const isDefault = o.id === def?.id;
              return (
                <li key={o.id} className={cn("grid gap-0.5 rounded-xl px-3 py-2.5 ring-1 ring-inset", isDefault ? "bg-brand-soft/60 ring-brand/30" : "ring-foreground/[0.07]")}>
                  <span className="flex items-baseline justify-between gap-2">
                    <bdi className="truncate text-[0.88rem] font-semibold" dir="auto">
                      {offerName({ doc: shown }, o)}
                    </bdi>
                    <span className="shrink-0 text-[0.85rem] font-semibold tabular-nums">
                      {m.variable ? <span className="text-[0.72rem] font-medium text-muted-foreground">from </span> : null}
                      {formatMoney(fromCents(m.from), p.currency, p.locale)}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-[0.72rem] leading-snug text-muted-foreground" dir="auto">
                    {offerSentence(shown, o)}
                  </span>
                  {isDefault ? <span className="text-[0.68rem] font-medium text-brand">Selected when the page opens</span> : null}
                </li>
              );
            })}
          </ul>
          <p className="text-[0.75rem] leading-relaxed text-muted-foreground">Prices are rounded the way the page shows them. Delivery: {p.shippingFee > 0 ? `${formatMoney(p.shippingFee, p.currency, p.locale)} unless an offer is marked free` : "free on every offer"}.</p>
        </div>
      </aside>
    </div>
  );
}

function Group({ title, icon, description, action, children }: { title: string; icon: ReactNode; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-3.5">{icon}</span>
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.005em]">{title}</h2>
        </span>
        {action}
      </div>
      {description ? <p className="-mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

function SellCard({ on, onClick, icon, title, hint }: { on: boolean; onClick: () => void; icon: ReactNode; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl p-4 text-start ring-1 ring-inset outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
        on ? "bg-brand-soft/70 ring-2 ring-brand/50" : "ring-foreground/[0.08] hover:bg-foreground/[0.025]",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4", on ? "bg-brand text-brand-foreground" : "bg-foreground/[0.05] text-muted-foreground")}>{icon}</span>
      <span className="grid gap-1">
        <span className="text-[0.92rem] font-semibold">{title}</span>
        <span className="text-[0.78rem] leading-relaxed text-pretty text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
