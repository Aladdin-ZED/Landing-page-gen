/**
 * Turnstile end-to-end (offline): the real published HTML + its real CSP header, served by a local
 * HTTP server; Cloudflare's api.js is replaced by a mock through Playwright routing.
 * Checks: no Cloudflare request before the first form interaction · widget rendered with the site
 * key (interaction-only) · token sent as `cf` · token consumed after a rejected order and a fresh one
 * sent on retry · zero CSP violations.
 *   npx tsx scripts/qa/turnstile-e2e.ts
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve, normalize } from "node:path";
import { chromium, type Browser } from "playwright";
import { liveLinks } from "@/landing/context";
import { fixtureAssets, getFixture } from "@/lib/page/fixtures";
import { validateDoc } from "@/lib/page/validate";
import { renderLandingHtml, renderThankYouHtml } from "@/lib/render/core";

const ROOT = resolve(__dirname, "..", "..");
const PUBLIC = join(ROOT, "public");
const SITE_KEY = "1x00000000000000000000AA";

const MOCK_API = `(() => {
  const log = (window.__ts = { renders: [], resets: 0, n: 0 });
  window.turnstile = {
    render(el, opts) {
      log.renders.push({ sitekey: opts.sitekey, appearance: opts.appearance, action: opts.action, inBox: el.hasAttribute("data-lp-captcha") });
      log.opts = opts;
      const f = document.createElement("iframe");
      f.src = "https://challenges.cloudflare.com/cdn-cgi/challenge-platform/mock";
      f.width = "300"; f.height = "0";
      el.appendChild(f);
      setTimeout(() => opts.callback("tok-" + ++log.n), 150);
      return "w1";
    },
    reset() { log.resets++; setTimeout(() => log.opts.callback("tok-" + ++log.n), 150); },
    remove() {},
  };
})();`;

async function main() {
  const fx = getFixture("massage");
  const { doc } = validateDoc(fx.doc);
  if (!doc) throw new Error("fixture invalid");
  const server = createServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const origin = `http://127.0.0.1:${port}`;
  const opts = {
    mode: "live" as const,
    assets: fixtureAssets("/"),
    pageKey: "pk_e2e_turnstile",
    store: fx.store,
    links: liveLinks("massage"),
    urls: { landing: "/massage", thankYou: "/massage/merci", endpoints: { order: "/api/public/order" } },
    origin,
    turnstileSiteKey: SITE_KEY,
    upgradeInsecureRequests: false,
  };
  const landing = await renderLandingHtml(doc, opts);
  const thanks = await renderThankYouHtml(doc, opts);
  const orders: Record<string, unknown>[] = [];
  let reject = true;

  server.on("request", (req, res) => {
    const url = new URL(req.url ?? "/", origin);
    if (req.method === "POST" && url.pathname === "/api/public/order") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        orders.push(JSON.parse(body) as Record<string, unknown>);
        res.setHeader("Content-Type", "application/json");
        // first attempt: rejected (as the API does for a failed captcha) → the runtime must renew the token
        if (reject) {
          reject = false;
          res.end(JSON.stringify({ ok: false, error: "blocked" }));
        } else res.end(JSON.stringify({ ok: true, orderId: "CMD-E2E001", total: 399, currency: "MAD" }));
      });
      return;
    }
    if (url.pathname === "/massage" || url.pathname === "/massage/merci") {
      const d = url.pathname === "/massage" ? landing : thanks;
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
  for (const o of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try {
      browser = await chromium.launch(o);
      break;
    } catch {
      /* next channel */
    }
  }
  if (!browser) throw new Error("no browser");
  const fails: string[] = [];
  const check = (ok: boolean, what: string) => {
    console.log(`${ok ? "✓" : "✗"} ${what}`);
    if (!ok) fails.push(what);
  };
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const cfRequests: string[] = [];
    await page.route("https://challenges.cloudflare.com/**", (route) => {
      cfRequests.push(route.request().url());
      const isApi = route.request().url().includes("/turnstile/v0/api.js");
      return route.fulfill({ status: 200, contentType: isApi ? "text/javascript" : "text/html", body: isApi ? MOCK_API : "<!doctype html><title>cf</title>" });
    });
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    page.on("pageerror", (e) => fails.push(`page error: ${e.message}`));
    const cspConsole: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy/i.test(m.text())) cspConsole.push(m.text().slice(0, 200));
    });
    await page.goto(`${origin}/massage`, { waitUntil: "load" });
    await page.waitForTimeout(400);
    check(cfRequests.length === 0, "no Cloudflare request before the first form interaction");

    await page.locator("#order-form [name=name]").focus();
    await page.waitForFunction(() => !!(window as unknown as { __ts?: { renders: unknown[] } }).__ts?.renders.length, null, { timeout: 5000 });
    const ts = await page.evaluate(() => (window as unknown as { __ts: { renders: { sitekey: string; appearance: string; action: string; inBox: boolean }[] } }).__ts.renders);
    check(ts.length === 1 && ts[0]!.sitekey === SITE_KEY && ts[0]!.appearance === "interaction-only" && ts[0]!.inBox, `widget rendered once with the site key, interaction-only (${JSON.stringify(ts)})`);

    await page.fill("#order-form [name=name]", "Salma Test");
    await page.fill("#order-form [name=phone]", "0612345678");
    const city = page.locator("#order-form select[name=city]");
    if (await city.count()) await city.selectOption({ index: 1 });
    await page.fill("#order-form [name=address]", "12 rue Test, Casablanca");
    // one option per variant group of the selected units (inputs may be visually hidden behind swatches)
    await page.evaluate(() => {
      const seen = new Set<string>();
      for (const r of document.querySelectorAll<HTMLInputElement>("#order-form [data-lp-variants] input[type=radio]")) {
        if (seen.has(r.name) || r.name.includes("{") || r.disabled || r.closest("[hidden], template")) continue;
        seen.add(r.name);
        if (!document.querySelector(`#order-form input[name="${CSS.escape(r.name)}"]:checked`)) r.click();
      }
    });
    await page.locator("#order-form [data-lp-submit]").click();
    await page.waitForFunction(() => document.querySelector("#order-form")?.getAttribute("data-state") === "error", null, { timeout: 15000 });
    check(orders.length === 1 && orders[0]!.cf === "tok-1", `first order carries cf=tok-1 (${String(orders[0]?.cf)})`);
    await page.waitForTimeout(400);
    const resets = await page.evaluate(() => (window as unknown as { __ts: { resets: number } }).__ts.resets);
    check(resets === 1, `token consumed after the rejected order (resets=${resets})`);

    await Promise.all([page.waitForURL(/\/massage\/merci\?o=CMD-E2E001/, { timeout: 15000 }), page.locator("#order-form [data-lp-submit]").click()]);
    check(orders.length === 2 && orders[1]!.cf === "tok-2", `retry carries the fresh token cf=tok-2 (${String(orders[1]?.cf)})`);
    check(orders[1]!.idem === orders[0]!.idem, "same idempotency key across the retry");
    const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
    check(csp.length === 0 && cspConsole.length === 0, `no CSP violation on either page (${[...csp, ...cspConsole].join(" | ")})`);
    check(landing.csp.includes("frame-src https://challenges.cloudflare.com") && landing.csp.includes("connect-src 'self' https://challenges.cloudflare.com"), "landing CSP allows the Turnstile frame");
    check(!thanks.csp.includes("challenges.cloudflare.com") && !thanks.html.includes(SITE_KEY), "thank-you page has no Turnstile");
  } finally {
    await browser.close();
    server.close();
  }
  console.log(fails.length ? `✗ ${fails.length} failure(s): ${fails.join(" | ")}` : "✓ turnstile e2e passed");
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
