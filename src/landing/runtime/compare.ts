/** Before/after: [data-compare] gets `--pos` (0–100%) from its input[type=range][data-compare-range]. */
import type { Ctx } from "./core";
import { $$, clamp, num } from "./core";

export function compare(c: Ctx): void {
  for (const root of $$(c.doc, "[data-compare]")) {
    const range = root.querySelector<HTMLInputElement>("input[data-compare-range]");
    if (!range) continue;
    const update = () => {
      const min = num(range.min, 0);
      const max = num(range.max, 100);
      const pct = max > min ? ((num(range.value, (min + max) / 2) - min) / (max - min)) * 100 : 50;
      root.style.setProperty("--pos", Math.round(clamp(pct, 0, 100) * 100) / 100 + "%");
    };
    update();
    c.on(range, "input", update);
    c.on(range, "change", update);
  }
}
