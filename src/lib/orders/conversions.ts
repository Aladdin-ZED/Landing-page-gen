import "server-only";
/**
 * Server-side Purchase events for new orders: Meta Conversions API and TikTok Events API.
 *
 *   createOrder() → purchaseConversion(...)  (only fresh, non-honeypot, plausible orders)
 *   route handler → sendConversionsAfterResponse(conversion)   (after the response, never blocks)
 *
 * Each event carries the order's browser `eventId`, the same id the thank-you page's pixel sends
 * (Meta eventID / TikTok event_id), with the same event name, so the platforms count the order once.
 * Customer data is normalized and SHA-256 hashed here; only the client IP, user agent and the
 * platforms' own click/browser ids (fbp, fbc, ttclid, ttp) travel in clear, as both APIs require.
 *
 * Credentials: Settings → Pixels tokens (tracking_secrets, AES-GCM at rest); pixel ids come from the
 * PUBLISHED page document, exactly like the browser pixel. A platform without a pixel id on the page
 * or without a token is skipped. Failures are logged (no PII, no token) and never touch the order.
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { round2 } from "@/lib/page/pricing";
import type { PageDoc } from "@/lib/page/schema";
import { getSetting, type SettingValue } from "@/lib/settings";
import type { OrderPayload } from "./contract";
import type { PageTarget } from "./resolve";
import type { ValidOrder } from "./validate";

/** Meta Graph API version for the Conversions API — the one place to bump it (v26.0: July 2026). */
export const META_GRAPH_API_VERSION = "v26.0";
export const META_PURCHASE_EVENT = "Purchase";

export const TIKTOK_EVENTS_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";
/**
 * Must equal the browser pixel's purchase event (src/landing/runtime/pixels.ts) for deduplication.
 * TikTok renamed CompletePayment to "Purchase" in May 2025 and still accepts the legacy name; switch
 * both sides together.
 */
export const TIKTOK_PURCHASE_EVENT = "CompletePayment";

/**
 * Orders scoring this high (scoreRisk: bot user agent, instant submit, repeated IP…) are kept out of
 * the ad platforms' optimisation. They are still stored and shown to the call center.
 */
export const CONVERSION_MAX_RISK = 70;

const REQUEST_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 1_200;
const LOG = "[conversions]";

export interface PurchaseConversion {
  orderId: string;
  /** browser pixel event id (deduplication key) */
  eventId: string;
  pageId: string;
  /** live page (slug fallback for the event URL) or connected export */
  source: "live" | "export";
  time: Date;
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
  pixels: { meta?: string; tiktok?: string };
}

/* ------------------------------------------------------------------ */
/* building the event (inside createOrder)                             */
/* ------------------------------------------------------------------ */

const FBP_RE = /^fb\.[0-9]\.[0-9]{10,16}\.[0-9]{1,30}$/;
const FBC_RE = /^fb\.[0-9]\.[0-9]{10,16}\.[A-Za-z0-9_\-.]{8,480}$/;
const TT_ID_RE = /^[A-Za-z0-9_\-.:|]{8,500}$/;

/** http(s) URL without credentials or fragment, else null (the order's `ref` is client-supplied). */
function cleanUrl(raw: string | undefined): string | null {
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
 * The Purchase event of a freshly stored order, or null when no pixel of the page could use it
 * (no Meta/TikTok pixel id) or the order looks automated.
 */
export function purchaseConversion(input: {
  orderId: string;
  createdAt: Date;
  payload: OrderPayload;
  order: ValidOrder;
  target: PageTarget;
  riskScore: number;
  ip: string;
  ua: string | null;
}): PurchaseConversion | null {
  const { payload, order, target } = input;
  const { doc } = target;
  const pixels = {
    ...(doc.tracking.metaPixelId ? { meta: doc.tracking.metaPixelId } : {}),
    ...(doc.tracking.tiktokPixelId ? { tiktok: doc.tracking.tiktokPixelId } : {}),
  };
  if (!pixels.meta && !pixels.tiktok) return null;
  if (input.riskScore >= CONVERSION_MAX_RISK) return null;

  const ip = input.ip && isIP(input.ip) && input.ip !== "0.0.0.0" && input.ip !== "::" ? input.ip : null;
  const fbp = payload.fbp && FBP_RE.test(payload.fbp) ? payload.fbp : undefined;
  const fbc = payload.fbc && FBC_RE.test(payload.fbc) ? payload.fbc : undefined;
  const ttclid = payload.utm.ttclid && TT_ID_RE.test(payload.utm.ttclid) ? payload.utm.ttclid : undefined;
  const ttp = payload.ttp && TT_ID_RE.test(payload.ttp) ? payload.ttp : undefined;

  return {
    orderId: input.orderId,
    eventId: payload.eventId,
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
/* normalization + hashing                                             */
/* ------------------------------------------------------------------ */

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

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

interface HashedCustomer {
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

function hashCustomer(c: PurchaseConversion["customer"]): HashedCustomer {
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
/* transport                                                           */
/* ------------------------------------------------------------------ */

type Outcome = { ok: true } | { ok: false; retry: boolean; detail: string };

/** POST JSON with a timeout and one retry on network errors, 429 and 5xx. Never throws. */
async function postWithRetry(url: string, headers: Record<string, string>, body: unknown, read: (res: Response) => Promise<Outcome>): Promise<Outcome> {
  let last: Outcome = { ok: false, retry: false, detail: "not sent" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
        redirect: "error",
      });
      last = await read(res);
    } catch (err) {
      last = { ok: false, retry: true, detail: err instanceof Error ? `${err.name}: ${err.message}` : "network error" };
    }
    if (last.ok || !last.retry || attempt === 2) return last;
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
  }
  return last;
}

/** Short, single-line text from an API error (never request data). */
const tidy = (s: unknown) =>
  String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, 200);

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await res.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Meta Conversions API                                                */
/* ------------------------------------------------------------------ */

async function sendMeta(c: PurchaseConversion, h: HashedCustomer, pixelId: string, token: string, testCode: string | undefined): Promise<Outcome> {
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
  const body = {
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
          num_items: c.qty,
          order_id: c.orderId,
        },
      },
    ],
    ...(testCode ? { test_event_code: testCode } : {}),
    // in the body, not the URL: tokens never end up in URL logs
    access_token: token,
  };
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`;
  return postWithRetry(url, {}, body, async (res) => {
    const json = await readJson(res);
    if (res.ok && json && typeof json.events_received === "number" && json.events_received > 0) return { ok: true };
    const error = (json?.error ?? null) as { message?: unknown; code?: unknown; error_subcode?: unknown } | null;
    return {
      ok: false,
      retry: res.status === 429 || res.status >= 500,
      detail: `HTTP ${res.status}${error ? ` code ${tidy(error.code)}${error.error_subcode ? `/${tidy(error.error_subcode)}` : ""}: ${tidy(error.message)}` : ""}`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* TikTok Events API                                                   */
/* ------------------------------------------------------------------ */

async function sendTikTok(c: PurchaseConversion, h: HashedCustomer, pixelCode: string, token: string, testCode: string | undefined): Promise<Outcome> {
  const user: Record<string, unknown> = {
    phone: h.phoneE164,
    ...(h.email ? { email: h.email } : {}),
    ...(c.client.ttclid ? { ttclid: c.client.ttclid } : {}),
    ...(c.client.ttp ? { ttp: c.client.ttp } : {}),
    ...(c.client.ip ? { ip: c.client.ip } : {}),
    ...(c.client.ua ? { user_agent: c.client.ua } : {}),
  };
  const body = {
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
          contents: [{ content_id: c.contentId, content_type: "product", content_name: c.contentName, quantity: c.qty }],
          content_type: "product",
          currency: c.currency,
          value: c.value,
          order_id: c.orderId,
        },
      },
    ],
  };
  return postWithRetry(TIKTOK_EVENTS_URL, { "Access-Token": token }, body, async (res) => {
    const json = await readJson(res);
    // the Business API answers HTTP 200 with a non-zero `code` on errors
    if (res.ok && json && json.code === 0) return { ok: true };
    return {
      ok: false,
      retry: res.status === 429 || res.status >= 500,
      detail: `HTTP ${res.status}${json ? ` code ${tidy(json.code)}: ${tidy(json.message)}` : ""}`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* dispatch                                                            */
/* ------------------------------------------------------------------ */

/** PUBLIC_URL origin (same rule as the renderer's publicOrigin()). */
function siteOrigin(): string | null {
  const raw = process.env.PUBLIC_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** The landing URL when the order did not report one (live pages only; exports live elsewhere). */
async function fallbackUrl(c: PurchaseConversion): Promise<string | null> {
  if (c.source !== "live") return null;
  const origin = siteOrigin();
  if (!origin) return null;
  const [row] = await db.select({ slug: pages.slug }).from(pages).where(eq(pages.id, c.pageId)).limit(1);
  return row ? `${origin}/${row.slug}` : null;
}

/**
 * Send the order's Purchase to every configured platform. Never throws. `secrets` defaults to
 * Settings → Pixels (pass them when already loaded, e.g. a test send from the admin).
 */
export async function sendPurchaseConversions(c: PurchaseConversion, opts: { secrets?: SettingValue<"tracking_secrets"> } = {}): Promise<void> {
  try {
    const secrets = opts.secrets ?? (await getSetting("tracking_secrets"));
    const meta = c.pixels.meta && secrets.metaCapiToken ? { pixel: c.pixels.meta, token: secrets.metaCapiToken } : null;
    const tiktok = c.pixels.tiktok && secrets.tiktokToken ? { pixel: c.pixels.tiktok, token: secrets.tiktokToken } : null;
    if (!meta && !tiktok) return;

    const event: PurchaseConversion = c.sourceUrl ? c : { ...c, sourceUrl: await fallbackUrl(c).catch(() => null) };
    const hashed = hashCustomer(event.customer);
    const report = (platform: string, outcome: Outcome) => {
      if (!outcome.ok) console.error(`${LOG} ${platform} purchase for order ${c.orderId} failed: ${outcome.detail}`);
    };
    await Promise.all([
      meta ? sendMeta(event, hashed, meta.pixel, meta.token, secrets.metaTestEventCode).then((o) => report("meta", o)) : null,
      tiktok ? sendTikTok(event, hashed, tiktok.pixel, tiktok.token, secrets.tiktokTestEventCode).then((o) => report("tiktok", o)) : null,
    ]);
  } catch (err) {
    console.error(`${LOG} order ${c.orderId}:`, err instanceof Error ? `${err.name}: ${err.message}` : "unknown error");
  }
}

/**
 * Queue the Purchase events to run once the response is sent (Next after()). Never throws and
 * never delays the shopper's confirmation.
 */
export function sendConversionsAfterResponse(c: PurchaseConversion | null | undefined): void {
  if (!c) return;
  try {
    after(() => sendPurchaseConversions(c));
  } catch (err) {
    console.error(`${LOG} could not schedule order ${c.orderId}:`, err instanceof Error ? err.message : "unknown error");
  }
}
