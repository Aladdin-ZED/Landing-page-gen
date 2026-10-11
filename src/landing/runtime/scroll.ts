/** Smooth scroll to an element below any sticky header, then run `done` once scrolling has settled. */
import type { Ctx } from "./core";
import { $$ } from "./core";

/**
 * How much of the top of the viewport a fixed/sticky header ([data-sticky-header] or .lp-header)
 * covers once stuck: its VISIBLE part. A sticky header may use a negative top so one of its rows
 * rides above the viewport (e.g. a tagline over the bar): it covers height + top. A positive top (a
 * floating bar) covers its gap too. Fixed headers cover down to their bottom edge; anything taller
 * than a third of the viewport, or not anchored at the top, is not a header.
 */
export function headerOffset(c: Ctx): number {
  const third = c.win.innerHeight / 3;
  let h = 0;
  for (const el of $$(c.doc, "[data-sticky-header],.lp-header")) {
    const cs = c.win.getComputedStyle(el);
    const sticky = cs.position === "sticky";
    if (!sticky && cs.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (!r.height || r.height >= third) continue;
    // sticky: where it will rest once stuck (its used `top`); fixed: where it is now
    const covered = sticky ? r.height + (parseFloat(cs.top) || 0) : r.top < third ? r.bottom : 0;
    h = Math.max(h, covered);
  }
  return Math.max(0, Math.round(h));
}

export function scrollToEl(c: Ctx, el: Element, done: () => void): void {
  const { win } = c;
  const top = Math.max(0, Math.round(el.getBoundingClientRect().top + win.scrollY - headerOffset(c) - 12));
  if (Math.abs(top - win.scrollY) < 4) {
    done();
    return;
  }
  try {
    win.scrollTo({ top, behavior: c.reduced ? "auto" : "smooth" });
  } catch {
    win.scrollTo(0, top);
  }
  // settle detection without `scrollend` (old Android Chrome): position unchanged for 5 frames
  let last = -1;
  let still = 0;
  let raf = 0;
  const t0 = Date.now();
  const poll = () => {
    const y = win.scrollY;
    still = Math.abs(y - last) < 1 ? still + 1 : 0;
    last = y;
    if (still >= 5 || Date.now() - t0 > 1800) {
      raf = 0;
      done();
    } else raf = win.requestAnimationFrame(poll);
  };
  raf = win.requestAnimationFrame(poll);
  c.add(() => {
    if (raf) win.cancelAnimationFrame(raf);
  });
}

/** Focus without the browser's own scroll jump. */
export function focusQuiet(el: HTMLElement): void {
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/** Focus a control, first scrolling it below the sticky header unless it is already fully on screen. */
export function focusInView(c: Ctx, el: HTMLElement): void {
  const r = el.getBoundingClientRect();
  if (r.top >= headerOffset(c) && r.bottom <= c.win.innerHeight) focusQuiet(el);
  else scrollToEl(c, el, () => focusQuiet(el));
}
