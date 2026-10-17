/**
 * Units in a browser (Playwright, Edge):  npx tsx src/landing/runtime/selftest-units.ts
 * (replaces selftest-variants.ts). Real pages from the renderer (renderLandingHtml / renderThankYouHtml:
 * the order form's §F.6 markup, the production runtime chunks it inlines, served with its own hash CSP),
 * the order API mocked; every payload sent is re-validated by the server's validateOrder against the
 * same doc and must price at `st`. One page per resolved fill: rows (duo, tee), box (kitchen), inline
 * (colors), steps (tee forced), plus the thank-you page and the WhatsApp export bridge.
 *
 * Covers: unit rows on offer switch, choice → body swap, memory (×1 → ×2 keeps piece 1), prefill +
 * "= pièce 1" (collapsed, follows piece 1 until edited), locks (static chips) / allow / preset, matrix
 * conflict (struck, cleared + notice), field errors (letters) and counters, distinct duplicate, shared
 * groups, extras scope, bump body, steps and box navigation, collapse + Modifier, server field errors
 * (sold out since opening), stale reload restore, summary / sums / reasons, thank-you groups +
 * Purchase contents, the WhatsApp message.
 */
import { chromium, type Browser, type Page } from "playwright";
import { liveLinks } from "../context";
import { runtimeChunks } from "../generated/assets";
import { parseOrderPayload } from "../../lib/orders/contract";
import { validateOrder } from "../../lib/orders/validate";
import { fixtureAssets, getFixture } from "../../lib/page/fixtures";
import { PageDoc } from "../../lib/page/schema";
import { renderLandingHtml, renderThankYouHtml, type RenderHtmlOptions } from "../../lib/render/core";
import { colors, duo, kitchen, tee, type Doc } from "./selftest-cases";

const ORIGIN = "http://lp.test";
let pass = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else failures.push(`${label}\n    got:  ${g}\n    want: ${w}`);
}
const ok = (label: string, v: boolean) => eq(label, v, true);

type Reply = { status: number; body: unknown };
interface Site {
  page: Page;
  sent: Record<string, unknown>[];
  replies: Reply[];
  errors: string[];
}

const store = getFixture("duo").store;
const opts = (endpoints: Record<string, string>): RenderHtmlOptions => ({
  mode: "live",
  assets: fixtureAssets(ORIGIN + "/"),
  pageKey: "pk_test_0001",
  store,
  links: liveLinks("test"),
  urls: { landing: "/", thankYou: "/merci", endpoints: { order: endpoints.order ?? "/api/public/order", ...(endpoints.lead ? { lead: endpoints.lead } : {}) } },
  base: "/",
  now: "2026-10-16T10:00:00.000Z",
  runtimeMode: "live",
  qa: false,
  upgradeInsecureRequests: false,
  ver: "01JA7Q2M9X4T6V8B0C2D4F6H8K",
});

async function site(browser: Browser, doc: Doc, o: { whatsapp?: boolean } = {}): Promise<Site> {
  const endpoints: Record<string, string> = o.whatsapp ? { order: "whatsapp:order" } : { order: "/api/public/order", lead: "/api/public/lead" };
  const landing = await renderLandingHtml(doc, opts(endpoints));
  const thanks = await renderThankYouHtml(doc, opts(endpoints));
  let html = landing.html;
  if (o.whatsapp) {
    const labels = { order: "Nouvelle commande", ref: "Réf.", product: "Produit", pack: "Pack", options: "Options", extra: "Extra", total: "Total", cod: "paiement à la livraison", name: "Nom", phone: "Téléphone", city: "Ville", address: "Adresse", note: "Note", email: "E-mail", cardTitle: "Pas encore envoyé ?", cardTitleNow: "Envoyez votre commande", cardText: "…", cardButton: "Ouvrir WhatsApp", free: "Offert", gift: "Cadeau", choices: "Commande", more: "+{n} articles" };
    html = html.replace("</body>", `<script type="application/json" id="lp-wa">${JSON.stringify({ v: 1, endpoint: "whatsapp:order", number: "212612345678", labels })}</script><script>${runtimeChunks.whatsapp}</script></body>`);
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: doc.locale });
  const page = await ctx.newPage();
  const s: Site = { page, sent: [], replies: [], errors: [] };
  page.on("pageerror", (e) => s.errors.push(String(e.stack || e).split(String.fromCharCode(10)).slice(0, 3).join(" | ")));
  page.on("console", (m) => {
    const t = m.text();
    if (t.startsWith("[lp]") || /Content.Security.Policy|Refused to/i.test(t)) s.errors.push(t.slice(0, 300));
  });
  await ctx.route("https://**/*", (r) => r.abort());
  await ctx.route(ORIGIN + "/**", async (r) => {
    const url = new URL(r.request().url());
    const page = (body: string, csp: string) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: o.whatsapp ? {} : { "content-security-policy": csp }, body });
    if (url.pathname === "/") return page(html, landing.csp);
    if (url.pathname === "/merci") return page(thanks.html, thanks.csp);
    if (url.pathname === "/api/public/lead") return r.fulfill({ status: 204, body: "" });
    if (url.pathname === "/api/public/order") {
      const body = JSON.parse(r.request().postData() || "{}");
      s.sent.push(body);
      const reply = s.replies.shift();
      if (reply) return r.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.body) });
      const p = parseOrderPayload(body);
      const v = p.ok ? validateOrder(p.data, doc) : null;
      if (!p.ok || !v || !v.ok) return r.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ ok: false, error: "invalid", fields: p.ok ? (v && !v.ok ? v.fields : {}) : p.fields }) });
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, orderId: "CMD-TEST" + s.sent.length, total: v.value.totals.total / 100, currency: doc.currency }) });
    }
    return r.fulfill({ status: 404, body: "" });
  });
  await page.goto(ORIGIN + "/");
  await page.waitForFunction(() => document.documentElement.classList.contains("lp-js"));
  await settle(page);
  return s;
}

const settle = (p: Page) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
const text = (p: Page, sel: string) => p.evaluate((s) => Array.from(document.querySelectorAll(s)).map((e) => ((e as HTMLElement).textContent || "").replace(/\s+/g, " ").trim()), sel);
const attr = (p: Page, sel: string, a: string) => p.evaluate(([s, n]) => Array.from(document.querySelectorAll(s!)).map((e) => e.getAttribute(n!)), [sel, a]);
const visible = (p: Page, sel: string) => p.evaluate((s) => Array.from(document.querySelectorAll(s)).filter((e) => (e as HTMLElement).getClientRects().length > 0).length, sel);
const value = (p: Page, name: string) => p.evaluate((n) => (document.querySelector(`input[name="${n}"]:checked:enabled`) as HTMLInputElement | null)?.value ?? null, name);
const pick = async (p: Page, name: string, v: string) => {
  await p.locator(`input[name="${name}"][value="${v}"]:enabled`).check({ force: true });
  await settle(p);
};
const offer = (p: Page, id: string) => pick(p, "bundle", id);
const total = async (p: Page) => ((await text(p, '[data-lp-submit] [data-lp-sum="total"]'))[0] || "").replace(/\s/g, " ");
async function delivery(p: Page, name = "Sara Bennani") {
  await p.fill('[name="name"]', name);
  await p.fill('[name="phone"]', "0612345678");
  const city = p.locator('[name="city"]');
  if ((await city.count()) && (await city.evaluate((e) => e.tagName)) === "SELECT") await city.selectOption({ index: 1 });
  else if (await city.count()) await city.fill("Casablanca");
  const addr = p.locator('[name="address"]');
  if (await addr.count()) await addr.fill("12 rue des Fleurs, Maarif");
}
async function submit(s: Site, expectSend: boolean) {
  const n = s.sent.length;
  await s.page.locator("[data-lp-submit]").click();
  if (expectSend) {
    for (let i = 0; i < 80 && s.sent.length === n; i++) await s.page.waitForTimeout(100);
    await s.page.waitForTimeout(400);
  } else {
    await s.page.waitForTimeout(200);
    eq("no request sent", s.sent.length, n);
  }
  await settle(s.page).catch(() => undefined);
}
/** the last payload: server-valid and priced at the total shown */
function serverCheck(label: string, doc: Doc, s: Site): Record<string, unknown> {
  const body = s.sent[s.sent.length - 1] || {};
  const p = parseOrderPayload(body);
  const v = p.ok ? validateOrder(p.data, doc) : null;
  eq(`${label}: server accepts`, v && v.ok ? "ok" : p.ok ? (v && !v.ok ? v.fields : "?") : p.fields, "ok");
  if (v && v.ok) eq(`${label}: server total == st`, v.value.totals.total, body.st);
  eq(`${label}: payload v2 with the version shown`, [body.v, body.ver], [2, "01JA7Q2M9X4T6V8B0C2D4F6H8K"]);
  return body;
}
const errorOf = (p: Page, field: string) => p.evaluate((f) => (document.querySelector(`[data-field="${f}"] [data-error]`)?.textContent || "").trim(), field);
const thanksUrl = (p: Page) => p.waitForURL(/\/merci\?o=/, { timeout: 8000 });

async function main() {
  let browser: Browser | null = null;
  for (const o of [{ channel: "msedge" }, {}, { channel: "chrome" }]) {
    try {
      browser = await chromium.launch(o);
      break;
    } catch {
      /* next */
    }
  }
  if (!browser) throw new Error("no browser (Edge / Chromium) available");

  /* ---------------- 1 · the owner's example (duo, rows) + thank-you + Purchase contents ---------------- */
  {
    const raw = JSON.parse(JSON.stringify(duo("fr")));
    raw.tracking = { metaPixelId: ["111122223333"] };
    const doc = PageDoc.parse(raw);
    const s = await site(browser, doc);
    const p = s.page;
    eq("duo: rows fill", await attr(p, "[data-lp-units]", "data-fill"), ["rows"]);
    eq("duo: default offer has nothing to fill → its contents", [await attr(p, "[data-lp-units]", "data-units"), await visible(p, '[data-lp-units] [data-lp-contents="duo"]')], [["0"], 1]);
    await offer(p, "one");
    eq("one: a choice unit, head 'Au choix'", [await attr(p, "[data-lp-units]", "data-units"), await text(p, "[data-lp-unit]:not([hidden]) [data-lp-unit-head]")], [["1"], ["Au choix"]]);
    await delivery(p);
    await submit(s, false);
    eq("one: item chooser required", await errorOf(p, "u.0.@item"), "Choisissez l'article");
    await pick(p, "u.0.@item", "nuit");
    eq("one: head follows the chosen item (short name)", await text(p, "[data-lp-unit]:not([hidden]) [data-lp-unit-head]"), ["Nuit"]);
    eq("one: error cleared once chosen", await errorOf(p, "u.0.@item"), "");
    eq("one: summary + total", [await text(p, "[data-lp-vsum]"), await total(p)], [["1 × Crème nuit"], "149 DH"]);
    await submit(s, true);
    const body = serverCheck("one", doc, s);
    eq("one: payload", [body.bundleId, body.units, body.st], ["one", [{ item: "nuit", o: {}, f: {} }], 14900]);
    await thanksUrl(p);
    await settle(p);
    eq("thank-you: groups drawn", await text(p, '[data-ty="options"]'), ["1 × Crème nuit"]);
    const q = await p.evaluate(() => ((window as unknown as { fbq?: { queue: unknown[] } }).fbq?.queue || []).map((a) => Array.from(a as ArrayLike<unknown>)));
    const purchase = q.find((a) => a[0] === "track" && a[1] === "Purchase") as [string, string, { contents: unknown[]; value: number; num_items: number }] | undefined;
    eq("thank-you: Purchase contents per item", purchase ? [purchase[2].value, purchase[2].num_items, purchase[2].contents] : null, [149, 1, [{ id: "pk_test_0001.nuit", quantity: 1, item_price: 149 }]]);
    eq("duo: no runtime / CSP errors", s.errors, []);
    await p.context().close();
  }

  /* ---------------- 2 · kitchen (box): any 2 of 3, BOGO prefill, shared group, extras, bump body ---------------- */
  {
    const doc = kitchen(0);
    const s = await site(browser, doc);
    const p = s.page;
    eq("kitchen: box fill", await attr(p, "[data-lp-units]", "data-fill"), ["box"]);
    await offer(p, "any2");
    eq("any2: two tiles, one panel open", [await visible(p, "[data-lp-slot]"), await visible(p, "[data-lp-unit]")], [2, 1]);
    await pick(p, "u.0.@item", "main");
    eq("any2: Jour gets its tone (first swatch)", await value(p, "u.0.g-tone"), "o-claire");
    await p.locator('[data-lp-slot="1"]:visible').click();
    await settle(p);
    eq("box: tile 1 opens its panel", await attr(p, "[data-lp-unit][data-active]", "data-lp-unit"), ["1"]);
    eq("box: tile 0 shows the chosen item's photo", await p.locator('[data-lp-slot="0"]:visible [data-lp-slot-pic] img').count(), 1);
    await pick(p, "u.1.@item", "main");
    await delivery(p);
    await submit(s, false);
    eq("any2: distinct → duplicate", await errorOf(p, "u.1.@item"), "Choisissez un article différent");
    await pick(p, "u.1.@item", "serum");
    eq("any2: shared group for the sérum", await text(p, "[data-lp-shared]:not([hidden]) [data-lp-shared-head]"), ["Pour vos 1 Sérum"]);
    await submit(s, false);
    ok("shared group required", (await errorOf(p, "s.serum.g-size")).length > 0);
    await pick(p, "s.serum.g-size", "o-30");
    eq("any2: Jour + Sérum = 329, reason line", [await total(p), await text(p, ".lp-sum__reason")], ["329 DH", ["Sérum +50 DH"]]);
    await submit(s, true);
    const b2 = serverCheck("any2", doc, s);
    eq("any2: payload units", b2.units, [{ item: "main", o: { "g-tone": "o-claire" }, f: {} }, { item: "serum", o: { "g-size": "o-30" }, f: {} }]);
    await thanksUrl(p);
    await p.goto(ORIGIN + "/");
    await settle(p);
    // BOGO: piece 2 (free) takes piece 1's tone, tagged; follows piece 1 until edited
    await offer(p, "bogo");
    const tag = () =>
      p.evaluate(() =>
        Array.from(document.querySelectorAll("[data-lp-unit][data-active]")).map((u) => {
          const t = u.querySelector("[data-lp-prefill-tag]") as HTMLElement | null;
          return [u.getAttribute("data-lp-unit"), u.hasAttribute("data-prefilled"), t && !t.hidden ? t.textContent : "", u.hasAttribute("data-free")];
        }),
      );
    await pick(p, "u.0.g-tone", "o-doree");
    eq("bogo: piece 1", await tag(), [["0", false, "", false]]);
    await p.locator('[data-lp-slot="1"]:visible').click();
    await settle(p);
    eq("bogo: piece 2 = pièce 1, free", await tag(), [["1", true, "= pièce 1", true]]);
    eq("bogo: piece 2 follows (Dorée), pays nothing", [await value(p, "u.1.g-tone"), await total(p)], ["o-doree", "159 DH"]);
    await pick(p, "u.1.g-tone", "o-claire");
    eq("bogo: edited → no tag", await tag(), [["1", false, "", true]]);
    await p.locator('[data-lp-slot="0"]:visible').click();
    await pick(p, "u.0.g-tone", "o-claire");
    await p.locator('[data-lp-slot="1"]:visible').click();
    await pick(p, "u.1.g-tone", "o-doree");
    await p.locator('[data-lp-slot="0"]:visible').click();
    await pick(p, "u.0.g-tone", "o-doree");
    await pick(p, "u.0.g-tone", "o-claire");
    await p.locator('[data-lp-slot="1"]:visible').click();
    await settle(p);
    eq("bogo: an edited piece no longer follows", await value(p, "u.1.g-tone"), "o-doree");
    // duo: extras in scope, bump body
    await offer(p, "duo");
    eq("duo: extra in scope, bump offered", [await visible(p, '[data-lp-extra="g-wrap"]'), await visible(p, "[data-lp-bump]")], [1, 1]);
    await pick(p, "x.g-wrap", "o-yes");
    await p.locator('input[name="bump"]').check({ force: true });
    await settle(p);
    eq("bump: its item's body shows", await visible(p, "[data-lp-bump-body]"), 1);
    await delivery(p);
    await submit(s, false);
    ok("bump body required", (await errorOf(p, "b.g-size")).length > 0);
    await pick(p, "b.g-size", "o-50");
    await p.fill('input[name="b.g-name"]:enabled', "Sara");
    await settle(p);
    await submit(s, true);
    const b3 = serverCheck("duo + bump", doc, s);
    eq("duo: payload extras + b", [b3.extras, b3.bump, b3.b], [{ "g-wrap": "o-yes" }, true, { o: { "g-size": "o-50" }, f: { "g-name": "Sara" } }]);
    await thanksUrl(p);
    await settle(p);
    eq("thank-you: offer + bump groups", ((await text(p, '[data-ty="options"]'))[0] || "").includes("Sérum"), true);
    await p.goto(ORIGIN + "/");
    await settle(p);
    await offer(p, "trio");
    eq("trio: no bump, extra in scope", [await visible(p, "[data-lp-bump]"), await visible(p, '[data-lp-extra="g-wrap"]')], [0, 1]);
    await offer(p, "one");
    eq("one: extra out of scope, bump offered", [await visible(p, '[data-lp-extra="g-wrap"]'), await visible(p, "[data-lp-bump]")], [0, 1]);
    eq("kitchen: no runtime / CSP errors", s.errors, []);
    await p.context().close();
  }

  /* ---------------- 3 · tee (rows): matrix conflict, prefill, memory, fields, server refusal, stale ---------------- */
  {
    const doc = tee(30);
    const s = await site(browser, doc);
    const p = s.page;
    eq("tee: rows, x2 → 2 units", [await attr(p, "[data-lp-units]", "data-fill"), await attr(p, "[data-lp-units]", "data-units")], [["rows"], ["2"]]);
    eq("tee: color starts on the first swatch, size empty", [await value(p, "u.0.g-fit.d-col"), await value(p, "u.0.g-fit.d-size")], ["o-noir", null]);
    eq("tee: XL struck with Noir (conflict, selectable)", await p.locator('input[name="u.0.g-fit.d-size"][value="o-xl"]:enabled').evaluate((e) => [e.closest("label")!.hasAttribute("data-conflict"), (e as HTMLInputElement).disabled]), [true, false]);
    await pick(p, "u.0.g-fit.d-size", "o-xl");
    eq("tee: Noir cleared + notice", [await value(p, "u.0.g-fit.d-col"), (await text(p, '[data-lp-unit="0"]:not([hidden]) [data-lp-mnote]'))[0]], [null, "XL n'existe pas en Noir, choisissez Couleur"]);
    await pick(p, "u.0.g-fit.d-col", "o-blanc");
    eq("tee: Blanc / S not made → S struck", await p.locator('input[name="u.0.g-fit.d-size"][value="o-s"]:enabled').evaluate((e) => e.closest("label")!.hasAttribute("data-conflict")), true);
    await p.locator('input[name="name"]').focus();
    await settle(p);
    const units = () => p.evaluate(() => Array.from(document.querySelectorAll("[data-lp-unit]:not([hidden])")).map((u) => [u.hasAttribute("data-prefilled"), u.hasAttribute("data-collapsed"), ((u.querySelector("[data-lp-unit-sum]") as HTMLElement).textContent || "").trim(), !(u.querySelector("[data-lp-unit-edit]") as HTMLElement).hidden]));
    eq("tee: piece 2 prefilled Blanc / XL; both collapsed with Modifier", await units(), [[false, true, "Blanc / XL", true], [true, true, "Blanc / XL", true]]);
    eq("tee: XL ×2 reason, delivery 30", [await text(p, ".lp-sum__reason"), await total(p)], [["XL ×2 +40 DH"], "299 DH"]);
    await p.locator('[data-lp-unit="0"]:not([hidden]) [data-lp-unit-edit]').click();
    await p.fill('input[name="u.0.g-name"]:enabled', "Sara");
    await settle(p);
    eq("tee: counter + field surcharge", [(await text(p, '[data-lp-unit="0"]:not([hidden]) [data-lp-count]'))[0], await total(p)], ["4/12", "329 DH"]);
    await p.locator('[data-lp-unit="1"]:not([hidden]) [data-lp-unit-edit]').click();
    await p.fill('input[name="u.1.g-name"]:enabled', "<b>");
    await delivery(p);
    await submit(s, false);
    eq("tee: letters only", await errorOf(p, "u.1.g-name"), "Lettres uniquement");
    await p.fill('input[name="u.1.g-name"]:enabled', "");
    await settle(p);
    // the server refuses Blanc/XL on piece 2: sold out since the page opened
    s.replies.push({ status: 422, body: { ok: false, error: "invalid", fields: { "u.1.g-fit": "unavailable" } } });
    await submit(s, true);
    eq("refusal: message, the combination struck on both pieces", [await errorOf(p, "u.1.g-fit"), await value(p, "u.1.g-fit.d-size"), await value(p, "u.0.g-fit.d-size")], ["Épuisé depuis l'ouverture de la page", null, null]);
    // ×1 → ×2 memory: piece 1 keeps its values
    await offer(p, "x1");
    await pick(p, "u.0.g-fit.d-col", "o-gris");
    await pick(p, "u.0.g-fit.d-size", "o-l");
    await offer(p, "x2");
    eq("x1 → x2: piece 1 keeps Gris / L", [await value(p, "u.0.g-fit.d-col"), await value(p, "u.0.g-fit.d-size")], ["o-gris", "o-l"]);
    await pick(p, "u.1.g-fit.d-col", "o-gris");
    await pick(p, "u.1.g-fit.d-size", "o-m");
    // stale: the page was replaced → reload once, form and selection restored, notice shown
    s.replies.push({ status: 409, body: { ok: false, error: "stale" } });
    await submit(s, true);
    await p.waitForLoadState("load");
    await p.waitForFunction(() => !!document.querySelector("[data-lp-stale]:not([hidden])"), null, { timeout: 8000 }).catch(() => undefined);
    await settle(p);
    eq("stale: reloaded, notice, form + selection restored", [(await text(p, "[data-lp-stale]"))[0], await p.inputValue('[name="name"]'), await value(p, "u.1.g-fit.d-col"), await p.inputValue('input[name="u.0.g-name"]:enabled')], ["L'offre a été mise à jour, vérifiez votre choix", "Sara Bennani", "o-gris", "Sara"]);
    await submit(s, true);
    const b = serverCheck("tee after stale", doc, s);
    eq("tee: payload units", b.units, [{ o: { "g-fit": "d-col=o-gris|d-size=o-l" }, f: { "g-name": "Sara" } }, { o: { "g-fit": "d-col=o-gris|d-size=o-m" }, f: {} }]);
    eq("tee: no runtime / CSP errors", s.errors, []);
    await p.context().close();
  }

  /* ---------------- 4 · colors (ar, inline): locks + allow / preset ---------------- */
  {
    const doc = colors("ar");
    const s = await site(browser, doc);
    const p = s.page;
    eq("colors: inline fill", await attr(p, "[data-lp-units]", "data-fill"), ["inline"]);
    await offer(p, "colors");
    eq("colors: one static chip per unit", await text(p, "[data-lp-unit]:not([hidden]) [data-lp-lock]:not([hidden]) .lp-lock__t"), ["أسود", "أبيض", "رمادي"]);
    eq("colors: the locked dim is not a control", await p.locator('[data-lp-unit]:not([hidden]) input[name$=".d-col"]:enabled').count(), 0);
    for (const k of [0, 1, 2]) await pick(p, `u.${k}.g-fit.d-size`, "o-l");
    await delivery(p, "سارة بناني");
    await submit(s, true);
    const b = serverCheck("colors", doc, s);
    eq("colors: locked colors sent", ((b.units as { o: Record<string, string> }[]) || []).map((x) => x.o["g-fit"]), ["d-col=o-noir|d-size=o-l", "d-col=o-blanc|d-size=o-l", "d-col=o-gris|d-size=o-l"]);
    await thanksUrl(p);
    await p.goto(ORIGIN + "/");
    await settle(p);
    await offer(p, "x3-promo");
    eq("x3-promo: Blanc not offered, Noir preset on each piece", await p.evaluate(() => Array.from(document.querySelectorAll("[data-lp-unit]:not([hidden])")).map((u) => [!!u.querySelector('input[name$=".d-col"][value="o-blanc"]:enabled'), (u.querySelector('input[name$=".d-col"]:checked') as HTMLInputElement | null)?.value])), [[false, "o-noir"], [false, "o-noir"], [false, "o-noir"]]);
    eq("colors: no runtime / CSP errors", s.errors, []);
    await p.context().close();
  }

  /* ---------------- 5 · steps ---------------- */
  {
    const raw = JSON.parse(JSON.stringify(tee(0)));
    raw.offers.display.fill = "steps";
    const doc = PageDoc.parse(raw);
    const s = await site(browser, doc);
    const p = s.page;
    eq("steps fill", await attr(p, "[data-lp-units]", "data-fill"), ["steps"]);
    await offer(p, "x3");
    eq("steps: 3 chips, one panel", [await visible(p, "[data-lp-step]"), await attr(p, "[data-lp-unit][data-active]", "data-lp-unit"), await attr(p, '[data-lp-step][aria-current="step"]', "data-lp-step")], [3, ["0"], ["0"]]);
    await p.locator("[data-lp-next]:visible").click();
    await settle(p);
    eq("steps: Suivant", await attr(p, "[data-lp-unit][data-active]", "data-lp-unit"), ["1"]);
    await p.locator('[data-lp-step="2"]:visible').click();
    await settle(p);
    eq("steps: a chip opens its unit, Suivant disabled at the end", [await attr(p, "[data-lp-unit][data-active]", "data-lp-unit"), await p.locator("[data-lp-next]:visible").isDisabled()], [["2"], true]);
    await delivery(p);
    await submit(s, false);
    eq("steps: submit opens the first unit in error", await attr(p, "[data-lp-unit][data-active]", "data-lp-unit"), ["0"]);
    for (const k of [0, 1, 2]) {
      await p.locator(`[data-lp-step="${k}"]:visible`).click();
      await settle(p);
      await pick(p, `u.${k}.g-fit.d-size`, "o-m");
    }
    eq("steps: chips done", await attr(p, "[data-lp-step][data-done]", "data-lp-step"), ["0", "1", "2"]);
    await submit(s, true);
    serverCheck("steps x3", doc, s);
    eq("steps: no runtime / CSP errors", s.errors, []);
    await p.context().close();
  }

  /* ---------------- 6 · WhatsApp bridge ---------------- */
  {
    const doc = kitchen(0);
    const s = await site(browser, doc, { whatsapp: true });
    const p = s.page;
    await p.evaluate(() => {
      (window as unknown as { open: unknown }).open = () => ({ opener: null, location: { set href(v: string) { void v; } } });
    });
    await offer(p, "trio");
    await pick(p, "s.serum.g-size", "o-30");
    await p.locator('[data-lp-slot="2"]:visible').click();
    await p.fill('input[name="u.2.g-name"]:enabled', "Sara");
    await pick(p, "x.g-wrap", "o-yes");
    await delivery(p);
    await p.locator("[data-lp-submit]").click();
    await p.waitForURL(/\/merci\?o=WA-/, { timeout: 8000 });
    const href = await p.evaluate(() => sessionStorage.getItem("lp-wa") || "{}");
    const msg = decodeURIComponent(String(JSON.parse(href).href || "").split("?text=")[1] || "");
    const okMsg = msg.includes("• 1 × Jour (Claire)") && msg.includes("• 1 × Nuit") && msg.includes("• 1 × Sérum (30 ml) · Prénom « Sara »") && msg.includes("Emballage cadeau = Oui (+15") && /Total : 394.DH\*/.test(msg);
    ok("whatsapp: one bullet per part, extras line, the runtime's total", okMsg);
    if (!okMsg) console.log(msg);
    await p.context().close();
  }

  await browser.close();
  if (failures.length) {
    console.error(`runtime units (browser): ${failures.length} failure(s), ${pass} passed\n  - ${failures.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`runtime units (browser): ${pass} checks passed`);
}

main().catch((e) => {
  console.error(e);
  if (failures.length) console.error(`${failures.length} failure(s) before the crash, ${pass} passed\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
});
