/**
 * Product option pickers (markup: src/landing/sections/orderForm/variants.tsx). Controls follow the
 * contract names: "v.<i>.<groupId>" for unit i (0-based) and "v.<groupId>" for a choice shared by
 * every unit.
 *
 * Unit rows: [data-lp-variants] holds server-rendered rows and/or <template data-lp-variant-tpl>;
 * one row per unit of the selected bundle is shown ({n} → 1-based unit number, {i} → 0-based index,
 * in text and attributes). Rows are tagged data-lp-variant-row="<i>" (server-rendered rows are
 * adopted from their control names); rows beyond the quantity are hidden, never removed: choices
 * survive switching packs and nodes owned by the preview's React tree are left in place.
 *
 * pickers() adds the live parts: the chosen name beside swatch/photo group names ([data-lp-vval]),
 * the one-line summary ([data-lp-vsum]: "2 × ● Noir / M + ● Beige / L"), "same for all"
 * ([data-lp-vsame]), the photo swap ([data-lp-vslot] layers filled from <template data-lp-vimg>) and
 * the memory of the choices (per document across refresh(), sessionStorage across reloads).
 */
import type { Ctl, Ctx } from "./core";
import { $$, flag, setText, sget, sset } from "./core";

/** A unit's row ("Piece n" head + its groups), tagged with its 0-based index. */
export const ROW = "data-lp-variant-row";
const CTLS = "input[name^='v.'],select[name^='v.']";
const NAME = /^v\.(?:(\d{1,2})\.)?([A-Za-z0-9_-]{1,40})$/;
const KEY = /^(?:[A-Za-z0-9_-]{1,40}:[A-Za-z0-9_-]{1,40}|@)$/;

/** Unit index encoded in a control name; -1 for shared choices and foreign names. */
function unitOf(el: Element): number {
  const m = NAME.exec(el.getAttribute("name") || "");
  return m && m[1] !== undefined ? +m[1] : -1;
}

/** Live option controls (a template row's "v.{i}.x" copies never count). */
function controls(form: HTMLFormElement): Ctl[] {
  return $$<Ctl>(form, CTLS).filter((el) => NAME.test(el.name));
}

const checked = (el: Ctl) => (el.type === "radio" ? (el as HTMLInputElement).checked : !!el.value);

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
    if (i < 0 || ctl.closest("[" + ROW + "]") || ctl.closest("template")) continue;
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
    if (r.closest("template")) continue;
    const i = parseInt(r.getAttribute(ROW) || "", 10);
    const off = !(i >= 0 && i < qty);
    if (r.hidden !== off) r.hidden = off;
    if (i >= 0) have[i] = true;
    last = r;
  }
  if (tpl && tpl.content && tpl.content.firstElementChild)
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
  for (const el of controls(form)) {
    if (el.disabled || !checked(el)) continue;
    const m = NAME.exec(el.name)!;
    const value = el.value;
    if (!value || value.length > 40) continue;
    any = true;
    if (m[1] === undefined) shared[m[2]!] = value;
    else if (+m[1] < qty) (rows[+m[1]] = rows[+m[1]] || {})[m[2]!] = value;
  }
  if (!any) return [];
  const out: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(qty, 20); i++) out.push(Object.assign({}, shared, rows[i] || {}));
  return out;
}

/** Required option controls left empty in visible rows (a radio group is reported once, by its first enabled radio). */
export function missingVariants(form: HTMLFormElement): Ctl[] {
  const bad: Ctl[] = [];
  const seen: Record<string, boolean> = {};
  const all = controls(form);
  for (const el of all) {
    if (el.disabled || !el.required || seen[el.name] || el.closest("[" + ROW + "][hidden]")) continue;
    seen[el.name] = true;
    if (!all.some((r) => r.name === el.name && checked(r))) bad.push(el);
  }
  return bad;
}

/** The group's own message for an error code (written by the server into the markup), else `fallback`. */
export function variantMessage(el: Element, code: string, fallback: string): string {
  const g = el.closest("[data-msg]");
  return (g && g.getAttribute(code === "unavailable" ? "data-msg-gone" : "data-msg")) || fallback;
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export interface Choice {
  label: string;
  /** swatch color (#rrggbb) */
  sw?: string;
}
/** Identical units counted, in first-seen order: [{ n: 2, parts: [Noir, M] }, { n: 1, parts: [Beige, L] }]. */
export interface UnitGroup {
  n: number;
  parts: Choice[];
}

/** Same grouping as the server's variantText() ("2 × Noir/M + Beige/L"). */
export function unitGroups(units: Choice[][]): UnitGroup[] {
  const out: UnitGroup[] = [];
  const at: Record<string, UnitGroup> = Object.create(null);
  for (const parts of units) {
    if (!parts.length) continue;
    const k = parts.map((p) => p.label).join("\u0001");
    if (at[k]) at[k]!.n++;
    else out.push((at[k] = { n: 1, parts }));
  }
  return out;
}

/** Plain text of a summary: "2 × Noir / M + Beige / L". */
export function summaryText(groups: UnitGroup[]): string {
  return groups.map((g) => (g.n > 1 ? g.n + " × " : "") + g.parts.map((p) => p.label).join(" / ")).join(" + ");
}

/**
 * Draw a summary into `el`: each label isolated (Arabic and Latin names keep their order), a color
 * dot before a swatch's name, real spaces between the pieces (read out as words; the flex layout
 * spaces them visually).
 */
export function drawSummary(doc: Document, el: Element, groups: UnitGroup[]): void {
  const text = summaryText(groups);
  if (el.getAttribute("data-text") === text) return;
  el.setAttribute("data-text", text);
  const add = (to: Element, cls: string, t: string, tag?: string) => {
    if (to.lastChild) to.appendChild(doc.createTextNode(" "));
    const s = to.appendChild(doc.createElement(tag || "span"));
    s.className = "lp-vsum__" + cls;
    s.textContent = t;
    return s;
  };
  while (el.firstChild) el.removeChild(el.firstChild);
  groups.forEach((g, i) => {
    if (i) add(el, "plus", "+");
    const u = add(el, "u", "");
    if (g.n > 1) add(u, "n", g.n + " ×", "bdi").setAttribute("dir", "ltr");
    g.parts.forEach((p, j) => {
      if (j) add(u, "sep", "/");
      if (p.sw && /^#[0-9a-fA-F]{6}$/.test(p.sw)) (add(u, "dot", "") as HTMLElement).style.setProperty("--sw", p.sw);
      add(u, "l", p.label, "bdi");
    });
  });
}

/* ------------------------------------------------------------------ */
/* Live pickers                                                        */
/* ------------------------------------------------------------------ */

/** Choices per document: survive refresh() (preview re-renders) without touching storage. */
const memory = new WeakMap<Document, Record<string, string>>();

/** The summary of the current choices for `qty` units (labels from the runtime config). */
export function currentSummary(c: Ctx, form: HTMLFormElement, qty: number): UnitGroup[] {
  const all = controls(form);
  const units: Choice[][] = [];
  for (let u = 0; u < qty; u++) {
    const parts: Choice[] = [];
    for (const g of c.cfg.variants || []) {
      const name = g.perUnit ? "v." + u + "." + g.id : "v." + g.id;
      const el = all.find((x) => x.name === name && checked(x) && !x.disabled);
      const o = el && g.options.find((x) => x.id === el.value);
      if (o) parts.push({ label: o.label, sw: el!.getAttribute("data-sw") || undefined });
    }
    units.push(parts);
  }
  return unitGroups(units);
}

/**
 * Bind the live parts of the pickers; returns the function to call whenever the quantity changes.
 * `qty()` = units of the selected pack.
 */
export function pickers(c: Ctx, form: HTMLFormElement, qty: () => number): () => void {
  const { doc, win, cfg } = c;
  const box = form.querySelector("[data-lp-variants]");
  if (!box) return () => undefined;
  const storeKey = "lp-v:" + cfg.pageKey;
  let lastUnit = 0;
  let queued = false;

  const label = (el: Ctl): string => {
    const m = NAME.exec(el.name);
    const g = m && (cfg.variants || []).find((x) => x.id === m[2]);
    const o = g && g.options.find((x) => x.id === el.value);
    return o ? o.label : "";
  };

  // choices of the previous binding / page load come back first
  let saved = memory.get(doc);
  if (!saved && !c.preview) {
    try {
      saved = JSON.parse(sget(win, "sessionStorage", storeKey) || "null") || undefined;
    } catch {
      saved = undefined;
    }
  }
  if (saved && typeof saved === "object")
    for (const el of controls(form)) if (el.type === "radio" && !el.disabled && saved[el.name] === el.value) (el as HTMLInputElement).checked = true;

  /* photo swap -------------------------------------------------------- */
  const retire = (el: Element) => {
    el.removeAttribute("data-on");
    win.setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 480);
  };
  const clear = (slot: Element) => {
    slot.removeAttribute("data-key");
    slot.removeAttribute("data-on");
    slot.removeAttribute("data-alpha");
    for (const el of $$(slot, ":scope > *")) retire(el);
  };
  const show = (slot: Element, key: string) => {
    if (slot.getAttribute("data-key") === key) return;
    const tpl = KEY.test(key) ? (form.querySelector('template[data-lp-vimg="' + key + '"]') as HTMLTemplateElement | null) : null;
    const src: ParentNode | null = tpl ? (tpl.content && tpl.content.firstElementChild ? tpl.content : tpl) : null;
    const part = src && src.querySelector('[data-slot="' + slot.getAttribute("data-lp-vslot") + '"]');
    const pic = part && part.firstElementChild;
    if (!pic) {
      clear(slot);
      return;
    }
    slot.setAttribute("data-key", key);
    const node = doc.importNode(pic, true) as HTMLElement;
    const img = node.querySelector("img");
    if (img) img.loading = "eager";
    slot.appendChild(node);
    let done = false;
    const on = () => {
      if (done || node.parentNode !== slot) return;
      done = true;
      for (const el of $$(slot, ":scope > *")) if (el !== node && el.hasAttribute("data-on")) retire(el);
      win.requestAnimationFrame(() => node.setAttribute("data-on", ""));
      slot.setAttribute("data-on", "");
      flag(slot, "data-alpha", node.classList.contains("lp-pic--alpha"));
    };
    if (!img || img.complete) on();
    else {
      img.addEventListener("load", on, { once: true });
      img.addEventListener("error", on, { once: true });
      win.setTimeout(on, 900);
    }
    // a slower photo chosen before this one finished must not land on top of it
    for (const el of $$(slot, ":scope > *")) if (el !== node && !el.hasAttribute("data-on")) retire(el);
  };

  const photos = (n: number) => {
    const slots = $$(doc, "[data-lp-vslot]");
    if (!slots.length) return;
    const all = controls(form);
    const tagged = all.find((el) => el.hasAttribute("data-vimg"));
    if (!tagged) return;
    const gid = NAME.exec(tagged.name)![2]!;
    const keyOf = (u: number): string | null => {
      const el = all.find((x) => checked(x) && !x.disabled && (x.name === "v." + u + "." + gid || x.name === "v." + gid));
      return el ? el.getAttribute("data-vimg") : null;
    };
    for (const slot of slots) {
      const d = parseInt(slot.getAttribute("data-unit") || "", 10);
      const u = d >= 0 ? d % n : lastUnit < n ? lastUnit : 0;
      const key = keyOf(u) || keyOf(0) || slot.getAttribute("data-base") || "";
      if (key === slot.getAttribute("data-base")) clear(slot);
      else show(slot, key);
    }
  };

  /* everything that follows the choices ------------------------------- */
  const update = () => {
    queued = false;
    const n = Math.max(1, qty());
    const mem: Record<string, string> = {};
    for (const el of controls(form)) if (checked(el) && !el.disabled) mem[el.name] = el.value;
    memory.set(doc, mem);
    if (!c.preview) sset(win, "sessionStorage", storeKey, JSON.stringify(mem));
    for (const val of $$(box, "[data-lp-vval]")) {
      const g = val.closest("fieldset");
      const el = g ? $$<Ctl>(g, CTLS).find((x) => checked(x) && !x.disabled) : undefined;
      setText(val, el ? label(el) : "");
    }
    const sum = currentSummary(c, form, n);
    for (const el of $$(doc, "[data-lp-vsum]")) drawSummary(doc, el, sum);
    try {
      photos(n);
    } catch {
      /* a broken template never blocks the form */
    }
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(update);
  };

  c.on(form, "change", (e) => {
    const el = e.target as Ctl;
    if (!el || !NAME.test(el.name || "")) return;
    if (el.hasAttribute("data-vimg")) lastUnit = Math.max(0, unitOf(el));
    queue();
  });
  // a choice the form cleared after a server refusal
  c.on(form, "lp-options", queue);

  // "same for all": unit 1's choices copied to every other visible unit
  c.on(box, "click", (e) => {
    const btn = (e.target as Element).closest ? (e.target as Element).closest("[data-lp-vsame]") : null;
    if (!btn) return;
    e.preventDefault();
    const n = qty();
    const all = controls(form);
    for (const src of all) {
      const m = NAME.exec(src.name)!;
      if (m[1] !== "0" || !checked(src) || src.disabled) continue;
      for (let u = 1; u < n; u++) {
        const t = all.find((x) => x.name === "v." + u + "." + m[2] && x.value === src.value && !x.disabled);
        if (!t || checked(t)) continue;
        (t as HTMLInputElement).checked = true;
        // through "change", so the form clears the group's error and everything else follows
        t.dispatchEvent(new (win as Window & typeof globalThis).Event("change", { bubbles: true }));
      }
    }
    btn.setAttribute("data-done", "");
    win.setTimeout(() => btn.removeAttribute("data-done"), 1600);
  });

  update();
  return update;
}
