/**
 * Pure edit operations of one offer's contents (docs/OFFERS.md §H.4 contents composer): add a unit
 * of a shelf product (merges into that product's plain fixed line), quantities, gift (free) lines,
 * labels, "let the customer choose" (choice lines: allowed items, all different, price follows
 * the choice), option rules on fixed lines (fix / limit / preset), the Total ↔ Discount % price,
 * duplicate, and the page-wide one-popular / one-best / one-preselected rules.
 *
 * Every function returns a new offer that stays schema-valid (Σ qty ≤ 20, ≤ 6 lines, a paid line
 * kept, distinct ⇒ qty ≤ choices, rules only on fixed lines, ≤ 3 rule keys).
 */
import { ruleTarget } from "@/lib/page/options";
import { isChoicePick, isFixedPick, LIMITS, type Item, type LineRule, type Offer, type OfferLine, type Offers } from "@/lib/page/schema";
import { discounted, offerId } from "./presets";

const units = (lines: readonly OfferLine[]) => lines.reduce((n, l) => n + l.qty, 0);

/** Line ids l1, l2… kept stable; a new line gets the next free one. */
function nextLineId(lines: readonly OfferLine[]): string {
  const used = new Set(lines.map((l) => l.id));
  for (let i = 1; ; i++) if (!used.has(`l${i}`)) return `l${i}`;
}

/** Room for `n` more units in the offer. */
export const roomFor = (offer: Pick<Offer, "lines">, n = 1) => units(offer.lines) + n <= LIMITS.unitsPerOffer;

/** One more unit of `itemId`: into its plain fixed paid line (no rules, no label), else a new line. */
export function addUnit(offer: Offer, itemId: string): Offer {
  if (!roomFor(offer)) return offer;
  const at = offer.lines.findIndex((l) => isFixedPick(l.pick) && l.pick.item === itemId && !l.free && !l.label && !l.rules);
  if (at >= 0) return { ...offer, lines: offer.lines.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l)) };
  if (offer.lines.length >= LIMITS.linesPerOffer) return offer;
  return { ...offer, lines: [...offer.lines, { id: nextLineId(offer.lines), qty: 1, pick: { item: itemId }, free: false }] };
}

export function setQty(offer: Offer, lineId: string, qty: number): Offer {
  const l = offer.lines.find((x) => x.id === lineId);
  if (!l) return offer;
  const max = LIMITS.unitsPerOffer - (units(offer.lines) - l.qty);
  let q = Math.max(1, Math.min(20, max, Math.round(qty)));
  if (isChoicePick(l.pick) && l.pick.distinct) q = Math.min(q, l.pick.choice.length);
  return patchLine(offer, lineId, { qty: q });
}

export function patchLine(offer: Offer, lineId: string, patch: Partial<OfferLine>): Offer {
  return { ...offer, lines: offer.lines.map((l) => (l.id === lineId ? clean({ ...l, ...patch }) : l)) };
}

/** Removing a line never leaves an offer without a paid line (null = can't). */
export function removeLine(offer: Offer, lineId: string): Offer | null {
  const lines = offer.lines.filter((l) => l.id !== lineId);
  if (!lines.length || !lines.some((l) => !l.free)) return null;
  return { ...offer, lines };
}

/** Gift (free) on / off; the last paid line can't become free. */
export function setFree(offer: Offer, lineId: string, free: boolean): Offer | null {
  const next = patchLine(offer, lineId, { free });
  return next.lines.some((l) => !l.free) ? next : null;
}

function clean(l: OfferLine): OfferLine {
  const next = { ...l };
  if (!next.label?.trim()) delete next.label;
  if (isChoicePick(next.pick) || (next.rules && !Object.keys(next.rules).length)) delete next.rules;
  return next;
}

/** Let the customer choose among `choice` (2–8 items) on this line; one item → back to a fixed line. */
export function setChoice(offer: Offer, lineId: string, choice: readonly string[]): Offer {
  const l = offer.lines.find((x) => x.id === lineId);
  if (!l) return offer;
  const list = [...new Set(choice)].slice(0, 8);
  if (list.length < 2) {
    const item = list[0] ?? (isFixedPick(l.pick) ? l.pick.item : l.pick.choice[0]!);
    return patchLine(offer, lineId, { pick: { item } });
  }
  const prev = isChoicePick(l.pick) ? l.pick : { distinct: false, surcharge: "none" as const };
  const distinct = prev.distinct && l.qty <= list.length;
  const next: OfferLine = { ...l, pick: { choice: list, distinct, surcharge: prev.surcharge } };
  delete next.rules;
  return { ...offer, lines: offer.lines.map((x) => (x.id === lineId ? next : x)) };
}

export function setChoiceFlags(offer: Offer, lineId: string, flags: { distinct?: boolean; surcharge?: "none" | "difference" }): Offer {
  const l = offer.lines.find((x) => x.id === lineId);
  if (!l || !isChoicePick(l.pick)) return offer;
  const distinct = flags.distinct ?? l.pick.distinct;
  const qty = distinct ? Math.min(l.qty, l.pick.choice.length) : l.qty;
  return patchLine(offer, lineId, { qty, pick: { ...l.pick, distinct, surcharge: flags.surcharge ?? l.pick.surcharge } });
}

/** Set / clear one option rule of a fixed line (≤ 3 keys; preset ∈ allow). */
export function setRule(offer: Offer, lineId: string, key: string, rule: LineRule | null): Offer {
  const l = offer.lines.find((x) => x.id === lineId);
  if (!l || !isFixedPick(l.pick)) return offer;
  const rules = { ...(l.rules ?? {}) };
  if (rule) {
    if (!(key in rules) && Object.keys(rules).length >= LIMITS.rulesPerLine) return offer;
    rules[key] = rule;
  } else delete rules[key];
  return patchLine(offer, lineId, { rules });
}

/** The rule targets of an item (per-piece choice groups and matrix dims), for the rules UI. */
export function ruleTargets(item: Item): { key: string; name: string; values: { id: string; label: string; swatch?: string; soldOut: boolean }[] }[] {
  const out: { key: string; name: string; values: { id: string; label: string; swatch?: string; soldOut: boolean }[] }[] = [];
  for (const g of item.groups) {
    if (!g.perUnit) continue;
    if (g.kind === "field") continue;
    if (g.kind === "matrix") for (const d of g.dims) out.push({ key: `${g.id}.${d.id}`, name: d.name, values: d.values });
    else out.push({ key: g.id, name: g.name, values: g.options });
  }
  return out.filter((t) => !!ruleTarget(item, t.key));
}

/** Split one unit off a line into its own line (to lock another color on it: "1 Noir + 1 Blanc"). */
export function splitUnit(offer: Offer, lineId: string): Offer {
  const at = offer.lines.findIndex((l) => l.id === lineId);
  const l = offer.lines[at];
  if (!l || l.qty < 2 || offer.lines.length >= LIMITS.linesPerOffer) return offer;
  const lines = [...offer.lines];
  lines[at] = { ...l, qty: l.qty - 1 };
  const copy: OfferLine = { ...l, id: nextLineId(offer.lines), qty: 1 };
  lines.splice(at + 1, 0, copy);
  return { ...offer, lines };
}

/* ------------------------------------------------------------------ */
/* price                                                               */
/* ------------------------------------------------------------------ */

/** Price for "−pct %" off the automatic reference, charm-rounded (charm.ts rule). */
export const priceForDiscount = (reference: number, pct: number, currency: string) => discounted(reference, Math.max(1, Math.min(90, pct)), currency);

/* ------------------------------------------------------------------ */
/* offers list                                                         */
/* ------------------------------------------------------------------ */

/** A copy right after the original (new id, not preselected, no badge clash). */
export function duplicateOffer(offers: Offers, id: string): Offers {
  if (offers.bundles.length >= LIMITS.offers) return offers;
  const at = offers.bundles.findIndex((o) => o.id === id);
  const src = offers.bundles[at];
  if (!src) return offers;
  const copy: Offer = { ...structuredClone(src), id: offerId(offers.bundles.map((o) => o.id)), preselected: false, badge: src.badge === "popular" || src.badge === "best" ? "none" : src.badge };
  const bundles = [...offers.bundles];
  bundles.splice(at + 1, 0, copy);
  return { ...offers, bundles };
}

/** Replace an offer; one popular, one best and one preselected per page. */
export function putOffer(offers: Offers, next: Offer): Offers {
  const bundles = offers.bundles.map((o) => {
    if (o.id === next.id) return next;
    let x = o;
    if ((next.badge === "popular" || next.badge === "best") && o.badge === next.badge) x = { ...x, badge: "none" };
    if (next.preselected && o.preselected) x = { ...x, preselected: false };
    return x;
  });
  return { ...offers, bundles };
}

export function removeOffer(offers: Offers, id: string): Offers | null {
  if (offers.bundles.length <= 1) return null;
  const bundles = offers.bundles.filter((o) => o.id !== id);
  const ids = new Set(bundles.map((o) => o.id));
  const next: Offers = { ...offers, bundles };
  if (next.orderBump?.offers) {
    const list = next.orderBump.offers.filter((x) => ids.has(x));
    next.orderBump = { ...next.orderBump };
    if (list.length) next.orderBump.offers = list;
    else delete next.orderBump.offers;
  }
  next.extras = next.extras.flatMap((x) => (x.scope === "all" ? [x] : x.scope.filter((s) => ids.has(s)).length ? [{ ...x, scope: x.scope.filter((s) => ids.has(s)) }] : []));
  return next;
}

export function moveOffer(offers: Offers, id: string, by: number): Offers {
  const at = offers.bundles.findIndex((o) => o.id === id);
  const to = Math.max(0, Math.min(offers.bundles.length - 1, at + by));
  if (at < 0 || at === to) return offers;
  const bundles = [...offers.bundles];
  const [o] = bundles.splice(at, 1);
  bundles.splice(to, 0, o!);
  return { ...offers, bundles };
}

/** A blank offer: one unit of the lead item at its price. */
export function blankOffer(offers: Offers, item: Item): Offer {
  return { id: offerId(offers.bundles.map((o) => o.id)), lines: [{ id: "l1", qty: 1, pick: { item: item.id }, free: false }], perks: [], price: item.price, badge: "none", freeShipping: false, visual: { mode: "auto" }, preselected: false, soldOut: false };
}
