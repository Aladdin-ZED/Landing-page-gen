/**
 * Optional chunk "pixels" (docs/OFFERS.md §F.9) — ad pixels (Meta, TikTok, Snap, GA4): pages with pixels, never previews.
 * Inlined before the core script; registers itself for the core's init.
 */
import { pixels } from "./pixels";

const w = window as unknown as { __lpx?: unknown[] };
(w.__lpx = w.__lpx || []).push(["pixels", pixels]);
