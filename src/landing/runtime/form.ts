/**
 * The order form (form#order-form[data-lp-form]): first-interaction bookkeeping (idempotency key,
 * event id, timer), inline validation, optional Cloudflare Turnstile token (chunk "turnstile"), JSON
 * submit with timeout + one retry, hand-off to the thank-you page. Preview mode validates but never
 * sends.
 *
 * Payload v2 (docs/OFFERS.md §G.1): { v: 2, ver (the publish version shown), st (the total shown,
 * cents), units: [{ item? (choice units), o: { gid: option id | cell key }, f: { gid: text } }],
 * extras, b (the bump item's values) } + the delivery fields. Shared groups ride in every unit of
 * their item; locked values are sent too (the server fills them anyway).
 *
 * Server answers (§G.2, §J.2): field errors on the delivery fields, `bundleId`, `u.<k>.@item`,
 * `u.<k>.<gid>`, `s.<item>.<gid>`, `x.<gid>`, `b.<gid>` (each group's own words, data-msg*; a value
 * gone since the page opened is struck and cleared); "stale" = the page was replaced: the form and the
 * selection are kept for the tab, the page reloads once (guard sessionStorage "lp-stale:<pageKey>")
 * and comes back with [data-lp-stale] shown above the summary.
 *
 * Export bridges (WhatsApp: entry-whatsapp.ts) get the attempt on the document as CustomEvent
 * "lp:order" (detail: OrderHandoff — the idempotency key, the total shown, the selection) just before
 * the request: they format the runtime's own numbers and text, never price.
 */
import type { OrderPayloadV2, OrderResponse } from "../../lib/orders/contract";
import type { Ctl, Ctx } from "./core";
import { $$, getForm, hide, report, sdel, setStatus, setText, sjson, sset } from "./core";
import { totalsOf } from "./bundles";
import type { FieldName } from "./fields";
import { FIELDS, MAX, byDomOrder, control, fieldError, showError, validateForm } from "./fields";
import type { HttpResult } from "./http";
import { postJson } from "./http";
import { uuid } from "./ids";
import type { Sel, Totals } from "./money";
import { allocate, inScope, itemOf, optOf } from "./money";
import type { OrderGroup } from "./order-store";
import { ORDER_ID_RE, writeOrder } from "./order-store";
import { normalizePhone } from "./phone";
import { focusInView, focusQuiet, headerOffset, scrollToEl } from "./scroll";
import type { RuntimeStringKey } from "./strings";
import { CAPTCHA_STRING, str } from "./strings";
import { adIds } from "./tracking";
import type { Captcha } from "./turnstile";
import { groupMessage, unitsApi } from "./units";

/** Server field errors → localized messages (server text is never shown). */
const SERVER_FIELD: Record<string, RuntimeStringKey> = {
  name: "form.errName",
  phone: "form.errPhone",
  city: "form.errCity",
  address: "form.errRequired",
  email: "form.errEmail",
};

const isField = (n: string): n is FieldName => (FIELDS as readonly string[]).indexOf(n) >= 0;
/** Server error key of a unit / shared group / extra / bump group (= its control name). */
const UNIT_KEY = /^(?:u\.\d{1,2}\.(?:@item|[A-Za-z0-9_-]{2,40})|s\.[a-z0-9][a-z0-9-]{1,23}\.[A-Za-z0-9_-]{2,40}|x\.[A-Za-z0-9_-]{2,40}|b\.[A-Za-z0-9_-]{2,40})$/;
const VER = /^[A-Za-z0-9]{26}$/;

/** Longest wait for a Turnstile token once the shopper submits (non-interactive checks take 1–5 s). */
const CAPTCHA_WAIT_MS = 12_000;
/** A second "stale" within this time does not reload again. */
const STALE_GUARD_MS = 60_000;

/** What an export bridge gets ("lp:order"): the attempt's key, the total shown (cents), the selection. */
export interface OrderHandoff {
  idem: string;
  total: number;
  sel: Sel;
}

interface Stale {
  ts: number;
  f?: Partial<Record<FieldName, string>>;
}

export function form(c: Ctx): void {
  const f = getForm(c);
  if (!f) return;
  const { cfg, st, win } = c;
  const btn = f.querySelector<HTMLButtonElement>("[data-lp-submit]") || f.querySelector<HTMLButtonElement>("[type=submit]");
  const label = btn ? btn.querySelector("[data-lp-submit-label]") || (btn.children.length ? null : btn) : null;
  const statusEl = f.querySelector("[data-lp-status]");
  let savedLabel: string | null = null;
  const capMake = c.fx.turnstile as unknown as ((c: Ctx, f: HTMLFormElement) => Captcha | null) | undefined;
  const cap = capMake ? capMake(c, f) : null;
  const staleKey = "lp-stale:" + cfg.pageKey;

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

  /** "L'offre a été mise à jour, vérifiez votre choix": its text (data-msg) and its hidden summary row shown */
  function showStale() {
    for (const el of $$(c.doc, "[data-lp-stale]")) {
      if (!el.textContent) setText(el, el.getAttribute("data-msg") || "");
      hide(el, false);
      if (el.parentElement && el.parentElement.hidden) hide(el.parentElement, false);
    }
  }

  /* ---------------- back from a stale reload: the form as the shopper left it ---------------- */
  const stale = c.preview ? null : sjson<Stale>(win, "sessionStorage", staleKey);
  if (stale && typeof stale.ts === "number") {
    if (Date.now() - stale.ts > 600_000) sdel(win, "sessionStorage", staleKey);
    else if (stale.f && typeof stale.f === "object") {
      for (const n of FIELDS) {
        const el = control(f, n);
        const v = stale.f[n];
        if (el && typeof v === "string" && !el.value) el.value = v.slice(0, MAX[n]);
      }
      showStale();
      sset(win, "sessionStorage", staleKey, JSON.stringify({ ts: stale.ts }));
    }
  }

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
      // a group's error stays until one of its options is actually chosen (not on blur)
      if ((el as HTMLInputElement).checked) {
        const wrap = el.closest("[data-field]");
        for (const r of $$<Ctl>(wrap || f, "[aria-invalid]")) if (r.name === el.name || wrap) showError(r, "");
      }
    } else if (el.getAttribute("aria-invalid") === "true" && el.value) showError(el, "");
  };

  c.on(f, "focusin", start);
  // a tap on an offer card or the submit button counts as the first interaction too (Turnstile warm-up)
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
   * Bring a control to the shopper: its unit opens (steps, box, collapsed); a group scrolls whole
   * (name and choices) below any sticky header before its first choice takes the focus — from the
   * unit's head when the unit fits on screen down to that group; other fields scroll themselves.
   */
  const reveal = (el: Ctl) => {
    const api = unitsApi(c.doc);
    if (api) api.reveal(el);
    const group = el.closest("[data-field]") || (el.type === "radio" ? el.closest("fieldset") : null);
    if (!group || isField(el.name)) {
      focusInView(c, el);
      return;
    }
    const top = headerOffset(c);
    const h = win.innerHeight;
    const g = group.getBoundingClientRect();
    let box = group.closest("[data-lp-unit]") || group;
    if (g.bottom - box.getBoundingClientRect().top > h - top - 16) box = group;
    if (box.getBoundingClientRect().top >= top && g.bottom <= h) focusQuiet(el);
    else scrollToEl(c, box, () => focusQuiet(el), 16);
  };

  const value = (n: FieldName) => {
    const el = control(f, n);
    return el && !el.disabled ? el.value.trim().slice(0, MAX[n]) : "";
  };

  const buildPayload = (t: Totals): OrderPayloadV2 | null => {
    const phone = normalizePhone(value("phone"), cfg.phone);
    if (!phone) return null;
    const sel = st.sel();
    const hp = control(f, "website");
    const p: OrderPayloadV2 = {
      v: 2,
      ...(VER.test(cfg.ver || "") ? { ver: cfg.ver } : {}),
      st: t.total,
      pageKey: cfg.pageKey,
      idem: st.idem,
      eventId: st.eventId,
      bundleId: t.offer.id,
      units: sel.units.slice(0, 20).map((u, k) => ({ ...(t.offer.units[k] && !t.offer.units[k]!.item && u.item ? { item: u.item } : {}), o: u.options, f: u.fields })),
      extras: sel.extras,
      ...(sel.bump && sel.bumpUnit ? { b: { o: sel.bumpUnit.options, f: sel.bumpUnit.fields } } : {}),
      bump: sel.bump,
      name: value("name"),
      phone: phone.e164,
      website: hp ? hp.value.slice(0, 200) : "",
      t: Math.min(86_400_000, Math.max(0, Math.round(Date.now() - st.t0))),
      utm: st.utm as OrderPayloadV2["utm"],
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

  /** the stored order lines: the summary groups + the gift + the bump, each with its allocated unit price,
   *  then the page extras chosen (the thank-you page lists them with their surcharge) */
  const groupsOf = (t: Totals): OrderGroup[] => {
    const api = unitsApi(c.doc);
    const sel = st.sel();
    const alloc = allocate(cfg, sel, t.perUnit);
    const out: OrderGroup[] = (api ? api.parts() : []).map((p) => {
      const g: OrderGroup = { n: p.n, parts: p.parts.slice(0, 4), cid: p.cid, p: Math.round(p.ks.reduce((n, k) => n + (alloc[k] || 0), 0) / p.n) };
      if (p.item) g.item = p.item;
      if (p.fields) g.fields = p.fields;
      if (p.free) g.free = true;
      return g;
    });
    if (t.offer.gift) out.push({ n: 1, item: t.offer.gift, parts: [], k: "gift", cid: "" });
    if (t.bump && cfg.bump) {
      const it = cfg.bump.item ? itemOf(cfg, cfg.bump.item) : undefined;
      out.push({ n: 1, item: it ? it.name : (cfg.bump as { title?: string }).title || "", parts: [], k: "bump", cid: it ? it.contentId : cfg.product.contentId + ".bump", p: t.bump });
    }
    for (const x of cfg.extras || []) {
      const v = sel.extras[x.id];
      if (!v || !inScope(x.scope, sel.offerId)) continue;
      const g: OrderGroup = { n: 1, parts: [], k: "extra", cid: "" };
      if (x.kind === "field") {
        g.fields = [{ name: x.name, value: v }];
        if (x.delta) g.p = x.delta;
      } else if (x.kind !== "matrix") {
        const o = optOf(x.options, v);
        if (!o) continue;
        g.parts = [{ label: o.label }];
        // "Emballage cadeau" says it already; "Taille du colis · Grand" needs the group's name
        if (o.label.toLowerCase().indexOf(x.name.toLowerCase()) < 0) g.item = x.name;
        if (o.delta) g.p = o.delta;
      } else continue;
      out.push(g);
    }
    return out.slice(0, 22);
  };

  const bumpTitle = () => {
    const b = cfg.bump as (typeof cfg.bump & { title?: string }) | undefined;
    const it = b && b.item ? itemOf(cfg, b.item) : undefined;
    return (b && b.title) || (it ? it.name : "");
  };

  /** `p` / `t` are what was actually sent (the shopper may touch the picker while the request runs). */
  const success = (r: Extract<OrderResponse, { ok: true }>, p: OrderPayloadV2, t: Totals, groups: OrderGroup[]) => {
    writeOrder(win, {
      orderId: r.orderId,
      name: p.name,
      total: typeof r.total === "number" && isFinite(r.total) ? r.total : t.total / 100,
      currency: typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency) ? r.currency : cfg.currency,
      bundleLabel: t.offer.label,
      items: t.offer.label + (t.bump && bumpTitle() ? " + " + bumpTitle() : ""),
      qty: t.units + (t.bump ? 1 : 0),
      groups,
      upsellToken: r.upsellToken,
      eventId: p.eventId,
      ts: Date.now(),
      pageKey: cfg.pageKey,
    });
    const api = unitsApi(c.doc);
    if (api && !c.preview) api.forget();
    sdel(win, "sessionStorage", staleKey);
    sdel(win, "sessionStorage", "lp-b:" + cfg.pageKey);
    st.done = true;
    setState("done");
    const u = cfg.thankYouUrl || "";
    if (u && !/^\s*(javascript|data|vbscript):/i.test(u))
      win.location.assign(u + (u.indexOf("?") < 0 ? "?" : "&") + "o=" + encodeURIComponent(r.orderId));
  };

  /** "stale": keep the form for the tab and reload once (the selection is already in lp-u / lp-b). */
  const reload = (): boolean => {
    const prev = sjson<Stale>(win, "sessionStorage", staleKey);
    if (prev && typeof prev.ts === "number" && Date.now() - prev.ts < STALE_GUARD_MS) return false;
    const keep: Partial<Record<FieldName, string>> = {};
    for (const n of FIELDS) {
      const v = value(n);
      if (v) keep[n] = v;
    }
    if (!sset(win, "sessionStorage", staleKey, JSON.stringify({ ts: Date.now(), f: keep }))) return false;
    st.done = true;
    win.location.reload();
    return true;
  };

  const handoff = (p: OrderPayloadV2, t: Totals) => {
    try {
      const detail: OrderHandoff = { idem: p.idem, total: t.total, sel: st.sel() };
      c.doc.dispatchEvent(new win.CustomEvent("lp:order", { detail }));
    } catch (e) {
      report(win, e);
    }
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
    const totals = totalsOf(c);
    const payload = totals ? buildPayload(totals) : null;
    if (!totals || !payload) {
      fail(str(cfg, "form.errGeneric"));
      return;
    }
    const groups = groupsOf(totals);

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
    handoff(payload, totals);
    let res: HttpResult<OrderResponse> | null = null;
    try {
      res = await postJson<OrderResponse>(win, cfg.endpoints.order, payload, 15_000, 1);
    } catch {
      res = null;
    }
    st.sending = false;

    const r = res ? res.data : null;
    if (r && r.ok === true && typeof r.orderId === "string" && ORDER_ID_RE.test(r.orderId)) {
      success(r, payload, totals, groups);
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
      if (r.error === "stale") {
        if (reload()) return;
        showStale();
        fail(str(cfg, "form.errGeneric"));
        return;
      }
      if (r.error === "invalid" && r.fields) {
        const marked: Ctl[] = [];
        const api = unitsApi(c.doc);
        for (const k of Object.keys(r.fields)) {
          const code = String(r.fields[k as keyof typeof r.fields] || "");
          // known keys only: a response key like "constructor" must never reach a selector
          if (UNIT_KEY.test(k) && api) {
            const el = api.mark(k, code);
            if (el) {
              showError(el, groupMessage(el, code, str(cfg, "form.errRequired")));
              marked.push(el);
            }
            continue;
          }
          if (k === "bundleId") {
            const picker = c.doc.querySelector("[data-lp-bundles]");
            const msg = (picker && picker.getAttribute(code === "unavailable" ? "data-msg-gone" : "data-msg")) || str(cfg, "form.errGeneric");
            fail(msg);
            if (picker) focusInView(c, picker as HTMLElement);
            return;
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
