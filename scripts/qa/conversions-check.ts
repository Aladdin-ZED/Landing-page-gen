/**
 * Ad pixels — server side, offline (fetch is mocked; no network, no database):
 *  - Tracking schema: legacy single ids → lists, dedupe, limits, empty → unset;
 *  - per-pixel server credentials with the legacy single-token fallback;
 *  - Settings → Pixels: masked-token resolution, legacy migration, validation, no token in summaries;
 *  - redactSetting masks per-pixel token maps;
 *  - Purchase payloads: event_id = order id, same event names as the browser pixel, hashed E.164
 *    phone (Morocco), contents/quantity, one request per pixel with a token, tokens never in URLs;
 *  - transport: retry on 5xx, failures never throw, TikTok non-zero codes are failures;
 *  - "Send test event": test_event_code always set, the platform's answer is reported.
 *
 *   npx tsx scripts/qa/conversions-check.ts      (exit code 1 on failure)
 */
import { createHash } from "node:crypto";
import { OrderPayload } from "@/lib/orders/contract";
import { CONVERSION_MAX_RISK, dispatchPurchase, purchaseConversion, sendTestEvent, serverCredentials, type TrackingSecrets } from "@/lib/orders/conversions-core";
import { getFixture } from "@/lib/page/fixtures";
import { PageDoc, Tracking } from "@/lib/page/schema";
import { validatePixelForm } from "@/lib/pixels/form";
import { PIXEL_EVENTS } from "@/lib/pixels/ids";
import { PixelSettingsError, pixelFormValues, resolvePixelSettings, summarize } from "@/lib/pixels/settings";
import { mergeStorePixels, runtimePixels, trackingFlags } from "@/lib/pixels/tracking";
import { TrackingSecretsSettings, redactSetting } from "@/lib/settings/schemas";

let pass = 0;
const failures: string[] = [];
function eq(label: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) pass++;
  else failures.push(`${label}\n    got:  ${g}\n    want: ${w}`);
}
function ok(label: string, cond: boolean, info?: unknown): void {
  if (cond) pass++;
  else failures.push(`${label}${info === undefined ? "" : `\n    ${JSON.stringify(info)}`}`);
}
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

const META_A = "111111111111111";
const META_B = "222222222222222";
const TT_1 = "CTESTPIXEL0000000001";
const TT_2 = "CTESTPIXEL0000000002";
const SNAP = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";

/* ---------------- Tracking schema ---------------- */
eq("legacy single id → list", Tracking.parse({ metaPixelId: META_A, ga4Id: "G-TEST1234" }), { metaPixelId: [META_A], ga4Id: ["G-TEST1234"] });
eq("lists kept, deduplicated", Tracking.parse({ tiktokPixelId: [TT_1, TT_2, TT_1] }).tiktokPixelId, [TT_1, TT_2]);
eq("empty list → unset", Tracking.parse({ metaPixelId: [] }).metaPixelId, undefined);
ok("4 Meta pixels refused", !Tracking.safeParse({ metaPixelId: [META_A, META_B, "333333333333333", "444444444444444"] }).success);
ok("2 Snap pixels refused", !Tracking.safeParse({ snapPixelId: [SNAP, "9a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"] }).success);
ok("invalid id refused", !Tracking.safeParse({ tiktokPixelId: ["lowercase-id"] }).success);
{
  const fx = getFixture("massage");
  const legacy = PageDoc.safeParse({ ...fx.doc, tracking: { metaPixelId: META_A, tiktokPixelId: TT_1 } });
  ok("legacy page document still parses", legacy.success);
  if (legacy.success) {
    eq("legacy page → runtime pixels", runtimePixels(legacy.data.tracking), { meta: [META_A], tiktok: [TT_1] });
    eq("legacy page → CSP flags", trackingFlags(legacy.data.tracking), { meta: true, tiktok: true, snap: false, ga4: false });
  }
  eq("runtime pixels read raw legacy strings", runtimePixels({ metaPixelId: META_A, snapPixelId: SNAP }), { meta: [META_A], snap: [SNAP] });
}
eq(
  "mergeStorePixels fill keeps the page's own ids",
  mergeStorePixels({ metaPixelId: [META_B] }, { metaPixelId: [META_A], tiktokPixelId: [TT_1] }, "fill"),
  { metaPixelId: [META_B], tiktokPixelId: [TT_1] },
);
eq(
  "mergeStorePixels replace takes the store lists, keeps other platforms",
  mergeStorePixels({ metaPixelId: [META_B], ga4Id: ["G-PAGE1234"] }, { metaPixelId: [META_A, META_B] }, "replace"),
  { metaPixelId: [META_A, META_B], ga4Id: ["G-PAGE1234"] },
);

/* ---------------- secrets: schema, redaction, credentials ---------------- */
const legacySecrets: TrackingSecrets = TrackingSecretsSettings.parse({
  metaCapiToken: "legacyMetaToken123",
  metaTestEventCode: "TEST111",
  tiktokToken: "legacyTikTokToken99",
  snapToken: "snapToken12345",
});
eq("legacy secrets parse with empty maps", [legacySecrets.metaTokens, legacySecrets.tiktokTestCodes], [{}, {}]);
{
  const s = TrackingSecretsSettings.parse({ metaTokens: { [META_A]: "ownTokenAAAA1111" }, metaTestCodes: { [META_A]: "TEST222" } });
  const red = redactSetting("tracking_secrets", s);
  eq("redactSetting masks per-pixel tokens", red.metaTokens, { [META_A]: "••••1111" });
  eq("own token + own test code", serverCredentials(s, "meta", META_A), { token: "ownTokenAAAA1111", testCode: "TEST222", source: "pixel" });
  eq("no token → browser only", serverCredentials(s, "meta", META_B), null);
  eq("legacy token covers any pixel", serverCredentials(legacySecrets, "meta", META_B), { token: "legacyMetaToken123", testCode: "TEST111", source: "legacy" });
  ok("token map keys must be pixel ids", !TrackingSecretsSettings.safeParse({ metaTokens: { "not-an-id": "ownTokenAAAA1111" } }).success);
}

/* ---------------- Settings → Pixels form ---------------- */
{
  const store = Tracking.parse({ metaPixelId: [META_A] });
  const rows = pixelFormValues(store, legacySecrets);
  eq("legacy token shown as a mask on the store pixel", rows.meta, [{ origin: META_A, id: META_A, token: "••••n123", testCode: "TEST111" }]);
  const next = resolvePixelSettings(
    {
      ...rows,
      meta: [rows.meta[0]!, { origin: "", id: ` ${META_B} `, token: "newTokenBBBB2222", testCode: "" }],
      tiktok: [{ origin: "", id: "ctestpixel0000000001", token: "", testCode: "" }],
      snap: [{ origin: "", id: SNAP.toUpperCase(), token: "", testCode: "" }],
      ga4: [{ origin: "", id: "", token: "", testCode: "" }],
    },
    legacySecrets,
  );
  eq("saved pixel lists (normalized)", next.pixels, { metaPixelId: [META_A, META_B], tiktokPixelId: [TT_1], snapPixelId: [SNAP] });
  eq("masked token resolved to the stored one + new token", next.secrets.metaTokens, { [META_A]: "legacyMetaToken123", [META_B]: "newTokenBBBB2222" });
  eq("test code kept per pixel", next.secrets.metaTestCodes, { [META_A]: "TEST111" });
  eq("legacy single values folded and cleared", [next.secrets.metaCapiToken, next.secrets.metaTestEventCode, next.secrets.tiktokToken], [undefined, undefined, undefined]);
  eq("Snap token kept as is", next.secrets.snapToken, "snapToken12345");
  let threw = "";
  try {
    resolvePixelSettings({ meta: [{ origin: META_B, id: META_B, token: "••••zzzz", testCode: "" }], tiktok: [], snap: [], ga4: [] }, TrackingSecretsSettings.parse({}));
  } catch (e) {
    threw = e instanceof PixelSettingsError ? e.message : "other";
  }
  ok("mask without a stored token is refused", /paste it again/.test(threw), threw);
  const errs = validatePixelForm({
    meta: [
      { origin: "", id: META_A, token: "", testCode: "" },
      { origin: "", id: META_A, token: "bad token", testCode: "test" },
    ],
    tiktok: [{ origin: "", id: "", token: "someTokenValue123", testCode: "" }],
    snap: [],
    ga4: [{ origin: "", id: "UA-1234", token: "", testCode: "" }],
  });
  eq("form errors", Object.keys(errs).sort(), ["ga4.0.id", "meta.1.id", "meta.1.testCode", "meta.1.token", "tiktok.0.id"]);
  const summary = summarize(next.pixels, next.secrets);
  const json = JSON.stringify(summary);
  ok("summary never contains a token", !json.includes("legacyMetaToken123") && !json.includes("newTokenBBBB2222"), json);
  eq("summary flags", summary.platforms.meta, [
    { id: META_A, server: true, testMode: true },
    { id: META_B, server: true, testMode: false },
  ]);
  eq("summary tracking for new pages", summary.tracking, { metaPixelId: [META_A, META_B], tiktokPixelId: [TT_1], snapPixelId: [SNAP] });
}

/* ---------------- Purchase payloads + transport (mocked fetch) ---------------- */
interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}
const calls: Call[] = [];
let respond: (url: string, n: number) => { status: number; json: unknown } | "throw" = () => ({ status: 200, json: {} });
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string>, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
  const r = respond(url, calls.filter((c) => c.url === url).length);
  if (r === "throw") throw new TypeError("fetch failed");
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const okAnswer = (url: string) =>
  url.includes("graph.facebook.com") ? { status: 200, json: { events_received: 1, messages: [], fbtrace_id: "AbCdEf" } } : { status: 200, json: { code: 0, message: "OK", request_id: "req-1" } };

async function main() {
  const fx = getFixture("massage");
  const doc = PageDoc.parse({ ...fx.doc, tracking: { metaPixelId: [META_A, META_B], tiktokPixelId: [TT_1, TT_2], snapPixelId: [SNAP] } });
  const payload = OrderPayload.parse({
    pageKey: fx.pageKey,
    idem: "123e4567-e89b-42d3-a456-426614174000",
    eventId: "browser-uuid-0001",
    bundleId: doc.offers.bundles[0]!.id,
    name: "Salma Test",
    phone: "+212612345678",
    t: 9000,
    utm: { ttclid: "E.C.P.ttclid12345" },
    fbp: "fb.1.1700000000000.1234567890",
    fbc: "fb.1.1700000000000.IwAR0abcdefgh",
    ttp: "ttp-cookie-value-123",
    ref: "https://shop.example/massage?utm_source=fb#top",
  });
  const order = {
    totals: { total: 399 },
    items: { qty: 2 },
    phone: { e164: "+212612345678", country: "MA" },
    email: null,
    name: "Salma Test",
    city: "Casablanca",
  } as unknown as Parameters<typeof purchaseConversion>[0]["order"];
  const target = { doc, pageId: "PAGE01", source: "live" as const };
  const at = new Date("2026-10-15T10:00:00Z");
  const base = { orderId: "CMD-PX0001", createdAt: at, payload, order, target, ip: "105.66.1.2", ua: "Mozilla/5.0 test" };

  ok("risky orders are not sent", purchaseConversion({ ...base, riskScore: CONVERSION_MAX_RISK }) === null);
  ok("no Meta/TikTok pixel → no event", purchaseConversion({ ...base, riskScore: 0, target: { ...target, doc: { ...doc, tracking: { snapPixelId: [SNAP] } } } }) === null);
  const c = purchaseConversion({ ...base, riskScore: 10 })!;
  eq("event id = order id (not the browser uuid)", c.eventId, "CMD-PX0001");
  eq("event pixels", c.pixels, { meta: [META_A, META_B], tiktok: [TT_1, TT_2] });
  eq("source url cleaned (no fragment)", c.sourceUrl, "https://shop.example/massage?utm_source=fb");

  const secrets = TrackingSecretsSettings.parse({
    metaTokens: { [META_A]: "metaTokenAAAA1111" },
    metaTestCodes: { [META_A]: "TEST123" },
    tiktokToken: "tiktokLegacyToken99",
  });
  respond = (url) => okAnswer(url);
  calls.length = 0;
  const results = await dispatchPurchase(c, secrets);
  eq(
    "one request per pixel with a token",
    results.map((r) => `${r.platform}:${r.pixelId}:${r.ok}:${r.testMode}`).sort(),
    [`meta:${META_A}:true:true`, `tiktok:${TT_1}:true:false`, `tiktok:${TT_2}:true:false`],
  );
  const meta = calls.find((x) => x.url.includes("graph.facebook.com"))!;
  const metaEvent = (meta.body.data as Record<string, unknown>[])[0]!;
  eq("Meta URL (no token in it)", meta.url, `https://graph.facebook.com/v26.0/${META_A}/events`);
  eq("Meta token in the body", meta.body.access_token, "metaTokenAAAA1111");
  eq("Meta test event code", meta.body.test_event_code, "TEST123");
  eq("Meta event name = browser purchase name", metaEvent.event_name, PIXEL_EVENTS.meta.purchase);
  eq("Meta event id", metaEvent.event_id, "CMD-PX0001");
  eq("Meta event time", metaEvent.event_time, Math.floor(at.getTime() / 1000));
  eq("Meta custom data", metaEvent.custom_data, {
    currency: "MAD",
    value: 399,
    content_ids: [doc.product.sku || fx.pageKey],
    content_type: "product",
    content_name: doc.product.name,
    contents: [{ id: doc.product.sku || fx.pageKey, quantity: 2, item_price: 199.5 }],
    num_items: 2,
    order_id: "CMD-PX0001",
  });
  const ud = metaEvent.user_data as Record<string, unknown>;
  eq("Meta ph = sha256 of 212… digits", ud.ph, [sha("212612345678")]);
  eq("Meta fn/ln/ct/country hashed", [ud.fn, ud.ln, ud.ct, ud.country], [[sha("salma")], [sha("test")], [sha("casablanca")], [sha("ma")]]);
  eq("Meta clear ids", [ud.client_ip_address, ud.client_user_agent, ud.fbp, ud.fbc], ["105.66.1.2", "Mozilla/5.0 test", payload.fbp, payload.fbc]);
  const tts = calls.filter((x) => x.url.includes("business-api.tiktok.com"));
  eq("TikTok one request per pixel code", tts.map((x) => x.body.event_source_id).sort(), [TT_1, TT_2]);
  eq("TikTok token in the header only", [tts[0]!.headers["Access-Token"], JSON.stringify(tts[0]!.body).includes("tiktokLegacyToken99")], ["tiktokLegacyToken99", false]);
  ok("TikTok without a test code", tts.every((x) => !("test_event_code" in x.body)));
  const ttEvent = (tts[0]!.body.data as Record<string, unknown>[])[0]!;
  eq("TikTok event name = browser purchase name", ttEvent.event, PIXEL_EVENTS.tiktok.purchase);
  eq("TikTok event id", ttEvent.event_id, "CMD-PX0001");
  eq("TikTok phone = sha256 of +212 E.164", (ttEvent.user as Record<string, unknown>).phone, sha("+212612345678"));
  eq("TikTok click/browser ids", [(ttEvent.user as Record<string, unknown>).ttclid, (ttEvent.user as Record<string, unknown>).ttp], ["E.C.P.ttclid12345", "ttp-cookie-value-123"]);
  eq("TikTok properties", ttEvent.properties, {
    contents: [{ content_id: doc.product.sku || fx.pageKey, content_type: "product", content_name: doc.product.name, quantity: 2, price: 199.5 }],
    content_type: "product",
    content_ids: [doc.product.sku || fx.pageKey],
    currency: "MAD",
    value: 399,
    order_id: "CMD-PX0001",
  });

  // transport: a 500 is retried once; a network failure and a TikTok error code are failures, never throws
  respond = (url, n) => (url.includes("graph.facebook.com") && n === 1 ? { status: 500, json: { error: { message: "temporary" } } } : okAnswer(url));
  calls.length = 0;
  const one = { ...c, pixels: { meta: [META_A], tiktok: [] } };
  const retried = await dispatchPurchase(one, secrets);
  eq("5xx retried once then ok", [retried.map((r) => r.ok), calls.length], [[true], 2]);
  respond = () => "throw";
  const down = await dispatchPurchase(c, secrets);
  ok("network failure → results ok:false, no throw", down.length === 3 && down.every((r) => !r.ok && !!r.detail), down);
  respond = (url) => (url.includes("tiktok") ? { status: 200, json: { code: 40001, message: "Access token invalid" } } : okAnswer(url));
  const ttErr = await dispatchPurchase({ ...c, pixels: { meta: [], tiktok: [TT_1] } }, secrets);
  ok("TikTok non-zero code is a failure", ttErr.length === 1 && !ttErr[0]!.ok && /40001/.test(ttErr[0]!.detail ?? ""), ttErr);
  eq("no token → nothing sent", (await dispatchPurchase(c, TrackingSecretsSettings.parse({}))).length, 0);

  // Settings → Pixels "Send test event"
  respond = (url) => okAnswer(url);
  calls.length = 0;
  const t1 = await sendTestEvent({ platform: "meta", pixelId: META_B, token: "metaTokenBBBB2222", testCode: "TEST999", siteUrl: "https://shop.example/", currency: "MAD", country: "MA" });
  const tb = calls[0]!.body;
  ok("test event: ok + facts", t1.ok && t1.facts.includes("events_received: 1") && t1.facts.includes("fbtrace_id: AbCdEf"), t1);
  eq("test event carries the test code + Purchase", [tb.test_event_code, (tb.data as Record<string, unknown>[])[0]!.event_name], ["TEST999", "Purchase"]);
  ok("test event id is TEST-…", /^TEST-[0-9A-F]{8}$/.test(t1.eventId), t1.eventId);
  respond = () => ({ status: 400, json: { error: { message: "Invalid OAuth access token.", code: 190, fbtrace_id: "Zz" } } });
  const t2 = await sendTestEvent({ platform: "meta", pixelId: META_B, token: "badTokenBBBB2222", testCode: "TEST999", siteUrl: null, currency: "MAD", country: "MA" });
  ok("test event: platform error reported", !t2.ok && t2.message === "Invalid OAuth access token." && t2.status === 400 && t2.facts.includes("code 190"), t2);
  respond = () => ({ status: 200, json: { code: 40002, message: "pixel code not found", request_id: "r2" } });
  const t3 = await sendTestEvent({ platform: "tiktok", pixelId: TT_1, token: "tiktokTokenXYZ123", testCode: "TEST42", siteUrl: null, currency: "MAD", country: "MA" });
  ok("TikTok test event error reported", !t3.ok && t3.message === "pixel code not found" && t3.facts.some((f) => f.includes("40002")), t3);
  respond = () => "throw";
  const t4 = await sendTestEvent({ platform: "tiktok", pixelId: TT_1, token: "tiktokTokenXYZ123", testCode: "TEST42", siteUrl: null, currency: "MAD", country: "MA" });
  ok("unreachable platform reported", !t4.ok && t4.status === null && /Couldn't reach TikTok/.test(t4.message), t4);

  globalThis.fetch = realFetch;
  for (const f of failures) console.log(`✗ ${f}`);
  console.log(failures.length ? `✗ ${failures.length} failure(s), ${pass} passed` : `✓ conversions check passed (${pass} assertions)`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
