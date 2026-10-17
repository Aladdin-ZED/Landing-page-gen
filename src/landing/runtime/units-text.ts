/**
 * Order text of a selection, "customer" rendering — the runtime mirror of src/lib/orders/text.ts
 * (orderUnitOf + unitsText, docs/OFFERS.md §G.4), parity-tested by selftest-parity.ts. Used by the
 * WhatsApp hand-off (the export bridge only formats it) and the abandoned-lead beacon.
 *
 *   part := ["[OFFERT] "] [n " × "] [short] [" (" values ")"] [" · " name « value », …]  |  "CADEAU : " gift
 *   text := part (" + " part)* [" || Commande : " extra ("; " extra)*]     (≤ 1000 characters)
 */
import type { RuntimeItem } from "./config";
import type { Cfg, Combo, MatrixGroup, Sel, UnitSel } from "./money";
import { inScope, itemOf, offerOf, optOf, parseKey, resolveCell } from "./money";

export interface TUnit {
  item: string;
  /** item name on multi-item pages, else "" */
  label: string;
  short?: string;
  free?: true;
  options: { name: string; value: string }[];
  fields?: { name: string; value: string }[];
}

export interface TExtra {
  name: string;
  value: string;
  typed?: true;
  /** cents */
  delta?: number;
}

const NUMERIC = /^\d+([.,]\d+)?$/;

const oneLine = (s: string) =>
  String(s == null ? "" : s)
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Owner labels: the separators of the grammar never appear inside one. */
export const sanitize = (s: string) =>
  oneLine(s)
    .replace(/ \+ /g, " & ")
    .replace(/\//g, "-")
    .replace(/\|{2,}/g, "|")
    .replace(/ · /g, " - ")
    .replace(/[«»]/g, '"');

/** A typed value in « » (inner « » become "). */
export const quote = (s: string) => "« " + oneLine(s).replace(/[«»]/g, '"') + " »";

/** Printable option value: a numeric one is prefixed by its group or dim name ("Pointure 42"). */
export function optionText(group: string, label: string): string {
  const v = sanitize(label);
  return NUMERIC.test(v) ? sanitize(group) + " " + v : v;
}

/** The text view of one unit (orderUnitOf, customer values). */
export function textUnit(cfg: Pick<Cfg, "items">, it: RuntimeItem, u: UnitSel, free: boolean): TUnit {
  const multi = cfg.items.length > 1;
  const options: TUnit["options"] = [];
  const fields: NonNullable<TUnit["fields"]> = [];
  for (const g of it.groups) {
    if (g.kind === "field") {
      const v = u.fields[g.id];
      if (v) fields.push({ name: sanitize(g.name), value: oneLine(v) });
    } else if (g.kind === "matrix") {
      const combo: Combo | null = u.options[g.id] ? parseKey(u.options[g.id]!) : null;
      const r = combo ? resolveCell(g as MatrixGroup, combo) : null;
      if (r) options.push({ name: sanitize(g.name), value: r.values.map((v, i) => optionText(g.dims[i]!.name, v.label)).join("/") });
    } else {
      const o = optOf(g.options, u.options[g.id]);
      if (o) options.push({ name: sanitize(g.name), value: optionText(g.name, o.label) });
    }
  }
  const t: TUnit = { item: it.id, label: multi ? it.name : "", options };
  if (multi) t.short = it.short;
  if (free) t.free = true;
  if (fields.length) t.fields = fields;
  return t;
}

/** [n ×] [short] [(values)] [· fields] — "" when there is nothing to say. */
export function partBody(u: TUnit, n: number, multi: boolean): string {
  const values = u.options.map((o) => o.value).filter(Boolean);
  const fields = (u.fields || []).filter((f) => f.value).map((f) => f.name + " " + quote(f.value));
  const label = multi ? sanitize(u.short || u.label) : "";
  if (!label && !values.length && !fields.length) return "";
  let s = multi || n > 1 ? n + " × " : "";
  if (label) s += label + (values.length ? " (" + values.join("/") + ")" : "");
  else s += values.join("/");
  if (fields.length) s += (label || values.length ? " · " : "") + fields.join(", ");
  return s.trim();
}

const pieces = (n: number) => n + " pièce" + (n > 1 ? "s" : "");
const marked = (m: string, u: TUnit, n: number, multi: boolean) => m + " " + (partBody(u, n, multi) || pieces(n));

/** Identical units counted, first-seen order; free never merges with paid. */
export function groupUnits(units: readonly TUnit[]): { unit: TUnit; n: number }[] {
  const out: { unit: TUnit; n: number; key: string }[] = [];
  for (const u of units) {
    const key = JSON.stringify([!!u.free, u.item, u.short || "", u.label, u.options.map((o) => [o.name, o.value]), (u.fields || []).map((f) => [f.name, f.value])]);
    let g: { unit: TUnit; n: number; key: string } | undefined;
    for (const x of out) if (x.key === key) g = x;
    if (g) g.n++;
    else out.push({ unit: u, n: 1, key });
  }
  return out;
}

export interface TextInput {
  units: readonly TUnit[];
  multi: boolean;
  gift?: string;
  bump?: TUnit;
  extras?: readonly TExtra[];
}

/** The unit parts, the fixed parts (gift, bump) and the order segment of a text. */
export function textParts(input: TextInput): { units: { text: string; n: number }[]; fixed: string[]; extras: string[] } {
  const units: { text: string; n: number }[] = [];
  for (const g of groupUnits(input.units)) {
    const text = g.unit.free ? marked("[OFFERT]", g.unit, g.n, input.multi) : partBody(g.unit, g.n, input.multi);
    if (text) units.push({ text, n: g.n });
  }
  const fixed: string[] = [];
  if (input.gift) fixed.push("CADEAU : " + sanitize(input.gift));
  if (input.bump) fixed.push(marked("[AJOUT]", input.bump, 1, true));
  const extras = (input.extras || [])
    .filter((x) => x.value)
    .map((x) => sanitize(x.name) + " = " + (x.typed ? quote(x.value) : sanitize(x.value)) + (x.delta ? " (+" + Math.round(x.delta) / 100 + ")" : ""));
  return { units, fixed, extras };
}

const cp = (s: string) => Array.from(s).length;

/** unitsText(…, "customer"): byte-identical to the server for the same selection. */
export function unitsText(input: TextInput, max = 1000): string {
  const p = textParts(input);
  const join = (a: string[]) => a.filter(Boolean).join(" + ");
  const segment = p.extras.length ? " || Commande : " + p.extras.join("; ") : "";
  let kept = p.units.length;
  let text = join(p.units.map((u) => u.text).concat(p.fixed)) + segment;
  while (cp(text) > max && kept > 0) {
    kept--;
    const dropped = p.units.slice(kept).reduce((s, u) => s + u.n, 0);
    const units = p.units.slice(0, kept).map((u) => u.text);
    const more = " … (+" + dropped + ")";
    text = (units.length ? join([units.join(" + ") + more].concat(p.fixed)) : join([more.trim()].concat(p.fixed))) + segment;
  }
  return text;
}

/** The text input of a selection (units resolved against the config; free units flagged). */
export function selText(cfg: Cfg, sel: Sel): TextInput {
  const offer = offerOf(cfg, sel.offerId);
  const units: TUnit[] = [];
  if (offer)
    offer.units.forEach((slot, k) => {
      const u = sel.units[k];
      const it = u && itemOf(cfg, slot.item || u.item);
      if (it && u) units.push(textUnit(cfg, it, u, !!slot.free));
    });
  const extras: TExtra[] = [];
  for (const x of cfg.extras || []) {
    const v = sel.extras[x.id];
    if (!v || !offer || !inScope(x.scope, offer.id)) continue;
    if (x.kind === "field") extras.push({ name: x.name, value: v, typed: true, ...(x.delta ? { delta: x.delta } : {}) });
    else if (x.kind !== "matrix") {
      const o = optOf(x.options, v);
      if (o) extras.push({ name: x.name, value: o.label, ...(o.delta ? { delta: o.delta } : {}) });
    }
  }
  const bumpItem = sel.bump && cfg.bump && cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
  const bump = bumpItem && sel.bumpUnit ? textUnit(cfg, bumpItem, sel.bumpUnit, false) : undefined;
  return { units, multi: cfg.items.length > 1, ...(offer && offer.gift ? { gift: offer.gift } : {}), ...(bump ? { bump } : {}), extras };
}

