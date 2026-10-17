/**
 * Order texts (docs/OFFERS.md §G.4) — ONE implementation, mirrored by order.php (`cod_units_text`)
 * and the landing runtime (`unitsText(cfg, sel, "customer")`), parity-tested:
 *
 *   text    := part (" + " part)* [" || Commande : " extra ("; " extra)*]
 *   part    := [marker " "] [count] [label] [" (" values ")"] [" · " field (", " field)*]  |  "CADEAU : " giftLabel
 *   marker  := "[OFFERT]" | "[AJOUT]" (bump item) | "[UPSELL]"
 *   count   := n " × "      always on multi-item pages; on single-item pages only when n > 1 (v1 identical)
 *   label   := item short name (omitted on single-item pages: values then not parenthesized)
 *   values  := value ("/" value)*   groups in order, locked values included; matrix = dims in order
 *   value   := code ?? label; a numeric value prints "<group or dim name> <value>" ("Pointure 42")
 *   field   := name " « " value " »"
 *   extra   := name " = " value [" (+" delta ")"]
 *
 * Identical units are counted (first-seen order); free units never merge with paid ones. A paid part
 * with nothing to say is dropped; a free one prints "[OFFERT] 1 pièce". Owner labels are sanitized
 * (" + " → " & ", "/" → "-", "||" → "|", " · " → " - ", « » → "), typed values are wrapped in « ».
 * Cap: 1000 characters — whole unit parts are dropped from the end and replaced by
 * " … (+n, voir CMD-…)"; the gift, the bump, the upsell and the order segment are always kept.
 * Two renderings: "warehouse" (codes; Sheets, CSV, Telegram, order.php) and "customer" (labels;
 * WhatsApp, thank-you, admin drawer).
 *
 * Also: `orderUnits()` — one view of stored orders (v2 rows: `units`; v1 rows rebuilt from
 * `variants`), `orderUnitOf()` — the snapshot of a validated unit, `sheetPreview()` — the Variante
 * an offer produces with its first available values (editors: "Dans Google Sheets : …").
 */
import type { OrderItems, OrderUnit } from "@/lib/db/schema";
import { expandUnits, itemName, itemShort } from "@/lib/page/catalog";
import { availableCombos, availableOptions, groupCombos, groupOptions, parseCellKey, resolveCombo, ruleLock, rulePreset } from "@/lib/page/options";
import { fromCents, toCents, type UnitChoice } from "@/lib/page/pricing";
import { isChoiceGroup, isFieldGroup, isMatrixGroup, type Item, type LineRule, type Offer, type PageDoc } from "@/lib/page/schema";

export type TextMode = "warehouse" | "customer";

/** Order texts are capped (Sheets / CSV cells); WhatsApp has its own URL cap (§G.5). */
export const ORDER_TEXT_MAX = 1000;

const NUMERIC = /^\d+([.,]\d+)?$/;
const cp = (s: string) => Array.from(s).length;

/** One line of owner text, no control characters. */
function oneLine(s: string): string {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Owner labels in order texts: the separators of the grammar can never appear inside one. */
export function sanitizeLabel(s: string): string {
  return oneLine(s)
    .replace(/ \+ /g, " & ")
    .replace(/\//g, "-")
    .replace(/\|{2,}/g, "|")
    .replace(/ · /g, " - ")
    .replace(/[«»]/g, '"');
}

/** A typed value in « » (inner « » become "). */
export function quoteValue(s: string): string {
  return `« ${oneLine(s).replace(/[«»]/g, '"')} »`;
}

/** Printable value of an option: sanitized; a numeric value is prefixed by its group or dim name. */
export function optionText(groupName: string, label: string): string {
  const v = sanitizeLabel(label);
  return NUMERIC.test(v) ? `${sanitizeLabel(groupName)} ${v}` : v;
}

/* ------------------------------------------------------------------ */
/* Snapshots                                                           */
/* ------------------------------------------------------------------ */

/**
 * The stored snapshot of one resolved unit (labels, codes and names as the page shows them, deltas
 * only on paid units). `unit.options` holds choice option ids and matrix cell keys, `unit.fields`
 * the cleaned typed values.
 */
export function orderUnitOf(doc: Pick<PageDoc, "items" | "product">, item: Item, unit: UnitChoice, free: boolean): OrderUnit {
  const multi = doc.items.length > 1;
  const options: OrderUnit["options"] = [];
  const fields: NonNullable<OrderUnit["fields"]> = [];
  let sku = item.sku;
  for (const g of item.groups) {
    if (isChoiceGroup(g)) {
      const o = g.options.find((x) => x.id === unit.options[g.id]);
      if (!o) continue;
      options.push({
        name: sanitizeLabel(g.name),
        value: optionText(g.name, o.label),
        ...(o.code ? { code: optionText(g.name, o.code) } : {}),
        ...(!free && o.delta ? { delta: o.delta } : {}),
      });
    } else if (isMatrixGroup(g)) {
      const combo = unit.options[g.id] ? parseCellKey(unit.options[g.id]!) : null;
      const res = combo ? resolveCombo(g, combo, item) : null;
      if (!res) continue;
      const value = res.values.map((x) => optionText(x.dim.name, x.value.label)).join("/");
      const coded = res.values.some((x) => x.value.code);
      const code = res.values.map((x) => optionText(x.dim.name, x.value.code ?? x.value.label)).join("/");
      options.push({ name: sanitizeLabel(g.name), value, ...(coded ? { code } : {}), ...(!free && res.delta > 0 ? { delta: fromCents(res.delta) } : {}) });
      if (res.sku) sku = res.sku;
    } else if (isFieldGroup(g)) {
      const v = unit.fields[g.id];
      if (v) fields.push({ name: sanitizeLabel(g.name), value: oneLine(v), ...(!free && g.delta ? { delta: g.delta } : {}) });
    }
  }
  return {
    item: item.id,
    label: multi ? itemName(doc, item) : "",
    ...(multi ? { short: itemShort(doc, item) } : {}),
    ...(sku ? { sku } : {}),
    ...(free ? { free: true as const } : {}),
    options,
    ...(fields.length ? { fields } : {}),
  };
}

/** One view of a stored order's units: v2 rows → `units`; v1 rows → rebuilt from `variants` (item "main", label ""). */
export function orderUnits(items: Pick<OrderItems, "units" | "variants" | "qty"> | null | undefined, _productName?: string): OrderUnit[] {
  if (!items) return [];
  if (Array.isArray(items.units)) return items.units;
  const variants = Array.isArray(items.variants) ? items.variants : [];
  const n = Math.max(variants.length, Math.max(0, Math.trunc(Number(items.qty) || 0)));
  const out: OrderUnit[] = [];
  for (let u = 0; u < Math.min(n, 20); u++) {
    const rec = variants[u] ?? {};
    out.push({
      item: "main",
      label: "",
      options: Object.entries(rec)
        .map(([name, value]) => ({ name: sanitizeLabel(name), value: optionText(name, String(value ?? "")) }))
        .filter((o) => o.value),
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

export interface TextExtra {
  name: string;
  value: string;
  code?: string;
  /** a typed value: printed in « » */
  typed?: true;
  delta?: number;
}

export interface TextInput {
  units: readonly OrderUnit[];
  /** the page sells 2+ items: counts and item names always printed */
  multi: boolean;
  gift?: { label: string } | null;
  /** the order bump when it is a catalog item ("[AJOUT] 1 × Sérum") */
  bump?: { unit?: OrderUnit | null } | null;
  /** an upsell accepted on the thank-you page */
  upsell?: { title: string; unit?: OrderUnit | null; confirmOptions?: boolean } | null;
  extras?: readonly TextExtra[];
  /** order id quoted when the text is capped ("voir CMD-7K3Q9X") */
  orderId?: string;
}

const pieces = (n: number) => `${n} pièce${n > 1 ? "s" : ""}`;
const plain = (n: number) => String(Math.round(n * 100) / 100);

/** The body of one unit part (no marker): [count][label][ (values)][ · fields] — "" when there is nothing to say. */
function partBody(u: OrderUnit, n: number, multi: boolean, mode: TextMode): string {
  const values = u.options.map((o) => (mode === "warehouse" ? (o.code ?? o.value) : o.value)).filter(Boolean);
  const fields = (u.fields ?? []).filter((f) => f.value).map((f) => `${f.name} ${quoteValue(f.value)}`);
  const label = multi ? sanitizeLabel(u.short || u.label) : "";
  if (!label && !values.length && !fields.length) return "";
  let s = multi || n > 1 ? `${n} × ` : "";
  if (label) s += label + (values.length ? ` (${values.join("/")})` : "");
  else s += values.join("/");
  if (fields.length) s += `${label || values.length ? " · " : ""}${fields.join(", ")}`;
  return s.trim();
}

function markedPart(marker: string, u: OrderUnit, n: number, multi: boolean, mode: TextMode, suffix = ""): string {
  const body = partBody(u, n, multi, mode);
  return `${marker} ${body || pieces(n)}${suffix}`;
}

/** The order text of units, gift, bump, upsell and extras (§G.4). */
export function unitsText(input: TextInput, mode: TextMode = "warehouse", max = ORDER_TEXT_MAX): string {
  // identical units counted, first-seen order; free never merges with paid
  const groups: { key: string; unit: OrderUnit; n: number }[] = [];
  for (const u of input.units) {
    const key = JSON.stringify([!!u.free, u.item, u.short ?? "", u.label, u.options.map((o) => [o.name, mode === "warehouse" ? (o.code ?? o.value) : o.value]), (u.fields ?? []).map((f) => [f.name, f.value])]);
    const g = groups.find((x) => x.key === key);
    if (g) g.n++;
    else groups.push({ key, unit: u, n: 1 });
  }
  const unitParts: { text: string; n: number }[] = [];
  for (const g of groups) {
    const text = g.unit.free ? markedPart("[OFFERT]", g.unit, g.n, input.multi, mode) : partBody(g.unit, g.n, input.multi, mode);
    if (text) unitParts.push({ text, n: g.n });
  }
  const fixed: string[] = [];
  if (input.gift?.label) fixed.push(`CADEAU : ${sanitizeLabel(input.gift.label)}`);
  if (input.bump?.unit) fixed.push(markedPart("[AJOUT]", input.bump.unit, 1, true, mode));
  if (input.upsell) {
    const confirm = input.upsell.confirmOptions ? " (options à confirmer)" : "";
    fixed.push(input.upsell.unit ? markedPart("[UPSELL]", input.upsell.unit, 1, true, mode, confirm) : `[UPSELL] 1 × ${sanitizeLabel(input.upsell.title)}${confirm}`);
  }
  const extras = (input.extras ?? []).filter((x) => x.value);
  const segment = extras.length
    ? ` || Commande : ${extras
        .map((x) => {
          const v = x.typed ? quoteValue(x.value) : sanitizeLabel(mode === "warehouse" ? (x.code ?? x.value) : x.value);
          return `${sanitizeLabel(x.name)} = ${v}${x.delta ? ` (+${plain(x.delta)})` : ""}`;
        })
        .join("; ")}`
    : "";

  const join = (parts: string[]) => parts.filter(Boolean).join(" + ");
  let kept = unitParts.length;
  let text = join([...unitParts.map((p) => p.text), ...fixed]) + segment;
  while (cp(text) > max && kept > 0) {
    kept--;
    const dropped = unitParts.slice(kept).reduce((s, p) => s + p.n, 0);
    const units = unitParts.slice(0, kept).map((p) => p.text);
    const more = ` … (+${dropped}${input.orderId ? `, voir ${input.orderId}` : ""})`;
    text = (units.length ? join([units.join(" + ") + more, ...fixed]) : join([more.trim(), ...fixed])) + segment;
  }
  return text;
}

/** The text of a stored order (v1 and v2 rows). */
export function orderText(items: OrderItems | null | undefined, opts: { mode?: TextMode; orderId?: string; productName?: string } = {}): string {
  if (!items) return "";
  const units = orderUnits(items, opts.productName);
  const multi = units.some((u) => !!u.label);
  return unitsText(
    {
      units,
      multi,
      gift: items.gift ?? null,
      bump: items.bump?.unit ? { unit: items.bump.unit } : null,
      upsell: items.upsell ? { title: items.upsell.title, confirmOptions: !!items.upsell.confirmOptions } : null,
      extras: items.extras ?? [],
      ...(opts.orderId ? { orderId: opts.orderId } : {}),
    },
    opts.mode ?? "warehouse",
  );
}

/* ------------------------------------------------------------------ */
/* Editors: "Dans Google Sheets : …"                                   */
/* ------------------------------------------------------------------ */

/** The first value a unit would get: the preset, else the first available allowed value (sold-out ones skipped). */
function firstUnit(item: Item, rules: Record<string, LineRule> | undefined): UnitChoice {
  const options: Record<string, string> = {};
  for (const g of item.groups) {
    const r = g.perUnit ? rules : undefined;
    if (isChoiceGroup(g)) {
      const lock = ruleLock(r?.[g.id]);
      const preset = rulePreset(r?.[g.id]);
      const avail = availableOptions(g, r);
      const pick = lock ?? (preset && avail.some((o) => o.id === preset) ? preset : (avail[0] ?? groupOptions(g, r)[0])?.id);
      if (pick) options[g.id] = pick;
    } else if (isMatrixGroup(g)) {
      const c = availableCombos(g, r, item)[0] ?? groupCombos(g, r, item)[0];
      if (c) options[g.id] = c.key;
    }
  }
  return { item: item.id, options, fields: {} };
}

/** Variante (warehouse text) an offer produces with the first available values of every unit. */
export function sheetPreview(doc: Pick<PageDoc, "items" | "product">, offer: Offer): string {
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const units: OrderUnit[] = [];
  for (const slot of expandUnits(offer, doc.items)) {
    const id = slot.item ?? slot.available?.[0] ?? slot.choices?.[0];
    const item = id ? byId.get(id) : undefined;
    if (!item) continue;
    units.push(orderUnitOf(doc, item, firstUnit(item, slot.rules), slot.free));
  }
  return unitsText({ units, multi: doc.items.length > 1, gift: offer.gift ?? null }, "warehouse");
}

/** Cents → stored money (re-exported for the order snapshot builders). */
export { fromCents, toCents };
