/**
 * Public API abuse regressions (security review, area public-api). Exit code 1 on any failure.
 *
 *   node --conditions=react-server --env-file=.env.local --import tsx scripts/qa/public-api-security.ts
 *
 * Pure checks always run. With DATABASE_URL set, createOrder / recordEvent also run against the local
 * MariaDB on a throwaway page id (no page row needed) and every row they made is deleted afterwards.
 *  - client IP: CF-Connecting-IP only believed from Cloudflare's edge; IPv6 grouped by /64
 *  - honeypot submissions use up neither a victim phone's quota nor the page's
 *  - a page flood never refuses real shoppers (flag "page_burst" instead of 429)
 *  - "duplicate" only answered to the network that ordered, never with the earlier order id
 *  - per-phone limit counts stored orders; cancelled ones stop counting
 *  - connected exports cannot skip an enabled Turnstile (no Origin → refused; else held, no CAPI)
 *  - unique-visitor credit capped per network
 *  - database errors are logged without their bound values (no PII)
 *  - CORS wildcards on shared hosting suffixes are refused
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DrizzleQueryError, eq, sql } from "drizzle-orm";
import { errorSummary, logError } from "@/lib/orders/log";
import { originAllowed } from "@/lib/orders/origin";
import { scoreRisk, UNPROTECTED_MIN_SCORE, type RiskInput } from "@/lib/orders/risk";
import { canonicalIp, clientIp, isCloudflareIp, rateKeyIp } from "@/lib/security/ip";

let failures = 0;
const ok = (m: string) => console.log("  ✓", m);
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    failures++;
    console.log("  ✗", name, "\n     ", err instanceof Error ? err.message : err);
  }
}

/* ------------------------------------------------------------------ */
/* pure                                                                */
/* ------------------------------------------------------------------ */

async function pure() {
  console.log("pure checks");
  await check("canonicalIp strips ports, brackets, zones and IPv4-mapped prefixes", () => {
    assert.equal(canonicalIp("[2001:DB8::1]:443"), "2001:db8::1");
    assert.equal(canonicalIp("203.0.113.9:8080"), "203.0.113.9");
    assert.equal(canonicalIp("::ffff:203.0.113.9"), "203.0.113.9");
    assert.equal(canonicalIp("fe80::1%eth0"), "fe80::1");
    assert.equal(canonicalIp("unknown"), null);
    assert.equal(canonicalIp(""), null);
  });
  await check("rateKeyIp groups an IPv6 /64, keeps IPv4 addresses apart", () => {
    const a = rateKeyIp("2001:db8:1:2:aaaa::1");
    assert.equal(a, "2001:db8:1:2::/64");
    assert.equal(rateKeyIp("2001:0db8:0001:0002:ffff:ffff:ffff:ffff"), a);
    assert.equal(rateKeyIp("[2001:db8:1:2::9]:80"), a);
    assert.notEqual(rateKeyIp("2001:db8:1:3::1"), a);
    assert.equal(rateKeyIp("::ffff:198.51.100.7"), "198.51.100.7");
    assert.equal(rateKeyIp("64:ff9b::198.51.100.7"), "64:ff9b:0:0::/64");
    assert.notEqual(rateKeyIp("198.51.100.7"), rateKeyIp("198.51.100.8"));
  });
  await check("CF-Connecting-IP is only believed when the proxy hop is a Cloudflare edge", () => {
    const prev = { cf: process.env.BEHIND_CLOUDFLARE, hops: process.env.TRUSTED_PROXY_HOPS };
    try {
      delete process.env.TRUSTED_PROXY_HOPS;
      process.env.BEHIND_CLOUDFLARE = "1";
      const h = (xff: string, cf?: string) => new Headers({ "x-forwarded-for": xff, ...(cf ? { "cf-connecting-ip": cf } : {}) });
      assert.ok(isCloudflareIp("172.68.1.2") && isCloudflareIp("2a06:98c1::1") && !isCloudflareIp("198.51.100.7"));
      // straight to the origin with a forged header → the connecting address
      assert.equal(clientIp(h("198.51.100.7", "203.0.113.5")), "198.51.100.7");
      assert.equal(clientIp(h("10.0.0.1, 198.51.100.7", "203.0.113.5")), "198.51.100.7");
      // through Cloudflare → the visitor
      assert.equal(clientIp(h("203.0.113.5, 172.68.1.2", "203.0.113.5")), "203.0.113.5");
      assert.equal(clientIp(h("2a06:98c1::1", "2001:db8::77")), "2001:db8::77");
      assert.equal(clientIp(h("172.68.1.2", "not-an-ip")), "172.68.1.2");
      process.env.BEHIND_CLOUDFLARE = "0";
      assert.equal(clientIp(h("203.0.113.5, 172.68.1.2", "203.0.113.5")), "172.68.1.2");
      assert.equal(clientIp(new Headers()), "0.0.0.0");
    } finally {
      if (prev.cf === undefined) delete process.env.BEHIND_CLOUDFLARE;
      else process.env.BEHIND_CLOUDFLARE = prev.cf;
      if (prev.hops !== undefined) process.env.TRUSTED_PROXY_HOPS = prev.hops;
    }
  });
  await check("CORS wildcards on shared hosting / registry suffixes are refused", () => {
    assert.equal(originAllowed("https://attacker.vercel.app", ["*.vercel.app"]), false);
    assert.equal(originAllowed("https://attacker.netlify.app", ["https://*.netlify.app"]), false);
    assert.equal(originAllowed("https://evil.myshopify.com", ["*.myshopify.com"]), false);
    assert.equal(originAllowed("https://x.press.ma", ["*.press.ma"]), false);
    assert.equal(originAllowed("https://x.co.ma", ["*.co.ma"]), false);
    assert.equal(originAllowed("https://www.shop.ma", ["*.shop.ma"]), true);
    assert.equal(originAllowed("https://myshop.vercel.app", ["https://myshop.vercel.app"]), true);
  });
  await check("risk: export orders that skipped an enabled captcha reach the CAPI cut-off", async () => {
    const { CONVERSION_MAX_RISK } = await import("@/lib/orders/conversions");
    assert.ok(UNPROTECTED_MIN_SCORE >= CONVERSION_MAX_RISK);
    const base: RiskInput = { honeypot: false, t: 30_000, ua: "Mozilla/5.0", captcha: "unprotected", noOrigin: false, ipOrders24h: 0, badHistory: 0, delivered: 0 };
    assert.ok(scoreRisk(base).score >= CONVERSION_MAX_RISK);
    assert.ok(scoreRisk({ ...base, delivered: 5 }).score >= CONVERSION_MAX_RISK);
    assert.ok(scoreRisk({ ...base, captcha: "missing" }).score < CONVERSION_MAX_RISK);
    const flagged = scoreRisk({ ...base, captcha: "off", pageBurst: true, duplicate: true });
    assert.deepEqual(flagged.flags, ["page_burst", "duplicate"]);
    assert.equal(flagged.score, 70);
  });
  await check("errorSummary never prints query parameters or driver messages", () => {
    const pii = ["+212661234567", "Fatima Zahra", "12 Rue des Roses"];
    const driver = Object.assign(new Error(`Duplicate entry '${pii[0]}' for key 'x'`), {
      code: "ER_DUP_ENTRY",
      errno: 1062,
      sqlState: "23000",
      sqlMessage: `Duplicate entry '${pii[0]}' for key 'x'`,
    });
    const q = new DrizzleQueryError("insert into `orders` (`name`, `phone`, `address`) values (?, ?, ?)", pii, driver);
    const s = errorSummary(q);
    assert.equal(s, "Error: ER_DUP_ENTRY (1062)");
    const bare = new DrizzleQueryError("select 1 where phone = ?", [pii[0]], undefined as unknown as Error);
    assert.equal(errorSummary(bare), "Error: query_failed");
    assert.equal(errorSummary(new TypeError("boom")), "TypeError: boom");
    assert.equal(errorSummary("x"), "unknown error");
  });
}

/* ------------------------------------------------------------------ */
/* database                                                            */
/* ------------------------------------------------------------------ */

async function database() {
  console.log("database checks (local MariaDB)");
  const { db } = await import("@/lib/db/client");
  const { orders, statsDaily, statsVisitors } = await import("@/lib/db/schema");
  const { createOrder } = await import("@/lib/orders/create");
  const { recordEvent } = await import("@/lib/stats");
  const { hashIp } = await import("@/lib/security/crypto");
  // Turnstile "configured" for this process when the environment has no keys (Cloudflare's documented
  // test keys; the export path checked here never calls Cloudflare). A key saved in the admin wins.
  process.env.TURNSTILE_SITE_KEY ||= "1x00000000000000000000AA";
  process.env.TURNSTILE_SECRET_KEY ||= "1x0000000000000000000000000000000AA";
  const { getSetting } = await import("@/lib/settings");
  const { getFixture } = await import("@/lib/page/fixtures");
  const { validateDoc } = await import("@/lib/page/validate");
  const { getMarket } = await import("@/lib/markets");
  type PageTarget = import("@/lib/orders/resolve").PageTarget;
  type OrderPayload = import("@/lib/orders/contract").OrderPayload;

  const { doc } = validateDoc(getFixture("massage").doc);
  if (!doc) throw new Error("fixture document invalid");
  const id = () => randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase();
  const pageId = `QA${id().slice(2)}`;
  const target: PageTarget = { kind: "page", pageId, versionId: id(), exportId: null, exportMode: null, allowedOrigins: [], doc, source: "live" };
  const exportTarget: PageTarget = { ...target, kind: "export", exportId: id(), exportMode: "connected", allowedOrigins: ["https://shop.example"], source: "export" };

  const bundle = doc.offers.bundles[0]!;
  const variants = Array.from({ length: bundle.qty }, () =>
    Object.fromEntries(doc.product.variants.map((g) => [g.id, (g.options.find((o) => !o.soldOut) ?? g.options[0]!).id])),
  );
  const market = getMarket(doc.market);
  const city = market.cities?.[0]?.value ?? "Casablanca";
  let phoneSeq = 0;
  const newPhone = () => `066${String(Date.now() % 1_000_000).padStart(6, "0")}${phoneSeq++ % 10}`;
  const payload = (phone: string): OrderPayload => ({
    pageKey: "qa_public_api_key",
    idem: randomUUID(),
    eventId: `qa_${id()}`,
    bundleId: bundle.id,
    variants,
    bump: false,
    name: "Qa Tester",
    phone,
    city,
    address: "12 Rue Test, Maarif",
    email: "",
    website: "",
    t: 30_000,
    utm: {},
  });
  let ipSeq = 1;
  const usedIps: string[] = [];
  const newIp = () => {
    const ip = `198.51.100.${ipSeq++}`;
    usedIps.push(ip);
    return ip;
  };
  const order = (phone: string, ip: string, extra: { honeypot?: boolean; noOrigin?: boolean; target?: PageTarget } = {}) =>
    createOrder(payload(phone), { ip, ua: "Mozilla/5.0 (QA)", target: extra.target ?? target, noOrigin: extra.noOrigin ?? false, honeypot: extra.honeypot });
  const stored = async (orderId: string) => (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];

  try {
    await check("honeypot traffic uses up neither the victim phone's quota nor the page's", async () => {
      const victim = newPhone();
      for (let i = 0; i < 5; i++) {
        const r = await order(victim, newIp(), { honeypot: true });
        assert.equal(r.response.ok, true, "decoy answer");
        assert.equal(r.sync, false);
      }
      const real = await order(victim, newIp());
      assert.equal(real.response.ok, true, `real customer refused: ${JSON.stringify(real.response)}`);
      const [bucket] = (await db.execute(sql`SELECT count FROM rate_limits WHERE bucket = ${`order:page:${pageId}`}`)) as unknown as [{ count: number }[]];
      assert.equal(Number(bucket[0]?.count ?? 0), 1, "only the real order counted for the page");
    });

    await check("a page flood flags orders instead of refusing real shoppers", async () => {
      await db.execute(sql`
        INSERT INTO rate_limits (bucket, count, reset_at) VALUES (${`order:page:${pageId}`}, 5000, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 600 SECOND))
        ON DUPLICATE KEY UPDATE count = 5000, reset_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 600 SECOND)`);
      const r = await order(newPhone(), newIp());
      assert.equal(r.response.ok, true, `refused: ${JSON.stringify(r.response)}`);
      const row = await stored((r.response as { orderId: string }).orderId);
      assert.ok(row?.flags?.includes("page_burst"), `flags: ${JSON.stringify(row?.flags)}`);
      await db.execute(sql`DELETE FROM rate_limits WHERE bucket = ${`order:page:${pageId}`}`);
    });

    await check("duplicate: only the ordering network hears it, never with an order id", async () => {
      const phone = newPhone();
      const home = newIp();
      const first = await order(phone, home);
      assert.equal(first.response.ok, true);
      const stranger = await order(phone, newIp());
      assert.equal(stranger.response.ok, true, `stranger learned something: ${JSON.stringify(stranger.response)}`);
      const flagged = await stored((stranger.response as { orderId: string }).orderId);
      assert.ok(flagged?.flags?.includes("duplicate"));
      const again = await order(phone, home);
      assert.deepEqual(again.response, { ok: false, error: "duplicate" });
    });

    await check("per-phone limit counts stored orders; a cancelled one frees a slot", async () => {
      const phone = newPhone();
      const ids: string[] = [];
      for (let i = 0; i < 4; i++) {
        const r = await order(phone, newIp());
        assert.equal(r.response.ok, true, `order ${i + 1}: ${JSON.stringify(r.response)}`);
        ids.push((r.response as { orderId: string }).orderId);
      }
      const fifth = await order(phone, newIp());
      assert.deepEqual(fifth.response, { ok: false, error: "rate_limited" });
      assert.ok(fifth.retryAfter && fifth.retryAfter > 86_000 && fifth.retryAfter <= 86_400, `retryAfter ${fifth.retryAfter}`);
      await db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, ids[0]!));
      const sixth = await order(phone, newIp());
      assert.equal(sixth.response.ok, true);
    });

    await check("per-IP limit holds across a whole IPv6 /64", async () => {
      const prefix = `2001:db8:ab:${(Date.now() % 0xffff).toString(16)}`;
      const net = (n: number) => `${prefix}::${n.toString(16)}`;
      usedIps.push(net(1));
      for (let i = 1; i <= 8; i++) assert.equal((await order(newPhone(), net(i))).response.ok, true, `order ${i}`);
      const ninth = await order(newPhone(), net(0xbeef));
      assert.deepEqual(ninth.response, { ok: false, error: "rate_limited" });
    });

    const captcha = await getSetting("turnstile");
    if (captcha.siteKey && captcha.secretKey) {
      await check("connected export cannot skip the enabled Turnstile", async () => {
        const script = await order(newPhone(), newIp(), { target: exportTarget, noOrigin: true });
        assert.deepEqual(script.response, { ok: false, error: "invalid" });
        const browser = await order(newPhone(), newIp(), { target: exportTarget });
        assert.equal(browser.response.ok, true);
        assert.equal(browser.conversion, undefined, "no server-side Purchase for an unprotected order");
        const row = await stored((browser.response as { orderId: string }).orderId);
        assert.ok((row?.riskScore ?? 0) >= UNPROTECTED_MIN_SCORE && row?.flags?.includes("captcha_missing"));
      });
    } else {
      console.log("  - Turnstile not configured: export captcha check skipped");
    }

    await check("unique-visitor credit is capped per network and page", async () => {
      const ip = newIp();
      for (let i = 0; i < 60; i++) await recordEvent(pageId, { type: "view", vid: `qa${id()}` }, ip);
      await recordEvent(pageId, { type: "view", vid: `qa${id()}` }, newIp());
      const [s] = await db
        .select({ views: sql<number>`SUM(${statsDaily.views})`, uniques: sql<number>`SUM(${statsDaily.uniques})` })
        .from(statsDaily)
        .where(eq(statsDaily.pageId, pageId));
      assert.equal(Number(s?.views), 61);
      assert.equal(Number(s?.uniques), 51);
      const [m] = await db.select({ n: sql<number>`COUNT(*)` }).from(statsVisitors).where(eq(statsVisitors.pageId, pageId));
      assert.equal(Number(m?.n), 51, "no visitor markers above the cap");
    });

    await check("a failing query is logged without its bound values", async () => {
      const secretPhone = "+212669999999";
      const lines: string[] = [];
      const orig = console.error;
      console.error = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
      try {
        await db.execute(sql`SELECT * FROM no_such_table_qa WHERE phone = ${secretPhone}`).catch((err) => logError("qa", err));
      } finally {
        console.error = orig;
      }
      assert.equal(lines.length, 1);
      assert.ok(!lines[0]!.includes(secretPhone) && !lines[0]!.includes("no_such_table_qa"), lines[0]);
      assert.match(lines[0]!, /ER_NO_SUCH_TABLE/);
    });
  } finally {
    const hashes = [...new Set(usedIps.map((ip) => hashIp(ip)))];
    await db.delete(orders).where(eq(orders.pageId, pageId));
    await db.delete(statsDaily).where(eq(statsDaily.pageId, pageId));
    await db.delete(statsVisitors).where(eq(statsVisitors.pageId, pageId));
    await db.execute(sql`DELETE FROM rate_limits WHERE bucket LIKE ${`%${pageId}%`}`);
    for (const h of hashes) await db.execute(sql`DELETE FROM rate_limits WHERE bucket LIKE ${`%${h}%`}`);
  }
}

async function main() {
  await pure();
  if (process.env.DATABASE_URL) await database();
  else console.log("DATABASE_URL not set: database checks skipped");
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
