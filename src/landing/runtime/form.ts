/**
 * The order form (form#order-form[data-lp-form]): first-interaction bookkeeping (idempotency key,
 * event id, timer), inline validation, optional Cloudflare Turnstile token (./turnstile), JSON
 * submit with timeout + one retry, server error mapping (delivery fields, and each product option
 * group by its control name "v.<unit>.<groupId>"), hand-off to the thank-you page.
 * Preview mode validates but never sends.
 */
import type { OrderPayload, OrderResponse } from "../../lib/orders/contract";
import type { Ctl, Ctx } from "./core";
import { $$, getForm, report, setStatus, setText } from "./core";
import type { FieldName } from "./fields";
import { FIELDS, MAX, byDomOrder, control, fieldError, showError, validateForm } from "./fields";
import type { HttpResult } from "./http";
import { postJson } from "./http";
import { uuid } from "./ids";
import type { Totals } from "./money";
import { computeTotals } from "./money";
import { ORDER_ID_RE, writeOrder } from "./order-store";
import { normalizePhone } from "./phone";
import { focusInView, focusQuiet, headerOffset, scrollToEl } from "./scroll";
import { CAPTCHA_STRING, captcha } from "./turnstile";
import type { RuntimeStringKey } from "./strings";
import { str } from "./strings";
import { adIds } from "./tracking";
import { ROW, currentSummary, readVariants, variantMessage } from "./variants";

/** Server field errors → localized messages (server text is never shown). */
const SERVER_FIELD: Record<string, RuntimeStringKey> = {
  name: "form.errName",
  phone: "form.errPhone",
  city: "form.errCity",
  address: "form.errRequired",
  email: "form.errEmail",
};

const isField = (n: string): n is FieldName => (FIELDS as readonly string[]).indexOf(n) >= 0;
/** Server error key of a product option group (= its control name). */
const OPTION_KEY = /^v\.(?:\d{1,2}\.)?[A-Za-z0-9_-]{1,40}$/;

/** Longest wait for a Turnstile token once the shopper submits (non-interactive checks take 1–5 s). */
const CAPTCHA_WAIT_MS = 12_000;

export function form(c: Ctx): void {
  const f = getForm(c);
  if (!f) return;
  const { cfg, st, win } = c;
  const btn = f.querySelector<HTMLButtonElement>("[data-lp-submit]") || f.querySelector<HTMLButtonElement>("[type=submit]");
  const label = btn ? btn.querySelector("[data-lp-submit-label]") || (btn.children.length ? null : btn) : null;
  const statusEl = f.querySelector("[data-lp-status]");
  let savedLabel: string | null = null;
  const cap = captcha(c, f);

  f.noValidate = true;
  const setState = (s: "idle" | "sending" | "error" | "done") => f.setAttribute("data-state", s);
  if (!st.sending && !st.done) setState("idle");

  const lock = (on: boolean) => {
    if (btn) btn.disabled = on;
    f.setAttribute("aria-busy", on ? "true" : "false");
  };
  const sendingLabel = (on: boolean) => {
    if (!label) return;
    if (on) {
      const s = str(cfg, "form.submitting");
      if (!s) return;
      savedLabel = label.textContent;
      setText(label, s);
    } else if (savedLabel !== null) {
      setText(label, savedLabel);
      savedLabel = null;
    }
  };

  const start = () => {
    if (cap) cap.prime();
    if (st.t0) return;
    st.t0 = Date.now();
    st.idem = uuid(win.crypto);
    st.eventId = uuid(win.crypto);
    c.emit("start", null);
  };

  const recheck = (el: Ctl, onBlur: boolean) => {
    if (isField(el.name)) {
      if (onBlur ? el.value.trim() !== "" : el.getAttribute("aria-invalid") === "true") {
        const k = fieldError(c, el.name, el);
        showError(el, k ? str(cfg, k) : "");
      }
    } else if (el.type === "radio") {
      // an option group's error stays until one of its options is actually chosen (not on blur)
      if ((el as HTMLInputElement).checked)
        for (const r of $$<Ctl>(f, "input[type=radio][aria-invalid]")) if (r.name === el.name) showError(r, "");
    } else if (el.getAttribute("aria-invalid") === "true" && el.value) showError(el, "");
  };

  c.on(f, "focusin", start);
  // a tap on a bundle card or the submit button counts as the first interaction too (Turnstile warm-up)
  if (cap) c.on(f, "pointerdown", () => cap.prime(), { passive: true });
  c.on(f, "input", (e) => {
    start();
    recheck(e.target as Ctl, false);
  });
  c.on(f, "change", (e) => {
    start();
    recheck(e.target as Ctl, false);
  });
  c.on(f, "focusout", (e) => {
    const el = e.target as Ctl;
    if (el && typeof el.name === "string") recheck(el, true);
  });

  const fail = (msg: string) => {
    setState("error");
    lock(false);
    sendingLabel(false);
    setStatus(statusEl, msg, msg ? "error" : "");
  };

  /**
   * Bring a control to the shopper: an option picker scrolls its whole group (name and choices) below
   * any sticky header before its first choice takes the focus; other fields scroll themselves. A
   * piece's group brings its piece's row from the "Piece n" head (the shopper sees which piece, and
   * its other choices) when the row fits on screen down to that group.
   */
  const reveal = (el: Ctl) => {
    const group = el.type === "radio" ? el.closest("fieldset") : null;
    if (!group) {
      focusInView(c, el);
      return;
    }
    const top = headerOffset(c);
    const h = win.innerHeight;
    const g = group.getBoundingClientRect();
    let box = group.closest("[" + ROW + "]") || group;
    if (g.bottom - box.getBoundingClientRect().top > h - top - 16) box = group;
    if (box.getBoundingClientRect().top >= top && g.bottom <= h) focusQuiet(el);
    else scrollToEl(c, box, () => focusQuiet(el), 16);
  };

  /**
   * A product option refused by the server: "unavailable" = sold out since the page was opened (the
   * choice is cleared and struck out, so it cannot be sent again); "invalid" = unknown (cleared).
   */
  const markOption = (name: string, code: string): Ctl | null => {
    const group = $$<Ctl>(f, "input[name^='v.'],select[name^='v.']").filter((x) => x.name === name);
    if (!group.length) return null;
    if (code !== "required")
      for (const el of group) {
        if (el.type !== "radio" || !(el as HTMLInputElement).checked) continue;
        (el as HTMLInputElement).checked = false;
        if (code === "unavailable") {
          el.disabled = true;
          const opt = el.closest("label");
          const face = opt && opt.querySelector(".lp-vo__face");
          if (opt) opt.setAttribute("data-soldout", "");
          if (face && !face.querySelector(".lp-vo__x")) face.appendChild(c.doc.createElement("span")).className = "lp-vo__x";
        }
      }
    const first = group.find((x) => !x.disabled) || group[0]!;
    showError(first, variantMessage(first, code, str(cfg, "form.errRequired")));
    // the pickers redraw (chosen name, summary, photo) without the cleared choice
    f.dispatchEvent(new (win as Window & typeof globalThis).Event("lp-options"));
    return first;
  };

  const value = (n: FieldName) => {
    const el = control(f, n);
    return el && !el.disabled ? el.value.trim().slice(0, MAX[n]) : "";
  };

  const buildPayload = (qty: number): OrderPayload | null => {
    const phone = normalizePhone(value("phone"), cfg.phone);
    if (!phone) return null;
    const hp = control(f, "website");
    const p: OrderPayload = {
      pageKey: cfg.pageKey,
      idem: st.idem,
      eventId: st.eventId,
      bundleId: st.bundleId,
      variants: readVariants(f, qty),
      bump: st.bump && !!cfg.bump,
      name: value("name"),
      phone: phone.e164,
      website: hp ? hp.value.slice(0, 200) : "",
      t: Math.min(86_400_000, Math.max(0, Math.round(Date.now() - st.t0))),
      utm: st.utm as OrderPayload["utm"],
      ref: win.location.href.slice(0, 500),
      locale: String(cfg.locale || "").slice(0, 5),
      ...adIds(c),
    };
    for (const k of ["city", "address", "note", "email"] as const) {
      const v = value(k);
      if (v) p[k] = v;
    }
    return p;
  };

  /** `p` / `t` are what was actually sent (the shopper may touch the picker while the request runs). */
  const success = (r: Extract<OrderResponse, { ok: true }>, p: OrderPayload, t: Totals) => {
    writeOrder(win, {
      orderId: r.orderId,
      name: p.name,
      total: typeof r.total === "number" && isFinite(r.total) ? r.total : t.total,
      currency: typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency) ? r.currency : cfg.currency,
      bundleLabel: t.label,
      items: t.label + (p.bump && cfg.bump ? " + " + cfg.bump.title : ""),
      options: currentSummary(c, f, t.qty),
      qty: t.qty,
      upsellToken: r.upsellToken,
      eventId: p.eventId,
      ts: Date.now(),
      pageKey: cfg.pageKey,
    });
    st.done = true;
    setState("done");
    const u = cfg.thankYouUrl || "";
    if (u && !/^\s*(javascript|data|vbscript):/i.test(u))
      win.location.assign(u + (u.indexOf("?") < 0 ? "?" : "&") + "o=" + encodeURIComponent(r.orderId));
  };

  const submit = async () => {
    start();
    if (st.sending || st.done) return;
    const bad = validateForm(c, f, true);
    if (bad.length) {
      setStatus(statusEl, "", "");
      reveal(bad[0]!);
      return;
    }
    if (c.preview) {
      setStatus(statusEl, str(cfg, "form.previewNotice"), "info");
      return;
    }
    const totals = computeTotals(cfg, st.bundleId, st.bump);
    const payload = totals ? buildPayload(totals.qty) : null;
    if (!totals || !payload) {
      fail(str(cfg, "form.errGeneric"));
      return;
    }

    st.sending = true;
    setState("sending");
    lock(true);
    sendingLabel(true);
    setStatus(statusEl, "", "");
    if (cap) {
      const cf = await cap.token(CAPTCHA_WAIT_MS);
      if (cf) payload.cf = cf;
      else if (cap.needsInteraction()) {
        // Cloudflare wants a click: point at the widget; the next submit uses its token
        st.sending = false;
        const msg = cfg.strings[CAPTCHA_STRING];
        fail(typeof msg === "string" && msg ? msg : "Please complete the verification above, then confirm again.");
        const box = cap.element();
        if (box) box.scrollIntoView({ block: "center", behavior: c.reduced ? "auto" : "smooth" });
        return;
      }
      // no token (script blocked, timeout): still send — the server decides whether it is required
    }
    let res: HttpResult<OrderResponse> | null = null;
    try {
      res = await postJson<OrderResponse>(win, cfg.endpoints.order, payload, 15_000, 1);
    } catch {
      res = null;
    }
    st.sending = false;

    const r = res ? res.data : null;
    if (r && r.ok === true && typeof r.orderId === "string" && ORDER_ID_RE.test(r.orderId)) {
      success(r, payload, totals);
      return;
    }
    // Turnstile tokens are single-use: whatever happened server side, the next attempt needs a new one
    if (cap && payload.cf) cap.consume();
    if (!res) {
      fail(str(cfg, "form.errNetwork"));
      return;
    }
    if (r && r.ok === false) {
      if (r.error === "duplicate") {
        st.done = true;
        setState("done");
        sendingLabel(false);
        lock(true);
        setStatus(statusEl, str(cfg, "form.errDuplicate"), "info");
        return;
      }
      if (r.error === "invalid" && r.fields) {
        const marked: Ctl[] = [];
        for (const k of Object.keys(r.fields)) {
          // known field names only: a response key like "constructor" must never reach the selector
          if (OPTION_KEY.test(k)) {
            const el = markOption(k, String(r.fields[k as keyof typeof r.fields] || ""));
            if (el) marked.push(el);
            continue;
          }
          const key = isField(k) ? SERVER_FIELD[k] : undefined;
          const el = key ? control(f, k) : null;
          if (!el || !key) continue;
          showError(el, str(cfg, key));
          marked.push(el);
        }
        if (marked.length) {
          fail("");
          reveal(marked.sort(byDomOrder)[0]!);
          return;
        }
      }
    }
    fail(str(cfg, "form.errGeneric"));
  };

  c.on(f, "submit", (e) => {
    e.preventDefault();
    submit().catch((err: unknown) => {
      st.sending = false;
      fail(str(cfg, "form.errGeneric"));
      report(win, err);
    });
  });

  // Back/forward cache: the page comes back exactly as it was left (button locked, state "done").
  c.on(win, "pageshow", (e) => {
    if (!(e as PageTransitionEvent).persisted || !st.done) return;
    st.done = st.sending = false;
    st.t0 = 0;
    st.idem = st.eventId = "";
    if (cap) cap.consume();
    lock(false);
    sendingLabel(false);
    setState("idle");
    setStatus(statusEl, "", "");
  });
}
