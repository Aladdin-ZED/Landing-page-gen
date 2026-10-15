/**
 * Product-option helpers of the runtime:  npx tsx src/landing/runtime/selftest-variants.ts
 * (the DOM behaviour — pickers, errors, same-for-all, photo swap, memory — is exercised by a browser
 * run on a rendered page; see the order form's README notes in variants.tsx).
 *
 *  1. unitGroups / summaryText — identical units counted in first-seen order, the live line text.
 *  2. Parity with the server's variantText() (Sheets "Variante", admin, CSV): same grouping, same
 *     order, only the separators' spacing differs ("Noir / M" on the page, "Noir/M" in the sheet).
 *  3. The thank-you hand-off keeps a bounded, type-checked copy of the summary (readOrder).
 */
import { variantText } from "../../lib/orders/contract";
import type { W } from "./core";
import { readOrder, writeOrder } from "./order-store";
import { summaryText, unitGroups, type Choice } from "./variants";

let pass = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else failures.push(`${label}\n    got:  ${g}\n    want: ${w}`);
}

const c = (label: string, sw?: string): Choice => (sw ? { label, sw } : { label });
const noirM = [c("Noir", "#1d1d1f"), c("M")];
const beigeL = [c("Beige", "#d8ccb4"), c("L")];

/* 1 · grouping --------------------------------------------------------- */
eq("one unit", unitGroups([noirM]), [{ n: 1, parts: noirM }]);
eq("identical units counted", unitGroups([noirM, noirM]), [{ n: 2, parts: noirM }]);
eq("first-seen order", unitGroups([noirM, beigeL, noirM]), [
  { n: 2, parts: noirM },
  { n: 1, parts: beigeL },
]);
eq("units with nothing chosen are left out", unitGroups([[], noirM, []]), [{ n: 1, parts: noirM }]);
eq("a unit still missing its size stays apart", summaryText(unitGroups([noirM, [c("Noir")]])), "Noir / M + Noir");
eq("line text", summaryText(unitGroups([noirM, noirM, beigeL])), "2 × Noir / M + Beige / L");
eq("empty", summaryText(unitGroups([])), "");
eq("labels that look like keys", summaryText(unitGroups([[c("__proto__")], [c("constructor")], [c("__proto__")]])), "2 × __proto__ + constructor");

/* 2 · parity with the sheet text ------------------------------------------ */
const labels = ["Noir", "Beige", "أسود", "S", "M", "XL", "Taille unique"];
let seed = 7;
const rnd = (n: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed % n;
};
for (let k = 0; k < 200; k++) {
  const qty = 1 + rnd(4);
  const groups = 1 + rnd(3);
  const units: Choice[][] = [];
  for (let u = 0; u < qty; u++) units.push(Array.from({ length: groups }, () => c(labels[rnd(labels.length)]!)));
  const records = units.map((parts) => Object.fromEntries(parts.map((p, i) => [`g${i}`, p.label])));
  const page = summaryText(unitGroups(units)).split(" / ").join("/");
  if (page !== variantText(records)) {
    eq(`parity #${k}`, page, variantText(records));
    break;
  }
  pass++;
}

/* 3 · thank-you hand-off -------------------------------------------------- */
const store = new Map<string, string>();
const win = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
} as unknown as W;
const rec = {
  orderId: "CMD-TEST01",
  name: "Salma",
  total: 359,
  currency: "MAD",
  bundleLabel: "x2",
  items: "x2",
  qty: 2,
  options: unitGroups([noirM, beigeL]),
  eventId: "ev-1",
  ts: 1,
  pageKey: "pk",
};
writeOrder(win, rec);
eq("options survive the hand-off", readOrder(win)?.options, rec.options);
store.set(
  "lp-order",
  JSON.stringify({
    ...rec,
    options: [
      { n: 99, parts: [{ label: "x".repeat(80), sw: "red;background:url(x)" }, { label: 5 }, { label: "M" }, { label: "L" }, { label: "XL" }] },
      { n: "2", parts: "nope" },
      null,
    ],
  }),
);
eq("hostile options are bounded and cleaned", readOrder(win)?.options, [
  { n: 20, parts: [{ label: "x".repeat(40) }, { label: "M" }] },
]);
store.set("lp-order", JSON.stringify({ ...rec, options: "nope" }));
eq("non-array options dropped", readOrder(win)?.options, undefined);

console.log(`runtime variants selftest: ${pass} passed, ${failures.length} failed`);
for (const f of failures) console.error("  ✗ " + f);
process.exit(failures.length ? 1 : 0);
