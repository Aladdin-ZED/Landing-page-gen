/**
 * The item catalog and the shape of offers (docs/OFFERS.md §B.2, §C.2, §C.4, §E.6) — pure, shared by
 * the renderer, the runtime config builder, the order validation, the admin and the generator.
 *
 *   leadItem(doc)                       items[0]: hero price and visuals on single-item pages
 *   itemName / itemShort                "" names fall back to the product name (single-item pages)
 *   groupPhotos(doc) / itemVisual(...)  photos shown by 2+ items, and each item's own visual
 *   contentIdOf(doc, item, pageKey)     ad content id: sku, else pageKey ("main") / "<pageKey>.<id>"
 *   expandUnits(offer, items)           the offer's physical pieces (k = 0-based, lines in order)
 *   offerSignature / offerAvailable     canonical contents; can the offer be ordered right now
 *   defaultOfferId(offers, items)       preselected → popular → first (each available)
 *   offerName / offerShort / offerSheetLabel   automatic names (v1-identical for ×N offers)
 *   visualPlan(doc, offer)              composition model of an offer visual (copies, choice, duo…)
 */
import { createT } from "@/landing/i18n";
import type { ResolvedAsset } from "@/landing/types";
import { itemAvailable } from "./options";
import {
  isFixedPick,
  MAIN_ITEM_ID,
  type AssetRef,
  type CropBox,
  type Item,
  type LineRule,
  type Locale,
  type Offer,
  type OfferLine,
  type Offers,
  type PageDoc,
} from "./schema";

type ItemsDoc = Pick<PageDoc, "items">;
type NamesDoc = Pick<PageDoc, "items" | "product">;

/* ------------------------------------------------------------------ */
/* Items                                                               */
/* ------------------------------------------------------------------ */

/** items[0]: shown first; single-item pages take hero price and visuals from it. */
export function leadItem(doc: ItemsDoc): Item {
  const lead = doc.items[0];
  if (!lead) throw new Error("A page sells at least one item.");
  return lead;
}

export function itemById(doc: ItemsDoc, id: string): Item | undefined {
  return doc.items.find((it) => it.id === id);
}

/** item.name, else the product name (single-item pages: the item IS the product). */
export function itemName(doc: NamesDoc, item: Pick<Item, "name">): string {
  return item.name.trim() || doc.product.name;
}

/** First `n` code points of `s` (never cuts a surrogate pair). */
const clip = (s: string, n: number) => {
  const cps = Array.from(s);
  return cps.length > n ? cps.slice(0, n).join("").trim() : s;
};

/** Sheets / WhatsApp / receipts name: short, else the item name, ≤ 40 characters. */
export function itemShort(doc: NamesDoc, item: Pick<Item, "name" | "short">): string {
  return clip(item.short?.trim() || itemName(doc, item), 40);
}

/** Lead item with its display name (RenderContext.lead). */
export function namedLead(doc: NamesDoc): Item & { name: string } {
  const lead = leadItem(doc);
  return { ...lead, name: itemName(doc, lead) };
}

/** Photos assigned uncropped (no box) to 2+ items: group photos (combo visuals; never an item's own visual). */
export function groupPhotos(doc: ItemsDoc): { asset: AssetRef; items: string[] }[] {
  const byId = new Map<string, { asset: AssetRef; items: string[] }>();
  for (const it of doc.items) {
    for (const ref of it.images) {
      if (ref.box) continue;
      const hit = byId.get(ref.id);
      if (!hit) byId.set(ref.id, { asset: ref, items: [it.id] });
      else if (!hit.items.includes(it.id)) hit.items.push(it.id);
    }
  }
  return [...byId.values()].filter((g) => g.items.length >= 2);
}

export type VisualKind = "cutout" | "photo" | "crop" | "monogram";

export interface ItemVisual {
  /** null: no photo → monogram tile (item initial on --sec-chip), never empty */
  asset: ResolvedAsset | null;
  ref?: AssetRef;
  box?: CropBox;
  kind: VisualKind;
}

/**
 * An item's own visual: its cutout → its first image that is not a group photo (crops count as
 * own) → on single-item pages only: product cutout → first product photo → monogram.
 */
export function itemVisual(doc: Pick<PageDoc, "items" | "product">, item: Item, ctx: { asset: (ref: AssetRef | undefined | null) => ResolvedAsset | null }): ItemVisual {
  const group = new Set(groupPhotos(doc).map((g) => g.asset.id));
  const candidates: { ref: AssetRef; kind: VisualKind }[] = [];
  if (item.cutout) candidates.push({ ref: item.cutout, kind: "cutout" });
  for (const ref of item.images) {
    if (ref.box) candidates.push({ ref, kind: "crop" });
    else if (!group.has(ref.id)) candidates.push({ ref, kind: "photo" });
  }
  if (doc.items.length === 1) {
    if (doc.product.cutout) candidates.push({ ref: doc.product.cutout, kind: "cutout" });
    if (doc.product.images[0]) candidates.push({ ref: doc.product.images[0], kind: "photo" });
  }
  for (const c of candidates) {
    const asset = ctx.asset(c.ref);
    if (asset) return { asset, ref: c.ref, kind: c.kind, ...(c.ref.box ? { box: c.ref.box } : {}) };
  }
  return { asset: null, kind: "monogram" };
}

/** Ad content id of an item: its SKU, else the page key for "main", else "<pageKey>.<itemId>". */
export function contentIdOf(_doc: ItemsDoc | null, item: Pick<Item, "id" | "sku">, pageKey: string): string {
  return item.sku || (item.id === MAIN_ITEM_ID ? pageKey : `${pageKey}.${item.id}`);
}

/* ------------------------------------------------------------------ */
/* Units                                                               */
/* ------------------------------------------------------------------ */

/** Σ line.qty (free units included). */
export function offerUnits(offer: Pick<Offer, "lines">): number {
  return offer.lines.reduce((n, l) => n + l.qty, 0);
}

/** The first custom visual photo of an offer (v1 `bundle.image`), if any. */
export function offerCustomImage(offer: Pick<Offer, "visual">): AssetRef | undefined {
  return offer.visual.mode === "custom" ? offer.visual.images[0] : undefined;
}

export interface UnitSlot {
  /** 0-based unit index (lines in order, then qty) */
  k: number;
  line: number;
  lineId: string;
  /** fixed item id */
  item: string | null;
  /** choice line: DECLARED item ids (pricing base) */
  choices: string[] | null;
  /** choice line: declared minus unavailable items (what the shopper can pick) */
  available: string[] | null;
  distinct: boolean;
  surcharge: "none" | "difference";
  free: boolean;
  label?: string;
  rules?: Record<string, LineRule>;
}

export function expandUnits(offer: Pick<Offer, "lines">, items: readonly Item[]): UnitSlot[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  const out: UnitSlot[] = [];
  offer.lines.forEach((l, line) => {
    const fixed = isFixedPick(l.pick) ? l.pick.item : null;
    const choices = isFixedPick(l.pick) ? null : [...l.pick.choice];
    const available = choices
      ? choices.filter((id) => {
          const it = byId.get(id);
          return !!it && itemAvailable(it);
        })
      : null;
    for (let q = 0; q < l.qty; q++) {
      out.push({
        k: out.length,
        line,
        lineId: l.id,
        item: fixed,
        choices,
        available,
        distinct: !isFixedPick(l.pick) && l.pick.distinct,
        surcharge: isFixedPick(l.pick) ? "none" : l.pick.surcharge,
        free: l.free,
        ...(l.label ? { label: l.label } : {}),
        ...(l.rules && Object.keys(l.rules).length ? { rules: l.rules } : {}),
      });
    }
  });
  return out;
}

function ruleSig(rules: OfferLine["rules"]): string {
  if (!rules) return "";
  const parts: string[] = [];
  for (const key of Object.keys(rules).sort()) {
    const r = rules[key]!;
    if ("lock" in r) parts.push(`${key}=${r.lock}`);
    else if ("allow" in r) parts.push(`${key}∈${[...r.allow].sort().join(",")}`);
    // a preset only sets the initial value: same contents
  }
  return parts.length ? `{${parts.join(";")}}` : "";
}

/**
 * Canonical contents of an offer incl. option rules: "main×2" · "main×1+nuit×1" · "[main|nuit]×1" ·
 * "main{g-fit.d-col=o-noir}×1" · "gift:main×1". Same contents in another line split → same signature.
 */
export function offerSignature(offer: Pick<Offer, "lines">): string {
  const qty = new Map<string, number>();
  for (const l of offer.lines) {
    const pick = isFixedPick(l.pick)
      ? l.pick.item
      : `[${[...l.pick.choice].sort().join("|")}${l.pick.distinct ? ";distinct" : ""}${l.pick.surcharge === "difference" ? ";difference" : ""}]`;
    const sig = `${l.free ? "gift:" : ""}${pick}${isFixedPick(l.pick) ? ruleSig(l.rules) : ""}`;
    qty.set(sig, (qty.get(sig) ?? 0) + l.qty);
  }
  return [...qty.entries()]
    .map(([sig, n]) => `${sig}×${n}`)
    .sort()
    .join("+");
}

/**
 * Can the offer be ordered right now? Not when: it is sold out; a fixed line's item is missing or
 * sold out; a locked option is out; a group has no available allowed option (or combination); a
 * choice line has fewer available items than it needs (`distinct`: qty).
 */
export function offerAvailable(offer: Offer, items: readonly Item[]): boolean {
  if (offer.soldOut) return false;
  const byId = new Map(items.map((it) => [it.id, it]));
  for (const l of offer.lines) {
    if (isFixedPick(l.pick)) {
      const it = byId.get(l.pick.item);
      if (!it || !itemAvailable(it, l.rules)) return false;
    } else {
      const n = l.pick.choice.filter((id) => {
        const it = byId.get(id);
        return !!it && itemAvailable(it);
      }).length;
      if (n < (l.pick.distinct ? l.qty : 1)) return false;
    }
  }
  return true;
}

/** Which offer is selected on first paint: preselected → "popular" badge → first; each available (else the first offer). */
export function defaultOfferId(offers: Pick<Offers, "bundles">, items: readonly Item[]): string {
  const ok = offers.bundles.filter((b) => offerAvailable(b, items));
  return (ok.find((b) => b.preselected) ?? ok.find((b) => b.badge === "popular") ?? ok[0] ?? offers.bundles[0]!).id;
}

/** A v1-shaped offer: one paid fixed line on the lead item (labels and Sheets text stay byte-identical to v1). */
export function isLegacyOffer(doc: ItemsDoc, offer: Pick<Offer, "lines">): boolean {
  const l = offer.lines[0];
  return offer.lines.length === 1 && !!l && !l.free && isFixedPick(l.pick) && l.pick.item === doc.items[0]?.id;
}

/* ------------------------------------------------------------------ */
/* Names (§C.4)                                                        */
/* ------------------------------------------------------------------ */

export type OfferWordKey = "offer.choice" | "offer.anyN" | "offer.free" | "offer.duo" | "offer.trio";

const WORDS: Record<Locale, Record<OfferWordKey, string>> = {
  fr: { "offer.choice": "Au choix", "offer.anyN": "{n} au choix", "offer.free": "offert", "offer.duo": "Duo", "offer.trio": "Trio" },
  ar: { "offer.choice": "على اختيارك", "offer.anyN": "{n} على اختيارك", "offer.free": "هدية", "offer.duo": "الثنائي", "offer.trio": "الثلاثي" },
  en: { "offer.choice": "Your choice", "offer.anyN": "Any {n}", "offer.free": "free", "offer.duo": "Duo", "offer.trio": "Trio" },
  es: { "offer.choice": "A elegir", "offer.anyN": "{n} a elegir", "offer.free": "gratis", "offer.duo": "Dúo", "offer.trio": "Trío" },
  de: { "offer.choice": "Nach Wahl", "offer.anyN": "{n} nach Wahl", "offer.free": "gratis", "offer.duo": "Duo", "offer.trio": "Trio" },
  it: { "offer.choice": "A scelta", "offer.anyN": "{n} a scelta", "offer.free": "in omaggio", "offer.duo": "Duo", "offer.trio": "Trio" },
  nl: { "offer.choice": "Naar keuze", "offer.anyN": "{n} naar keuze", "offer.free": "gratis", "offer.duo": "Duo", "offer.trio": "Trio" },
  pt: { "offer.choice": "À escolha", "offer.anyN": "{n} à escolha", "offer.free": "grátis", "offer.duo": "Duo", "offer.trio": "Trio" },
};

/**
 * What the automatic names need: the page (items, product, locale) and, optionally, the landing
 * microcopy (`t`, e.g. RenderContext.t once orderForm/copy.ts has the `offer.*` keys). Without `t`,
 * the built-in words and the landing "bundle.qty" / "bundle.x" plurals are used.
 */
export interface OfferNameCtx {
  doc: Pick<PageDoc, "items" | "product" | "locale">;
  t?: (key: string, vars?: Record<string, string | number>) => string;
}

function wordsOf(ctx: OfferNameCtx) {
  const base = createT(ctx.doc.locale);
  const table = WORDS[ctx.doc.locale] ?? WORDS.en;
  const word = (key: OfferWordKey, vars?: Record<string, string | number>) => {
    const own = ctx.t?.(key, vars);
    if (own && own !== key) return own;
    return table[key].replace("{n}", String(vars?.n ?? ""));
  };
  return {
    qty: (n: number) => base("bundle.qty", { n }),
    x: (n: number) => base("bundle.x", { n }),
    word,
  };
}

/** Every line (paid and free) is a fixed line of one item: that item id. */
function sameItem(offer: Pick<Offer, "lines">): string | null {
  const ids = new Set(offer.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : "")));
  return ids.size === 1 && !ids.has("") ? [...ids][0]! : null;
}

/**
 * Automatic name (no title): "2 pièces" (one item ×n, v1 identical) · "1 + 1 offert" (the same item,
 * paid and free) · "Au choix" / "2 au choix" · "Jour + Nuit + Sérum" (max 3, then "+ n") · free lines
 * add " + {label | item offert}" ("Jour + Votre cadeau").
 */
export function autoOfferName(ctx: OfferNameCtx, offer: Pick<Offer, "lines">): string {
  const w = wordsOf(ctx);
  const paid = offer.lines.filter((l) => !l.free);
  const free = offer.lines.filter((l) => l.free);
  const units = (ls: readonly OfferLine[]) => ls.reduce((n, l) => n + l.qty, 0);
  const short = (id: string) => {
    const it = ctx.doc.items.find((x) => x.id === id);
    return it ? itemShort(ctx.doc, it) : id;
  };
  const one = sameItem(offer);
  if (one && !free.length) return w.qty(units(paid));
  // "1 + 1 offert": the same item, paid and free, no labels
  if (one && free.every((l) => !l.label)) return `${units(paid)} + ${units(free)} ${w.word("offer.free")}`;
  const choiceWord = (l: OfferLine) => (l.qty > 1 ? w.word("offer.anyN", { n: l.qty }) : w.word("offer.choice"));
  const names: string[] = [];
  for (const l of paid) {
    const n = isFixedPick(l.pick) ? (paid.length === 1 && l.qty > 1 ? `${l.qty} × ${short(l.pick.item)}` : short(l.pick.item)) : choiceWord(l);
    if (names[names.length - 1] !== n) names.push(n);
  }
  const head = names.length > 3 ? `${names.slice(0, 3).join(" + ")} + ${names.length - 3}` : names.join(" + ");
  const tail = free.map((l) => l.label?.trim() || (isFixedPick(l.pick) ? `${short(l.pick.item)} ${w.word("offer.free")}` : w.word("offer.free")));
  return [head, ...tail].join(" + ");
}

/** Card / summary name: the title, else the automatic name. */
export function offerName(ctx: OfferNameCtx, offer: Pick<Offer, "lines" | "title">): string {
  return offer.title?.trim() || autoOfferName(ctx, offer);
}

/**
 * Segment / tab label (≤ 14): short → "×2" (one item, v1 identical) · "Au choix" / "2 au choix" (one
 * choice line) · "Duo" / "Trio" (2 / 3 different paid items, fixed lines) · "4 pièces".
 */
export function offerShort(ctx: OfferNameCtx, offer: Pick<Offer, "lines" | "short">): string {
  const own = offer.short?.trim();
  if (own) return clip(own, 14);
  const w = wordsOf(ctx);
  const units = offerUnits(offer);
  if (sameItem(offer)) return clip(w.x(units), 14);
  if (offer.lines.length === 1 && !isFixedPick(offer.lines[0]!.pick)) {
    const l = offer.lines[0]!;
    return clip(l.qty > 1 ? w.word("offer.anyN", { n: l.qty }) : w.word("offer.choice"), 14);
  }
  if (offer.lines.every((l) => isFixedPick(l.pick))) {
    const paid = new Set(offer.lines.filter((l) => !l.free).map((l) => (isFixedPick(l.pick) ? l.pick.item : "")));
    if (paid.size === 2) return clip(w.word("offer.duo"), 14);
    if (paid.size === 3) return clip(w.word("offer.trio"), 14);
  }
  return clip(w.qty(units), 14);
}

/**
 * Google Sheets "Produit" / PHP `sheetLabel` / admin label: v1 format for a single paid lead-item
 * line (`"Pack Duo (x2)"` / `"x2"`, byte-identical), else `"<title or automatic name> (x<units>)"`.
 */
export function offerSheetLabel(doc: Pick<PageDoc, "items" | "product" | "locale">, offer: Pick<Offer, "lines" | "title">): string {
  const units = offerUnits(offer);
  if (isLegacyOffer(doc, offer)) return offer.title ? `${offer.title} (x${units})` : `x${units}`;
  return `${offer.title || autoOfferName({ doc }, offer)} (x${units})`;
}

/* ------------------------------------------------------------------ */
/* Offer visual composition model (§E.6)                               */
/* ------------------------------------------------------------------ */

export type VisualTile =
  | { kind: "item"; item: string; qty: number; free: boolean; lock?: Record<string, string> }
  | { kind: "choice"; items: string[]; qty: number; free: boolean };

export interface VisualPlan {
  mode: "copies" | "choice" | "duo" | "trio" | "grid" | "custom";
  /** lines in order (paid first, then free); consecutive tiles of the same item, locks and price merged */
  tiles: VisualTile[];
  images?: AssetRef[];
  arrange?: "auto" | "row" | "overlap" | "grid";
}

function locksOf(rules: OfferLine["rules"]): Record<string, string> | undefined {
  if (!rules) return undefined;
  const out: Record<string, string> = {};
  for (const [k, r] of Object.entries(rules)) if ("lock" in r) out[k] = r.lock;
  return Object.keys(out).length ? out : undefined;
}

export function visualPlan(_doc: ItemsDoc, offer: Pick<Offer, "lines" | "visual">): VisualPlan {
  const ordered = [...offer.lines.filter((l) => !l.free), ...offer.lines.filter((l) => l.free)];
  const tiles: VisualTile[] = [];
  for (const l of ordered) {
    if (isFixedPick(l.pick)) {
      const lock = locksOf(l.rules);
      const prev = tiles[tiles.length - 1];
      if (prev && prev.kind === "item" && prev.item === l.pick.item && prev.free === l.free && JSON.stringify(prev.lock ?? {}) === JSON.stringify(lock ?? {})) {
        prev.qty += l.qty;
        continue;
      }
      tiles.push({ kind: "item", item: l.pick.item, qty: l.qty, free: l.free, ...(lock ? { lock } : {}) });
    } else {
      tiles.push({ kind: "choice", items: [...l.pick.choice], qty: l.qty, free: l.free });
    }
  }
  if (offer.visual.mode === "custom") return { mode: "custom", tiles, images: offer.visual.images, arrange: offer.visual.arrange };
  const mode: VisualPlan["mode"] =
    tiles.length === 1 ? (tiles[0]!.kind === "choice" ? "choice" : "copies") : tiles.length === 2 ? "duo" : tiles.length === 3 ? "trio" : "grid";
  return { mode, tiles };
}
