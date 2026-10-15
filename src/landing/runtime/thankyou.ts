/**
 * Thank-you page (config.page === "thanks"):
 *  - fills [data-ty="name|orderId|total|items"] from sessionStorage "lp-order" (only when it matches
 *    ?o=<orderId>); server-rendered fallback text stays when there is nothing to show,
 *  - draws the chosen product options into [data-ty="options"] (like the form's live summary),
 *  - sets <html data-ty-state="filled|partial|empty"> for CSS,
 *  - emits the Purchase pixel event once per orderId,
 *  - runs the one-click upsell ([data-ty-upsell] with [data-ty-upsell-accept|decline], its
 *    [data-countdown] window anchored to the order time, optional [data-ty-upsell-status]).
 */
import type { Ctx } from "./core";
import { $$, closest, disable, setStatus, setText, sget, sset } from "./core";
import { postJson } from "./http";
import { formatMoney } from "./money";
import type { OrderRecord } from "./order-store";
import { ORDER_ID_RE, readOrder, writeOrder } from "./order-store";
import { str } from "./strings";
import { drawSummary } from "./variants";

const fired: Record<string, true> = {};

function purchaseOnce(c: Ctx, rec: OrderRecord): void {
  const key = "lp-px:" + rec.orderId;
  if (fired[key] || sget(c.win, "localStorage", key) || sget(c.win, "sessionStorage", key)) return;
  fired[key] = true;
  if (!sset(c.win, "localStorage", key, "1")) sset(c.win, "sessionStorage", key, "1");
  c.emit("purchase", {
    orderId: rec.orderId,
    value: rec.total,
    currency: rec.currency || c.cfg.currency,
    eventId: rec.eventId,
    qty: rec.qty,
  });
}

function upsell(c: Ctx, rec: OrderRecord | null): void {
  const { cfg, doc, win } = c;
  const box = doc.querySelector<HTMLElement>("[data-ty-upsell]");
  if (!box) return;
  const up = cfg.upsell;
  const url = cfg.endpoints.upsell;
  const windowMs = (up && up.windowMinutes > 0 ? up.windowMinutes : 10) * 60_000;
  const deadline = (rec && rec.ts > 0 ? rec.ts : Date.now()) + windowMs;
  const live = !!(up && url && rec && rec.upsellToken && !rec.upsell && Date.now() < deadline);
  if (!c.preview && !live) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const state = (s: string) => box.setAttribute("data-state", s);
  if (box.getAttribute("data-state") !== "added") state("idle");
  const cd = box.querySelector("[data-countdown]");
  if (cd) cd.setAttribute("data-countdown", new Date(deadline).toISOString());

  const buttons = $$(box, "[data-ty-upsell-accept],[data-ty-upsell-decline]");
  const busy = (on: boolean) => {
    for (const b of buttons) disable(b, on);
  };
  const statusEl = box.querySelector("[data-ty-upsell-status]") || box.querySelector("[data-lp-status]");
  const status = (text: string, tone: "error" | "success" | "") => setStatus(statusEl, text, tone);
  const persist = (patch: Partial<OrderRecord>) => {
    if (rec && !c.preview) writeOrder(win, Object.assign(rec, patch));
  };
  const added = (total: number) => {
    state("added");
    busy(true);
    status(str(cfg, "thanks.upsellAdded"), "success");
    if (total > 0) for (const el of $$(doc, '[data-ty="total"]')) setText(el, formatMoney(total, cfg.money));
    persist({ upsell: "added", total: total > 0 ? total : rec ? rec.total : 0 });
  };

  c.on(box, "click", (e) => {
    const accept = closest(e.target, "[data-ty-upsell-accept]");
    const decline = closest(e.target, "[data-ty-upsell-decline]");
    if (!accept && !decline) return;
    e.preventDefault();
    const s = box.getAttribute("data-state");
    if (s === "sending" || s === "added") return;
    if (decline) {
      state("declined");
      box.hidden = true;
      persist({ upsell: "declined" });
      return;
    }
    if (c.preview || !rec || !rec.upsellToken || !url || !up) {
      added(0);
      return;
    }
    const price = up.price;
    state("sending");
    busy(true);
    status("", "");
    postJson<{ ok?: boolean; total?: number }>(win, url, { orderId: rec.orderId, token: rec.upsellToken }, 15_000, 1).then(
      (res) => {
        const d = res.data;
        if (d && d.ok === true) added(typeof d.total === "number" && isFinite(d.total) ? d.total : rec.total + price);
        else {
          state("error");
          busy(false);
          status(str(cfg, "form.errGeneric"), "error");
        }
      },
      () => {
        state("error");
        busy(false);
        status(str(cfg, "form.errNetwork"), "error");
      },
    );
  });
}

export function thankyou(c: Ctx): void {
  if (c.cfg.page !== "thanks") return;
  const { cfg, doc, win } = c;
  let urlId = "";
  try {
    const o = new URLSearchParams(win.location.search).get("o") || "";
    if (ORDER_ID_RE.test(o)) urlId = o;
  } catch {
    /* malformed URL */
  }
  const stored = readOrder(win);
  const rec = stored && (!urlId || stored.orderId === urlId) ? stored : null;
  doc.documentElement.setAttribute("data-ty-state", rec ? "filled" : urlId ? "partial" : "empty");

  const values = new Map<string, string>([
    ["name", rec ? rec.name : ""],
    ["orderId", rec ? rec.orderId : urlId],
    ["total", rec && rec.total > 0 ? formatMoney(rec.total, cfg.money) : ""],
    ["items", rec ? rec.items || rec.bundleLabel : ""],
  ]);
  for (const el of $$(doc, "[data-ty]")) {
    const v = values.get(el.getAttribute("data-ty") || "");
    if (v) setText(el, v);
  }
  if (rec && rec.options) for (const el of $$(doc, '[data-ty="options"]')) drawSummary(doc, el, rec.options);

  if (rec && !c.preview) purchaseOnce(c, rec);
  upsell(c, rec);
}
