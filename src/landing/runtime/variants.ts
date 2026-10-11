/**
 * Per-unit variant pickers. Controls follow the contract names: "v.<i>.<groupId>" for unit i
 * (0-based) and "v.<groupId>" for a choice shared by every unit.
 *
 * [data-lp-variants] may hold server-rendered rows and/or <template data-lp-variant-tpl>; one row
 * per unit of the selected bundle is shown ({n} → 1-based unit number, {i} → 0-based index, in
 * text and attributes, e.g. name="v.{i}.color" id="v-{i}-color"). Rows are tagged
 * data-lp-variant-row="<i>" — server-rendered rows are adopted from their control names. Rows
 * beyond the bundle quantity are hidden, never removed: choices survive switching packs and nodes
 * owned by the preview's React tree are left in place.
 */
import type { Ctl } from "./core";
import { $$ } from "./core";

const ROW = "data-lp-variant-row";
const CTLS = "input[name^='v.'],select[name^='v.']";
const NAME = /^v\.(?:(\d{1,2})\.)?([A-Za-z0-9_-]{1,40})$/;

/** Unit index encoded in a control name; -1 for shared choices and foreign names. */
function unitOf(el: Element): number {
  const m = NAME.exec(el.getAttribute("name") || "");
  return m && m[1] !== undefined ? +m[1] : -1;
}

function fill(s: string, i: number): string {
  return s.replace(/\{([ni])\}/g, (_, k: string) => String(k === "n" ? i + 1 : i));
}

function makeRow(doc: Document, tpl: HTMLTemplateElement, i: number): Element {
  const frag = doc.importNode(tpl.content, true);
  const els = $$<Element>(frag, "*");
  let row: Element;
  if (frag.children.length === 1) row = frag.children[0]!;
  else {
    row = doc.createElement("div");
    row.className = "lp-variant-row";
    row.appendChild(frag);
  }
  row.setAttribute(ROW, String(i));
  for (const el of [row].concat(els)) {
    for (const a of Array.prototype.slice.call(el.attributes) as Attr[])
      if (a.value.indexOf("{") >= 0) el.setAttribute(a.name, fill(a.value, i));
  }
  const walker = doc.createTreeWalker(row, 4 /* SHOW_TEXT */);
  for (let t = walker.nextNode(); t; t = walker.nextNode())
    if (t.nodeValue && t.nodeValue.indexOf("{") >= 0) t.nodeValue = fill(t.nodeValue, i);
  return row;
}

/** Tag untagged server-rendered rows: the widest ancestor (inside the box) holding only one unit's controls. */
function adopt(box: Element): void {
  for (const ctl of $$(box, CTLS)) {
    const i = unitOf(ctl);
    if (i < 0 || ctl.closest("[" + ROW + "]")) continue;
    let row: Element = ctl;
    for (let p = ctl.parentElement; p && p !== box && $$(p, CTLS).every((x) => unitOf(x) === i); p = p.parentElement) row = p;
    row.setAttribute(ROW, String(i));
  }
}

/** Show exactly `qty` unit rows (cloning missing ones from the template). */
export function syncVariantRows(doc: Document, form: HTMLFormElement, qty: number): void {
  const box = form.querySelector("[data-lp-variants]");
  if (!box) return;
  adopt(box);
  const tpl = (box.querySelector("template[data-lp-variant-tpl]") ||
    form.querySelector("template[data-lp-variant-tpl]")) as HTMLTemplateElement | null;
  const have: boolean[] = [];
  let last: Element | null = null;
  for (const r of $$(box, "[" + ROW + "]")) {
    const i = parseInt(r.getAttribute(ROW) || "", 10);
    const off = !(i >= 0 && i < qty);
    if (r.hidden !== off) r.hidden = off;
    if (i >= 0) have[i] = true;
    last = r;
  }
  if (tpl && tpl.content)
    for (let i = 0; i < qty; i++)
      if (!have[i]) {
        const row = makeRow(doc, tpl, i);
        if (last && last.parentNode) last.parentNode.insertBefore(row, last.nextSibling);
        else box.appendChild(row);
        last = row;
      }
  box.setAttribute("data-units", String(qty));
}

/** Selected options per unit: [{ groupId: optionId }] × qty (empty when the product has no variants). */
export function readVariants(form: HTMLFormElement, qty: number): Record<string, string>[] {
  const shared: Record<string, string> = {};
  const rows: Record<string, string>[] = [];
  let any = false;
  for (const el of $$<Ctl>(form, CTLS)) {
    if (el.disabled) continue;
    if ((el.type === "radio" || el.type === "checkbox") && !(el as HTMLInputElement).checked) continue;
    const m = NAME.exec(el.name);
    const value = el.value;
    if (!m || !value || value.length > 40) continue;
    any = true;
    if (m[1] === undefined) shared[m[2]!] = value;
    else if (+m[1] < qty) (rows[+m[1]] = rows[+m[1]] || {})[m[2]!] = value;
  }
  if (!any) return [];
  const out: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(qty, 20); i++) out.push(Object.assign({}, shared, rows[i] || {}));
  return out;
}

/** Required variant controls left empty in visible rows (radio groups reported once, by their first radio). */
export function missingVariants(form: HTMLFormElement): Ctl[] {
  const bad: Ctl[] = [];
  const groups: Record<string, boolean> = {};
  const all = $$<Ctl>(form, CTLS);
  for (const el of all) {
    if (el.disabled || !el.required || el.closest("[" + ROW + "][hidden]")) continue;
    if (el.type === "radio") {
      if (groups[el.name]) continue;
      groups[el.name] = true;
      if (!all.some((r) => r.type === "radio" && r.name === el.name && (r as HTMLInputElement).checked)) bad.push(el);
    } else if (!el.value) bad.push(el);
  }
  return bad;
}
