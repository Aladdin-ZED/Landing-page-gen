/**
 * Option rules shared by the order validation (src/lib/orders/validate.ts), the pricing
 * (src/lib/page/pricing.ts), the runtime config builder and the PHP export spec (docs/OFFERS.md §D):
 *
 *   cellKey({ "d-size": "o-xl", "d-col": "o-noir" })   "d-col=o-noir|d-size=o-xl" (canonical, sorted by dim id)
 *   resolveCombo(group, combo, item)                    state in / out / none, image, delta (cents), sku
 *   ruleTarget(item, "g-fit.d-col")                     the choice group or matrix dim a line rule aims at
 *   groupOptions / groupCombos                          what a unit can pick under a line's rules
 *   itemAvailable(item, rules)                          every required group has something to pick
 *   checkField(group, raw)                              typed values: cleaning, digits, charsets, lengths
 *
 * Pure, framework-free, isomorphic. Money here is integer cents (deltas of the doc are Money with
 * ≤ 2 decimals).
 */
import type { AssetRef, CellState, Choice, ChoiceGroup, FieldGroup, Item, LineRule, MatrixCell, MatrixDim, MatrixGroup, OptionGroup } from "./schema";

type Cents = number;
const cents = (m: number | undefined): Cents => (typeof m === "number" && Number.isFinite(m) ? Math.round(m * 100) : 0);

const isChoice = (g: { kind: string }): g is ChoiceGroup => g.kind === "swatch" || g.kind === "text" || g.kind === "image";

/* ------------------------------------------------------------------ */
/* Matrix keys                                                         */
/* ------------------------------------------------------------------ */

/** Combination of a matrix group: dim id → value id (a missing dim is a wildcard in cells). */
export type Combo = Record<string, string>;

/** Canonical key of a combination or cell: entries sorted by dim id, "dimId=valueId" joined by "|". */
export function cellKey(v: Readonly<Combo>): string {
  return Object.keys(v)
    .sort()
    .map((k) => `${k}=${v[k]}`)
    .join("|");
}

const PAIR = /^([A-Za-z0-9_-]{2,40})=([A-Za-z0-9_-]{2,40})$/;

/** "d-col=o-noir|d-size=o-m" (any order) → { "d-col": "o-noir", "d-size": "o-m" }; null when malformed or a dim repeats. */
export function parseCellKey(key: string): Combo | null {
  if (typeof key !== "string" || !key || key.length > 250) return null;
  const out: Combo = {};
  for (const part of key.split("|")) {
    const m = PAIR.exec(part);
    if (!m || Object.prototype.hasOwnProperty.call(out, m[1]!)) return null;
    out[m[1]!] = m[2]!;
  }
  return out;
}

/** Every combination of a matrix (Π values ≤ 240 by schema), dims in order. */
export function allCombos(group: Pick<MatrixGroup, "dims">): Combo[] {
  let out: Combo[] = [{}];
  for (const d of group.dims) {
    const next: Combo[] = [];
    for (const c of out) for (const v of d.values) next.push({ ...c, [d.id]: v.id });
    out = next;
  }
  return out;
}

const SEVERITY: Record<CellState, number> = { in: 0, out: 1, none: 2 };

export interface ComboResolution {
  key: string;
  /** none > out > in: "none" = not made (never shown as épuisé) */
  state: CellState;
  image?: AssetRef;
  /** surcharge per unit, cents (cell delta, else Σ value deltas) */
  delta: Cents;
  /** the delta comes from a cell (else from the values' own deltas) */
  fromCell: boolean;
  /** cell sku, else item.sku */
  sku?: string;
  /** the values of the combination, dims in order */
  values: { dim: MatrixDim; value: Choice }[];
}

/**
 * Resolution of a complete combination (one value per dim): matching cells = cells whose `v` ⊆
 * combo; state = the most severe of the matching cells and of the values' soldOut (→ out); image /
 * delta / sku from the most specific matching cell that defines it (more dims wins; tie → first).
 * Null when the combination names an unknown dim or value, or misses a dim.
 */
export function resolveCombo(group: MatrixGroup, combo: Readonly<Combo>, item?: Pick<Item, "sku">): ComboResolution | null {
  const values: { dim: MatrixDim; value: Choice }[] = [];
  for (const dim of group.dims) {
    const id = combo[dim.id];
    const value = id === undefined ? undefined : dim.values.find((v) => v.id === id);
    if (!value) return null;
    values.push({ dim, value });
  }
  if (Object.keys(combo).length !== group.dims.length) return null;
  let state: CellState = values.some((x) => x.value.soldOut) ? "out" : "in";
  const matching: { cell: MatrixCell; size: number; at: number }[] = [];
  group.cells.forEach((cell, at) => {
    const entries = Object.entries(cell.v);
    if (entries.length && entries.every(([d, v]) => combo[d] === v)) matching.push({ cell, size: entries.length, at });
  });
  for (const m of matching) if (SEVERITY[m.cell.state] > SEVERITY[state]) state = m.cell.state;
  // most specific first; ties keep array order
  matching.sort((a, b) => b.size - a.size || a.at - b.at);
  const image = matching.find((m) => m.cell.image)?.cell.image;
  const deltaCell = matching.find((m) => m.cell.delta !== undefined)?.cell;
  const skuCell = matching.find((m) => m.cell.sku)?.cell;
  const delta = deltaCell ? cents(deltaCell.delta) : values.reduce((n, x) => n + cents(x.value.delta), 0);
  const sku = skuCell?.sku ?? item?.sku;
  return { key: cellKey(combo), state, ...(image ? { image } : {}), delta, fromCell: !!deltaCell, ...(sku ? { sku } : {}), values };
}

/* ------------------------------------------------------------------ */
/* Line rules                                                          */
/* ------------------------------------------------------------------ */

export type RuleTarget = { kind: "choice"; group: ChoiceGroup } | { kind: "dim"; group: MatrixGroup; dim: MatrixDim };

/** The per-unit choice group ("g-color") or matrix dim ("g-fit.d-col") a rule key names; null otherwise. */
export function ruleTarget(item: Pick<Item, "groups">, key: string): RuleTarget | null {
  const [gid, dimId, extra] = key.split(".");
  if (extra !== undefined) return null;
  const g = item.groups.find((x) => x.id === gid);
  if (!g || !g.perUnit) return null;
  if (isChoice(g)) return dimId === undefined ? { kind: "choice", group: g } : null;
  if (g.kind === "matrix" && dimId !== undefined) {
    const dim = g.dims.find((d) => d.id === dimId);
    return dim ? { kind: "dim", group: g, dim } : null;
  }
  return null;
}

/** Does a rule let this value through? (lock: only it; allow: the list; preset: everything) */
export function ruleAllows(rule: LineRule | undefined, id: string): boolean {
  if (!rule) return true;
  if ("lock" in rule) return rule.lock === id;
  if ("allow" in rule) return rule.allow.includes(id);
  return true;
}

/** The locked value of a rule, if any. */
export const ruleLock = (rule: LineRule | undefined): string | undefined => (rule && "lock" in rule ? rule.lock : undefined);
/** The initial value of a rule (preset), if any. */
export const rulePreset = (rule: LineRule | undefined): string | undefined => (rule && "preset" in rule ? rule.preset : undefined);

/** Rules of a line for one matrix group, keyed by dim id. */
export function dimRules(group: MatrixGroup, rules: Readonly<Record<string, LineRule>> | undefined): Record<string, LineRule> {
  const out: Record<string, LineRule> = {};
  if (!rules) return out;
  for (const d of group.dims) {
    const r = rules[`${group.id}.${d.id}`];
    if (r) out[d.id] = r;
  }
  return out;
}

/** Options of a choice group a unit may pick under a line's rules (sold-out ones included, flagged by `soldOut`). */
export function groupOptions(group: ChoiceGroup, rules?: Readonly<Record<string, LineRule>>): Choice[] {
  const rule = group.perUnit ? rules?.[group.id] : undefined;
  return group.options.filter((o) => ruleAllows(rule, o.id));
}

/** The available options of a choice group under a line's rules (what can really be ordered). */
export const availableOptions = (group: ChoiceGroup, rules?: Readonly<Record<string, LineRule>>): Choice[] =>
  groupOptions(group, rules).filter((o) => !o.soldOut);

/** Every combination of a matrix under a line's rules (dim locks / allow lists), resolved. */
export function groupCombos(group: MatrixGroup, rules?: Readonly<Record<string, LineRule>>, item?: Pick<Item, "sku">): ComboResolution[] {
  const r = group.perUnit ? dimRules(group, rules) : {};
  const out: ComboResolution[] = [];
  for (const combo of allCombos(group)) {
    if (!group.dims.every((d) => ruleAllows(r[d.id], combo[d.id]!))) continue;
    const res = resolveCombo(group, combo, item);
    if (res) out.push(res);
  }
  return out;
}

/** The orderable combinations (state "in") of a matrix under a line's rules. */
export const availableCombos = (group: MatrixGroup, rules?: Readonly<Record<string, LineRule>>, item?: Pick<Item, "sku">): ComboResolution[] =>
  groupCombos(group, rules, item).filter((c) => c.state === "in");

/** Min / max surcharge (cents) of one unit's pick in a required group (choice or matrix); null when nothing can be ordered. */
export function groupDeltaRange(group: OptionGroup, rules?: Readonly<Record<string, LineRule>>): { min: Cents; max: Cents } | null {
  let list: Cents[];
  if (isChoice(group)) list = availableOptions(group, rules).map((o) => cents(o.delta));
  else if (group.kind === "matrix") list = availableCombos(group, rules).map((c) => c.delta);
  else return { min: 0, max: 0 }; // fields are opt-in add-ons: never in the card price
  if (!list.length) return null;
  return { min: Math.min(...list), max: Math.max(...list) };
}

/** Σ over the item's required groups of their min / max unit surcharge; null when a group has nothing orderable. */
export function itemDeltaRange(item: Pick<Item, "groups">, rules?: Readonly<Record<string, LineRule>>): { min: Cents; max: Cents } | null {
  let min = 0;
  let max = 0;
  for (const g of item.groups) {
    const r = groupDeltaRange(g, rules);
    if (!r) return null;
    min += r.min;
    max += r.max;
  }
  return { min, max };
}

/** The item can be ordered under these rules: not sold out, every choice / matrix group has an available pick. */
export function itemAvailable(item: Pick<Item, "groups" | "soldOut">, rules?: Readonly<Record<string, LineRule>>): boolean {
  return !item.soldOut && itemDeltaRange(item, rules) !== null;
}

/* ------------------------------------------------------------------ */
/* Typed values (§D.4)                                                 */
/* ------------------------------------------------------------------ */

const ch = (code: number) => String.fromCharCode(code);
// C0/C1 controls, zero-width characters + LRM/RLM, bidi embeddings/overrides/isolates, BOM
const STRIP = new RegExp(`[${ch(0)}-${ch(0x1f)}${ch(0x7f)}-${ch(0x9f)}${ch(0x200b)}-${ch(0x200f)}${ch(0x202a)}-${ch(0x202e)}${ch(0x2066)}-${ch(0x2069)}${ch(0xfeff)}]`, "g");

/** NFC, controls / bidi overrides / zero-width characters removed, whitespace collapsed, trimmed (never truncated). */
export function cleanText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(STRIP, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eastern Arabic "٠-٩" and Persian "۰-۹" digits → "0-9". */
export function foldDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
}

/** Length in code points (an emoji or a surrogate pair counts once). */
export const codePoints = (s: string): number => Array.from(s).length;

export const CHARSET_RE: Record<Exclude<FieldGroup["charset"], "any">, RegExp> = {
  letters: /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u,
  latin: /^[A-Za-zÀ-ÖØ-öø-ÿ0-9 '’.\-&]+$/,
  digits: /^[0-9]+$/,
};

export type FieldError = "required" | "too_long" | "invalid";
/** ok with value "" = optional field left empty. */
export type FieldCheck = { ok: true; value: string } | { ok: false; error: FieldError };

type FieldRules = Pick<FieldGroup, "input" | "required" | "maxLength" | "min" | "max" | "charset">;

/**
 * A typed value against its field (server = truth; mirrored by the runtime and order.php):
 * clean → fold digits (digits / number) → required → "<" ">" (invalid) → length in code points
 * (too_long, never truncated) → charset / number range (invalid).
 */
export function checkField(field: FieldRules, raw: unknown): FieldCheck {
  let value = typeof raw === "string" || typeof raw === "number" ? cleanText(raw) : "";
  const numeric = field.input === "number" || field.charset === "digits";
  if (numeric) value = foldDigits(value);
  if (!value) return field.required ? { ok: false, error: "required" } : { ok: true, value: "" };
  if (/[<>]/.test(value)) return { ok: false, error: "invalid" };
  if (codePoints(value) > field.maxLength) return { ok: false, error: "too_long" };
  if (field.input === "number") {
    if (!/^[0-9]{1,7}$/.test(value)) return { ok: false, error: "invalid" };
    const n = Number(value);
    if (n < (field.min ?? 0) || n > (field.max ?? 1_000_000)) return { ok: false, error: "invalid" };
    return { ok: true, value };
  }
  if (field.charset !== "any" && !CHARSET_RE[field.charset].test(value)) return { ok: false, error: "invalid" };
  return { ok: true, value };
}
