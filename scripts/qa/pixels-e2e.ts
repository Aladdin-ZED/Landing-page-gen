/**
 * Ad pixels end-to-end (offline): the real rendered landing + thank-you pages with 2 Meta, 2 TikTok,
 * 1 Snap and 1 GA4 pixel, served with their real CSP header by a local server; the vendors' scripts
 * (connect.facebook.net, analytics.tiktok.com, sc-static.net, googletagmanager.com) are replaced by
 * recording stubs through Playwright routing, and /api/public/order is mocked.
 *
 * Checks the exact event sequence view → start order → lead → successful order, on every platform:
 * names, parameters (value = server total, MAD, quantity), once-only, hashed advanced matching
 * (E.164 +212), Purchase event ids = order id = the server payload builder's event_id, no CSP
 * violation (vendor beacons included), nothing loaded in preview mode, no Purchase on reload.
 *
 *   npx tsx scripts/qa/pixels-e2e.ts      (exit code 1 on failure)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, normalize, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { liveLinks } from "@/landing/context";
import { OrderPayload } from "@/lib/orders/contract";
import { purchaseConversion } from "@/lib/orders/conversions-core";
import { fixtureAssets, getFixture } from "@/lib/page/fixtures";
import { orderTotals } from "@/lib/page/pricing";
import { validateDoc } from "@/lib/page/validate";
import { PIXEL_EVENTS } from "@/lib/pixels/ids";
import { renderLandingHtml, renderThankYouHtml } from "@/lib/render/core";

const ROOT = resolve(__dirname, "..", "..");
const PUBLIC = join(ROOT, "public");
const META = ["111111111111111", "222222222222222"];
const TIKTOK = ["CTESTPIXEL0000000001", "CTESTPIXEL0000000002"];
const SNAP = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
const GA4 = "G-TEST1234";
const ORDER_ID = "CMD-PX0001";
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/* vendor stubs: take over the runtime's official queues like the real scripts, record every call */
const FB_STUB = `(function(){var log=window.__px||(window.__px=[]);var f=window.fbq;if(!f||f.__stub)return;f.__stub=true;
var call=function(){log.push(["fbq"].concat([].slice.call(arguments)))};f.callMethod=call;var q=f.queue.slice();f.queue.length=0;
q.forEach(function(a){call.apply(null,[].slice.call(a))});new Image().src="https://www.facebook.com/tr/?id=stub&ev=PageView";
fetch("https://www.facebook.com/tr/",{method:"POST",mode:"no-cors",body:"x"}).catch(function(){});})();`;
const TT_STUB = `(function(){var log=window.__px||(window.__px=[]);var q=window.ttq;if(!q)return;
log.push(["ttq-script",(document.currentScript&&document.currentScript.src)||""]);if(q.__stub)return;q.__stub=true;
var e=Array.prototype.slice.call(q);q.length=0;e.forEach(function(x){log.push(["ttq"].concat(x))});
q.methods.forEach(function(m){q[m]=function(){log.push(["ttq",m].concat([].slice.call(arguments)))}});
fetch("https://analytics.tiktok.com/api/v2/pixel",{method:"POST",mode:"no-cors",body:"{}"}).catch(function(){});})();`;
const SNAP_STUB = `(function(){var log=window.__px||(window.__px=[]);var s=window.snaptr;if(!s||s.__stub)return;s.__stub=true;
var call=function(){log.push(["snaptr"].concat([].slice.call(arguments)))};s.handleRequest=call;var q=s.queue.slice();s.queue.length=0;
q.forEach(function(a){call.apply(null,[].slice.call(a))});new Image().src="https://tr.snapchat.com/p?stub=1";})();`;
const GA_STUB = `(function(){window.__gaStub=true;try{navigator.sendBeacon("https://region1.google-analytics.com/g/collect?v=2&tid=stub","")}catch(e){}
new Image().src="https://www.googletagmanager.com/td?stub=1";})();`;

type Call = unknown[];
interface Log {
  calls: Call[];
  dataLayer: Call[];
}

/** Recorded calls (a string: tsx's helpers must not leak into the page). */
const READ_LOG = `(() => {
  const clean = (v) => (v instanceof Date ? "<date>" : v);
  return {
    calls: (window.__px || []).map((c) => c.map(clean)),
    dataLayer: (window.dataLayer || []).map((a) => Array.prototype.slice.call(a).map(clean)),
  };
})()`;

async function readLog(page: Page): Promise<Log> {
  return (await page.evaluate(READ_LOG)) as Log;
}

const of = (log: Log, vendor: string) => log.calls.filter((c) => c[0] === vendor).map((c) => c.slice(1));
const named = (calls: Call[], method: string, event: string) => calls.filter((c) => c[0] === method && c[1] === event);

async function main() {
  const fx = getFixture("massage", { locale: "fr" });
  const { doc } = validateDoc({ ...fx.doc, tracking: { metaPixelId: META, tiktokPixelId: TIKTOK, snapPixelId: [SNAP], ga4Id: GA4 } });
  if (!doc) throw new Error("fixture invalid");
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  const opts = {
    mode: "live" as const,
    assets: fixtureAssets("/"),
    pageKey: "pk_e2e_pixels",
    store: fx.store,
    links: liveLinks("massage"),
    urls: { landing: "/massage", thankYou: "/massage/merci", endpoints: { order: "/api/public/order", lead: "/api/public/lead", event: "/api/public/event" } },
    origin,
    upgradeInsecureRequests: false,
  };
  const landing = await renderLandingHtml(doc, opts);
  const thanks = await renderThankYouHtml(doc, opts);
  const preview = await renderLandingHtml(doc, { ...opts, runtimeMode: "preview" as const });
  const orders: Record<string, unknown>[] = [];
  let serverTotal = 0;
  const contentId = doc.product.sku || opts.pageKey;

  server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", origin);
    if (req.method === "POST" && url.pathname.startsWith("/api/public/")) {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        if (url.pathname === "/api/public/order") {
          const p = JSON.parse(body) as { bundleId: string; bump: boolean };
          orders.push(JSON.parse(body) as Record<string, unknown>);
          // the server's own total (prices recomputed from the document, like the real API)
          serverTotal = orderTotals(doc.product, doc.offers, p.bundleId, p.bump)?.total ?? 0;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, orderId: ORDER_ID, total: serverTotal, currency: "MAD" }));
        } else res.writeHead(204).end();
      });
      return;
    }
    const docs: Record<string, { html: string; csp: string }> = { "/massage": landing, "/massage/merci": thanks, "/preview": preview };
    const d = docs[url.pathname];
    if (d) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": d.csp });
      res.end(d.html);
      return;
    }
    const file = normalize(join(PUBLIC, decodeURIComponent(url.pathname)));
    if (file.startsWith(PUBLIC) && existsSync(file)) {
      const type = file.endsWith(".woff2") ? "font/woff2" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": type });
      res.end(readFileSync(file));
      return;
    }
    res.writeHead(404).end();
  });

  let browser: Browser | null = null;
  for (const o of [{ channel: "msedge" }, {}, { channel: "chrome" }]) {
    try {
      browser = await chromium.launch(o);
      break;
    } catch {
      /* next channel */
    }
  }
  if (!browser) throw new Error("no browser (Edge, Playwright Chromium or Chrome)");
  const fails: string[] = [];
  const check = (cond: boolean, what: string, info?: unknown) => {
    console.log(`${cond ? "✓" : "✗"} ${what}${!cond && info !== undefined ? `\n    ${JSON.stringify(info).slice(0, 1200)}` : ""}`);
    if (!cond) fails.push(what);
  };

  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const vendorHits: string[] = [];
    const js = (body: string) => ({ status: 200, contentType: "text/javascript", body });
    await context.route("https://connect.facebook.net/**", (r) => {
      vendorHits.push(r.request().url());
      return r.fulfill(js(r.request().url().includes("fbevents.js") ? FB_STUB : ""));
    });
    await context.route("https://analytics.tiktok.com/**", (r) => {
      vendorHits.push(r.request().url());
      return r.request().url().includes("/i18n/pixel/events.js") ? r.fulfill(js(TT_STUB)) : r.fulfill({ status: 204 });
    });
    await context.route("https://sc-static.net/**", (r) => {
      vendorHits.push(r.request().url());
      return r.fulfill(js(SNAP_STUB));
    });
    await context.route("https://www.googletagmanager.com/**", (r) => {
      vendorHits.push(r.request().url());
      return r.request().url().includes("/gtag/js") ? r.fulfill(js(GA_STUB)) : r.fulfill({ status: 204 });
    });
    for (const host of ["https://www.facebook.com/**", "https://tr.snapchat.com/**", "https://*.google-analytics.com/**"])
      await context.route(host, (r) => {
        vendorHits.push(r.request().url());
        return r.fulfill({ status: 204 });
      });
    await context.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => fails.push(`page error: ${e.message}`));
    const csp: string[] = [];
    const collectCsp = async () => csp.push(...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)));
    const stubsReady = () =>
      page.waitForFunction(
        () => {
          const w = window as unknown as { fbq?: { __stub?: boolean }; ttq?: { __stub?: boolean }; snaptr?: { __stub?: boolean }; __gaStub?: boolean };
          return !!(w.fbq?.__stub && w.ttq?.__stub && w.snaptr?.__stub && w.__gaStub);
        },
        null,
        { timeout: 10_000 },
      );

    /* ---------- preview: nothing loads ---------- */
    await page.goto(`${origin}/preview`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    const pv = await page.evaluate(() => ({ fbq: typeof (window as unknown as { fbq?: unknown }).fbq, ttq: typeof (window as unknown as { ttq?: unknown }).ttq, cfg: JSON.parse(document.getElementById("lp-config")!.textContent!).pixels }));
    check(vendorHits.length === 0 && pv.fbq === "undefined" && pv.ttq === "undefined" && JSON.stringify(pv.cfg) === "{}", "preview mode: no pixel config, no vendor request", { pv, vendorHits });
    check(!/facebook|tiktok|snapchat|google/.test(preview.csp), "preview CSP allows no pixel host", preview.csp);

    /* ---------- CSP of the live page: exactly the configured platforms ---------- */
    for (const h of ["https://connect.facebook.net", "https://analytics.tiktok.com", "https://sc-static.net", "https://*.googletagmanager.com"])
      check(new RegExp(`script-src [^;]*${h.replace(/[.*]/g, "\\$&")}`).test(landing.csp), `script-src lists ${h} (CSP2 fallback)`);
    check(!/script-src[^;]* https:( |;|$)/.test(landing.csp), "script-src has no blanket https:", landing.csp);
    check(/img-src [^;]*https:\/\/www\.facebook\.com/.test(landing.csp) && /connect-src [^;]*https:\/\/analytics\.tiktok\.com/.test(landing.csp), "img/connect hosts present");

    /* ---------- landing: view ---------- */
    await page.goto(`${origin}/massage`, { waitUntil: "load" });
    await stubsReady();
    await page.waitForTimeout(300);
    let log = await readLog(page);
    const fbq = of(log, "fbq");
    const t0 = orderTotals(doc.product, doc.offers, (doc.offers.bundles.find((b) => b.preselected) ?? doc.offers.bundles[0]!).id, false);
    const viewParams = fbq.find((c) => c[0] === "track" && c[1] === "ViewContent")?.[2] as Record<string, unknown> | undefined;
    check(
      JSON.stringify(fbq.slice(0, 4).map((c) => c.slice(0, 2))) === JSON.stringify([["init", META[0]], ["init", META[1]], ["track", "PageView"], ["track", "ViewContent"]]),
      "Meta: init ×2 → PageView → ViewContent",
      fbq,
    );
    check(
      !!viewParams &&
        JSON.stringify(viewParams.content_ids) === JSON.stringify([contentId]) &&
        viewParams.content_type === "product" &&
        viewParams.content_name === doc.product.name &&
        viewParams.currency === "MAD" &&
        typeof viewParams.value === "number" &&
        viewParams.value > 0,
      "Meta ViewContent params (content_ids/sku, content_name, value, currency)",
      viewParams,
    );
    const ttScripts = log.calls.filter((c) => c[0] === "ttq-script").map((c) => String(c[1]));
    check(TIKTOK.every((id) => ttScripts.some((s) => s.includes(`sdkid=${id}`))), "TikTok: one loader per pixel id", ttScripts);
    const ttq = of(log, "ttq");
    check(JSON.stringify(ttq.map((c) => c.slice(0, 2))) === JSON.stringify([["page"], ["track", "ViewContent"]]), "TikTok: page → ViewContent", ttq);
    const snap = of(log, "snaptr");
    check(
      JSON.stringify(snap.map((c) => c.slice(0, 2))) === JSON.stringify([["init", SNAP], ["track", "PAGE_VIEW"], ["track", "VIEW_CONTENT"]]),
      "Snap: init → PAGE_VIEW → VIEW_CONTENT",
      snap,
    );
    check(
      JSON.stringify(log.dataLayer.map((c) => c.slice(0, 2))) === JSON.stringify([["js", "<date>"], ["config", GA4], ["event", "view_item"]]),
      "GA4: js → config → view_item",
      log.dataLayer,
    );
    check(!!t0, "fixture totals");

    /* ---------- start the order: AddToCart + InitiateCheckout, once ---------- */
    await page.locator("#order-form [name=name]").focus();
    await page.waitForTimeout(250);
    await page.locator("#order-form [name=name]").fill("Salma Test");
    const otherBundle = doc.offers.bundles.find((b) => !b.preselected && b.id !== (doc.offers.bundles.find((x) => x.preselected) ?? doc.offers.bundles[0]!).id);
    if (otherBundle) await page.locator(`#order-form input[name=bundle][value="${otherBundle.id}"]`).evaluate((el) => (el as HTMLInputElement).click());
    await page.waitForTimeout(250);
    log = await readLog(page);
    for (const [vendor, method, step] of [
      ["fbq", "track", "cart"],
      ["fbq", "track", "checkout"],
      ["ttq", "track", "cart"],
      ["ttq", "track", "checkout"],
      ["snaptr", "track", "cart"],
      ["snaptr", "track", "checkout"],
    ] as const) {
      const name = PIXEL_EVENTS[vendor === "fbq" ? "meta" : vendor === "ttq" ? "tiktok" : "snap"][step];
      check(named(of(log, vendor), method, name).length === 1, `${vendor} ${name} fired exactly once`);
    }
    for (const step of ["cart", "checkout"] as const)
      check(log.dataLayer.filter((c) => c[0] === "event" && c[1] === PIXEL_EVENTS.ga4[step]).length === 1, `GA4 ${PIXEL_EVENTS.ga4[step]} fired exactly once`);
    const order1 = of(log, "fbq").map((c) => c[1]);
    check(order1.indexOf("AddToCart") < order1.indexOf("InitiateCheckout"), "AddToCart before InitiateCheckout", order1);

    /* ---------- phone → Lead + TikTok identify (hashed E.164) ---------- */
    await page.locator("#order-form [name=phone]").fill("06 12 34 56 78");
    await page.waitForTimeout(1700);
    log = await readLog(page);
    check(named(of(log, "fbq"), "track", "Lead").length === 1, "Meta Lead once the phone is valid");
    check(named(of(log, "ttq"), "track", "SubmitForm").length === 1, "TikTok SubmitForm (lead)");
    check(named(of(log, "snaptr"), "track", "SIGN_UP").length === 1, "Snap SIGN_UP (lead)");
    check(log.dataLayer.filter((c) => c[1] === "generate_lead").length === 1, "GA4 generate_lead");
    const ident = of(log, "ttq").filter((c) => c[0] === "identify");
    check(ident.length >= 1 && (ident.at(-1)![1] as Record<string, string>).phone_number === sha("+212612345678"), "TikTok identify(phone_number = sha256 of +212…)", ident);

    /* ---------- submit → thank-you: Purchase ---------- */
    const city = page.locator("#order-form select[name=city]");
    if (await city.count()) await city.selectOption({ index: 1 });
    const address = page.locator("#order-form [name=address]");
    if (await address.count()) await address.fill("12 rue Test, Casablanca");
    await page.evaluate(() => {
      const seen = new Set<string>();
      for (const r of document.querySelectorAll<HTMLInputElement>("#order-form [data-lp-variants] input[type=radio]")) {
        if (seen.has(r.name) || r.name.includes("{") || r.disabled || r.closest("[hidden], template")) continue;
        seen.add(r.name);
        if (!document.querySelector(`#order-form input[name="${CSS.escape(r.name)}"]:checked`)) r.click();
      }
    });
    await collectCsp();
    await Promise.all([page.waitForURL(/\/massage\/merci\?o=CMD-PX0001/, { timeout: 15_000 }), page.locator("#order-form [data-lp-submit]").click()]);
    await stubsReady();
    await page.waitForTimeout(400);
    log = await readLog(page);
    check(orders.length === 1 && serverTotal > 0, "one order sent", orders.length);
    const fb2 = of(log, "fbq");
    const am = { ph: sha("212612345678"), fn: sha("salma"), ln: sha("test"), country: sha("ma") };
    check(
      JSON.stringify(fb2.slice(0, 2)) === JSON.stringify([["init", META[0], am], ["init", META[1], am]]),
      "Meta init with hashed advanced matching (ph = sha256 212…, fn, ln, country)",
      fb2.slice(0, 2),
    );
    const purchases = named(fb2, "track", "Purchase");
    const pp = purchases[0]?.[2] as Record<string, unknown> | undefined;
    check(purchases.length === 1 && JSON.stringify(purchases[0]![3]) === JSON.stringify({ eventID: ORDER_ID }), "Meta Purchase once, eventID = order id", purchases);
    const qty = Number((pp?.contents as { quantity: number }[] | undefined)?.[0]?.quantity);
    check(!!pp && pp.value === serverTotal && pp.currency === "MAD" && qty >= 1 && pp.num_items === qty && JSON.stringify(pp.content_ids) === JSON.stringify([contentId]), "Meta Purchase value = server total, MAD, contents with quantity", { pp, serverTotal });
    check(JSON.stringify(of(log, "fbq").map((c) => c[1])) === JSON.stringify([META[0], META[1], "PageView", "Purchase"]), "thank-you: no ViewContent/AddToCart, just PageView + Purchase", fb2);
    const tt2 = of(log, "ttq");
    check(
      JSON.stringify(tt2.map((c) => c.slice(0, 2))) === JSON.stringify([["identify", { phone_number: sha("+212612345678") }], ["page"], ["track", "Purchase"]]),
      "TikTok: identify(hashed phone) → page → Purchase",
      tt2,
    );
    const ttp = tt2.find((c) => c[1] === "Purchase");
    check(JSON.stringify(ttp?.[3]) === JSON.stringify({ event_id: ORDER_ID }) && (ttp?.[2] as Record<string, unknown>).value === serverTotal, "TikTok Purchase event_id = order id, value = server total", ttp);
    const sp = named(of(log, "snaptr"), "track", "PURCHASE")[0]?.[2] as Record<string, unknown> | undefined;
    check(!!sp && sp.client_dedup_id === ORDER_ID && sp.transaction_id === ORDER_ID && sp.price === serverTotal, "Snap PURCHASE client_dedup_id = order id", sp);
    check(
      JSON.stringify((of(log, "snaptr")[0] ?? [])[2]) === JSON.stringify({ user_hashed_phone_number: sha("212612345678") }),
      "Snap init with the hashed phone",
      of(log, "snaptr")[0],
    );
    const gp = log.dataLayer.find((c) => c[1] === "purchase")?.[2] as Record<string, unknown> | undefined;
    check(!!gp && gp.transaction_id === ORDER_ID && gp.value === serverTotal && gp.currency === "MAD", "GA4 purchase transaction_id = order id", gp);
    const leftover = await page.evaluate(() => sessionStorage.getItem("lp-px-u"));
    check(leftover === null, "hashed contact data removed after the Purchase");
    await collectCsp();

    /* ---------- reload: no second Purchase ---------- */
    await page.reload({ waitUntil: "load" });
    await stubsReady();
    await page.waitForTimeout(300);
    log = await readLog(page);
    check(named(of(log, "fbq"), "track", "Purchase").length === 0 && named(of(log, "ttq"), "track", "Purchase").length === 0, "reloading the thank-you page sends no second Purchase");
    await collectCsp();

    /* ---------- server payload builder: same event id, value, hashes ---------- */
    const payload = OrderPayload.parse(orders[0]);
    const conv = purchaseConversion({
      orderId: ORDER_ID,
      createdAt: new Date(),
      payload,
      order: {
        totals: orderTotals(doc.product, doc.offers, payload.bundleId, payload.bump)!,
        items: { qty },
        phone: { e164: payload.phone, country: "MA" },
        email: null,
        name: payload.name,
        city: payload.city ?? null,
      } as unknown as Parameters<typeof purchaseConversion>[0]["order"],
      target: { doc, pageId: "PAGE01", source: "live" },
      riskScore: 0,
      ip: "127.0.0.1",
      ua: "e2e",
    });
    check(!!conv && conv.eventId === ORDER_ID && conv.value === serverTotal && conv.contentId === contentId, "server event: event_id = browser eventID, same value and content id", conv);
    check(payload.phone === "+212612345678", "order phone sent in E.164 (+212)", payload.phone);
    check(JSON.stringify(conv?.pixels) === JSON.stringify({ meta: META, tiktok: TIKTOK }), "server event targets every Meta/TikTok pixel of the page", conv?.pixels);

    check(csp.length === 0, `no CSP violation (landing, thank-you, vendor beacons)`, csp);
    check(
      vendorHits.some((u) => u.startsWith("https://www.facebook.com/tr")) && vendorHits.some((u) => u.startsWith("https://tr.snapchat.com/p")) && vendorHits.some((u) => u.includes("google-analytics.com/g/collect")),
      "vendor beacons reached their (mocked) hosts under the CSP",
      vendorHits.filter((u) => !/\.js|sdkid/.test(u)),
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails.length ? `✗ ${fails.length} failure(s): ${fails.join(" | ")}` : "✓ pixels e2e passed");
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
