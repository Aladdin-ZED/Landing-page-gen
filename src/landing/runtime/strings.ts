/**
 * Microcopy the runtime reads from config.strings. The renderer fills config.strings with
 * `t(key)` for every key below (RUNTIME_UI_KEYS are i18n UiKeys; RUNTIME_EXTRA_KEYS are optional
 * and fall back as documented). The English fallbacks only exist so a misconfigured page still
 * shows *a* message instead of a silent red border.
 */
import type { UiKey } from "../i18n";
import type { LandingRuntimeConfig } from "./config";

export const RUNTIME_UI_KEYS = [
  "form.errRequired",
  "form.errName",
  "form.errPhone",
  "form.errCity",
  "form.errNetwork",
  "form.errGeneric",
  "form.errDuplicate",
  "form.submitting",
  "form.free",
  "thanks.upsellAdded",
] as const satisfies readonly UiKey[];

/** Not in i18n yet: "form.errEmail" falls back to "form.errRequired"; "form.previewNotice" to English. */
export const RUNTIME_EXTRA_KEYS = ["form.errEmail", "form.previewNotice"] as const;

export type RuntimeStringKey = (typeof RUNTIME_UI_KEYS)[number] | (typeof RUNTIME_EXTRA_KEYS)[number];

const FALLBACK: Partial<Record<RuntimeStringKey, string>> = {
  "form.errRequired": "Required",
  "form.errName": "Full name, please",
  "form.errPhone": "Invalid number",
  "form.errCity": "Choose a city",
  "form.errNetwork": "Network error, try again",
  "form.errGeneric": "Error, try again",
  "form.errDuplicate": "Order already received",
  "form.previewNotice": "Preview — order not sent",
};

export function str(cfg: LandingRuntimeConfig, key: RuntimeStringKey): string {
  const v = cfg.strings ? cfg.strings[key] : undefined;
  if (typeof v === "string" && v) return v;
  if (key === "form.errEmail") return str(cfg, "form.errRequired");
  return FALLBACK[key] || "";
}
