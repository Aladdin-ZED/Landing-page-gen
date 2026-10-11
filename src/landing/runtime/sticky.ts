/**
 * [data-sticky-cta]: `data-visible` while no [data-hero-cta] and not #order-form is on screen.
 * Hidden bars are aria-hidden + inert so keyboard / screen-reader users never land on them.
 */
import type { Ctx } from "./core";
import { $$, flag } from "./core";

export function sticky(c: Ctx): void {
  const bars = $$(c.doc, "[data-sticky-cta]");
  if (!bars.length) return;
  const watched: Element[] = $$(c.doc, "[data-hero-cta]");
  const form = c.doc.getElementById("order-form");
  if (form) watched.push(form);
  const seen = new Map<Element, boolean>();

  const apply = () => {
    let show = true;
    seen.forEach((v) => {
      if (v) show = false;
    });
    for (const b of bars) {
      flag(b, "data-visible", show);
      if (show) b.removeAttribute("aria-hidden");
      else b.setAttribute("aria-hidden", "true");
      flag(b, "inert", !show);
    }
  };

  const IO = c.win.IntersectionObserver;
  if (typeof IO !== "function" || !watched.length) {
    apply();
    return;
  }
  const io = new IO((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
    apply();
  });
  for (const el of watched) io.observe(el);
  c.add(() => io.disconnect());
}
