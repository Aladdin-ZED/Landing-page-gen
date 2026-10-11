/**
 * Abandoned-lead capture: once the phone is valid, after ~1.2 s without typing (or when the page is
 * hidden / left), POST endpoints.lead once per idempotency key with keepalive. Never after/while ordering.
 */
import type { Ctx } from "./core";
import { getForm } from "./core";
import { MAX, control } from "./fields";
import { keepalivePost } from "./http";
import { normalizePhone } from "./phone";

export function lead(c: Ctx): void {
  const { cfg, st, win } = c;
  const url = cfg.endpoints.lead;
  const form = getForm(c);
  if (c.preview || !url || !form) return;
  let timer = 0;

  const value = (name: "name" | "phone" | "city") => {
    const el = control(form, name);
    return el ? el.value.trim().slice(0, MAX[name]) : "";
  };
  const ready = () => {
    if (!st.idem || st.lead === st.idem || st.sending || st.done) return null;
    return normalizePhone(value("phone"), cfg.phone);
  };
  const send = () => {
    win.clearTimeout(timer);
    const phone = ready();
    if (!phone) return;
    st.lead = st.idem;
    const name = value("name");
    const city = value("city");
    keepalivePost(win, url, {
      pageKey: cfg.pageKey,
      idem: st.idem,
      phone: phone.e164,
      ...(name.length >= 2 ? { name } : {}),
      ...(city ? { city } : {}),
      ...(st.bundleId ? { bundleId: st.bundleId } : {}),
      utm: st.utm,
    });
  };
  const schedule = () => {
    win.clearTimeout(timer);
    if (ready()) timer = win.setTimeout(send, 1200);
  };

  c.on(form, "input", schedule);
  c.on(form, "change", schedule);
  // mobile: backgrounding the browser often ends the page without a pagehide
  c.on(c.doc, "visibilitychange", () => {
    if (c.doc.visibilityState === "hidden") send();
  });
  c.on(win, "pagehide", send);
  c.add(() => win.clearTimeout(timer));
}
