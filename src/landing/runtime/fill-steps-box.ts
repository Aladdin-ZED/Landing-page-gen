/**
 * Steps and box navigation (optional chunk "fill-steps-box", docs/OFFERS.md §F.3): one unit panel at
 * a time.
 *
 *   steps   [data-lp-steps] holds one button[data-lp-step=<k>] per unit (number, chosen item thumb,
 *           tick when done, error dot — CSS from data-done / data-bad), aria-controls = the unit,
 *           aria-current="step" on the open one; [data-lp-next] / [data-lp-prev] move (never
 *           automatically).
 *   box     "build your box": a tray of tiles [data-lp-slot=<k>] (empty: "+" and "Pièce n"; filled:
 *           the unit's photo in [data-lp-slot-pic] — from template[data-lp-vimg] — and its color in
 *           [data-lp-slot-dot] style --sw); a tap opens that unit's panel below (aria-expanded).
 *   Chips / tiles: data-done (complete), data-error (a group in error).
 *
 * Buttons / tiles for units the markup does not have are cloned from template[data-lp-step-tpl] /
 * template[data-lp-slot-tpl] (else from the first one), {k} / {n} replaced. Units other than the open
 * one get data-active removed and `hidden`.
 */
import { $$, fill, flag, hide } from "./core";
import type { Host, StepsKit } from "./units";

export function stepsKit(h: Host): StepsKit {
  const { c } = h;
  const doc = c.doc;
  let open = -1;
  let box: Element | null = null;
  let mode = "";
  const made: Element[] = [];
  c.add(() => {
    for (const el of made) if (el.parentNode) el.parentNode.removeChild(el);
  });

  const clone = (from: Element, k: number, head: string): Element => {
    const el = from.cloneNode(true) as Element;
    const v = { k, n: k + 1, head };
    for (const x of [el].concat($$(el, "*"))) {
      for (const a of Array.prototype.slice.call(x.attributes) as Attr[]) if (a.value.indexOf("{") >= 0) x.setAttribute(a.name, fill(a.value, v));
      x.removeAttribute("data-done");
      x.removeAttribute("data-bad");
    }
    const w = doc.createTreeWalker(el, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue && n.nodeValue.indexOf("{") >= 0) n.nodeValue = fill(n.nodeValue, v);
    return el;
  };

  /** the buttons (steps) or tiles (box) for these units, cloned when missing, extra ones hidden */
  const strip = (attr: string, ks: number[], heads: Record<number, string>): Record<number, Element> => {
    const out: Record<number, Element> = {};
    if (!box) return out;
    const have = $$(box, "[" + attr + "]").filter((x) => !x.closest("template"));
    const tpl = box.querySelector<HTMLTemplateElement>("template[" + attr + "-tpl]");
    // React (admin preview) appends a <template>'s children to the element itself, not to .content
    const src = (tpl && ((tpl.content && tpl.content.firstElementChild) || tpl.firstElementChild)) || have[0];
    for (const el of have) {
      const k = parseInt(el.getAttribute(attr) || "", 10);
      if (ks.indexOf(k) >= 0 && !(k in out)) out[k] = el;
      else hide(el, true);
    }
    let last: Element | null = null;
    for (const k of ks) {
      if (!out[k] && src) {
        const el = clone(src, k, heads[k] || String(k + 1));
        el.setAttribute(attr, String(k));
        made.push(el);
        const parent = (last && last.parentNode) || (have[0] && have[0].parentNode) || box.querySelector("[data-lp-steps]") || box;
        parent.insertBefore(el, last ? last.nextSibling : null);
        out[k] = el;
      }
      if (out[k]) last = out[k]!;
    }
    return out;
  };

  const draw = () => {
    if (!box || (mode !== "steps" && mode !== "box")) return;
    const list = h.list();
    const ks = list.map((u) => u.k);
    if (ks.indexOf(open) < 0) open = ks.length ? ks[0]! : -1;
    const at = ks.indexOf(open);
    const heads: Record<number, string> = {};
    for (const u of list) heads[u.k] = u.head;
    const chips = strip(mode === "steps" ? "data-lp-step" : "data-lp-slot", ks, heads);
    for (const el of $$(box, "[data-lp-unit][data-active]")) if (ks.indexOf(parseInt(el.getAttribute("data-lp-unit") || "", 10)) < 0 || el.hidden) el.removeAttribute("data-active");
    for (const u of list) {
      if (!u.el.id) u.el.id = "lp-unit-" + u.k;
      const on = u.k === open;
      flag(u.el, "data-active", on);
      hide(u.el, !on);
      const b = chips[u.k];
      if (!b) continue;
      hide(b, false);
      b.setAttribute("aria-controls", u.el.id);
      flag(b, "data-done", u.done);
      flag(b, "data-bad", u.bad);
      flag(b, "data-error", u.bad);
      b.setAttribute("data-item", u.item);
      // box tile: the unit's photo and color
      const slot = b.querySelector("[data-lp-slot-pic]");
      if (slot && slot.getAttribute("data-key") !== u.pic) {
        slot.setAttribute("data-key", u.pic);
        while (slot.firstChild) slot.removeChild(slot.firstChild);
        const tp = u.pic ? doc.querySelector<HTMLTemplateElement>('template[data-lp-vimg="' + u.pic + '"]') : null;
        // React (admin preview) appends a <template>'s children to the element itself, not to .content
        const src: ParentNode | null = tp ? (tp.content && tp.content.firstElementChild ? tp.content : tp) : null;
        const part = src && (src.querySelector('[data-slot="thumb"]') || src.querySelector("[data-slot]"));
        if (part && part.firstElementChild) slot.appendChild(doc.importNode(part.firstElementChild, true));
      }
      const tdot = b.querySelector<HTMLElement>("[data-lp-slot-dot]");
      if (tdot) {
        if (/^#[0-9a-fA-F]{6}$/.test(u.sw)) tdot.style.setProperty("--sw", u.sw);
        else tdot.removeAttribute("style");
      }
      if (mode === "steps") {
        if (on) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      } else b.setAttribute("aria-expanded", on ? "true" : "false");
      const dot = b.querySelector<HTMLElement>("[data-lp-dot]");
      const sw = u.el.querySelector<HTMLInputElement>("input[data-sw]:checked");
      if (dot) {
        const v = sw ? sw.getAttribute("data-sw") || "" : "";
        if (/^#[0-9a-fA-F]{6}$/.test(v)) dot.style.setProperty("--sw", v);
        hide(dot, !v);
      }
    }
    for (const el of $$<HTMLButtonElement>(box, "[data-lp-prev]")) el.disabled = at <= 0;
    for (const el of $$<HTMLButtonElement>(box, "[data-lp-next]")) {
      el.disabled = at < 0 || at >= ks.length - 1;
      hide(el, ks.length < 2);
    }
    for (const el of $$(box, "[data-lp-prev]")) hide(el, ks.length < 2);
  };

  const go = (k: number, focus: boolean) => {
    open = k;
    draw();
    const u = h.list().find((x) => x.k === k);
    if (!u || !focus) return;
    const first = $$<HTMLElement>(u.el, "input,select,textarea,button").find((x) => !(x as HTMLInputElement).disabled && !x.closest("[hidden]"));
    if (first) {
      try {
        first.focus({ preventScroll: true });
      } catch {
        first.focus();
      }
    }
  };

  c.on(doc, "click", (e) => {
    const t = e.target as Element | null;
    if (!box || !t || typeof t.closest !== "function" || !box.contains(t)) return;
    const step = t.closest("[data-lp-step],[data-lp-slot]");
    const next = t.closest("[data-lp-next]");
    const prev = t.closest("[data-lp-prev]");
    if (!step && !next && !prev) return;
    e.preventDefault();
    const ks = h.list().map((u) => u.k);
    if (step) return go(parseInt(step.getAttribute("data-lp-step") || step.getAttribute("data-lp-slot") || "", 10), false);
    const at = ks.indexOf(open) + (next ? 1 : -1);
    if (at >= 0 && at < ks.length) go(ks[at]!, true);
  });

  return {
    sync(b, f) {
      box = b;
      mode = f;
      draw();
    },
    open(k) {
      go(k, false);
    },
  };
}
