/**
 * Scroll-snap gallery sync: [data-gallery] > [data-gallery-track] > [data-slide], with optional
 * [data-thumb="i"], [data-dot="i"], [data-gallery-prev], [data-gallery-next].
 * The active slide is tracked with an IntersectionObserver rooted on the track; navigation scrolls by
 * the slide's offset from the track's inline-start edge, so it is correct in RTL with every
 * scrollLeft convention. Arrow keys follow the visual direction.
 */
import type { Ctx } from "./core";
import { $$, closest, disable, flag, isRtl, num } from "./core";

function setup(c: Ctx, root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>("[data-gallery-track]");
  if (!track) return;
  const slides = $$(track, "[data-slide]");
  if (!slides.length) return;
  const nav = $$(root, "[data-thumb],[data-dot]");
  const prev = root.querySelector<HTMLElement>("[data-gallery-prev]");
  const next = root.querySelector<HTMLElement>("[data-gallery-next]");
  const ratios = slides.map(() => 0);
  const navIndex = (el: Element) => num(el.getAttribute("data-thumb") ?? el.getAttribute("data-dot"), -1);
  let cur = -1;
  let lockUntil = 0;
  let lockTimer = 0;

  const activate = (i: number) => {
    if (i === cur || i < 0 || i >= slides.length) return;
    cur = i;
    slides.forEach((s, k) => flag(s, "data-active", k === i));
    for (const b of nav) {
      const on = navIndex(b) === i;
      flag(b, "data-active", on);
      if (on) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
    disable(prev, i <= 0);
    disable(next, i >= slides.length - 1);
    root.setAttribute("data-index", String(i));
  };

  const best = () => {
    let bi = 0;
    for (let k = 1; k < ratios.length; k++) if (ratios[k]! > ratios[bi]! + 0.01) bi = k;
    return bi;
  };

  const go = (i: number) => {
    const to = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[to]!.getBoundingClientRect();
    const t = track.getBoundingClientRect();
    const dx = isRtl(c, track) ? s.right - t.right : s.left - t.left;
    try {
      track.scrollBy({ left: dx, behavior: c.reduced ? "auto" : "smooth" });
    } catch {
      track.scrollLeft += dx;
    }
    activate(to);
    // ignore intermediate slides passing by during the smooth scroll, then settle on the real one —
    // keeping the requested slide when it ended up as visible as any (several slides per view, last slide)
    lockUntil = Date.now() + 650;
    c.win.clearTimeout(lockTimer);
    lockTimer = c.win.setTimeout(() => {
      const b = best();
      activate(ratios[to]! + 0.01 >= ratios[b]! ? to : b);
    }, 700);
  };

  const IO = c.win.IntersectionObserver;
  if (typeof IO === "function") {
    const io = new IO(
      (entries) => {
        for (const e of entries) {
          const k = slides.indexOf(e.target as HTMLElement);
          if (k >= 0) ratios[k] = e.isIntersecting ? e.intersectionRatio : 0;
        }
        if (Date.now() >= lockUntil) activate(best());
      },
      { root: track, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const s of slides) io.observe(s);
    c.add(() => io.disconnect());
  }
  c.add(() => c.win.clearTimeout(lockTimer));
  activate(0);

  c.on(root, "click", (e) => {
    const b = closest(e.target, "[data-thumb],[data-dot],[data-gallery-prev],[data-gallery-next]");
    if (!b || !root.contains(b)) return;
    e.preventDefault();
    if (b.hasAttribute("data-gallery-prev")) go(cur - 1);
    else if (b.hasAttribute("data-gallery-next")) go(cur + 1);
    else go(navIndex(b));
  });

  if (!track.hasAttribute("tabindex")) track.tabIndex = 0;
  c.on(track, "keydown", (e) => {
    const k = (e as KeyboardEvent).key;
    let step = k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : 0;
    if (k === "Home" || k === "End") {
      e.preventDefault();
      go(k === "Home" ? 0 : slides.length - 1);
      return;
    }
    if (!step) return;
    if (isRtl(c, track)) step = -step;
    e.preventDefault();
    go(cur + step);
  });
}

export function gallery(c: Ctx): void {
  for (const root of $$(c.doc, "[data-gallery]")) setup(c, root);
}
