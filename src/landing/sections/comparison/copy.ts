/**
 * Comparison — default copy (ar · fr · en). Two product-family rows open the list (what the product
 * does better), then the honest COD rows every shop can stand behind: cash on delivery, opening the
 * parcel before paying, delivery time. The delivery row is "partial" (others deliver too, just
 * without a promise) and sits last, so generated pages (4 rows) never inherit its half mark.
 * Arabic is clear MSA with light Moroccan touches; no hype words, numbers over adjectives.
 */
import type { CopyLang, Family, Tri } from "../benefits/kit";
import type { Garment } from "../garment";

export interface RowCopy {
  label: string;
  us: string;
  them: string;
  partial?: boolean;
}

interface Common {
  kickers: readonly string[];
  /** {short} = short product name */
  titles: readonly string[];
  leads: readonly string[];
  us: string;
  them: string;
  note: string;
  /** cash on delivery · check before paying · delivery (partial) */
  rows: readonly [RowCopy, RowCopy, RowCopy];
}

export const COMMON: Tri<Common> = {
  ar: {
    kickers: ["مقارنة", "جنباً إلى جنب", "قبل أن تختار"],
    titles: ["الفرق *نقطة بنقطة*", "لماذا تطلبه *من عندنا*", "{short}: هنا *أو في مكان آخر*"],
    leads: ["نفس الحاجة، وطريقتان للشراء. هذا ما يتغيّر بالنسبة لك.", "ما تربحه حين تطلب من هنا، بوضوح ودون مبالغة."],
    us: "عندنا",
    them: "عند غيرنا",
    note: "مقارنة مع البدائل العامة الأكثر انتشاراً في السوق.",
    rows: [
      { label: "الدفع", us: "عند الاستلام، نقداً", them: "بالبطاقة، مسبقاً" },
      { label: "قبل الدفع", us: "تفتح الطرد وتعاينه", them: "تدفع دون أن ترى" },
      { label: "التوصيل", us: "24–48 ساعة حتى باب دارك", them: "مواعيد غير مضمونة", partial: true },
    ],
  },
  fr: {
    kickers: ["Comparatif", "Côte à côte", "Avant de choisir"],
    titles: ["La différence, *point par point*", "Pourquoi le prendre *chez nous*", "{short}, ici *ou ailleurs*"],
    leads: ["Même besoin, deux façons d'acheter. Voici ce qui change pour vous.", "Ce que vous gagnez à commander ici, sans détour."],
    us: "Chez nous",
    them: "Ailleurs",
    note: "Comparé aux alternatives génériques les plus courantes.",
    rows: [
      { label: "Paiement", us: "À la livraison, en espèces", them: "Par carte, d'avance" },
      { label: "Avant de payer", us: "Vous ouvrez et vérifiez", them: "Vous payez sans voir" },
      { label: "Livraison", us: "24–48h, jusqu'à votre porte", them: "Délais variables", partial: true },
    ],
  },
  en: {
    kickers: ["Side by side", "Compare", "Before you choose"],
    titles: ["The difference, *point by point*", "Why get it *from us*", "{short}: here *or elsewhere*"],
    leads: ["Same need, two ways to buy. Here's what changes for you.", "What you get by ordering here, plainly."],
    us: "With us",
    them: "Elsewhere",
    note: "Compared with the most common generic alternatives.",
    rows: [
      { label: "Payment", us: "Cash on delivery", them: "By card, upfront" },
      { label: "Before paying", us: "You open and check", them: "You pay sight unseen" },
      { label: "Delivery", us: "24–48h, to your door", them: "Varies", partial: true },
    ],
  },
};

/** Two rows on what the product itself does better, per copy family. */
export const FAMILY_ROWS: Record<Family, Tri<readonly [RowCopy, RowCopy]>> = {
  care: {
    ar: [
      { label: "القوام", us: "خفيف ويتشرّب بسرعة", them: "دهني ويلتصق بالبشرة" },
      { label: "الروتين", us: "خطوة واحدة، صباحاً أو مساءً", them: "ثلاثة منتجات فوق بعضها" },
    ],
    fr: [
      { label: "Texture", us: "Légère, pénètre vite", them: "Grasse, colle à la peau" },
      { label: "Routine", us: "Un seul geste, matin ou soir", them: "Trois produits à superposer" },
    ],
    en: [
      { label: "Texture", us: "Light, sinks in fast", them: "Greasy, sits on the skin" },
      { label: "Routine", us: "One step, morning or night", them: "Three products to layer" },
    ],
  },
  scent: {
    ar: [
      { label: "الثبات", us: "مصمَّم ليدوم على البشرة", them: "يتبخّر خلال ساعة" },
      { label: "الفوحان", us: "حاضر دون أن يزعج", them: "باهت أو قوي أكثر من اللازم" },
    ],
    fr: [
      { label: "Tenue", us: "Pensée pour durer sur la peau", them: "S'évapore en une heure" },
      { label: "Sillage", us: "Présent, jamais entêtant", them: "Trop discret ou trop fort" },
    ],
    en: [
      { label: "Lasting", us: "Made to stay on skin", them: "Gone within the hour" },
      { label: "Trail", us: "Present, never heavy", them: "Too faint or too loud" },
    ],
  },
  style: {
    ar: [
      { label: "التشطيب", us: "دقيق ومتقن في كل تفصيل", them: "غير متقن ويبهت بسرعة" },
      { label: "التغليف", us: "جاهز ليُقدَّم هدية", them: "كيس بلاستيكي" },
    ],
    fr: [
      { label: "Finitions", us: "Nettes, soignées au détail", them: "Inégales, vite ternies" },
      { label: "Présentation", us: "Prêt à offrir", them: "Sachet plastique" },
    ],
    en: [
      { label: "Finish", us: "Clean, cared for in detail", them: "Uneven, dulls fast" },
      { label: "Packaging", us: "Ready to gift", them: "Plastic pouch" },
    ],
  },
  active: {
    ar: [
      { label: "المكان", us: "في بيتك، متى شئت", them: "في القاعة، حسب أوقات الفتح" },
      { label: "التكلفة", us: "تشتريه مرة واحدة", them: "تدفع كل حصة على حدة" },
    ],
    fr: [
      { label: "Où", us: "Chez vous, quand vous voulez", them: "En salle, aux heures d'ouverture" },
      { label: "Coût", us: "Payé une seule fois", them: "Chaque séance se paie" },
    ],
    en: [
      { label: "Where", us: "At home, whenever you like", them: "At the gym, in opening hours" },
      { label: "Cost", us: "Paid once", them: "Every session paid" },
    ],
  },
  home: {
    ar: [
      { label: "كل يوم", us: "جاهز في ثوانٍ", them: "تحضير طويل وترتيب أطول" },
      { label: "التنظيف", us: "شطفة سريعة تكفي", them: "زوايا يصعب الوصول إليها" },
    ],
    fr: [
      { label: "Au quotidien", us: "Prêt en quelques secondes", them: "Long à sortir, long à ranger" },
      { label: "Nettoyage", us: "Un rinçage suffit", them: "Des recoins impossibles" },
    ],
    en: [
      { label: "Every day", us: "Ready in seconds", them: "Slow to set up and put away" },
      { label: "Cleaning", us: "A quick rinse does it", them: "Corners you can't reach" },
    ],
  },
  tech: {
    ar: [
      { label: "الاستعمال", us: "فوري، بدون دليل", them: "إعدادات معقّدة" },
      { label: "الحجم", us: "صغير ويدخل في أي مكان", them: "ضخم ويأخذ مساحة" },
    ],
    fr: [
      { label: "Prise en main", us: "Immédiate, sans notice", them: "Réglages compliqués" },
      { label: "Format", us: "Compact, se glisse partout", them: "Encombrant" },
    ],
    en: [
      { label: "Setup", us: "Instant, no manual needed", them: "Fiddly settings" },
      { label: "Size", us: "Compact, fits anywhere", them: "Bulky" },
    ],
  },
  kids: {
    ar: [
      { label: "المتانة", us: "مصمَّم للعب اليومي", them: "ينكسر في أيام" },
      { label: "العناية", us: "سهل الغسل", them: "صعب التنظيف" },
    ],
    fr: [
      { label: "Solidité", us: "Pensé pour jouer tous les jours", them: "Cassé en quelques jours" },
      { label: "Entretien", us: "Se lave facilement", them: "Compliqué à nettoyer" },
    ],
    en: [
      { label: "Sturdiness", us: "Made for everyday play", them: "Broken within days" },
      { label: "Care", us: "Easy to wash", them: "Hard to clean" },
    ],
  },
  natural: {
    ar: [
      { label: "المصدر", us: "معروف ومختار بعناية", them: "غامض ولا يمكن تتبّعه" },
      { label: "المكوّنات", us: "قليلة وواضحة", them: "قائمة طويلة من الإضافات" },
    ],
    fr: [
      { label: "Origine", us: "Connue, choisie avec soin", them: "Floue, sans traçabilité" },
      { label: "Composition", us: "Courte et lisible", them: "Longue liste d'additifs" },
    ],
    en: [
      { label: "Origin", us: "Known, carefully chosen", them: "Unclear, untraceable" },
      { label: "Ingredients", us: "Short and readable", them: "A long list of additives" },
    ],
  },
  general: {
    ar: [
      { label: "الاستعمال", us: "سهل من أول مرة", them: "معقّد" },
      { label: "الجودة", us: "مصمَّم ليدوم", them: "سرعان ما يُستبدل" },
    ],
    fr: [
      { label: "Utilisation", us: "Simple dès la première fois", them: "Compliquée" },
      { label: "Qualité", us: "Pensé pour durer", them: "Vite remplacé" },
    ],
    en: [
      { label: "Use", us: "Simple from day one", them: "Complicated" },
      { label: "Quality", us: "Built to last", them: "Soon replaced" },
    ],
  },
};

/** Screen-reader words for the marks and the criterion column. */
export const A11Y: Tri<{ yes: string; no: string; partly: string; criterion: string }> = {
  ar: { yes: "نعم", no: "لا", partly: "جزئياً", criterion: "المعيار" },
  fr: { yes: "Oui", no: "Non", partly: "En partie", criterion: "Critère" },
  en: { yes: "Yes", no: "No", partly: "Partly", criterion: "Criterion" },
};

export type { CopyLang };

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts): fabric, then fit (prayer, drape or size)  */
/* ------------------------------------------------------------------ */

const GARMENT_ROWS: Tri<{ fabric: RowCopy; prayer: RowCopy; drape: RowCopy; size: RowCopy }> = {
  ar: {
    fabric: { label: "القماش", us: "ناعم ويتنفّس", them: "صناعي يحكّ ويلتصق" },
    prayer: { label: "أثناء الصلاة", us: "واسعة، لا ترتفع ولا تضيق", them: "تضيق وترتفع مع الحركة" },
    drape: { label: "طوال اليوم", us: "يثبت في مكانه", them: "ينزلق ويحتاج إلى ضبط" },
    size: { label: "المقاس", us: "نراجعه معك بالهاتف", them: "على الحظ" },
  },
  fr: {
    fabric: { label: "Tissu", us: "Doux, il respire", them: "Synthétique qui gratte et colle" },
    prayer: { label: "Pendant la prière", us: "Ample, rien ne remonte", them: "Serre et remonte" },
    drape: { label: "Toute la journée", us: "Tient en place", them: "Glisse, à réajuster" },
    size: { label: "Taille", us: "Revue avec vous au téléphone", them: "Au petit bonheur" },
  },
  en: {
    fabric: { label: "Fabric", us: "Soft, breathes", them: "Scratchy, clingy synthetic" },
    prayer: { label: "During prayer", us: "Loose, never rides up", them: "Tight, rides up" },
    drape: { label: "All day", us: "Stays put", them: "Slips, needs fixing" },
    size: { label: "Size", us: "Checked with you by phone", them: "Pot luck" },
  },
};

/** The two product rows of a garment: the fabric, then how it fits (prayer, a veil that holds, the size). */
export function garmentRows(lang: CopyLang, g: Garment): readonly [RowCopy, RowCopy] {
  const c = GARMENT_ROWS[lang];
  return [c.fabric, g.scarf ? c.drape : g.prayer ? c.prayer : c.size];
}
