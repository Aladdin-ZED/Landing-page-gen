/**
 * [data-countdown="<ISO>"] with [data-cd="d|h|m|s"] children: one shared timer aligned to the wall
 * clock second. Without a days slot, hours carry the days. Digits follow the numbering system of the
 * server-rendered text. On expiry: `data-expired` (+ hidden with data-hide-expired); an expired
 * countdown inside the thank-you upsell hides the offer. Real end dates only — never resets.
 *
 * The page is static and may be visited days after it was rendered, so the first tick rewrites
 * everything — including the day label: `[data-cd-label="d"][data-forms='{"one":"jour","other":"jours"}']`
 * holds the plural forms (whole labels keyed by Intl.PluralRules category of the page locale,
 * `other` required) and is re-picked whenever the day count changes. Both live in the days group —
 * the parent of [data-cd="d"]; when that group carries `data-cd-collapse` it is hidden while no full
 * day is left (compact one-line countdowns read "23:59:59", not "00 jours 23:59:59").
 */
import type { Ctx } from "./core";
import { $$, flag, setText } from "./core";
import { digitZero, mapDigits, pad2 } from "./numbers";

type Unit = "d" | "h" | "m" | "s";

interface Item {
  el: HTMLElement;
  end: number;
  zero: number;
  parts: Partial<Record<Unit, Element>>;
  /** plural-aware day label: the element, its forms, the rules picking one */
  lab?: [Element, Record<string, string>, Intl.PluralRules];
  /** days group hidden at 0 */
  box?: HTMLElement;
  /** last day count written (-1 = never) */
  days: number;
  over: boolean;
}

export function countdown(c: Ctx): void {
  const items: Item[] = [];
  for (const el of $$(c.doc, "[data-countdown]")) {
    const end = Date.parse(el.getAttribute("data-countdown") || "");
    if (!isFinite(end)) continue;
    const it: Item = { el, end, zero: digitZero(el.textContent || ""), parts: {}, days: -1, over: false };
    for (const p of $$(el, "[data-cd]")) {
      const k = p.getAttribute("data-cd");
      if ((k === "d" || k === "h" || k === "m" || k === "s") && p.closest("[data-countdown]") === el) it.parts[k] = p;
    }
    // the days group = the parent of the days figure: its label and collapse flag live there
    const unit = it.parts.d && it.parts.d.parentElement;
    if (unit) {
      if (unit.hasAttribute("data-cd-collapse")) it.box = unit;
      const lab = unit.querySelector('[data-cd-label="d"]');
      try {
        const forms = JSON.parse(lab!.getAttribute("data-forms")!);
        if (forms.other) it.lab = [lab!, forms, new Intl.PluralRules(c.cfg.locale)];
      } catch {
        /* no label, unusable forms or locale: the server-rendered label stays */
      }
    }
    items.push(it);
  }
  if (!items.length) return;

  const write = (it: Item, k: Unit, v: number) => {
    const p = it.parts[k];
    if (p) setText(p, mapDigits(pad2(v), it.zero));
    if (k !== "d" || v === it.days) return;
    it.days = v;
    if (it.box) it.box.hidden = !v;
    const lab = it.lab;
    if (lab) setText(lab[0], lab[1][lab[2].select(v)] || lab[1].other!);
  };

  const expire = (it: Item) => {
    it.over = true;
    for (const k of ["d", "h", "m", "s"] as const) write(it, k, 0);
    flag(it.el, "data-expired", true);
    if (it.el.hasAttribute("data-hide-expired")) it.el.hidden = true;
    const upsell = it.el.closest<HTMLElement>("[data-ty-upsell]");
    if (upsell && upsell.getAttribute("data-state") !== "added") {
      upsell.setAttribute("data-state", "expired");
      upsell.hidden = true;
    }
  };

  let timer = 0;
  const tick = () => {
    const now = Date.now();
    let live = 0;
    for (const it of items) {
      if (it.over) continue;
      const left = Math.floor((it.end - now) / 1000);
      if (left <= 0) {
        expire(it);
        continue;
      }
      live++;
      let h = Math.floor(left / 3600);
      if (it.parts.d) {
        write(it, "d", Math.floor(h / 24));
        h %= 24;
      }
      write(it, "h", h);
      write(it, "m", Math.floor((left % 3600) / 60));
      write(it, "s", left % 60);
    }
    if (live) timer = c.win.setTimeout(tick, 1000 - (Date.now() % 1000) + 10);
  };
  tick();
  c.add(() => c.win.clearTimeout(timer));
}
