/**
 * Default copy for the video section (ar · fr · en; other locales fall back to English) and the
 * player's own microcopy. Arabic is clear MSA; the customer's words carry light Darija, as people
 * actually write them. Titles mark one key phrase with *emphasis*.
 */
import type { Locale, ProductCategory } from "@/lib/page/schema";

export type Lang = "ar" | "fr" | "en";
export type Family = "care" | "scent" | "style" | "active" | "home" | "tech" | "kids" | "natural" | "general";

export const langOf = (l: Locale): Lang => (l === "ar" || l === "fr" ? l : "en");

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
  kitchen: "home",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
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

type Tri<T> = Record<Lang, T>;

interface FamilyCopy {
  titles: string[];
  chapters: string[];
  quote: string;
}

export const FAMILIES: Record<Family, Tri<FamilyCopy>> = {
  care: {
    fr: {
      titles: ["Une goutte, et la peau *boit tout*", "La texture, *en vrai*", "Regardez-la *fondre sur la peau*"],
      chapters: ["La texture", "L'application", "Le fini sur la peau"],
      quote: "Je l'applique le soir, la peau est toute douce au réveil.",
    },
    ar: {
      titles: ["قطرة واحدة، *والبشرة تشربها*", "القوام، *على حقيقته*", "شاهديه *يذوب على البشرة*"],
      chapters: ["القوام", "طريقة الاستعمال", "النتيجة على البشرة"],
      quote: "كنحطّو فالليل، وفالصباح البشرة ناعمة بزاف.",
    },
    en: {
      titles: ["One drop, and skin *drinks it in*", "The texture, *for real*", "Watch it *melt into skin*"],
      chapters: ["The texture", "How to apply", "The finish"],
      quote: "I put it on at night, soft skin by morning.",
    },
  },
  scent: {
    fr: {
      titles: ["Le flacon, la lumière, *le geste*", "Un parfum qui se *regarde* aussi", "Avant de le porter, voyez-le *en vrai*"],
      chapters: ["Le flacon", "La vaporisation", "Le sillage"],
      quote: "On m'a demandé trois fois le nom du parfum dans la journée.",
    },
    ar: {
      titles: ["القارورة، الضوء، *واللمسة*", "عطر *يُرى* قبل أن يُشمّ", "شاهده *على حقيقته* قبل أن تتعطّر به"],
      chapters: ["القارورة", "الرشّة", "الأثر"],
      quote: "ثلاث مرات فنهار واحد سولوني على سمية العطر.",
    },
    en: {
      titles: ["The bottle, the light, *the ritual*", "A scent you can *almost see*", "See it *for real* before you wear it"],
      chapters: ["The bottle", "The spray", "The trail"],
      quote: "Three people asked what I was wearing, in one day.",
    },
  },
  style: {
    fr: {
      titles: ["Porté, en mouvement, *en vrai*", "Plus beau *en vrai* qu'en photo", "Regardez-le *bouger*"],
      chapters: ["Les détails", "Porté", "En mouvement"],
      quote: "Encore plus beau en vrai qu'en photo.",
    },
    ar: {
      titles: ["ملبوس، في الحركة، *على حقيقته*", "أجمل *في الحقيقة* من الصور", "شاهده *وهو يتحرك*"],
      chapters: ["التفاصيل", "عند اللبس", "في الحركة"],
      quote: "أحسن فالحقيقة من التصاور.",
    },
    en: {
      titles: ["Worn, in motion, *for real*", "Even better *in person*", "Watch it *move*"],
      chapters: ["The details", "Worn", "In motion"],
      quote: "Even nicer in person than in the photos.",
    },
  },
  active: {
    fr: {
      titles: ["Regardez-le *travailler*", "La puissance, *en vrai*", "Pas de promesses. *Des preuves*"],
      chapters: ["La prise en main", "Les réglages", "En action"],
      quote: "Cinq minutes après la salle, et mes jambes sont légères.",
    },
    ar: {
      titles: ["شاهده *وهو يشتغل*", "القوة، *على حقيقتها*", "لا وعود، *بل دليل*"],
      chapters: ["طريقة المسك", "مستويات القوة", "أثناء الاستعمال"],
      quote: "خمس دقايق من بعد التمرين، ورجليا كيوليو خفاف.",
    },
    en: {
      titles: ["Watch it *work*", "The power, *for real*", "No promises. *Just proof*"],
      chapters: ["The grip", "The settings", "In action"],
      quote: "Five minutes after the gym and my legs feel light.",
    },
  },
  home: {
    fr: {
      titles: ["Regardez-le *faire le travail*", "Du geste au résultat, *en quelques secondes*", "Voyez-le *chez quelqu'un comme vous*"],
      chapters: ["Le montage", "L'utilisation", "Le résultat"],
      quote: "Smoothie au bureau en deux minutes, rincé en une seconde.",
    },
    ar: {
      titles: ["شاهده *وهو يقوم بالمهمة*", "من أول حركة إلى النتيجة، *في ثوانٍ*", "شاهده *في بيت مثل بيتك*"],
      chapters: ["التركيب", "الاستعمال", "النتيجة"],
      quote: "سموذي فالخدمة فدقيقتين، وكيتغسل فثانية.",
    },
    en: {
      titles: ["Watch it *do the job*", "From first press to done, *in seconds*", "See it *in a home like yours*"],
      chapters: ["Setup", "In use", "The result"],
      quote: "Smoothie at my desk in two minutes, rinsed in seconds.",
    },
  },
  tech: {
    fr: {
      titles: ["Regardez-le *en marche*", "Branché, allumé, *adopté*", "Voyez *chaque détail*"],
      chapters: ["Le déballage", "La mise en route", "Au quotidien"],
      quote: "Installé en deux minutes, je ne m'en passe plus.",
    },
    ar: {
      titles: ["شاهده *وهو يعمل*", "وصّله، شغّله، *ولن تستغني عنه*", "شاهد *كل تفصيلة*"],
      chapters: ["فتح العلبة", "التشغيل", "الاستعمال اليومي"],
      quote: "ركّبتو فدقيقتين، وما بقيتش نقدر نستغنى عليه.",
    },
    en: {
      titles: ["Watch it *in action*", "Plug in, switch on, *hooked*", "See *every detail*"],
      chapters: ["Unboxing", "Setup", "Day to day"],
      quote: "Set up in two minutes. Now I use it every day.",
    },
  },
  kids: {
    fr: {
      titles: ["Leur réaction *parle d'elle-même*", "Le sourire, *en vrai*", "Regardez-les *l'adopter*"],
      chapters: ["La découverte", "Le jeu", "La réaction"],
      quote: "Elle ne le lâche plus depuis qu'il est arrivé.",
    },
    ar: {
      titles: ["ردّة فعلهم *تكفي*", "الابتسامة، *على حقيقتها*", "شاهدهم *يتعلّقون به*"],
      chapters: ["الاكتشاف", "اللعب", "ردّة الفعل"],
      quote: "من نهار وصل، ما بقاتش كتطلقو.",
    },
    en: {
      titles: ["Their reaction *says it all*", "The smile, *for real*", "Watch them *fall for it*"],
      chapters: ["First look", "Playtime", "The reaction"],
      quote: "She hasn't put it down since it arrived.",
    },
  },
  natural: {
    fr: {
      titles: ["La matière, *de près*", "De la source *à votre table*", "Regardez *la qualité*"],
      chapters: ["La matière", "La préparation", "Le résultat"],
      quote: "Le goût d'ici, et la qualité qu'on cherchait.",
    },
    ar: {
      titles: ["المنتج الأصلي، *على حقيقته*", "من المصدر *إلى مائدتك*", "شاهد *جودة المادة*"],
      chapters: ["المادة", "التحضير", "النتيجة"],
      quote: "طعم بلادنا، والجودة اللي كنا كنقلبو عليها.",
    },
    en: {
      titles: ["The real thing, *on camera*", "From the source *to your table*", "Look at *the quality*"],
      chapters: ["The raw material", "Preparation", "The result"],
      quote: "Tastes like home, the quality we were after.",
    },
  },
  general: {
    fr: {
      titles: ["Avant de commander, voyez-le *en vrai*", "Le produit, *tel qu'il arrive*", "Regardez-le *en action*"],
      chapters: ["Le déballage", "En main", "En action"],
      quote: "Reçu en 24 h, exactement comme dans la vidéo.",
    },
    ar: {
      titles: ["شاهده *على حقيقته* قبل أن تطلب", "المنتج، *كما سيصلك*", "شاهده *أثناء الاستعمال*"],
      chapters: ["فتح العلبة", "في اليد", "أثناء الاستعمال"],
      quote: "وصلني فـ 24 ساعة، بحال اللي فالفيديو بالضبط.",
    },
    en: {
      titles: ["See it *for real* before you order", "The product, *exactly as it arrives*", "Watch it *in action*"],
      chapters: ["Unboxing", "In hand", "In action"],
      quote: "Arrived in 24 h, exactly like in the video.",
    },
  },
};

export const COMMON: Tri<{ kickers: string[]; leads: string[]; captions: string[]; caption: string }> = {
  fr: {
    kickers: ["En action", "En vidéo", "La démo"],
    leads: [
      "Le produit exactement tel qu'il arrive chez vous, filmé de près.",
      "Observez chaque détail, puis commandez : vous vérifiez votre colis avant de payer.",
    ],
    captions: ["{short}, en action", "{short}, de près"],
    caption: "Le produit, en action",
  },
  ar: {
    kickers: ["بالفيديو", "بالصوت والصورة", "أثناء الاستعمال"],
    leads: ["المنتج كما سيصلك بالضبط، مصوَّر عن قرب.", "كل تفصيلة واضحة، ثم اطلب: تعاين طلبك قبل ما تخلّص."],
    captions: ["{short} أثناء الاستعمال", "{short} عن قرب"],
    caption: "المنتج أثناء الاستعمال",
  },
  en: {
    kickers: ["In action", "On video", "The demo"],
    leads: ["The product exactly as it arrives at your door, filmed up close.", "Every detail in plain sight. Order, then check your parcel before you pay."],
    captions: ["{short}, in action", "{short}, up close"],
    caption: "The product, in action",
  },
};

/** Sample creators (name, city); care & kids clips are usually filmed by women here. */
export const CREATORS: Tri<{ women: [string, string][]; men: [string, string][] }> = {
  fr: {
    women: [["Salma", "Agadir"], ["Imane", "Marrakech"], ["Kawtar", "Rabat"], ["Nadia", "Tétouan"]],
    men: [["Yassine", "Casablanca"], ["Hamza", "Tanger"], ["Mehdi", "Fès"]],
  },
  ar: {
    women: [["سلمى", "أكادير"], ["إيمان", "مراكش"], ["كوثر", "الرباط"], ["نادية", "تطوان"]],
    men: [["ياسين", "الدار البيضاء"], ["حمزة", "طنجة"], ["مهدي", "فاس"]],
  },
  en: {
    women: [["Salma", "Agadir"], ["Imane", "Marrakech"], ["Kawtar", "Rabat"], ["Nadia", "Tetouan"]],
    men: [["Yassine", "Casablanca"], ["Hamza", "Tangier"], ["Mehdi", "Fez"]],
  },
};

/** Player microcopy (accessible names and the small labels on the glass controls). */
export const UI: Tri<{
  video: string;
  play: string;
  sound: string;
  soundOff: string;
  soundOn: string;
  chapters: string;
}> = {
  fr: {
    video: "Vidéo : {name}",
    play: "Lecture",
    sound: "Son",
    soundOff: "Activer le son",
    soundOn: "Son activé",
    chapters: "Dans la vidéo",
  },
  ar: {
    video: "فيديو: {name}",
    play: "تشغيل",
    sound: "الصوت",
    soundOff: "شغّل الصوت",
    soundOn: "الصوت مفعّل",
    chapters: "في الفيديو",
  },
  en: {
    video: "Video: {name}",
    play: "Play",
    sound: "Sound",
    soundOff: "Tap for sound",
    soundOn: "Sound on",
    chapters: "In the video",
  },
};

/** Kickers that do not repeat a word of the given copy (no "En action" over "Regardez-le en action"). */
export function freshKickers(kickers: readonly string[], title: string): string[] {
  const t = title.toLowerCase();
  const out = kickers.filter((k) => !k.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && t.includes(w)));
  return out.length ? out : [...kickers];
}

/** Deterministic pick (rng from DefaultsInput). */
export function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
}

/** Short product name for captions: drops the size/format tail ("— 50 ml", "(x2)", ", 250 g"). */
export function shortName(name: string): string {
  const s = name.split(/\s[—–-]\s|\(|,|·|\|/)[0]!.trim() || name.trim();
  return s.length > 28 ? "" : s;
}
