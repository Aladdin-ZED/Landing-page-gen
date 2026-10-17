/**
 * Offers v2 core check (docs/OFFERS.md §I.5) — offline, no database:  npm run test:offers
 *
 *  A. upgradeDoc on every fixture and on v1 samples: ids kept, offerMath (cents) == v1 bundleMath,
 *     totals with fee 0 and > 0, Sheets labels identical, idempotence, every repair (two
 *     preselected, duplicate ids, dangling references, money rounding, tracking.none, matrix cells)
 *  B. every §C.5–C.6 case in cents (reference, from, variable, savings, per-unit, deltas, free lines,
 *     gift not sold = 0, choice base stable when the cheapest sells out, distinct difference)
 *  C. property test: for 500 random documents, the lowest subtotal over every valid selection
 *     without opt-ins == offerMath.from (and `variable` iff the highest is higher)
 *  D. allocate sums exactly (100 / 3, Σ references = 0, free units, deltas)
 *  E. limits and refinements (schema errors for v2-only constructs)
 *  F. offerWarnings
 *  G. resolveCombo (wildcards, specificity, severity), cell keys
 *  H. unitsText (v1 byte-identical cases, numeric prefix, markers, quotes, sanitizing, empty parts, cap)
 *  I. catalog (units, signatures, availability, names, group photos, visuals), display, fields
 *
 *   npx tsx scripts/qa/offers-check.ts        (exit code 1 on any failure)
 */
import { checkDoc, emptyReport, upgradeCheckOk, upgradeCheckSummary } from "@/lib/db/upgrade-check";
import type { OrderUnit } from "@/lib/db/schema";
import { orderText, optionText, quoteValue, sanitizeLabel, sheetPreview, unitsText } from "@/lib/orders/text";
import { resolveSelection } from "@/lib/orders/validate";
import {
  contentIdOf,
  defaultOfferId,
  expandUnits,
  groupPhotos,
  isLegacyOffer,
  itemShort,
  itemVisual,
  leadItem,
  offerAvailable,
  offerName,
  offerSheetLabel,
  offerShort,
  offerSignature,
  offerUnits,
  visualPlan,
} from "@/lib/page/catalog";
import { resolveDisplay } from "@/lib/page/display";
import { FIXTURE_NAMES, fixtureAssets, getFixture } from "@/lib/page/fixtures";
import { allCombos, cellKey, checkField, parseCellKey, resolveCombo } from "@/lib/page/options";
import {
  allocate,
  bundleMath,
  emptySelection,
  everyOfferFree,
  fromCents,
  offerMath,
  offerWarnings,
  orderTotals,
  selectionDeltas,
  toCents,
  type Selection,
} from "@/lib/page/pricing";
import { PageDoc, PageDocObject, type PageDoc as PageDocT } from "@/lib/page/schema";
import { upgradeDoc, upgradeDocReport } from "@/lib/page/upgrade";
import { validateDoc } from "@/lib/page/validate";
import type { ResolvedAsset } from "@/landing/types";

let passes = 0;
const failures: string[] = [];
function eq(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passes++;
  else failures.push(`${name}\n    got:  ${a}\n    want: ${e}`);
}
const ok = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passes++;
  else failures.push(`${name}${detail !== undefined ? `\n    ${JSON.stringify(detail).slice(0, 600)}` : ""}`);
};
const section = (s: string) => console.log(`· ${s}`);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const NOW = "2026-10-07T12:00:00.000Z";
const theme = {
  archetype: "souk",
  seed: 1,
  palette: { accent: "#2c5aa8", pop: "#e9a5b9", harmony: "pop-complement" },
  fonts: { display: "figtree", body: "figtree", displayAr: "readex-pro", bodyAr: "readex-pro" },
};
const form = { phoneCountry: "MA", city: "text", address: "required", email: "hidden", note: "optional" };

/** A v2 page with the given items and offers (no sections). */
function page(items: unknown[], bundles: unknown[], offers: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): PageDocT {
  return PageDoc.parse({ v: 2, locale: "fr", market: "MA", currency: "MAD", product: { name: "Duo Éclat" }, items, offers: { bundles, ...offers }, form, theme, sections: [], ...extra });
}
const line = (id: string, qty: number, pick: unknown, more: Record<string, unknown> = {}) => ({ id, qty, pick, ...more });

/* ================================================================== */
/* A · upgrade                                                         */
/* ================================================================== */
section("A · upgrade of fixtures and v1 samples");

/** v2 single-item doc → the v1 JSON it upgrades from (what stored versions hold). */
function toV1(doc: PageDocT): Record<string, unknown> {
  const d = clone(doc) as unknown as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const lead = d.items[0];
  d.v = 1;
  d.product = { ...d.product, price: lead.price, ...(lead.compareAt !== undefined ? { compareAt: lead.compareAt } : {}), ...(lead.sku ? { sku: lead.sku } : {}), variants: lead.groups.map((g: Record<string, unknown>) => { const { display: _d, ...rest } = g; void _d; return rest; }) };
  delete d.items;
  d.offers.cardStyle = d.offers.display.picker;
  delete d.offers.display;
  delete d.offers.extras;
  d.offers.bundles = d.offers.bundles.map((b: Record<string, any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const out: Record<string, unknown> = { id: b.id, qty: b.lines[0].qty, price: b.price, badge: b.badge, freeShipping: true, preselected: b.preselected };
    for (const k of ["title", "subtitle", "compareAt", "badgeText", "gift"]) if (b[k] !== undefined) out[k] = b[k];
    if (b.visual?.mode === "custom") out.image = b.visual.images[0];
    return out;
  });
  return d;
}

for (const name of FIXTURE_NAMES) {
  for (const locale of ["ar", "fr", "en"] as const) {
    const fx = getFixture(name, { now: NOW, locale });
    const tag = `${name}/${locale}`;
    const re = PageDocObject.safeParse(fx.doc);
    ok(`${tag}: fixture is a valid v2 document`, re.success, re.success ? undefined : re.error.issues.slice(0, 3));
    eq(`${tag}: upgrade of a v2 doc is a no-op`, upgradeDoc(fx.doc), fx.doc);
    const v = validateDoc(fx.doc);
    ok(`${tag}: validateDoc reads it without repairs`, !!v.doc && v.issues.length === 0, v.issues.slice(0, 3));
    // the classic fixtures (one item, choice groups, ×N offers) are what stored v1 versions upgrade to
    const classic = fx.doc.items.length === 1 && fx.doc.items[0]!.groups.every((g) => g.kind !== "matrix" && g.kind !== "field") && fx.doc.offers.bundles.every((b) => isLegacyOffer(fx.doc, b) && !b.lines[0]!.rules);
    if (!classic) continue;
    // the classic fixtures as stored v1 JSON: the upgrade gives the same document, same numbers
    const v1 = toV1(fx.doc);
    const report = emptyReport();
    const doc = checkDoc(v1, "fixture", tag, report);
    ok(`${tag}: v1 → v2 dry run clean`, upgradeCheckOk(report) && report.repairs.duplicate_id === undefined, upgradeCheckSummary(report));
    eq(`${tag}: v1 → v2 = the v2 fixture`, doc, fx.doc);
    // fee > 0: v1 always charged it, v2 too (freeShipping false after the upgrade)
    const fee = clone(v1) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    fee.offers.shippingFee = 25;
    const r2 = emptyReport();
    checkDoc(fee, "fixture-fee", tag, r2);
    ok(`${tag}: fee 25: totals identical`, upgradeCheckOk(r2), upgradeCheckSummary(r2));
    const up = PageDoc.parse(fee);
    ok(`${tag}: fee 25: every offer pays it`, up.offers.bundles.every((b) => orderTotals(up, emptySelection(b.id))!.shipping === 2500));
    eq(`${tag}: idempotent`, upgradeDoc(upgradeDoc(v1)), upgradeDoc(v1));
  }
}

// v1 samples: everything existing data can break, repaired deterministically
{
  const v1 = {
    v: 1,
    locale: "fr",
    market: "MA",
    currency: "MAD",
    product: {
      name: "Huile",
      price: 149.995,
      compareAt: 199,
      variants: [
        { id: "color", name: "Couleur", options: [{ id: "noir", label: "Noir" }, { id: "noir", label: "Noir 2" }] },
        { id: "color", name: "Couleur (bis)", kind: "swatch", options: [{ id: "x1", label: "X" }] },
      ],
    },
    offers: {
      bundles: [
        { id: "x1", qty: 1, price: 149.999, preselected: true },
        { id: "x1", qty: 2, price: 269, preselected: true, compareAt: 250 },
        { id: "x3", qty: 3, price: 359, image: { id: "998b0718f328c3caadde3ff7afbafd16" }, gift: { label: "Pochette" } },
      ],
      shippingFee: 19.999,
      orderBump: { enabled: true, title: "Peigne", price: 39 },
    },
    form,
    theme,
    sections: [],
    tracking: { metaPixelId: "1234567890123456", none: true },
  };
  const rep = upgradeDocReport(v1);
  const kinds = rep.repairs.map((r) => r.kind).sort();
  eq("v1 sample: repairs logged", [...new Set(kinds)], ["duplicate_id", "money", "preselected", "tracking"]);
  const doc = PageDoc.parse(v1);
  eq("v1 sample: duplicate offer renamed like validateDoc (first keeps its id)", doc.offers.bundles.map((b) => b.id), ["x1", "x1-2", "x3"]);
  eq("v1 sample: duplicate group / option ids renamed", [doc.items[0]!.groups.map((g) => g.id), (doc.items[0]!.groups[0] as { options: { id: string }[] }).options.map((o) => o.id)], [["color", "color-2"], ["noir", "noir-2"]]);
  eq("v1 sample: kind defaults to text", doc.items[0]!.groups[0]!.kind, "text");
  eq("v1 sample: one preselected", doc.offers.bundles.map((b) => b.preselected), [true, false, false]);
  eq("v1 sample: money half-up on cents", [doc.items[0]!.price, doc.offers.bundles[0]!.price, doc.offers.shippingFee], [150, 150, 20]);
  eq("v1 sample: pixels win over none", [doc.tracking.none, doc.tracking.metaPixelId], [undefined, ["1234567890123456"]]);
  eq("v1 sample: image → custom visual; gift kept", [doc.offers.bundles[2]!.visual, doc.offers.bundles[2]!.gift], [{ mode: "custom", images: [{ id: "998b0718f328c3caadde3ff7afbafd16", alt: "" }], arrange: "auto" }, { label: "Pochette" }]);
  eq("v1 sample: display from cardStyle (default stack)", doc.offers.display.picker, "stack");
  eq("v1 sample: freeShipping false", doc.offers.bundles.every((b) => !b.freeShipping), true);
  eq("v1 sample: idempotent", upgradeDoc(upgradeDoc(v1)), upgradeDoc(v1));
  eq("v1 sample: repairing the repaired logs nothing", upgradeDocReport(upgradeDoc(v1)).repairs, []);
  const m = offerMath(doc, doc.offers.bundles[1]!);
  eq("v1 sample: compareAt < price shows no saving (as v1)", [m.reference, m.savings, m.showReference], [25000, 0, false]);
  const report = emptyReport();
  checkDoc(v1, "sample", "v1", report);
  eq("v1 sample: dry run lists renames and money, ids kept", [report.renamed.length, report.money.length, report.idsLost.length], [3, 3, 0]);
  // the v1 numbers ran on unrounded floats (149.995 × 3): listed as money changes; with 2-decimal money they are equal
  ok("v1 sample: money mismatches only come from rounded amounts", report.mathMismatches.length > 0 && report.money.length > 0);
  const even = clone(v1) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  even.product.price = 150;
  even.offers.bundles[0].price = 150;
  even.offers.shippingFee = 20;
  const r3 = emptyReport();
  checkDoc(even, "sample", "v1-even", r3);
  ok("v1 sample with 2-decimal money: no math / totals / label mismatch", !r3.mathMismatches.length && !r3.totalsMismatches.length && !r3.labelMismatches.length && !r3.idsLost.length, upgradeCheckSummary(r3));
  // a page saved with the v1 kit still upgrades (PageDoc alone refuses retired theme values; validateDoc reads it)
  const legacyTheme = clone(v1) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  legacyTheme.theme.texture = "paper";
  ok("v1 sample: retired theme values read through validateDoc", !PageDoc.safeParse(legacyTheme).success && !!validateDoc(legacyTheme).doc);
}

// dangling references and matrix exceptions (v2 data)
{
  const raw = {
    v: 2,
    locale: "fr",
    market: "MA",
    currency: "MAD",
    product: { name: "Duo" },
    items: [
      {
        id: "main",
        name: "Jour",
        price: 129,
        groups: [
          {
            id: "g-fit",
            kind: "matrix",
            name: "Couleur & taille",
            dims: [
              { id: "d-col", name: "Couleur", values: [{ id: "o-noir", label: "Noir" }, { id: "o-blanc", label: "Blanc" }] },
              { id: "d-size", name: "Taille", values: [{ id: "o-s", label: "S" }, { id: "o-m", label: "M" }] },
            ],
            cells: [
              { v: { "d-col": "o-noir", "d-size": "o-xl" }, state: "out" },
              { v: { "d-col": "o-rouge" }, state: "out" },
              { v: { "d-col": "o-blanc", "d-size": "o-gone" } },
              { v: { "d-size": "o-m", "d-col": "o-blanc" }, state: "in", sku: "BL-M" },
              { v: { "d-col": "o-blanc", "d-size": "o-m" }, state: "none" },
            ],
          },
        ],
      },
      { id: "nuit", name: "Nuit", price: 129 },
    ],
    offers: {
      bundles: [
        { id: "oa", price: 100, lines: [line("l1", 1, { item: "main" }, { rules: { "g-fit.d-col": { lock: "o-rouge" }, "g-fit.d-size": { allow: ["o-s", "o-xl"], preset: "o-xl" }, "g-gone": { preset: "o-x" } } })] },
        { id: "ob", price: 100, lines: [line("l1", 1, { choice: ["nuit", "ghost"] }), line("l2", 1, { item: "ghost" })] },
        { id: "oc", price: 100, lines: [line("l1", 1, { item: "ghost" }), line("l2", 1, { item: "main" }, { free: true })] },
        { id: "od", price: 100, lines: [line("l1", 1, { choice: ["main", "nuit", "ghost"] })] },
      ],
      extras: [
        { id: "x-wrap", kind: "text", name: "Emballage", scope: ["oc"], options: [{ id: "o-y", label: "Oui" }] },
        { id: "x-card", kind: "text", name: "Carte", scope: ["oa", "oc"], options: [{ id: "o-y", label: "Oui" }] },
      ],
      orderBump: { enabled: true, title: "Sérum", price: 99, item: "ghost", offers: ["oc"] },
      upsell: { enabled: true, title: "Mini", price: 49, item: "nuit" },
    },
    form,
    theme,
    sections: [],
  };
  const rep = upgradeDocReport(raw);
  const doc = PageDoc.parse(raw);
  eq("dangling: offers left with no paid line removed", doc.offers.bundles.map((b) => b.id), ["oa", "ob", "od"]);
  eq("dangling: a choice left with one item becomes a fixed line", doc.offers.bundles[1]!.lines.map((l) => l.pick), [{ item: "nuit" }]);
  eq("dangling: missing items removed from a choice", doc.offers.bundles[2]!.lines[0]!.pick, { choice: ["main", "nuit"], distinct: false, surcharge: "none" });
  eq("dangling: rules on missing options dropped (the allow list narrowed, the preset dropped)", doc.offers.bundles[0]!.lines[0]!.rules, { "g-fit.d-size": { allow: ["o-s"] } });
  eq("dangling: extras on removed offers dropped / narrowed", doc.offers.extras.map((x) => [x.id, x.scope]), [["x-card", ["oa"]]]);
  eq("dangling: bump on removed offers turned off, missing item unlinked", [doc.offers.orderBump!.enabled, doc.offers.orderBump!.offers, doc.offers.orderBump!.item], [false, undefined, undefined]);
  eq("dangling: upsell item kept when it exists", doc.offers.upsell!.item, "nuit");
  const cells = (doc.items[0]!.groups[0] as { cells: unknown[] }).cells;
  eq("matrix: out exceptions keep their known keys; unknown-only and in ones dropped; duplicates merged (most severe)", cells, [
    { v: { "d-col": "o-noir" }, state: "out" },
    { v: { "d-size": "o-m", "d-col": "o-blanc" }, state: "none", sku: "BL-M" },
  ]);
  ok("dangling: every repair logged", rep.repairs.length >= 10, rep.repairs.map((r) => r.message));
  eq("dangling: idempotent", upgradeDoc(upgradeDoc(raw)), upgradeDoc(raw));
}

/* ================================================================== */
/* B · the owner's example and the other cases, in cents               */
/* ================================================================== */
section("B · §C.5–C.6 in cents");
const duo = getFixture("duo", { now: NOW }).doc;
{
  const m = Object.fromEntries(duo.offers.bundles.map((o) => [o.id, offerMath(duo, o)]));
  eq("C.5 one: from 149, ref 149, no struck price", [m.one!.from, m.one!.reference, m.one!.showReference, m.one!.variable, m.one!.perUnit], [14900, 14900, false, false, null]);
  eq("C.5 duo: ref 298 → −49 (−16 %)", [m.duo!.reference, m.duo!.savings, m.duo!.savingsPct, m.duo!.perUnit], [29800, 4900, 16, null]);
  eq("C.5 trio: ref 497 → −148 (−30 %), per-unit hidden", [m.trio!.reference, m.trio!.savings, m.trio!.savingsPct, m.trio!.perUnit], [49700, 14800, 30, null]);
  eq("C.5 group photo: 9f2c… shown by two items", groupPhotos(duo).map((g) => [g.items]), [[["main", "nuit"]]]);
  const display = resolveDisplay(duo, { archetype: "bloom", formVariant: "card" });
  eq("C.5 fill auto → rows (visual can't host inline)", [display.picker, display.fill], ["visual", "rows"]);
  eq("C.5 fee 0 → free delivery said once", everyOfferFree(duo), true);
  eq("C.5 default offer: the preselected duo", defaultOfferId(duo.offers, duo.items), "duo");
  const assets = fixtureAssets("/");
  const ctx = { asset: (r: Parameters<typeof assets.resolve>[0]) => assets.resolve(r) as ResolvedAsset | null };
  eq("C.5 each cream's own visual is its crop", duo.items.map((it) => [itemVisual(duo, it, ctx).kind, itemVisual(duo, it, ctx).box?.x ?? null]), [["crop", 0.04], ["crop", 0.5], ["photo", null]]);
  eq("C.5 visual plans", duo.offers.bundles.map((o) => visualPlan(duo, o).mode), ["choice", "custom", "custom"]);
  eq("C.5 sheet labels", duo.offers.bundles.map((o) => offerSheetLabel(duo, o)), ["Une crème au choix (x1)", "Le duo jour + nuit (x2)", "Le rituel complet (x3)"]);
}

// a catalog for the other cases (§C.6): Jour, Nuit, Sérum, two minis, a trousse
const items = [
  { id: "main", name: "Crème jour", short: "Jour", price: 149 },
  { id: "nuit", name: "Crème nuit", short: "Nuit", price: 149 },
  { id: "serum", name: "Sérum éclat", short: "Sérum", price: 199 },
  { id: "mini-rose", name: "Mini rose", price: 39 },
  { id: "mini-oud", name: "Mini oud", price: 39 },
  { id: "trousse", name: "Trousse", price: 59 },
];
const c6 = page(items, [
  { id: "bogo", price: 149, badge: "custom", badgeText: "1 + 1 offert", lines: [line("l1", 1, { item: "main" }), line("l2", 1, { item: "main" }, { free: true })] },
  { id: "any2", title: "2 au choix", price: 279, lines: [line("l1", 2, { choice: ["main", "nuit", "serum"], distinct: true, surcharge: "difference" })] },
  { id: "combo", price: 249, lines: [line("l1", 1, { item: "main" }), line("l2", 1, { item: "nuit" })], gift: { label: "Trousse de voyage offerte" } },
  { id: "combo2", price: 249, lines: [line("l1", 1, { item: "main" }), line("l2", 1, { item: "nuit" }), line("l3", 1, { item: "trousse" }, { free: true })] },
  { id: "gift-pick", price: 199, lines: [line("l1", 1, { item: "main" }), line("l2", 1, { choice: ["mini-rose", "mini-oud"] }, { free: true, label: "Votre cadeau" })] },
]);
{
  const m = (id: string) => offerMath(c6, c6.offers.bundles.find((o) => o.id === id)!);
  eq("BOGO: ref 298 → −149 (−50 %), 74.50 per piece (75 DH on MAD cards)", [m("bogo").reference, m("bogo").savings, m("bogo").savingsPct, m("bogo").perUnit], [29800, 14900, 50, 7450]);
  eq("any2: base 298 → −19, card Dès 279", [m("any2").reference, m("any2").savings, m("any2").from, m("any2").variable], [29800, 1900, 27900, true]);
  const any2 = (a: string, b: string): Selection => ({ offerId: "any2", units: [{ item: a, options: {}, fields: {} }, { item: b, options: {}, fields: {} }], extras: {}, bump: false });
  eq("any2: Jour + Sérum = 329", orderTotals(c6, any2("main", "serum"))!.subtotal, 32900);
  eq("any2: Sérum + Jour = 329 (shares sorted)", orderTotals(c6, any2("serum", "main"))!.subtotal, 32900);
  eq("any2: the difference as a reason", selectionDeltas(c6, any2("serum", "main")).reasons, [{ key: "s:l1:serum", label: "Sérum", count: 1, cents: 5000 }]);
  eq("combo: non-catalog gift, ref 298", [m("combo").reference, m("combo").savings], [29800, 4900]);
  eq("combo2: a catalog item never sold paid counts 0", [m("combo2").reference, m("combo2").savings], [29800, 4900]);
  eq("gift-pick: free choice of minis not sold paid → 0", [m("gift-pick").reference, m("gift-pick").savings, m("gift-pick").showReference], [14900, 0, false]);
  // the cheapest choice sells out: the base (reference) holds, the card price follows availability
  const sold = page(items.map((it) => (it.id === "main" ? { ...it, soldOut: true } : it)), c6.offers.bundles);
  const s = offerMath(sold, sold.offers.bundles.find((o) => o.id === "any2")!);
  eq("sold out cheapest: reference stable, card Dès 329", [s.reference, s.savings, s.from], [29800, 1900, 32900]);
  eq("sold out: offers with a fixed line on it unavailable", sold.offers.bundles.map((o) => offerAvailable(o, sold.items)), [false, true, false, false, false]);
}
const tshirt = getFixture("tshirt", { now: NOW, locale: "fr" }).doc;
const colors = getFixture("colors", { now: NOW, locale: "fr" }).doc;
{
  const x2 = offerMath(tshirt, tshirt.offers.bundles.find((o) => o.id === "x2")!);
  eq("tshirt ×2: ref 258 → −29, XL +20 → Dès 229", [x2.reference, x2.savings, x2.from, x2.variable, x2.perUnit], [25800, 2900, 22900, true, 11450]);
  const pack = offerMath(colors, colors.offers.bundles.find((o) => o.id === "colors")!);
  eq("colors: 3 × 129 = 387 → −58", [pack.reference, pack.savings, pack.from, pack.variable], [38700, 5800, 32900, true]);
  const promo = offerMath(colors, colors.offers.bundles.find((o) => o.id === "x3-promo")!);
  eq("x3-promo: −88, Dès 299", [promo.savings, promo.from], [8800, 29900]);
  const sel: Selection = {
    offerId: "x2",
    units: [
      { item: "main", options: { "g-fit": cellKey({ "d-col": "o-blanc", "d-size": "o-xl" }) }, fields: { "g-name": "Sara" } },
      { item: "main", options: { "g-fit": cellKey({ "d-col": "o-gris", "d-size": "o-xl" }) }, fields: {} },
    ],
    extras: {},
    bump: false,
  };
  const d = selectionDeltas(tshirt, sel);
  eq("deltas: XL ×2 + a name", [d.total, d.reasons.map((r) => [r.label, r.count, r.cents])], [7000, [["XL", 2, 4000], ["Prénom à imprimer", 1, 3000]]]);
  eq("totals: 229 + 70", orderTotals(tshirt, sel)!.total, 29900);
  // a required field can never add a price; free units never pay deltas
  const bogoT = page(tshirt.items, [{ id: "bogo", price: 129, lines: [line("l1", 1, { item: "main" }), line("l2", 1, { item: "main" }, { free: true })] }]);
  const free: Selection = { offerId: "bogo", units: [sel.units[1]!, sel.units[0]!], extras: {}, bump: false };
  eq("free unit: no deltas", selectionDeltas(bogoT, free).total, 2000);
}
{
  // shared group (perUnit false): its delta per paid unit; shared field once
  const shared = page(
    [
      {
        id: "main",
        price: 100,
        groups: [
          { id: "g-cap", kind: "text", name: "Contenance", perUnit: false, options: [{ id: "o-50", label: "50 ml" }, { id: "o-100", label: "100 ml", delta: 10 }] },
          { id: "g-eng", kind: "field", name: "Gravure", perUnit: false, required: false, delta: 30 },
        ],
      },
    ],
    [{ id: "x3", price: 270, lines: [line("l1", 3, { item: "main" })] }],
  );
  const u = { item: "main", options: { "g-cap": "o-100" }, fields: { "g-eng": "Sara" } };
  const d = selectionDeltas(shared, { offerId: "x3", units: [u, u, u], extras: {}, bump: false });
  eq("shared group: delta × paid units; shared field once", [d.total, d.reasons.map((r) => [r.label, r.count, r.cents])], [6000, [["100 ml", 3, 3000], ["Gravure", 1, 3000]]]);
  eq("shared group: the card Dès 270 + min (0)", offerMath(shared, shared.offers.bundles[0]!).from, 27000);
}

/* ================================================================== */
/* C · property: from == the lowest payable subtotal                    */
/* ================================================================== */
section("C · property test (500 random documents)");
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
{
  let docs = 0;
  let selections = 0;
  let checked = 0;
  for (let seed = 1; docs < 500; seed++) {
    const r = rng(seed);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
    const price = () => pick([0, 10, 20, 30, 50]);
    const nItems = 1 + Math.floor(r() * 3);
    const its: Record<string, unknown>[] = [];
    for (let i = 0; i < nItems; i++) {
      const groups: unknown[] = [];
      if (r() < 0.6) groups.push({ id: "g-c", kind: "text", name: "Couleur", perUnit: r() < 0.85, options: ["a", "b", "c"].slice(0, 2 + Math.floor(r() * 2)).map((x) => ({ id: `o-${x}`, label: x.toUpperCase(), delta: price(), soldOut: r() < 0.15 })) });
      if (r() < 0.35)
        groups.push({
          id: "g-m",
          kind: "matrix",
          name: "Fit",
          dims: [
            { id: "d-a", name: "A", values: [{ id: "o-1", label: "1", delta: price() }, { id: "o-2", label: "2" }] },
            { id: "d-b", name: "B", values: [{ id: "o-x", label: "X" }, { id: "o-y", label: "Y", delta: price() }] },
          ],
          cells: r() < 0.6 ? [{ v: { "d-a": "o-1", "d-b": "o-x" }, state: pick(["in", "out", "none"]), ...(r() < 0.5 ? { delta: price() } : {}) }, { v: { "d-b": "o-y" }, state: r() < 0.3 ? "out" : "in" }] : [],
        });
      if (r() < 0.25) groups.push({ id: "g-f", kind: "field", name: "Nom", required: r() < 0.5, ...(r() < 0.5 ? {} : {}), maxLength: 12 });
      its.push({ id: `it-${i}`, name: `Item ${i}`, price: 50 + Math.floor(r() * 5) * 10, groups, soldOut: r() < 0.08 });
    }
    const ids = its.map((x) => x.id as string);
    const lines: unknown[] = [];
    const nLines = 1 + Math.floor(r() * 2);
    for (let l = 0; l < nLines; l++) {
      const choice = ids.length >= 2 && r() < 0.4;
      const qty = 1 + Math.floor(r() * 2);
      if (choice) {
        const distinct = r() < 0.5 && qty <= ids.length;
        lines.push(line(`l${l}`, qty, { choice: ids, distinct, surcharge: r() < 0.5 ? "difference" : "none" }, { free: l > 0 && r() < 0.3 }));
      } else {
        const item = pick(ids);
        const it = its.find((x) => x.id === item)!;
        const rules: Record<string, unknown> = {};
        const g = (it.groups as { id: string; kind: string; perUnit?: boolean }[]).find((x) => x.kind === "text" && x.perUnit !== false);
        if (g && r() < 0.4) rules[g.id] = r() < 0.5 ? { lock: "o-a" } : { allow: ["o-a", "o-b"] };
        lines.push(line(`l${l}`, qty, { item }, { free: l > 0 && r() < 0.3, ...(Object.keys(rules).length ? { rules } : {}) }));
      }
    }
    if (!lines.some((l) => !(l as { free?: boolean }).free)) (lines[0] as { free?: boolean }).free = false;
    const parsed = PageDoc.safeParse({ v: 2, locale: "fr", market: "MA", currency: "MAD", product: { name: "P" }, items: its, offers: { bundles: [{ id: "o1", price: 200, lines }] }, form, theme, sections: [] });
    if (!parsed.success) continue;
    const doc = parsed.data;
    const offer = doc.offers.bundles[0]!;
    if (!offerAvailable(offer, doc.items)) continue;
    docs++;
    const m = offerMath(doc, offer);
    // every selection: items for choice units × every option / combination per group (fields filled when required)
    const slots = expandUnits(offer, doc.items);
    const perUnit = slots.map((s) => {
      const cands = s.item ? [s.item] : (s.choices ?? []);
      const out: { item: string; o: Record<string, string>; f: Record<string, string> }[] = [];
      for (const id of cands) {
        const it = doc.items.find((x) => x.id === id)!;
        let combos: { o: Record<string, string>; f: Record<string, string> }[] = [{ o: {}, f: {} }];
        for (const g of it.groups) {
          const vals: string[] = g.kind === "matrix" ? allCombos(g).map((c) => cellKey(c)) : g.kind === "field" ? [] : g.options.map((o) => o.id);
          if (g.kind === "field") {
            if (g.required) combos = combos.map((c) => ({ ...c, f: { ...c.f, [g.id]: "Sara" } }));
            continue;
          }
          combos = combos.flatMap((c) => vals.map((v) => ({ ...c, o: { ...c.o, [g.id]: v } })));
        }
        for (const c of combos) out.push({ item: id, ...c });
      }
      return out;
    });
    let all: { item: string; o: Record<string, string>; f: Record<string, string> }[][] = [[]];
    for (const opts of perUnit) {
      all = all.flatMap((acc) => opts.map((o) => [...acc, o]));
      if (all.length > 4000) all = all.slice(0, 4000);
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const units of all) {
      const res = resolveSelection(doc, offer, { offerId: offer.id, units, extras: {}, bump: false });
      if (res.errors.length) continue;
      selections++;
      const t = orderTotals(doc, res.selection)!;
      lo = Math.min(lo, t.subtotal);
      hi = Math.max(hi, t.subtotal);
    }
    if (all.length < 4000) {
      checked++;
      eq(`property #${seed}: from == lowest subtotal`, m.from, lo);
      eq(`property #${seed}: variable iff the highest is higher`, m.variable, hi > lo);
    }
    if (failures.length > 40) break;
  }
  console.log(`  ${docs} documents (${checked} enumerated exhaustively), ${selections} valid selections`);
  ok("property: most documents enumerated exhaustively", checked >= 450, checked);
}

/* ================================================================== */
/* D · allocate                                                        */
/* ================================================================== */
section("D · allocate");
{
  const three = page([{ id: "main", price: 1 }], [{ id: "x3", price: 1, lines: [line("l1", 3, { item: "main" })] }]);
  const a = allocate(three, three.offers.bundles[0]!, emptySelection("x3"));
  eq("100 / 3 → 34 + 33 + 33", a, [34, 33, 33]);
  eq("Σ = price", a.reduce((s, x) => s + x, 0), 100);
  const zero = page([{ id: "main", name: "M", price: 0 }, { id: "nuit", name: "N", price: 0 }], [{ id: "zz", price: 99.99, lines: [line("l1", 1, { item: "main" }), line("l2", 2, { item: "nuit" })] }], {}, { product: { name: "P" } });
  const z = allocate(zero, zero.offers.bundles[0]!, emptySelection("zz"));
  eq("Σ references 0 → equal split, exact", [z, z.reduce((s, x) => s + x, 0)], [[3333, 3333, 3333], 9999]);
  const bogo = allocate(c6, c6.offers.bundles[0]!, emptySelection("bogo"));
  eq("free units 0", bogo, [14900, 0]);
  const any2 = allocate(c6, c6.offers.bundles[1]!, { offerId: "any2", units: [{ item: "main", options: {}, fields: {} }, { item: "serum", options: {}, fields: {} }], extras: {}, bump: false });
  // 27900 × 149 / 348 = 11945.69 → 11946 (largest remainder) · 27900 × 199 / 348 = 15954.31 → 15954, + the 50 DH difference
  eq("by unit references + own deltas", [any2, any2.reduce((s, x) => s + x, 0)], [[11946, 20954], 32900]);
}

/* ================================================================== */
/* E · limits and refinements                                          */
/* ================================================================== */
section("E · limits and refinements");
{
  const bad = (name: string, items2: unknown[], bundles: unknown[], offers: Record<string, unknown> = {}) => {
    const r = PageDocObject.safeParse({ v: 2, locale: "fr", market: "MA", currency: "MAD", product: { name: "P" }, items: items2, offers: { bundles, ...offers }, form, theme, sections: [] });
    ok(`refused: ${name}`, !r.success);
  };
  const one = [line("l1", 1, { item: "main" })];
  bad("2+ items without names", [{ id: "main", price: 1 }, { id: "nuit", price: 1 }], [{ id: "oa", price: 1, lines: one }]);
  bad("duplicate item ids", [{ id: "main", name: "A", price: 1 }, { id: "main", name: "B", price: 1 }], [{ id: "oa", price: 1, lines: one }]);
  bad("3 decimals", [{ id: "main", price: 1.234 }], [{ id: "oa", price: 1, lines: one }]);
  bad("a negative delta", [{ id: "main", price: 1, groups: [{ id: "g-c", kind: "text", name: "C", options: [{ id: "o-a", label: "A", delta: -1 }] }] }], [{ id: "oa", price: 1, lines: one }]);
  bad("a required field with a delta", [{ id: "main", price: 1, groups: [{ id: "g-f", kind: "field", name: "F", required: true, delta: 5 }] }], [{ id: "oa", price: 1, lines: one }]);
  bad("3 field groups", [{ id: "main", price: 1, groups: ["g-a", "g-b", "g-c"].map((id) => ({ id, kind: "field", name: "F", required: false })) }], [{ id: "oa", price: 1, lines: one }]);
  bad("2 matrices", [{ id: "main", price: 1, groups: ["g-a", "g-b"].map((id) => ({ id, kind: "matrix", name: "M", dims: [{ id: "d-a", name: "A", values: [{ id: "o-1", label: "1" }] }, { id: "d-b", name: "B", values: [{ id: "o-1", label: "1" }] }] })) }], [{ id: "oa", price: 1, lines: one }]);
  bad("Π values > 240", [{ id: "main", price: 1, groups: [{ id: "g-m", kind: "matrix", name: "M", dims: [{ id: "d-a", name: "A", values: Array.from({ length: 16 }, (_, i) => ({ id: `o-${i}`, label: String(i) })) }, { id: "d-b", name: "B", values: Array.from({ length: 16 }, (_, i) => ({ id: `o-${i}`, label: String(i) })) }] }] }], [{ id: "oa", price: 1, lines: one }]);
  bad("distinct qty > choices", [{ id: "main", name: "A", price: 1 }, { id: "nuit", name: "B", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 3, { choice: ["main", "nuit"], distinct: true })] }]);
  bad("Σ qty > 20", [{ id: "main", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 15, { item: "main" }), line("l2", 6, { item: "main" })] }]);
  bad("no paid line", [{ id: "main", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 1, { item: "main" }, { free: true })] }]);
  bad("rules on a choice line", [{ id: "main", name: "A", price: 1 }, { id: "nuit", name: "B", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 1, { choice: ["main", "nuit"] }, { rules: { "g-c": { preset: "o-a" } } })] }]);
  bad("rules on a shared group", [{ id: "main", price: 1, groups: [{ id: "g-c", kind: "text", name: "C", perUnit: false, options: [{ id: "o-a", label: "A" }] }] }], [{ id: "oa", price: 1, lines: [line("l1", 1, { item: "main" }, { rules: { "g-c": { lock: "o-a" } } })] }]);
  bad("a preset outside allow", [{ id: "main", price: 1, groups: [{ id: "g-c", kind: "text", name: "C", options: [{ id: "o-a", label: "A" }, { id: "o-b", label: "B" }] }] }], [{ id: "oa", price: 1, lines: [line("l1", 1, { item: "main" }, { rules: { "g-c": { allow: ["o-a"], preset: "o-b" } } })] }]);
  bad("4 rules", [{ id: "main", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 1, { item: "main" }, { rules: { "g-a": { preset: "o-a" }, "g-b": { preset: "o-a" }, "g-c": { preset: "o-a" }, "g-d": { preset: "o-a" } } })] }]);
  bad("9 offers", [{ id: "main", price: 1 }], Array.from({ length: 9 }, (_, i) => ({ id: `o${i}`, price: 1, lines: one })));
  bad("a matrix cell on an unknown value (v2 write, PageDocObject)", [{ id: "main", price: 1, groups: [{ id: "g-m", kind: "matrix", name: "M", dims: [{ id: "d-a", name: "A", values: [{ id: "o-1", label: "1" }] }, { id: "d-b", name: "B", values: [{ id: "o-1", label: "1" }] }], cells: [{ v: { "d-a": "o-9" }, state: "out" }] }] }], [{ id: "oa", price: 1, lines: one }]);
  bad("an item id with a dot", [{ id: "ma.in", price: 1 }], [{ id: "oa", price: 1, lines: [line("l1", 1, { item: "ma.in" })] }]);
  bad("a crop leaving the photo", [{ id: "main", price: 1, images: [{ id: "998b0718f328c3caadde3ff7afbafd16", box: { x: 0.6, y: 0, w: 0.6, h: 1 } }] }], [{ id: "oa", price: 1, lines: one }]);
  const okDoc = PageDocObject.safeParse(clone(colors));
  ok("accepted: the colors fixture (locks, allow + preset)", okDoc.success);
}

/* ================================================================== */
/* F · warnings                                                        */
/* ================================================================== */
section("F · offerWarnings");
{
  const codes = (d: PageDocT) => offerWarnings(d).map((w) => w.code).sort();
  eq("c6 warnings", codes(c6), ["gift_not_sold", "gift_not_sold", "gift_not_sold", "no_saving"]);
  const nones = page(items, [{ id: "pick", price: 149, lines: [line("l1", 1, { choice: ["main", "serum"] })] }]);
  ok("a choice of differently priced items without surcharge → info", codes(nones).includes("choice_prices_differ"));
  const v1 = PageDoc.parse({
    v: 1,
    locale: "fr",
    market: "MA",
    currency: "MAD",
    product: { name: "P", price: 100 },
    offers: { bundles: [{ id: "x1", qty: 1, price: 100 }, { id: "x2", qty: 2, price: 210, badge: "popular" }, { id: "x2b", qty: 2, price: 190, badge: "popular", compareAt: 150 }], shippingFee: 20 },
    form,
    theme,
    sections: [],
  });
  const w = offerWarnings(v1).filter((x) => x.level === "warning").map((x) => x.message);
  eq("v1 messages kept for ×N packs", w, ["Pack x2: price per item (105) is higher than a smaller pack.", 'Pack x2: "compare at" is lower than the price.', "More than one pack is marked “popular”.", "Two packs have the same quantity."]);
  const allFree = page([{ id: "main", price: 100 }], [{ id: "oa", price: 100, freeShipping: true, lines: [line("l1", 1, { item: "main" })] }], { shippingFee: 20 });
  ok("fee > 0 and every offer free → warning", codes(allFree).includes("all_free_delivery"));
  const priced = page([{ id: "main", price: 100, groups: [{ id: "g-s", kind: "text", name: "Taille", options: [{ id: "o-m", label: "M", delta: 10 }, { id: "o-l", label: "L", delta: 20 }] }] }], [{ id: "oa", price: 150, lines: [line("l1", 1, { item: "main" })] }]);
  ok("every option of a required group adds a price → info", codes(priced).includes("every_option_priced"));
}

/* ================================================================== */
/* G · resolveCombo                                                    */
/* ================================================================== */
section("G · matrix resolution");
{
  const g = tshirt.items[0]!.groups[0]!;
  if (g.kind !== "matrix") throw new Error("tshirt fixture: matrix expected");
  const at = (col: string, sz: string) => resolveCombo(g, { "d-col": `o-${col}`, "d-size": `o-${sz}` }, tshirt.items[0]!)!;
  eq("cell key canonical (sorted by dim id)", cellKey({ "d-size": "o-xl", "d-col": "o-noir" }), "d-col=o-noir|d-size=o-xl");
  eq("parse a key in any order", parseCellKey("d-size=o-m|d-col=o-noir"), { "d-size": "o-m", "d-col": "o-noir" });
  eq("malformed keys", [parseCellKey("noir"), parseCellKey("d-col=o-noir|d-col=o-blanc"), parseCellKey("")], [null, null, null]);
  eq("Noir XL out; Blanc S not made; Blanc M sku; Blanc XL +20", [at("noir", "xl").state, at("blanc", "s").state, at("blanc", "m").sku, at("blanc", "xl").delta, at("gris", "m").sku], ["out", "none", "TS-BL-M", 2000, "TS"]);
  const wild: typeof g = {
    ...g,
    cells: [
      { v: { "d-size": "o-xl" }, state: "in" as const, delta: 25 },
      { v: { "d-col": "o-noir", "d-size": "o-xl" }, state: "in" as const, delta: 40 },
      { v: { "d-col": "o-gris" }, state: "out" as const },
      { v: { "d-col": "o-gris", "d-size": "o-s" }, state: "in" as const },
      { v: { "d-col": "o-blanc" }, state: "none" as const },
      { v: { "d-col": "o-blanc", "d-size": "o-m" }, state: "out" as const },
    ],
  };
  const w = (col: string, sz: string) => resolveCombo(wild, { "d-col": `o-${col}`, "d-size": `o-${sz}` })!;
  eq("wildcards: a size-wide delta, the more specific cell wins", [w("gris", "xl").delta, w("noir", "xl").delta, w("noir", "m").delta], [2500, 4000, 0]);
  eq("severity: a specific in cell never re-opens a wildcard out; none > out", [w("gris", "s").state, w("blanc", "m").state], ["out", "none"]);
  eq("unknown value / missing dim → null", [resolveCombo(g, { "d-col": "o-rouge", "d-size": "o-m" }), resolveCombo(g, { "d-col": "o-noir" })], [null, null]);
}

/* ================================================================== */
/* H · order texts                                                     */
/* ================================================================== */
section("H · unitsText");
{
  const u = (options: [string, string, string?][], extra: Partial<OrderUnit> = {}): OrderUnit => ({
    item: "main",
    label: "",
    options: options.map(([name, value, code]) => ({ name, value: optionText(name, value), ...(code ? { code } : {}) })),
    ...extra,
  });
  const single = (units: OrderUnit[], more: Partial<Parameters<typeof unitsText>[0]> = {}, mode: "warehouse" | "customer" = "warehouse") => unitsText({ units, multi: false, ...more }, mode);
  eq("v1 identical: 2 × Noir/M + Beige/L", single([u([["Couleur", "Noir"], ["Taille", "M"]]), u([["Couleur", "Noir"], ["Taille", "M"]]), u([["Couleur", "Beige"], ["Taille", "L"]])]), "2 × Noir/M + Beige/L");
  eq("v1 identical: a v1 row (orderText)", orderText({ bundleId: "x3", bundleLabel: "x3", qty: 3, unitPrice: 1, variants: [{ Couleur: "Noir", Taille: "M" }, { Couleur: "Beige", Taille: "L" }, { Couleur: "Noir", Taille: "M" }] }), "2 × Noir/M + Beige/L");
  eq("numeric values get their group name", single([u([["Pointure", "42"]]), u([["Pointure", "42"]]), u([["Pointure", "43"]])]), "2 × Pointure 42 + Pointure 43");
  const multi = (label: string, short: string, more: Partial<OrderUnit> = {}): OrderUnit => ({ item: short.toLowerCase(), label, short, options: [], ...more });
  eq(
    "multi-item + field + extra",
    unitsText({
      units: [multi("Crème jour", "Jour"), multi("Crème nuit", "Nuit"), multi("Sérum éclat", "Sérum", { fields: [{ name: "Prénom", value: "سارة" }] })],
      multi: true,
      extras: [{ name: "Emballage cadeau", value: "Oui", delta: 15 }],
    }),
    "1 × Jour + 1 × Nuit + 1 × Sérum · Prénom « سارة » || Commande : Emballage cadeau = Oui (+15)",
  );
  const fit = (value: string, more: Partial<OrderUnit> = {}): OrderUnit => ({ item: "main", label: "", options: [{ name: "Couleur & taille", value }], ...more });
  eq("matrix + field, single item", single([fit("Noir/M", { fields: [{ name: "Prénom à imprimer", value: "Sara" }] }), fit("Blanc/XL")]), "Noir/M · Prénom à imprimer « Sara » + Blanc/XL");
  eq("codes in the warehouse text, labels for customers", [single([u([["Couleur", "نوار", "NR"]])]), single([u([["Couleur", "نوار", "NR"]])], {}, "customer")], ["NR", "نوار"]);
  eq("BOGO multi", unitsText({ units: [multi("Rose", "Rose", { options: [{ name: "Taille", value: "50 ml" }] }), multi("Rose", "Rose", { options: [{ name: "Taille", value: "50 ml" }], free: true })], multi: true }), "1 × Rose (50 ml) + [OFFERT] 1 × Rose (50 ml)");
  eq("BOGO single", single([u([["Taille", "50 ml"]]), u([["Taille", "50 ml"]], { free: true })]), "50 ml + [OFFERT] 50 ml");
  eq("BOGO single without options", single([u([]), u([], { free: true })]), "[OFFERT] 1 pièce");
  eq("free units never merge with paid ones; free pieces counted", single([u([]), u([], { free: true }), u([], { free: true })]), "[OFFERT] 2 pièces");
  eq(
    "gift and bump",
    unitsText({ units: [multi("Crème jour", "Jour"), multi("Crème nuit", "Nuit")], multi: true, gift: { label: "Trousse de voyage" }, bump: { unit: multi("Sérum éclat", "Sérum") } }),
    "1 × Jour + 1 × Nuit + CADEAU : Trousse de voyage + [AJOUT] 1 × Sérum",
  );
  eq("upsell accepted later", unitsText({ units: [multi("Crème jour", "Jour")], multi: true, upsell: { title: "Sérum", unit: multi("Sérum éclat", "Sérum"), confirmOptions: true } }), "1 × Jour + [UPSELL] 1 × Sérum (options à confirmer)");
  eq("sanitizing owner labels", sanitizeLabel("Rose + Musc / 50ml || x · y «z»"), 'Rose & Musc - 50ml | x - y "z"');
  eq("typed values in « » (inner « » → \")", quoteValue("Sara «la» grande"), '« Sara "la" grande »');
  eq("empty paid parts dropped", single([u([]), u([])]), "");
  const long = Array.from({ length: 40 }, (_, i) => u([["Couleur", `Couleur numéro ${i} très longue`]], { fields: [{ name: "Prénom", value: "x".repeat(30) }] }));
  const capped = unitsText({ units: long, multi: false, gift: { label: "Trousse" }, orderId: "CMD-7K3Q9X", extras: [{ name: "Carte", value: "Oui" }] });
  ok("cap 1000: whole parts dropped, gift and order segment kept", Array.from(capped).length <= 1000 && /… \(\+\d+, voir CMD-7K3Q9X\) \+ CADEAU : Trousse \|\| Commande : Carte = Oui$/.test(capped), capped.slice(-120));
  eq("sheet preview of an offer (first available values)", sheetPreview(colors, colors.offers.bundles.find((o) => o.id === "colors")!), "NR/S + BL/M + GR/S");
  eq("sheet preview of the duo", duo.offers.bundles.map((o) => sheetPreview(duo, o)), ["1 × Jour", "1 × Jour + 1 × Nuit", "1 × Jour + 1 × Nuit + 1 × Sérum"]);
}

/* ================================================================== */
/* I · catalog, display, fields                                        */
/* ================================================================== */
section("I · catalog, display, fields");
{
  eq("units of a mixed offer", expandUnits(c6.offers.bundles[0]!, c6.items).map((s) => [s.k, s.lineId, s.item, s.free]), [[0, "l1", "main", false], [1, "l2", "main", true]]);
  eq("signatures", c6.offers.bundles.map((o) => offerSignature(o)), ["gift:main×1+main×1", "[main|nuit|serum;distinct;difference]×2", "main×1+nuit×1", "gift:trousse×1+main×1+nuit×1", "gift:[mini-oud|mini-rose]×1+main×1"]);
  eq("the same contents split in two lines: same signature", offerSignature({ lines: [line("a", 1, { item: "main" }), line("b", 1, { item: "main" })] as never }), "main×2");
  eq("locks are part of the signature, presets are not", offerSignature(colors.offers.bundles[1]!), "main{g-fit.d-col=o-blanc}×1+main{g-fit.d-col=o-gris}×1+main{g-fit.d-col=o-noir}×1");
  const ctx = { doc: c6 };
  eq("automatic names", c6.offers.bundles.map((o) => offerName(ctx, { ...o, title: undefined })), ["1 + 1 offert", "2 au choix", "Jour + Nuit", "Jour + Nuit + Trousse offert", "Jour + Votre cadeau"]);
  eq("automatic name: one item ×2 and a gift", offerName(ctx, { lines: [line("l1", 2, { item: "main" }), line("l2", 1, { item: "trousse" }, { free: true })] as never }), "2 × Jour + Trousse offert");
  eq("automatic short names", c6.offers.bundles.map((o) => offerShort(ctx, o)), ["x2", "2 au choix", "Duo", "Duo", "2 pièces"]);
  eq("sheet labels of multi-item offers", c6.offers.bundles.map((o) => offerSheetLabel(c6, o)), ["1 + 1 offert (x2)", "2 au choix (x2)", "Jour + Nuit (x2)", "Jour + Nuit + Trousse offert (x3)", "Jour + Votre cadeau (x2)"]);
  const v1 = getFixture("argan", { now: NOW, locale: "fr" }).doc;
  eq("v1-shaped offers: v1 names", v1.offers.bundles.map((o) => [offerName({ doc: v1 }, { ...o, title: undefined }), offerShort({ doc: v1 }, o), offerSheetLabel(v1, o)]), [["1 pièce", "x1", "x1"], ["2 pièces", "x2", "Pack Duo (x2)"], ["3 pièces", "x3", "Pack Famille (x3)"]]);
  eq("item names: '' = product name on single-item pages", [leadItem(v1).name, itemShort(v1, leadItem(v1)).length > 0], ["", true]);
  eq("content ids", [contentIdOf(v1, leadItem(v1), "pk_x"), contentIdOf(c6, c6.items[1]!, "pk_x"), contentIdOf(tshirt, tshirt.items[0]!, "pk_x")], ["ARG-30", "pk_x.nuit", "TS"]);
  eq("units", c6.offers.bundles.map((o) => offerUnits(o)), [2, 2, 2, 3, 2]);
  eq("v1 bundleMath alias = v1 numbers", bundleMath(v1, v1.offers.bundles[1]!), { id: "x2", qty: 2, total: 269, reference: 298, savings: 29, savingsPct: 10, perUnit: 134.5, showReference: true });
  eq("toCents / fromCents", [toCents(19.9), toCents(0.29), fromCents(1990)], [1990, 29, 19.9]);

  const disp = (picker: string, fill: string, n = 3, doc: PageDocT = tshirt) => {
    const d = clone(doc) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    d.offers.display = { ...d.offers.display, picker, fill };
    d.offers.bundles = d.offers.bundles.slice(0, n);
    while (d.offers.bundles.length < n) d.offers.bundles.push({ ...d.offers.bundles[0], id: `extra${d.offers.bundles.length}` });
    const r = resolveDisplay(PageDoc.parse(d), { archetype: "editorial", formVariant: "card" });
    return [r.picker, r.fill, r.density, r.notes.length];
  };
  eq("display: tiers + inline → rows (note)", disp("tiers", "inline"), ["tiers", "rows", "comfortable", 1]);
  eq("display: auto on 3 units (no multi choice) → inline in stack", disp("stack", "auto"), ["stack", "inline", "comfortable", 0]);
  eq("display: tiers with 1 offer → stack", disp("tiers", "auto", 1), ["stack", "inline", "comfortable", 1]);
  eq("display: pills with 5 offers → stack compact", disp("pills", "auto", 5), ["stack", "inline", "compact", 2]);
  eq("display: nothing to fill → none", disp("stack", "steps", 3, getFixture("parfum", { now: NOW }).doc), ["stack", "none", "comfortable", 1]);
  const box = page(items.slice(0, 3), [{ id: "any2", price: 279, lines: [line("l1", 2, { choice: ["main", "nuit", "serum"], distinct: true })] }]);
  eq("display: a choice line with qty ≥ 2 → box", resolveDisplay(box, { archetype: "bloom", formVariant: "card" }).fill, "box");

  const f = { input: "text" as const, required: true, maxLength: 12, charset: "letters" as const };
  eq("field: cleaned", checkField(f, "  Sa​ra  "), { ok: true, value: "Sa ra" });
  eq("field: required", checkField(f, " "), { ok: false, error: "required" });
  eq("field: < > refused", checkField({ ...f, charset: "any" }, "a<b"), { ok: false, error: "invalid" });
  eq("field: code points, never truncated", [checkField({ ...f, maxLength: 3 }, "😀😀😀").ok, checkField({ ...f, charset: "any", maxLength: 3 }, "abcd")], [false, { ok: false, error: "too_long" }]);
  eq("field: digits folded (Arabic, Persian)", [checkField({ input: "number", required: true, maxLength: 6, charset: "any", min: 1, max: 100 }, "٤٢"), checkField({ input: "text", required: true, maxLength: 6, charset: "digits" }, "۱۲")], [{ ok: true, value: "42" }, { ok: true, value: "12" }]);
  eq("field: number range", checkField({ input: "number", required: true, maxLength: 6, charset: "any", min: 1, max: 100 }, "101"), { ok: false, error: "invalid" });
  eq("field: latin charset", [checkField({ ...f, charset: "latin" }, "José & Co").ok, checkField({ ...f, charset: "latin" }, "سارة").ok], [true, false]);
}

console.log(failures.length ? `\n✗ ${failures.length} failure(s), ${passes} passed` : `\n✓ offers check: ${passes} passed`);
for (const x of failures.slice(0, 60)) console.log("  ✗ " + x);
process.exit(failures.length ? 1 : 0);
