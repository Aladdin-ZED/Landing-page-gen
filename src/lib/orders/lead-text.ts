/**
 * leads.selection (docs/OFFERS.md §G.1, §I.2, §I.4): the warehouse text of the part of an abandoned
 * lead's offer choice that resolves against the version the visitor saw ("1 × Jour + 1 × Nuit",
 * "NR/M · Prénom « Sara »"), ≤ 400 characters. Units or extras that don't resolve (not chosen yet,
 * unknown ids) are left out, never an error. Pure (src/lib/orders/leads.ts stores it).
 */
import { isChoiceGroup, type PageDoc } from "@/lib/page/schema";
import type { UnitIn } from "./contract";
import { unitsText, type TextExtra } from "./text";
import { resolveSelection } from "./validate";

/** leads.selection length (VARCHAR(400)) */
export const LEAD_SELECTION_MAX = 400;

/** Warehouse text of what resolves in a lead's selection (null when nothing does). */
export function leadSelectionText(
  doc: Pick<PageDoc, "items" | "offers" | "product">,
  lead: { bundleId?: string | null; units?: readonly UnitIn[]; extras?: Readonly<Record<string, string>> },
): string | null {
  const offer = lead.bundleId ? doc.offers.bundles.find((b) => b.id === lead.bundleId) : undefined;
  if (!offer) return null;
  const r = resolveSelection(doc, offer, { offerId: offer.id, units: [...(lead.units ?? [])], extras: { ...(lead.extras ?? {}) }, bump: false });
  const extras: TextExtra[] = [];
  for (const x of doc.offers.extras) {
    const value = r.selection.extras[x.id];
    if (value === undefined || value === "") continue;
    if (isChoiceGroup(x)) {
      const o = x.options.find((c) => c.id === value);
      if (o) extras.push({ name: x.name, value: o.label, ...(o.code ? { code: o.code } : {}), ...(o.delta ? { delta: o.delta } : {}) });
    } else extras.push({ name: x.name, value, typed: true, ...(x.delta ? { delta: x.delta } : {}) });
  }
  const text = unitsText({ units: r.units, multi: doc.items.length > 1, gift: offer.gift ?? null, extras }, "warehouse", LEAD_SELECTION_MAX);
  return text ? Array.from(text).slice(0, LEAD_SELECTION_MAX).join("") : null;
}

