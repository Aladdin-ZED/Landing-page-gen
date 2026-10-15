/**
 * [data-sticky-cta]: the floating buy bar steps in only once the visitor has scrolled PAST the hero's
 * call to action — never on first paint, where it would sit over the hero photo or headline (on a
 * phone the hero CTA often starts below the fold). With no rendered hero CTA, past the first
 * viewport. It steps aside while any [data-hero-cta] (the hero button, the page-end marker) or the
 * order form is on screen. Hidden bars are aria-hidden + inert so keyboard / screen-reader users never
 * land on them.
 *
 * The gate is a real call to action: a [data-hero-cta] that is not aria-hidden (an aria-hidden one,
 * like the page-end marker, only hides the bar while it is on screen).
 *
 * Positions are read on scroll / resize / load (one rAF, a handful of rects, reads only), so a jump
 * straight to #order or the footer — which an IntersectionObserver never reports for a CTA it skipped
 * — still counts as having passed the hero.
 */
import type { Ctx } from "./core";
import { $$, flag } from "./core";

type Watched = Pick<Element, "getBoundingClientRect" | "getAttribute">;

/**
 * Pure decision over the watched elements (hero CTAs, page-end marker, then the order form): hidden
 * while any of them is on screen, else shown once a rendered gate CTA lies above the viewport — or,
 * with no rendered gate (none, or hidden at this breakpoint), once the page is past its first viewport.
 */
export function stickyVisible(els: readonly Watched[], form: unknown, vh: number, scrollY: number): boolean {
  let gate = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.bottom > 0 && r.top < vh) return false;
    if (el !== form && el.getAttribute("aria-hidden") !== "true") gate = r.bottom > 0 ? gate || 1 : 2;
  }
  return gate ? gate > 1 : scrollY > vh * 0.85;
}

export function sticky(c: Ctx): void {
  const bars = $$(c.doc, "[data-sticky-cta]");
  if (!bars.length) return;
  const win = c.win;
  const form = c.doc.getElementById("order-form");
  const watched: Element[] = $$(c.doc, "[data-hero-cta]");
  if (form) watched.push(form);
  let shown: boolean | undefined;
  let raf = 0;
  const update = () => {
    raf = 0;
    const show = stickyVisible(watched, form, win.innerHeight, win.scrollY);
    if (show === shown) return;
    shown = show;
    for (const b of bars) {
      flag(b, "data-visible", show);
      flag(b, "inert", !show);
      if (show) b.removeAttribute("aria-hidden");
      else b.setAttribute("aria-hidden", "true");
    }
  };
  const schedule = () => {
    raf ||= win.requestAnimationFrame(update);
  };
  // the markup ships hidden (no data-visible); the real state lands on the next frame, so init never
  // forces a layout
  schedule();
  c.add(() => raf && win.cancelAnimationFrame(raf));
  c.on(win, "scroll", schedule, { passive: true });
  c.on(win, "resize", schedule, { passive: true });
  c.on(win, "load", schedule);
}
