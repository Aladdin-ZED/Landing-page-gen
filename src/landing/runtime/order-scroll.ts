/**
 * [data-action="order"] CTAs (+ optional data-bundle="<id>"): preselect the bundle, smooth-scroll to
 * #order below the sticky header, then focus the first field that still needs the shopper.
 * Without the form on the page the link's own href is left to work.
 */
import type { Ctx } from "./core";
import { closest, getForm } from "./core";
import { firstPending } from "./fields";
import { focusQuiet, scrollToEl } from "./scroll";

export function orderScroll(c: Ctx): void {
  c.on(c.doc, "click", (e) => {
    const a = closest(e.target, '[data-action="order"]');
    if (!a) return;
    const id = a.getAttribute("data-bundle");
    c.emit("cta", id);
    if (id) c.emit("select", id);
    const target = c.doc.getElementById("order") || c.doc.getElementById("order-form");
    if (!target) return;
    e.preventDefault();
    scrollToEl(c, target, () => {
      const form = getForm(c);
      const el = form ? firstPending(c, form) : null;
      if (el) focusQuiet(el);
    });
  });
}
