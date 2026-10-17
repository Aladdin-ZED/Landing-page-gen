/**
 * Offer presets and suggestions (docs/OFFERS.md §H.1) — pure, shared by the generate wizard, the
 * generator and the builder's "+ Offer" / "Suggest offers".
 *
 *   presetOffer(p, doc, opts)   one offer of a kind ("Pack ×2", "Au choix", "Duo", "1 + 1 offert"…)
 *   suggestOffers(doc, texts)   the offers a page should start with, from its items and group photos
 *
 * Honesty rules (owner: never invent prices, ratings or stock):
 *   - every price is derived from the owner's item prices with charm rounding (charm.ts);
 *   - `compareAt` is never set: the struck price is the automatic reference (the pieces bought alone);
 *   - a pack of 2+ pieces costs less than its reference, and the bigger the pack, the lower the price
 *     relative to its reference (per piece, for same-item packs);
 *   - `freeShipping: false` (D10): delivery follows the page fee;
 *   - ≤ 8 offers, unique ids, at most one "popular" and one "best".
 */
import { groupPhotos, offerUnits } from "./catalog";
import { charmBetween, priceStep } from "./charm";
import { round2 } from "./money";
import { itemAvailable } from "./options";
import { offerMath } from "./pricing";
import {
  DEFAULT_OFFER_DISPLAY,
  isChoiceGroup,
  isFixedPick,
  isMatrixGroup,
  LIMITS,
  type AssetRef,
  type Item,
  type LineRule,
  type Offer,
  type OfferLine,
  type PageDoc,
} from "./schema";
import { uniqueId } from "./upgrade";
import { inferPreset } from "./variant-presets";

/* ------------------------------------------------------------------ */
/* Texts                                                               */
/* ------------------------------------------------------------------ */

/** Title (≤ 60), subtitle (≤ 90) and segment label (≤ 14) of a suggested offer; "" = automatic. `{n}` = a count. */
export interface OfferText {
  title: string;
  subtitle?: string;
  short?: string;
}

/**
 * Names of the suggested offers in the page language (the copy library, src/lib/ai/copy-library,
 * `common.offers`; see generator/offers.ts `offerTextsFor`). Empty titles leave the automatic names
 * (catalog.ts `offerName`), which follow the items when they are renamed.
 */
export interface OfferTexts {
  /** one item ×1 / ×2 / ×3 (the page copy's `bundles`: "1 pièce", "Pack Duo", "Pack Trio") */
  packs: readonly OfferText[];
  /** one piece among 2+ items ("Au choix") */
  choice: OfferText;
  /** {n} pieces among 2+ items ("{n} au choix") */
  anyN: OfferText;
  /** two different items together */
  duo: OfferText;
  /** three different items together */
  trio: OfferText;
  /** every item of the page ("Coffret complet") */
  set: OfferText;
  /** one bought, one free ("1 acheté, 1 offert") */
  bogo: OfferText;
  /** one piece per color, each locked to its color ("Pack {n} couleurs") */
  colors: OfferText;
}

/** Offer text caps (schema Offer: title ≤ 60, subtitle ≤ 90, short ≤ 14). */
const TEXT_MAX = { title: 60, subtitle: 90, short: 14 } as const;

const EMPTY: OfferText = { title: "" };
/** No texts: every offer keeps its automatic name. */
export const NO_OFFER_TEXTS: OfferTexts = { packs: [], choice: EMPTY, anyN: EMPTY, duo: EMPTY, trio: EMPTY, set: EMPTY, bogo: EMPTY, colors: EMPTY };

/** First `n` code points, trimmed (never cuts a surrogate pair). */
const clip = (s: string, n: number) => {
  const cps = Array.from(s.trim());
  return (cps.length > n ? cps.slice(0, n).join("") : cps.join("")).trim();
};

/** The title / subtitle / short of a text with its slots filled ("{n}"). */
function named(t: OfferText | undefined, vars: Record<string, string | number> = {}): Pick<Offer, "title" | "subtitle" | "short"> {
  const fill = (s: string | undefined, max: number) => clip((s ?? "").replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)), max);
  const title = fill(t?.title, TEXT_MAX.title);
  const subtitle = fill(t?.subtitle, TEXT_MAX.subtitle);
  const short = fill(t?.short, TEXT_MAX.short);
  return { ...(title ? { title } : {}), ...(subtitle ? { subtitle } : {}), ...(short ? { short } : {}) };
}

/* ------------------------------------------------------------------ */
/* Prices                                                              */
/* ------------------------------------------------------------------ */

/** Price of the units bought alone, relative: ×2 ≈ 1.8, ×3 ≈ 2.5, then +0.65 per piece (per piece always falling). */
const packFactor = (qty: number) => (qty <= 1 ? 1 : qty === 2 ? 1.8 : qty === 3 ? 2.5 : 2.5 + 0.65 * (qty - 3));

/**
 * Price of `qty` pieces of one unit price (or of a choice whose cheapest piece costs `unit`): ×1 at
 * the unit price, ×2 ≈ 1.8×, ×3 ≈ 2.5× (today's suggestBundles numbers), charm-rounded, each pack
 * below the pieces bought alone and cheaper per piece than the smaller pack. null when the unit
 * price is too small for an honest pack.
 */
export function packPrice(unit: number, qty: number, currency: string): number | null {
  const price = round2(Math.max(0, unit));
  if (qty <= 1) return price;
  if (price < 5) return null;
  const prev = packPrice(price, qty - 1, currency);
  if (prev === null) return null;
  // ×2: above ×1, below 2 × unit; ×n: above ×(n−1), below n × unit and cheaper per piece than ×(n−1)
  const ceil = qty === 2 ? price * 2 : Math.min(price * qty, (prev / (qty - 1)) * qty);
  const p = charmBetween(price * packFactor(qty), prev, ceil, currency);
  return p > prev && p < price * qty && (qty === 2 || p / qty < prev / (qty - 1)) ? p : null;
}

/** Combos of different items, relative to their prices bought alone: −15 % for two, −22 % for three… */
const comboFactor = (n: number) => (n <= 1 ? 1 : n === 2 ? 0.85 : n === 3 ? 0.78 : n === 4 ? 0.74 : n === 5 ? 0.72 : 0.7);

/**
 * Price of a combo of different items (one each): charm(factor × Σ), strictly above `floor` (the
 * priciest item alone, or a smaller combo) and below `ceil` (Σ, or Σ at a smaller combo's ratio).
 */
function comboPrice(prices: readonly number[], currency: string, bounds: { floor?: number; ratio?: number } = {}): number | null {
  const sum = round2(prices.reduce((a, b) => a + b, 0));
  if (prices.length < 2 || sum < 5) return null;
  const floor = Math.max(bounds.floor ?? 0, ...prices);
  const ceil = sum * Math.min(1, bounds.ratio ?? 1);
  if (ceil - floor < priceStep(currency) * 2) return null;
  const p = charmBetween(sum * comboFactor(prices.length), floor, ceil, currency);
  return p > floor && p < ceil ? p : null;
}

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

type PresetDoc = Pick<PageDoc, "items" | "currency"> & { offers?: Pick<PageDoc["offers"], "bundles"> };
type SuggestDoc = Pick<PageDoc, "items" | "currency" | "product"> & { offers?: Pick<PageDoc["offers"], "bundles"> };

const fixed = (id: string, item: string, qty = 1, extra: Partial<OfferLine> = {}): OfferLine => ({ id, qty, pick: { item }, free: false, ...extra });

function choiceLine(id: string, items: readonly Item[], qty = 1, free = false): OfferLine {
  const prices = new Set(items.map((it) => it.price));
  // pricier pieces cost their difference: the shopper never gets a 199 item at a 149 price by accident
  return { id, qty, pick: { choice: items.map((it) => it.id), distinct: false, surcharge: prices.size > 1 ? "difference" : "none" }, free };
}

function offer(id: string, lines: OfferLine[], price: number, extra: Partial<Offer> = {}): Offer {
  return {
    id,
    lines: lines.map((l, i) => ({ ...l, id: `l${i + 1}` })),
    perks: [],
    price: round2(price),
    badge: "none",
    freeShipping: false,
    visual: { mode: "auto" },
    preselected: false,
    soldOut: false,
    ...extra,
  };
}

const minPrice = (items: readonly Item[]) => Math.min(...items.map((it) => it.price));

/** A photo of the item that is its own (cutout, crop, or a photo no other item shows); on single-item pages the product photos count. */
export function ownPhoto(doc: Pick<PageDoc, "items"> & { product?: Pick<PageDoc["product"], "images" | "cutout"> }, item: Item): AssetRef | null {
  const group = new Set(groupPhotos(doc).map((g) => g.asset.id));
  const own = item.images.find((r) => !r.box && !group.has(r.id));
  const crop = item.images.find((r) => !!r.box);
  const single = doc.items.length === 1 && doc.product ? (doc.product.images[0] ?? doc.product.cutout) : undefined;
  return own ?? item.cutout ?? crop ?? single ?? null;
}

/** Items close in price: (max − min) ≤ 10 % of max. */
const similar = (items: readonly Item[]) => items.length > 0 && Math.max(...items.map((i) => i.price)) - minPrice(items) <= 0.1 * Math.max(...items.map((i) => i.price)) + 1e-9;

/**
 * The largest set of items whose prices are within 10 % of each other (≥ 2 items), preferring the
 * one with the lead item, then the cheaper one. Kept in page order.
 */
function similarCluster(items: readonly Item[], lead: string | undefined): Item[] {
  const sorted = [...items].sort((a, b) => a.price - b.price);
  let best: Item[] = [];
  const score = (c: Item[]) => c.length * 4 + (c.some((i) => i.id === lead) ? 2 : 0);
  for (let i = 0; i < sorted.length; i++) {
    const c: Item[] = [];
    for (let j = i; j < sorted.length && similar([sorted[i]!, sorted[j]!]); j++) c.push(sorted[j]!);
    if (c.length >= 2 && score(c) > score(best)) best = c;
  }
  const ids = new Set(best.map((i) => i.id));
  return items.filter((i) => ids.has(i.id));
}

/** A rule key + its values for a color option of the item: a color choice group, or a color dim of its matrix. */
export function colorKey(item: Item): { key: string; values: { id: string; label: string }[] } | null {
  for (const g of item.groups) {
    if (!g.perUnit) continue; // rules never target shared groups
    if (isChoiceGroup(g) && inferPreset({ name: g.name, kind: g.kind, options: g.options }) === "color") {
      return { key: g.id, values: g.options.filter((o) => !o.soldOut && itemAvailable(item, { [g.id]: { lock: o.id } })).map((o) => ({ id: o.id, label: o.label })) };
    }
    if (isMatrixGroup(g)) {
      for (const d of g.dims) {
        if (inferPreset({ name: d.name, kind: d.kind, options: d.values }) !== "color") continue;
        const key = `${g.id}.${d.id}`;
        return { key, values: d.values.filter((v) => !v.soldOut && itemAvailable(item, { [key]: { lock: v.id } })).map((v) => ({ id: v.id, label: v.label })) };
      }
    }
  }
  return null;
}

/** One fixed line per value, each locked to it (the customer still picks the other options of each piece). */
function colorLines(item: Item, key: string, values: readonly string[]): OfferLine[] {
  return values.map((v, i) => fixed(`l${i + 1}`, item.id, 1, { rules: { [key]: { lock: v } as LineRule } }));
}

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export const OFFER_PRESETS = ["single", "multi", "choose-one", "any-n", "combo", "combo-gift", "bogo", "everything", "pack-colors"] as const;
export type OfferPreset = (typeof OFFER_PRESETS)[number];

export interface PresetOptions {
  /** the items to use, in order (default: the lead item, or every item for choices and combos) */
  items?: string[];
  /** pieces: "multi" / "any-n" (default 2), paid pieces of "bogo" (default 1) */
  qty?: number;
  /** free pieces of "bogo" (default 1) */
  free?: number;
  /** "pack-colors": the rule key (a choice group id, or "<matrixGroupId>.<dimId>"); default: the item's color */
  dim?: string;
  /** "pack-colors": the values, one piece each (default: the first 3 available) */
  values?: string[];
  /** names in the page language (default: automatic names) */
  texts?: Partial<OfferTexts>;
}

const PRESET_ID: Record<OfferPreset, string> = {
  single: "x1",
  multi: "x2",
  "choose-one": "one",
  "any-n": "any2",
  combo: "duo",
  "combo-gift": "gift",
  bogo: "bogo",
  everything: "set",
  "pack-colors": "colors",
};

const clampInt = (n: number | undefined, lo: number, hi: number, dflt: number) => Math.min(hi, Math.max(lo, Math.trunc(Number.isFinite(n) ? n! : dflt)));

/**
 * One offer of a kind, priced from the items (never invented): the builder's "+ Offer" tiles and the
 * wizard's offer step. Always returns a valid offer for the doc: a preset that needs more than the
 * page has (a choice with one item, a combo of one) falls back to a simpler one (×1 of the item).
 * The id is unique among `doc.offers.bundles`.
 */
export function presetOffer(p: OfferPreset, doc: PresetDoc, opts: PresetOptions = {}): Offer {
  const texts: OfferTexts = { ...NO_OFFER_TEXTS, ...opts.texts };
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const picked = (opts.items ?? []).map((id) => byId.get(id)).filter((it): it is Item => !!it);
  const unique = picked.filter((it, i) => picked.indexOf(it) === i);
  const lead = unique[0] ?? doc.items[0]!;
  const taken = new Set((doc.offers?.bundles ?? []).map((b) => b.id));
  const idFor = (base: string) => (taken.has(base) ? uniqueId(base, taken) : base);
  const cur = doc.currency;
  const pool = unique.length >= 2 ? unique : doc.items.slice(0, 8);
  const single = () => offer(idFor(PRESET_ID.single), [fixed("l1", lead.id)], lead.price);

  switch (p) {
    case "single":
      return single();
    case "multi": {
      const qty = clampInt(opts.qty, 2, LIMITS.unitsPerOffer, 2);
      const price = packPrice(lead.price, qty, cur) ?? round2(lead.price * qty);
      // "Pack Duo" names two pieces of THE product: on a multi-item page it would read as two products
      return offer(idFor(`x${qty}`), [fixed("l1", lead.id, qty)], price, doc.items.length === 1 ? named(texts.packs[qty - 1]) : {});
    }
    case "choose-one": {
      if (pool.length < 2) return single();
      return offer(idFor(PRESET_ID["choose-one"]), [choiceLine("l1", pool)], minPrice(pool), named(texts.choice));
    }
    case "any-n": {
      if (pool.length < 2) return single();
      const qty = clampInt(opts.qty, 2, LIMITS.unitsPerOffer, 2);
      const base = minPrice(pool);
      const price = packPrice(base, qty, cur) ?? round2(base * qty);
      return offer(idFor(`any${qty}`), [choiceLine("l1", pool, qty)], price, named(texts.anyN, { n: qty }));
    }
    case "combo":
    case "everything": {
      const list = (p === "everything" ? doc.items : unique.length >= 2 ? unique : doc.items.slice(0, 2)).slice(0, 6);
      if (list.length < 2) return single();
      const price = comboPrice(list.map((it) => it.price), cur) ?? round2(list.reduce((a, it) => a + it.price, 0));
      const text = p === "everything" ? texts.set : list.length === 2 ? texts.duo : list.length === 3 ? texts.trio : texts.set;
      return offer(idFor(p === "everything" ? PRESET_ID.everything : list.length === 3 ? "trio" : PRESET_ID.combo), list.map((it, i) => fixed(`l${i + 1}`, it.id)), price, named(text));
    }
    case "combo-gift": {
      // the paid items + the last chosen item as a free gift (a catalog item: it reaches the order)
      const list = unique.length >= 2 ? unique : doc.items.length >= 2 ? doc.items.slice(0, 2) : [];
      if (list.length < 2) return single();
      const paid = list.slice(0, -1).slice(0, 5);
      const gift = list[list.length - 1]!;
      const price = paid.length >= 2 ? (comboPrice(paid.map((it) => it.price), cur) ?? round2(paid.reduce((a, it) => a + it.price, 0))) : paid[0]!.price;
      return offer(idFor(PRESET_ID["combo-gift"]), [...paid.map((it, i) => fixed(`l${i + 1}`, it.id)), fixed("lg", gift.id, 1, { free: true })], price);
    }
    case "bogo": {
      const qty = clampInt(opts.qty, 1, LIMITS.unitsPerOffer - 1, 1);
      const free = clampInt(opts.free, 1, LIMITS.unitsPerOffer - qty, 1);
      const price = packPrice(lead.price, qty, cur) ?? round2(lead.price * qty);
      return offer(idFor(PRESET_ID.bogo), [fixed("l1", lead.id, qty), fixed("l2", lead.id, free, { free: true })], price, qty === 1 && free === 1 ? named(texts.bogo) : {});
    }
    case "pack-colors": {
      const item = unique[0] ?? doc.items.find((it) => colorKey(it)) ?? lead;
      const found = colorKey(item);
      const key = opts.dim ?? found?.key;
      if (!key) return single();
      const valuesOf = (): string[] => {
        if (key === found?.key) return found.values.map((v) => v.id);
        const [gid, did] = key.split(".");
        const g = item.groups.find((x) => x.id === gid);
        if (g && isChoiceGroup(g) && !did) return g.options.filter((o) => !o.soldOut).map((o) => o.id);
        if (g && isMatrixGroup(g) && did) return g.dims.find((d) => d.id === did)?.values.filter((v) => !v.soldOut).map((v) => v.id) ?? [];
        return [];
      };
      const known = new Set(valuesOf());
      const values = (opts.values?.filter((v) => known.has(v)) ?? [...known].slice(0, 3)).slice(0, LIMITS.linesPerOffer);
      if (values.length < 2) return single();
      const price = packPrice(item.price, values.length, cur) ?? round2(item.price * values.length);
      return offer(idFor(PRESET_ID["pack-colors"]), colorLines(item, key, values), price, named(texts.colors, { n: values.length }));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

export interface SuggestOptions {
  /**
   * Suggest "Pack 3 couleurs" (offers with per-line option rules). Default: on. The generator turns
   * it off while the RULES editor switch is off (src/lib/page/features.ts), so new pages never carry
   * rules the builder cannot edit yet.
   */
  rules?: boolean;
}

/** The custom visual of an offer: the owner's photos, never cover-cropped (group photos), lead + side for two. */
const custom = (images: AssetRef[]): Offer["visual"] => ({ mode: "custom", images: images.slice(0, 4).map(({ box, ...r }) => (box ? { ...r, box } : r)), arrange: "auto" });

/** Single item: ×1 / ×2 popular / ×3 best (today's suggestBundles numbers) + "Pack 3 couleurs". */
function singleItem(doc: SuggestDoc, item: Item, texts: OfferTexts, opts: SuggestOptions): Offer[] {
  const cur = doc.currency;
  const x1 = offer("x1", [fixed("l1", item.id)], item.price, named(texts.packs[0]));
  const x2 = packPrice(item.price, 2, cur);
  const x3 = packPrice(item.price, 3, cur);
  if (x2 === null || x3 === null) return [x1];
  const out = [
    x1,
    offer("x2", [fixed("l1", item.id, 2)], x2, { ...named(texts.packs[1]), badge: "popular" }),
    offer("x3", [fixed("l1", item.id, 3)], x3, { ...named(texts.packs[2]), badge: "best" }),
  ];
  const colors = opts.rules !== false ? colorPack(doc, item, texts, x3) : null;
  return colors ? [...out, colors] : out;
}

/** "Pack 3 couleurs": one piece in each of the first 3 available colors, at the ×3 price. */
function colorPack(doc: SuggestDoc, item: Item, texts: OfferTexts, x3: number | null, id = "colors"): Offer | null {
  const c = colorKey(item);
  if (!c || c.values.length < 3 || x3 === null) return null;
  const values = c.values.slice(0, 3).map((v) => v.id);
  void doc;
  return offer(id, colorLines(item, c.key, values), x3, named(texts.colors, { n: values.length }));
}

/** A single item offer on a multi-item page: named after the item (an automatic "1 pièce" would read the same on every item). */
function solo(doc: SuggestDoc, item: Item): Offer {
  const name = clip(item.name.trim() || doc.product.name, TEXT_MAX.title);
  return offer(`solo-${item.id}`, [fixed("l1", item.id)], item.price, name ? { title: name } : {});
}

function twoItems(doc: SuggestDoc, items: Item[], texts: OfferTexts): Offer[] {
  const [a, b] = items as [Item, Item];
  const photos = groupPhotos(doc);
  const both = photos.filter((g) => g.items.includes(a.id) && g.items.includes(b.id)).sort((x, y) => x.items.length - y.items.length)[0];
  const choosable = items.every((it) => ownPhoto(doc, it));
  const first = similar(items) && choosable ? [offer("one", [choiceLine("l1", items)], minPrice(items), named(texts.choice))] : [solo(doc, a), solo(doc, b)];
  const duoPrice = comboPrice([a.price, b.price], doc.currency);
  if (duoPrice === null) return first;
  const duo = offer("duo", [fixed("l1", a.id), fixed("l2", b.id)], duoPrice, { ...named(texts.duo), badge: "popular", ...(both ? { visual: custom([both.asset]) } : {}) });
  return [...first, duo];
}

function threeItems(doc: SuggestDoc, items: Item[], texts: OfferTexts): Offer[] {
  const photos = groupPhotos(doc);
  const choosable = items.filter((it) => ownPhoto(doc, it));
  const cluster = similarCluster(choosable, doc.items[0]?.id);
  const out: Offer[] = cluster.length >= 2 ? [offer("one", [choiceLine("l1", cluster)], minPrice(cluster), named(texts.choice))] : items.map((it) => solo(doc, it));

  // "Duo" only when a group photo of two of the items exists (the pair the owner photographed together)
  const pairPhoto = photos
    .filter((g) => g.items.filter((id) => items.some((it) => it.id === id)).length === 2)
    .sort((x, y) => x.items.length - y.items.length)[0];
  let duo: Offer | null = null;
  if (pairPhoto) {
    const pair = items.filter((it) => pairPhoto.items.includes(it.id));
    const price = comboPrice(pair.map((it) => it.price), doc.currency);
    if (price !== null) duo = offer("duo", pair.map((it, i) => fixed(`l${i + 1}`, it.id)), price, { ...named(texts.duo), badge: "popular", visual: custom([pairPhoto.asset]) });
  }
  if (duo) out.push(duo);

  // "Trio": all three, below the duo's ratio; visual = a photo of all three, else [the pair's photo, the third item's photo]
  const prices = items.map((it) => it.price);
  const duoRef = duo ? duo.lines.reduce((s, l) => s + (items.find((it) => isFixedPick(l.pick) && it.id === l.pick.item)?.price ?? 0), 0) : 0;
  const trioPrice = comboPrice(prices, doc.currency, duo ? { floor: duo.price, ratio: duo.price / duoRef } : {});
  if (trioPrice !== null) {
    const all = photos.find((g) => items.every((it) => g.items.includes(it.id)));
    const third = pairPhoto ? items.find((it) => !pairPhoto.items.includes(it.id)) : undefined;
    const thirdPhoto = third ? ownPhoto(doc, third) : null;
    const visual = all ? custom([all.asset]) : pairPhoto && thirdPhoto ? custom([pairPhoto.asset, thirdPhoto]) : undefined;
    out.push(offer("trio", items.map((it, i) => fixed(`l${i + 1}`, it.id)), trioPrice, { ...named(texts.trio), badge: "best", ...(visual ? { visual } : {}) }));
  }
  return out;
}

function manyItems(doc: SuggestDoc, items: Item[], texts: OfferTexts): Offer[] {
  const cur = doc.currency;
  const choosable = items.filter((it) => ownPhoto(doc, it)).slice(0, 8);
  const out: Offer[] = [];
  let ratio = 1;
  let floor = 0;
  if (choosable.length >= 2) {
    const base = minPrice(choosable);
    out.push(offer("one", [choiceLine("l1", choosable)], base, named(texts.choice)));
    const any2 = packPrice(base, 2, cur);
    const any3 = packPrice(base, 3, cur);
    if (any2 !== null) out.push(offer("any2", [choiceLine("l1", choosable, 2)], any2, { ...named(texts.anyN, { n: 2 }), badge: "popular" }));
    if (any2 !== null && any3 !== null) {
      out.push(offer("any3", [choiceLine("l1", choosable, 3)], any3, named(texts.anyN, { n: 3 })));
      ratio = any3 / (3 * base);
      floor = any3;
    }
  } else {
    out.push(...items.slice(0, LIMITS.offers - 1).map((it) => solo(doc, it)));
  }
  if (items.length <= 6) {
    const price = comboPrice(items.map((it) => it.price), cur, { floor, ratio });
    if (price !== null) out.push(offer("set", items.map((it, i) => fixed(`l${i + 1}`, it.id)), price, { ...named(texts.set), badge: "best" }));
  }
  return out;
}

/**
 * The offers a page should start with (wizard, generator, builder "Suggest offers"), from its items,
 * their prices and the group photos (groupPhotos):
 *   1 item     ×1 · ×2 popular · ×3 best (+ "Pack 3 couleurs" for an item with 3+ colors)
 *   2 items    prices within 10 % → "Au choix" + "Duo" (popular, visual = their group photo);
 *              prices apart → each item alone + "Duo"
 *   3 items    "Au choix" among the similar prices · "Duo" when a group photo of two items exists ·
 *              "Trio" (best, visual = [group photo, third item's photo])
 *   4–8 items  "Au choix" · "2 au choix" (popular) · "3 au choix" · "Coffret complet" (best, ≤ 6 items)
 * Choice lines only use items with a photo of their own (an item to choose without one blocks
 * publishing, §B.4); otherwise each item is offered alone. Sold-out items are left out. Every offer
 * is honest (see the file header); one that would not be is dropped, never forced.
 */
export function suggestOffers(doc: SuggestDoc, texts: OfferTexts = NO_OFFER_TEXTS, opts: SuggestOptions = {}): Offer[] {
  const t: OfferTexts = { ...NO_OFFER_TEXTS, ...texts };
  const live = doc.items.filter((it) => itemAvailable(it));
  const items = (live.length ? live : doc.items).slice(0, LIMITS.items);
  let out: Offer[];
  if (doc.items.length === 1 || items.length === 1) out = singleItem(doc, items[0]!, doc.items.length === 1 ? t : { ...t, packs: [] }, opts);
  else if (items.length === 2) out = twoItems(doc, items, t);
  else if (items.length === 3) out = threeItems(doc, items, t);
  else out = manyItems(doc, items, t);

  // an item with 3+ colors on a multi-item page also gets its color pack (while there is room)
  if (doc.items.length > 1 && opts.rules !== false) {
    for (const it of items) {
      if (out.length >= LIMITS.offers) break;
      const pack = colorPack(doc, it, t, packPrice(it.price, 3, doc.currency), `colors-${it.id}`);
      if (pack) out.push(pack);
    }
  }
  return honest(doc, out.slice(0, LIMITS.offers));
}

/** Drops offers of 2+ pieces that would not cost less than their pieces bought alone; unique ids; one popular, one best. */
function honest(doc: SuggestDoc, offers: Offer[]): Offer[] {
  const page = { items: doc.items, offers: { bundles: offers, display: { ...DEFAULT_OFFER_DISPLAY }, extras: [], showPerUnit: true, showSavings: "both" as const, shippingFee: 0, urgency: {} } };
  const kept = offers.filter((o) => offerUnits(o) < 2 || o.price < offerMath(page, o).reference / 100 - 1e-9);
  const taken = new Set<string>();
  let popular = false;
  let best = false;
  return kept.map((o) => {
    const id = taken.has(o.id) ? uniqueId(o.id, taken) : o.id;
    taken.add(id);
    let badge = o.badge;
    if (badge === "popular") badge = popular ? "none" : ((popular = true), "popular");
    else if (badge === "best") badge = best ? "none" : ((best = true), "best");
    return { ...o, id, badge };
  });
}
