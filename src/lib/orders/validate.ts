/**
 * Server-side order validation against the PUBLISHED document: bundle, variants, bump, phone, name,
 * city, address, email, note. Prices are recomputed with orderTotals() — client totals never count.
 */
import type { OrderItems } from "@/lib/db/schema";
import { findCity, getMarket } from "@/lib/markets";
import { normalizePhone } from "@/lib/markets/phone";
import type { NormalizedPhone } from "@/lib/markets/types";
import { orderTotals, type OrderTotals } from "@/lib/page/pricing";
import { LOCALES, type Bundle, type PageDoc } from "@/lib/page/schema";
import type { OrderPayload } from "./contract";

export type OrderField = "name" | "phone" | "city" | "address" | "email" | "bundleId";
/** Field error codes (the runtime shows its own localized message per field). */
export type FieldError = "required" | "invalid" | "unavailable";

export interface ValidOrder {
  bundle: Bundle;
  totals: OrderTotals;
  items: OrderItems;
  phone: NormalizedPhone;
  phoneRaw: string;
  name: string;
  city: string | null;
  address: string | null;
  note: string | null;
  email: string | null;
  locale: string;
}

export type ValidationResult = { ok: true; value: ValidOrder } | { ok: false; fields: Partial<Record<OrderField, FieldError>> };

/** Trim, NFC, drop control & bidi-override characters, collapse whitespace. */
export function cleanInput(v: string | null | undefined, max: number): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;
const LETTER = /\p{L}/gu;

/** Customer name: ≥ 2 letters (Arabic, Latin… any script), no digits or symbols. */
export function validName(raw: string): string | null {
  const name = cleanInput(raw, 80);
  if (!NAME_CHARS.test(name)) return null;
  if ((name.match(LETTER) ?? []).length < 2) return null;
  return name;
}

/**
 * Variant choices per unit → { groupName: optionLabel }[] (one record per unit).
 * Per-unit groups need a choice for every unit; other groups are read from the first unit.
 * A group with a single available option is filled automatically.
 */
function resolveVariants(doc: PageDoc, qty: number, chosen: Record<string, string>[]): Record<string, string>[] | "invalid" | "unavailable" {
  const groups = doc.product.variants;
  if (!groups.length) return [];
  const units: Record<string, string>[] = Array.from({ length: qty }, () => ({}));
  for (const g of groups) {
    const available = g.options.filter((o) => !o.soldOut);
    for (let u = 0; u < qty; u++) {
      const source = g.perUnit ? chosen[u] : chosen[0];
      const wanted = source?.[g.id];
      let opt = wanted ? g.options.find((o) => o.id === wanted) : undefined;
      if (opt?.soldOut) return "unavailable";
      if (!opt && available.length === 1 && !wanted) opt = available[0];
      if (!opt) return "invalid";
      units[u]![g.name] = opt.label;
    }
  }
  return units;
}

export function validateOrder(p: OrderPayload, doc: PageDoc): ValidationResult {
  const fields: Partial<Record<OrderField, FieldError>> = {};
  const form = doc.form;

  const bundle = doc.offers.bundles.find((b) => b.id === p.bundleId);
  const totals = bundle ? orderTotals(doc.product, doc.offers, bundle.id, p.bump) : null;
  if (!bundle || !totals) fields.bundleId = "invalid";

  let variants: Record<string, string>[] = [];
  if (bundle) {
    const v = resolveVariants(doc, bundle.qty, p.variants);
    if (v === "invalid" || v === "unavailable") fields.bundleId = v;
    else variants = v;
  }

  const name = validName(p.name);
  if (!name) fields.name = cleanInput(p.name, 80) ? "invalid" : "required";

  const phoneRaw = cleanInput(p.phone, 40);
  const phone = normalizePhone(p.phone, form.phoneCountry);
  if (!phone) fields.phone = phoneRaw ? "invalid" : "required";

  let city: string | null = null;
  if (form.city !== "hidden") {
    const input = cleanInput(p.city, 80);
    const market = getMarket(doc.market);
    if (form.city === "select" && market.cities) {
      const match = findCity(market.code, input);
      if (match) city = match.value;
      else fields.city = input ? "invalid" : "required";
    } else if ((input.match(LETTER) ?? []).length >= 2) {
      city = input;
    } else {
      fields.city = input ? "invalid" : "required";
    }
  }

  let address: string | null = null;
  if (form.address !== "hidden") {
    const input = cleanInput(p.address, 240);
    // "other city" means the locality lives in the address line
    const required = form.address === "required" || city === "Autre";
    if (input.length >= 4) address = input;
    else if (required) fields.address = input ? "invalid" : "required";
    else address = input || null;
  }

  let email: string | null = null;
  if (form.email !== "hidden") {
    const input = cleanInput(p.email, 120).toLowerCase();
    if (input) email = input;
    else if (form.email === "required") fields.email = "required";
  }

  const note = form.note === "hidden" ? null : cleanInput(p.note, 300) || null;

  if (Object.keys(fields).length || !bundle || !totals || !name || !phone) return { ok: false, fields };

  const locale = p.locale && (LOCALES as readonly string[]).includes(p.locale) ? p.locale : doc.locale;
  const items: OrderItems = {
    bundleId: bundle.id,
    bundleLabel: bundle.title ? `${bundle.title} (x${bundle.qty})` : `x${bundle.qty}`,
    qty: bundle.qty,
    // effective price per unit inside the chosen pack
    unitPrice: totals.bundle.perUnit,
    variants,
    ...(totals.bump > 0 && doc.offers.orderBump ? { bump: { title: doc.offers.orderBump.title, price: totals.bump } } : {}),
  };
  return {
    ok: true,
    value: { bundle, totals, items, phone, phoneRaw, name, city, address, note, email, locale },
  };
}
