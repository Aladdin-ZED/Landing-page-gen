/**
 * Optional chunk "fill-steps-box" (docs/OFFERS.md §F.9) — steps and box navigation: the page's resolved fill is steps or box.
 * Inlined before the core script; registers itself for the core's init.
 */
import { stepsKit } from "./fill-steps-box";

const w = window as unknown as { __lpx?: unknown[] };
(w.__lpx = w.__lpx || []).push(["fill-steps-box", stepsKit]);
