/**
 * Runtime ↔ server parity, in cents:  npx tsx src/landing/runtime/selftest-parity.ts
 *
 *  1. The §C.5–C.6 cases: card numbers in the config (from, "Dès", struck reference, savings, per-unit)
 *     and named selections (Jour + Sérum = 329, XL +20, the owner's trio…) through computeTotals.
 *  2. 500 seeded random selections per document: runtime computeTotals / unitsDeltas (reasons) /
 *     allocate / unitsText("customer") == the server's orderTotals / allocate / unitsText.
 *  3. Each selection as the payload v2 the runtime sends → the server's validateOrder accepts it and
 *     prices it at the total shown (`st`), the stored units text equals the runtime's.
 */
import { expandUnits } from "../../lib/page/catalog";
import { availableCombos, availableOptions, ruleLock } from "../../lib/page/options";
import { allocate as serverAllocate, orderTotals, type Selection } from "../../lib/page/pricing";
import { isChoiceGroup, isFieldGroup, isMatrixGroup, type Item } from "../../lib/page/schema";
import { orderUnitOf, unitsText as serverText, type TextExtra } from "../../lib/orders/text";
import { validateOrder } from "../../lib/orders/validate";
import type { OrderPayloadV2 } from "../../lib/orders/contract";
import { allocate, computeTotals, fmtCents, offerOf, type Sel } from "./money";
import { selText, unitsText } from "./units-text";
import { colors, duo, kitchen, tee, tshirt, type Doc } from "./selftest-cases";
import { testConfig } from "./selftest-config";

let pass = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else if (failures.length < 40) failures.push(`${label}\n    got:  ${g}\n    want: ${w}`);
  else if (failures.length === 40) failures.push("… more failures");
}

/* ---------------- 1 · named cases ---------------- */
const card = (doc: Doc, id: string) => {
  const o = offerOf(testConfig(doc), id)!;
  return { from: o.from, variable: !!o.variable, reference: o.reference, savings: o.savings, savingsPct: o.savingsPct, perUnit: o.perUnit ?? null };
};
const total = (doc: Doc, sel: Sel) => computeTotals(testConfig(doc), sel)!;
const u = (item: string, options: Record<string, string> = {}, fields: Record<string, string> = {}) => ({ item, options, fields });

{
  const d = duo();
  // the owner's example (§C.5): one from 149, no struck price; duo ref 298 → −49 (−16%); trio ref 497 → −148 (−30%), no per-unit
  eq("owner: one", card(d, "one"), { from: 14900, variable: false, reference: 14900, savings: 0, savingsPct: 0, perUnit: null });
  eq("owner: duo", card(d, "duo"), { from: 24900, variable: false, reference: 29800, savings: 4900, savingsPct: 16, perUnit: null });
  eq("owner: trio", card(d, "trio"), { from: 34900, variable: false, reference: 49700, savings: 14800, savingsPct: 30, perUnit: null });
  eq("owner: fee 0 → delivery free on every offer", testConfig(d).bundles.map((b) => b.free), [true, true, true]);
  eq("owner: one, nuit chosen", total(d, { offerId: "one", units: [u("nuit")], extras: {}, bump: false }).total, 14900);
}
{
  const k = kitchen();
  // BOGO: ref 298 → −149 (−50%), 75 DH a piece (MAD display rounds the 7450 cents)
  eq("bogo card", card(k, "bogo"), { from: 14900, variable: true, reference: 29800, savings: 14900, savingsPct: 50, perUnit: 7450 });
  eq("bogo: the free piece's Dorée pays nothing", total(k, { offerId: "bogo", units: [u("main", { "g-tone": "o-claire" }), u("main", { "g-tone": "o-doree" })], extras: {}, bump: false }).total, 14900);
  eq("bogo: the paid piece's Dorée +10", total(k, { offerId: "bogo", units: [u("main", { "g-tone": "o-doree" }), u("main", { "g-tone": "o-claire" })], extras: {}, bump: false }).total, 15900);
  // any 2 of 3, distinct, pricier ones cost their difference: base 298 → −19; card "Dès 279"; Jour + Sérum = 329
  // one choice set for both units: a per-unit price is honest (§C.3)
  eq("any2 card", card(k, "any2"), { from: 27900, variable: true, reference: 29800, savings: 1900, savingsPct: 6, perUnit: 13950 });
  const any = total(k, { offerId: "any2", units: [u("main", { "g-tone": "o-claire" }), u("serum", { "g-size": "o-30" })], extras: {}, bump: false });
  eq("any2: Jour + Sérum = 329", [any.total, any.reasons.map((r) => [r.label, r.count, r.cents])], [32900, [["Sérum", 1, 5000]]]);
  // gift-wrap extra (+15) in scope of duo, the sérum bump (99) with its options (never charged)
  const duoSel: Sel = { offerId: "duo", units: [u("main", { "g-tone": "o-doree" }), u("nuit")], extras: { "g-wrap": "o-yes" }, bump: true, bumpUnit: u("serum", { "g-size": "o-50" }, { "g-name": "Sara" }) };
  const t = total(k, duoSel);
  eq("duo + Dorée + wrap + bump", [t.price, t.deltas, t.bump, t.total, t.reasons.map((r) => r.label)], [24900, 2500, 9900, 37300, ["Dorée", "Emballage cadeau"]]);
  eq("extras out of scope are ignored", total(k, { offerId: "one", units: [u("main", { "g-tone": "o-claire" })], extras: { "g-wrap": "o-yes" }, bump: false }).total, 14900);
  eq("bump not offered with trio", total(k, { offerId: "trio", units: [u("main", { "g-tone": "o-claire" }), u("nuit"), u("serum", { "g-size": "o-30" })], extras: {}, bump: true }).bump, 0);
  // shared group on the sérum (perUnit: false, 50 ml +40) counts per paid unit; the field once filled +30
  const tr = total(k, { offerId: "trio", units: [u("main", { "g-tone": "o-claire" }), u("nuit"), u("serum", { "g-size": "o-50" }, { "g-name": "Sara" })], extras: { "g-wrap": "o-no" }, bump: false });
  eq("trio + 50 ml + Prénom", [tr.total, tr.reasons.map((r) => [r.label, r.count, r.cents])], [41900, [["Prénom", 1, 3000], ["50 ml", 1, 4000]]]);
  eq("gift reaches the text", unitsText(selText(testConfig(k), { offerId: "combo", units: [u("main", { "g-tone": "o-claire" }), u("nuit")], extras: {}, bump: false })), "1 × Jour (Claire) + 1 × Nuit + CADEAU : Trousse de voyage offerte");
}
{
  const t = tee(30);
  // ×2 same item, color/size per piece: ref 258 → −29; XL +20 → "Dès 229"
  eq("x2 card", card(t, "x2"), { from: 22900, variable: true, reference: 25800, savings: 2900, savingsPct: 11, perUnit: 11450 });
  const x2 = total(t, { offerId: "x2", units: [u("main", { "g-fit": "d-col=o-blanc|d-size=o-xl" }), u("main", { "g-fit": "d-col=o-gris|d-size=o-m" }, { "g-name": "Sara" })], extras: {}, bump: false });
  eq("x2: XL +20, Prénom +30, delivery 30", [x2.subtotal, x2.shipping, x2.total, x2.reasons.map((r) => [r.label, r.cents])], [27900, 3000, 30900, [["XL", 2000], ["Prénom à imprimer", 3000]]]);
  eq("x2 text", unitsText(selText(testConfig(t), { offerId: "x2", units: [u("main", { "g-fit": "d-col=o-blanc|d-size=o-xl" }), u("main", { "g-fit": "d-col=o-gris|d-size=o-m" }, { "g-name": "Sara" })], extras: {}, bump: false })), "Blanc/XL + Gris/M · Prénom à imprimer « Sara »");
}
{
  const c = colors("fr");
  const cfg = testConfig(c);
  const o = offerOf(cfg, "colors")!;
  eq("colors: locks per line", o.units.map((x) => x.rules), [{ "g-fit.d-col": { lock: "o-noir" } }, { "g-fit.d-col": { lock: "o-blanc" } }, { "g-fit.d-col": { lock: "o-gris" } }]);
  const p = offerOf(cfg, "x3-promo")!;
  eq("x3-promo: allow + preset on every unit", p.units.map((x) => x.rules), [0, 1, 2].map(() => ({ "g-fit.d-col": { allow: ["o-noir", "o-gris"], preset: "o-noir" } })));
}

/* ---------------- 2 + 3 · random selections ---------------- */
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
const NAMES = ["Sara", "Yassine", "سارة", "Lina", "Omar", "Zineb", "Éloïse"];

/** A random valid selection (what a shopper can pick): shared values copied into every unit of their item. */
function randomSel(doc: Doc, r: () => number): Sel {
  const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;
  const offers = doc.offers.bundles;
  const offer = pick(offers);
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const shared = new Map<string, { options: Record<string, string>; fields: Record<string, string> }>();
  const usedInLine = new Map<string, Set<string>>();
  const units = expandUnits(offer, doc.items).map((s) => {
    let itemId = s.item;
    if (!itemId) {
      const taken = usedInLine.get(s.lineId) ?? new Set<string>();
      const cands = (s.available ?? []).filter((id) => !s.distinct || !taken.has(id));
      itemId = pick(cands.length ? cands : s.available!);
      taken.add(itemId);
      usedInLine.set(s.lineId, taken);
    }
    const it = byId.get(itemId)!;
    const sh = shared.get(it.id) ?? { options: {}, fields: {} };
    const options: Record<string, string> = {};
    const fields: Record<string, string> = {};
    for (const g of it.groups) {
      const rules = g.perUnit ? s.rules : undefined;
      if (!g.perUnit && (sh.options[g.id] !== undefined || sh.fields[g.id] !== undefined)) {
        if (sh.options[g.id]) options[g.id] = sh.options[g.id]!;
        if (sh.fields[g.id]) fields[g.id] = sh.fields[g.id]!;
        continue;
      }
      if (isChoiceGroup(g)) {
        const lock = ruleLock(rules?.[g.id]);
        options[g.id] = lock ?? pick(availableOptions(g, rules)).id;
      } else if (isMatrixGroup(g)) options[g.id] = pick(availableCombos(g, rules, it)).key;
      else if (isFieldGroup(g) && (g.required || r() < 0.5)) fields[g.id] = pick(NAMES).slice(0, g.maxLength);
      if (!g.perUnit) {
        if (options[g.id]) sh.options[g.id] = options[g.id]!;
        if (fields[g.id]) sh.fields[g.id] = fields[g.id]!;
        shared.set(it.id, sh);
      }
    }
    return { item: it.id, options, fields };
  });
  const extras: Record<string, string> = {};
  for (const x of doc.offers.extras) {
    if (x.scope !== "all" && !x.scope.includes(offer.id)) continue;
    if (isChoiceGroup(x)) extras[x.id] = pick(availableOptions(x)).id;
    else if (r() < 0.5) extras[x.id] = pick(NAMES);
  }
  const b = doc.offers.orderBump;
  const bump = !!b?.enabled && (!b.offers || b.offers.includes(offer.id)) && r() < 0.5;
  let bumpUnit: Sel["bumpUnit"];
  if (bump && b?.item) {
    const it = byId.get(b.item)!;
    bumpUnit = { item: it.id, options: {}, fields: {} };
    for (const g of it.groups) {
      if (isChoiceGroup(g)) bumpUnit.options[g.id] = pick(availableOptions(g)).id;
      else if (isMatrixGroup(g)) bumpUnit.options[g.id] = pick(availableCombos(g, undefined, it)).key;
      else if (isFieldGroup(g) && (g.required || r() < 0.5)) bumpUnit.fields[g.id] = pick(NAMES).slice(0, g.maxLength);
    }
  }
  return { offerId: offer.id, units, extras, bump, ...(bumpUnit ? { bumpUnit } : {}) };
}

/** The server's customer text of a selection, built like validateOrder stores it. */
function serverCustomerText(doc: Doc, sel: Selection): string {
  const offer = doc.offers.bundles.find((o) => o.id === sel.offerId)!;
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const units = expandUnits(offer, doc.items).map((s, k) => orderUnitOf(doc, byId.get(sel.units[k]!.item)! as Item, sel.units[k]!, s.free));
  const extras: TextExtra[] = [];
  for (const x of doc.offers.extras) {
    const v = sel.extras[x.id];
    if (!v || (x.scope !== "all" && !x.scope.includes(offer.id))) continue;
    if (isChoiceGroup(x)) {
      const o = x.options.find((c) => c.id === v)!;
      extras.push({ name: x.name, value: o.label, ...(o.delta ? { delta: o.delta } : {}) });
    } else extras.push({ name: x.name, value: v, typed: true, ...(x.delta ? { delta: x.delta } : {}) });
  }
  const b = doc.offers.orderBump;
  const bumpOn = sel.bump && !!b?.enabled && (!b.offers || b.offers.includes(offer.id));
  const bumpUnit = bumpOn && b?.item && sel.bumpUnit ? orderUnitOf(doc, byId.get(b.item)!, sel.bumpUnit, true) : null;
  if (bumpUnit) delete bumpUnit.free;
  return serverText({ units, multi: doc.items.length > 1, gift: offer.gift ?? null, bump: bumpUnit ? { unit: bumpUnit } : null, extras }, "customer");
}

const DOCS: [string, Doc][] = [
  ["duo fr", duo("fr")],
  ["duo ar", duo("ar")],
  ["tshirt fr", tshirt("fr")],
  ["colors ar", colors("ar")],
  ["kitchen fee 0", kitchen(0)],
  ["kitchen fee 25", kitchen(25)],
  ["tee fee 30", tee(30)],
];

let validated = 0;
for (const [name, doc] of DOCS) {
  const cfg = testConfig(doc);
  const r = rng(name.length * 7919 + 17);
  for (let i = 0; i < 500; i++) {
    const sel = randomSel(doc, r);
    const label = `${name} #${i} ${sel.offerId}`;
    const rt = computeTotals(cfg, sel)!;
    const sv = orderTotals(doc, sel as Selection)!;
    eq(`${label} totals`, [rt.price, rt.deltas, rt.bump, rt.shipping, rt.subtotal, rt.total], [sv.offer.price, sv.deltas, sv.bump, sv.shipping, sv.subtotal, sv.total]);
    eq(`${label} reasons`, rt.reasons.map((x) => [x.label, x.count, x.cents]), sv.reasons.map((x) => [x.label, x.count, x.cents]));
    const offer = doc.offers.bundles.find((o) => o.id === sel.offerId)!;
    eq(`${label} allocate`, allocate(cfg, sel, rt.perUnit), serverAllocate(doc, offer, sel as Selection));
    eq(`${label} text`, unitsText(selText(cfg, sel)), serverCustomerText(doc, sel as Selection));
    // the payload the runtime sends, validated by the server against the same doc
    if (i % 5 === 0) {
      const slots = cfg.bundles.find((b) => b.id === sel.offerId)!.units;
      const payload: OrderPayloadV2 = {
        v: 2,
        st: rt.total,
        pageKey: cfg.pageKey,
        idem: "0f8fad5b-d9cb-469f-a165-70867728950e",
        eventId: "evt_0123456789",
        bundleId: sel.offerId,
        bump: sel.bump,
        units: sel.units.map((x, k) => ({ ...(slots[k]!.item ? {} : { item: x.item }), o: x.options, f: x.fields })),
        extras: sel.extras,
        ...(sel.bump && sel.bumpUnit ? { b: { o: sel.bumpUnit.options, f: sel.bumpUnit.fields } } : {}),
        name: "Sara Bennani",
        phone: "+212612345678",
        city: "Casablanca",
        address: "12 rue des Fleurs, Maarif",
        t: 41_000,
        utm: {},
      };
      const v = validateOrder(payload, doc);
      eq(`${label} server accepts the payload`, v.ok ? "ok" : v.fields, "ok");
      if (v.ok) {
        validated++;
        eq(`${label} server total == st`, v.value.totals.total, payload.st);
      }
    }
  }
}

// MAD display: per-unit 7450 cents → "75 DH" on cards is the renderer's rounding; the runtime prints exact cents
const mad = testConfig(duo()).money;
eq("fmtCents MAD whole", fmtCents(24900, mad).replace(/\s/g, " "), "249 DH");
eq("fmtCents MAD cents kept", fmtCents(7450, mad).replace(/\s/g, " "), "74,50 DH");

if (failures.length) {
  console.error(`runtime parity: ${failures.length} failure(s), ${pass} passed\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log(`runtime parity: ${pass} checks passed (${DOCS.length} documents × 500 selections, ${validated} payloads validated by the server)`);
