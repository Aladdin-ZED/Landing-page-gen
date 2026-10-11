/** [data-accordion="single"] wrapping <details>: opening one closes its siblings (toggle doesn't bubble → capture). */
import type { Ctx } from "./core";
import { $$ } from "./core";

export function accordion(c: Ctx): void {
  for (const root of $$(c.doc, '[data-accordion="single"]')) {
    c.on(
      root,
      "toggle",
      (e) => {
        const d = e.target as HTMLDetailsElement;
        if (d.tagName !== "DETAILS" || !d.open || d.closest("[data-accordion]") !== root) return;
        for (const o of $$<HTMLDetailsElement>(root, "details[open]"))
          if (o !== d && o.closest("[data-accordion]") === root) o.open = false;
      },
      { capture: true },
    );
  }
}
