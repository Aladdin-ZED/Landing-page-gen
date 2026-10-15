/**
 * Bundle selection + everything priced from it:
 *  - `data-selected` on every [data-bundle-card="<id>"] (form picker and offer sections),
 *  - the form's input[name=bundle] radios,
 *  - [data-lp-price="current"] (bundle total), [data-lp-sum=subtotal|bump|shipping|total],
 *  - per-unit variant rows and everything that follows the option choices (variants.ts pickers).
 * Other modules request a change with emit("select", id); the applied result is emitted as "bundle".
 * The shopper's pack is remembered for the tab (sessionStorage "lp-b:<pageKey>"), so a reload comes
 * back to it with its option rows (variants.ts remembers the options the same way).
 */
import type { Ctx } from "./core";
import { $$, flag, getForm, setText, sget, sset } from "./core";
import { computeTotals, formatMoney } from "./money";
import { str } from "./strings";
import { pickers, syncVariantRows } from "./variants";

export function money(c: Ctx, amount: number): string {
  return formatMoney(amount, c.cfg.money);
}

/** Refresh the order summary lines from the current state. */
export function renderSums(c: Ctx): void {
  const t = computeTotals(c.cfg, c.st.bundleId, c.st.bump);
  if (!t) return;
  for (const el of $$(c.doc, "[data-lp-sum]")) {
    const k = el.getAttribute("data-lp-sum");
    const v = k === "subtotal" ? t.subtotal : k === "bump" ? t.bump : k === "shipping" ? t.shipping : k === "total" ? t.total : null;
    if (v === null) continue;
    setText(el, k === "shipping" && v === 0 ? str(c.cfg, "form.free") || money(c, 0) : money(c, v));
    flag(el, "data-zero", v === 0);
  }
}

export function bundles(c: Ctx): void {
  const { cfg, st } = c;
  const list = cfg.bundles || [];
  if (!list.length) return;
  const form = getForm(c);
  const radios = form ? $$<HTMLInputElement>(form, 'input[name="bundle"]') : [];
  const valid = (id: string | null | undefined): id is string => !!id && list.some((b) => b.id === id);

  const storeKey = "lp-b:" + cfg.pageKey;
  if (!valid(st.bundleId)) {
    const saved = c.preview ? null : sget(c.win, "sessionStorage", storeKey);
    const checked = radios.find((r) => r.checked);
    st.bundleId = valid(saved)
      ? saved
      : checked && valid(checked.value)
        ? checked.value
        : valid(cfg.defaultBundleId)
          ? cfg.defaultBundleId
          : list[0]!.id;
  }
  const bumpBox = form ? form.querySelector<HTMLInputElement>('input[name="bump"]') : null;
  if (bumpBox) st.bump = bumpBox.checked;
  const current = () => list.find((x) => x.id === st.bundleId) || list[0]!;
  let options: (() => void) | null = null;

  const apply = () => {
    const b = list.find((x) => x.id === st.bundleId)!;
    for (const r of radios) if (r.checked !== (r.value === b.id)) r.checked = r.value === b.id;
    for (const card of $$(c.doc, "[data-bundle-card]")) flag(card, "data-selected", card.getAttribute("data-bundle-card") === b.id);
    for (const el of $$(c.doc, '[data-lp-price="current"]')) setText(el, money(c, b.total));
    if (form) syncVariantRows(c.doc, form, b.qty);
    renderSums(c);
    if (options) options();
  };

  c.sub("select", (id) => {
    if (!valid(id) || id === st.bundleId) return;
    st.bundleId = id;
    if (!c.preview) sset(c.win, "sessionStorage", storeKey, id);
    apply();
    c.emit("bundle", { id, user: true });
  });

  if (form)
    c.on(form, "change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "bundle" && t.checked) c.emit("select", t.value);
      else if (t.name === "bump") {
        st.bump = t.checked;
        renderSums(c);
      }
    });

  apply();
  if (form) options = pickers(c, form, () => current().qty);
}
