/**
 * Offer layouts (docs/OFFERS.md §E.1): which picker, personalization layout ("fill"), selected
 * style, media and density a page really renders. Pure; the renderer, the runtime config builder
 * and the admin Display panel all call `resolveDisplay`, so the three always agree, and the panel
 * shows the fallbacks it applied as notes ("Shown as Rows: Columns fit 2–4 offers").
 *
 * Fill "auto" is resolved ONCE per page (never per offer): the layout and step numbering never jump
 * when the shopper switches offers.
 */
import { expandUnits, offerAvailable } from "./catalog";
import { ruleLock } from "./options";
import {
  isChoiceGroup,
  isFieldGroup,
  isMatrixGroup,
  OFFER_FILLS,
  OFFER_PICKERS,
  type Archetype,
  type Item,
  type LineRule,
  type OfferDensity,
  type OfferDisplay,
  type OfferFill,
  type OfferMedia,
  type OfferPicker,
  type OfferSelection,
  type PageDoc,
} from "./schema";

export { OFFER_FILLS, OFFER_PICKERS };

/** Variants of the order form section (src/landing/sections/orderForm). */
export const ORDER_FORM_VARIANTS = ["card", "split", "minimal", "bold"] as const;
export type OrderFormVariant = (typeof ORDER_FORM_VARIANTS)[number];

/** A resolved fill: "none" = nothing to personalize on this page. */
export type ResolvedFill = "none" | Exclude<OfferFill, "auto">;

export interface DisplayNote {
  axis: "picker" | "fill" | "media" | "density";
  /** the value asked for (doc or archetype) */
  from: string;
  /** the value rendered */
  to: string;
  /** admin English, shown inline by the Display panel */
  message: string;
}

export interface ResolvedDisplay {
  picker: OfferPicker;
  fill: ResolvedFill;
  selection: OfferSelection;
  media: OfferMedia;
  density: OfferDensity;
  notes: DisplayNote[];
}

export interface DisplayRule {
  /** fills the picker hosts ("inline" falls back to "rows" where it is not listed) */
  fills: readonly OfferFill[];
  media: readonly OfferMedia[];
  /** the picker has a compact density */
  density: boolean;
}

/** Allowed values per picker (the panel disables the others and says why). */
export const DISPLAY_RULES: Readonly<Record<OfferPicker, DisplayRule>> = {
  stack: { fills: ["auto", "inline", "rows", "steps", "box"], media: ["auto", "none", "thumb"], density: true },
  tiers: { fills: ["auto", "rows", "steps", "box"], media: ["auto", "none", "large"], density: true },
  ticket: { fills: ["auto", "inline", "rows", "steps", "box"], media: ["auto", "none", "large"], density: true },
  pills: { fills: ["auto", "inline", "rows", "steps", "box"], media: ["auto", "large"], density: false },
  visual: { fills: ["auto", "rows", "steps", "box"], media: ["large"], density: true },
};

const PICKER_NAMES: Record<OfferPicker, string> = { stack: "Rows", tiers: "Columns", ticket: "Passes", pills: "Segments", visual: "Cards" };
const FILL_NAMES: Record<ResolvedFill, string> = { none: "Nothing to personalize", inline: "Inline", rows: "Rows", steps: "Steps", box: "Box" };

/** Does a fixed or chosen unit of `item` have something to pick that a rule does not lock? */
function fillable(item: Item | undefined, rules: Readonly<Record<string, LineRule>> | undefined): boolean {
  if (!item) return false;
  return item.groups.some((g) => {
    if (!g.perUnit) return false; // shared groups are filled once, above the units
    if (isFieldGroup(g)) return true;
    if (isChoiceGroup(g)) return !ruleLock(rules?.[g.id]);
    if (isMatrixGroup(g)) return g.dims.some((d) => !ruleLock(rules?.[`${g.id}.${d.id}`]));
    return false;
  });
}

/**
 * U = the most units to fill in any available offer (units with something to choose that isn't
 * locked: an item to pick, or an option); M = some offer has a choice line with qty ≥ 2.
 */
export function fillStats(doc: Pick<PageDoc, "items" | "offers">): { units: number; multiChoice: boolean } {
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  let units = 0;
  let multiChoice = false;
  for (const o of doc.offers.bundles) {
    if (o.lines.some((l) => "choice" in l.pick && l.qty >= 2)) multiChoice = true;
    if (!offerAvailable(o, doc.items)) continue;
    const n = expandUnits(o, doc.items).filter((s) => (s.choices ? true : fillable(byId.get(s.item ?? ""), s.rules))).length;
    units = Math.max(units, n);
  }
  return { units, multiChoice };
}

/**
 * What the page renders (§E.1): the doc's display (or the archetype pick) with the allowed-values
 * table and the fallbacks applied, every fallback reported as a note.
 */
export function resolveDisplay(
  doc: Pick<PageDoc, "items" | "offers">,
  ctx: { archetype: Archetype; formVariant: OrderFormVariant | string },
): ResolvedDisplay {
  void ctx; // archetype defaults are chosen by the generator (§E.5); the bold slab renders `solid` as ink (CSS)
  const d: OfferDisplay = doc.offers.display;
  const notes: DisplayNote[] = [];
  const n = doc.offers.bundles.length;
  let picker: OfferPicker = d.picker;
  let density: OfferDensity = d.density;
  let media: OfferMedia = d.media;

  // picker fallbacks by offer count
  const fall = (to: OfferPicker, why: string) => {
    notes.push({ axis: "picker", from: picker, to, message: `Shown as ${PICKER_NAMES[to]}: ${why}` });
    picker = to;
  };
  if (picker === "tiers" && n === 1) fall("stack", "Columns need 2 offers or more.");
  else if (picker === "pills" && n === 1) fall("stack", "Segments need 2 offers or more.");
  else if (picker === "visual" && n === 1) {
    fall("stack", "Cards need 2 offers or more.");
    if (media !== "thumb") notes.push({ axis: "media", from: media, to: "thumb", message: "Shown with a thumbnail." });
    media = "thumb";
  } else if ((picker === "tiers" || picker === "ticket" || picker === "pills") && n >= 5) {
    fall("stack", `${PICKER_NAMES[d.picker]} fit 2–4 offers.`);
    if (density !== "compact") notes.push({ axis: "density", from: density, to: "compact", message: "Compact rows for 5 offers or more." });
    density = "compact";
  }
  const rule = DISPLAY_RULES[picker];

  // media
  if (!rule.media.includes(media)) {
    const to: OfferMedia = rule.media.includes("auto") ? "auto" : rule.media[0]!;
    notes.push({ axis: "media", from: media, to, message: `${PICKER_NAMES[picker]} can't show this media: shown as ${to}.` });
    media = to;
  }
  // density (pills have none: ignored, kept as stored)
  if (!rule.density && density === "compact") density = d.density;

  // fill: resolved once per page
  const { units, multiChoice } = fillStats(doc);
  let fill: ResolvedFill;
  const hostsInline = rule.fills.includes("inline");
  if (units === 0) {
    fill = "none";
    if (d.fill !== "auto") notes.push({ axis: "fill", from: d.fill, to: "none", message: "No offer has anything to personalize." });
  } else if (d.fill === "auto") {
    fill = multiChoice && units <= 6 ? "box" : units <= 4 ? (hostsInline ? "inline" : "rows") : "steps";
  } else if (d.fill === "inline" && !hostsInline) {
    fill = "rows";
    notes.push({ axis: "fill", from: "inline", to: "rows", message: `Shown as ${FILL_NAMES.rows}: ${PICKER_NAMES[picker]} can't hold the pieces inside the card.` });
  } else fill = d.fill;

  return { picker, fill, selection: d.selection, media, density, notes };
}
