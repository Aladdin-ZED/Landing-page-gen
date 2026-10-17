/**
 * Final CTA default copy — short, sensory, product-aware lines per product family, in clear Arabic
 * (MSA with light Darija where Moroccan shoppers expect it), warm French and plain English.
 * Every claim restates the built-in COD promises (pay at the door, check before paying, 24–48h,
 * 30-second order): no invented guarantees, no next-day promise, no exclamation marks. Titles stay
 * short enough to be set huge in the poster layout.
 */
import type { IconName } from "@/landing/primitives";
import { everyOfferFree } from "@/lib/page/pricing";
import type { Locale, Offers, ProductCategory } from "@/lib/page/schema";
import type { Garment } from "../garment";

export type Lang = "ar" | "fr" | "en";
type Family = "care" | "scent" | "style" | "sport" | "tech" | "kitchen" | "home" | "kids" | "pets" | "natural" | "general";

const FAMILY: Partial<Record<ProductCategory, Family>> = {
  beauty: "care",
  skincare: "care",
  haircare: "care",
  grooming: "care",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  fitness: "sport",
  sport: "sport",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  kitchen: "kitchen",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  kids: "kids",
  toys: "kids",
  pets: "pets",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
};

export const langOf = (l: Locale): Lang => (l === "ar" || l === "fr" ? l : "en");
const familyOf = (c: ProductCategory | undefined): Family => (c && FAMILY[c]) || "general";

const TITLES: Readonly<Record<Lang, Readonly<Record<Family, readonly string[]>>>> = {
  fr: {
    care: ["Votre peau, *en mieux*.", "Le soin qui *se voit*.", "La douceur, *à votre porte*."],
    scent: ["Votre sillage *commence ici*.", "Le parfum qu'on *retient*.", "Signez *chaque soirée*."],
    style: ["Le détail qui *fait tout*.", "Votre style, *livré chez vous*.", "Prêt à *être porté*."],
    sport: ["Votre séance, *en mieux*.", "Récupérez *à la maison*.", "Bougez *plus librement*."],
    tech: ["Le vôtre *en 24–48h*.", "Allumez, *c'est parti*.", "La bonne idée, *livrée*."],
    kitchen: ["Votre cuisine, *en plus simple*.", "Cuisinez *l'esprit libre*.", "Le bon goût, *sans effort*."],
    home: ["Chez vous, *en mieux*.", "Le confort, *livré*.", "Une maison *plus douce*."],
    kids: ["Leur nouveau *préféré*.", "Des sourires *à la maison*.", "Prêts à *jouer*."],
    pets: ["Son nouveau *préféré*.", "Le meilleur, *pour lui*.", "Il le mérite *bien*."],
    natural: ["Le naturel, *chez vous*.", "Le bon geste, *chaque jour*.", "Pur, *tout simplement*."],
    general: ["Le vôtre, *à votre porte*.", "Il n'attend *que vous*.", "Commandez, *payez à la porte*."],
  },
  en: {
    care: ["Your skin, *upgraded*.", "Care you can *see*.", "Softness, *at your door*."],
    scent: ["Your signature *starts here*.", "The scent they *remember*.", "Sign *every evening*."],
    style: ["The detail that *makes it*.", "Your style, *delivered*.", "Ready to *wear*."],
    sport: ["Your session, *upgraded*.", "Recover *at home*.", "Move *more freely*."],
    tech: ["Yours in *24–48h*.", "Switch on, *go*.", "The smart pick, *delivered*."],
    kitchen: ["Your kitchen, *simplified*.", "Cook *with ease*.", "Good taste, *no effort*."],
    home: ["Home, *but better*.", "Comfort, *delivered*.", "A softer *home*."],
    kids: ["Their new *favorite*.", "Smiles *at home*.", "Ready to *play*."],
    pets: ["Their new *favorite*.", "The best, *for your buddy*.", "They *deserve it*."],
    natural: ["Nature, *at your door*.", "The good habit, *daily*.", "Pure, *simply*."],
    general: ["Yours, *at your door*.", "It's waiting *for you*.", "Order now, *pay at the door*."],
  },
  ar: {
    care: ["بشرتك، *في أحسن حال*", "عناية *تبان نتيجتها*", "النعومة *حتى باب دارك*"],
    scent: ["حضورك *يبدأ من هنا*", "عطر *ما يتنساش*", "توقيعك *في كل سهرة*"],
    style: ["التفصيل *اللي كيفرق*", "أناقتك *توصل لدارك*", "جاهز *تلبسو*"],
    sport: ["حصّتك، *في أحسن حال*", "الاسترجاع *في دارك*", "تحرّك *براحة أكثر*"],
    tech: ["ديالك *في 24–48 ساعة*", "شغّلو، *وانطلق*", "الاختيار الذكي، *حتى للباب*"],
    kitchen: ["مطبخك، *أسهل من قبل*", "الطبخ *ولّى ساهل*", "المذاق، *بلا تعب*"],
    home: ["دارك، *في أحسن حال*", "الراحة *توصل لبابك*", "بيت *أدفأ وأهدأ*"],
    kids: ["المفضّل *الجديد ديالهم*", "الضحكة *في الدار*", "يلا *نلعبو*"],
    pets: ["المفضّل *الجديد ديالو*", "الأحسن *لرفيقك*", "يستاهل *الأحسن*"],
    natural: ["الطبيعة، *حتى لبابك*", "العادة الصحيحة، *كل يوم*", "صافي، *ببساطة*"],
    general: ["ديالك، *حتى لبابك*", "في انتظارك *دابا*", "اطلب دابا، *وخلّص في الباب*"],
  },
};

interface Common {
  kickers: readonly string[];
  leads: readonly string[];
  /** the COD promise (first reassurance point) */
  cod: string;
  delivery: string;
  freeDelivery: string;
  check: string;
  /** text around the badge CTA's button (two short phrases read best on the ring) */
  ring: string;
}

export const COMMON: Readonly<Record<Lang, Common>> = {
  fr: {
    kickers: ["Dernière étape", "À vous de jouer", "C'est le moment"],
    leads: [
      "Commande en 30 secondes, sans compte ni carte. Vous payez au livreur, après avoir vérifié votre colis.",
      "Livré en 24–48h. Vous ouvrez, vous vérifiez, puis vous payez en espèces à la porte.",
    ],
    cod: "Paiement à la livraison",
    delivery: "Livraison en 24–48h",
    freeDelivery: "Livraison offerte, 24–48h",
    check: "Vérifiez avant de payer",
    ring: "Paiement à la livraison · Livraison 24–48h",
  },
  en: {
    kickers: ["Last step", "Your move", "It's time"],
    leads: [
      "Order in 30 seconds. No account, no card: you pay the courier after checking your parcel.",
      "Delivered in 24–48h. Open it, check it, then pay cash at the door.",
    ],
    cod: "Pay on delivery",
    delivery: "Delivered in 24–48h",
    freeDelivery: "Free delivery, 24–48h",
    check: "Check before you pay",
    ring: "Cash on delivery · Delivered in 24–48h",
  },
  ar: {
    kickers: ["الخطوة الأخيرة", "دابا دورك", "هادي هي اللحظة"],
    leads: [
      "اطلب في 30 ثانية، بلا حساب وبلا بطاقة. تدفع للموزّع بعد ما تعاين الطرد ديالك.",
      "يوصلك خلال 24–48 ساعة. تحلّ، تعاين، ومن بعد تخلّص كاش في الباب.",
    ],
    cod: "الدفع عند الاستلام",
    delivery: "توصيل خلال 24–48 ساعة",
    freeDelivery: "توصيل مجاني، 24–48 ساعة",
    check: "عاين قبل ما تخلّص",
    ring: "الدفع عند الاستلام · عاين قبل ما تخلّص",
  },
};

/** Deterministic pick from the defaults rng. */
export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
}

/** Garments (../garment.ts): "ready to play" would be wrong under a girl's prayer abaya. */
const GARMENT_TITLES: Readonly<Record<Lang, { prayer: readonly string[]; plain: readonly string[] }>> = {
  fr: {
    prayer: ["Votre tenue de prière, *à votre porte*.", "Ample et douce, *livrée chez vous*.", "Touchez le tissu, *puis payez*."],
    plain: ["Votre nouvelle pièce, *à votre porte*.", "Touchez le tissu, *puis payez*.", "Le bon tissu, *livré chez vous*."],
  },
  en: {
    prayer: ["Your prayer outfit, *at your door*.", "Loose and soft, *delivered*.", "Feel the fabric, *then pay*."],
    plain: ["Your new piece, *at your door*.", "Feel the fabric, *then pay*.", "Soft fabric, *delivered*."],
  },
  ar: {
    prayer: ["لباس صلاتك *حتى لباب دارك*", "واسعة وناعمة، *توصلك لدارك*", "المس القماش، *ومن بعد خلّص*"],
    plain: ["قطعتك الجديدة *حتى لبابك*", "المس القماش، *ومن بعد خلّص*", "قماش ناعم، *يوصلك لدارك*"],
  },
};

export function titlesFor(lang: Lang, category: ProductCategory | undefined, garment?: Garment | null): readonly string[] {
  if (garment) return GARMENT_TITLES[lang][garment.prayer ? "prayer" : "plain"];
  return TITLES[lang][familyOf(category)];
}

/** “Free” delivery only when no fee is charged and every pack ships free. */
export function defaultPoints(lang: Lang, offers: Offers): { icon: IconName; text: string }[] {
  const c = COMMON[lang];
  const free = everyOfferFree({ offers });
  return [
    { icon: "cash-hand", text: c.cod },
    { icon: "truck", text: free ? c.freeDelivery : c.delivery },
    { icon: "eye", text: c.check },
  ];
}
