/**
 * WhatsApp link helpers shared by the order form (alternative ordering link) and the floating
 * button. The number comes from the page's form setting, else the store profile, normalized exactly
 * like the runtime config does (whatsappDigits: "+212 6…", "00212…", "06…" → "2126…"), so nothing
 * but 8–15 digits can ever reach the URL; the prefilled text is URI-encoded.
 */
import type { Locale } from "@/lib/page/schema";
import { whatsappDigits } from "@/lib/render/config";
import type { RenderContext } from "../../types";

/**
 * wa.me digits, or null when the page has none: the form's number when WhatsApp ordering is on,
 * else the store's, else a number typed in the form setting but left switched off.
 */
export function whatsappNumber(ctx: Pick<RenderContext, "doc" | "store">): string | null {
  const wa = ctx.doc.form.whatsapp;
  const country = ctx.doc.form.phoneCountry;
  return (
    (wa?.enabled ? whatsappDigits(wa.number, country) : null) ??
    whatsappDigits(ctx.store.whatsapp, country) ??
    whatsappDigits(wa?.number, country)
  );
}

/**
 * Strict URI component: encodeURIComponent leaves ' ( ) * ! as they are, and the kit's safeHref()
 * refuses quotes — "j'ai une question" must reach any link primitive as "j%27ai".
 */
const encodeStrict = (s: string): string =>
  encodeURIComponent(s).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** https://wa.me/<digits>?text=<encoded> — the text is clipped to a sane length. */
export function whatsappHref(number: string, text?: string): string {
  // clipped by code point: a cut through a surrogate pair (emoji) would make encodeURIComponent throw
  const t = Array.from((text ?? "").replace(/\s+/g, " ").trim()).slice(0, 300).join("");
  return `https://wa.me/${number}${t ? `?text=${encodeStrict(t)}` : ""}`;
}

type Phrase = Partial<Record<Locale, string>> & { en: string };

/** Locale entry with an English fallback (the kit's microcopy is complete in ar/fr/en). */
export const inLocale = (locale: Locale, p: Phrase): string => p[locale] ?? p.en;

/** Prefilled message for an order placed over WhatsApp. */
export function orderMessage(locale: Locale, productName: string): string {
  return inLocale(locale, {
    ar: `السلام عليكم، بغيت نطلب: ${productName}`,
    fr: `Bonjour, je souhaite commander : ${productName}`,
    en: `Hello, I'd like to order: ${productName}`,
  });
}

/** Prefilled message for a question. */
export function questionMessage(locale: Locale, productName: string): string {
  return inLocale(locale, {
    ar: `السلام عليكم، عندي سؤال على ${productName}`,
    fr: `Bonjour, j'ai une question sur : ${productName}`,
    en: `Hello, I have a question about: ${productName}`,
  });
}
