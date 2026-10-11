/**
 * Section instances for generated pages: the section's own defaults (validated) with the page copy
 * written over the fields it has. A section whose defaults cannot be produced is left out rather
 * than shipped broken (validateDoc would only add the required order form back with a warning).
 */
import type { PageCopy } from "@/lib/ai/copy-schema";
import type { PageDoc, SectionInstance } from "@/lib/page/schema";
import { sectionDefaults } from "@/lib/page/validate";
import { getSection } from "@/landing/registry";
import { copyPatch, type CopyExtras } from "./copy-map";
import { applyPatch } from "./overlay";
import type { PlannedSection } from "./plan";
import { parseOr } from "./zod-tools";

export type DocBasics = Pick<PageDoc, "locale" | "product" | "offers" | "theme">;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Section data = validated defaults + copy overlay (re-validated). */
export function sectionData(type: string, id: string, basics: DocBasics, copy: PageCopy, extras: CopyExtras): Record<string, unknown> | null {
  const def = getSection(type);
  if (!def) return null;
  let raw: unknown;
  try {
    raw = sectionDefaults(def, basics, id);
  } catch {
    return null;
  }
  const defaults = parseOr<unknown>(def.schema, raw);
  if (!isRecord(defaults)) return null;
  const patched = applyPatch(def.schema, defaults, copyPatch(type, copy, extras));
  const final = parseOr<unknown>(def.schema, patched);
  return isRecord(final) ? final : defaults;
}

/** Overlay copy onto existing section data (copy remix); returns the data unchanged when nothing applies. */
export function recopySection(section: SectionInstance, copy: PageCopy, extras: CopyExtras): Record<string, unknown> {
  const def = getSection(section.type);
  if (!def) return section.data;
  const current = parseOr<unknown>(def.schema, section.data);
  if (!isRecord(current)) return section.data;
  const patched = applyPatch(def.schema, current, copyPatch(section.type, copy, extras));
  const final = parseOr<unknown>(def.schema, patched);
  return isRecord(final) ? final : section.data;
}

/** Unique, readable section ids ("hero", "faq", "cta-2"…) that satisfy the Id pattern. */
export function sectionId(type: string, taken: Set<string>): string {
  const base = type.length >= 2 ? type.slice(0, 36) : `${type}-s`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

export function buildSections(plan: readonly PlannedSection[], basics: DocBasics, copy: PageCopy, extras: CopyExtras): SectionInstance[] {
  const taken = new Set<string>();
  const out: SectionInstance[] = [];
  for (const p of plan) {
    const id = sectionId(p.type, taken);
    const data = sectionData(p.type, id, basics, copy, extras);
    if (!data) {
      taken.delete(id);
      continue;
    }
    out.push({ id, type: p.type, variant: p.variant, bg: p.bg, divider: p.divider, spacing: p.spacing, hidden: false, data });
  }
  return out;
}
