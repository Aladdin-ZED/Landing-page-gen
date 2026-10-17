/**
 * Pure edit operations of the item catalog (docs/OFFERS.md §B, §H.3): ids from names, new /
 * duplicated items, "Show first" (plain reorder: content ids follow the id, never the position),
 * copy options, delete with its cascade on offers / bump / upsell / extras, rule keys renamed after
 * a merge or split of options, and the photo wells' bookkeeping (group photos are DERIVED: a photo
 * picked uncropped by 2+ items).
 *
 * Every function returns new objects and keeps the offers schema-valid: a choice line left with one
 * item becomes a fixed line on it, an offer that loses all its paid lines is removed, and a page
 * always keeps at least one offer.
 */
import { groupPhotos } from "@/lib/page/catalog";
import {
  isChoicePick,
  isFixedPick,
  ITEM_ID_RE,
  LIMITS,
  type AssetRef,
  type CropBox,
  type Item,
  type Offer,
  type OfferLine,
  type Offers,
  type OptionGroup,
} from "@/lib/page/schema";
import { uid } from "@/components/admin/variants/matrix-model";

/* ------------------------------------------------------------------ */
/* ids                                                                 */
/* ------------------------------------------------------------------ */

/** "Crème nuit" → "creme-nuit" (unique, ItemId-valid); non-Latin names → "p-k3m9x". */
export function itemIdFor(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20)
    .replace(/-+$/g, "");
  if (slug.length >= 2 && ITEM_ID_RE.test(slug) && !used.has(slug)) return slug;
  if (slug.length >= 2 && ITEM_ID_RE.test(slug)) {
    for (let i = 2; i < 100; i++) {
      const id = `${slug.slice(0, 20)}-${i}`;
      if (ITEM_ID_RE.test(id) && !used.has(id)) return id;
    }
  }
  for (;;) {
    const id = uid("p", used);
    if (ITEM_ID_RE.test(id)) return id;
  }
}

/* ------------------------------------------------------------------ */
/* items                                                               */
/* ------------------------------------------------------------------ */

export function newItem(opts: { name: string; price: number; images?: AssetRef[]; taken: readonly string[] }): Item {
  return { id: itemIdFor(opts.name, opts.taken), name: opts.name.trim().slice(0, 120), images: (opts.images ?? []).slice(0, LIMITS.itemPhotos), price: opts.price, groups: [], soldOut: false };
}

const clone = <T>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T));

/** A copy with its options, photos and prices (new id, "… (copy)"), placed after the original. */
export function duplicateItem(items: readonly Item[], id: string): Item[] | null {
  if (items.length >= LIMITS.items) return null;
  const at = items.findIndex((it) => it.id === id);
  const src = items[at];
  if (!src) return null;
  const name = `${src.name || "Product"} (copy)`.slice(0, 120);
  const copy: Item = { ...clone(src), id: itemIdFor(name, items.map((x) => x.id)), name };
  delete copy.sku;
  delete copy.short;
  const next = [...items];
  next.splice(at + 1, 0, copy);
  return next;
}

/** Move an item to index 0 (lead visuals on single-item pages, first in choosers and the shelf). */
export function showFirst(items: readonly Item[], id: string): Item[] {
  const it = items.find((x) => x.id === id);
  return it ? [it, ...items.filter((x) => x.id !== id)] : [...items];
}

/** `to` with a copy of `from`'s options (replacing its own). */
export function copyOptions(from: Item, to: Item): Item {
  return { ...to, groups: clone(from.groups).slice(0, LIMITS.groupsPerItem) as OptionGroup[] };
}

/* ------------------------------------------------------------------ */
/* usage & delete                                                      */
/* ------------------------------------------------------------------ */

const lineUses = (l: OfferLine, id: string) => (isFixedPick(l.pick) ? l.pick.item === id : l.pick.choice.includes(id));

export interface ItemUsage {
  offers: Offer[];
  bump: boolean;
  upsell: boolean;
}

export function itemUsage(offers: Pick<Offers, "bundles" | "orderBump" | "upsell">, id: string): ItemUsage {
  return {
    offers: offers.bundles.filter((o) => o.lines.some((l) => lineUses(l, id))),
    bump: offers.orderBump?.item === id,
    upsell: offers.upsell?.item === id,
  };
}

/** Lines without `id`: choice lines drop it (one left → a fixed line), fixed lines on it are removed. */
function linesWithout(lines: readonly OfferLine[], id: string): OfferLine[] {
  const out: OfferLine[] = [];
  for (const l of lines) {
    if (isFixedPick(l.pick)) {
      if (l.pick.item !== id) out.push(l);
      continue;
    }
    const choice = l.pick.choice.filter((x) => x !== id);
    if (choice.length === l.pick.choice.length) out.push(l);
    else if (choice.length >= 2) out.push({ ...l, pick: { ...l.pick, choice }, qty: l.pick.distinct ? Math.min(l.qty, choice.length) : l.qty });
    else if (choice.length === 1) {
      const next: OfferLine = { ...l, pick: { item: choice[0]! } };
      out.push(next);
    }
  }
  return out;
}

/**
 * Delete an item: its offer lines go (offers left without a paid line are removed), the bump /
 * upsell item is cleared, extras and bump scopes drop removed offers. Null when it is the last item.
 */
export function removeItem<O extends Offers>(state: { items: readonly Item[]; offers: O }, id: string): { items: Item[]; offers: O } | null {
  if (state.items.length <= 1) return null;
  const items = state.items.filter((it) => it.id !== id);
  const kept: Offer[] = [];
  for (const o of state.offers.bundles) {
    const lines = linesWithout(o.lines, id);
    if (!lines.length || !lines.some((l) => !l.free)) continue;
    kept.push(lines.length === o.lines.length && lines.every((l, i) => l === o.lines[i]) ? o : { ...o, lines });
  }
  const bundles = kept.length ? kept : [fallbackOffer(items[0]!)];
  const ids = new Set(bundles.map((o) => o.id));
  const offers: O = { ...state.offers, bundles };
  if (offers.orderBump) {
    const bump = { ...offers.orderBump };
    if (bump.item === id) delete bump.item;
    if (bump.offers) {
      const list = bump.offers.filter((x) => ids.has(x));
      if (list.length) bump.offers = list;
      else {
        delete bump.offers;
        bump.enabled = false;
      }
    }
    offers.orderBump = bump;
  }
  if (offers.upsell?.item === id) {
    const up = { ...offers.upsell };
    delete up.item;
    offers.upsell = up;
  }
  offers.extras = offers.extras.flatMap((x) => {
    if (x.scope === "all") return [x];
    const scope = x.scope.filter((s) => ids.has(s));
    return scope.length ? [{ ...x, scope }] : [];
  });
  return { items, offers };
}

/** The offer a page falls back to when deleting an item removed every offer. */
export function fallbackOffer(item: Item): Offer {
  return { id: "x1", lines: [{ id: "l1", qty: 1, pick: { item: item.id }, free: false }], perks: [], price: item.price, badge: "none", freeShipping: false, visual: { mode: "auto" }, preselected: false, soldOut: false };
}

/** Line rules of `itemId` after its options were merged / split (old key → new key). */
export function rekeyRules(bundles: readonly Offer[], itemId: string, rekey: Readonly<Record<string, string>>): Offer[] {
  if (!Object.keys(rekey).length) return [...bundles];
  return bundles.map((o) => {
    let changed = false;
    const lines = o.lines.map((l) => {
      if (!l.rules || !isFixedPick(l.pick) || l.pick.item !== itemId) return l;
      const rules: NonNullable<OfferLine["rules"]> = {};
      for (const [k, r] of Object.entries(l.rules)) {
        const nk = rekey[k] ?? k;
        if (nk !== k) changed = true;
        rules[nk] = r;
      }
      return { ...l, rules };
    });
    return changed ? { ...o, lines } : o;
  });
}

/** Rules naming groups / options an item no longer has are dropped (after editing its options). */
export function pruneRules(bundles: readonly Offer[], items: readonly Item[]): Offer[] {
  const byId = new Map(items.map((it) => [it.id, it]));
  return bundles.map((o) => {
    let changed = false;
    const lines = o.lines.map((l) => {
      if (!l.rules || !isFixedPick(l.pick)) return l;
      const it = byId.get(l.pick.item);
      const rules: NonNullable<OfferLine["rules"]> = {};
      for (const [key, r] of Object.entries(l.rules)) {
        const [gid, dim] = key.split(".");
        const g = it?.groups.find((x) => x.id === gid);
        const values = g && "options" in g && dim === undefined && g.perUnit ? g.options : g && g.kind === "matrix" && dim && g.perUnit ? g.dims.find((d) => d.id === dim)?.values : undefined;
        if (!values) {
          changed = true;
          continue;
        }
        const ok = new Set(values.map((v) => v.id));
        if ("lock" in r) {
          if (ok.has(r.lock)) rules[key] = r;
          else changed = true;
        } else if ("allow" in r) {
          const allow = r.allow.filter((x) => ok.has(x));
          if (!allow.length) {
            changed = true;
            continue;
          }
          const preset = r.preset && allow.includes(r.preset) ? r.preset : undefined;
          if (allow.length !== r.allow.length || preset !== r.preset) changed = true;
          rules[key] = preset ? { allow, preset } : { allow };
        } else if (ok.has(r.preset)) rules[key] = r;
        else changed = true;
      }
      if (!changed) return l;
      const next = { ...l };
      if (Object.keys(rules).length) next.rules = rules;
      else delete next.rules;
      return next;
    });
    return changed ? { ...o, lines } : o;
  });
}

/* ------------------------------------------------------------------ */
/* photo wells                                                         */
/* ------------------------------------------------------------------ */

/** Asset ids picked uncropped by 2+ items (group photos). */
export const groupPhotoIds = (items: readonly Item[]): Set<string> => new Set(groupPhotos({ items: [...items] }).map((g) => g.asset.id));

/** The item has a photo of its own (own photo, crop or cutout; group photos don't count). */
export function hasOwnPhoto(item: Item, items: readonly Item[]): boolean {
  if (item.cutout) return true;
  const group = groupPhotoIds(items);
  return item.images.some((r) => !!r.box || !group.has(r.id));
}

/** Toggle an uncropped photo in an item's well. */
export function togglePhoto(item: Item, ref: AssetRef): Item {
  const has = item.images.some((r) => r.id === ref.id && !r.box);
  if (has) return { ...item, images: item.images.filter((r) => !(r.id === ref.id && !r.box)) };
  if (item.images.length >= LIMITS.itemPhotos) return item;
  return { ...item, images: [...item.images, { id: ref.id, alt: ref.alt, ...(ref.fx !== undefined ? { fx: ref.fx } : {}), ...(ref.fy !== undefined ? { fy: ref.fy } : {}) }] };
}

/** Add (or replace) the item's crop of a photo; crops lead its well (they are its own visual). */
export function withCrop(item: Item, ref: AssetRef, box: CropBox, alt: string): Item {
  const crop: AssetRef = { id: ref.id, alt: alt.slice(0, 200), box: roundBox(box) };
  const rest = item.images.filter((r) => !(r.id === ref.id && r.box));
  return { ...item, images: [crop, ...rest].slice(0, LIMITS.itemPhotos) };
}

export function withoutCrop(item: Item, assetId: string): Item {
  return { ...item, images: item.images.filter((r) => !(r.id === assetId && r.box)) };
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** A crop inside the photo, ≥ 5% each way, three decimals (schema CropBox). */
export function roundBox(b: CropBox): CropBox {
  const w = Math.min(1, Math.max(0.05, r3(b.w)));
  const h = Math.min(1, Math.max(0.05, r3(b.h)));
  const x = Math.min(0.95, Math.max(0, r3(Math.min(b.x, 1 - w))));
  const y = Math.min(0.95, Math.max(0, r3(Math.min(b.y, 1 - h))));
  return { x, y, w: r3(Math.min(w, 1 - x)), h: r3(Math.min(h, 1 - y)) };
}

/** Is this item listed in a choice line (where it needs a photo of its own, §B.4)? */
export function inChoiceLine(bundles: readonly Offer[], id: string): boolean {
  return bundles.some((o) => o.lines.some((l) => isChoicePick(l.pick) && l.pick.choice.includes(id)));
}
