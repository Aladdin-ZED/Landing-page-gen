/**
 * Optional chunk "units-fields" (docs/OFFERS.md §F.9) — typed fields: a field in the units, the extras or the bump item.
 * Inlined before the core script; registers itself for the core's init.
 */
import { fieldsKit } from "./units-fields";

const w = window as unknown as { __lpx?: unknown[] };
(w.__lpx = w.__lpx || []).push(["units-fields", fieldsKit]);
