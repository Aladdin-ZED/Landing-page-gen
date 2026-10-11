/**
 * Money parity check — a price written by the server (ctx.money, markets formatMoney) and the same
 * price re-written in the browser by the runtime (formatMoney(amount, config.money)) must be
 * byte-identical: Latin digits, U+00A0 between amount and symbol, cents only when there are some.
 *
 *   npx tsx scripts/qa/money-parity.ts        (exit code 1 on any mismatch)
 */
import { createRenderContext, fixtureAssetResolver, PREVIEW_LINKS } from "@/landing/context";
import { formatMoney as runtimeFormat } from "@/landing/runtime/money";
import { formatMoney } from "@/lib/markets/info";
import { getFixture } from "@/lib/page/fixtures";
import type { Locale } from "@/lib/page/schema";
import { buildRuntimeConfig } from "@/lib/render/config";

const CASES: [currency: string, locale: Locale][] = [
  ["MAD", "ar"],
  ["MAD", "fr"],
  ["MAD", "en"],
  ["EUR", "fr"],
  ["EUR", "nl"],
  ["EUR", "de"],
  ["EUR", "en"],
  ["EUR", "es"],
  ["EUR", "it"],
  ["EUR", "pt"],
  ["USD", "en"],
  ["TND", "fr"],
  ["CHF", "de"],
];
const AMOUNTS = [0, 9, 149, 1249, 1249.5, 24.9, 0.5, 12_345_678.99];
const NBSP = String.fromCharCode(0xa0);
const NARROW = String.fromCharCode(0x202f);
const ARABIC_INDIC = /[٠-٩۰-۹]/;

const show = (s: string) => s.split(NBSP).join("⍽").split(NARROW).join("·");

let problems = 0;
const base = getFixture("argan");
for (const [currency, locale] of CASES) {
  const doc = { ...base.doc, currency, locale };
  const ctx = createRenderContext(doc, {
    mode: "live",
    assets: fixtureAssetResolver([]),
    base: "/",
    now: "2026-01-01T00:00:00.000Z",
    pageKey: "pk_money_parity",
    store: base.store,
    links: PREVIEW_LINKS,
  });
  const cfg = buildRuntimeConfig(doc, ctx, { page: "landing", mode: "live", pageKey: "pk_money_parity", endpoints: { order: "/o" }, thankYouUrl: "/t", landingUrl: "/" });
  const row: string[] = [];
  for (const amount of AMOUNTS) {
    const server = ctx.money(amount);
    const browser = runtimeFormat(amount, cfg.money);
    const shared = formatMoney(amount, currency, locale);
    if (server !== browser || browser !== shared) {
      problems++;
      console.log(`✗ ${currency} ${locale} ${amount}: ${JSON.stringify([server, browser, shared])}`);
    }
    if (ARABIC_INDIC.test(server) || !/\d/.test(server)) {
      problems++;
      console.log(`✗ ${currency} ${locale} ${amount}: digits must be Latin (${server})`);
    }
    // the symbol never wraps away from the amount
    if (/\d [^\d]|[^\d] \d/.test(server)) {
      problems++;
      console.log(`✗ ${currency} ${locale} ${amount}: breakable space between amount and symbol (${show(server)})`);
    }
    row.push(show(server));
  }
  console.log(`${currency} ${locale.padEnd(2)} ${row.join(" | ")}`);
}
console.log(problems ? `✗ ${problems} problem(s)` : "✓ money parity: server and runtime prices are byte-identical");
process.exit(problems ? 1 : 0);
