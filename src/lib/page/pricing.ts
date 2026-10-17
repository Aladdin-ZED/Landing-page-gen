/**
 * Pricing in integer cents (docs/OFFERS.md §C.3) — shared by the server (which ALWAYS recomputes:
 * client totals never count), the renderer, the runtime config and the PHP export spec.
 * Pure functions, no dependencies beyond the page model.
 *
 *   offerMath(doc, offer)        card numbers: from ("Dès"), reference, savings, per-unit
 *   selectionDeltas(doc, sel)    surcharges of a resolved selection (options, fields, choice prices, extras)
 *   orderTotals(doc, sel)        price + deltas + bump + delivery (effectiveFree)
 *   allocate(doc, offer, sel)    the offer price split per unit (pixels, admin)
 *   offerWarnings(doc)           honesty / consistency warnings for the editors
 *
 * Money in the document has ≤ 2 decimals (schema `Money`), so toCents is exact; fromCents is used
 * once, for display and storage. `bundleMath` / `defaultBundleId` are the v1 names, kept one release.
 */
import { defaultOfferId, expandUnits, isLegacyOffer, itemShort, offerAvailable, offerName, offerSignature, offerUnits } from "./catalog";
import { availableOptions, groupDeltaRange, itemAvailable, itemDeltaRange, parseCellKey, resolveCombo } from "./options";
import { isChoiceGroup, isChoicePick, isFieldGroup, isFixedPick, isMatrixGroup, type Item, type Offer, type OfferLine, type PageDoc } from "./schema";

import { fromCents, round2, toCents, type Cents } from "./money";

export { fromCents, round2, toCents, type Cents };

type PricingDoc = Pick<PageDoc, "items" | "offers">;
type NamedDoc = Pick<PageDoc, "items" | "offers" | "product">;

/* ------------------------------------------------------------------ */
/* Offer math                                                          */
/* ------------------------------------------------------------------ */

export interface OfferMath {
  id: string;
  /** Σ qty (free included) */
  units: number;
  /** offer.price */
  price: Cents;
  /** price + minUnitDeltas: the lowest payable total of the units → the card price */
  from: Cents;
  /** maxUnitDeltas > minUnitDeltas → "Dès" */
  variable: boolean;
  /** compareAt ?? automatic reference (declared list, stable) */
  reference: Cents;
  /** reference + minUnitDeltas: struck next to `from` */
  displayReference: Cents;
  /** max(0, reference − price) (= displayReference − from) */
  savings: Cents;
  /** round(savings / displayReference × 100), 0..99 */
  savingsPct: number;
  /** round(from / units) when units > 1 and every paid unit is the same item or the same choice set */
  perUnit: Cents | null;
  /** savings ≥ 1 */
  showReference: boolean;
}

const byIdOf = (items: readonly Item[]) => new Map(items.map((it) => [it.id, it]));

/** Items sold in a paid line (fixed or as a choice) of an available offer: free lines of them count in the reference. */
function soldPaid(doc: PricingDoc): Set<string> {
  const out = new Set<string>();
  for (const o of doc.offers.bundles) {
    if (!offerAvailable(o, doc.items)) continue;
    for (const l of o.lines) {
      if (l.free) continue;
      if (isFixedPick(l.pick)) out.add(l.pick.item);
      else for (const id of l.pick.choice) out.add(id);
    }
  }
  return out;
}

/** Declared prices of a choice line, ascending (cents). */
function declaredPrices(line: OfferLine, byId: ReadonlyMap<string, Item>): Cents[] {
  if (!isChoicePick(line.pick)) return [];
  return line.pick.choice
    .map((id) => byId.get(id))
    .filter((it): it is Item => !!it)
    .map((it) => toCents(it.price))
    .sort((a, b) => a - b);
}

/** Base of a choice line on its DECLARED list: non-distinct qty × cheapest, distinct Σ of the qty cheapest. */
function choiceBase(line: OfferLine, byId: ReadonlyMap<string, Item>): Cents {
  const prices = declaredPrices(line, byId);
  if (!prices.length || !isChoicePick(line.pick)) return 0;
  if (!line.pick.distinct) return line.qty * prices[0]!;
  return prices.slice(0, line.qty).reduce((n, p) => n + p, 0);
}

/** Automatic reference of a line (§C.3); free lines count only when their item(s) are sold paid on the page. */
function lineReference(line: OfferLine, byId: ReadonlyMap<string, Item>, sold: ReadonlySet<string>): Cents {
  if (isFixedPick(line.pick)) {
    const it = byId.get(line.pick.item);
    if (!it) return 0;
    if (line.free && !sold.has(it.id)) return 0;
    return line.qty * toCents(it.price);
  }
  if (line.free && !line.pick.choice.every((id) => sold.has(id))) return 0;
  return choiceBase(line, byId);
}

interface UnitRange {
  ok: boolean;
  min: Cents;
  max: Cents;
}

/** `n` smallest (or largest) values summed. */
const sumExtreme = (values: readonly number[], n: number, largest: boolean) =>
  [...values]
    .sort((a, b) => (largest ? b - a : a - b))
    .slice(0, n)
    .reduce((s, v) => s + v, 0);

/**
 * Min / max of the payable unit surcharges (options of required groups, choice-line differences),
 * exact on availability and rules. Fields, extras and the bump are opt-in add-ons: never here.
 */
function unitDeltaRange(doc: PricingDoc, offer: Offer): UnitRange {
  const byId = byIdOf(doc.items);
  let min = 0;
  let max = 0;
  for (const l of offer.lines) {
    if (l.free) continue; // free units add 0
    if (isFixedPick(l.pick)) {
      const it = byId.get(l.pick.item);
      const r = it && !it.soldOut ? itemDeltaRange(it, l.rules) : null;
      if (!r) return { ok: false, min: 0, max: 0 };
      min += l.qty * r.min;
      max += l.qty * r.max;
      continue;
    }
    const cands = l.pick.choice
      .map((id) => byId.get(id))
      .filter((it): it is Item => !!it && itemAvailable(it))
      .map((it) => ({ price: toCents(it.price), r: itemDeltaRange(it)! }));
    const need = l.pick.distinct ? l.qty : 1;
    if (cands.length < need) return { ok: false, min: 0, max: 0 };
    const diff = l.pick.surcharge === "difference";
    const lo = cands.map((c) => (diff ? c.price : 0) + c.r.min);
    const hi = cands.map((c) => (diff ? c.price : 0) + c.r.max);
    const base = diff ? choiceBase(l, byId) : 0;
    if (l.pick.distinct) {
      min += sumExtreme(lo, l.qty, false) - base;
      max += sumExtreme(hi, l.qty, true) - base;
    } else {
      min += l.qty * Math.min(...lo) - base;
      max += l.qty * Math.max(...hi) - base;
    }
  }
  return { ok: true, min, max };
}

/** Every paid unit is the same item, or the same choice set (per-unit prices are only honest then). */
function sameUnits(offer: Offer): boolean {
  const paid = offer.lines.filter((l) => !l.free);
  const keys = new Set(paid.map((l) => (isFixedPick(l.pick) ? `i:${l.pick.item}` : `c:${[...l.pick.choice].sort().join("|")}`)));
  return keys.size === 1;
}

/** Card numbers of an offer (§C.3), integer cents. */
export function offerMath(doc: PricingDoc, offer: Offer, sold: ReadonlySet<string> = soldPaid(doc)): OfferMath {
  const byId = byIdOf(doc.items);
  const units = offerUnits(offer);
  const price = toCents(offer.price);
  const auto = offer.lines.reduce((n, l) => n + lineReference(l, byId, sold), 0);
  // an explicit compare-at below the price shows no saving (warned in the editor), as in v1
  const reference = offer.compareAt !== undefined ? toCents(offer.compareAt) : auto;
  const range = unitDeltaRange(doc, offer);
  const from = price + range.min;
  const displayReference = reference + range.min;
  const savings = Math.max(0, reference - price);
  const savingsPct = displayReference > 0 ? Math.min(99, Math.max(0, Math.round((savings / displayReference) * 100))) : 0;
  return {
    id: offer.id,
    units,
    price,
    from,
    variable: range.max > range.min,
    reference,
    displayReference,
    savings,
    savingsPct,
    perUnit: units > 1 && sameUnits(offer) ? Math.round(from / units) : null,
    showReference: savings >= 1,
  };
}

/** offerMath of every offer of the page (the free-line rule is computed once). */
export function offersMath(doc: PricingDoc): OfferMath[] {
  const sold = soldPaid(doc);
  return doc.offers.bundles.map((o) => offerMath(doc, o, sold));
}

/* ------------------------------------------------------------------ */
/* Selections                                                          */
/* ------------------------------------------------------------------ */

/** One unit of a resolved selection: the item and its values (choice: option id · matrix: cell key · field: cleaned text). */
export interface UnitChoice {
  item: string;
  options: Record<string, string>;
  fields: Record<string, string>;
}
/**
 * A resolved selection (src/lib/orders/validate.ts resolveSelection). Shared groups carry their value
 * in every unit of that item (the server reads it from the first unit of the item).
 */
export interface Selection {
  offerId: string;
  units: UnitChoice[];
  /** order extras: choice option id or field text, by group id */
  extras: Record<string, string>;
  bump: boolean;
  bumpUnit?: UnitChoice;
}

/** A selection with nothing chosen (pages without options, server-rendered first paint). */
export const emptySelection = (offerId: string, bump = false): Selection => ({ offerId, units: [], extras: {}, bump });

/** A surcharge row of the summary: "XL" · "Gravure" ×2 · "Sérum". `cents` = total of the row. */
export interface DeltaReason {
  key: string;
  label: string;
  count: number;
  cents: Cents;
}

interface DeltaBreakdown {
  /** surcharges of each unit (free units 0); shared fields charged once, on the first paid unit of the item */
  perUnit: Cents[];
  /** extras (once per order) */
  extras: Cents;
  reasons: DeltaReason[];
}

function breakdown(doc: NamedDoc, offer: Offer, sel: Selection): DeltaBreakdown {
  const byId = byIdOf(doc.items);
  const slots = expandUnits(offer, doc.items);
  const perUnit = slots.map(() => 0);
  const reasons = new Map<string, DeltaReason>();
  const add = (k: number | null, key: string, label: string, c: Cents) => {
    if (!(c > 0)) return;
    if (k !== null) perUnit[k] = (perUnit[k] ?? 0) + c;
    const r = reasons.get(key);
    if (r) {
      r.count++;
      r.cents += c;
    } else reasons.set(key, { key, label, count: 1, cents: c });
  };
  const sharedFields = new Set<string>();

  slots.forEach((slot, k) => {
    if (slot.free) return; // free units never pay deltas
    const unit = sel.units[k];
    const it = byId.get(slot.item ?? unit?.item ?? "");
    if (!it || !unit) return;
    for (const g of it.groups) {
      if (isChoiceGroup(g)) {
        const o = g.options.find((x) => x.id === unit.options[g.id]);
        if (o?.delta) add(k, `o:${it.id}:${g.id}:${o.id}`, o.label, toCents(o.delta));
      } else if (isMatrixGroup(g)) {
        const combo = unit.options[g.id] ? parseCellKey(unit.options[g.id]!) : null;
        const res = combo ? resolveCombo(g, combo, it) : null;
        if (!res || !(res.delta > 0)) continue;
        if (res.fromCell) add(k, `m:${it.id}:${g.id}:${res.key}`, res.values.map((v) => v.value.label).join("/"), res.delta);
        else for (const v of res.values) if (v.value.delta) add(k, `m:${it.id}:${g.id}:${v.dim.id}=${v.value.id}`, v.value.label, toCents(v.value.delta));
      } else if (isFieldGroup(g) && g.delta && (unit.fields[g.id] ?? "") !== "") {
        if (g.perUnit) add(k, `f:${it.id}:${g.id}`, g.name, toCents(g.delta));
        else if (!sharedFields.has(`${it.id}:${g.id}`)) {
          sharedFields.add(`${it.id}:${g.id}`);
          add(k, `f:${it.id}:${g.id}`, g.name, toCents(g.delta));
        }
      }
    }
  });

  // choice lines with "difference": pricier items cost their difference (shares: sorted chosen − sorted base)
  offer.lines.forEach((l) => {
    if (l.free || !isChoicePick(l.pick) || l.pick.surcharge !== "difference") return;
    const ks = slots.filter((s) => s.lineId === l.id).map((s) => s.k);
    const declared = declaredPrices(l, byId);
    if (!declared.length) return;
    const base = l.pick.distinct ? declared.slice(0, l.qty) : Array.from({ length: l.qty }, () => declared[0]!);
    const chosen = ks
      .map((k) => ({ k, it: byId.get(sel.units[k]?.item ?? "") }))
      .filter((x): x is { k: number; it: Item } => !!x.it)
      .map((x) => ({ ...x, price: toCents(x.it.price) }))
      .sort((a, b) => a.price - b.price || a.k - b.k);
    chosen.forEach((c, i) => add(c.k, `s:${l.id}:${c.it.id}`, itemShort(doc, c.it), Math.max(0, c.price - (base[i] ?? base[base.length - 1]!))));
  });

  // order extras in scope: once per order
  let extras = 0;
  for (const x of doc.offers.extras) {
    if (x.scope !== "all" && !x.scope.includes(offer.id)) continue;
    const value = sel.extras[x.id];
    if (value === undefined || value === "") continue;
    let c = 0;
    if (isChoiceGroup(x)) c = toCents(x.options.find((o) => o.id === value)?.delta ?? 0);
    else if (x.delta) c = toCents(x.delta);
    if (c > 0) {
      extras += c;
      add(null, `x:${x.id}`, x.name, c);
    }
  }
  return { perUnit, extras, reasons: [...reasons.values()] };
}

/** Surcharges of a resolved selection (§C.3): options and fields per paid unit, choice-line differences, extras. */
export function selectionDeltas(doc: NamedDoc, sel: Selection): { total: Cents; reasons: DeltaReason[] } {
  const offer = doc.offers.bundles.find((o) => o.id === sel.offerId);
  if (!offer) return { total: 0, reasons: [] };
  const b = breakdown(doc, offer, sel);
  return { total: b.perUnit.reduce((n, c) => n + c, 0) + b.extras, reasons: b.reasons };
}

export interface OrderTotals {
  offer: OfferMath;
  deltas: Cents;
  reasons: DeltaReason[];
  bump: Cents;
  shipping: Cents;
  /** price + deltas + bump */
  subtotal: Cents;
  /** subtotal + shipping */
  total: Cents;
}

/** No delivery fee for this order: the page charges none, or the offer has free delivery (D10). */
export const effectiveFree = (doc: Pick<PageDoc, "offers">, offer: Pick<Offer, "freeShipping">): boolean => doc.offers.shippingFee === 0 || offer.freeShipping;

/** No delivery fee whatever the offer: the page charges none, or every offer has free delivery ("Livraison gratuite" said once). */
export const everyOfferFree = (doc: Pick<PageDoc, "offers">): boolean => doc.offers.shippingFee === 0 || (doc.offers.bundles.length > 0 && doc.offers.bundles.every((o) => o.freeShipping));

/** Is the bump offered with this offer? (enabled, and the offer is in its list when it has one) */
export const bumpOffered = (doc: Pick<PageDoc, "offers">, offerId: string): boolean => {
  const b = doc.offers.orderBump;
  return !!b?.enabled && (!b.offers || b.offers.includes(offerId));
};

/** Totals of a resolved selection, integer cents. Computes the deltas itself: no caller-supplied deltas. */
export function orderTotals(doc: NamedDoc, sel: Selection): OrderTotals | null {
  const offer = doc.offers.bundles.find((o) => o.id === sel.offerId);
  if (!offer) return null;
  const math = offerMath(doc, offer);
  const { total: deltas, reasons } = selectionDeltas(doc, sel);
  const bump = sel.bump && bumpOffered(doc, offer.id) ? toCents(doc.offers.orderBump!.price) : 0;
  const shipping = effectiveFree(doc, offer) ? 0 : toCents(doc.offers.shippingFee);
  const subtotal = math.price + deltas + bump;
  return { offer: math, deltas, reasons, bump, shipping, subtotal, total: subtotal + shipping };
}

/**
 * The offer price split per unit (pixels contents, admin): largest-remainder split by unit references
 * (the unit's item price; equal split when they sum to 0) + the unit's own surcharges; free units 0.
 * Σ = offer price + unit surcharges (extras and bump excluded).
 */
export function allocate(doc: NamedDoc, offer: Offer, sel: Selection): Cents[] {
  const byId = byIdOf(doc.items);
  const slots = expandUnits(offer, doc.items);
  const refs = slots.map((s, k) => (s.free ? 0 : toCents(byId.get(s.item ?? sel.units[k]?.item ?? "")?.price ?? 0)));
  const paid = slots.filter((s) => !s.free).map((s) => s.k);
  const price = toCents(offer.price);
  const out = slots.map(() => 0);
  if (paid.length) {
    const sum = paid.reduce((n, k) => n + refs[k]!, 0);
    const weights = paid.map((k) => (sum > 0 ? refs[k]! : 1));
    const total = weights.reduce((n, w) => n + w, 0);
    const exact = weights.map((w) => (price * w) / total);
    const floors = exact.map(Math.floor);
    let left = price - floors.reduce((n, f) => n + f, 0);
    const order = exact.map((e, i) => ({ i, r: e - floors[i]! })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (const { i } of order) {
      if (left <= 0) break;
      floors[i]!++;
      left--;
    }
    paid.forEach((k, i) => (out[k] = floors[i]!));
  }
  const b = breakdown(doc, offer, sel);
  return out.map((c, k) => (slots[k]!.free ? 0 : c + (b.perUnit[k] ?? 0)));
}

/* ------------------------------------------------------------------ */
/* Editor warnings                                                     */
/* ------------------------------------------------------------------ */

export interface OfferWarning {
  code:
    | "per_unit_higher"
    | "compare_below_price"
    | "popular_twice"
    | "best_twice"
    | "same_contents"
    | "no_saving"
    | "choice_prices_differ"
    | "deltas_free_only"
    | "gift_not_sold"
    | "every_option_priced"
    | "cheapest_sold_out"
    | "all_free_delivery";
  level: "warning" | "info";
  offerId?: string;
  message: string;
}

/** Sanity rules surfaced in the editors (replaces bundleWarnings). Admin English. */
export function offerWarnings(doc: Pick<PageDoc, "items" | "offers" | "product" | "locale">): OfferWarning[] {
  const w: OfferWarning[] = [];
  const offers = doc.offers.bundles;
  const byId = byIdOf(doc.items);
  const sold = soldPaid(doc);
  const label = (o: Offer) => (isLegacyOffer(doc, o) ? `Pack x${offerUnits(o)}` : `“${offerName({ doc }, o)}”`);
  const math = new Map(offers.map((o) => [o.id, offerMath(doc, o, sold)]));
  const money = (c: number) => String(fromCents(c));

  // per-unit price above a smaller offer of the same single item
  const singles = new Map<string, Offer[]>();
  for (const o of offers) {
    if (!o.lines.every((l) => !l.free && isFixedPick(l.pick))) continue;
    const ids = new Set(o.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : "")));
    if (ids.size !== 1) continue;
    const id = [...ids][0]!;
    singles.set(id, [...(singles.get(id) ?? []), o]);
  }
  for (const list of singles.values()) {
    let prev = Infinity;
    for (const o of [...list].sort((a, b) => offerUnits(a) - offerUnits(b))) {
      const per = round2(o.price / offerUnits(o));
      if (per > prev + 0.001) w.push({ code: "per_unit_higher", level: "warning", offerId: o.id, message: `${label(o)}: price per item (${per}) is higher than a smaller pack.` });
      prev = Math.min(prev, per);
    }
  }
  for (const o of offers) {
    const m = math.get(o.id)!;
    if (o.compareAt !== undefined && o.compareAt < o.price) w.push({ code: "compare_below_price", level: "warning", offerId: o.id, message: `${label(o)}: "compare at" is lower than the price.` });
    if (m.units >= 2 && m.price >= m.reference) w.push({ code: "no_saving", level: "info", offerId: o.id, message: `${label(o)}: the price is not below the price of its pieces bought alone.` });
    for (const l of o.lines) {
      if (isChoicePick(l.pick) && l.pick.surcharge === "none") {
        const prices = new Set(l.pick.choice.map((id) => byId.get(id)?.price).filter((p) => p !== undefined));
        if (prices.size > 1) w.push({ code: "choice_prices_differ", level: "info", offerId: o.id, message: `${label(o)}: the products to choose from have different prices; the cheapest sets the struck price.` });
      }
      if (l.free) {
        const ids = isFixedPick(l.pick) ? [l.pick.item] : l.pick.choice;
        for (const id of ids) {
          if (sold.has(id)) continue;
          const it = byId.get(id);
          w.push({ code: "gift_not_sold", level: "warning", offerId: o.id, message: `Gift item ${it ? itemShort(doc, it) : id} isn't sold on this page; its price is not counted in the savings.` });
        }
      }
      if (isChoicePick(l.pick) && !l.free) {
        const declared = l.pick.choice.map((id) => byId.get(id)).filter((it): it is Item => !!it);
        const cheapest = Math.min(...declared.map((it) => it.price));
        const avail = declared.filter((it) => itemAvailable(it));
        if (declared.length && avail.length && declared.filter((it) => it.price === cheapest).every((it) => !itemAvailable(it)))
          w.push({ code: "cheapest_sold_out", level: "info", offerId: o.id, message: `${label(o)}: the cheapest choice is sold out; the card now shows from ${money(m.from)}.` });
      }
    }
    if (m.variable || m.from > m.price) {
      for (const l of o.lines) {
        if (l.free || !isFixedPick(l.pick)) continue;
        const it = byId.get(l.pick.item);
        for (const g of it?.groups ?? []) {
          if (!isChoiceGroup(g)) continue;
          const opts = availableOptions(g, l.rules);
          if (opts.length && opts.every((x) => (x.delta ?? 0) > 0)) w.push({ code: "every_option_priced", level: "info", offerId: o.id, message: `${label(o)}: every “${g.name}” option adds a price; the card shows from ${money(m.from)}.` });
        }
      }
    }
  }
  if (offers.filter((b) => b.badge === "popular").length > 1) w.push({ code: "popular_twice", level: "warning", message: "More than one pack is marked “popular”." });
  if (offers.filter((b) => b.badge === "best").length > 1) w.push({ code: "best_twice", level: "warning", message: "More than one pack is marked “best price”." });
  const sigs = offers.map((o) => offerSignature(o));
  if (new Set(sigs).size !== sigs.length) {
    const legacy = offers.every((o) => isLegacyOffer(doc, o));
    w.push({ code: "same_contents", level: "warning", message: legacy ? "Two packs have the same quantity." : "Two offers have the same contents." });
  }
  // deltas on an item only sold in free lines
  for (const it of doc.items) {
    if (sold.has(it.id)) continue;
    const inFree = offers.some((o) => o.lines.some((l) => l.free && (isFixedPick(l.pick) ? l.pick.item === it.id : l.pick.choice.includes(it.id))));
    const priced = it.groups.some((g) => (groupDeltaRange(g)?.max ?? 0) > 0 || (isFieldGroup(g) && (g.delta ?? 0) > 0));
    if (inFree && priced) w.push({ code: "deltas_free_only", level: "info", message: `${itemShort(doc, it)} is only given for free: its option prices are never charged.` });
  }
  if (doc.offers.shippingFee > 0 && offers.length && offers.every((o) => o.freeShipping))
    w.push({ code: "all_free_delivery", level: "warning", message: "Every offer has free delivery: set the delivery fee to 0." });
  return w;
}

/* ------------------------------------------------------------------ */
/* v1 names (one release)                                              */
/* ------------------------------------------------------------------ */

/** @deprecated one release: v1 view of OfferMath, in currency units. */
export interface BundleMath {
  id: string;
  /** units (Σ qty) */
  qty: number;
  /** the card price (`from`; = price on v1-shaped offers) */
  total: number;
  /** the struck reference (`displayReference`) */
  reference: number;
  savings: number;
  /** whole percent, 0..99 */
  savingsPct: number;
  /** from / units (also for one unit, as in v1) */
  perUnit: number;
  /** show struck-through reference only if there is a real saving */
  showReference: boolean;
}

/** @deprecated one release: offerMath in currency units (identical to v1 bundleMath on v1-shaped offers). */
export function bundleMath(doc: PricingDoc, offer: Offer): BundleMath {
  const m = offerMath(doc, offer);
  return {
    id: m.id,
    qty: m.units,
    total: fromCents(m.from),
    reference: fromCents(m.displayReference),
    savings: fromCents(m.savings),
    savingsPct: m.savingsPct,
    perUnit: fromCents(m.perUnit ?? Math.round(m.from / Math.max(1, m.units))),
    showReference: m.showReference,
  };
}

/** @deprecated one release: use defaultOfferId. */
export const defaultBundleId = defaultOfferId;
export { defaultOfferId };
