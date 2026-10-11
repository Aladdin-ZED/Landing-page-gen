/**
 * Runtime pure-helper self-test:  npx tsx src/landing/runtime/selftest.ts
 * Covers phone normalization (MA + other markets), money formatting, totals parity with
 * src/lib/page/pricing.ts, id generation, locale-preserving number formatting, the countdown's
 * plural day label, LTR isolates in Arabic runtime strings and the sticky-header scroll offset.
 */
import { webcrypto } from "node:crypto";
import { bundleMath, orderTotals } from "../../lib/page/pricing";
import { Offers, Product } from "../../lib/page/schema";
import { createT, pluralForms } from "../i18n";
import type { LandingRuntimeConfig, RuntimeBundle } from "./config";
import type { Ctx } from "./core";
import { randomId, uuid } from "./ids";
import { computeTotals, formatMoney } from "./money";
import { NUM_RUN, formatNum, numStyle, toAsciiDigits } from "./numbers";
import { normalizePhone } from "./phone";
import { headerOffset } from "./scroll";
import { RUNTIME_UI_KEYS } from "./strings";

let pass = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else failures.push(`${label}\n    got:  ${g}\n    want: ${w}`);
}

/* ---------------- phone ---------------- */
const MA = { prefix: "+212", national: "^0[5-7][0-9]{8}$" };
const mobile = { national: "0612345678", e164: "+212612345678" };
const maCases: [string, string, { national: string; e164: string } | null][] = [
  ["national", "0612345678", mobile],
  ["spaces", "06 12 34 56 78", mobile],
  ["dashes", "06-12-34-56-78", mobile],
  ["dots", "06.12.34.56.78", mobile],
  ["parentheses", "(06) 12 34 56 78", mobile],
  ["nbsp + tabs", "06 12\t34 56 78", mobile],
  ["Arabic-Indic digits", "٠٦١٢٣٤٥٦٧٨", mobile],
  ["Persian digits", "۰۶۱۲ ۳۴۵۶ ۷۸", mobile],
  ["mixed digits", "06 ١٢ 34 ٥٦ 78", mobile],
  ["bidi marks", "‎0612345678‏", mobile],
  ["Arabic letter mark (pasted from Arabic text)", "؜٠٦١٢٣٤٥٦٧٨؜", mobile],
  ["zero-width chars", "06​12‌34‍56⁠78", mobile],
  ["unicode dashes", "06‑12–34−56 78", mobile],
  ["+212", "+212612345678", mobile],
  ["+212 spaced", "+212 6 12 34 56 78", mobile],
  ["+212 with trunk 0", "+212 0612345678", mobile],
  ["+212 Arabic digits", "+٢١٢٦١٢٣٤٥٦٧٨", mobile],
  ["00212", "00212612345678", mobile],
  ["00212 with trunk 0", "002120612345678", mobile],
  ["212 without plus", "212612345678", mobile],
  ["missing trunk 0", "612345678", mobile],
  ["07 mobile", "07 12 34 56 78", { national: "0712345678", e164: "+212712345678" }],
  ["05 landline", "05 22 12 34 56", { national: "0522123456", e164: "+212522123456" }],
  ["landline +212", "+212 5 22 12 34 56", { national: "0522123456", e164: "+212522123456" }],
  ["invalid 08 prefix", "0812345678", null],
  ["too short", "061234567", null],
  ["too long", "06123456789", null],
  ["letters", "06123a5678", null],
  ["empty", "", null],
  ["garbage", "phone", null],
  ["French number", "+33612345678", null],
  ["other intl prefix", "0033612345678", null],
  ["short +212", "+21261234567", null],
];
for (const [label, input, want] of maCases) eq(`phone MA: ${label} (${input})`, normalizePhone(input, MA), want);

eq("phone FR: +33", normalizePhone("+33 6 12 34 56 78", { prefix: "+33", national: "^0[1-9][0-9]{8}$" }), {
  national: "0612345678",
  e164: "+33612345678",
});
eq("phone FR: 0033", normalizePhone("0033612345678", { prefix: "+33", national: "^0[1-9][0-9]{8}$" }), {
  national: "0612345678",
  e164: "+33612345678",
});
eq("phone FR: national", normalizePhone("06 12 34 56 78", { prefix: "+33", national: "^0[1-9][0-9]{8}$" }), {
  national: "0612345678",
  e164: "+33612345678",
});
eq("phone ES: no trunk 0", normalizePhone("+34 612 345 678", { prefix: "+34", national: "^[6-9][0-9]{8}$" }), {
  national: "612345678",
  e164: "+34612345678",
});
eq("phone ES: national", normalizePhone("612345678", { prefix: "+34", national: "^[6-9][0-9]{8}$" }), {
  national: "612345678",
  e164: "+34612345678",
});
eq("phone IT: landline keeps 0", normalizePhone("06 1234 5678", { prefix: "+39", national: "^(3[0-9]{8,9}|0[0-9]{5,10})$" }), {
  national: "0612345678",
  e164: "+390612345678",
});
eq("phone: broken regex → null", normalizePhone("0612345678", { prefix: "+212", national: "([" }), null);

/* ---------------- money ---------------- */
const MAD_AR = { locale: "ar-MA", symbol: "درهم", position: "after" as const, decimals: 0 };
const MAD_FR = { locale: "fr-MA", symbol: "DH", position: "after" as const, decimals: 0 };
const EUR_FR = { locale: "fr-FR", symbol: "€", position: "after" as const, decimals: 2 };
const nb = " ";
eq("money MAD ar", formatMoney(249, MAD_AR), "249" + nb + "درهم");
eq("money MAD ar thousands", formatMoney(1249, MAD_AR), "1.249" + nb + "درهم");
eq("money MAD ar latin digits even for bare 'ar'", formatMoney(1249, { ...MAD_AR, locale: "ar-EG" }), "1,249" + nb + "درهم");
eq("money MAD ar explicit arab digits", formatMoney(249, { ...MAD_AR, locale: "ar-u-nu-arab" }), "٢٤٩" + nb + "درهم");
eq("money MAD fr", formatMoney(249, MAD_FR), "249" + nb + "DH");
eq("money MAD fr thousands", formatMoney(1249, MAD_FR), "1.249" + nb + "DH");
eq("money MAD cents never hidden", formatMoney(249.5, MAD_FR), "249,50" + nb + "DH");
eq("money MAD zero", formatMoney(0, MAD_FR), "0" + nb + "DH");
eq("money EUR fr", formatMoney(24.9, EUR_FR), "24,90" + nb + "€");
eq("money EUR fr thousands", formatMoney(1249.5, EUR_FR), "1 249,50" + nb + "€");
eq("money symbol before (1 char)", formatMoney(10, { locale: "en-US", symbol: "$", position: "before", decimals: 2 }), "$10.00");
eq("money symbol before (word)", formatMoney(10, { locale: "en-US", symbol: "MAD", position: "before", decimals: 0 }), "MAD" + nb + "10");
eq("money NaN → 0", formatMoney(Number.NaN, EUR_FR), "0,00" + nb + "€");
eq("money bad locale falls back", formatMoney(5, { locale: "!!", symbol: "", position: "after", decimals: 0 }), "5");

/* ---------------- totals vs pricing.ts ---------------- */
const product = Product.parse({ name: "Huile d'argan", price: 199 });
const offerVariants = [
  { shippingFee: 0, bump: true },
  { shippingFee: 25, bump: true },
  { shippingFee: 19.9, bump: false },
];
for (const v of offerVariants) {
  const offers = Offers.parse({
    bundles: [
      { id: "b1", qty: 1, price: 199 },
      { id: "b2", qty: 2, price: 349, badge: "popular", compareAt: 398 },
      { id: "b3", qty: 3, price: 479.9, title: "Pack Famille" },
    ],
    shippingFee: v.shippingFee,
    orderBump: { enabled: v.bump, title: "Pochette", price: 49.5 },
  });
  // what the renderer embeds: bundleMath per bundle, bump only when enabled
  const bundles: RuntimeBundle[] = offers.bundles.map((b) => {
    const m = bundleMath(b, product.price);
    return { ...m, label: `x${b.qty}` };
  });
  const cfg: Pick<LandingRuntimeConfig, "bundles" | "bump" | "shippingFee"> = {
    bundles,
    shippingFee: offers.shippingFee,
    bump: offers.orderBump && offers.orderBump.enabled ? { price: offers.orderBump.price, title: offers.orderBump.title } : undefined,
  };
  for (const b of offers.bundles)
    for (const withBump of [false, true]) {
      const ref = orderTotals(product, offers, b.id, withBump)!;
      const got = computeTotals(cfg, b.id, withBump)!;
      const label = `totals ${b.id} ship=${v.shippingFee} bumpEnabled=${v.bump} withBump=${withBump}`;
      eq(label, [got.bundle, got.bump, got.shipping, got.subtotal, got.total, got.qty], [
        ref.bundle.total,
        ref.bump,
        ref.shipping,
        ref.subtotal,
        ref.total,
        ref.bundle.qty,
      ]);
    }
  eq(`totals unknown bundle (ship=${v.shippingFee})`, computeTotals(cfg, "nope", false), orderTotals(product, offers, "nope", false));
}

/* ---------------- ids ---------------- */
const UUID_V4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CONTRACT_IDEM = /^[a-f0-9-]{36}$/;
const CONTRACT_EVENT = /^[a-zA-Z0-9_-]{8,64}$/;
const viaRandomUUID = uuid(webcrypto as unknown as Crypto);
const viaGetRandomValues = uuid({ getRandomValues: webcrypto.getRandomValues.bind(webcrypto) as Crypto["getRandomValues"] });
const viaMathRandom = uuid(null);
for (const [label, id] of [
  ["randomUUID", viaRandomUUID],
  ["getRandomValues", viaGetRandomValues],
  ["Math.random", viaMathRandom],
] as const) {
  eq(`uuid v4 via ${label}`, UUID_V4.test(id), true);
  eq(`uuid matches idem contract via ${label}`, CONTRACT_IDEM.test(id) && CONTRACT_EVENT.test(id), true);
}
eq("uuid unique", new Set(Array.from({ length: 200 }, () => uuid(null))).size, 200);
const vid = randomId(22, webcrypto as unknown as Crypto);
eq("visitor id format", /^[a-zA-Z0-9_-]{22}$/.test(vid), true);

/* ---------------- locale-preserving numbers (count roll-up / countdown) ---------------- */
eq("toAsciiDigits", toAsciiDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹"), "0123456789 0123456789");
const run = (s: string) => NUM_RUN.exec(s)![0];
eq("NUM_RUN finds grouped number", run("+12 000 clients"), "12 000");
eq("NUM_RUN stops at trailing text", run("98 % satisfaits"), "98");
eq("count: grouped latin", formatNum(5300.4, 0, numStyle("12 000", 0)), "5 300");
eq("count: comma decimal", formatNum(3.14159, 1, numStyle("4,8", 1)), "3,1");
eq("count: dot decimal", formatNum(2.5, 1, numStyle("4.8", 1)), "2.5");
eq("count: Arabic-Indic grouped", formatNum(7000, 0, numStyle("١٢٬٠٠٠", 0)), "٧٬٠٠٠");
eq("count: no grouping kept", formatNum(1999, 0, numStyle("2024", 0)), "1999");
eq("count: zero", formatNum(0, 0, numStyle("12 000", 0)), "0");

/* ---------------- countdown day label (plural forms re-picked by the runtime) ---------------- */
eq("plural forms fr", pluralForms("fr", "urgency.days"), { other: "jours", one: "jour" });
eq("plural forms ar (only forms differing from other)", pluralForms("ar", "urgency.days"), { other: "يوم", two: "يومين", few: "أيام" });
eq("plural forms of a plain string", pluralForms("fr", "form.title"), null);
for (const loc of ["fr", "ar", "en"] as const) {
  const forms = pluralForms(loc, "urgency.days")!;
  const rules = new Intl.PluralRules(loc);
  const t = createT(loc);
  for (const n of [0, 1, 2, 3, 7, 11, 25, 100, 101])
    eq(`day label ${loc} n=${n}: runtime pick = server t()`, forms[rules.select(n)] ?? forms.other, t("urgency.days", { n }));
}

/* ---------------- Arabic plain-text strings keep numeric runs in LTR isolates ---------------- */
const LRI = String.fromCharCode(0x2066);
const PDI = String.fromCharCode(0x2069);
const tAr = createT("ar");
eq("ar form.errPhone isolates the example", tAr("form.errPhone").includes(LRI + "06 12 34 56 78" + PDI), true);
eq("ar trust.delivery isolates the range", tAr("trust.delivery").includes(LRI + "24–48" + PDI), true);
eq("ar bundle.savePct isolates the signed percent", tAr("bundle.savePct", { pct: 30 }), LRI + "−30%" + PDI);
// every string the runtime writes as plain text: no bare digit group / range / signed number left
const BARE_RUN = /\d[\s\u{a0}\u{202f}\-\u{2010}-\u{2015}\/:]+\d|[+\-\u{2212}]\d|\d%/u;
for (const key of RUNTIME_UI_KEYS) {
  const v = tAr(key);
  const outside = v.replace(new RegExp(LRI + "[^" + PDI + "]*" + PDI, "g"), "");
  eq(`ar runtime string "${key}" has no un-isolated numeric run`, BARE_RUN.test(outside), false);
  eq(`ar runtime string "${key}" isolates are balanced`, v.split(LRI).length, v.split(PDI).length);
}

/* ---------------- headerOffset: visible part of a sticky/fixed header ---------------- */
interface FakeHeader {
  position: string;
  top: string;
  rect: { top: number; height: number };
}
function offsetFor(headers: FakeHeader[], innerHeight = 800): number {
  const els = headers.map((h) => ({
    h,
    getBoundingClientRect: () => ({ top: h.rect.top, bottom: h.rect.top + h.rect.height, height: h.rect.height }),
  }));
  const c = {
    doc: { querySelectorAll: () => els },
    win: { innerHeight, getComputedStyle: (el: { h: FakeHeader }) => ({ position: el.h.position, top: el.h.top }) },
  } as unknown as Ctx;
  return headerOffset(c);
}
eq("headerOffset sticky top 0", offsetFor([{ position: "sticky", top: "0px", rect: { top: 0, height: 64 } }]), 64);
eq("headerOffset sticky not yet stuck (page top)", offsetFor([{ position: "sticky", top: "0px", rect: { top: 36, height: 64 } }]), 64);
eq("headerOffset sticky with negative top (eyebrow rides above)", offsetFor([{ position: "sticky", top: "-28px", rect: { top: 36, height: 92 } }]), 64);
eq("headerOffset floating sticky bar (positive top)", offsetFor([{ position: "sticky", top: "12px", rect: { top: 12, height: 56 } }]), 68);
eq("headerOffset sticky top auto", offsetFor([{ position: "sticky", top: "auto", rect: { top: 0, height: 60 } }]), 60);
eq("headerOffset fixed at the top", offsetFor([{ position: "fixed", top: "0px", rect: { top: 0, height: 60 } }]), 60);
eq("headerOffset fixed bar at the bottom is no header", offsetFor([{ position: "fixed", top: "740px", rect: { top: 740, height: 60 } }]), 0);
eq("headerOffset static header", offsetFor([{ position: "static", top: "auto", rect: { top: 0, height: 60 } }]), 0);
eq("headerOffset too tall (≥ ⅓ viewport)", offsetFor([{ position: "sticky", top: "0px", rect: { top: 0, height: 300 } }]), 0);
eq("headerOffset hidden header", offsetFor([{ position: "sticky", top: "0px", rect: { top: 0, height: 0 } }]), 0);
eq(
  "headerOffset largest wins",
  offsetFor([
    { position: "sticky", top: "-20px", rect: { top: 0, height: 90 } },
    { position: "fixed", top: "0px", rect: { top: 0, height: 56 } },
  ]),
  70,
);

/* ---------------- report ---------------- */
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${pass} passed\n  - ${failures.join("\n  - ")}`);
  process.exitCode = 1;
} else console.log(`✓ runtime selftest: all ${pass} checks passed`);
