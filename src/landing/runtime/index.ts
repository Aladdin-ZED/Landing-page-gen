/**
 * Landing runtime for the admin preview (and any caller that wants everything in one module): every
 * DOM module of product and thank-you pages and every optional chunk (matrix, fields, steps / box,
 * turnstile, pixels — the last two are no-ops in previews). Production pages load the split chunks
 * instead (entry*.ts, docs/OFFERS.md §F.9).
 *
 *   initLanding({ doc, win, config, preview? }) → { destroy(), refresh() }
 */
import { accordion } from "./accordion";
import { analytics } from "./analytics";
import { bundles } from "./bundles";
import { compare } from "./compare";
import type { Features } from "./core";
import { countdown } from "./countdown";
import { stepsKit } from "./fill-steps-box";
import { form } from "./form";
import { gallery } from "./gallery";
import type { LandingInitOptions, LandingInstance, Modules } from "./init";
import { start } from "./init";
import { lead } from "./lead";
import { marquee } from "./marquee";
import { orderScroll } from "./order-scroll";
import { parallax } from "./parallax";
import { pixels } from "./pixels";
import { reveal } from "./reveal";
import { sticky } from "./sticky";
import { tabs } from "./tabs";
import { thankyou } from "./thankyou";
import { captcha } from "./turnstile";
import { units } from "./units";
import { fieldsKit } from "./units-fields";
import { matrixKit } from "./units-matrix";
import { video } from "./video";

export type { LandingRuntimeConfig } from "./config";
export type { LandingInitOptions, LandingInstance } from "./init";
export { readConfig } from "./init";

/** Every optional chunk, as the production pages register them. */
export const ALL_FEATURES: Features = {
  pixels,
  turnstile: captcha,
  "units-matrix": matrixKit,
  "units-fields": fieldsKit,
  "fill-steps-box": stepsKit,
} as unknown as Features;

const ALL: Modules = {
  once: [analytics],
  bind: [reveal, parallax, marquee, video, gallery, compare, tabs, accordion, bundles, units, form, lead, orderScroll, sticky, thankyou, countdown],
  reveal,
};

export function initLanding(opts: LandingInitOptions): LandingInstance {
  return start({ ...opts, features: opts.features || ALL_FEATURES }, ALL);
}
