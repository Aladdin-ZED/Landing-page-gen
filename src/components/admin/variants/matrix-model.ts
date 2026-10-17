/**
 * Pure edit operations of combined options (matrix groups, docs/OFFERS.md §D.1, §D.5) and custom
 * fields: creation from dimension presets, the panel summary, exception editing in the
 * combinations grid, merge of two choice groups into one combined option and the inverse split,
 * adding / removing a dimension. Every function returns new objects and keeps the group
 * schema-valid (ids unique, canonical cell keys unique, ≤ 240 combinations).
 *
 * Grid edits work on NORMALIZED cells: one cell per full combination (wildcard exceptions expanded,
 * most severe state and most specific photo / price / SKU kept), so a single combination can be
 * reopened even when a wildcard closed a whole row. Only exceptions are stored: a combination in
 * stock with nothing of its own has no cell.
 */
import { allCombos, cellKey, type Combo } from "@/lib/page/options";
import {
  isChoiceGroup,
  isMatrixGroup,
  LIMITS,
  MATRIX_MAX_COMBINATIONS,
  type AssetRef,
  type CellState,
  type Choice,
  type ChoiceGroup,
  type FieldGroup,
  type Locale,
  type MatrixCell,
  type MatrixDim,
  type MatrixGroup,
  type OptionGroup,
} from "@/lib/page/schema";
import { cleanLabel, presetKind, presetName, presetValues, swatchFor, variantIds, type VariantPreset } from "@/lib/page/variant-presets";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** A short schema id ("d-k3m9x") not in `taken`. */
export function uid(prefix: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const bytes = new Uint8Array(5);
  for (;;) {
    const c = globalThis.crypto;
    if (c?.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const id = `${prefix}-${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
    if (!used.has(id)) return id;
  }
}

/* ------------------------------------------------------------------ */
/* creation                                                            */
/* ------------------------------------------------------------------ */

/** Values of a new dimension: the preset's quick-fill values (sizes, shoe sizes, volumes), colors left to the owner. */
function presetChoices(p: VariantPreset, locale: Locale, taken: string[]): Choice[] {
  return presetValues(p, locale)
    .slice(0, p === "shoe" ? 8 : 6)
    .map((label) => {
      const id = uid("o", taken);
      taken.push(id);
      const swatch = p === "color" ? swatchFor(label) : undefined;
      return { id, label, soldOut: false, ...(swatch ? { swatch } : {}) };
    });
}

export interface DimDraft {
  preset: VariantPreset;
  name: string;
  kind: MatrixDim["kind"];
  values: Choice[];
}

/** A dimension being set up in the "Combined option" dialog (values typed there). */
export function newDimDraft(preset: VariantPreset, locale: Locale, taken: string[]): DimDraft {
  return { preset, name: presetName(preset, locale), kind: presetKind(preset), values: presetChoices(preset, locale, taken) };
}

/** The combined option made of 2–3 dimension drafts (null while a dimension has no value or no name). */
export function matrixFromDrafts(drafts: readonly DimDraft[], ctx: { locale: Locale; taken: readonly string[]; name?: string }): MatrixGroup | null {
  if (drafts.length < 2 || drafts.length > 3) return null;
  const taken = [...ctx.taken];
  const dims: MatrixDim[] = [];
  for (const d of drafts) {
    const name = cleanLabel(d.name);
    if (!name || !d.values.length) return null;
    const id = uid("d", taken);
    taken.push(id);
    dims.push({ id, name, kind: d.kind, values: d.values.slice(0, LIMITS.matrixValues) });
  }
  if (combinations(dims) > MATRIX_MAX_COMBINATIONS) return null;
  const id = uid("g", taken);
  const name = cleanLabel(ctx.name ?? "") || dims.map((d) => d.name).join(ctx.locale === "ar" ? " و" : " & ").slice(0, 40);
  return { id, name, kind: "matrix", perUnit: true, dims, cells: [], display: "auto" };
}

const FIELD_NAMES: Record<Locale, string> = { fr: "Prénom à imprimer", ar: "الاسم للطباعة", en: "Name to print", es: "Nombre a imprimir", de: "Name zum Drucken", it: "Nome da stampare", nl: "Naam om te drukken", pt: "Nome a imprimir" };

/** A new custom field ("Name to print"): required text, 24 characters, any characters. */
export function newField(locale: Locale, taken: readonly string[]): FieldGroup {
  return { id: uid("g", taken), name: FIELD_NAMES[locale] ?? FIELD_NAMES.en, kind: "field", perUnit: true, input: "text", required: true, maxLength: 24, charset: "any" };
}

/* ------------------------------------------------------------------ */
/* summary                                                             */
/* ------------------------------------------------------------------ */

export const combinations = (dims: readonly Pick<MatrixDim, "values">[]) => dims.reduce((n, d) => n * d.values.length, 1);

const SEVERITY: Record<CellState, number> = { in: 0, out: 1, none: 2 };

/** What the cells alone say about one full combination (values' own sold-out flags not included). */
export function cellOf(g: Pick<MatrixGroup, "cells">, combo: Readonly<Combo>): Omit<MatrixCell, "v"> & { state: CellState } {
  let state: CellState = "in";
  const matching: { cell: MatrixCell; size: number; at: number }[] = [];
  g.cells.forEach((cell, at) => {
    const entries = Object.entries(cell.v);
    if (entries.length && entries.every(([d, v]) => combo[d] === v)) matching.push({ cell, size: entries.length, at });
  });
  for (const m of matching) if (SEVERITY[m.cell.state] > SEVERITY[state]) state = m.cell.state;
  matching.sort((a, b) => b.size - a.size || a.at - b.at);
  const image = matching.find((m) => m.cell.image)?.cell.image;
  const delta = matching.find((m) => m.cell.delta !== undefined)?.cell.delta;
  const sku = matching.find((m) => m.cell.sku)?.cell.sku;
  return { state, ...(image ? { image } : {}), ...(delta !== undefined ? { delta } : {}), ...(sku ? { sku } : {}) };
}

/** The state shown in the grid: a sold-out value closes every combination with it. */
export function comboState(g: MatrixGroup, combo: Readonly<Combo>): CellState {
  const own = cellOf(g, combo).state;
  if (own === "none") return "none";
  const valueOut = g.dims.some((d) => d.values.find((v) => v.id === combo[d.id])?.soldOut);
  return valueOut ? "out" : own;
}

export interface MatrixStats {
  combos: number;
  out: number;
  none: number;
  /** combinations with their own photo, price or SKU */
  custom: number;
  open: number;
}

export function matrixStats(g: MatrixGroup): MatrixStats {
  const all = allCombos(g);
  let out = 0;
  let none = 0;
  let custom = 0;
  for (const c of all) {
    const s = comboState(g, c);
    if (s === "out") out++;
    else if (s === "none") none++;
    const cell = cellOf(g, c);
    if (cell.image || cell.delta !== undefined || cell.sku) custom++;
  }
  return { combos: all.length, out, none, custom, open: all.length - out - none };
}

/** "Couleur 3 × Taille 4 · 1 out of stock · 2 not made" */
export function matrixSummary(g: MatrixGroup): string {
  const s = matrixStats(g);
  const head = g.dims.map((d) => `${d.name} ${d.values.length}`).join(" × ");
  const tail = [s.out ? `${s.out} out of stock` : null, s.none ? `${s.none} not made` : null, s.custom ? `${s.custom} with own photo or price` : null].filter(Boolean);
  return [head, ...tail].join(" · ");
}

/** "auto" display resolved like the order form: combined when ≤ 8 valid combinations. */
export const autoDisplay = (g: MatrixGroup): "linked" | "combined" => (matrixStats(g).open <= 8 ? "combined" : "linked");

/* ------------------------------------------------------------------ */
/* grid edits (normalized cells)                                       */
/* ------------------------------------------------------------------ */

const isPlain = (c: Omit<MatrixCell, "v">) => c.state === "in" && !c.image && c.delta === undefined && !c.sku;

/** One cell per full combination that has an exception (wildcards expanded). */
export function normalizeCells(g: MatrixGroup): MatrixCell[] {
  const out: MatrixCell[] = [];
  for (const combo of allCombos(g)) {
    const c = cellOf(g, combo);
    if (!isPlain(c)) out.push({ v: { ...combo }, ...c });
  }
  return out;
}

export type CellPatch = Partial<{ state: CellState; image: AssetRef | null; delta: number | null; sku: string | null }>;

function apply(cell: Omit<MatrixCell, "v">, patch: CellPatch): Omit<MatrixCell, "v"> {
  const next: Omit<MatrixCell, "v"> = { ...cell };
  if (patch.state) next.state = patch.state;
  if (patch.image !== undefined) {
    if (patch.image) next.image = patch.image;
    else delete next.image;
  }
  if (patch.delta !== undefined) {
    if (patch.delta === null) delete next.delta;
    else next.delta = patch.delta;
  }
  if (patch.sku !== undefined) {
    const sku = patch.sku?.trim().slice(0, 60);
    if (sku) next.sku = sku;
    else delete next.sku;
  }
  return next;
}

/** Patch every full combination matching `where` (a partial combination: a row, a column, or one cell). */
export function patchCombos(g: MatrixGroup, where: Readonly<Combo>, patch: CellPatch): MatrixGroup {
  const cells = new Map(normalizeCells(g).map((c) => [cellKey(c.v), c]));
  for (const combo of allCombos(g)) {
    if (!Object.entries(where).every(([d, v]) => combo[d] === v)) continue;
    const key = cellKey(combo);
    const cur = cells.get(key) ?? { v: { ...combo }, state: "in" as const };
    const next = apply(cur, patch);
    if (isPlain(next)) cells.delete(key);
    else cells.set(key, { v: { ...combo }, ...next });
  }
  return { ...g, cells: compact(g, [...cells.values()]) };
}

/**
 * Stored cells, smaller: a whole row (or column) closed the same way becomes one wildcard exception
 * (`{ d-col: o-noir }` out) when none of its cells carries its own photo, price or SKU.
 */
function compact(g: MatrixGroup, cells: MatrixCell[]): MatrixCell[] {
  if (g.dims.length !== 2) return cells.slice(0, LIMITS.matrixCells);
  const [a, b] = g.dims as [MatrixDim, MatrixDim];
  const byKey = new Map(cells.map((c) => [cellKey(c.v), c]));
  const used = new Set<string>();
  const out: MatrixCell[] = [];
  const line = (dim: MatrixDim, other: MatrixDim, value: Choice) => {
    const keys = other.values.map((o) => cellKey({ [dim.id]: value.id, [other.id]: o.id }));
    const list = keys.map((k) => byKey.get(k));
    const first = list[0];
    if (!first || other.values.length < 2) return;
    if (!list.every((c) => c && c.state === first.state && c.state !== "in" && !c.image && c.delta === undefined && !c.sku)) return;
    if (keys.some((k) => used.has(k))) return;
    keys.forEach((k) => used.add(k));
    out.push({ v: { [dim.id]: value.id }, state: first.state });
  };
  for (const v of a.values) line(a, b, v);
  for (const v of b.values) line(b, a, v);
  for (const c of cells) if (!used.has(cellKey(c.v))) out.push(c);
  return out.slice(0, LIMITS.matrixCells);
}

/* ------------------------------------------------------------------ */
/* dimensions                                                          */
/* ------------------------------------------------------------------ */

/** Replace one dimension (values edited, renamed…); cells naming removed values are dropped. */
export function withDim(g: MatrixGroup, index: number, dim: MatrixDim): MatrixGroup | null {
  const dims = g.dims.map((d, i) => (i === index ? dim : d));
  if (combinations(dims) > MATRIX_MAX_COMBINATIONS) return null;
  const valid = new Map(dims.map((d) => [d.id, new Set(d.values.map((v) => v.id))]));
  const cells = g.cells.filter((c) => Object.entries(c.v).every(([d, v]) => valid.get(d)?.has(v)));
  return { ...g, dims, cells };
}

/** A third dimension (wildcards keep every existing exception valid). */
export function addDim(g: MatrixGroup, draft: DimDraft, taken: readonly string[]): MatrixGroup | { error: string } {
  if (g.dims.length >= 3) return { error: "A combined option has at most 3 dimensions." };
  const name = cleanLabel(draft.name);
  if (!name || !draft.values.length) return { error: "Name the dimension and add a value." };
  const dims = [...g.dims, { id: uid("d", [...taken, ...variantIds([g])]), name, kind: draft.kind, values: draft.values }];
  const n = combinations(dims);
  if (n > MATRIX_MAX_COMBINATIONS) return { error: `${n} combinations: at most ${MATRIX_MAX_COMBINATIONS}.` };
  return { ...g, dims };
}

/** Without a dimension: its key leaves every cell, duplicates merge (most severe state wins). Needs 3 dims. */
export function removeDim(g: MatrixGroup, dimId: string): MatrixGroup | null {
  if (g.dims.length <= 2) return null;
  const dims = g.dims.filter((d) => d.id !== dimId);
  const merged = new Map<string, MatrixCell>();
  for (const c of g.cells) {
    const v = { ...c.v };
    delete v[dimId];
    if (!Object.keys(v).length) continue;
    const key = cellKey(v);
    const prev = merged.get(key);
    if (!prev) merged.set(key, { ...c, v });
    else merged.set(key, { ...prev, ...c, v, state: SEVERITY[c.state] > SEVERITY[prev.state] ? c.state : prev.state });
  }
  return { ...g, dims, cells: [...merged.values()] };
}

/* ------------------------------------------------------------------ */
/* merge / split                                                       */
/* ------------------------------------------------------------------ */

/** Why two choice groups can't become one combined option without losing anything (null = they can). */
export function mergeBlocker(a: ChoiceGroup, b: ChoiceGroup, groups: readonly OptionGroup[]): string | null {
  if (groups.some(isMatrixGroup)) return "This product already has a combined option.";
  if (a.options.length > LIMITS.matrixValues || b.options.length > LIMITS.matrixValues) return `A dimension holds at most ${LIMITS.matrixValues} values.`;
  const n = a.options.length * b.options.length;
  if (n > MATRIX_MAX_COMBINATIONS) return `${n} combinations: at most ${MATRIX_MAX_COMBINATIONS}.`;
  if (a.perUnit !== b.perUnit) return "One is chosen per piece, the other once per order.";
  return null;
}

export interface Rekey {
  /** old rule key → new rule key (offers' line rules follow) */
  [oldKey: string]: string;
}

/**
 * Merge two choice groups into one combined option at the first one's place: photos, swatches,
 * price differences, codes and sold-out values kept; the dims keep the groups' ids, so line rules
 * move from "g-col" to "<matrix>.g-col".
 */
export function mergeGroups(groups: readonly OptionGroup[], aId: string, bId: string, locale: Locale): { groups: OptionGroup[]; rekey: Rekey } | { error: string } {
  const a = groups.find((g) => g.id === aId);
  const b = groups.find((g) => g.id === bId);
  if (!a || !b || !isChoiceGroup(a) || !isChoiceGroup(b) || a.id === b.id) return { error: "Pick two separate options." };
  const blocker = mergeBlocker(a, b, groups);
  if (blocker) return { error: blocker };
  const id = uid("g", variantIds(groups));
  const name = `${a.name}${locale === "ar" ? " و" : " & "}${b.name}`.slice(0, 40);
  const dim = (g: ChoiceGroup): MatrixDim => ({ id: g.id, name: g.name, kind: g.kind, values: g.options });
  const matrix: MatrixGroup = { id, name, kind: "matrix", perUnit: a.perUnit, dims: [dim(a), dim(b)], cells: [], display: "auto" };
  const at = groups.findIndex((g) => g.id === a.id);
  const next = groups.filter((g) => g.id !== a.id && g.id !== b.id);
  next.splice(Math.min(at, next.length), 0, matrix);
  return { groups: next, rekey: { [a.id]: `${id}.${a.id}`, [b.id]: `${id}.${b.id}` } };
}

/** Why a combined option can't go back to separate options (null = it can). */
export function splitBlocker(g: MatrixGroup, groups: readonly OptionGroup[]): string | null {
  if (g.cells.length) return "Some combinations have their own stock, photo, price or SKU: split would lose them.";
  if (groups.length - 1 + g.dims.length > LIMITS.groupsPerItem) return `A product has at most ${LIMITS.groupsPerItem} options.`;
  return null;
}

/** The inverse of a merge: one choice group per dimension (ids = dim ids). */
export function splitGroup(groups: readonly OptionGroup[], gid: string): { groups: OptionGroup[]; rekey: Rekey } | { error: string } {
  const g = groups.find((x) => x.id === gid);
  if (!g || !isMatrixGroup(g)) return { error: "Not a combined option." };
  const blocker = splitBlocker(g, groups);
  if (blocker) return { error: blocker };
  const taken = new Set(groups.filter((x) => x.id !== gid).map((x) => x.id));
  const rekey: Rekey = {};
  const parts: ChoiceGroup[] = g.dims.map((d) => {
    const id = taken.has(d.id) ? uid("g", [...taken, ...variantIds(groups)]) : d.id;
    taken.add(id);
    rekey[`${g.id}.${d.id}`] = id;
    return { id, name: d.name, kind: d.kind, perUnit: g.perUnit, display: "auto", options: d.values };
  });
  const at = groups.findIndex((x) => x.id === gid);
  const next = groups.filter((x) => x.id !== gid);
  next.splice(at, 0, ...parts);
  return { groups: next, rekey };
}
