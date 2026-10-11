/**
 * Prompts for the local vision-language model (Qwen3.5, non-thinking mode, JSON-constrained).
 * Output shape is enforced by the JSON schema; these prompts carry the art of it: voice, honesty
 * rules and a short style sample of great Moroccan COD copy per language.
 */
import { z } from "zod";
import { MARKETS, PRODUCT_CATEGORIES, type Locale } from "@/lib/page/schema";
import { AnalysisSchema, type Analysis } from "./copy-schema";

/** Languages the model writes (one constrained call each). */
export const COPY_LOCALES = ["ar", "fr", "en"] as const;
export type CopyLocale = (typeof COPY_LOCALES)[number];
export const isCopyLocale = (l: Locale): l is CopyLocale => (COPY_LOCALES as readonly string[]).includes(l);

/** Input of writeCopy — validated, because it crosses a worker boundary and may come from storage. */
export const CopyRequest = z.object({
  locale: z.enum(COPY_LOCALES),
  market: z.enum(MARKETS).default("MA"),
  product: z.object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(PRODUCT_CATEGORIES),
    price: z.number().nonnegative().max(10_000_000),
    currency: z.string().regex(/^[A-Z]{3}$/).default("MAD"),
    facts: z.array(z.string().trim().min(1).max(200)).max(6).default([]),
  }),
  analysis: AnalysisSchema.nullish(),
  /** store delivery promise (Settings → Defaults), e.g. "Livraison 24–48h partout au Maroc" */
  deliveryText: z.string().max(140).nullish(),
});
export type CopyRequest = z.infer<typeof CopyRequest>;

export const ANALYZE_PROMPT = [
  "You are the art director of a premium e-commerce studio. Look at the product photo(s).",
  "Return JSON describing the product as seen:",
  "- category: the closest product category;",
  "- vibe and secondary_vibe: the visual mood the landing page should have (secondary_vibe may be \"none\");",
  "- materials: visible materials only (glass, steel, cotton, wood…), max 4;",
  "- colors: the product's main colors in plain words, max 4;",
  "- audience: who it is for, in a few words;",
  "- summary: one factual sentence describing what the product is. No marketing claims.",
  "Write the JSON values in English.",
].join("\n");

const LANG_RULES: Record<CopyLocale, string> = {
  ar: [
    "Write ONLY in Arabic: clear, simple Modern Standard Arabic for Moroccan shoppers.",
    "A light, natural Darija touch is welcome in buttons (e.g. \"اطلب دابا\"). Never write Latin letters except the product name.",
    "Say الدفع عند الاستلام for cash on delivery and درهم for the currency.",
  ].join(" "),
  fr: "Écris UNIQUEMENT en français, naturel et chaleureux, pour des clients au Maroc. Vouvoiement. « Paiement à la livraison » pour le COD.",
  en: "Write ONLY in clear, warm, natural English.",
};

/** Short style samples (different products) — tone and rhythm, not content to copy. */
const STYLE_SAMPLE: Record<CopyLocale, string> = {
  ar: [
    "headline: \"بشرة *مرتوية* تلاحظينها وتحسّين بها.\"",
    "sub: \"قوام خفيف يتغلغل بسرعة بدون لمعة دهنية. خطوة بسيطة صباحاً ومساءً.\"",
    "benefit: {\"title\": \"تسريح سهل\", \"text\": \"المشط ينزلق والعُقد تنحلّ بدون شدّ ولا تقصّف.\"}",
    "faq: {\"q\": \"هل يمكنني معاينة الطرد قبل الدفع؟\", \"a\": \"نعم. تفتح الطرد أمام الموزّع، تعاين المنتج، ثم تدفع.\"}",
    "cta: \"اطلب دابا\"",
  ].join("\n"),
  fr: [
    "headline: \"Moins de frisottis, plus de *brillance*.\"",
    "sub: \"Une texture qui pénètre vite, sans film gras. Un geste simple, matin et soir.\"",
    "benefit: {\"title\": \"Un démêlage facile\", \"text\": \"Le peigne glisse, les nœuds se défont sans tirer ni casser.\"}",
    "faq: {\"q\": \"Puis-je vérifier le colis avant de payer ?\", \"a\": \"Oui. Vous ouvrez le colis devant le livreur, vous vérifiez le produit, puis vous payez.\"}",
    "cta: \"Je commande maintenant\"",
  ].join("\n"),
  en: [
    "headline: \"Less frizz, more *shine*.\"",
    "sub: \"A texture that sinks in fast, with no greasy film. One simple step, morning and night.\"",
    "benefit: {\"title\": \"Easy detangling\", \"text\": \"The comb glides through and knots come loose without pulling.\"}",
    "faq: {\"q\": \"Can I check the parcel before paying?\", \"a\": \"Yes. You open it in front of the courier, check the product, then pay.\"}",
    "cta: \"Order now\"",
  ].join("\n"),
};

const describeAnalysis = (a: Analysis | null | undefined) =>
  a
    ? `Photo analysis: ${a.summary} Mood: ${a.vibe}${a.secondaryVibe ? ` / ${a.secondaryVibe}` : ""}. Materials: ${a.materials.join(", ") || "n/a"}. Colors: ${a.colorsDescribed.join(", ") || "n/a"}. Audience: ${a.audience || "n/a"}.`
    : "No photo analysis available.";

export function copyPrompt(req: CopyRequest): string {
  const p = req.product;
  const facts = p.facts.length ? p.facts.map((f) => `- ${f}`).join("\n") : "- (none given)";
  const delivery = req.deliveryText?.trim() || (req.market === "MA" ? "Fast delivery all over Morocco" : "Fast home delivery");
  return [
    "You are a senior direct-response copywriter for cash-on-delivery (COD) landing pages in Morocco.",
    "Write the complete copy of ONE landing page as JSON.",
    "",
    `PRODUCT: ${p.name}`,
    `CATEGORY: ${p.category}`,
    `PRICE: ${p.price} ${p.currency}`,
    "FACTS FROM THE MERCHANT (the only facts you may state):",
    facts,
    describeAnalysis(req.analysis),
    "",
    "STORE POLICIES (true, use them in FAQ, guarantee and announcement):",
    "- Payment: cash on delivery. Nothing is paid online.",
    "- The customer opens and checks the parcel in front of the courier before paying.",
    `- Delivery: ${delivery}.`,
    "- The team calls to confirm the order; questions and exchanges are handled on WhatsApp.",
    "",
    "RULES:",
    "- Concrete, sensory, specific. Short sentences. Talk about the customer's daily life.",
    "- NEVER invent numbers, percentages, ratings, durations, awards, certifications or customer counts. Use a number only if it appears in the facts above.",
    "- NO medical or health claims (no curing, treating, healing, weight loss). No promises of results.",
    "- No hype words (revolutionary, miracle, magic, ultimate, game-changer, unlock, elevate, seamless). No emojis. No exclamation marks.",
    "- headline: one promise under 9 words; wrap exactly ONE key word in *asterisks* for emphasis.",
    "- benefits: concrete outcomes derived from the facts and the photo; each with a fitting icon.",
    "- faq: exactly these 5 questions in this order: how payment works (COD), delivery, checking the parcel before paying, how to use the product, exchange/after-sales via WhatsApp.",
    "- comparison: our offer vs. typical alternatives (rows like texture/quality, ease of use, payment, checking before paying).",
    "- marquee: very short words or phrases (1–3 words each).",
    LANG_RULES[req.locale],
    "",
    "STYLE SAMPLE (tone only — another product, do not copy):",
    STYLE_SAMPLE[req.locale],
    "",
    "Return ONLY the JSON object.",
  ].join("\n");
}
