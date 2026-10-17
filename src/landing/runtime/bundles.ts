/**
 * Offer selection + everything priced from it (docs/OFFERS.md §C.3, §F.4):
 *  - `data-selected` on every [data-bundle-card="<id>"] (form picker and offer sections), the form's
 *    input[name=bundle] radios (unavailable offers — data-soldout — are never selected),
 *  - [data-lp-sum=price|deltas|subtotal|bump|shipping|total] from computeTotals(cfg, st.sel()),
 *  - the surcharge reasons (up to 3: "XL +20 DH", "Gravure ×2 +60 DH", then "Autres options +n DH" —
 *    its words in data-other): inside [data-lp-sum-reasons] (a <dd>: one span.lp-sum__reason per
 *    line); a hidden marker gets summary rows after it instead, cloned from template[data-lp-reason-tpl]
 *    ([data-lp-reason-label], [data-lp-reason-amount]) or <div class="lp-sum__row lp-sum__row--reason">,
 *  - [data-lp-price="current"] (the live total, = the submit button) and [data-lp-price="offer"]
 *    (offer price + surcharges, before bump and delivery).
 * Other modules request a change with emit("select", id); the applied result is emitted as "bundle".
 * The shopper's offer is remembered for the tab (sessionStorage "lp-b:<pageKey>").
 */
import type { Content, Ctx, PixelOrder } from "./core";
import { $$, flag, getForm, setText, sget, sset } from "./core";
import type { Totals } from "./money";
import { allocate, computeTotals, emptySel, fmtCents, itemOf, offerOf } from "./money";
import { str } from "./strings";

export const money = (c: Ctx, cents: number): string => fmtCents(cents, c.cfg.money);

/** The totals of the current selection. */
export const totalsOf = (c: Ctx): Totals | null => computeTotals(c.cfg, c.st.sel());

/** Refresh the order summary lines from the current selection. */
export function renderSums(c: Ctx): void {
  const t = totalsOf(c);
  if (!t) return;
  const { doc } = c;
  for (const el of $$(doc, "[data-lp-sum]")) {
    const k = el.getAttribute("data-lp-sum");
    const v =
      k === "subtotal" ? t.subtotal : k === "bump" ? t.bump : k === "shipping" ? t.shipping : k === "total" ? t.total : k === "price" ? t.price : k === "deltas" ? t.deltas : null;
    if (v === null) continue;
    setText(el, k === "shipping" && v === 0 ? str(c.cfg, "form.free") || money(c, 0) : money(c, v));
    flag(el, "data-zero", v === 0);
  }
  for (const el of $$(doc, "[data-lp-price]")) {
    const k = el.getAttribute("data-lp-price");
    if (k === "current" || k === "offer") setText(el, money(c, k === "current" ? t.total : t.price + t.deltas));
  }
  for (const mark of $$(doc, "[data-lp-sum-reasons]")) reasons(c, mark, t);
}

function reasons(c: Ctx, mark: Element, t: Totals): void {
  const { doc } = c;
  const parent = mark.parentNode;
  if (!parent) return;
  const rows: { label: string; cents: number }[] = t.reasons.slice(0, 3).map((r) => ({ label: r.count > 1 ? r.label + " ×" + r.count : r.label, cents: r.cents }));
  const rest = t.reasons.slice(3).reduce((n, r) => n + r.cents, 0);
  if (rest > 0) rows.push({ label: mark.getAttribute("data-other") || "+", cents: rest });
  const key = JSON.stringify(rows);
  if (mark.getAttribute("data-text") === key) return;
  mark.setAttribute("data-text", key);
  if (!(mark as HTMLElement).hidden) {
    // a cell of the summary (<dd data-lp-sum-reasons>): one line per reason inside it
    while (mark.firstChild) mark.removeChild(mark.firstChild);
    for (const r of rows) {
      const line = mark.appendChild(doc.createElement("span"));
      line.className = "lp-sum__reason";
      line.appendChild(doc.createElement("span")).textContent = r.label;
      line.appendChild(doc.createTextNode(" "));
      line.appendChild(doc.createElement("bdi")).textContent = "+" + money(c, r.cents);
    }
    return;
  }
  for (const el of $$(parent as Element, ":scope > [data-lp-reason]")) parent.removeChild(el);
  const tpl = doc.querySelector<HTMLTemplateElement>("template[data-lp-reason-tpl]");
  let at: Node | null = mark.nextSibling;
  for (const r of rows) {
    let row: Element;
    const src = tpl && tpl.content && tpl.content.firstElementChild;
    if (src) row = doc.importNode(src, true) as Element;
    else {
      row = doc.createElement("div");
      row.className = "lp-sum__row lp-sum__row--reason";
      row.appendChild(doc.createElement("dt")).setAttribute("data-lp-reason-label", "");
      row.appendChild(doc.createElement("dd")).appendChild(doc.createElement("bdi")).setAttribute("data-lp-reason-amount", "");
    }
    row.setAttribute("data-lp-reason", "");
    const l = row.querySelector("[data-lp-reason-label]");
    const a = row.querySelector("[data-lp-reason-amount]");
    if (l) l.textContent = r.label;
    if (a) a.textContent = "+" + money(c, r.cents);
    parent.insertBefore(row, at);
    at = row.nextSibling;
  }
}

/**
 * The selection (or another offer, nothing chosen) as pixel events see it: contents per content id
 * with the allocated unit prices, the bump as its own line (§G.7).
 */
export function pixelOrder(c: Ctx, offerId?: string): PixelOrder | null {
  const { cfg, st } = c;
  const sel = offerId && offerId !== st.bundleId ? emptySel(offerId) : st.sel();
  const t = computeTotals(cfg, sel);
  if (!t) return null;
  const alloc = allocate(cfg, sel, t.perUnit);
  const by: Record<string, Content> = {};
  const list: Content[] = [];
  const add = (id: string, p: number) => {
    const x = by[id] || (by[id] = list[list.push({ id, q: 0, p: 0 }) - 1]!);
    x.q++;
    x.p += p;
  };
  t.offer.units.forEach((s, k) => {
    const it = itemOf(cfg, s.item || (sel.units[k] && sel.units[k]!.item) || (s.available || s.choices || [])[0]);
    add(it ? it.contentId : cfg.product.contentId, alloc[k] || 0);
  });
  if (t.bump) {
    const it = cfg.bump && cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
    add(it ? it.contentId : cfg.product.contentId + ".bump", t.bump);
  }
  for (const x of list) x.p = Math.round(x.p / x.q);
  return { subtotal: t.subtotal, total: t.total, units: t.units + (t.bump ? 1 : 0), contents: list, name: cfg.items.length > 1 ? t.offer.label : cfg.product.name };
}

export function bundles(c: Ctx): void {
  c.st.px = (id) => pixelOrder(c, id);
  const { cfg, st } = c;
  const list = cfg.bundles || [];
  if (!list.length) return;
  const form = getForm(c);
  const radios = form ? $$<HTMLInputElement>(form, 'input[name="bundle"]') : [];
  const valid = (id: string | null | undefined): id is string => {
    const o = id ? offerOf(cfg, id) : undefined;
    return !!o && !o.soldOut;
  };

  const storeKey = "lp-b:" + cfg.pageKey;
  if (!valid(st.bundleId)) {
    const saved = c.preview ? null : sget(c.win, "sessionStorage", storeKey);
    const checked = radios.find((r) => r.checked);
    st.bundleId = valid(saved) ? saved : checked && valid(checked.value) ? checked.value : valid(cfg.defaultBundleId) ? cfg.defaultBundleId : (list.find((b) => !b.soldOut) || list[0]!).id;
  }

  const apply = () => {
    const id = st.bundleId;
    for (const r of radios) if (r.checked !== (r.value === id)) r.checked = r.value === id;
    for (const card of $$(c.doc, "[data-bundle-card]")) flag(card, "data-selected", card.getAttribute("data-bundle-card") === id);
    renderSums(c);
  };

  c.sub("select", (id) => {
    if (!valid(id) || id === st.bundleId) return;
    st.bundleId = id;
    if (!c.preview) sset(c.win, "sessionStorage", storeKey, id);
    apply();
    c.emit("bundle", { id, user: true });
  });
  c.sub("units", () => renderSums(c));

  if (form)
    c.on(form, "change", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.name === "bundle" && t.checked) {
        if (valid(t.value)) c.emit("select", t.value);
        else apply();
      }
    });

  apply();
}
