/**
 * Default marquee words: a few short, sensory words for the product's family, interleaved with the
 * COD promises every store on the platform keeps (payment at the door, 24–48h delivery, open before
 * paying — free delivery only when every pack really ships free). The product's short name may lead
 * the loop. The generator replaces the words with product-specific copy; these are the fallback.
 */
import type { Locale, Offers, Product, ProductCategory } from "@/lib/page/schema";
import { garmentOf } from "../garment";

type Family = "skin" | "hair" | "scent" | "style" | "well" | "move" | "kitchen" | "home" | "play" | "tech" | "groom" | "food" | "other";

const FAMILY: Readonly<Record<ProductCategory, Family>> = {
  beauty: "skin",
  skincare: "skin",
  haircare: "hair",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  traditional: "style",
  health: "well",
  supplements: "well",
  fitness: "move",
  sport: "move",
  kitchen: "kitchen",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  kids: "play",
  toys: "play",
  pets: "play",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  grooming: "groom",
  "organic-food": "food",
  other: "other",
};

type Words = Readonly<Record<Family, readonly string[]>>;
type Pledge = "cod" | "delivery" | "check" | "free";

/** 1–3 words each; `*word*` lights one word up in the strip's accent treatment. */
const WORDS: Readonly<Record<"ar" | "fr" | "en", Words>> = {
  fr: {
    skin: ["Peau *lumineuse*", "Texture légère", "Rituel du soir", "Toucher soyeux", "Éclat naturel"],
    hair: ["Cheveux *brillants*", "Toucher soyeux", "Rituel du week-end", "Longueurs douces"],
    scent: ["Votre *signature*", "Notes chaudes", "Pour le soir", "Un cadeau qui marque"],
    style: ["Pièce *signature*", "Tous les jours", "Finitions soignées", "Idée cadeau"],
    well: ["Chaque *jour*", "Routine simple", "Bien-être", "Format pratique"],
    move: ["Muscles *détendus*", "Après l'effort", "À la maison", "Format compact"],
    kitchen: ["Cuisine *facile*", "Frais chaque jour", "Simple à utiliser", "Partout avec vous"],
    home: ["Maison *sereine*", "Au quotidien", "Simple à utiliser", "Pensé pour chez vous"],
    play: ["Moments de *jeu*", "Tout doux", "Rires et câlins", "Idée cadeau"],
    tech: ["Prêt en *un clic*", "Prise en main facile", "Au quotidien", "Bien pensé"],
    groom: ["Finition *nette*", "Prise en main facile", "Chaque matin", "Bien pensé"],
    food: ["Goût *authentique*", "Du terroir", "Sélection soignée", "À partager"],
    other: ["Bien *pensé*", "Au quotidien", "Simple à utiliser", "Idée cadeau"],
  },
  en: {
    skin: ["*Glowing* skin", "Light texture", "Evening ritual", "Silky touch", "Natural radiance"],
    hair: ["*Shiny* hair", "Silky touch", "Weekend ritual", "Soft lengths"],
    scent: ["Your *signature*", "Warm notes", "For the evening", "A gift they remember"],
    style: ["A *signature* piece", "Every day", "Fine finish", "Gift-ready"],
    well: ["Every *day*", "Simple routine", "Well-being", "Easy format"],
    move: ["*Relaxed* muscles", "After the workout", "At home", "Compact"],
    kitchen: ["*Easy* kitchen", "Fresh every day", "Simple to use", "Take it anywhere"],
    home: ["A *calmer* home", "Every day", "Simple to use", "Made for your space"],
    play: ["*Playtime*", "So soft", "Giggles & cuddles", "Gift idea"],
    tech: ["Ready in *one click*", "Easy grip", "Every day", "Thoughtfully made"],
    groom: ["A *clean* finish", "Easy grip", "Every morning", "Thoughtfully made"],
    food: ["*Authentic* taste", "From the land", "Carefully selected", "Made to share"],
    other: ["*Thoughtfully* made", "Every day", "Simple to use", "Gift idea"],
  },
  ar: {
    skin: ["بشرة *مشرقة*", "قوام خفيف", "طقوس المساء", "لمسة حريرية", "إشراقة طبيعية"],
    hair: ["شعر *لامع*", "لمسة حريرية", "روتين آخر الأسبوع", "نعومة من الجذور"],
    scent: ["عطرك *المميّز*", "نفحات دافئة", "لسهرات المساء", "هدية ما تتنساش"],
    style: ["قطعة *مميّزة*", "لكل يوم", "تفاصيل متقنة", "هدية مثالية"],
    well: ["كل *يوم*", "روتين بسيط", "راحة وعافية", "سهل الاستعمال"],
    move: ["عضلات *مرتاحة*", "بعد التمرين", "فالدار ولا فالخدمة", "حجم صغير"],
    kitchen: ["مطبخ *ساهل*", "منعش كل يوم", "سهل الاستعمال", "معاك فين ما مشيتي"],
    home: ["دار *مرتاحة*", "لكل يوم", "سهل الاستعمال", "مناسب لدارك"],
    play: ["لحظات *لعب*", "ناعم بزاف", "ضحك وفرحة", "هدية زوينة"],
    tech: ["جاهز *بنقرة*", "سهل فاليد", "لكل يوم", "تصميم ذكي"],
    groom: ["نتيجة *نقية*", "سهل فاليد", "كل صباح", "تصميم ذكي"],
    food: ["مذاق *أصيل*", "من خيرات الأرض", "مختار بعناية", "للمشاركة مع العائلة"],
    other: ["تصميم *ذكي*", "لكل يوم", "سهل الاستعمال", "فكرة هدية"],
  },
};

/** Garments (../garment.ts): fabric and fit, never "gift-ready" like a jewel. */
const GARMENT_WORDS: Readonly<Record<"ar" | "fr" | "en", { prayer: readonly string[]; plain: readonly string[] }>> = {
  fr: { prayer: ["Tissu *doux*", "Pour la prière", "Ample et couvrante", "Finitions soignées"], plain: ["Tissu *doux*", "Coupe juste", "Finitions soignées", "Tous les jours"] },
  en: { prayer: ["*Soft* fabric", "Made for prayer", "Loose and covering", "Fine finish"], plain: ["*Soft* fabric", "A cut that falls right", "Fine finish", "Every day"] },
  ar: { prayer: ["قماش *ناعم*", "للصلاة", "واسعة وساترة", "تفاصيل متقنة"], plain: ["قماش *ناعم*", "قصّة مضبوطة", "تفاصيل متقنة", "لكل يوم"] },
};

/** Short enough for a strip; "24–48" stays in order on RTL pages (RichText isolates it). */
const PROMISES: Readonly<Record<"ar" | "fr" | "en", Readonly<Record<Pledge, string>>>> = {
  fr: { cod: "Paiement à la livraison", delivery: "Livraison 24–48h", check: "Vérifiez avant de payer", free: "Livraison offerte" },
  en: { cod: "Cash on delivery", delivery: "24–48h delivery", check: "Check before you pay", free: "Free delivery" },
  ar: { cod: "الدفع عند الاستلام", delivery: "توصيل في 24–48 ساعة", check: "عاين قبل ما تخلص", free: "التوصيل مجاني" },
};

/** Launch markets are written by hand; other locales fall back to English, like the kit microcopy. */
const lang = (l: Locale): "ar" | "fr" | "en" => (l === "ar" || l === "fr" ? l : "en");

/** Product name without its size/format tail ("— 50 ml", "(x2)", ", 250 g"). */
export function shortName(name: string): string {
  return (name.split(/\s[—–-]\s|\(|,|·|\|/)[0] ?? name).trim() || name.trim();
}

/** Free delivery is only claimed when no fee is added and every pack ships free. */
export function shipsFree(offers: Offers): boolean {
  return (offers.shippingFee ?? 0) === 0 && offers.bundles.every((b) => b.freeShipping);
}

/** Deterministic Fisher–Yates with the defaults rng. */
function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Longest product name that still reads as one marquee word. */
const NAME_MAX = 26;

/**
 * 6–7 words: three sensory words for the product family alternating with three promises; a short
 * product name leads the loop on most pages. The emphasized family word is always among the three.
 */
export function defaultWords(input: { locale: Locale; product: Product; offers: Offers; rng: () => number }): string[] {
  const { locale, product, offers, rng } = input;
  const l = lang(locale);
  const garment = garmentOf(product);
  const [lead, ...rest] = garment ? GARMENT_WORDS[l][garment.prayer ? "prayer" : "plain"] : WORDS[l][FAMILY[product.category] ?? "other"];
  const senses = shuffle([lead!, ...shuffle(rest, rng).slice(0, 2)], rng);
  const p = PROMISES[l];
  const promises = [p.cod, shipsFree(offers) && rng() < 0.5 ? p.free : p.delivery, p.check];
  const words = senses.flatMap((s, i) => [s, promises[i]!]);
  const name = shortName(product.name);
  // a name containing markup characters would turn into emphasis: leave it out
  if (name.length <= NAME_MAX && !name.includes("*") && rng() < 0.6) words.unshift(name);
  return words;
}
