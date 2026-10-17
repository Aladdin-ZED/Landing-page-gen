/**
 * Offer presets and suggestions for the editors (docs/OFFERS.md §H.1): the signatures of GN's
 * src/lib/page/offer-presets.ts (`presetOffer`, `suggestOffers`), implemented here for the admin
 * until that module lands — then this file re-exports it (contract request in the AD report).
 *
 * Every preset and suggestion is honest: free delivery follows the page fee (`freeShipping: false`,
 * D10), a price is below the reference for 2+ units, per-unit prices fall with size, no
 * compare-at is invented (the reference is automatic), ≤ 8 offers, unique ids. Titles stay empty:
 * the automatic names (§C.4) speak the page language ("Au choix", "Jour + Nuit", "1 + 1 offert").
 */
import { groupPhotos, itemVisual } from "@/lib/page/catalog";
import { isChoiceGroup, isMatrixGroup, LIMITS, type AssetRef, type Item, type Offer, type OfferLine, type PageDoc } from "@/lib/page/schema";
import { inferPreset } from "@/lib/page/variant-presets";

export type OfferPreset = "single" | "multi" | "choose-one" | "any-n" | "combo" | "combo-gift" | "bogo" | "everything" | "pack-colors";

export type PresetDoc = Pick<PageDoc, "items" | "currency" | "offers"> & Partial<Pick<PageDoc, "product" | "locale">>;

export interface PresetOptions {
  items?: string[];
  qty?: number;
  free?: number;
  /** pack-colors: the rule key ("g-col" or "g-fit.d-col") and the values to lock */
  dim?: string;
  values?: string[];
}

/* ------------------------------------------------------------------ */
/* charm prices                                                        */
/* ------------------------------------------------------------------ */

/** Currencies priced in whole units on COD pages (prices end in 9: 99, 149, 199…). */
const WHOLE_UNIT = new Set(["MAD", "DZD", "TND", "EGP", "XOF", "SAR", "AED"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

function charmCandidates(n: number, currency: string): number[] {
  if (WHOLE_UNIT.has(currency)) {
    const step = n < 300 ? 10 : n < 1000 ? 50 : 100;
    const lo = Math.floor(n / step) * step - 1;
    return [lo, lo + step, lo - step].filter((x) => x > 0).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  }
  if (n < 100) {
    const lo = Math.floor(n) - 0.1;
    return [lo, lo + 1, lo - 1].filter((x) => x > 0).map(round2).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
  }
  const lo = Math.floor(n / 10) * 10 - 1;
  return [lo, lo + 10, lo - 10].filter((x) => x > 0).sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
}

/** Closest charming price strictly inside (floor, ceil); falls back to a plain rounded price. */
export function charmBetween(target: number, floor: number, ceil: number, currency: string): number {
  for (const c of charmCandidates(target, currency)) if (c > floor + 0.001 && c < ceil - 0.001) return c;
  const whole = WHOLE_UNIT.has(currency);
  const plain = whole ? Math.round(target) : round2(target);
  return round2(Math.min(Math.max(plain, floor + (whole ? 1 : 0.01)), ceil - (whole ? 1 : 0.01)));
}

/** A charming price near `target`, below `ceil` (the reference). */
export const charm = (target: number, ceil: number, currency: string) => (ceil <= 0 ? 0 : charmBetween(target, 0, ceil, currency));

/** Price for `pct` % off a reference, charm-rounded, always below the reference. */
export const discounted = (reference: number, pct: number, currency: string) => charm(reference * (1 - pct / 100), reference, currency);

/* ------------------------------------------------------------------ */
/* ids                                                                 */
/* ------------------------------------------------------------------ */

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function offerId(taken: Iterable<string>, base?: string): string {
  const used = new Set(taken);
  if (base && /^[a-zA-Z0-9_-]{2,40}$/.test(base) && !used.has(base)) return base;
  const bytes = new Uint8Array(5);
  for (;;) {
    const c = globalThis.crypto;
    if (c?.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const id = `b-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
    if (!used.has(id)) return id;
  }
}

const base = (id: string, lines: OfferLine[], price: number): Offer => ({
  id,
  lines: lines.map((l, i) => ({ ...l, id: `l${i + 1}` })),
  perks: [],
  price: round2(price),
  badge: "none",
  freeShipping: false,
  visual: { mode: "auto" },
  preselected: false,
  soldOut: false,
});

const fixed = (item: string, qty = 1, free = false): OfferLine => ({ id: "l", qty, pick: { item }, free });

const COLORS_TEXT: Partial<Record<string, (n: number) => string>> = {
  fr: (n) => `Pack ${n} couleurs`,
  ar: (n) => `باك ${n} ألوان`,
  en: (n) => `${n}-color pack`,
  es: (n) => `Pack ${n} colores`,
  de: (n) => `${n}-Farben-Set`,
  it: (n) => `Pack ${n} colori`,
  nl: (n) => `${n} kleuren-pack`,
  pt: (n) => `Pack ${n} cores`,
};

const BOGO_TEXT: Partial<Record<string, string>> = { fr: "1 + 1 offert", ar: "1 + 1 هدية", en: "Buy 1, get 1 free", es: "1 + 1 gratis", de: "1 + 1 gratis", it: "1 + 1 in omaggio", nl: "1 + 1 gratis", pt: "1 + 1 grátis" };

/* ------------------------------------------------------------------ */
/* presets                                                             */
/* ------------------------------------------------------------------ */

/** One offer of a preset kind, on the page's items (opts.items, else sensible defaults). */
export function presetOffer(p: OfferPreset, doc: PresetDoc, opts: PresetOptions = {}): Offer {
  const items = doc.items;
  const byId = new Map(items.map((it) => [it.id, it]));
  const pick = (opts.items ?? []).filter((id) => byId.has(id));
  const ids = pick.length ? pick : items.map((it) => it.id);
  const lead = byId.get(ids[0] ?? "") ?? items[0]!;
  const taken = doc.offers.bundles.map((o) => o.id);
  const id = offerId(taken);
  const cur = doc.currency;
  const price = (id: string) => byId.get(id)?.price ?? 0;
  switch (p) {
    case "single":
      return base(id, [fixed(lead.id)], lead.price);
    case "multi": {
      const qty = Math.max(2, Math.min(LIMITS.unitsPerOffer, opts.qty ?? 2));
      const ref = lead.price * qty;
      return { ...base(id, [fixed(lead.id, qty)], charm(ref * (qty === 2 ? 0.9 : 0.83), ref, cur)), badge: qty === 2 ? "popular" : "none" };
    }
    case "choose-one": {
      const choice = ids.slice(0, 8);
      if (choice.length < 2) return base(id, [fixed(lead.id)], lead.price);
      const prices = choice.map(price);
      const differ = new Set(prices).size > 1;
      return base(id, [{ id: "l", qty: 1, pick: { choice, distinct: false, surcharge: differ ? "difference" : "none" }, free: false }], Math.min(...prices));
    }
    case "any-n": {
      const choice = ids.slice(0, 8);
      if (choice.length < 2) return presetOffer("multi", doc, { items: [lead.id], qty: opts.qty ?? 2 });
      const qty = Math.max(2, Math.min(choice.length, opts.qty ?? 2));
      const prices = choice.map(price).sort((a, b) => a - b);
      const ref = prices.slice(0, qty).reduce((n, x) => n + x, 0);
      const differ = new Set(prices).size > 1;
      return base(id, [{ id: "l", qty, pick: { choice, distinct: true, surcharge: differ ? "difference" : "none" }, free: false }], charm(ref * 0.9, ref, cur));
    }
    case "combo": {
      const list = (ids.length >= 2 ? ids : items.map((it) => it.id)).slice(0, LIMITS.linesPerOffer);
      if (list.length < 2) return presetOffer("multi", doc, { items: [lead.id] });
      const ref = list.reduce((n, x) => n + price(x), 0);
      return withGroupVisual(doc, base(id, list.map((x) => fixed(x)), charm(ref * 0.85, ref, cur)), list);
    }
    case "combo-gift": {
      const list = (ids.length >= 2 ? ids : items.map((it) => it.id)).slice(0, LIMITS.linesPerOffer);
      if (list.length < 2) return presetOffer("bogo", doc, { items: [lead.id] });
      const paid = list.slice(0, -1);
      const gift = list[list.length - 1]!;
      return base(id, [...paid.map((x) => fixed(x)), fixed(gift, 1, true)], paid.reduce((n, x) => n + price(x), 0));
    }
    case "bogo": {
      const free = Math.max(1, Math.min(LIMITS.unitsPerOffer - 1, opts.free ?? 1));
      return { ...base(id, [fixed(lead.id), fixed(lead.id, free, true)], lead.price), badge: "custom", badgeText: BOGO_TEXT[doc.locale ?? "en"] ?? BOGO_TEXT.en };
    }
    case "everything": {
      const list = items.map((it) => it.id).slice(0, LIMITS.linesPerOffer);
      if (list.length < 2) return presetOffer("multi", doc, { items: [lead.id], qty: 3 });
      const ref = list.reduce((n, x) => n + price(x), 0);
      return withGroupVisual(doc, { ...base(id, list.map((x) => fixed(x)), charm(ref * 0.78, ref, cur)), badge: "best" }, list);
    }
    case "pack-colors": {
      const target = colorTarget(lead, opts.dim);
      const values = (opts.values?.length ? opts.values : target?.values.filter((v) => !v.soldOut).slice(0, 3).map((v) => v.id)) ?? [];
      if (!target || values.length < 2) return presetOffer("multi", doc, { items: [lead.id], qty: 3 });
      const n = Math.min(values.length, LIMITS.linesPerOffer);
      const ref = lead.price * n;
      const lines = values.slice(0, n).map((v): OfferLine => ({ id: "l", qty: 1, pick: { item: lead.id }, free: false, rules: { [target.key]: { lock: v } } }));
      // a same-size pack of this product already on the page sets the price (same pieces, colors fixed)
      const same = doc.offers.bundles.find((o) => o.lines.length === 1 && o.lines[0]!.qty === n && !o.lines[0]!.free && "item" in o.lines[0]!.pick && o.lines[0]!.pick.item === lead.id && !o.lines[0]!.rules);
      const title = (COLORS_TEXT[doc.locale ?? "en"] ?? COLORS_TEXT.en!)(n);
      return { ...base(id, lines, same ? same.price : charm(ref * 0.85, ref, cur)), title };
    }
  }
}

/** The item's color group (or matrix color dim) usable as a rule key, with its values. */
export function colorTarget(item: Item, key?: string): { key: string; name: string; values: { id: string; label: string; soldOut: boolean }[] } | null {
  for (const g of item.groups) {
    if (!g.perUnit) continue;
    if (isChoiceGroup(g) && (key ? key === g.id : g.kind === "swatch" || inferPreset(g) === "color")) return { key: g.id, name: g.name, values: g.options };
    if (isMatrixGroup(g))
      for (const d of g.dims) {
        const k = `${g.id}.${d.id}`;
        if (key ? key === k : d.kind === "swatch" || inferPreset({ name: d.name, kind: d.kind, options: d.values }) === "color") return { key: k, name: d.name, values: d.values };
      }
  }
  return null;
}

/** Combos of 2+ items show their group photo when one shows exactly these items (else auto). */
function withGroupVisual(doc: PresetDoc, offer: Offer, list: readonly string[]): Offer {
  const groups = groupPhotos({ items: doc.items });
  const want = new Set(list);
  const exact = groups.find((g) => g.items.length === want.size && g.items.every((x) => want.has(x)));
  if (exact) return { ...offer, visual: { mode: "custom", images: [stripBox(exact.asset)], arrange: "auto" } };
  // lead + side: the group photo of some of them + the others' own photos (≤ 4 photos)
  const partial = groups.filter((g) => g.items.every((x) => want.has(x))).sort((a, b) => b.items.length - a.items.length)[0];
  if (!partial || !doc.product) return offer;
  const rest = list.filter((x) => !partial.items.includes(x));
  const photos: AssetRef[] = [stripBox(partial.asset)];
  for (const x of rest) {
    const it = doc.items.find((i) => i.id === x);
    if (!it) continue;
    const v = itemVisual({ items: doc.items, product: doc.product }, it, { asset: (r) => (r ? { id: r.id } : null) as never });
    if (!v.ref) return offer; // a product without its own photo: auto composition (monogram tile)
    photos.push(v.ref);
  }
  return photos.length <= LIMITS.customVisualPhotos ? { ...offer, visual: { mode: "custom", images: photos, arrange: "auto" } } : offer;
}

const stripBox = (r: AssetRef): AssetRef => ({ id: r.id, alt: r.alt, ...(r.fx !== undefined ? { fx: r.fx } : {}), ...(r.fy !== undefined ? { fy: r.fy } : {}) });

/* ------------------------------------------------------------------ */
/* suggestions                                                         */
/* ------------------------------------------------------------------ */

const similar = (a: number, b: number) => Math.abs(a - b) <= 0.1 * Math.max(a, b);

/** ×1 / ×2 popular / ×3 best for one product (the v1 suggestBundles numbers). */
function packsOf(doc: PresetDoc, item: Item, taken: string[]): Offer[] {
  const price = round2(Math.max(0, item.price));
  const cur = doc.currency;
  const one = { ...base(offerId(taken, "x1"), [fixed(item.id)], price) };
  taken.push(one.id);
  if (price < 5) return [one];
  const x2 = charmBetween(price * 1.8, price, price * 2, cur);
  const x3 = charmBetween(price * 2.5, x2, Math.min(price * 3, (x2 / 2) * 3), cur);
  if (!(x2 > price && x2 < price * 2 && x3 > x2 && x3 / 3 < x2 / 2)) return [one];
  const two = { ...base(offerId(taken, "x2"), [fixed(item.id, 2)], x2), badge: "popular" as const };
  taken.push(two.id);
  const three = { ...base(offerId(taken, "x3"), [fixed(item.id, 3)], x3), badge: "best" as const };
  taken.push(three.id);
  return [one, two, three];
}

/**
 * Offers for the page's items and their group photos (wizard, generator, builder "Suggest offers").
 * `rules`: also suggest "Pack 3 couleurs" (needs line rules in the editor).
 */
export function suggestOffers(doc: PresetDoc, opts: { rules?: boolean } = {}): Offer[] {
  const items = doc.items.filter((it) => !it.soldOut).length ? doc.items.filter((it) => !it.soldOut) : doc.items;
  const taken: string[] = [];
  const out: Offer[] = [];
  const blank: PresetDoc = { ...doc, offers: { ...doc.offers, bundles: [] } };
  const push = (o: Offer, idBase?: string) => {
    const id = offerId(taken, idBase);
    taken.push(id);
    out.push({ ...o, id });
  };
  const sum = (list: readonly Item[]) => list.reduce((n, x) => n + x.price, 0);
  const groups = groupPhotos({ items: doc.items });
  const lead = items[0]!;

  if (items.length === 1) out.push(...packsOf(doc, lead, taken));
  else if (items.length === 2) {
    const [a, b] = items as [Item, Item];
    if (similar(a.price, b.price)) push(presetOffer("choose-one", blank, { items: [a.id, b.id] }), "one");
    else {
      push(presetOffer("single", blank, { items: [a.id] }), a.id.slice(0, 30));
      push(presetOffer("single", blank, { items: [b.id] }), b.id.slice(0, 30));
    }
    const duo = presetOffer("combo", blank, { items: [a.id, b.id] });
    push({ ...duo, price: charm(0.85 * sum([a, b]), sum([a, b]), doc.currency), badge: "popular" }, "duo");
  } else if (items.length === 3) {
    const cheapest = Math.min(...items.map((x) => x.price));
    const alike = items.filter((x) => similar(x.price, cheapest));
    if (alike.length >= 2) push(presetOffer("choose-one", blank, { items: alike.map((x) => x.id) }), "one");
    const pair = groups.find((g) => g.items.length === 2);
    if (pair) {
      const duoItems = items.filter((x) => pair.items.includes(x.id));
      push({ ...presetOffer("combo", blank, { items: pair.items }), price: charm(0.85 * sum(duoItems), sum(duoItems), doc.currency), badge: "popular" }, "duo");
    }
    push({ ...presetOffer("everything", blank), price: charm(0.78 * sum(items), sum(items), doc.currency), badge: "best" }, "trio");
  } else {
    const ids = items.map((x) => x.id).slice(0, 8);
    push(presetOffer("choose-one", blank, { items: ids }), "one");
    push({ ...presetOffer("any-n", blank, { items: ids, qty: 2 }), badge: "popular" }, "any2");
    if (ids.length >= 3) push(presetOffer("any-n", blank, { items: ids, qty: 3 }), "any3");
    if (items.length <= LIMITS.linesPerOffer) push({ ...presetOffer("everything", blank), badge: "best" }, "set");
  }

  if (opts.rules && out.length < LIMITS.offers) {
    const it = items.find((x) => (colorTarget(x)?.values.filter((v) => !v.soldOut).length ?? 0) >= 3);
    if (it) push(presetOffer("pack-colors", { ...blank, offers: { ...blank.offers, bundles: out } }, { items: [it.id] }), "colors");
  }
  // one popular, one best; nothing preselected (popular is the default offer)
  let popular = false;
  let best = false;
  return out.slice(0, LIMITS.offers).map((o) => {
    if (o.badge === "popular") {
      if (popular) return { ...o, badge: "none" as const };
      popular = true;
    }
    if (o.badge === "best") {
      if (best) return { ...o, badge: "none" as const };
      best = true;
    }
    return o;
  });
}
