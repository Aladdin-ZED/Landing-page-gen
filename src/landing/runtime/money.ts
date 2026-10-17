/**
 * Money formatting and order math of the runtime (pure).
 *
 * formatMoney() is THE price rule of a landing page: the renderer's ctx.money calls it with the same
 * MoneyFormat it embeds in the runtime config (src/lib/render/config.ts moneyFormat()), so
 * server-rendered and runtime-updated prices are byte-identical (Latin digits, U+00A0 between
 * amount and symbol, cents only when there are some). It takes money; config v2 amounts are integer
 * cents (fmtCents).
 *
 * Order math in integer cents, from the runtime config v2 (docs/OFFERS.md §C.3, §F.7):
 *   computeTotals(cfg, sel)   mirrors src/lib/page/pricing.ts orderTotals()
 *   unitsDeltas(cfg, sel)     mirrors selectionDeltas() (+ the per-unit split allocate() needs)
 *   resolveCell(group, combo) mirrors src/lib/page/options.ts resolveCombo() on the config's cells
 * Parity with the server over seeded random selections: selftest-parity.ts.
 */
import { round2 } from "../../lib/page/money";
import type { LandingRuntimeConfig, RuntimeGroup, RuntimeItem, RuntimeOffer, RuntimeOfferLine, RuntimeOption } from "./config";

export interface MoneyFormat {
  locale: string;
  symbol: string;
  position: "before" | "after";
  decimals: number;
}

const formatters: Record<string, Intl.NumberFormat> = {};

function nf(locale: string, d: number): Intl.NumberFormat {
  const key = locale + "|" + d;
  let f = formatters[key];
  if (!f) {
    const o: Intl.NumberFormatOptions = { minimumFractionDigits: d, maximumFractionDigits: d };
    // Deterministic digits across ICU versions: Latin unless the locale explicitly asks (…-u-nu-arab).
    if (locale.indexOf("-nu-") < 0) (o as Intl.NumberFormatOptions & { numberingSystem?: string }).numberingSystem = "latn";
    try {
      f = new Intl.NumberFormat(locale, o);
    } catch {
      f = new Intl.NumberFormat("en", o);
    }
    formatters[key] = f;
  }
  return f;
}

const NBSP = String.fromCharCode(0xa0);
const SPACE_END = /\s$/;
const SPACE_START = /^\s/;

/**
 * "249 درهم" / "1 249 DH" / "24,90 €" / "$10.00" / "€ 24,90" — always a no-break space between
 * amount and symbol, except a single-character symbol placed before the amount ("$10").
 * A symbol that already carries its separator ("€" + U+00A0 for nl-NL) is used as is.
 * `decimals` is the minimum number of fraction digits; a whole-unit format (0) still shows cents
 * when the amount has some — never misstate a price.
 */
export function formatMoney(amount: number, m: MoneyFormat): string {
  const v = round2(isFinite(amount) ? amount : 0);
  let d = Math.max(0, Math.min(3, Math.floor(m.decimals) || 0));
  if (d === 0 && Math.round(v * 100) % 100 !== 0) d = 2;
  const n = nf(m.locale || "en", d).format(v);
  const s = m.symbol || "";
  if (!s) return n;
  if (m.position === "before") return s + (s.length > 1 && !SPACE_END.test(s) ? NBSP : "") + n;
  return n + (SPACE_START.test(s) ? "" : NBSP) + s;
}

/** Integer cents → the page's money text. */
export const fmtCents = (c: number, m: MoneyFormat) => formatMoney(c / 100, m);

/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */

/** One unit: its item, choice option ids / matrix cell keys by group, typed values by group. */
export interface UnitSel {
  item: string;
  options: Record<string, string>;
  fields: Record<string, string>;
}

/** The shopper's selection (= the server's Selection in src/lib/page/pricing.ts). */
export interface Sel {
  offerId: string;
  units: UnitSel[];
  extras: Record<string, string>;
  bump: boolean;
  bumpUnit?: UnitSel;
}

/** A surcharge row: "XL" · "Gravure" ×2 · "Sérum". `cents` = total of the row. */
export interface Reason {
  key: string;
  label: string;
  count: number;
  cents: number;
}

export type Cfg = Pick<LandingRuntimeConfig, "items" | "bundles" | "extras" | "bump" | "shippingFee">;
export type Offer = RuntimeOffer & { gift?: string };
export type Slot = RuntimeOfferLine;
export type MatrixGroup = Extract<RuntimeGroup, { kind: "matrix" }>;
export type Combo = Record<string, string>;

export const itemOf = (cfg: Pick<Cfg, "items">, id: string | undefined): RuntimeItem | undefined => {
  for (const it of cfg.items) if (it.id === id) return it;
  return undefined;
};
export const offerOf = (cfg: Pick<Cfg, "bundles">, id: string): Offer | undefined => {
  for (const b of cfg.bundles) if (b.id === id) return b;
  return undefined;
};
export const optOf = (list: readonly RuntimeOption[], id: string | undefined): RuntimeOption | undefined => {
  for (const o of list) if (o.id === id) return o;
  return undefined;
};

/** The bump is offered with this offer (enabled = present in the config; its offers list when set). */
export const bumpOn = (cfg: Pick<Cfg, "bump">, offerId: string) => !!cfg.bump && (!cfg.bump.offers || cfg.bump.offers.indexOf(offerId) >= 0);

/** An extra applies to this offer. */
export const inScope = (scope: "all" | string[], offerId: string) => scope === "all" || scope.indexOf(offerId) >= 0;

/* ------------------------------------------------------------------ */
/* Matrix                                                              */
/* ------------------------------------------------------------------ */

/** "d-col=o-noir|d-size=o-m" (any order) → combo; null when malformed or a dim repeats. */
export function parseKey(key: string): Combo | null {
  if (!key || key.length > 250) return null;
  const out: Combo = {};
  for (const part of key.split("|")) {
    const m = /^([A-Za-z0-9_-]{2,40})=([A-Za-z0-9_-]{2,40})$/.exec(part);
    if (!m || Object.prototype.hasOwnProperty.call(out, m[1]!)) return null;
    out[m[1]!] = m[2]!;
  }
  return out;
}

/** Canonical key: entries sorted by dim id, "dim=value" joined by "|". */
export const cellKey = (c: Combo) =>
  Object.keys(c)
    .sort()
    .map((k) => k + "=" + c[k])
    .join("|");

export interface Cell {
  /** 0 in · 1 out (épuisé) · 2 not made */
  s: number;
  /** surcharge per unit, cents */
  d: number;
  /** the delta comes from a cell (else the values' own deltas) */
  cell: boolean;
  values: RuntimeOption[];
}

/**
 * A complete combination (one value per dim) against the config's exception cells: matching cells =
 * those whose key ⊆ combo; state = the most severe of them and of the values' soldOut; delta from the
 * most specific matching cell that has one (tie → first), else Σ value deltas. Null when incomplete
 * or unknown.
 */
export function resolveCell(g: MatrixGroup, combo: Combo): Cell | null {
  const values: RuntimeOption[] = [];
  for (const dim of g.dims) {
    const v = optOf(dim.values, combo[dim.id]);
    if (!v) return null;
    values.push(v);
  }
  if (Object.keys(combo).length !== g.dims.length) return null;
  let s = values.some((v) => v.soldOut) ? 1 : 0;
  let size = -1;
  let cd: number | undefined;
  for (const c of g.cells) {
    const parts = c.v.split("|");
    if (!parts.every((p) => combo[p.slice(0, p.indexOf("="))] === p.slice(p.indexOf("=") + 1))) continue;
    s = Math.max(s, c.s === "n" ? 2 : c.s === "o" ? 1 : 0);
    if (c.d !== undefined && parts.length > size) {
      size = parts.length;
      cd = c.d;
    }
  }
  return { s, d: cd !== undefined ? cd : values.reduce((n, v) => n + (v.delta || 0), 0), cell: cd !== undefined, values };
}

/* ------------------------------------------------------------------ */
/* Deltas and totals                                                   */
/* ------------------------------------------------------------------ */

export interface Deltas {
  /** surcharges of each unit (free units 0) */
  perUnit: number[];
  /** order extras (once per order) */
  extras: number;
  total: number;
  reasons: Reason[];
}

/** Declared base prices of a choice line, ascending (config `base`, else the items' prices). */
function basePrices(cfg: Pick<Cfg, "items">, s: Slot): number[] {
  if (s.base && s.base.length) return s.base;
  return (s.choices || [])
    .map((id) => itemOf(cfg, id))
    .filter((it): it is RuntimeItem => !!it)
    .map((it) => it.price)
    .sort((a, b) => a - b);
}

/** Surcharges of a selection (mirrors pricing.ts breakdown): options / fields per paid unit, choice-line differences, extras. */
export function unitsDeltas(cfg: Cfg, sel: Sel): Deltas {
  const offer = offerOf(cfg, sel.offerId);
  const out: Deltas = { perUnit: [], extras: 0, total: 0, reasons: [] };
  if (!offer) return out;
  const at: Record<string, Reason> = Object.create(null);
  const per = offer.units.map(() => 0);
  const add = (k: number | null, key: string, label: string, c: number | undefined) => {
    if (!c || !(c > 0)) return;
    if (k !== null) per[k] = (per[k] || 0) + c;
    const r = at[key];
    if (r) {
      r.count++;
      r.cents += c;
    } else out.reasons.push((at[key] = { key, label, count: 1, cents: c }));
  };
  const sharedFields: Record<string, 1> = Object.create(null);

  offer.units.forEach((slot, k) => {
    if (slot.free) return; // free units never pay deltas
    const u = sel.units[k];
    const it = u && itemOf(cfg, slot.item || u.item);
    if (!it || !u) return;
    for (const g of it.groups) {
      const pre = ":" + it.id + ":" + g.id;
      if (g.kind === "field") {
        if (!g.delta || !u.fields[g.id]) continue;
        if (g.perUnit) add(k, "f" + pre, g.name, g.delta);
        else if (!sharedFields[pre]) {
          sharedFields[pre] = 1;
          add(k, "f" + pre, g.name, g.delta);
        }
      } else if (g.kind === "matrix") {
        const combo = u.options[g.id] ? parseKey(u.options[g.id]!) : null;
        const r = combo ? resolveCell(g, combo) : null;
        if (!r || !(r.d > 0)) continue;
        if (r.cell)
          add(
            k,
            "m" + pre + ":" + cellKey(combo!),
            r.values.map((v) => v.label).join("/"),
            r.d,
          );
        else g.dims.forEach((d, i) => add(k, "m" + pre + ":" + d.id + "=" + r.values[i]!.id, r.values[i]!.label, r.values[i]!.delta));
      } else {
        const o = optOf(g.options, u.options[g.id]);
        if (o) add(k, "o" + pre + ":" + o.id, o.label, o.delta);
      }
    }
  });

  // choice lines with "difference": pricier items cost their difference (sorted chosen − sorted base)
  const lines: number[] = [];
  offer.units.forEach((s) => {
    if (s.surcharge && !s.free && lines.indexOf(s.line) < 0) lines.push(s.line);
  });
  for (const line of lines) {
    const ks: number[] = [];
    offer.units.forEach((s, k) => {
      if (s.line === line) ks.push(k);
    });
    const slot = offer.units[ks[0]!]!;
    const declared = basePrices(cfg, slot);
    if (!declared.length) continue;
    const base = slot.distinct ? declared.slice(0, ks.length) : ks.map(() => declared[0]!);
    const chosen: { k: number; it: RuntimeItem }[] = [];
    for (const k of ks) {
      const it = itemOf(cfg, sel.units[k] && sel.units[k]!.item);
      if (it) chosen.push({ k, it });
    }
    chosen.sort((a, b) => a.it.price - b.it.price || a.k - b.k);
    chosen.forEach((c, i) => add(c.k, "s:" + line + ":" + c.it.id, c.it.short, Math.max(0, c.it.price - (base[i] !== undefined ? base[i]! : base[base.length - 1]!))));
  }

  // order extras in scope: once per order
  for (const x of cfg.extras || []) {
    const v = sel.extras[x.id];
    if (!inScope(x.scope, offer.id) || !v) continue;
    const c = x.kind === "field" ? x.delta : x.kind === "matrix" ? 0 : (optOf(x.options, v) || { delta: 0 }).delta;
    if (c && c > 0) {
      out.extras += c;
      add(null, "x:" + x.id, x.name, c);
    }
  }
  out.perUnit = per;
  out.total = per.reduce((n, c) => n + c, 0) + out.extras;
  return out;
}

export interface Totals {
  offer: Offer;
  /** Σ units of the offer (free included) */
  units: number;
  price: number;
  deltas: number;
  reasons: Reason[];
  /** surcharges per unit (pixels allocation) */
  perUnit: number[];
  bump: number;
  shipping: number;
  /** price + deltas + bump */
  subtotal: number;
  /** subtotal + shipping: the total shown on the submit button (payload `st`) */
  total: number;
}

/** Totals of a selection, integer cents (mirrors pricing.ts orderTotals). */
export function computeTotals(cfg: Cfg, sel: Sel): Totals | null {
  const offer = offerOf(cfg, sel.offerId);
  if (!offer) return null;
  const d = unitsDeltas(cfg, sel);
  const bump = sel.bump && bumpOn(cfg, offer.id) ? cfg.bump!.price : 0;
  const shipping = offer.free ? 0 : cfg.shippingFee || 0;
  const subtotal = offer.price + d.total + bump;
  return { offer, units: offer.units.length, price: offer.price, deltas: d.total, reasons: d.reasons, perUnit: d.perUnit, bump, shipping, subtotal, total: subtotal + shipping };
}

/** A selection with nothing chosen yet. */
export const emptySel = (offerId: string, bump = false): Sel => ({ offerId, units: [], extras: {}, bump });

/**
 * The offer price split per unit (mirrors pricing.ts allocate): largest-remainder split by the
 * units' item prices (equal split when they sum to 0) + each unit's own surcharges; free units 0.
 * A choice unit not chosen yet counts as the first available choice of its line (§G.7).
 */
export function allocate(cfg: Cfg, sel: Sel, perUnit: readonly number[]): number[] {
  const offer = offerOf(cfg, sel.offerId);
  if (!offer) return [];
  const refs = offer.units.map((s, k) => {
    const id = s.item || (sel.units[k] && sel.units[k]!.item) || (s.available || s.choices || [])[0];
    return s.free ? 0 : (itemOf(cfg, id) || { price: 0 }).price;
  });
  const paid: number[] = [];
  offer.units.forEach((s, k) => !s.free && paid.push(k));
  const out = offer.units.map(() => 0);
  if (paid.length) {
    const sum = paid.reduce((n, k) => n + refs[k]!, 0);
    const w = paid.map((k) => (sum > 0 ? refs[k]! : 1));
    const tw = w.reduce((n, x) => n + x, 0);
    const exact = w.map((x) => (offer.price * x) / tw);
    const floors = exact.map(Math.floor);
    let left = offer.price - floors.reduce((n, f) => n + f, 0);
    const order = exact.map((e, i) => ({ i, r: e - floors[i]! })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (const { i } of order) {
      if (left <= 0) break;
      floors[i]!++;
      left--;
    }
    paid.forEach((k, i) => (out[k] = floors[i]! + (perUnit[k] || 0)));
  }
  return out;
}
