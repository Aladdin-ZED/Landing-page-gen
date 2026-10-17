/**
 * Optional chunk "turnstile" (docs/OFFERS.md §F.9) — Cloudflare Turnstile for the order form: pages that embed a site key.
 * Inlined before the core script; registers itself for the core's init.
 */
import { captcha } from "./turnstile";

const w = window as unknown as { __lpx?: unknown[] };
(w.__lpx = w.__lpx || []).push(["turnstile", captcha]);
