/**
 * Runtime configuration embedded in every rendered landing document as
 * <script type="application/json" id="lp-config">…</script> (JSON, never executable).
 * Built by the renderer (src/landing/document.tsx) and read by the vanilla runtime.
 * Contains ONLY public values.
 */
import type { RenderMode } from "../types";

export interface RuntimeBundle {
  id: string;
  qty: number;
  total: number;
  reference: number;
  perUnit: number;
  savings: number;
  savingsPct: number;
  label: string; // "x2 · Pack Duo"
}

export interface RuntimeVariantGroup {
  id: string;
  name: string;
  perUnit: boolean;
  options: { id: string; label: string; soldOut: boolean }[];
}

export interface LandingRuntimeConfig {
  v: 1;
  /** "landing" for the product page, "thanks" for the thank-you page */
  page: "landing" | "thanks";
  pageKey: string;
  mode: RenderMode;
  locale: string;
  dir: "rtl" | "ltr";
  currency: string;
  endpoints: {
    order: string;
    lead?: string;
    event?: string;
    upsell?: string;
  };
  /** URL of thank-you page; runtime appends ?o=<orderId> */
  thankYouUrl: string;
  /** URL of the landing page (thank-you "back" link) */
  landingUrl: string;
  product: { name: string; price: number; sku?: string; contentId: string };
  bundles: RuntimeBundle[];
  defaultBundleId: string;
  variants: RuntimeVariantGroup[];
  bump?: { price: number; title: string };
  upsell?: { price: number; title: string; windowMinutes: number };
  shippingFee: number;
  phone: {
    country: string; // "MA"
    prefix: string; // "+212"
    /** RegExp source validating a NORMALIZED national number (digits only, leading 0 kept) */
    national: string;
  };
  /** fields the form asks for, and whether required */
  fields: { city: "select" | "text" | "hidden"; address: "required" | "optional" | "hidden"; email: "required" | "optional" | "hidden" };
  money: { locale: string; symbol: string; position: "before" | "after"; decimals: number };
  pixels: { meta?: string; tiktok?: string; snap?: string; ga4?: string };
  strings: Record<string, string>;
  whatsapp?: { number: string; text: string };
  /** optional anti-bot (Cloudflare Turnstile) site key */
  turnstileSiteKey?: string;
}
