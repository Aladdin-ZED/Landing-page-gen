/**
 * Shared proof copy (reviews, socialProof, beforeAfter defaults): Moroccan first names and cities,
 * product families, and sample review texts written per family in ar / fr / en.
 * Customer voices are written the way people actually write: Darija in Arabic script, plain warm
 * French, short English. Everything generated from here is sample content (data.sample = true) —
 * the admin replaces it with real reviews before publishing.
 */
import type { Locale, ProductCategory } from "@/lib/page/schema";
import type { Garment } from "../garment";

export type Lang = "ar" | "fr" | "en";
export type L3 = Record<Lang, string>;

/** Copy language for a page locale (other European locales use English until they get their own). */
export const langOf = (l: Locale): Lang => (l === "ar" || l === "fr" ? l : "en");

/** Deterministic Fisher–Yates with the defaults() rng. */
export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const pickOne = <T,>(list: readonly T[], rng: () => number): T => list[Math.floor(rng() * list.length) % list.length]!;

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export const PEOPLE: readonly L3[] = [
  { ar: "سلمى ب.", fr: "Salma B.", en: "Salma B." },
  { ar: "يوسف أ.", fr: "Youssef A.", en: "Youssef A." },
  { ar: "خديجة م.", fr: "Khadija M.", en: "Khadija M." },
  { ar: "إيمان ر.", fr: "Imane R.", en: "Imane R." },
  { ar: "حمزة إ.", fr: "Hamza E.", en: "Hamza E." },
  { ar: "نادية ت.", fr: "Nadia T.", en: "Nadia T." },
  { ar: "مريم ل.", fr: "Meryem L.", en: "Meryem L." },
  { ar: "عثمان ك.", fr: "Othmane K.", en: "Othmane K." },
  { ar: "سارة ز.", fr: "Sara Z.", en: "Sara Z." },
  { ar: "مهدي و.", fr: "Mehdi O.", en: "Mehdi O." },
  { ar: "هدى ف.", fr: "Houda F.", en: "Houda F." },
  { ar: "أنس ب.", fr: "Anas B.", en: "Anas B." },
];

/** PEOPLE indexes of women. */
export const WOMEN: readonly number[] = [0, 2, 3, 5, 6, 8, 10];

/**
 * Who voices a garment's sample proof: women's and girls' modest or prayer wear is reviewed by
 * women (mothers, for a girl's piece: "pour ma fille"), never by a man.
 */
export const womenOnly = (g: Garment | null): boolean => !!g && (g.modest || g.prayer || g.kids === "girl");

export const CITIES: readonly L3[] = [
  { ar: "الدار البيضاء", fr: "Casablanca", en: "Casablanca" },
  { ar: "الرباط", fr: "Rabat", en: "Rabat" },
  { ar: "مراكش", fr: "Marrakech", en: "Marrakesh" },
  { ar: "فاس", fr: "Fès", en: "Fez" },
  { ar: "طنجة", fr: "Tanger", en: "Tangier" },
  { ar: "أكادير", fr: "Agadir", en: "Agadir" },
  { ar: "مكناس", fr: "Meknès", en: "Meknes" },
  { ar: "وجدة", fr: "Oujda", en: "Oujda" },
  { ar: "القنيطرة", fr: "Kénitra", en: "Kenitra" },
  { ar: "تطوان", fr: "Tétouan", en: "Tetouan" },
  { ar: "الجديدة", fr: "El Jadida", en: "El Jadida" },
  { ar: "تمارة", fr: "Témara", en: "Temara" },
];

/** Display dates as merchants usually write them (free text in the data). */
export const WHEN: readonly L3[] = [
  { ar: "قبل يومين", fr: "Il y a 2 jours", en: "2 days ago" },
  { ar: "قبل 4 أيام", fr: "Il y a 4 jours", en: "4 days ago" },
  { ar: "الأسبوع الماضي", fr: "La semaine dernière", en: "Last week" },
  { ar: "قبل أسبوعين", fr: "Il y a 2 semaines", en: "2 weeks ago" },
  { ar: "قبل 3 أسابيع", fr: "Il y a 3 semaines", en: "3 weeks ago" },
  { ar: "الشهر الماضي", fr: "Le mois dernier", en: "Last month" },
];

/* ------------------------------------------------------------------ */
/* Product families                                                    */
/* ------------------------------------------------------------------ */

export type Family = "skin" | "hair" | "wellness" | "scent" | "style" | "body" | "home" | "tech" | "family" | "craft";

const FAMILY: Record<ProductCategory, Family> = {
  beauty: "skin",
  skincare: "skin",
  grooming: "skin",
  haircare: "hair",
  health: "wellness",
  supplements: "wellness",
  "organic-food": "wellness",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  fitness: "body",
  sport: "body",
  kitchen: "home",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  tech: "tech",
  gadgets: "tech",
  car: "tech",
  tools: "tech",
  kids: "family",
  toys: "family",
  pets: "family",
  traditional: "craft",
  other: "craft",
};

export const familyOf = (c: ProductCategory | undefined): Family => (c ? FAMILY[c] : undefined) ?? "craft";

/* ------------------------------------------------------------------ */
/* Review texts                                                        */
/* ------------------------------------------------------------------ */

export interface ReviewCopy {
  title: L3;
  text: L3;
  rating?: number;
}

const r = (title: L3, text: L3, rating?: number): ReviewCopy => ({ title, text, rating });

/** Delivery / COD experience — true for any product. */
export const UNIVERSAL_REVIEWS: readonly ReviewCopy[] = [
  r(
    { ar: "وصلني فـ 36 ساعة", fr: "Livré en 36 h", en: "Arrived in 36 hours" },
    {
      ar: "طلبت نهار الاثنين ووصلني الثلاثاء فالعشية. حليت الكولي قدام الموزع قبل ما نخلص، وكلشي كان مزيان.",
      fr: "Commandé le lundi, livré le mardi soir. J'ai ouvert le colis devant le livreur avant de payer\u00a0: tout était conforme.",
      en: "Ordered on Monday, delivered Tuesday evening. I opened the parcel in front of the courier before paying. Everything matched.",
    },
  ),
  r(
    { ar: "خدمة فالمستوى", fr: "Service sérieux", en: "Reliable service" },
    {
      ar: "عيطو ليا نفس النهار باش يأكدو العنوان، والموزع جا فالوقت. ما عندي ما نقول.",
      fr: "Appel de confirmation le jour même, livreur ponctuel et poli. Rien à redire.",
      en: "Confirmation call the same day, courier on time and polite. Nothing to fault.",
    },
  ),
  r(
    { ar: "طلبت مرة ثانية", fr: "Deuxième commande", en: "Ordered again" },
    {
      ar: "طلبت مرة ثانية لختي. نفس الجودة ديال المرة الأولى، والتغليف نقي.",
      fr: "J'ai recommandé pour ma sœur. Même qualité que la première fois, emballage soigné.",
      en: "Ordered again for my sister. Same quality as the first time, neat packaging.",
    },
    4,
  ),
];

export const FAMILY_REVIEWS: Record<Family, readonly ReviewCopy[]> = {
  skin: [
    r(
      { ar: "البشرة ولات رطبة", fr: "Peau plus souple", en: "Softer skin" },
      {
        ar: "كنستعملو صباح وعشية هادي 3 سيمانات. ما بقاش داك الشد من بعد الدوش، وكيتشرب بسرعة بلا دهون.",
        fr: "Matin et soir depuis trois semaines. Plus de tiraillements après la douche, et ça pénètre vite sans film gras.",
        en: "Morning and night for three weeks. No more tightness after the shower, and it sinks in fast with no greasy film.",
      },
    ),
    r(
      { ar: "شوية كافية", fr: "Une goutte suffit", en: "A little goes a long way" },
      {
        ar: "جوج نقط وصافي. فات شهر والقرعة باقا عامرة تقريبا، والريحة خفيفة.",
        fr: "Deux gouttes et c'est bon. Après un mois le flacon est encore presque plein, et l'odeur reste discrète.",
        en: "Two drops and you're done. A month in, the bottle is still nearly full and the scent stays subtle.",
      },
    ),
    r(
      { ar: "روتين الليل ديالي", fr: "Ma routine du soir", en: "My night routine" },
      {
        ar: "كنحطو قبل ما نعس، وفالصباح البشرة كتبان مرتاحة. دابا العائلة كاملة ولات كتسلفو مني.",
        fr: "Je l'applique avant de dormir, le matin la peau est reposée. Toute la famille me l'emprunte maintenant.",
        en: "I put it on before bed and wake up with rested skin. Now the whole family borrows it.",
      },
    ),
  ],
  hair: [
    r(
      { ar: "الشعر ولا رطب", fr: "Cheveux plus doux", en: "Softer hair" },
      {
        ar: "من بعد سيمانتين، الأطراف ولاو أقل يباس والبروشينغ كيبقى مدة أطول. كنحطو على الشعر وهو فازك.",
        fr: "Après deux semaines, les pointes sont moins sèches et le brushing tient plus longtemps. Je l'applique sur cheveux humides.",
        en: "Two weeks in, the ends are less dry and my blow-dry lasts longer. I apply it on damp hair.",
      },
    ),
    r(
      { ar: "الطيحان نقص", fr: "Moins de chute", en: "Less shedding" },
      {
        ar: "صراحة كان عندي شك، ولكن من بعد شهر الطيحان نقص بشكل واضح. غادي نكمل.",
        fr: "Honnêtement j'avais un doute, mais au bout d'un mois il y a clairement moins de cheveux sur la brosse. Je continue.",
        en: "I was skeptical, but after a month there's clearly less hair on the brush. I'm keeping it up.",
      },
    ),
    r(
      { ar: "خفيف وما كيدهنش", fr: "Léger, pas gras", en: "Light, never greasy" },
      {
        ar: "ما تقيلش وما كيدهنش الجذور. الشعر المجعد ديالي ولا مرسوم بلا ما يقسح.",
        fr: "Pas lourd, ne graisse pas les racines. Mes boucles sont enfin définies sans effet carton.",
        en: "Not heavy, doesn't grease the roots. My curls are finally defined without that crunchy feel.",
      },
    ),
  ],
  wellness: [
    r(
      { ar: "حسيت بالفرق", fr: "Je sens la différence", en: "I feel the difference" },
      {
        ar: "كناخدو كل صباح هادي 3 سيمانات. عندي طاقة كثر فالعشية، وما بقاش داك العيا.",
        fr: "Tous les matins depuis trois semaines. Plus d'énergie l'après-midi, sans le coup de barre de 15 h.",
        en: "Every morning for three weeks. More energy in the afternoon, no more 3 p.m. slump.",
      },
    ),
    r(
      { ar: "المذاق زوين", fr: "Agréable à prendre", en: "Easy to take" },
      {
        ar: "ماشي بحال اللي جربت من قبل. ساهل فالاستعمال، والعلبة كتكفي أكثر من شهر.",
        fr: "Rien à voir avec ceux que j'avais essayés avant. Facile à prendre, et la boîte dure plus d'un mois.",
        en: "Nothing like the ones I tried before. Easy to take, and one box lasts over a month.",
      },
    ),
    r(
      { ar: "مكونات واضحة", fr: "Composition claire", en: "Clear ingredients" },
      {
        ar: "المكونات مكتوبة بوضوح فالعلبة، بلا مفاجآت. خديت علبة ثانية للواليدة.",
        fr: "Les ingrédients sont lisibles sur l'étiquette, pas de surprise. J'en ai pris une deuxième pour ma mère.",
        en: "The label is easy to read, no surprises. I bought a second one for my mother.",
      },
    ),
  ],
  scent: [
    r(
      { ar: "كيبقى النهار كامل", fr: "Tient toute la journée", en: "Lasts all day" },
      {
        ar: "جوج بخات فالصباح، وفالعشية باقي كيشمو فيا. ريحة راقية وماشي تقيلة.",
        fr: "Deux vaporisations à 8 h, on le sentait encore le soir. Un sillage élégant, jamais envahissant.",
        en: "Two sprays at 8 a.m. and people still noticed it in the evening. An elegant trail, never overpowering.",
      },
    ),
    r(
      { ar: "الكل سولني عليه", fr: "On me demande son nom", en: "Everyone asks its name" },
      {
        ar: "تلاتة دالناس سولوني على سميتو فنفس النهار. القرعة تقيلة وزوينة بزاف.",
        fr: "Trois personnes m'ont demandé le nom du parfum dans la même journée. Flacon lourd, superbe sur la coiffeuse.",
        en: "Three people asked me its name on the same day. Heavy bottle, beautiful on the dresser.",
      },
    ),
    r(
      { ar: "هدية فالمستوى", fr: "Cadeau réussi", en: "The perfect gift" },
      {
        ar: "هديتو فعيد ميلاد، التغليف نقي والريحة دافية وناعمة. عجبها بزاف.",
        fr: "Offert pour un anniversaire\u00a0: emballage soigné, odeur chaude et enveloppante. Elle l'adore.",
        en: "A birthday present: neat packaging, a warm and soft scent. She loves it.",
      },
    ),
  ],
  style: [
    r(
      { ar: "التشطيب نقي", fr: "Finition impeccable", en: "Flawless finish" },
      {
        ar: "أحسن من التصاور. التفاصيل نقية، والعلبة كتصلح هدية.",
        fr: "Plus beau en vrai qu'en photo. Les détails sont propres, et la boîte fait déjà cadeau.",
        en: "Better in person than in the photos. Clean details, and the box is gift-ready.",
      },
    ),
    r(
      { ar: "كنلبسو كل نهار", fr: "Porté tous les jours", en: "Worn every day" },
      {
        ar: "فات شهر وما بان فيه حتى عيب. ديما كيسولوني منين شريتو.",
        fr: "Un mois plus tard, aucune trace d'usure. On me demande souvent où je l'ai trouvé.",
        en: "A month later, no sign of wear. People often ask where I got it.",
      },
    ),
    r(
      { ar: "المقاس مضبوط", fr: "Taille conforme", en: "True to size" },
      {
        ar: "كان عندي شك فالمقاس، ولكن جا مضبوط. وقالو ليا التبديل ممكن إلى احتجت، هادشي مطمّن.",
        fr: "J'avais un doute sur la taille, mais tout correspond au guide. Échange possible si besoin, c'est rassurant.",
        en: "I worried about the size, but it matches the guide. Exchange offered if needed, which is reassuring.",
      },
      4,
    ),
  ],
  body: [
    r(
      { ar: "ولا ضروري من بعد التمرين", fr: "Adopté après chaque séance", en: "A post-workout must" },
      {
        ar: "كنستعملو من بعد كل حصة رياضة. الوجع ديال الغد نقص بزاف.",
        fr: "Je l'utilise après chaque séance de sport. Les courbatures du lendemain sont nettement moins fortes.",
        en: "I use it after every workout. Next-day soreness is way down.",
      },
    ),
    r(
      { ar: "صحيح ومتين", fr: "Solide", en: "Built to last" },
      {
        ar: "شهر ديال الاستعمال تقريبا كل نهار وما تحرك فيه والو. وكيدخل فالساك بسهولة.",
        fr: "Un mois d'utilisation presque quotidienne et rien n'a bougé. Il se range facilement dans le sac.",
        en: "A month of near-daily use and nothing has budged. It slips easily into my bag.",
      },
    ),
    r(
      { ar: "ظهري ارتاح", fr: "Mon dos dit merci", en: "My back says thanks" },
      {
        ar: "من بعد 8 سوايع ديال المكتب، 10 دقايق كافية باش يرتاح الظهر.",
        fr: "Après huit heures au bureau, dix minutes et le haut du dos se détend.",
        en: "After eight hours at a desk, ten minutes and my upper back lets go.",
      },
    ),
  ],
  home: [
    r(
      { ar: "وفر عليا الوقت", fr: "Un vrai gain de temps", en: "Saves me time" },
      {
        ar: "اللي كان كياخد ليا 20 دقيقة ولا كيدوز فـ 5. ساهل فالتنقية، تحت الما وصافي.",
        fr: "Ce qui me prenait vingt minutes se fait en cinq. Facile à nettoyer\u00a0: un coup d'eau et c'est fini.",
        en: "What took twenty minutes now takes five. Easy to clean: a quick rinse and done.",
      },
    ),
    r(
      { ar: "مصاوب مزيان", fr: "Bien pensé", en: "Well thought out" },
      {
        ar: "صغير وكيدخل فالبلاكار. المادة صحيحة وماشي رخيصة.",
        fr: "Compact, il trouve sa place dans le placard. Les matériaux sont solides, rien de cheap.",
        en: "Compact, it fits in the cupboard. Solid materials, nothing cheap about it.",
      },
    ),
    r(
      { ar: "العائلة كاملة كتستعملو", fr: "Toute la famille s'y est mise", en: "The whole family uses it" },
      {
        ar: "حتى الدراري ولاو كيستعملوه. فات شهر ديال الاستعمال اليومي وباقي جديد.",
        fr: "Même les enfants l'utilisent. Après un mois d'usage quotidien, il est comme neuf.",
        en: "Even the kids use it now. A month of daily use and it's like new.",
      },
    ),
  ],
  tech: [
    r(
      { ar: "خدام من أول مرة", fr: "Prêt en deux minutes", en: "Ready in two minutes" },
      {
        ar: "ركبتو فدقيقتين، بلا تطبيقات معقدة. كيخدم بحال ما قالو.",
        fr: "Installé en deux minutes, sans application compliquée. Il fait exactement ce qui est annoncé.",
        en: "Set up in two minutes, no complicated app. It does exactly what it says.",
      },
    ),
    r(
      { ar: "الباطري قوية", fr: "Batterie endurante", en: "Battery that lasts" },
      {
        ar: "شارجة وحدة كتكفيني بزاف دالأيام. التشطيب نقي، ماشي بحال اللعب.",
        fr: "Une charge me tient plusieurs jours. Finition propre, ça ne fait pas jouet.",
        en: "One charge lasts me several days. Clean finish, doesn't feel like a toy.",
      },
    ),
    r(
      { ar: "بحال الوصف بالضبط", fr: "Conforme à la description", en: "Exactly as described" },
      {
        ar: "جربتو قدام الموزع قبل ما نخلص، كلشي اللي مكتوب كاين. بلا مفاجآت.",
        fr: "Testé devant le livreur avant de payer\u00a0: tout ce qui est annoncé est là. Aucune mauvaise surprise.",
        en: "Tested it in front of the courier before paying: everything advertised is there. No bad surprises.",
      },
    ),
  ],
  family: [
    r(
      { ar: "الدراري عجبهم بزاف", fr: "Les enfants adorent", en: "The kids love it" },
      {
        ar: "هادي سيمانة وهما كيلعبو بيه بلا ما يملو. المادة قوية وما فيهاش ريحة.",
        fr: "Une semaine qu'ils jouent avec sans se lasser. Les matériaux sont solides et sans odeur.",
        en: "A week in and they're still not bored. Sturdy materials, no smell.",
      },
    ),
    r(
      { ar: "مطمّن", fr: "Rassurant", en: "Reassuring" },
      {
        ar: "الحواشي مدورين وما فيه والو اللي يجرح. كنخليهم يلعبو بلا خوف.",
        fr: "Les bords sont arrondis, rien qui pique. Je les laisse jouer sans m'inquiéter.",
        en: "Rounded edges, nothing sharp. I let them play without worrying.",
      },
    ),
    r(
      { ar: "ولا المفضل من النهار الأول", fr: "Adopté dès le premier jour", en: "A favorite from day one" },
      {
        ar: "من أول نهار ولا هو المفضل. وزيادة على هادشي ساهل فالغسيل.",
        fr: "Dès le premier jour, c'est devenu le préféré. Et en plus, il se lave facilement.",
        en: "It became the favorite on day one. And it washes easily, too.",
      },
    ),
  ],
  craft: [
    r(
      { ar: "الجودة كاينة", fr: "La qualité est là", en: "Quality you can feel" },
      {
        ar: "بحال التصاور بالضبط، ويمكن حسن. باينة فيه الخدمة النقية.",
        fr: "Exactement comme sur les photos, peut-être même mieux. On sent le travail soigné.",
        en: "Exactly like the photos, maybe better. You can feel the careful work.",
      },
    ),
    r(
      { ar: "كننصح بيه بلا تردد", fr: "Je recommande les yeux fermés", en: "Recommend without hesitation" },
      {
        ar: "هادي ثاني مرة كنشري منهم: نفس الجودة ونفس الاحترام فالتيليفون.",
        fr: "Deuxième achat chez eux\u00a0: même qualité, même gentillesse au téléphone.",
        en: "My second purchase from them: same quality, same kindness on the phone.",
      },
    ),
    r(
      { ar: "الثمن مناسب", fr: "Excellent rapport qualité-prix", en: "Great value" },
      {
        ar: "بهاد الثمن ما كنتش كنتسنى هاد الجودة. والتوصيل كان سريع.",
        fr: "À ce prix, je ne m'attendais pas à une telle finition. Livraison rapide en plus.",
        en: "At this price I didn't expect this finish. Fast delivery, too.",
      },
      4,
    ),
  ],
};

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts): fabric, size, prayer or finishing         */
/* ------------------------------------------------------------------ */

const GARMENT_FABRIC = r(
  { ar: "القماش ناعم بزاف", fr: "Tissu très doux", en: "Really soft fabric" },
  {
    ar: "القماش ناعم وما كيسخنش. بحال التصاور بالضبط، حتى اللون هو هو.",
    fr: "Le tissu est très doux et ne tient pas chaud. Exactement comme sur les photos, même la couleur.",
    en: "The fabric is really soft and doesn't get hot. Exactly like the photos, colour included.",
  },
);

const GARMENT_SIZE = r(
  { ar: "المقاس مضبوط", fr: "Taille conforme", en: "True to size" },
  {
    ar: "كان عندي شك فالمقاس، عيطو ليا قبل ما يصيفطو وراجعناه مع بعض. جا مضبوط.",
    fr: "J'hésitais sur la taille : appel avant l'envoi pour la revoir ensemble, et elle est parfaite.",
    en: "I wasn't sure about the size: they called before shipping to go over it with me. Spot on.",
  },
);

const GARMENT_FINISH = r(
  { ar: "الخياطة نقية", fr: "Finitions propres", en: "Clean finishing" },
  {
    ar: "غسلتها جوج مرات وبقات كيف هي، حتى خيط ما تحل.",
    fr: "Deux lavages plus tard, rien n'a bougé : pas un fil qui dépasse.",
    en: "Two washes later, nothing has changed: not a single loose thread.",
  },
  4,
);

const GARMENT_PRAYER: Record<"self" | "girl" | "boy" | "child", L3> = {
  self: {
    ar: "واسعة ومريحة، فالسجود ما كترتفعش. وليت ما كنصلي غير بيها.",
    fr: "Ample et confortable, rien ne remonte pendant la prière. Je ne prie plus avec autre chose.",
    en: "Loose and comfortable, nothing rides up during prayer. I don't pray in anything else now.",
  },
  girl: {
    ar: "واسعة ومريحة، فالسجود ما كترتفعش. بنتي ولات ما كتصلي غير بيها.",
    fr: "Ample et confortable, rien ne remonte pendant la prière. Ma fille ne veut plus prier avec autre chose.",
    en: "Loose and comfortable, nothing rides up during prayer. My daughter won't pray in anything else now.",
  },
  boy: {
    ar: "واسعة ومريحة، فالسجود ما كترتفعش. ولدي ولا ما كيصلي غير بيها.",
    fr: "Ample et confortable, rien ne remonte pendant la prière. Mon fils ne veut plus prier avec autre chose.",
    en: "Loose and comfortable, nothing rides up during prayer. My son won't pray in anything else now.",
  },
  child: {
    ar: "واسعة ومريحة، فالسجود ما كترتفعش. الدراري ولاو ما كيصليو غير بيها.",
    fr: "Ample et confortable, rien ne remonte pendant la prière. Les enfants ne veulent plus prier avec autre chose.",
    en: "Loose and comfortable, nothing rides up during prayer. The kids won't pray in anything else now.",
  },
};

/** Sample reviews of a garment: the fabric, the size, then prayer comfort (prayer wear) or finishing. */
export function garmentReviews(g: Garment): readonly ReviewCopy[] {
  const prayer = g.prayer
    ? [r({ ar: "مريحة فالصلاة", fr: "Parfaite pour la prière", en: "Perfect for prayer" }, GARMENT_PRAYER[g.kids ?? "self"])]
    : [GARMENT_FINISH];
  return [GARMENT_FABRIC, GARMENT_SIZE, ...prayer];
}
