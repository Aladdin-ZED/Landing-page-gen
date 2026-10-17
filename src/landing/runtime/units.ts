/**
 * Units of the selected offer (docs/OFFERS.md §F): one code path for every page, single-item ones
 * included. Expands the offer's units from the config, builds them from templates, item choosers,
 * line rules (lock / allow / preset), initial values, prefill ("= pièce 1"), memory (per document
 * and sessionStorage "lp-u:<pageKey>"), collapse, shared groups, extras, the bump item's body, the
 * live summary, the photo swap, the selection (st.sel) and the client checks the form submits on.
 * Matrix pickers, typed fields and steps / box navigation are optional chunks (kits, §F.9).
 *
 * MARKUP (renderer ↔ runtime; §F.6, completed here — every attribute is optional unless said)
 *   [data-lp-units]                 container; data-fill, data-units (set by the runtime). Microcopy:
 *                                   data-t-unit "Pièce {n}" · data-t-item "{item} · {j}" · data-t-choice
 *                                   "Au choix" · data-t-aria "{head}, pièce {n} sur {units}" · data-t-lock
 *                                   "{name} : {value}" · data-t-tag "= pièce {n}" · data-t-shared "Pour vos
 *                                   {n} {item}". data-offer=<id>: a container of that offer only (inline
 *                                   fill inside each card); without it: the shared container, whose
 *                                   server-rendered units are the default offer's.
 *   [data-lp-unit=<k>]              a unit; data-item, data-line (renderer); data-free, data-prefilled,
 *                                   data-collapsed, data-done, data-bad, data-active (runtime). Inside:
 *                                   [data-lp-unit-head], [data-lp-unit-free] (Offert chip),
 *                                   [data-lp-unit-tag] ("= pièce {n}"), [data-lp-unit-sum] (collapsed
 *                                   line), button[data-lp-unit-edit] (Modifier), [data-lp-unit-main]
 *                                   (where the chooser and bodies go; else the unit itself).
 *   template[data-lp-unit-tpl]      the unit shell · template[data-lp-item-tpl=<itemId>]: one root
 *                                   [data-lp-item-body=<itemId>] with the item's per-unit groups named
 *                                   u.{k}.<gid> · template[data-lp-pick-tpl=<offerId>.<line>]: one root
 *                                   [data-lp-item-pick] with radios u.{k}.@item. {k} / {n} = index / index + 1.
 *   [data-field=<control name>]     each group (u.<k>.<gid>, u.<k>.@item, s.<item>.<gid>, x.<gid>,
 *                                   b.<gid>) with its [data-error] and messages data-msg / -gone / -long /
 *                                   -dup / -bad. Choice options: radios (each in a <label>) or a <select>,
 *                                   values = option ids; data-sw (swatch #rrggbb), data-vimg (photo).
 *   [data-lp-lock=<ruleKey>]        static chip of a locked value (added before the group when absent).
 *   [data-lp-shared=<itemId>]       the item's shared groups (s.<itemId>.<gid>); [data-lp-shared-head].
 *   [data-lp-extra=<gid>]           page extras (x.<gid>), shown when in scope of the offer.
 *   [data-lp-bump]                  the bump block (hidden with offers it is not offered with):
 *                                   input[name=bump]; [data-lp-bump-body] the bump item's groups (b.<gid>).
 *   [data-lp-contents=<offerId>]    outside the cards: "Contenu du pack" of an offer with nothing to fill.
 *   [data-lp-vsum]                  the live summary (data-free = the "Offert" word).
 *   [data-lp-vslot] + template[data-lp-vimg=<key>]   photo swap (key: item · item:gid:option · item:gid:cell).
 */
import type { RuntimeGroup, RuntimeItem, RuntimeLineRule } from "./config";
import type { Ctl, Ctx } from "./core";
import { $$, checked, closest, fill, flag, getForm, hide, sdel, setText, sjson, sset } from "./core";
import type { Combo, MatrixGroup, Offer, Sel, Slot, UnitSel } from "./money";
import { bumpOn, cellKey, emptySel, inScope, itemOf, offerOf, optOf, parseKey, resolveCell } from "./money";

export type Rules = Record<string, RuntimeLineRule>;
type Group = RuntimeGroup;
type FieldGroup = Extract<Group, { kind: "field" }>;

/** A client check: "" when fine, else the server's code. */
export type Code = "" | "required" | "invalid" | "unavailable" | "too_long" | "duplicate";

/** What the optional chunks get from the core. */
export interface Host {
  c: Ctx;
  ctl(root: ParentNode, name: string): Ctl[];
  /** show (name set) or hide the lock chip `key` placed before `anchor` */
  chip(anchor: Element, key: string, name: string | null, value?: string, sw?: string | null): void;
  /** container microcopy (data-t-<key>) */
  t(key: string, fb: string): string;
  /** the rendered units of the offer, in order */
  list(): UnitInfo[];
}

export interface UnitInfo {
  k: number;
  el: HTMLElement;
  item: string;
  /** visible head ("Pièce 2", "Nuit") */
  head: string;
  /** photo key of the unit's current visual (template[data-lp-vimg]), "" when none */
  pic: string;
  /** swatch of its first value */
  sw: string;
  done: boolean;
  bad: boolean;
}

/** units-matrix chunk */
export interface MatrixKit {
  /** initial value (§F.4): presets, swatch dims → first available, a dim with one possible value → it */
  init(g: MatrixGroup, rules: Rules | undefined, swatch: (dimId: string) => boolean): string;
  /** a control changed: the new value (+ a notice when another dim switched or was cleared) */
  pick(g: MatrixGroup, rules: Rules | undefined, prev: string, name: string, base: string, value: string, msg: (k: string) => string): { v: string; note?: string };
  /** draw the group (locks, allowed values, states, checked controls) */
  sync(h: Host, root: Element, g: MatrixGroup, base: string, rules: Rules | undefined, value: string, off: boolean): void;
}
/** units-fields chunk */
export interface FieldsKit {
  clean(v: string): string;
  check(g: FieldGroup, v: string): Code;
  sync(root: Element, name: string, g: FieldGroup, value: string, off: boolean): void;
}
/** fill-steps-box chunk */
export interface StepsKit {
  sync(box: Element, fill: string): void;
  open(k: number): void;
}

export interface Problem {
  el: Ctl;
  key: string;
  code: Code;
}

export interface SumPart {
  n: number;
  /** item name (multi-item pages) */
  item?: string;
  parts: { label: string; sw?: string }[];
  fields?: { name: string; value: string }[];
  free?: true;
  /** pixel content id; unit indexes */
  cid: string;
  ks: number[];
}

/** The units module of a document: what the form needs. */
export interface UnitsApi {
  problems(): Problem[];
  /** a server error on a control key; returns the control to focus */
  mark(key: string, code: string): Ctl | null;
  /** bring the unit holding `el` to the shopper (steps, box, collapsed) */
  reveal(el: Element): void;
  /** forget the stored selection (after an order) */
  forget(): void;
  /** the selection as summary groups (thank-you, pixels) */
  parts(): SumPart[];
}

const apis = new WeakMap<Document, UnitsApi>();
export const unitsApi = (doc: Document) => apis.get(doc) || null;

interface View {
  k: number;
  el: HTMLElement;
  main: Element;
  pick: Element | null;
  bodies: Record<string, Element>;
}

interface Mem {
  ver: string;
  o: string;
  /** values by unit signature "<item>#<ordinal>" (shared groups "<item>#s", bump "<item>#b") */
  u: Record<string, Record<string, string>>;
  /** items chosen in choice units: "<offerId>.<k>" → item */
  c: Record<string, string>;
  x: Record<string, string>;
  b: boolean;
  /** signatures the shopper edited (never prefilled again) */
  t: Record<string, 1>;
}

const memory = new WeakMap<Document, Mem>();
const NAME = /^(u\.(\d{1,2})|s\.[a-z0-9][a-z0-9-]{1,23}|x|b)\.(@item|[A-Za-z0-9_-]{2,40})(?:\.[A-Za-z0-9_-]{2,40})?$/;
const KEY = /^[a-z0-9][a-z0-9-]{1,23}(?::[A-Za-z0-9_-]{2,40}:[A-Za-z0-9_=|-]{2,250})?$/;
const SAFE = /^[\w.@=|-]+$/;
const own = Object.prototype.hasOwnProperty;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const allows = (r: RuntimeLineRule | undefined, id: string) => !r || (r.lock ? r.lock === id : r.allow ? r.allow.indexOf(id) >= 0 : true);
const locked = (rules: Rules | undefined, key: string) => !!(rules && rules[key] && rules[key]!.lock);

/** A unit has something to choose: an item, or a per-unit group a rule does not lock (§F.2). */
export function fillable(cfg: Ctx["cfg"], slot: Slot): boolean {
  if (!slot.item) return true;
  const it = itemOf(cfg, slot.item);
  return !!it && it.groups.some((g) => g.perUnit && (g.kind === "field" || (g.kind === "matrix" ? g.dims.some((d) => !locked(slot.rules, g.id + "." + d.id)) : !locked(slot.rules, g.id))));
}

export function units(c: Ctx): void {
  const { cfg, doc, win, st } = c;
  const form = getForm(c);
  if (!form || !cfg.bundles.length) return;
  const mk = c.fx["units-matrix"] ? (c.fx["units-matrix"] as unknown as () => MatrixKit)() : null;
  const fk = c.fx["units-fields"] ? (c.fx["units-fields"] as unknown as () => FieldsKit)() : null;
  const clean = (v: string) => (fk ? fk.clean(v) : String(v || "").replace(/\s+/g, " ").trim());
  const storeKey = "lp-u:" + cfg.pageKey;
  const multi = cfg.items.length > 1;
  const steps = cfg.fill === "steps" || cfg.fill === "box";

  /* ---------------- memory ---------------- */
  let m = memory.get(doc) as Mem;
  if (!m) {
    m = { ver: cfg.ver, o: "", u: {}, c: {}, x: {}, b: false, t: {} };
    const saved = c.preview ? null : sjson<Partial<Mem>>(win, "sessionStorage", storeKey);
    if (saved && typeof saved === "object") readMem(saved, m);
    memory.set(doc, m);
  }
  let gone = false;
  const save = () => {
    if (c.preview || gone) return;
    let s = JSON.stringify(m);
    if (s.length > 4096) {
      const keep: Mem["u"] = {};
      for (const sig of sigs()) if (own.call(m.u, sig)) keep[sig] = m.u[sig]!;
      s = JSON.stringify({ ...m, u: keep, t: {} });
    }
    if (s.length <= 4096) sset(win, "sessionStorage", storeKey, s);
  };

  /** Stored memory against the current config: unknown items, groups, offers and keys dropped. */
  function readMem(s: Partial<Mem>, out: Mem): void {
    const ok = (v: unknown): v is string => typeof v === "string" && v.length <= 250;
    for (const sig in s.u || {}) {
      const it = itemOf(cfg, sig.split("#")[0]);
      const vals = s.u![sig];
      if (!it || !/^[a-z0-9-]+#(?:\d{1,2}|s|b)$/.test(sig) || !vals || typeof vals !== "object") continue;
      const keep: Record<string, string> = {};
      for (const g of it.groups) if (ok(vals[g.id])) keep[g.id] = vals[g.id]!;
      out.u[sig] = keep;
    }
    for (const key in s.c || {}) {
      const at = key.lastIndexOf(".");
      const o = offerOf(cfg, key.slice(0, at));
      const slot = o && o.units[+key.slice(at + 1)];
      const v = s.c![key];
      if (slot && slot.choices && ok(v) && slot.choices.indexOf(v) >= 0) out.c[key] = v;
    }
    for (const x of cfg.extras || []) if (s.x && ok(s.x[x.id])) out.x[x.id] = s.x[x.id]!;
    for (const sig in s.t || {}) if (out.u[sig]) out.t[sig] = 1;
    out.o = typeof s.o === "string" && offerOf(cfg, s.o) ? s.o : "";
    out.b = s.b === true;
  }

  /* ---------------- containers, templates ---------------- */
  const boxes = $$(form, "[data-lp-units]");
  const boxOf = (id: string) => boxes.find((b) => b.getAttribute("data-offer") === id) || boxes.find((b) => !b.hasAttribute("data-offer")) || null;
  const t = (key: string, fb: string) => {
    for (const b of boxes) {
      const v = b.getAttribute("data-h-" + key) || b.getAttribute("data-t-" + key);
      if (v) return v;
    }
    return fb;
  };
  const tpl = (sel: string): HTMLTemplateElement | null => form.querySelector<HTMLTemplateElement>("template" + sel);
  const make = (tp: HTMLTemplateElement | null, k: number): HTMLElement | null => {
    // React (admin preview) appends a <template>'s children to the element itself, not to .content
    const src = tp && (tp.content && tp.content.firstElementChild ? tp.content : tp);
    if (!src || !src.firstElementChild) return null;
    const root = doc.importNode(src.firstElementChild, true) as HTMLElement;
    const v = { k, n: k + 1 };
    for (const el of [root].concat($$(root, "*")))
      for (const a of Array.prototype.slice.call(el.attributes) as Attr[]) if (a.value.indexOf("{") >= 0) el.setAttribute(a.name, fill(a.value, v));
    const w = doc.createTreeWalker(root, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue && n.nodeValue.indexOf("{") >= 0) n.nodeValue = fill(n.nodeValue, v);
    return root;
  };
  const ctl = (root: ParentNode | null, name: string): Ctl[] => (root && SAFE.test(name) ? $$<Ctl>(root, '[name="' + name + '"]') : []);
  const fieldOf = (root: ParentNode, name: string): HTMLElement | null => (SAFE.test(name) ? root.querySelector<HTMLElement>('[data-field="' + name + '"]') : null);
  /** where a unit's chooser and bodies go */
  const mainOf = (el: Element) => el.querySelector("[data-lp-unit-body]") || el.querySelector("[data-lp-unit-main]") || el;
  /** collapsed (inline / rows): the one-line summary + "Modifier" instead of the body */
  const collapse = (u: Element, on: boolean) => {
    flag(u, "data-collapsed", on);
    for (const b of $$(u, "[data-lp-unit-edit]")) hide(b, !on);
  };
  /** nodes the runtime added (removed when the binding ends: the preview re-binds on every render) */
  const made: Element[] = [];
  const off = (root: Element) => {
    for (const el of $$<Ctl>(root, "input,select,textarea")) el.disabled = true;
  };
  /** a hidden copy (another offer's units, another item's body) parks its ids and label targets, so
   *  label[for] / aria-* of the shown copy (same names, same ids) never resolve to a hidden control */
  const park = (root: Element, on: boolean) => {
    if (root.hasAttribute("data-lp-parked") === on) return;
    if (on) root.setAttribute("data-lp-parked", "");
    for (const el of [root].concat($$(root, on ? "[id],[for]" : "[data-lp-id],[data-lp-for]")))
      if (on || el.closest("[data-lp-parked]") === root)
        for (const a of ["id", "for"]) {
          const v = el.getAttribute(on ? a : "data-lp-" + a);
          if (v === null) continue;
          el.removeAttribute(on ? a : "data-lp-" + a);
          el.setAttribute(on ? "data-lp-" + a : a, v);
        }
    if (!on) root.removeAttribute("data-lp-parked");
  };

  /* ---------------- unit views per offer ---------------- */
  const views: Record<string, (View | null)[]> = {};
  const offer = (): Offer => offerOf(cfg, st.bundleId) || cfg.bundles[0]!;

  const viewsOf = (o: Offer): (View | null)[] => {
    if (views[o.id]) return views[o.id]!;
    const list: (View | null)[] = (views[o.id] = []);
    const box = boxOf(o.id);
    if (!box) return list;
    // server-rendered units: the default offer's (or this offer's own container), checked against the slots
    if (box.getAttribute("data-offer") === o.id || (!box.hasAttribute("data-offer") && o.id === cfg.defaultBundleId))
      for (const el of $$(box, "[data-lp-unit]")) {
        if (el.closest("template") || el.hasAttribute("data-lp-of")) continue;
        const k = parseInt(el.getAttribute("data-lp-unit") || "", 10);
        const s = o.units[k];
        const fits = s && (s.item ? (el.getAttribute("data-item") || "") === s.item : !!el.querySelector("[data-lp-item-pick]"));
        if (!s || !fits || list[k] || !fillable(cfg, s) || (el.hasAttribute("data-line") && el.getAttribute("data-line") !== String(s.line))) {
          hide(el, true);
          off(el);
          park(el, true);
          continue;
        }
        const bodies: Record<string, Element> = {};
        for (const b of $$(el, "[data-lp-item-body]")) bodies[b.getAttribute("data-lp-item-body") || ""] = b;
        list[k] = { k, el, main: mainOf(el), pick: el.querySelector("[data-lp-item-pick]"), bodies };
      }
    let last: Element | null = null;
    o.units.forEach((s, k) => {
      if (!fillable(cfg, s)) return void (list[k] = null);
      let v = list[k];
      if (!v) {
        const el = make(tpl("[data-lp-unit-tpl]"), k);
        if (!el) return;
        el.setAttribute("data-lp-unit", String(k));
        el.setAttribute("data-line", String(s.line));
        el.setAttribute("data-lp-of", o.id);
        hide(el, true);
        made.push(el);
        const after = last || $$(box, "[data-lp-unit]").filter((x) => !x.closest("template")).pop();
        if (after && after.parentNode) after.parentNode.insertBefore(el, after.nextSibling);
        else (box.querySelector("[data-lp-unit-list]") || box).appendChild(el);
        const main = mainOf(el);
        const pk = s.item ? null : make(tpl('[data-lp-pick-tpl="' + o.id + "." + s.line + '"]'), k);
        if (pk) main.appendChild(pk);
        v = list[k] = { k, el, main, pick: pk, bodies: {} };
      }
      last = v.el;
    });
    return list;
  };

  /** the body of `item` inside a unit (cloned from the item template on first use) */
  const bodyOf = (v: View, item: string): Element | null => {
    if (!v.bodies[item]) {
      const b = make(tpl('[data-lp-item-tpl="' + item + '"]'), v.k);
      if (!b) return null;
      v.main.appendChild(b);
      made.push(b);
      v.bodies[item] = b;
    }
    return v.bodies[item]!;
  };

  /* ---------------- items and signatures ---------------- */
  const itemAt = (o: Offer, k: number): string => {
    const s = o.units[k];
    if (!s) return "";
    if (s.item) return s.item;
    const av = s.available || s.choices || [];
    const v = m.c[o.id + "." + k];
    return v && av.indexOf(v) >= 0 ? v : av.length === 1 ? av[0]! : "";
  };
  const sigOf = (o: Offer, k: number): string => {
    const item = itemAt(o, k);
    if (!item) return "";
    let j = 0;
    for (let i = 0; i < k; i++) if (itemAt(o, i) === item) j++;
    return item + "#" + j;
  };
  const sigs = (): string[] => {
    const o = offer();
    const out: string[] = [];
    o.units.forEach((_, k) => {
      const s = sigOf(o, k);
      if (s) out.push(s, s.split("#")[0] + "#s");
    });
    if (cfg.bump && cfg.bump.item) out.push(cfg.bump.item + "#b");
    return out;
  };

  /* ---------------- values ---------------- */
  /** A stored choice / matrix value made valid for a line: allowed, orderable, locks applied ("" when not). */
  const valid = (g: Group, rules: Rules | undefined, v: string): string => {
    if (g.kind === "field") return v || "";
    if (g.kind === "matrix") {
      const combo: Combo = (v && parseKey(v)) || {};
      for (const d of g.dims) {
        const r = rules && rules[g.id + "." + d.id];
        if (r && r.lock) combo[d.id] = r.lock;
        else if (combo[d.id] && (!optOf(d.values, combo[d.id]) || !allows(r, combo[d.id]!))) delete combo[d.id];
      }
      for (const k in combo) if (!g.dims.some((d) => d.id === k)) delete combo[k];
      if (Object.keys(combo).length === g.dims.length) {
        const cell = resolveCell(g, combo);
        if (!cell || cell.s) return "";
      }
      return cellKey(combo);
    }
    const r = rules && rules[g.id];
    if (r && r.lock) return r.lock;
    const o = optOf(g.options, v);
    return o && !o.soldOut && allows(r, o.id) ? o.id : "";
  };
  /** complete and orderable */
  const done = (g: Group, v: string) => g.kind === "field" || (!!v && (g.kind !== "matrix" || !!resolveCell(g, parseKey(v) || {})));

  const swatchy = (root: ParentNode | null, name: string) => ctl(root, name).some((x) => x.hasAttribute("data-sw") || x.hasAttribute("data-vimg"));

  /** The initial value of a group (§F.4): preset, else the first available swatch / image, else the single available value. */
  const initial = (g: Group, rules: Rules | undefined, root: ParentNode | null, name: string): string => {
    if (g.kind === "field") return "";
    if (g.kind === "matrix") return mk ? mk.init(g, rules, (dim) => swatchy(root, name + "." + dim) || swatchy(root, name)) : "";
    const r = rules && rules[g.id];
    const av = g.options.filter((o) => !o.soldOut && allows(r, o.id));
    if (r && r.preset && av.some((o) => o.id === r.preset)) return r.preset;
    return av.length === 1 || (av.length && g.kind !== "text") ? av[0]!.id : "";
  };

  /** The values of a signature, missing / invalid ones replaced by the initial values. */
  const valuesOf = (sig: string, groups: readonly Group[], rules: Rules | undefined, root: ParentNode | null, prefix: string): Record<string, string> => {
    const vals = (m.u[sig] = m.u[sig] || {});
    for (const g of groups) {
      // "" = cleared on purpose (a refusal, a matrix conflict): the shopper picks again, never a guess
      if (own.call(vals, g.id) && (vals[g.id] === "" || g.kind === "field" || valid(g, rules, vals[g.id]!))) continue;
      const init = initial(g, rules, root, prefix + g.id);
      if (init) vals[g.id] = init;
      else delete vals[g.id];
    }
    return vals;
  };

  /** The selection now: locks applied, shared values copied into every unit of their item (§G.1). */
  const read = (): Sel => {
    const o = offer();
    const sel: Sel = { offerId: o.id, units: [], extras: {}, bump: st.bump && bumpOn(cfg, o.id) };
    const unit = (it: RuntimeItem, vals: Record<string, string>, sh: Record<string, string>, rules: Rules | undefined, all: boolean): UnitSel => {
      const u: UnitSel = { item: it.id, options: {}, fields: {} };
      for (const g of it.groups) {
        const per = g.perUnit || all;
        const raw = (per ? vals : sh)[g.id] || "";
        if (g.kind === "field") {
          const f = clean(raw);
          if (f) u.fields[g.id] = f;
        } else {
          const v = valid(g, per && !all ? rules : undefined, raw);
          if (v) u.options[g.id] = v;
        }
      }
      return u;
    };
    o.units.forEach((s, k) => {
      const it = itemOf(cfg, itemAt(o, k));
      sel.units.push(it ? unit(it, m.u[sigOf(o, k)] || {}, m.u[it.id + "#s"] || {}, s.rules, false) : { item: "", options: {}, fields: {} });
    });
    for (const x of cfg.extras || []) {
      if (!inScope(x.scope, o.id)) continue;
      const raw = m.x[x.id] || "";
      const v = x.kind === "field" ? clean(raw) : valid(x, undefined, raw);
      if (v) sel.extras[x.id] = v;
    }
    const bi = sel.bump && cfg.bump && cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
    if (bi) sel.bumpUnit = unit(bi, m.u[bi.id + "#b"] || {}, {}, undefined, true);
    return sel;
  };
  st.sel = read;

  /* ---------------- drawing ---------------- */
  const chip = (anchor: Element, key: string, name: string | null, value?: string, sw?: string | null) => {
    const root = anchor.parentNode as Element | null;
    if (!root) return;
    let el = $$(root, ":scope > [data-lp-lock]").find((x) => x.getAttribute("data-lp-lock") === key) || null;
    if (!name) {
      if (el) hide(el, true);
      return;
    }
    if (!el) {
      el = doc.createElement("div");
      el.className = "lp-vg lp-vg--lock";
      el.setAttribute("data-lp-lock", key);
      root.insertBefore(el, anchor);
    }
    hide(el, false);
    if (el.getAttribute("data-text") === name + "|" + value + "|" + (sw || "")) return;
    el.setAttribute("data-text", name + "|" + value + "|" + (sw || ""));
    // <p class="lp-vg__head"><span class="lp-vg__name">Couleur</span></p><span class="lp-lock">● <span class="lp-lock__t">Noir</span> 🔒</span>
    const add = (to: Element, tag: string, cls: string, text?: string) => {
      const x = to.appendChild(doc.createElement(tag));
      x.className = cls;
      if (text) x.textContent = text;
      return x as HTMLElement;
    };
    while (el.firstChild) el.removeChild(el.firstChild);
    add(add(el, "p", "lp-vg__head"), "span", "lp-vg__name", name);
    const chipEl = add(el, "span", "lp-lock");
    if (sw && HEX.test(sw)) {
      const dot = add(chipEl, "span", "lp-lock__sw");
      dot.setAttribute("aria-hidden", "true");
      dot.style.setProperty("--sw", sw);
    }
    add(chipEl, "span", "lp-lock__t", value || "");
    chipEl.insertAdjacentHTML("beforeend", '<svg class="lp-lock__ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 7V5.2a3 3 0 0 1 6 0V7M4.2 7h7.6c.4 0 .7.3.7.7v5c0 .4-.3.8-.7.8H4.2a.7.7 0 0 1-.7-.8v-5c0-.4.3-.7.7-.7z"/></svg>');
  };

  const host: Host = {
    c,
    ctl,
    chip,
    t,
    list: () => {
      const o = offer();
      const sel = read();
      const sum = partsOf(o, sel);
      const out: UnitInfo[] = [];
      for (const v of viewsOf(o))
        if (v) {
          const item = itemAt(o, v.k);
          const p = sum.find((x) => x.ks.indexOf(v.k) >= 0);
          const sw = p && p.parts.find((x) => x.sw);
          const pic = picKey(sel, v.k, "");
          out.push({ k: v.k, el: v.el, item, head: v.el.getAttribute("data-head") || "", pic: pic && imgTpl(pic) ? pic : "", sw: (sw && sw.sw) || "", done: v.el.hasAttribute("data-done"), bad: v.el.hasAttribute("data-bad") });
        }
      return out;
    },
  };
  const sk = c.fx["fill-steps-box"] ? (c.fx["fill-steps-box"] as unknown as (h: Host) => StepsKit)(host) : null;

  /** Draw one group from its value (choice: here; matrix / field: their chunk). */
  const drawGroup = (root: Element, g: Group, name: string, rules: Rules | undefined, value: string, isOff: boolean) => {
    if (g.kind === "matrix") return void (mk && mk.sync(host, root, g, name, rules, value, isOff));
    if (g.kind === "field") {
      if (fk) fk.sync(root, name, g, value, isOff);
      else
        for (const el of ctl(root, name)) {
          el.disabled = isOff;
          if (el.value !== value) el.value = value;
        }
      return;
    }
    const r = rules && rules[g.id];
    const lock = r && r.lock ? optOf(g.options, r.lock) : undefined;
    const els = ctl(root, name);
    const fs = fieldOf(root, name) || (els[0] && els[0].closest("fieldset"));
    if (fs) {
      hide(fs, !!lock);
      const src = lock && els.find((x) => x.value === lock.id);
      chip(fs, g.id, lock ? g.name : null, lock ? lock.label : "", src ? src.getAttribute("data-sw") : null);
    }
    const vv = fs && fs.querySelector("legend [data-lp-vval]");
    if (vv) setText(vv, (optOf(g.options, value) || { label: "" }).label);
    for (const el of els) {
      if (el.tagName === "SELECT") {
        const s = el as HTMLSelectElement;
        for (const op of Array.prototype.slice.call(s.options) as HTMLOptionElement[]) {
          if (!op.value) continue;
          const o = optOf(g.options, op.value);
          op.hidden = !allows(r, op.value);
          op.disabled = op.hidden || !o || o.soldOut;
        }
        s.disabled = isOff || !!lock;
        if (s.value !== value) s.value = value;
      } else {
        const o = optOf(g.options, el.value);
        const ok = allows(r, el.value);
        const wrap = el.closest("label") || el;
        hide(wrap, !ok);
        el.disabled = isOff || !!lock || !ok || !o || o.soldOut;
        if (o && o.soldOut) flag(wrap, "data-soldout", true);
        (el as HTMLInputElement).checked = !!value && el.value === value;
      }
    }
  };

  /* ---------------- live summary ---------------- */
  /** swatch of a value: a control whose name ends with ".<path>" holding that value (data-sw) */
  const swOf = (root: ParentNode | null, path: string, value: string): string | undefined => {
    if (!root) return undefined;
    for (const el of $$<HTMLInputElement | HTMLOptionElement>(root, "[data-sw]")) {
      const name = el.tagName === "OPTION" ? ((el.parentElement || el.parentNode) as HTMLSelectElement).name || "" : (el as HTMLInputElement).name || "";
      const sw = el.getAttribute("data-sw") || "";
      if (el.value === value && name.slice(-path.length - 1) === "." + path && HEX.test(sw)) return sw;
    }
    return undefined;
  };
  const scopeOf = (it: RuntimeItem, v: View | null): ParentNode => {
    const t2 = tpl('[data-lp-item-tpl="' + it.id + '"]');
    return (v && v.bodies[it.id]) || form.querySelector('[data-lp-item-body="' + it.id + '"]') || (t2 && (t2.content && t2.content.firstElementChild ? t2.content : t2)) || form;
  };

  /** The selection as summary groups (identical units counted, first-seen order). */
  const partsOf = (o: Offer, sel: Sel): SumPart[] => {
    const out: (SumPart & { key: string })[] = [];
    const vs = viewsOf(o);
    o.units.forEach((s, k) => {
      const u = sel.units[k]!;
      const it = itemOf(cfg, u.item);
      const ps: SumPart["parts"] = [];
      const fs: NonNullable<SumPart["fields"]> = [];
      if (it)
        for (const g of it.groups) {
          const root = g.perUnit ? scopeOf(it, vs[k] || null) : form.querySelector('[data-lp-shared="' + it.id + '"]');
          if (g.kind === "field") {
            if (u.fields[g.id]) fs.push({ name: g.name, value: u.fields[g.id]! });
          } else if (g.kind === "matrix") {
            const combo = parseKey(u.options[g.id] || "") || {};
            for (const d of g.dims) {
              const val = optOf(d.values, combo[d.id]);
              if (val) ps.push({ label: val.label, sw: swOf(root, g.id + "." + d.id, val.id) || swOf(root, g.id, u.options[g.id]!) });
            }
          } else {
            const op = optOf(g.options, u.options[g.id]);
            if (op) ps.push({ label: op.label, sw: swOf(root, g.id, op.id) });
          }
        }
      const name = it && multi ? it.name : undefined;
      if (!ps.length && !fs.length && !name && !s.free) return;
      const key = JSON.stringify([!!s.free, u.item, ps, fs]);
      const g = out.find((x) => x.key === key);
      if (g) {
        g.n++;
        g.ks.push(k);
        return;
      }
      const p: SumPart & { key: string } = { key, n: 1, parts: ps, cid: it ? it.contentId : cfg.product.contentId, ks: [k] };
      if (name) p.item = name;
      if (fs.length) p.fields = fs;
      if (s.free) p.free = true;
      out.push(p);
    });
    return out.map((p) => {
      const { key, ...rest } = p;
      void key;
      return rest;
    });
  };

  /* ---------------- photo swap ---------------- */
  let lastUnit = 0;
  const retire = (el: Element) => {
    el.removeAttribute("data-on");
    win.setTimeout(() => el.parentNode && el.parentNode.removeChild(el), 480);
  };
  const clear = (slot: Element) => {
    slot.removeAttribute("data-key");
    slot.removeAttribute("data-on");
    slot.removeAttribute("data-alpha");
    for (const el of $$(slot, ":scope > *")) retire(el);
  };
  const imgTpl = (key: string) => (KEY.test(key) ? tpl('[data-lp-vimg="' + key + '"]') : null);
  const showPic = (slot: Element, key: string) => {
    if (slot.getAttribute("data-key") === key) return;
    const tp = imgTpl(key);
    const src: ParentNode | null = tp ? (tp.content && tp.content.firstElementChild ? tp.content : tp) : null;
    const part = src && (src.querySelector('[data-slot="' + slot.getAttribute("data-lp-vslot") + '"]') || src.querySelector("[data-slot]"));
    const pic = part && part.firstElementChild;
    if (!pic) return clear(slot);
    slot.setAttribute("data-key", key);
    const node = doc.importNode(pic, true) as HTMLElement;
    const img = node.querySelector("img");
    if (img) img.loading = "eager";
    slot.appendChild(node);
    let ready = false;
    const on = () => {
      if (ready || node.parentNode !== slot) return;
      ready = true;
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
  /** the most specific photo of unit k: option / cell photo, else the chosen item's own photo */
  const picKey = (sel: Sel, k: number, slotItem: string): string => {
    const u = sel.units[k];
    const it = u && itemOf(cfg, u.item);
    if (!it) return "";
    for (const g of it.groups) {
      const v = u!.options[g.id];
      if (!v) continue;
      const keys = [it.id + ":" + g.id + ":" + v];
      if (g.kind === "matrix") for (const p of v.split("|")) keys.push(it.id + ":" + g.id + ":" + p);
      for (const key of keys) if (imgTpl(key)) return key;
    }
    return it.id !== slotItem ? it.id : "";
  };
  const photos = (o: Offer, sel: Sel) => {
    for (const slot of $$(doc, "[data-lp-vslot]")) {
      const card = slot.closest("[data-bundle-card]");
      if (card && card.getAttribute("data-bundle-card") !== o.id) {
        clear(slot);
        continue;
      }
      const d = parseInt(slot.getAttribute("data-unit") || "", 10);
      const k = d >= 0 ? d : lastUnit < o.units.length ? lastUnit : 0;
      const item = slot.getAttribute("data-item") || (o.units[k] && o.units[k]!.item) || "";
      const key = picKey(sel, k, item) || (d >= 0 ? "" : picKey(sel, 0, item));
      if (!key || key === slot.getAttribute("data-base")) clear(slot);
      else showPic(slot, key);
    }
  };

  /* ---------------- client checks ---------------- */
  /** the control to point at for a group: a combined / choice control, else the first dim still to pick */
  const target = (root: ParentNode | null, base: string, g: Group, rules: Rules | undefined, value: string): string => {
    if (g.kind !== "matrix" || ctl(root, base).length) return base;
    const combo = parseKey(value) || {};
    const dims = g.dims.filter((d) => !locked(rules, g.id + "." + d.id));
    const d = dims.find((x) => !combo[x.id]) || dims[0] || g.dims[0]!;
    return base + "." + d.id;
  };
  const codeOf = (g: Group, rules: Rules | undefined, raw: string): Code =>
    g.kind === "field" ? (fk ? fk.check(g, raw) : g.required && !clean(raw) ? "required" : "") : done(g, valid(g, rules, raw)) ? "" : "required";

  const problems = (): Problem[] => {
    const out: Problem[] = [];
    const need = (root: ParentNode | null, name: string, code: Code) => {
      if (!code) return;
      const els = ctl(root, name);
      const el = els.find((x) => !x.disabled) || els[0];
      if (el) out.push({ el, key: name, code });
    };
    const groups = (root: ParentNode | null, prefix: string, list: readonly Group[], vals: Record<string, string>, rules: Rules | undefined) => {
      for (const g of list) need(root, target(root, prefix + g.id, g, rules, vals[g.id] || ""), codeOf(g, rules, vals[g.id] || ""));
    };
    const o = offer();
    const vs = viewsOf(o);
    const seen: Record<number, string[]> = {};
    o.units.forEach((s, k) => {
      const v = vs[k];
      if (!v) return;
      const item = itemAt(o, k);
      if (!s.item) {
        if (!item) need(v.pick, "u." + k + ".@item", "required");
        else if (s.distinct) {
          const list = (seen[s.line] = seen[s.line] || []);
          need(v.pick, "u." + k + ".@item", list.indexOf(item) >= 0 ? "duplicate" : "");
          list.push(item);
        }
      }
      const it = itemOf(cfg, item);
      if (it)
        groups(
          v.bodies[it.id] || null,
          "u." + k + ".",
          it.groups.filter((g) => g.perUnit),
          m.u[sigOf(o, k)] || {},
          s.rules,
        );
    });
    for (const el of $$(form, "[data-lp-shared]")) {
      const it = itemOf(cfg, el.getAttribute("data-lp-shared") || "");
      if (it && !el.hidden) groups(el, "s." + it.id + ".", it.groups.filter((g) => !g.perUnit), m.u[it.id + "#s"] || {}, undefined);
    }
    for (const x of cfg.extras || []) if (inScope(x.scope, o.id)) groups(form.querySelector('[data-lp-extra="' + x.id + '"]'), "x.", [x], m.x[x.id] ? { [x.id]: m.x[x.id]! } : {}, undefined);
    const bi = st.bump && bumpOn(cfg, o.id) && cfg.bump && cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
    if (bi) groups(form.querySelector("[data-lp-bump-body]"), "b.", bi.groups, m.u[bi.id + "#b"] || {}, undefined);
    return out;
  };

  /* ---------------- prefill (§F.4) ---------------- */
  /** units of the same item and rules take the first one's choice / matrix values while untouched */
  const prefill = (o: Offer): Record<string, number> => {
    const from: Record<string, number> = {};
    const first: Record<string, number> = {};
    o.units.forEach((s, k) => {
      const it = s.item ? itemOf(cfg, s.item) : undefined; // never item choosers
      if (!it) return;
      const fam = it.id + JSON.stringify(s.rules || {});
      if (!(fam in first)) return void (first[fam] = k);
      const sig = sigOf(o, k);
      const src = m.u[sigOf(o, first[fam]!)] || {};
      const gs = it.groups.filter((g) => g.perUnit && g.kind !== "field");
      if (m.t[sig] || !gs.length || !gs.every((g) => done(g, valid(g, s.rules, src[g.id] || "")))) return;
      const dst = (m.u[sig] = m.u[sig] || {});
      for (const g of gs) {
        // the line's locks stay the line's (never remembered as the shopper's values)
        const v = valid(g, s.rules, src[g.id]!);
        if (g.kind !== "matrix") {
          if (!locked(s.rules, g.id)) dst[g.id] = v;
        } else {
          const combo = parseKey(v) || {};
          for (const d of g.dims) if (locked(s.rules, g.id + "." + d.id)) delete combo[d.id];
          dst[g.id] = cellKey(combo);
        }
      }
      from[sig] = first[fam]!;
    });
    return from;
  };

  /* ---------------- draw ---------------- */
  let queued = false;
  const draw = () => {
    queued = false;
    const o = offer();
    m.o = o.id;
    const vs = viewsOf(o);
    // other offers' units: hidden, controls off (whoever hid them before: the steps kit hides too)
    for (const id in views)
      if (id !== o.id)
        for (const v of views[id]!)
          if (v) {
            hide(v.el, true);
            v.el.removeAttribute("data-active");
            off(v.el);
            park(v.el, true);
          }
    // 1 · values (initial ones for what was never chosen), then prefill
    o.units.forEach((s, k) => {
      const it = itemOf(cfg, itemAt(o, k));
      const v = vs[k];
      if (it) valuesOf(sigOf(o, k), it.groups.filter((g) => g.perUnit), s.rules, v ? bodyOf(v, it.id) : scopeOf(it, null), "u." + k + ".");
    });
    const from = prefill(o);
    const counts: Record<string, number> = {};
    const lines: Record<number, number> = {};
    o.units.forEach((s, k) => {
      const it = itemAt(o, k);
      if (it) counts[it] = (counts[it] || 0) + 1;
      lines[s.line] = (lines[s.line] || 0) + 1;
    });
    // shared groups, extras, bump values
    for (const it of cfg.items) if (counts[it.id]) valuesOf(it.id + "#s", it.groups.filter((g) => !g.perUnit), undefined, form.querySelector('[data-lp-shared="' + it.id + '"]'), "s." + it.id + ".");
    for (const x of cfg.extras || [])
      if (inScope(x.scope, o.id) && !(m.x[x.id] && valid(x, undefined, m.x[x.id]!))) {
        const init = initial(x, undefined, form, "x." + x.id);
        if (init) m.x[x.id] = init;
      }
    const bi = cfg.bump && cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
    const offered = bumpOn(cfg, o.id);
    if (bi && offered && st.bump && !m.u[bi.id + "#b"]) {
      // the bump item's body starts from an offer unit of the same item
      const k = o.units.findIndex((_, j) => itemAt(o, j) === bi.id);
      if (k >= 0) m.u[bi.id + "#b"] = { ...(m.u[bi.id + "#s"] || {}), ...(m.u[sigOf(o, k)] || {}) };
    }
    if (bi && offered && st.bump) valuesOf(bi.id + "#b", bi.groups, undefined, form.querySelector("[data-lp-bump-body]"), "b.");

    const sel = read();
    const sum = partsOf(o, sel);
    const bad = problems();
    // 2 · units
    let shown = 0;
    const jl: Record<number, number> = {};
    const ji: Record<string, number> = {};
    o.units.forEach((s, k) => {
      const v = vs[k];
      const item = itemAt(o, k);
      jl[s.line] = (jl[s.line] || 0) + 1;
      if (item) ji[item] = (ji[item] || 0) + 1;
      if (!v) return;
      shown++;
      hide(v.el, false);
      park(v.el, false);
      const it = itemOf(cfg, item);
      const sig = sigOf(o, k);
      const label = (s as Slot & { label?: string }).label || t("choice", "");
      const name = it ? it.short || it.name : label;
      const many = it ? counts[item]! > 1 : lines[s.line]! > 1;
      const head = !multi ? fill(t("unit", "{n}"), { n: k + 1 }) : many ? fill(t("item", "{item} · {j}"), { item: name, j: it ? ji[item]! : jl[s.line]! }) : name;
      const hd = v.el.querySelector("[data-lp-unit-head]");
      if (hd && (multi || t("unit", ""))) setText(hd, head);
      v.el.setAttribute("role", "group");
      const of = t("of", "");
      v.el.setAttribute("aria-label", of ? head + fill(of, { n: k + 1, u: o.units.length }) : fill(t("aria", "{head}"), { head, n: k + 1, units: o.units.length }));
      v.el.setAttribute("data-head", head);
      v.el.setAttribute("data-item", item);
      flag(v.el, "data-free", !!s.free);
      for (const el of $$(v.el, "[data-lp-unit-free]")) hide(el, !s.free);
      if (v.pick) {
        const taken: string[] = [];
        if (s.distinct) o.units.forEach((x, j) => j !== k && x.line === s.line && itemAt(o, j) && taken.push(itemAt(o, j)));
        for (const el of ctl(v.pick, "u." + k + ".@item")) {
          const ok = (s.available || []).indexOf(el.value) >= 0;
          const wrap = el.closest("label") || el;
          el.disabled = !ok;
          (el as HTMLInputElement).checked = el.value === item;
          flag(wrap, "data-taken", taken.indexOf(el.value) >= 0);
          if (!ok) flag(wrap, "data-soldout", true);
        }
      }
      const body = it ? bodyOf(v, it.id) : null;
      for (const id in v.bodies)
        if (v.bodies[id] !== body) {
          hide(v.bodies[id]!, true);
          off(v.bodies[id]!);
          park(v.bodies[id]!, true);
        }
      if (it && body) {
        hide(body, false);
        park(body, false);
        const vals = m.u[sig] || {};
        for (const g of it.groups) if (g.perUnit) drawGroup(body, g, "u." + k + "." + g.id, s.rules, g.kind === "field" ? vals[g.id] || "" : valid(g, s.rules, vals[g.id] || ""), false);
      }
      const pre = sig in from;
      flag(v.el, "data-prefilled", pre);
      for (const el of $$(v.el, "[data-lp-prefill-tag],[data-lp-unit-tag]")) {
        hide(el, !pre);
        if (!el.hasAttribute("data-t")) el.setAttribute("data-t", t("tag", "") || el.textContent || "");
        // "= pièce 1": the piece it copies (a pattern's {n}, else the text's last digit)
        const tx = el.getAttribute("data-t") || "";
        const n = String(from[sig]! + 1);
        if (pre) setText(el, tx.indexOf("{n}") >= 0 ? fill(tx, { n }) : tx.replace(/\d+(?!.*\d)/, n));
      }
      const mine = bad.filter((p) => v.el.contains(p.el));
      flag(v.el, "data-done", !mine.length);
      flag(v.el, "data-bad", mine.some((p) => p.el.getAttribute("aria-invalid") === "true"));
      if (pre && !mine.length && !steps) collapse(v.el, true);
      if (mine.length || steps) collapse(v.el, false);
      const line = v.el.querySelector("[data-lp-unit-sum]");
      if (line) {
        const p = sum.find((x) => x.ks.indexOf(k) >= 0);
        setText(line, p ? [!s.item && p.item ? p.item : "", p.parts.map((x) => x.label).join(" / ")].filter(Boolean).join(" · ") : "");
      }
    });
    for (const b of boxes) {
      const mine = !b.hasAttribute("data-offer") || b.getAttribute("data-offer") === o.id;
      b.setAttribute("data-fill", cfg.fill);
      b.setAttribute("data-units", String(mine ? shown : 0));
      if (b.hasAttribute("data-offer")) hide(b, !mine);
      // inline fill (§F.6, LR): the shared container sits right after the SELECTED card of a stack /
      // ticket list (never inside its <label>); the renderer placed it after the default offer's card
      const card = cfg.fill === "inline" && !b.hasAttribute("data-offer") && form.querySelector('label[data-bundle-card="' + o.id + '"]');
      if (card && card.parentNode === b.parentNode && card.nextSibling !== b) card.parentNode!.insertBefore(b, card.nextSibling);
    }
    // "Contenu du pack" of an offer with nothing to fill (the cards keep their own)
    for (const el of $$(form, "[data-lp-contents]")) if (!el.closest("[data-bundle-card]")) hide(el, el.getAttribute("data-lp-contents") !== o.id || shown > 0);
    // 3 · shared groups, extras, bump body
    for (const el of $$(form, "[data-lp-shared]")) {
      const it = itemOf(cfg, el.getAttribute("data-lp-shared") || "");
      if (!it) continue;
      const on = !!counts[it.id];
      hide(el, !on);
      const vals = m.u[it.id + "#s"] || {};
      for (const g of it.groups) if (!g.perUnit) drawGroup(el, g, "s." + it.id + "." + g.id, undefined, g.kind === "field" ? vals[g.id] || "" : valid(g, undefined, vals[g.id] || ""), !on);
      const hd = el.querySelector("[data-lp-shared-head]");
      if (hd) setText(hd, fill(el.getAttribute("data-h") || hd.getAttribute("data-t") || t("shared", "{item}"), { n: counts[it.id] || 0, item: it.short || it.name }));
    }
    for (const x of cfg.extras || []) {
      const el = form.querySelector('[data-lp-extra="' + x.id + '"]');
      if (!el) continue;
      const on = inScope(x.scope, o.id);
      hide(el, !on);
      drawGroup(el, x, "x." + x.id, undefined, x.kind === "field" ? m.x[x.id] || "" : valid(x, undefined, m.x[x.id] || ""), !on);
    }
    const bumpBox = form.querySelector<HTMLInputElement>('input[name="bump"]');
    const wrap = form.querySelector("[data-lp-bump]") || (bumpBox && bumpBox.closest("label"));
    if (wrap) hide(wrap, !offered);
    if (bumpBox) bumpBox.disabled = !offered;
    const bb = form.querySelector("[data-lp-bump-body]");
    if (bb && bi) {
      const on = offered && st.bump;
      hide(bb, !on);
      const vals = m.u[bi.id + "#b"] || {};
      for (const g of bi.groups) drawGroup(bb, g, "b." + g.id, undefined, g.kind === "field" ? vals[g.id] || "" : valid(g, undefined, vals[g.id] || ""), !on);
    }
    const box = boxOf(o.id);
    if (sk && box) sk.sync(box, cfg.fill);
    for (const el of $$(doc, "[data-lp-vsum]")) drawSummary(doc, el, sum, multi);
    try {
      photos(o, sel);
    } catch {
      /* a broken template never blocks the form */
    }
    save();
    c.emit("units", null);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    win.requestAnimationFrame(draw);
  };

  /** typing in a field: totals and summary, no redraw of the units */
  const quick = () => {
    save();
    const o = offer();
    const sum = partsOf(o, read());
    for (const el of $$(doc, "[data-lp-vsum]")) drawSummary(doc, el, sum, multi);
    c.emit("units", null);
  };

  /* ---------------- events ---------------- */
  const msgOf = (el: Element) => (k: string) => {
    const f = el.closest("[data-field]");
    return (f && f.getAttribute("data-msg-" + k)) || t(k, "");
  };
  const onChange = (el: Ctl, typing: boolean) => {
    const mt = el && el.name ? NAME.exec(el.name) : null;
    if (!mt) return;
    const o = offer();
    const scope = mt[1]!;
    const k = mt[2] !== undefined ? +mt[2] : -1;
    const gid = mt[3]!;
    const value = el.value;
    if (gid === "@item") {
      if (k >= 0 && (el as HTMLInputElement).checked) m.c[o.id + "." + k] = value;
      return queue();
    }
    let groups: readonly Group[] = [];
    let vals: Record<string, string>;
    let rules: Rules | undefined;
    if (scope === "x") {
      groups = cfg.extras || [];
      vals = m.x;
    } else {
      const it = itemOf(cfg, scope === "b" ? (cfg.bump && cfg.bump.item) || "" : scope.charAt(0) === "s" ? scope.slice(2) : itemAt(o, k));
      const sig = !it ? "" : scope === "b" ? it.id + "#b" : scope.charAt(0) === "s" ? it.id + "#s" : sigOf(o, k);
      if (!it || !sig) return;
      if (k >= 0) {
        m.t[sig] = 1;
        rules = o.units[k]!.rules;
        lastUnit = k;
      }
      groups = it.groups;
      vals = m.u[sig] = m.u[sig] || {};
    }
    const g = groups.find((x) => x.id === gid);
    if (!g) return;
    const base = (scope === "x" ? "x" : scope) + "." + gid;
    if (g.kind === "matrix" && mk) {
      const r = mk.pick(g, rules, vals[g.id] || "", el.name, base, value, msgOf(el));
      vals[g.id] = r.v;
      if (r.note) notice(el, r.note);
    } else vals[g.id] = value;
    if (!typing) return queue();
    // typing: the field's counter, then totals and summary (no redraw of the units)
    const root = el.closest("[data-lp-item-body],[data-lp-shared],[data-lp-extra],[data-lp-bump-body]") || form;
    if (g.kind === "field" && fk) fk.sync(root, el.name, g, value, false);
    quick();
  };
  const notice = (el: Element, text: string) => {
    const fs = el.closest("[data-field]") || el.closest("fieldset");
    if (!fs) return;
    let note = fs.querySelector("[data-lp-mnote],[data-lp-note]");
    if (!note) {
      note = fs.appendChild(doc.createElement("p"));
      note.className = "lp-unit__note";
      note.setAttribute("data-lp-note", "");
      note.setAttribute("aria-live", "polite");
    }
    setText(note, text);
    win.setTimeout(() => note!.textContent === text && setText(note!, ""), 5000);
  };

  c.on(form, "change", (e) => {
    const el = e.target as Ctl;
    if (!el) return;
    if (el.name === "bump") {
      st.bump = m.b = (el as HTMLInputElement).checked;
      return queue();
    }
    onChange(el, false);
  });
  c.on(form, "input", (e) => {
    const el = e.target as Ctl;
    if (el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "radio" && el.type !== "checkbox"))) onChange(el, true);
  });
  // a value the form cleared after a server refusal
  c.on(form, "lp-options", queue);
  // inline / rows: a complete unit collapses once focus leaves it
  c.on(form, "focusout", (e) => {
    const u = closest(e.target, "[data-lp-unit]");
    const to = (e as FocusEvent).relatedTarget as Node | null;
    if (steps || !u || (to && u.contains(to))) return;
    win.setTimeout(() => {
      if (u.hasAttribute("data-done") && !u.contains(doc.activeElement)) collapse(u, true);
    }, 0);
  });
  c.on(form, "click", (e) => {
    const u = closest(e.target, "[data-lp-unit-edit]");
    const unit = u && (u.closest("[data-lp-unit]") as HTMLElement | null);
    if (!unit) return;
    e.preventDefault();
    const sig = sigOf(offer(), parseInt(unit.getAttribute("data-lp-unit") || "", 10));
    if (sig) m.t[sig] = 1; // opened to edit: no longer "= pièce 1"
    collapse(unit, false);
    draw();
    const first = $$<Ctl>(unit, "input,select,textarea").find((x) => !x.disabled && !x.closest("[hidden]"));
    if (first) first.focus();
  });
  c.sub("bundle", draw);

  const bumpBox = form.querySelector<HTMLInputElement>('input[name="bump"]');
  if (bumpBox && m.b && !c.preview) bumpBox.checked = st.bump = true;

  const api: UnitsApi = {
    problems,
    mark: (key, code) => {
      const mt = NAME.exec(key);
      if (!mt) return null;
      const o = offer();
      const scope = mt[1]!;
      const k = mt[2] !== undefined ? +mt[2] : -1;
      const gid = mt[3]!;
      const v = k >= 0 ? viewsOf(o)[k] : null;
      const root: ParentNode = (v && v.el) || form;
      const els = ctl(root, key).concat($$<Ctl>(root, "[name]").filter((x) => x.name.indexOf(key + ".") === 0));
      if (!els.length) return null;
      if (code === "unavailable") {
        // sold out since the page opened: struck, never sent again
        const it = itemOf(cfg, scope === "b" ? (cfg.bump && cfg.bump.item) || "" : scope.charAt(0) === "s" ? scope.slice(2) : itemAt(o, k));
        const g = scope === "x" ? (cfg.extras || []).find((x) => x.id === gid) : it && it.groups.find((x) => x.id === gid);
        const sig = !it ? "" : scope === "b" ? it.id + "#b" : scope.charAt(0) === "s" ? it.id + "#s" : sigOf(o, k);
        const val = scope === "x" ? m.x[gid] : (m.u[sig] || {})[gid];
        if (gid === "@item") {
          const s = o.units[k];
          const was = itemAt(o, k);
          if (s) for (const x of o.units) if (x.line === s.line && x.available) x.available = x.available.filter((y) => y !== was);
          m.c[o.id + "." + k] = "";
        } else if (g && val) {
          if (g.kind === "matrix") g.cells.push({ v: val, s: "o" });
          else if (g.kind !== "field") {
            const op = optOf(g.options, val);
            if (op) op.soldOut = true;
          }
          if (g.kind !== "field") {
            if (scope === "x") m.x[gid] = "";
            else for (const s2 in m.u) if (m.u[s2]![gid] === val) m.u[s2]![gid] = "";
          }
        }
        draw();
      }
      return els.find((x) => !x.disabled) || els[0]!;
    },
    reveal: (el) => {
      const u = el.closest("[data-lp-unit]");
      if (!u) return;
      collapse(u, false);
      if (sk) sk.open(parseInt(u.getAttribute("data-lp-unit") || "", 10));
    },
    forget: () => {
      gone = true;
      memory.delete(doc);
      sdel(win, "sessionStorage", storeKey);
    },
    parts: () => partsOf(offer(), read()),
  };
  apis.set(doc, api);
  c.add(() => {
    for (const el of made) if (el.parentNode) el.parentNode.removeChild(el);
    for (const el of $$(form, "[data-lp-parked]")) park(el, false);
    if (apis.get(doc) === api) apis.delete(doc);
    st.sel = () => emptySel(st.bundleId, st.bump);
  });
  draw();
}

/** Plain text of a summary: "2 × Crème jour · Noir / M + 1 × Sérum". */
export function summaryText(groups: readonly SumPart[], multi: boolean): string {
  return groups
    .map((g) => {
      const f = (g.fields || []).map((x) => x.name + " « " + x.value + " »").join(", ");
      return ((multi || g.n > 1 ? g.n + " × " : "") + [g.item, g.parts.map((p) => p.label).join(" / "), f].filter(Boolean).join(" · ")).trim();
    })
    .filter(Boolean)
    .join(" + ");
}

/**
 * Draw a summary into `el`: counts, item names, values (each isolated, a color dot before a swatch),
 * typed values in « », the "Offert" word (el's data-free) — real spaces between the pieces.
 */
export function drawSummary(doc: Document, el: Element, groups: readonly SumPart[], multi: boolean): void {
  const free = el.getAttribute("data-free") || "";
  const text = JSON.stringify([groups, multi]);
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
    if (multi || g.n > 1) add(u, "n", g.n + " ×", "bdi").setAttribute("dir", "ltr");
    if (g.item) add(u, "i", g.item, "bdi");
    g.parts.forEach((p, j) => {
      if (j) add(u, "sep", "/");
      else if (g.item) add(u, "sep", "·");
      if (p.sw && HEX.test(p.sw)) (add(u, "dot", "") as HTMLElement).style.setProperty("--sw", p.sw);
      add(u, "l", p.label, "bdi");
    });
    for (const f of g.fields || []) add(u, "f", f.name + " « " + f.value + " »", "bdi");
    if (g.free && free) add(u, "free", free);
  });
}

/** The group's own message for an error code (written by the server into the markup), else `fallback`. */
export function groupMessage(el: Element, code: string, fallback: string): string {
  const g = el.closest("[data-field]") || el.closest("[data-msg]");
  if (!g) return fallback;
  const attr = code === "unavailable" ? "data-msg-gone" : code === "too_long" ? "data-msg-long" : code === "duplicate" ? "data-msg-dup" : code === "invalid" ? "data-msg-bad" : "data-msg";
  return g.getAttribute(attr) || g.getAttribute("data-msg") || fallback;
}

/** checked() re-exported for the form (radio / select / text). */
export { checked };
