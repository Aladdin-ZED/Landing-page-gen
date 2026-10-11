/**
 * [data-parallax="0.08"] — subtle translateY on scroll (desktop + fine pointer + motion allowed).
 * Uses the individual `translate` property so it composes with any CSS transform/rotation.
 * Positions are measured only when layout may have changed; scroll frames only write.
 */
import type { Ctx } from "./core";
import { $$, clamp, num } from "./core";

interface Item {
  el: HTMLElement;
  f: number;
  top: number;
  h: number;
  y: number;
}

export function parallax(c: Ctx): void {
  const { win } = c;
  if (c.reduced || !win.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches) return;
  const items: Item[] = $$(c.doc, "[data-parallax]")
    .map((el) => ({ el, f: clamp(num(el.getAttribute("data-parallax")), -0.5, 0.5), top: 0, h: 0, y: 0 }))
    .filter((i) => i.f !== 0);
  if (!items.length) return;

  let raf = 0;
  let dirty = true;
  const frame = () => {
    raf = 0;
    const sy = win.scrollY;
    if (dirty) {
      dirty = false;
      for (const i of items) {
        const r = i.el.getBoundingClientRect();
        i.top = r.top + sy - i.y;
        i.h = r.height;
      }
    }
    const vh = win.innerHeight;
    for (const i of items) {
      const rel = i.top - sy;
      if (rel > vh + 200 || rel + i.h < -200) continue;
      const y = Math.round((vh / 2 - (rel + i.h / 2)) * i.f * 10) / 10;
      if (y !== i.y) {
        i.y = y;
        i.el.style.setProperty("translate", "0 " + y + "px");
      }
    }
  };
  const request = () => {
    if (!raf) raf = win.requestAnimationFrame(frame);
  };
  const remeasure = () => {
    dirty = true;
    request();
  };

  request();
  c.on(win, "scroll", request, { passive: true });
  c.on(win, "resize", remeasure, { passive: true });
  c.on(win, "load", remeasure);
  if (typeof win.ResizeObserver === "function") {
    const ro = new win.ResizeObserver(remeasure);
    ro.observe(c.doc.body);
    c.add(() => ro.disconnect());
  }
  c.add(() => {
    if (raf) win.cancelAnimationFrame(raf);
    for (const i of items) i.el.style.removeProperty("translate");
  });
}
