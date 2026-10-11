/**
 * Public order API contract — shared by the landing runtime (client), the Next.js route handlers,
 * and mirrored by the exported standalone order.php.
 */
import { z } from "zod";

const S = (max: number) => z.string().trim().max(max);

export const Utm = z
  .object({
    source: S(120),
    medium: S(120),
    campaign: S(200),
    content: S(200),
    term: S(200),
    fbclid: S(500),
    ttclid: S(500),
    sccid: S(500),
    gclid: S(500),
  })
  .partial();

export const OrderPayload = z.object({
  /** live pages: page public key; exports: export key */
  pageKey: z.string().regex(/^[a-zA-Z0-9_-]{8,80}$/),
  /** idempotency key generated when the form is first touched (uuid v4) */
  idem: z.string().regex(/^[a-f0-9-]{36}$/),
  /** shared with pixels for dedup (browser Purchase ↔ server events) */
  eventId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  bundleId: z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/),
  /** per unit: { groupId: optionId } */
  variants: z.array(z.record(z.string().max(40), z.string().max(40))).max(20).default([]),
  bump: z.boolean().default(false),
  name: S(80).pipe(z.string().min(2)),
  phone: S(24).pipe(z.string().min(6)),
  city: S(80).optional(),
  address: S(240).optional(),
  note: S(300).optional(),
  email: z.string().trim().email().max(120).optional().or(z.literal("")),
  /** honeypot — must be empty */
  website: z.string().max(0).optional().or(z.literal("")),
  /** ms between first interaction and submit (bots submit instantly) */
  t: z.number().int().min(0).max(86_400_000),
  utm: Utm.default({}),
  fbp: S(200).optional(),
  fbc: S(500).optional(),
  ttp: S(200).optional(),
  /** page URL the order came from (for exports: their domain) */
  ref: S(500).optional(),
  locale: z.string().max(5).optional(),
  /** Cloudflare Turnstile token (required only when the page embeds a site key) */
  cf: z.string().max(2048).optional(),
});
export type OrderPayload = z.infer<typeof OrderPayload>;

export type OrderResponse =
  | {
      ok: true;
      orderId: string;
      /** signed token allowing the thank-you page to add the upsell to this order once */
      upsellToken?: string;
      total: number;
      currency: string;
    }
  | {
      ok: false;
      error: "invalid" | "duplicate" | "rate_limited" | "blocked" | "unavailable" | "server";
      fields?: Partial<Record<"name" | "phone" | "city" | "address" | "email" | "bundleId", string>>;
    };

/** Abandoned-lead capture (sent once the phone becomes valid, debounced). */
export const LeadPayload = z.object({
  pageKey: OrderPayload.shape.pageKey,
  idem: OrderPayload.shape.idem,
  phone: S(24),
  name: S(80).optional(),
  city: S(80).optional(),
  bundleId: OrderPayload.shape.bundleId.optional(),
  utm: Utm.default({}),
});

export const UpsellPayload = z.object({
  orderId: z.string().regex(/^[A-Z0-9-]{6,32}$/),
  token: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
});

export type UpsellResponse =
  | { ok: true; orderId: string; total: number; currency: string }
  | { ok: false; error: "invalid" | "expired" | "rate_limited" | "server" };

/** Lightweight analytics beacon (navigator.sendBeacon, text/plain JSON). */
export const EventPayload = z.object({
  pageKey: OrderPayload.shape.pageKey,
  type: z.enum(["view", "form_start", "bundle_change", "cta_click"]),
  /** anonymous visitor id stored in localStorage (random, no PII) */
  vid: z.string().regex(/^[a-zA-Z0-9_-]{8,40}$/),
  bundleId: z.string().max(40).optional(),
  utm: Utm.default({}),
});

/** Sheet / admin order statuses (French labels are what call-center agents see in Google Sheets). */
export const ORDER_STATUSES = [
  { id: "new", fr: "Nouvelle", color: "#E8F0FE" },
  { id: "confirmed", fr: "Confirmée", color: "#E6F4EA" },
  { id: "no_answer", fr: "Injoignable", color: "#FEF7E0" },
  { id: "callback", fr: "Reportée", color: "#F3E8FD" },
  { id: "shipped", fr: "Expédiée", color: "#E0F2F1" },
  { id: "delivered", fr: "Livrée", color: "#CEEAD6" },
  { id: "returned", fr: "Retournée", color: "#FCE8E6" },
  { id: "cancelled", fr: "Annulée", color: "#F1F3F4" },
  { id: "fake", fr: "Fausse commande", color: "#F6D6D3" },
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number]["id"];
