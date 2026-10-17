/**
 * The generator's offers (docs/OFFERS.md §E.5, §H.1, §H.2): what a direction sells and how its offers
 * are laid out. Replaces bundles.ts (kept one release as an alias of `suggestBundles`).
 *
 *   offerTextsFor(locale, packs?)          offer names in the page language (copy library)
 *   directionCatalog(input, copy)          items + offers: the wizard's verbatim (validated), else suggestOffers
 *   pickOfferDisplay(archetype, offers, seed)   picker / selection / density per archetype (§E.5)
 *   safeSelection(display, formVariant)    never "solid" on the bold order form (accent on accent)
 *
 * Pure & deterministic per seed.
 */
import { z } from "zod";
import { libraryFor } from "@/lib/ai/copy-library";
import type { PageCopy } from "@/lib/ai/copy-schema";
import { feature } from "@/lib/page/features";
import { NO_OFFER_TEXTS, suggestOffers, type OfferText, type OfferTexts } from "@/lib/page/offer-presets";
import {
  isChoicePick,
  isFixedPick,
  Item,
  LegacyProduct,
  MAIN_ITEM_ID,
  Offer,
  OfferDisplay,
  type Archetype,
  type Bundle,
  type Locale,
  type OfferDensity,
  type OfferPicker,
  type OfferSelection,
  type PageDoc,
} from "@/lib/page/schema";
import { rngFor, weighted } from "./rng";

/* ------------------------------------------------------------------ */
/* Texts                                                               */
/* ------------------------------------------------------------------ */

/**
 * Offer names for a page language: ×1 / ×2 / ×3 from the page copy's `bundles` (AI-written or the
 * library's), the multi-item names from the copy library (`common.offers`; locales without a
 * library read English).
 */
export function offerTextsFor(locale: Locale, packs?: PageCopy["bundles"] | readonly OfferText[]): OfferTexts {
  const lib = libraryFor(locale).common;
  const o = lib.offers;
  return {
    ...NO_OFFER_TEXTS,
    packs: (packs ?? lib.bundles).map((b) => ({ title: b.title, subtitle: b.subtitle })),
    choice: o.choice,
    anyN: o.anyN,
    duo: o.duo,
    trio: o.trio,
    set: o.set,
    bogo: o.bogo,
    colors: o.colors,
  };
}

/* ------------------------------------------------------------------ */
/* Items and offers of a direction                                      */
/* ------------------------------------------------------------------ */

export class CatalogInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogInputError";
  }
}

const ItemsInput = z.array(Item).min(1).max(8);
const OffersInput = z.array(Offer).min(1).max(8);

export interface CatalogInput {
  /** the wizard's product: story, plus price / compare-at / SKU / options on single-item pages */
  product: unknown;
  items?: unknown;
  offers?: unknown;
  locale: Locale;
}

export interface DirectionCatalog {
  items: PageDoc["items"];
  bundles: Offer[];
}

/**
 * The page's items and offers. `items` given → used verbatim (validated); else one item "main" from
 * the v1 product (price, compare-at, SKU, options). `offers` given → used verbatim (validated); else
 * `suggestOffers` with the page's texts. Throws CatalogInputError with an owner-readable message.
 */
export function directionCatalog(input: CatalogInput, ctx: { currency: string; product: PageDoc["product"]; copy: Pick<PageCopy, "bundles"> }): DirectionCatalog {
  let items: PageDoc["items"];
  if (input.items !== undefined && input.items !== null) {
    const parsed = ItemsInput.safeParse(input.items);
    if (!parsed.success) throw new CatalogInputError("The products are incomplete: each one needs a name and a price.");
    items = parsed.data;
  } else {
    const legacy = LegacyProduct.safeParse(input.product);
    if (!legacy.success) throw new CatalogInputError("The product is incomplete: name and price are required.");
    const { price, compareAt, sku, variants } = legacy.data;
    items = [{ id: MAIN_ITEM_ID, name: "", images: [], price, ...(compareAt !== undefined ? { compareAt } : {}), ...(sku ? { sku } : {}), groups: variants, soldOut: false }];
  }
  if (input.offers !== undefined && input.offers !== null) {
    const parsed = OffersInput.safeParse(input.offers);
    if (!parsed.success) throw new CatalogInputError("The offers are incomplete: each one needs its contents and a price.");
    return { items, bundles: parsed.data };
  }
  const texts = offerTextsFor(input.locale, ctx.copy.bundles);
  // rules ("Pack 3 couleurs") only once the builder can edit them (feature switch RULES)
  const bundles = suggestOffers({ items, currency: ctx.currency, product: ctx.product }, texts, { rules: feature("RULES") });
  return { items, bundles };
}

/* ------------------------------------------------------------------ */
/* Offer layout per archetype (§E.5)                                    */
/* ------------------------------------------------------------------ */

interface ArchetypeOfferLook {
  /** single-item offer sets: the archetype's pair, drawn 70 / 30 (v1 CARD_STYLE) */
  single: readonly [OfferPicker, OfferPicker];
  /** image-led offer sets (several items, a choice, a custom visual) */
  imageLed: OfferPicker;
  selection: OfferSelection;
  density: OfferDensity;
}

export const OFFER_LOOK: Readonly<Record<Archetype, ArchetypeOfferLook>> = {
  maison: { single: ["tiers", "pills"], imageLed: "visual", selection: "outline", density: "comfortable" },
  apothecary: { single: ["stack", "tiers"], imageLed: "stack", selection: "soft", density: "comfortable" },
  souk: { single: ["ticket", "visual"], imageLed: "visual", selection: "solid", density: "comfortable" },
  playground: { single: ["visual", "ticket"], imageLed: "visual", selection: "soft", density: "comfortable" },
  kinetic: { single: ["tiers", "stack"], imageLed: "visual", selection: "outline", density: "compact" },
  circuit: { single: ["tiers", "pills"], imageLed: "stack", selection: "outline", density: "compact" },
  hearth: { single: ["stack", "visual"], imageLed: "visual", selection: "soft", density: "comfortable" },
  bloom: { single: ["visual", "stack"], imageLed: "visual", selection: "soft", density: "comfortable" },
  field: { single: ["stack", "visual"], imageLed: "stack", selection: "soft", density: "comfortable" },
  editorial: { single: ["pills", "tiers"], imageLed: "visual", selection: "outline", density: "comfortable" },
  garage: { single: ["ticket", "tiers"], imageLed: "stack", selection: "outline", density: "compact" },
};

/** Image-led: some offer has 2+ distinct items, a choice line, or a custom visual. */
export function isImageLed(offers: readonly Pick<Offer, "lines" | "visual">[]): boolean {
  return offers.some((o) => {
    if (o.visual.mode === "custom") return true;
    if (o.lines.some((l) => isChoicePick(l.pick))) return true;
    return new Set(o.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : ""))).size >= 2;
  });
}

/**
 * The archetype's offer layout for these offers (§E.5): image-led sets get the image-led picker,
 * others the weighted single-item pair; then one offer → stack; 5+ offers → stack compact (or cards
 * when image-led and ≤ 6); segments only up to 4 offers. Fill and media stay "auto" (resolved by
 * display.ts). The bold-form rule is applied once the form variant is known (`safeSelection`).
 */
export function pickOfferDisplay(archetype: Archetype, offers: readonly Pick<Offer, "lines" | "visual">[], seed: number): OfferDisplay {
  const look = OFFER_LOOK[archetype];
  const n = offers.length;
  const led = isImageLed(offers);
  // same draw as v1's CARD_STYLE pick (key "card-style"): single-item pages keep their layout
  let picker: OfferPicker = led ? look.imageLed : weighted(rngFor(seed, "card-style"), look.single.map((v, i) => ({ value: v, weight: i === 0 ? 0.7 : 0.3 })));
  let density = look.density;
  if (n <= 1) picker = "stack";
  else if (n >= 5) {
    if (led && n <= 6) picker = "visual";
    else {
      picker = "stack";
      density = "compact";
    }
  }
  if (picker === "pills" && n > 4) picker = "stack";
  return { picker, fill: "auto", selection: look.selection, media: "auto", density };
}

/** The wizard's "Look" (a combo or the owner's axes) when valid, else null (each design chooses). */
export function displayInput(value: unknown): OfferDisplay | null {
  if (value === undefined || value === null) return null;
  const parsed = OfferDisplay.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The bold order form puts its cards on an accent slab: "solid" (accent fill) would be accent on accent → "soft" (§E.3). */
export function safeSelection(display: OfferDisplay, formVariant: string | undefined): OfferDisplay {
  return formVariant === "bold" && display.selection === "solid" ? { ...display, selection: "soft" } : display;
}

/** The order form's variant of a page (the first visible one). */
export const formVariantOf = (doc: Pick<PageDoc, "sections">): string | undefined => doc.sections.find((s) => s.type === "orderForm" && !s.hidden)?.variant;

/* ------------------------------------------------------------------ */
/* v1 name (one release)                                               */
/* ------------------------------------------------------------------ */

export interface BundleText {
  title: string;
  subtitle: string;
}

/**
 * ×1 / ×2 / ×3 packs of the page's single item at a unit price (charming prices, no invented
 * reference). @deprecated one release: use suggestOffers (src/lib/page/offer-presets.ts).
 */
export function suggestBundles(unitPrice: number, currency: string, texts: readonly BundleText[]): Bundle[] {
  const item = { id: MAIN_ITEM_ID, name: "", images: [], price: Math.max(0, unitPrice), groups: [], soldOut: false };
  return suggestOffers({ items: [item], currency, product: { name: "-", category: "other", images: [] } }, { ...NO_OFFER_TEXTS, packs: texts }, { rules: false });
}
