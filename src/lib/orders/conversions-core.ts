/**
 * Server-side conversion events — the pure core: no database, no Next.js (unit-testable with a
 * mocked fetch, see scripts/qa/conversions-check.ts).
 *
 *   purchaseConversion(order…)            the Purchase event of a fresh order (or null)
 *   dispatchPurchase(event, secrets)      Meta Conversions API + TikTok Events API, one request per
 *                                         pixel that has a server token; never throws
 *   sendTestEvent(…)                      Settings → Pixels "Send test event" (test_event_code only)
 *
 * Deduplication with the browser pixels (src/landing/runtime/pixels.ts): the same event names
 * (PIXEL_EVENTS) and event_id = purchaseEventId(orderId) — the order id the thank-you page reports
 * as Meta eventID / TikTok event_id / Snap client_dedup_id.
 *
 * Customer data is normalized and SHA-256 hashed here (phone in E.164 — Morocco +212…, name,
 * e-mail, city, country); only the client IP, the user agent and the platforms' own browser / click
 * ids (fbp, fbc, ttp, ttclid) travel in clear, as both APIs require. Tokens go in the request body
 * (Meta) or a header (TikTok), never in a URL, and never in logs or results.
 */
import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { round2 } from "@/lib/page/pricing";
import type { PageDoc } from "@/lib/page/schema";
import { PIXEL_EVENTS, PIXEL_NAMES, pixelIdList, purchaseEventId, type ServerPlatform } from "@/lib/pixels/ids";
import type { SettingValue } from "@/lib/settings/schemas";
import type { OrderPayload } from "./contract";
import type { PageTarget } from "./resolve";
import type { ValidOrder } from "./validate";

/** Meta Graph API version for the Conversions API — the one place to bump it (v26.0: July 2026). */
export const META_GRAPH_API_VERSION = "v26.0";
export const META_PURCHASE_EVENT = PIXEL_EVENTS.meta.purchase;
export const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
/** Equal to the browser pixel's purchase event (deduplication): TikTok's current "Purchase". */
export const TIKTOK_PURCHASE_EVENT = PIXEL_EVENTS.tiktok.purchase;

/**
 * Orders scoring this high (scoreRisk: bot user agent, instant submit, repeated IP…) are kept out of
 * the ad platforms' optimisation. They are still stored and shown to the call center.
 */
export const CONVERSION_MAX_RISK = 70;

const REQUEST_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 1_200;

export type TrackingSecrets = SettingValue<"tracking_secrets">;

export interface PurchaseConversion {
  orderId: string;
  /** browser ↔ server deduplication key = purchaseEventId(orderId) */
  eventId: string;
  pageId: string;
  /** live page (slug fallback for the event URL) or connected export */
  source: "live" | "export";
  time: Date;
  /** order total (server-computed), currency of the page */
  value: number;
  currency: string;
  qty: number;
  contentId: string;
  contentName: string;
  customer: {
    /** E.164 "+212612345678" */
    phone: string;
    email: string | null;
    name: string;
    city: string | null;
    /** ISO 3166-1 alpha-2 */
    country: string | null;
  };
  client: { ip: string | null; ua: string | null; fbp?: string; fbc?: string; ttclid?: string; ttp?: string };
  /** page URL the order came from (validated http(s)), else null */
  sourceUrl: string | null;
  /** the page's pixel ids (server events go to those with a token) */
  pixels: { meta: string[]; tiktok: string[] };
}

/* ------------------------------------------------------------------ */
/* building the event (inside createOrder)                             */
/* ------------------------------------------------------------------ */

const FBP_RE = /^fb\.[0-9]\.[0-9]{10,16}\.[0-9]{1,30}$/;
const FBC_RE = /^fb\.[0-9]\.[0-9]{10,16}\.[A-Za-z0-9_\-.]{8,480}$/;
const TT_ID_RE = /^[A-Za-z0-9_\-.:|]{8,500}$/;

/** http(s) URL without credentials or fragment, else null (the order's `ref` is client-supplied). */
export function cleanUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.username = "";
    u.password = "";
    u.hash = "";
    const s = u.toString();
    return s.length <= 500 ? s : null;
  } catch {
    return null;
  }
}

/** Country the order ships to: the page market, else the phone's country. */
function orderCountry(doc: PageDoc, phoneCountry: string): string | null {
  const cc = doc.market !== "INTL" ? doc.market : phoneCountry;
  return /^[A-Z]{2}$/.test(cc) ? cc : null;
}

/**
 * The Purchase event of a freshly stored order, or null when the page has no Meta/TikTok pixel or
 * the order looks automated.
 */
export function purchaseConversion(input: {
  orderId: string;
  createdAt: Date;
  payload: OrderPayload;
  order: Pick<ValidOrder, "totals" | "items" | "phone" | "email" | "name" | "city">;
  target: Pick<PageTarget, "doc" | "pageId" | "source">;
  riskScore: number;
  ip: string;
  ua: string | null;
}): PurchaseConversion | null {
  const { payload, order, target } = input;
  const { doc } = target;
  const pixels = { meta: pixelIdList("meta", doc.tracking.metaPixelId), tiktok: pixelIdList("tiktok", doc.tracking.tiktokPixelId) };
  if (!pixels.meta.length && !pixels.tiktok.length) return null;
  if (input.riskScore >= CONVERSION_MAX_RISK) return null;

  const ip = input.ip && isIP(input.ip) && input.ip !== "0.0.0.0" && input.ip !== "::" ? input.ip : null;
  const fbp = payload.fbp && FBP_RE.test(payload.fbp) ? payload.fbp : undefined;
  const fbc = payload.fbc && FBC_RE.test(payload.fbc) ? payload.fbc : undefined;
  const ttclid = payload.utm.ttclid && TT_ID_RE.test(payload.utm.ttclid) ? payload.utm.ttclid : undefined;
  const ttp = payload.ttp && TT_ID_RE.test(payload.ttp) ? payload.ttp : undefined;

  return {
    orderId: input.orderId,
    eventId: purchaseEventId(input.orderId),
    pageId: target.pageId,
    source: target.source,
    time: input.createdAt,
    value: round2(order.totals.total),
    currency: doc.currency,
    qty: order.items.qty,
    // same content id as the browser pixel (runtime config: product.sku || pageKey)
    contentId: doc.product.sku || payload.pageKey,
    contentName: doc.product.name.slice(0, 160),
    customer: {
      phone: order.phone.e164,
      email: order.email || null,
      name: order.name,
      city: order.city && order.city !== "Autre" ? order.city : null,
      country: orderCountry(doc, order.phone.country),
    },
    client: {
      ip,
      ua: input.ua,
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
      ...(ttclid ? { ttclid } : {}),
      ...(ttp ? { ttp } : {}),
    },
    sourceUrl: cleanUrl(payload.ref),
    pixels,
  };
}

/* ------------------------------------------------------------------ */
/* credentials                                                         */
/* ------------------------------------------------------------------ */

export interface ServerCredential {
  token: string;
  /** the platform's "Test events" code: events land in Test events only while it is set */
  testCode?: string;
  /** "pixel": the pixel's own token; "legacy": the single token stored before multi-pixel support */
  source: "pixel" | "legacy";
}

/** The token (and test code) server events for this pixel use, or null (browser only). */
export function serverCredentials(s: TrackingSecrets, platform: ServerPlatform, pixelId: string): ServerCredential | null {
  const own = (platform === "meta" ? s.metaTokens : s.tiktokTokens)?.[pixelId];
  const legacy = platform === "meta" ? s.metaCapiToken : s.tiktokToken;
  const token = own || legacy;
  if (!token) return null;
  const testCode = (platform === "meta" ? s.metaTestCodes : s.tiktokTestCodes)?.[pixelId] || (platform === "meta" ? s.metaTestEventCode : s.tiktokTestEventCode);
  return { token, ...(testCode ? { testCode } : {}), source: own ? "pixel" : "legacy" };
}

/* ------------------------------------------------------------------ */
/* normalization + hashing                                             */
/* ------------------------------------------------------------------ */

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/** Lowercase, letters only (Meta fn/ln: no punctuation, no spaces; UTF-8 kept for Arabic names). */
const lettersOnly = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");

/** Meta ct: lowercase, no accents, no spaces or punctuation ("Fès" → "fes", "Beni Mellal" → "benimellal"). */
const cityKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

const emailKey = (s: string | null) => {
  const e = s?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+$/.test(e) ? e : null;
};

export interface HashedCustomer {
  /** digits with country code, no "+" (Meta ph) */
  phoneDigits: string;
  /** E.164 with "+" (TikTok phone) */
  phoneE164: string;
  email: string | null;
  fn: string | null;
  ln: string | null;
  city: string | null;
  country: string | null;
}

export function hashCustomer(c: PurchaseConversion["customer"]): HashedCustomer {
  const digits = c.phone.replace(/[^0-9]/g, "");
  const [first = "", ...rest] = c.name.trim().split(/\s+/);
  const fn = lettersOnly(first);
  const ln = lettersOnly(rest.join(" "));
  const email = emailKey(c.email);
  const city = c.city ? cityKey(c.city) : "";
  return {
    phoneDigits: sha256(digits),
    phoneE164: sha256(`+${digits}`),
    email: email ? sha256(email) : null,
    fn: fn ? sha256(fn) : null,
    ln: ln ? sha256(ln) : null,
    city: city ? sha256(city) : null,
    country: c.country ? sha256(c.country.toLowerCase()) : null,
  };
}

/* ------------------------------------------------------------------ */
/* request bodies                                                      */
/* ------------------------------------------------------------------ */

const unitPrice = (c: PurchaseConversion) => round2(c.value / Math.max(1, c.qty));

/** Meta Conversions API body of a Purchase (access_token added at send time). */
export function metaPurchaseBody(c: PurchaseConversion, h: HashedCustomer, testCode?: string): Record<string, unknown> {
  const userData: Record<string, unknown> = {
    ph: [h.phoneDigits],
    ...(h.email ? { em: [h.email] } : {}),
    ...(h.fn ? { fn: [h.fn] } : {}),
    ...(h.ln ? { ln: [h.ln] } : {}),
    ...(h.city ? { ct: [h.city] } : {}),
    ...(h.country ? { country: [h.country] } : {}),
    ...(c.client.ip ? { client_ip_address: c.client.ip } : {}),
    ...(c.client.ua ? { client_user_agent: c.client.ua } : {}),
    ...(c.client.fbp ? { fbp: c.client.fbp } : {}),
    ...(c.client.fbc ? { fbc: c.client.fbc } : {}),
  };
  return {
    data: [
      {
        event_name: META_PURCHASE_EVENT,
        event_time: Math.floor(c.time.getTime() / 1000),
        event_id: c.eventId,
        action_source: "website",
        ...(c.sourceUrl ? { event_source_url: c.sourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency: c.currency,
          value: c.value,
          content_ids: [c.contentId],
          content_type: "product",
          content_name: c.contentName,
          contents: [{ id: c.contentId, quantity: c.qty, item_price: unitPrice(c) }],
          num_items: c.qty,
          order_id: c.orderId,
        },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
  };
}

/** TikTok Events API (v1.3 event/track) body of a Purchase. */
export function tiktokPurchaseBody(c: PurchaseConversion, h: HashedCustomer, pixelCode: string, testCode?: string): Record<string, unknown> {
  const user: Record<string, unknown> = {
    phone: h.phoneE164,
    ...(h.email ? { email: h.email } : {}),
    ...(c.client.ttclid ? { ttclid: c.client.ttclid } : {}),
    ...(c.client.ttp ? { ttp: c.client.ttp } : {}),
    ...(c.client.ip ? { ip: c.client.ip } : {}),
    ...(c.client.ua ? { user_agent: c.client.ua } : {}),
  };
  return {
    event_source: "web",
    event_source_id: pixelCode,
    ...(testCode ? { test_event_code: testCode } : {}),
    data: [
      {
        event: TIKTOK_PURCHASE_EVENT,
        event_time: Math.floor(c.time.getTime() / 1000),
        event_id: c.eventId,
        user,
        ...(c.sourceUrl ? { page: { url: c.sourceUrl } } : {}),
        properties: {
          contents: [{ content_id: c.contentId, content_type: "product", content_name: c.contentName, quantity: c.qty, price: unitPrice(c) }],
          content_type: "product",
          content_ids: [c.contentId],
          currency: c.currency,
          value: c.value,
          order_id: c.orderId,
        },
      },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* transport                                                           */
/* ------------------------------------------------------------------ */

interface HttpOutcome {
  ok: boolean;
  retry: boolean;
  /** HTTP status, null on network errors / timeouts */
  status: number | null;
  json: Record<string, unknown> | null;
  /** one-line description for logs (never request data) */
  detail: string;
}

/** Short, single-line text from an API answer. */
const tidy = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, 300);

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await res.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** POST JSON with a timeout; retries network errors, 429 and 5xx (`attempts` in total). Never throws. */
async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  accept: (status: number, json: Record<string, unknown> | null) => boolean,
  describe: (status: number, json: Record<string, unknown> | null) => string,
  attempts: number,
): Promise<HttpOutcome> {
  let last: HttpOutcome = { ok: false, retry: false, status: null, json: null, detail: "not sent" };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
        redirect: "error",
      });
      const json = await readJson(res);
      const ok = accept(res.status, json);
      last = { ok, retry: !ok && (res.status === 429 || res.status >= 500), status: res.status, json, detail: ok ? "" : describe(res.status, json) };
    } catch (err) {
      last = { ok: false, retry: true, status: null, json: null, detail: err instanceof Error ? `${err.name}: ${err.message}` : "network error" };
    }
    if (last.ok || !last.retry || attempt === attempts) return last;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return last;
}

const metaAccept = (status: number, json: Record<string, unknown> | null) =>
  status >= 200 && status < 300 && !!json && typeof json.events_received === "number" && json.events_received > 0;

const metaDescribe = (status: number, json: Record<string, unknown> | null) => {
  const error = (json?.error ?? null) as { message?: unknown; code?: unknown; error_subcode?: unknown } | null;
  return `HTTP ${status}${error ? ` code ${tidy(error.code)}${error.error_subcode ? `/${tidy(error.error_subcode)}` : ""}: ${tidy(error.message)}` : ""}`;
};

// the Business API answers HTTP 200 with a non-zero `code` on errors
const tiktokAccept = (status: number, json: Record<string, unknown> | null) => status >= 200 && status < 300 && !!json && json.code === 0;

const tiktokDescribe = (status: number, json: Record<string, unknown> | null) => `HTTP ${status}${json ? ` code ${tidy(json.code)}: ${tidy(json.message)}` : ""}`;

function sendMeta(body: Record<string, unknown>, pixelId: string, token: string, attempts: number): Promise<HttpOutcome> {
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`;
  // in the body, not the URL: tokens never end up in URL logs
  return post(url, {}, { ...body, access_token: token }, metaAccept, metaDescribe, attempts);
}

function sendTikTok(body: Record<string, unknown>, token: string, attempts: number): Promise<HttpOutcome> {
  return post(TIKTOK_EVENTS_URL, { "Access-Token": token }, body, tiktokAccept, tiktokDescribe, attempts);
}

/* ------------------------------------------------------------------ */
/* dispatch                                                            */
/* ------------------------------------------------------------------ */

export interface ConversionResult {
  platform: ServerPlatform;
  pixelId: string;
  ok: boolean;
  /** failure description (no request data, no token) */
  detail?: string;
  testMode: boolean;
}

/**
 * Send the order's Purchase to every page pixel that has server credentials (one request per pixel,
 * all in parallel, each with one retry). Never throws.
 */
export async function dispatchPurchase(c: PurchaseConversion, secrets: TrackingSecrets): Promise<ConversionResult[]> {
  const jobs: Promise<ConversionResult>[] = [];
  let hashed: HashedCustomer | null = null;
  const h = () => (hashed ??= hashCustomer(c.customer));
  for (const pixelId of c.pixels.meta) {
    const cred = serverCredentials(secrets, "meta", pixelId);
    if (!cred) continue;
    jobs.push(
      sendMeta(metaPurchaseBody(c, h(), cred.testCode), pixelId, cred.token, 2).then((o) => ({
        platform: "meta" as const,
        pixelId,
        ok: o.ok,
        testMode: !!cred.testCode,
        ...(o.ok ? {} : { detail: o.detail }),
      })),
    );
  }
  for (const pixelId of c.pixels.tiktok) {
    const cred = serverCredentials(secrets, "tiktok", pixelId);
    if (!cred) continue;
    jobs.push(
      sendTikTok(tiktokPurchaseBody(c, h(), pixelId, cred.testCode), cred.token, 2).then((o) => ({
        platform: "tiktok" as const,
        pixelId,
        ok: o.ok,
        testMode: !!cred.testCode,
        ...(o.ok ? {} : { detail: o.detail }),
      })),
    );
  }
  try {
    return await Promise.all(jobs);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Settings → Pixels: "Send test event"                                */
/* ------------------------------------------------------------------ */

export interface TestEventInput {
  platform: ServerPlatform;
  pixelId: string;
  token: string;
  testCode: string;
  /** the store's site URL (event_source_url / page.url) */
  siteUrl: string | null;
  currency: string;
  /** customer country (phone), e.g. "MA" */
  country: string;
}

export interface TestEventResult {
  ok: boolean;
  platform: ServerPlatform;
  pixelId: string;
  /** HTTP status of the platform's answer, null when it could not be reached */
  status: number | null;
  eventName: string;
  eventId: string;
  /** one sentence for the admin */
  message: string;
  /** short facts from the answer: events_received, fbtrace_id, request_id, error codes */
  facts: string[];
  /** the platform's JSON answer (pretty, truncated) */
  response: string | null;
}

/** A synthetic Purchase sent with the test event code (it lands in Test events only, never in reports). */
export async function sendTestEvent(input: TestEventInput): Promise<TestEventResult> {
  const orderId = `TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
  const c: PurchaseConversion = {
    orderId,
    eventId: purchaseEventId(orderId),
    pageId: "test",
    source: "live",
    time: new Date(),
    value: 1,
    currency: input.currency,
    qty: 1,
    contentId: "test-product",
    contentName: "Test product (COD Studio)",
    customer: { phone: input.country === "MA" ? "+212600000000" : "+33600000000", email: null, name: "Test Client", city: null, country: input.country },
    client: { ip: null, ua: "Mozilla/5.0 (compatible; COD-Studio-test-event/1.0)" },
    sourceUrl: cleanUrl(input.siteUrl),
    pixels: { meta: [], tiktok: [] },
  };
  const h = hashCustomer(c.customer);
  const name = PIXEL_NAMES[input.platform];
  const outcome =
    input.platform === "meta"
      ? await sendMeta(metaPurchaseBody(c, h, input.testCode), input.pixelId, input.token, 1)
      : await sendTikTok(tiktokPurchaseBody(c, h, input.pixelId, input.testCode), input.token, 1);
  const json = outcome.json;
  const facts: string[] = [];
  let message: string;
  if (outcome.status === null) {
    message = `Couldn't reach ${name}: ${tidy(outcome.detail)}`;
  } else if (input.platform === "meta") {
    const err = (json?.error ?? null) as { message?: unknown; code?: unknown; error_subcode?: unknown; fbtrace_id?: unknown; error_user_msg?: unknown } | null;
    if (typeof json?.events_received === "number") facts.push(`events_received: ${json.events_received}`);
    if (err?.code !== undefined) facts.push(`code ${tidy(err.code)}${err.error_subcode ? ` / ${tidy(err.error_subcode)}` : ""}`);
    const trace = json?.fbtrace_id ?? err?.fbtrace_id;
    if (trace) facts.push(`fbtrace_id: ${tidy(trace)}`);
    message = outcome.ok ? "Meta received the test event." : tidy(err?.error_user_msg || err?.message) || `Meta answered HTTP ${outcome.status}.`;
  } else {
    if (json && json.code !== undefined) facts.push(`code ${tidy(json.code)}${json.message ? ` · ${tidy(json.message)}` : ""}`);
    if (json?.request_id) facts.push(`request_id: ${tidy(json.request_id)}`);
    message = outcome.ok ? "TikTok received the test event." : tidy(json?.message) || `TikTok answered HTTP ${outcome.status}.`;
  }
  let response: string | null = null;
  if (json) {
    const pretty = JSON.stringify(json, null, 2);
    response = pretty.length > 1500 ? `${pretty.slice(0, 1500)}\n…` : pretty;
  }
  return {
    ok: outcome.ok,
    platform: input.platform,
    pixelId: input.pixelId,
    status: outcome.status,
    eventName: input.platform === "meta" ? META_PURCHASE_EVENT : TIKTOK_PURCHASE_EVENT,
    eventId: c.eventId,
    message,
    facts,
    response,
  };
}
