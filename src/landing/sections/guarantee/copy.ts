/**
 * Guarantee — default copy in ar / fr / en. Every line restates a real COD store policy (pay at the
 * door in cash, open and check the parcel in front of the courier, exchanges arranged with the
 * order number, the confirmation call before shipping): no invented durations, percentages or
 * refunds, and no channel the store may not have — defaults never promise WhatsApp (the number
 * lives in Settings → Store; the copy cannot know it). The “check before paying” promise and the
 * closing promise (exchange for durable goods, a person on the line for opened consumables) are
 * tailored to the product family; garments get their own check line. Other locales fall back to
 * English.
 */
import type { IconName } from "@/landing/primitives";
import type { Locale, ProductCategory } from "@/lib/page/schema";

export type Lang = "ar" | "fr" | "en";
type Tri<T> = Record<Lang, T>;

export const langOf = (locale: Locale): Lang => (locale === "ar" || locale === "fr" ? locale : "en");

/** Product families that share how a parcel is checked and what happens after delivery. */
type Family = "care" | "scent" | "style" | "active" | "tech" | "home" | "kids" | "natural" | "general";

const FAMILY: Record<ProductCategory, Family> = {
  beauty: "care",
  skincare: "care",
  haircare: "care",
  grooming: "care",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  fitness: "active",
  sport: "active",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  kitchen: "home",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  kids: "kids",
  toys: "kids",
  pets: "kids",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
  other: "general",
};

export const familyOf = (c: ProductCategory | undefined): Family => (c && FAMILY[c]) || "general";

/** Opened consumables are not exchanged: their closing promise is a person on the confirmation call. */
const CONSUMABLE: readonly Family[] = ["care", "scent", "natural"];

interface PromiseCopy {
  icon: IconName;
  title: string;
  text: string;
}

interface Common {
  kickers: readonly string[];
  titles: readonly string[];
  leads: readonly string[];
  cod: PromiseCopy;
  checkTitle: string;
  exchange: PromiseCopy;
  help: PromiseCopy;
  /** two short phrases around the badge */
  ring: string;
  signRole: string;
}

export const COMMON: Tri<Common> = {
  fr: {
    kickers: ["Notre engagement", "Zéro risque", "Commandez sereinement"],
    titles: ["Vous ne payez que *si\u00a0ça vous plaît*", "Vérifiez d'abord, payez *ensuite*", "Commandez *l'esprit tranquille*"],
    leads: [
      "Votre colis arrive fermé. Vous l'ouvrez devant le livreur, vous vérifiez, puis vous décidez.",
      "Aucune avance, aucune carte bancaire\u00a0: vous gardez la main jusqu'à votre porte.",
    ],
    cod: { icon: "cash-hand", title: "Payez à la réception", text: "Rien à régler en ligne\u00a0: vous payez en espèces, au livreur, à votre porte." },
    checkTitle: "Vérifiez avant de payer",
    exchange: { icon: "return", title: "Échange simple", text: "Un défaut ou une erreur de modèle\u00a0? Contactez-nous avec votre numéro de commande\u00a0: on organise l'échange." },
    help: { icon: "headset", title: "Une vraie personne au bout du fil", text: "Avant l'envoi, un conseiller vous appelle pour confirmer la commande et répondre à vos questions." },
    ring: "Paiement à la livraison · Vérifiez avant de payer",
    signRole: "Le service client",
  },
  ar: {
    kickers: ["التزامنا معك", "بلا مخاطرة", "اطلب براحة بال"],
    titles: ["لا تدفع إلا *إذا أعجبك*", "عاين أولاً، ثم *ادفع*", "اطلب *براحة بال*"],
    leads: [
      "يصلك الطرد مغلقاً. تفتحه أمام الموزّع، تعاينه، ثم تقرّر.",
      "بلا دفع مسبق وبلا بطاقة بنكية: القرار بيدك حتى باب بيتك.",
    ],
    cod: { icon: "cash-hand", title: "الدفع عند الاستلام", text: "لا شيء يُدفع أونلاين: تدفع نقداً للموزّع عند باب بيتك." },
    checkTitle: "عاين قبل ما تخلص",
    exchange: { icon: "return", title: "تبديل سهل", text: "عيب في المنتج أو خطأ في الموديل؟ تواصل معنا برقم طلبك، وننظّم معك التبديل." },
    help: { icon: "headset", title: "شخص حقيقي يجيبك", text: "قبل الإرسال، يتصل بك مستشار لتأكيد الطلب والإجابة عن أسئلتك." },
    ring: "الدفع عند الاستلام · عاين قبل الدفع",
    signRole: "خدمة الزبناء",
  },
  en: {
    kickers: ["Our promise", "Zero risk", "Order with peace of mind"],
    titles: ["You pay only *if you like it*", "Check first, pay *after*", "Order with *peace of mind*"],
    leads: [
      "Your parcel arrives sealed. Open it in front of the courier, check it, then decide.",
      "No prepayment, no card: you stay in control right up to your door.",
    ],
    cod: { icon: "cash-hand", title: "Pay on delivery", text: "Nothing to pay online: you pay the courier in cash, at your door." },
    checkTitle: "Check before you pay",
    exchange: { icon: "return", title: "Easy exchange", text: "A defect or the wrong model? Contact us with your order number and we'll arrange the exchange." },
    help: { icon: "headset", title: "A real person on the line", text: "Before shipping, an advisor calls to confirm your order and answer your questions." },
    ring: "Cash on delivery · Check before you pay",
    signRole: "Customer care",
  },
};

/** How the parcel is checked, per family (the sentence under “Check before you pay”). */
const CHECK: Record<Family, Tri<string>> = {
  care: {
    fr: "Ouvrez le colis, regardez le flacon et la texture. Vous ne payez que s'il vous convient.",
    ar: "افتح الطرد وتفقّد العبوة والقوام. لا تدفع إلا إذا ناسبك.",
    en: "Open the parcel, look at the bottle and the texture. You pay only if it suits you.",
  },
  scent: {
    fr: "Ouvrez la boîte, découvrez le flacon et son coffret. Vous ne payez que s'il vous convient.",
    ar: "افتح العلبة وتفقّد القارورة وتغليفها. لا تدفع إلا إذا أعجبتك.",
    en: "Open the box, see the bottle and its case. You pay only if you like it.",
  },
  style: {
    fr: "Regardez les finitions de près, essayez-le. Vous ne payez que s'il vous convient.",
    ar: "تفقّد التفاصيل والجودة عن قرب وجرّبه. لا تدفع إلا إذا أعجبك.",
    en: "Look closely at the finish and try it on. You pay only if you like it.",
  },
  active: {
    fr: "Allumez-le et testez-le devant le livreur. Vous payez seulement s'il fonctionne comme promis.",
    ar: "شغّله وجرّبه أمام الموزّع. لا تدفع إلا إذا اشتغل كما وعدناك.",
    en: "Switch it on and test it in front of the courier. You pay only if it works as promised.",
  },
  tech: {
    fr: "Allumez-le, testez chaque fonction devant le livreur. Vous payez seulement si tout marche.",
    ar: "شغّله وجرّب كل وظيفة أمام الموزّع. لا تدفع إلا إذا كان كل شيء يعمل.",
    en: "Switch it on and try every function in front of the courier. You pay only if it all works.",
  },
  home: {
    fr: "Déballez-le et vérifiez chaque pièce devant le livreur. Vous payez seulement si tout est là.",
    ar: "افتح الطرد وتأكّد من كل قطعة أمام الموزّع. لا تدفع إلا إذا كان كل شيء كاملاً.",
    en: "Unpack it and check every part in front of the courier. You pay only if it's all there.",
  },
  kids: {
    fr: "Ouvrez le colis, vérifiez les finitions et chaque pièce. Vous payez seulement si tout vous convient.",
    ar: "افتح الطرد وتفقّد الجودة وكل قطعة. لا تدفع إلا إذا كان كل شيء مناسباً.",
    en: "Open the parcel and check the finish and every piece. You pay only if it all suits you.",
  },
  natural: {
    fr: "Ouvrez le colis, vérifiez le produit, son emballage et sa date. Vous ne payez que s'il vous convient.",
    ar: "افتح الطرد وتفقّد المنتج وتغليفه وتاريخه. لا تدفع إلا إذا ناسبك.",
    en: "Open the parcel and check the product, its seal and its date. You pay only if it suits you.",
  },
  general: {
    fr: "Ouvrez le colis et vérifiez votre commande devant le livreur. Vous payez seulement si elle vous convient.",
    ar: "افتح الطرد وتفقّد طلبك أمام الموزّع. لا تدفع إلا إذا ناسبك.",
    en: "Open the parcel and check your order in front of the courier. You pay only if it suits you.",
  },
};

/** How a garment is checked at the door (../garment.ts): touch the fabric, check the size. */
const GARMENT_CHECK: Tri<string> = {
  fr: "Ouvrez le colis, touchez le tissu, vérifiez la taille et les finitions. Vous ne payez que si tout vous plaît.",
  ar: "افتح الطرد، المس القماش، وتأكّد من المقاس والتشطيب. لا تدفع إلا إذا أعجبك كل شيء.",
  en: "Open the parcel, feel the fabric, check the size and the finish. You pay only if it's all right.",
};

/** The three default promises for a product category (a garment checks fabric and size). */
export function defaultPromises(lang: Lang, category: ProductCategory | undefined, garment = false): PromiseCopy[] {
  const c = COMMON[lang];
  const fam = familyOf(category);
  const check = garment ? GARMENT_CHECK[lang] : CHECK[fam][lang];
  return [c.cod, { icon: "eye", title: c.checkTitle, text: check }, !garment && CONSUMABLE.includes(fam) ? c.help : c.exchange];
}

/** Render-time microcopy (not stored in the page data). */
export const UI: Tri<{ upfront: string; atDoor: string }> = {
  fr: { upfront: "d'avance", atDoor: "à payer à la réception" },
  ar: { upfront: "مسبقاً", atDoor: "تدفعها عند الاستلام" },
  en: { upfront: "upfront", atDoor: "paid at your door" },
};
