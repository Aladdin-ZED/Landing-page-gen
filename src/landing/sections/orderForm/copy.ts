/**
 * Copy of the order form (ar · fr · en): default heading copy (product-aware, 2–3 alternatives) and
 * the few labels the kit's i18n does not carry (wallet-pass fields, the order line). Short,
 * concrete, COD-first; Arabic is clear MSA with light Moroccan touches.
 */
import type { Locale } from "@/lib/page/schema";
import { inLocale } from "../whatsappFloat/wa";

type L = { ar: string; fr: string; en: string };

const pick = <T,>(rng: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;

const NBSP = String.fromCharCode(0xa0);

/**
 * A product name short enough to sit inside a headline, else null. Typeset for line breaks: a
 * figure keeps its unit ("50 ml", "50 مل" never split across two lines) and a dash stays at the end
 * of its line instead of opening the next one.
 */
export function headlineName(name: string): string | null {
  const n = name.replace(/\s+/g, " ").trim();
  if (!(n.length > 0 && n.length <= 26 && !/[*\\]/.test(n))) return null;
  return n.replace(/ (?=[–—])/g, NBSP).replace(/(\d) (?=\S)/g, `$1${NBSP}`);
}

export interface FormCopy {
  kicker: string;
  title: string;
  lead: string;
  packsLabel: string;
  optionsLabel: string;
  detailsLabel: string;
}

export function formCopy(locale: Locale, productName: string, rng: () => number): FormCopy {
  const short = headlineName(productName);
  const titles: L[] = [
    { ar: "اطلب دابا، و*خلّص فالباب*", fr: "Commandez, *payez à la livraison*", en: "Order now, *pay at the door*" },
    { ar: "عمّر المعلومات، *والباقي علينا*", fr: "Trente secondes, *on\u00a0s'occupe du reste*", en: "Thirty seconds, *we\u00a0handle the rest*" },
  ];
  if (short)
    titles.push({
      ar: `${short}، *حتى لباب الدار*`,
      fr: `Votre ${short}, *livré chez vous*`,
      en: `Your ${short}, *delivered home*`,
    });
  const kickers: L[] = [
    { ar: "الطلب فـ 30 ثانية", fr: "Commande en 30 secondes", en: "Order in 30 seconds" },
    { ar: "بلا بطاقة، بلا حساب", fr: "Sans carte, sans compte", en: "No card, no account" },
  ];
  const leads: L[] = [
    {
      ar: "عمّر الخانات، ونعيطو ليك نأكدو الطلب. ما كتخلص حتى توصلك السلعة وتشوفها.",
      fr: "Remplissez le formulaire, un conseiller vous appelle pour confirmer. Vous ne payez qu'en recevant le colis.",
      en: "Fill in the form and we call you to confirm. You only pay once the parcel is in your hands.",
    },
    {
      ar: "غير اللي خاص. مكالمة وحدة باش نأكدو، والخلاص عند الاستلام.",
      fr: "Juste l'essentiel. Un appel pour confirmer, le paiement à la livraison.",
      en: "Just the essentials. One call to confirm, and you pay on delivery.",
    },
  ];
  return {
    kicker: inLocale(locale, pick(rng, kickers)),
    title: inLocale(locale, pick(rng, titles)),
    lead: inLocale(locale, pick(rng, leads)),
    packsLabel: "",
    optionsLabel: inLocale(locale, { ar: "اختار اللي بغيتي", fr: "Vos préférences", en: "Your choices" }),
    detailsLabel: inLocale(locale, { ar: "فين نوصلو ليك؟", fr: "Où vous livrer ?", en: "Where do we deliver?" }),
  };
}

/** "(optional)" suffix for fields that may stay empty. */
export const optionalLabel = (locale: Locale) => inLocale(locale, { ar: "اختياري", fr: "facultatif", en: "optional" });

/** Labels of the order form's own UI (wallet-pass fields, order line, fallbacks of empty data). */
export function uiLabels(locale: Locale) {
  return {
    total: inLocale(locale, { ar: "المجموع", fr: "Total", en: "Total" }),
    perUnit: inLocale(locale, { ar: "ثمن القطعة", fr: "Par pièce", en: "Per item" }),
    youSave: inLocale(locale, { ar: "كتربح", fr: "Économie", en: "You save" }),
    yourOrder: inLocale(locale, { ar: "طلبك", fr: "Votre commande", en: "Your order" }),
    options: inLocale(locale, { ar: "اختياراتك", fr: "Vos préférences", en: "Your choices" }),
    details: inLocale(locale, { ar: "فين نوصلو ليك؟", fr: "Où vous livrer ?", en: "Where do we deliver?" }),
    email: inLocale(locale, { ar: "name@example.com", fr: "nom@exemple.com", en: "name@example.com" }),
  };
}
