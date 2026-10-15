/**
 * Ad pixels — platforms, id formats, per-platform limits and the event names of the funnel.
 * Dependency-free (no zod, no DOM, no Node): shared by the page schema, the admin forms, the server
 * conversions (src/lib/orders/conversions-core.ts) and the landing runtime bundle
 * (src/landing/runtime/pixels.ts), so the browser and the server always agree on ids and names.
 */

export const PIXEL_PLATFORMS = ["meta", "tiktok", "snap", "ga4"] as const;
export type PixelPlatform = (typeof PIXEL_PLATFORMS)[number];

/** Platforms that also receive server-side events (Meta Conversions API, TikTok Events API). */
export const SERVER_PLATFORMS = ["meta", "tiktok"] as const;
export type ServerPlatform = (typeof SERVER_PLATFORMS)[number];
export const isServerPlatform = (p: PixelPlatform): p is ServerPlatform => p === "meta" || p === "tiktok";

/** Key of each platform's id list in PageDoc.tracking and in the store "pixels" setting. */
export const TRACKING_KEYS = {
  meta: "metaPixelId",
  tiktok: "tiktokPixelId",
  snap: "snapPixelId",
  ga4: "ga4Id",
} as const satisfies Record<PixelPlatform, string>;
export type TrackingKey = (typeof TRACKING_KEYS)[PixelPlatform];

/** Id formats (unchanged since single-id pages: stored documents stay valid). */
export const PIXEL_ID_RE: Record<PixelPlatform, RegExp> = {
  meta: /^[0-9]{6,20}$/,
  tiktok: /^[A-Z0-9]{8,30}$/,
  snap: /^[a-f0-9-]{20,40}$/,
  ga4: /^G-[A-Z0-9]{4,16}$/,
};

/**
 * Ids per platform on one page. COD sellers often run backup ad accounts, so Meta and TikTok take up
 * to 3 pixels (one browser event reaches all of them; the server sends one event per pixel). Snap's
 * SDK documents a single pixel per page; one GA4 property is enough for analytics.
 */
export const PIXEL_LIMIT: Record<PixelPlatform, number> = { meta: 3, tiktok: 3, snap: 1, ga4: 1 };

export const PIXEL_NAMES: Record<PixelPlatform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snap: "Snapchat",
  ga4: "Google Analytics 4",
};

/** Whitespace, bidi / zero-width marks people paste along with ids. */
const NOISE = /[\s​-‏‪-‮⁠⁦-⁩﻿]/g;

/** What an admin typed → the canonical id form (case, no spaces). Not validated. */
export function normalizePixelId(platform: PixelPlatform, raw: string): string {
  const s = String(raw ?? "").replace(NOISE, "");
  if (platform === "snap") return s.toLowerCase();
  if (platform === "ga4" || platform === "tiktok") return s.toUpperCase();
  return s;
}

/**
 * Valid ids of a platform from a stored value: a list, or a single id string (documents saved
 * before multi-pixel support). Invalid entries are dropped, duplicates removed, capped at the limit.
 */
export function pixelIdList(platform: PixelPlatform, value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const re = PIXEL_ID_RE[platform];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && re.test(v) && out.indexOf(v) < 0) out.push(v);
    if (out.length >= PIXEL_LIMIT[platform]) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Funnel events                                                       */
/* ------------------------------------------------------------------ */

/**
 *  view      landing page loaded (default pack)
 *  cart      first pack choice or first form interaction
 *  checkout  first form interaction (the COD form is the checkout)
 *  lead      phone number captured (lead capture on)
 *  purchase  order confirmed (thank-you page + server), event id = order id
 */
export const PIXEL_STEPS = ["view", "cart", "checkout", "lead", "purchase"] as const;
export type PixelStep = (typeof PIXEL_STEPS)[number];

/**
 * Standard event names per platform. TikTok: current standard events (ads.tiktok.com help
 * "Supported standard events", 2026) — "Purchase" replaced "CompletePayment" (TikTok still maps the
 * legacy name) and "Place an Order" is no longer documented; "SubmitForm" is the lead event.
 * The server sends the SAME purchase names (deduplication needs equal name + event id).
 */
export const PIXEL_EVENTS: Record<PixelPlatform, Record<PixelStep, string>> = {
  meta: { view: "ViewContent", cart: "AddToCart", checkout: "InitiateCheckout", lead: "Lead", purchase: "Purchase" },
  tiktok: { view: "ViewContent", cart: "AddToCart", checkout: "InitiateCheckout", lead: "SubmitForm", purchase: "Purchase" },
  snap: { view: "VIEW_CONTENT", cart: "ADD_CART", checkout: "START_CHECKOUT", lead: "SIGN_UP", purchase: "PURCHASE" },
  ga4: { view: "view_item", cart: "add_to_cart", checkout: "begin_checkout", lead: "generate_lead", purchase: "purchase" },
};

/** Browser ↔ server deduplication key of an order's Purchase events on every platform. */
export const purchaseEventId = (orderId: string): string => orderId;
