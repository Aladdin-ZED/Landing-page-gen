/**
 * Order validation self-test (no database, no Next runtime):  npx tsx src/lib/orders/selftest.ts
 *
 *  1. resolveVariants — per-unit and shared groups: valid, missing, unknown, sold out, a lone
 *     available option filled in, unknown group ids ignored, duplicate group names kept apart.
 *  2. validateOrder — option errors keyed like the form controls ("v.<unit>.<groupId>" /
 *     "v.<groupId>"), stored units in group order, totals never depending on options.
 *  3. variantText — the one-line "Variante" text (Sheets, admin, CSV, WhatsApp).
 */
import { orderTotals } from "@/lib/page/pricing";
import { Offers, Product, type PageDoc } from "@/lib/page/schema";
import { VARIANT_FIELD_RE, variantText, type OrderPayload } from "./contract";
import { resolveVariants, validateOrder } from "./validate";

let passes = 0;
const failures: string[] = [];
function eq(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passes++;
  else failures.push(`${name}\n    got:  ${a}\n    want: ${e}`);
}

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

const color = {
  id: "color",
  name: "Couleur",
  kind: "swatch" as const,
  perUnit: true,
  options: [
    { id: "noir", label: "Noir", swatch: "#1d1d1f", soldOut: false },
    { id: "beige", label: "Beige", swatch: "#d8ccb4", soldOut: false },
    { id: "rouge", label: "Bordeaux", swatch: "#7a1f3d", soldOut: true },
  ],
};
const size = {
  id: "size",
  name: "Taille",
  kind: "text" as const,
  perUnit: true,
  options: ["S", "M", "L", "XL"].map((s) => ({ id: `sz-${s.toLowerCase()}`, label: s, soldOut: s === "XL" })),
};
const groups = [color, size];

/* 1 · resolveVariants ------------------------------------------------ */
eq("x1 valid", resolveVariants(groups, 1, [{ color: "noir", size: "sz-m" }]), { ok: true, units: [{ Couleur: "Noir", Taille: "M" }] });
eq(
  "x2 valid, different per unit",
  resolveVariants(groups, 2, [
    { color: "noir", size: "sz-m" },
    { color: "beige", size: "sz-l" },
  ]),
  { ok: true, units: [{ Couleur: "Noir", Taille: "M" }, { Couleur: "Beige", Taille: "L" }] },
);
eq("missing size (unit 1)", resolveVariants(groups, 1, [{ color: "noir" }]), { ok: false, errors: { "v.0.size": "required" } });
eq("missing everything x2", resolveVariants(groups, 2, []), {
  ok: false,
  errors: { "v.0.color": "required", "v.1.color": "required", "v.0.size": "required", "v.1.size": "required" },
});
eq("missing unit 2 only", resolveVariants(groups, 2, [{ color: "noir", size: "sz-s" }]), {
  ok: false,
  errors: { "v.1.color": "required", "v.1.size": "required" },
});
eq("unknown option", resolveVariants(groups, 1, [{ color: "violet", size: "sz-m" }]), { ok: false, errors: { "v.0.color": "invalid" } });
eq("sold-out option", resolveVariants(groups, 2, [{ color: "noir", size: "sz-m" }, { color: "noir", size: "sz-xl" }]), {
  ok: false,
  errors: { "v.1.size": "unavailable" },
});
eq("sold-out color", resolveVariants(groups, 1, [{ color: "rouge", size: "sz-s" }]), { ok: false, errors: { "v.0.color": "unavailable" } });
eq("unknown group ids ignored", resolveVariants(groups, 1, [{ color: "noir", size: "sz-s", hack: "x" }]), {
  ok: true,
  units: [{ Couleur: "Noir", Taille: "S" }],
});
eq("units beyond qty ignored", resolveVariants(groups, 1, [{ color: "noir", size: "sz-s" }, { color: "violet" }]), {
  ok: true,
  units: [{ Couleur: "Noir", Taille: "S" }],
});
const lone = { ...size, options: [{ id: "one", label: "Taille unique", soldOut: false }, { id: "kid", label: "Enfant", soldOut: true }] };
eq("lone available option filled in", resolveVariants([lone], 2, []), { ok: true, units: [{ Taille: "Taille unique" }, { Taille: "Taille unique" }] });
eq("lone available: a sold-out pick is still refused", resolveVariants([lone], 1, [{ size: "kid" }]), { ok: false, errors: { "v.0.size": "unavailable" } });
const shared = { ...color, perUnit: false };
eq("perUnit=false: one shared choice for every unit", resolveVariants([shared, size], 2, [{ color: "beige", size: "sz-s" }, { color: "noir", size: "sz-m" }]), {
  ok: true,
  units: [{ Couleur: "Beige", Taille: "S" }, { Couleur: "Beige", Taille: "M" }],
});
eq("perUnit=false missing → one error under v.<groupId>", resolveVariants([shared, size], 2, [{ size: "sz-s" }, { size: "sz-m" }]), {
  ok: false,
  errors: { "v.color": "required" },
});
eq("perUnit=false sold out", resolveVariants([shared], 3, [{ color: "rouge" }]), { ok: false, errors: { "v.color": "unavailable" } });
eq(
  "duplicate group names kept apart",
  resolveVariants([color, { ...color, id: "color2" }], 1, [{ color: "noir", color2: "beige" }]),
  { ok: true, units: [{ Couleur: "Noir", "Couleur (2)": "Beige" }] },
);
eq("no groups → no units", resolveVariants([], 2, [{ x: "y" }]), { ok: true, units: [] });
eq("error keys match the control-name pattern", Object.keys((resolveVariants([shared, size], 2, []) as { errors: object }).errors).every((k) => VARIANT_FIELD_RE.test(k)), true);

/* 2 · validateOrder --------------------------------------------------- */
const product = Product.parse({ name: "Robe brodée", price: 199, variants: groups });
const offers = Offers.parse({
  bundles: [
    { id: "x1", qty: 1, price: 199 },
    { id: "x2", qty: 2, price: 359 },
    { id: "x3", qty: 3, price: 499 },
  ],
});
const doc = {
  locale: "fr",
  market: "MA",
  product,
  offers,
  form: { phoneCountry: "MA", city: "text", address: "required", email: "hidden", note: "optional" },
} as unknown as PageDoc;
const base: OrderPayload = {
  pageKey: "pk_selftest_0001",
  idem: "00000000-0000-4000-8000-000000000000",
  eventId: "ev_selftest_0001",
  bundleId: "x2",
  variants: [],
  bump: false,
  name: "Salma Bennani",
  phone: "0612345678",
  city: "Casablanca",
  address: "12 rue Atlas",
  t: 9000,
  utm: {},
};
const run = (variants: Record<string, string>[], bundleId = "x2") => validateOrder({ ...base, bundleId, variants }, doc);

const ok2 = run([
  { color: "noir", size: "sz-m" },
  { color: "beige", size: "sz-l" },
]);
eq("valid x2 order", ok2.ok, true);
if (ok2.ok) {
  eq("stored per-unit choices (group order)", ok2.value.items.variants, [{ Couleur: "Noir", Taille: "M" }, { Couleur: "Beige", Taille: "L" }]);
  eq("total from the pack, not the options", ok2.value.totals.total, orderTotals(product, offers, "x2", false)!.total);
  eq("sheet text of the order", variantText(ok2.value.items.variants), "Noir/M + Beige/L");
}
const same = run([{ color: "noir", size: "sz-m" }, { color: "noir", size: "sz-m" }]);
eq("identical units: same total", same.ok && same.value.totals.total, ok2.ok && ok2.value.totals.total);
const miss = run([{ color: "noir", size: "sz-m" }, { color: "noir" }]);
eq("missing size of unit 2 → field v.1.size", miss.ok ? null : miss.fields, { "v.1.size": "required" });
const bad = run([{ color: "noir", size: "sz-xl" }, { color: "pink", size: "sz-m" }]);
eq("sold out + unknown in one order", bad.ok ? null : bad.fields, { "v.1.color": "invalid", "v.0.size": "unavailable" });
const mixed = validateOrder({ ...base, name: "", variants: [{ color: "noir" }] }, doc);
eq("option errors next to field errors", mixed.ok ? null : mixed.fields, { "v.1.color": "required", "v.0.size": "required", "v.1.size": "required", name: "required" });
const unknownPack = run([{ color: "noir", size: "sz-m" }], "x9");
eq("unknown pack: options not judged", unknownPack.ok ? null : unknownPack.fields, { bundleId: "invalid" });
const x1 = run([{ color: "beige", size: "sz-s" }], "x1");
eq("x1 order stores one unit", x1.ok && x1.value.items.variants, [{ Couleur: "Beige", Taille: "S" }]);

/* 3 · variantText ------------------------------------------------------ */
eq("text: one unit", variantText([{ Couleur: "Noir", Taille: "M" }]), "Noir/M");
eq("text: identical units counted", variantText([{ Couleur: "Noir", Taille: "M" }, { Couleur: "Noir", Taille: "M" }]), "2 × Noir/M");
eq(
  "text: mixed units, first-seen order",
  variantText([{ c: "Noir", t: "M" }, { c: "Beige", t: "L" }, { c: "Noir", t: "M" }]),
  "2 × Noir/M + Beige/L",
);
eq("text: Arabic labels", variantText([{ اللون: "أسود", المقاس: "M" }]), "أسود/M");
eq("text: empty", variantText([]), "");
eq("text: old rows without variants", variantText(undefined), "");
eq("text: blank labels skipped", variantText([{ a: " ", b: "M" }, {}]), "M");

console.log(`orders selftest: ${passes} passed, ${failures.length} failed`);
for (const f of failures) console.error("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
