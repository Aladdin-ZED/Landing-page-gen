/**
 * Order form fields: [data-field=name|phone|city|address|note|email] > control[name] + [data-error].
 * Validation rules, inline error rendering (aria-invalid + aria-describedby) and "first field that
 * still needs the shopper" lookup shared by the form and the scroll-to-order CTA.
 */
import type { Ctl, Ctx } from "./core";
import { flag, setText } from "./core";
import { normalizePhone } from "./phone";
import type { RuntimeStringKey } from "./strings";
import { str } from "./strings";
import { missingVariants } from "./variants";

export const FIELDS = ["name", "phone", "city", "address", "email", "note"] as const;
export type FieldName = (typeof FIELDS)[number];

/** Contract maxima (OrderPayload). */
export const MAX: Record<FieldName, number> = { name: 80, phone: 24, city: 80, address: 240, email: 120, note: 300 };

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

let letterRe: RegExp | null = null;
function hasLetter(v: string): boolean {
  if (!letterRe) {
    try {
      letterRe = new RegExp("\\p{L}", "u");
    } catch {
      letterRe = /[A-Za-zÀ-ɏ؀-ۿ]/;
    }
  }
  return letterRe.test(v);
}

/** Field names are internal constants, never user input, so building the selector is safe. */
export function control(form: HTMLFormElement, name: string): Ctl | null {
  return form.querySelector<Ctl>('[name="' + name + '"]');
}

const active = (el: Ctl) => el.type !== "hidden" && !el.disabled;

function isRequired(c: Ctx, name: FieldName, el: Ctl): boolean {
  if (!active(el)) return false;
  if (el.required) return true;
  const f = c.cfg.fields || { city: "select", address: "required", email: "hidden" };
  return (
    name === "name" ||
    name === "phone" ||
    (name === "city" && f.city !== "hidden") ||
    (name === "address" && f.address === "required") ||
    (name === "email" && f.email === "required")
  );
}

/** Message key for the current value, "" when valid. */
export function fieldError(c: Ctx, name: FieldName, el: Ctl): RuntimeStringKey | "" {
  if (!active(el)) return "";
  const v = el.value.trim();
  if (!v)
    return isRequired(c, name, el) ? (name === "name" ? "form.errName" : name === "city" ? "form.errCity" : "form.errRequired") : "";
  if (name === "name") return v.length >= 2 && hasLetter(v) ? "" : "form.errName";
  if (name === "phone") return normalizePhone(v, c.cfg.phone) ? "" : "form.errPhone";
  if (name === "email") return EMAIL.test(v) && v.length <= MAX.email ? "" : "form.errEmail";
  return "";
}

/**
 * Show/clear an inline error on a control (and its [data-field] wrapper).
 * Clearing a control that shows no error writes nothing: a layout shift on blur would move the
 * submit button between pointerdown and pointerup and swallow the shopper's tap.
 * The [data-error] line is emptied, never hidden: it is an aria-live region and must stay in the
 * accessibility tree to announce the next error (base.css collapses it while :empty).
 */
export function showError(el: Ctl, msg: string): void {
  if (!msg && el.getAttribute("aria-invalid") !== "true") return;
  const wrap = el.closest("[data-field]") || el.parentElement;
  const err = wrap ? wrap.querySelector<HTMLElement>("[data-error]") : null;
  if (msg) el.setAttribute("aria-invalid", "true");
  else el.removeAttribute("aria-invalid");
  if (wrap) flag(wrap, "data-invalid", !!msg);
  if (!err) return;
  if (!err.id) err.id = "lp-err-" + (el.name || el.id || "field").replace(/[^A-Za-z0-9_-]/g, "_");
  setText(err, msg);
  if (msg && err.hidden) err.hidden = false;
  const ids = (el.getAttribute("aria-describedby") || "").split(/\s+/).filter((x) => x && x !== err.id);
  if (msg) ids.push(err.id);
  if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
  else el.removeAttribute("aria-describedby");
}

export const byDomOrder = (a: Element, b: Element) => (a.compareDocumentPosition(b) & 4 ? -1 : 1);

/**
 * Validate every field (and required variant pickers). With `show`, errors are rendered.
 * Returns the invalid controls in document order.
 */
export function validateForm(c: Ctx, form: HTMLFormElement, show: boolean): Ctl[] {
  const bad: Ctl[] = [];
  for (const name of FIELDS) {
    const el = control(form, name);
    if (!el) continue;
    const key = fieldError(c, name, el);
    if (key) bad.push(el);
    if (show) showError(el, key ? str(c.cfg, key) : "");
  }
  for (const el of missingVariants(form)) {
    bad.push(el);
    if (show) showError(el, str(c.cfg, "form.errRequired"));
  }
  return bad.sort(byDomOrder);
}

/** First control still needing input (empty required or invalid) — or the submit button when done. */
export function firstPending(c: Ctx, form: HTMLFormElement): HTMLElement | null {
  return validateForm(c, form, false)[0] || form.querySelector<HTMLElement>("[data-lp-submit],[type=submit]");
}
