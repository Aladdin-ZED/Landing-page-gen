/**
 * LandingRuntimeConfig builder — the public JSON the runtime reads from #lp-config.
 * Isomorphic (server renderer, admin preview). Contains ONLY public values.
 */
import type { LandingRuntimeConfig } from "@/landing/runtime/config";
import { RUNTIME_EXTRA_KEYS, RUNTIME_UI_KEYS } from "@/landing/runtime/strings";
import { CAPTCHA_STRING } from "@/landing/runtime/turnstile";
import type { RenderContext, RenderMode } from "@/landing/types";
import { moneyFormat, phoneSpec } from "@/lib/markets/info";
import { bundleMath, defaultBundleId } from "@/lib/page/pricing";
import type { Locale, PageDoc } from "@/lib/page/schema";

/** The page money format (shared with ctx.money — see moneyFormat() in @/lib/markets/info). */
export { moneyFormat };

export interface RuntimeEndpoints {
  order: string;
  lead?: string;
  event?: string;
  upsell?: string;
}

export interface RuntimeConfigOptions {
  page: "landing" | "thanks";
  /** runtime behavior: "preview" never sends orders/events nor loads pixels */
  mode: RenderMode;
  pageKey: string;
  endpoints: RuntimeEndpoints;
  thankYouUrl: string;
  landingUrl: string;
  /** store-level WhatsApp number used when the form has none (default: ctx.store.whatsapp) */
  storeWhatsapp?: string;
  /** Cloudflare Turnstile site key — only when the runtime renders the widget for this page */
  turnstileSiteKey?: string;
}

/** "x2 · Pack Duo" (or just "x2"). */
export function bundleLabel(ctx: Pick<RenderContext, "t">, b: { qty: number; title?: string }): string {
  const x = ctx.t("bundle.x", { n: b.qty });
  const title = b.title?.trim();
  return title ? `${x} · ${title}` : x;
}

/* ------------------------------------------------------------------ */
/* WhatsApp                                                            */
/* ------------------------------------------------------------------ */

/**
 * International digits for wa.me ("212612345678") from what admins type: "+212 6 12…", "00212…",
 * "212…" or a national number with its trunk zero ("06 12 34 56 78", completed with the country's
 * calling code). Null when it cannot be a WhatsApp number.
 */
export function whatsappDigits(raw: string | undefined | null, country = "MA"): string | null {
  if (!raw) return null;
  let s = raw.replace(/[\s().\- ‎‏]/g, "");
  if (!/^\+?[0-9]{6,17}$/.test(s)) return null;
  const spec = phoneSpec(country);
  const prefix = spec.prefix.replace(/^\+/, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (s.startsWith("0")) {
    if (!prefix) return null;
    s = prefix + s.slice(1);
  }
  // "+212 (0)6 12…" → "2126…": the trunk zero kept after the calling code, for countries whose
  // national numbers start with one (national pattern "^0…"; Italy's leading 0 is part of the number)
  if (prefix && spec.national.startsWith("^0") && s.startsWith(`${prefix}0`)) s = prefix + s.slice(prefix.length + 1);
  return /^[1-9][0-9]{7,14}$/.test(s) ? s : null;
}

/** Digits-only WhatsApp number (wa.me format): the form's own number when enabled, else the store's. */
export function whatsappNumber(doc: PageDoc, storeWhatsapp?: string): string | null {
  const fromForm = doc.form.whatsapp?.enabled ? whatsappDigits(doc.form.whatsapp.number, doc.form.phoneCountry) : null;
  return fromForm ?? whatsappDigits(storeWhatsapp, doc.form.phoneCountry);
}

/** Cloudflare Turnstile site keys ("0x4AAAA…", test keys "1x00000000000000000000AA"). */
export const TURNSTILE_SITE_KEY = /^[A-Za-z0-9_-]{10,100}$/;

/** The site key a document embeds: product pages that send orders, with a well-formed key — else null. */
export function turnstileKeyFor(page: "landing" | "thanks", mode: RenderMode, siteKey: string | undefined): string | null {
  return page === "landing" && mode !== "preview" && siteKey && TURNSTILE_SITE_KEY.test(siteKey) ? siteKey : null;
}

/** Shown when Cloudflare asks the shopper to complete the Turnstile check (runtime key CAPTCHA_STRING). */
const CAPTCHA_MESSAGE: Record<Locale, string> = {
  ar: "المرجو إكمال التحقق أعلاه، ثم تأكيد الطلب من جديد.",
  fr: "Merci de compléter la vérification ci-dessus, puis de confirmer à nouveau.",
  en: "Please complete the verification above, then confirm again.",
  es: "Completa la verificación de arriba y vuelve a confirmar.",
  de: "Bitte schließe die Überprüfung oben ab und bestätige erneut.",
  it: "Completa la verifica qui sopra, poi conferma di nuovo.",
  nl: "Voltooi de verificatie hierboven en bevestig opnieuw.",
  pt: "Conclua a verificação acima e confirme novamente.",
};

export function buildRuntimeConfig(doc: PageDoc, ctx: RenderContext, opts: RuntimeConfigOptions): LandingRuntimeConfig {
  const { product, offers, form } = doc;
  const phone = phoneSpec(form.phoneCountry);
  const strings: Record<string, string> = {};
  for (const key of [...RUNTIME_UI_KEYS, ...RUNTIME_EXTRA_KEYS]) strings[key] = ctx.t(key);

  const wa = whatsappNumber(doc, opts.storeWhatsapp ?? ctx.store.whatsapp);
  const preview = opts.mode === "preview";
  // the widget only exists on product pages that can send orders (never in previews)
  const turnstile = turnstileKeyFor(opts.page, opts.mode, opts.turnstileSiteKey);
  if (turnstile) strings[CAPTCHA_STRING] = CAPTCHA_MESSAGE[doc.locale];
  const pixels: LandingRuntimeConfig["pixels"] = preview
    ? {}
    : {
        ...(doc.tracking.metaPixelId ? { meta: doc.tracking.metaPixelId } : {}),
        ...(doc.tracking.tiktokPixelId ? { tiktok: doc.tracking.tiktokPixelId } : {}),
        ...(doc.tracking.snapPixelId ? { snap: doc.tracking.snapPixelId } : {}),
        ...(doc.tracking.ga4Id ? { ga4: doc.tracking.ga4Id } : {}),
      };

  return {
    v: 1,
    page: opts.page,
    pageKey: opts.pageKey,
    mode: opts.mode,
    locale: doc.locale,
    dir: ctx.dir,
    currency: doc.currency,
    endpoints: {
      order: opts.endpoints.order,
      ...(opts.endpoints.lead ? { lead: opts.endpoints.lead } : {}),
      ...(opts.endpoints.event ? { event: opts.endpoints.event } : {}),
      ...(opts.endpoints.upsell ? { upsell: opts.endpoints.upsell } : {}),
    },
    thankYouUrl: opts.thankYouUrl,
    landingUrl: opts.landingUrl,
    product: {
      name: product.name,
      price: product.price,
      ...(product.sku ? { sku: product.sku } : {}),
      contentId: product.sku || opts.pageKey,
    },
    bundles: offers.bundles.map((b) => {
      const m = bundleMath(b, product.price);
      return {
        id: b.id,
        qty: b.qty,
        total: m.total,
        reference: m.reference,
        perUnit: m.perUnit,
        savings: m.savings,
        savingsPct: m.savingsPct,
        label: bundleLabel(ctx, b),
      };
    }),
    defaultBundleId: defaultBundleId(offers),
    variants: product.variants.map((g) => ({
      id: g.id,
      name: g.name,
      perUnit: g.perUnit,
      options: g.options.map((o) => ({ id: o.id, label: o.label, soldOut: o.soldOut })),
    })),
    ...(offers.orderBump?.enabled ? { bump: { price: offers.orderBump.price, title: offers.orderBump.title } } : {}),
    ...(offers.upsell?.enabled
      ? { upsell: { price: offers.upsell.price, title: offers.upsell.title, windowMinutes: offers.upsell.windowMinutes } }
      : {}),
    shippingFee: offers.shippingFee,
    phone: { country: phone.country || form.phoneCountry, prefix: phone.prefix, national: phone.national },
    fields: { city: form.city, address: form.address, email: form.email },
    money: moneyFormat(doc.currency, doc.locale),
    pixels,
    strings,
    ...(wa ? { whatsapp: { number: wa, text: `${ctx.t("form.whatsapp")}: ${product.name}` } } : {}),
    ...(turnstile ? { turnstileSiteKey: turnstile } : {}),
  };
}

const BACKSLASH = String.fromCharCode(92);
/** Characters that could end a <script> element or break JS-string embedding: < > & LS PS */
const UNSAFE_JSON = new RegExp(`[<>&${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

/** JSON for an inline data <script>: `<`, `>`, `&` and line separators escaped so it can never close the element. */
export function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(UNSAFE_JSON, (c) => `${BACKSLASH}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
