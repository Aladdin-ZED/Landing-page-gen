/**
 * Optional chunk "units-matrix" (docs/OFFERS.md §F.9) — matrix pickers (linked / combined): an offer unit or the bump item has a matrix group.
 * Inlined before the core script; registers itself for the core's init.
 */
import { matrixKit } from "./units-matrix";

const w = window as unknown as { __lpx?: unknown[] };
(w.__lpx = w.__lpx || []).push(["units-matrix", matrixKit]);
