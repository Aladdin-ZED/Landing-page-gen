/**
 * Footer copy: default lines (ar · fr · en, picked with the generator's rng) and the small fixed
 * labels of the footer chrome. Other page languages fall back to English.
 */
import type { Locale } from "@/lib/page/schema";

export type Lang = "ar" | "fr" | "en";
export const lang = (l: Locale): Lang => (l === "ar" || l === "fr" ? l : "en");

/** `{name}` = the product name (only used when it is short enough to read as one breath). */
export const TAGLINES: Record<Lang, readonly string[]> = {
  fr: [
    "{name}, livré à votre porte. Vous ne payez qu'à la réception.",
    "Vous choisissez, on s'occupe du reste jusqu'à votre porte.",
    "Commandé en 30 secondes, payé à la livraison.",
  ],
  ar: [
    "{name}، كيوصلك حتى لباب الدار، وما كتخلص حتى تستلم.",
    "نتا اختار، وحنا نتكلفو بالباقي حتى لباب الدار.",
    "طلب في 30 ثانية، والدفع عند الاستلام.",
  ],
  en: [
    "{name}, delivered to your door. You only pay when it arrives.",
    "You choose, we handle the rest, right to your door.",
    "Ordered in 30 seconds, paid on delivery.",
  ],
};

/**
 * Closing statement of the big footer (h2), channel-neutral: it sits above WhatsApp / call / e-mail.
 * French lines keep a no-break space before "?" so the mark never starts a line on its own.
 */
export const HEADINGS: Record<Lang, readonly string[]> = {
  fr: [
    "Une question avant de commander\u00a0? *On vous répond.*",
    "Un doute sur la livraison ou le paiement\u00a0? *Parlons-en.*",
    "Besoin d'un conseil avant de choisir\u00a0? *On est là.*",
  ],
  ar: [
    "عندك سؤال قبل ما تطلب؟ *غادي نجاوبوك.*",
    "عندك شك فالتوصيل ولا الخلاص؟ *نتفاهمو.*",
    "محتاج نصيحة قبل ما تختار؟ *حنا هنا.*",
  ],
  en: [
    "A question before you order? *We'll answer.*",
    "Unsure about delivery or payment? *Let's talk.*",
    "Need advice before you choose? *We're here.*",
  ],
};

/** The COD reassurance line (true for every COD order: pay at the door, look before paying). */
export const COD_LINES: Record<Lang, readonly string[]> = {
  fr: [
    "Paiement à la livraison · Vérifiez votre colis avant de payer",
    "Vous ne payez qu'à la réception, après avoir vu votre colis",
    "Paiement en espèces à la livraison, à votre porte",
  ],
  ar: [
    "الدفع عند الاستلام · عاين الطلبية قبل ما تخلص",
    "ما كتخلص حتى توصلك الطلبية وتشوفها بعينيك",
    "الدفع نقدا عند الاستلام، فباب الدار",
  ],
  en: [
    "Cash on delivery · Check your parcel before you pay",
    "You only pay once your parcel is in your hands",
    "Pay in cash on delivery, at your door",
  ],
};

export interface Chrome {
  contact: string;
  order: string;
  info: string;
  whatsapp: string;
  phone: string;
  email: string;
  address: string;
  /** big footer buttons */
  askWhatsapp: string;
  call: string;
  write: string;
  top: string;
  legalNav: string;
  socialNav: string;
  newTab: string;
  /** WhatsApp message pre-filled from the footer; {product} = product name */
  waHello: string;
}

export const CHROME: Record<Lang, Chrome> = {
  fr: {
    contact: "Nous joindre",
    order: "Votre commande",
    info: "Informations",
    whatsapp: "WhatsApp",
    phone: "Téléphone",
    email: "E-mail",
    address: "Adresse",
    askWhatsapp: "Écrire sur WhatsApp",
    call: "Appeler",
    write: "Écrire un e-mail",
    top: "Haut de page",
    legalNav: "Informations légales",
    socialNav: "Réseaux sociaux",
    newTab: "nouvel onglet",
    waHello: "Bonjour\u00a0! J'ai une question sur «\u00a0{product}\u00a0».",
  },
  ar: {
    contact: "تواصل معنا",
    order: "الطلب ديالك",
    info: "معلومات",
    whatsapp: "واتساب",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان",
    askWhatsapp: "كتب لينا فواتساب",
    call: "عيّط لينا",
    write: "صيفط لينا إيميل",
    top: "الرجوع للأعلى",
    legalNav: "معلومات قانونية",
    socialNav: "مواقع التواصل",
    newTab: "نافذة جديدة",
    waHello: "السلام، عندي سؤال على «{product}».",
  },
  en: {
    contact: "Get in touch",
    order: "Your order",
    info: "Information",
    whatsapp: "WhatsApp",
    phone: "Phone",
    email: "Email",
    address: "Address",
    askWhatsapp: "Message on WhatsApp",
    call: "Call us",
    write: "Email us",
    top: "Back to top",
    legalNav: "Legal information",
    socialNav: "Social media",
    newTab: "opens in a new tab",
    waHello: "Hi! I have a question about “{product}”.",
  },
};
