/** [data-marquee] — `data-paused` while off-screen (saves battery); always paused with reduced motion. */
import type { Ctx } from "./core";
import { $$, flag } from "./core";

export function marquee(c: Ctx): void {
  const els = $$(c.doc, "[data-marquee]");
  if (!els.length) return;
  const IO = c.win.IntersectionObserver;
  if (c.reduced || typeof IO !== "function") {
    for (const el of els) flag(el, "data-paused", c.reduced);
    return;
  }
  const io = new IO((entries) => {
    for (const e of entries) flag(e.target, "data-paused", !e.isIntersecting);
  });
  for (const el of els) io.observe(el);
  c.add(() => io.disconnect());
}
