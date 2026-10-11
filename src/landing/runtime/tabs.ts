/**
 * ARIA tabs ([data-tabs] with [role=tab][aria-controls]): click + automatic activation on arrow keys,
 * Home/End, roving tabindex, RTL-mirrored arrows, vertical lists via aria-orientation.
 */
import type { Ctx } from "./core";
import { $$, closest, isRtl } from "./core";

function setup(c: Ctx, root: HTMLElement): void {
  const tabs = $$(root, '[role="tab"]').filter((t) => t.closest("[data-tabs]") === root);
  if (!tabs.length) return;
  const list = root.querySelector('[role="tablist"]');
  const vertical = !!list && list.getAttribute("aria-orientation") === "vertical";

  const select = (tab: HTMLElement, focus: boolean) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      const id = t.getAttribute("aria-controls");
      const panel = id ? c.doc.getElementById(id) : null;
      if (panel) panel.hidden = !on;
    }
    if (focus) tab.focus();
  };

  select(tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0]!, false);

  c.on(root, "click", (e) => {
    const t = closest(e.target, '[role="tab"]');
    if (!t || tabs.indexOf(t) < 0) return;
    e.preventDefault();
    select(t, false);
  });

  c.on(root, "keydown", (e) => {
    const cur = tabs.indexOf(e.target as HTMLElement);
    if (cur < 0) return;
    const n = tabs.length;
    const fwd = isRtl(c, root) ? -1 : 1;
    let i: number | null = null;
    switch ((e as KeyboardEvent).key) {
      case "ArrowRight":
        if (!vertical) i = cur + fwd;
        break;
      case "ArrowLeft":
        if (!vertical) i = cur - fwd;
        break;
      case "ArrowDown":
        if (vertical) i = cur + 1;
        break;
      case "ArrowUp":
        if (vertical) i = cur - 1;
        break;
      case "Home":
        i = 0;
        break;
      case "End":
        i = n - 1;
        break;
    }
    if (i === null) return;
    e.preventDefault();
    select(tabs[(i + n) % n]!, true);
  });
}

export function tabs(c: Ctx): void {
  for (const root of $$(c.doc, "[data-tabs]")) setup(c, root);
}
