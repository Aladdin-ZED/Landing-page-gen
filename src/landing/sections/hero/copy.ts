/**
 * Hero copy library — product-aware default copy (ar · fr · en) per category family, plus the
 * section's own microcopy. Copy rules (docs/DESIGN.md §8): short, sensory, concrete; no banned
 * words; no exclamation marks; Arabic in clear MSA (Darija stays in the shared CTA microcopy), never
 * letter-spaced.
 * Claims stay on usage and feel — never invented performance numbers.
 */
import type { Locale, ProductCategory } from "@/lib/page/schema";
import type { Garment } from "../garment";

export type CopyLocale = "ar" | "fr" | "en";
export const copyLocale = (l: Locale): CopyLocale => (l === "ar" || l === "fr" ? l : "en");

export type Family = "skin" | "scent" | "style" | "wellness" | "sport" | "home" | "play" | "tech" | "terroir" | "other";

const FAMILY_OF: Record<ProductCategory, Family> = {
  beauty: "skin",
  skincare: "skin",
  haircare: "skin",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  health: "wellness",
  supplements: "wellness",
  fitness: "sport",
  sport: "sport",
  kitchen: "home",
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
  grooming: "tech",
  "organic-food": "terroir",
  traditional: "terroir",
  other: "other",
};

export const familyOf = (c: ProductCategory): Family => FAMILY_OF[c] ?? "other";

export interface Note {
  title: string;
  detail: string;
}

interface FamilyCopy {
  titles: [string, string, string];
  subs: [string, string];
  notes: [Note, Note, Note];
  /** editorial masthead line (edition · topic) */
  issue: string;
}

const n = (title: string, detail: string): Note => ({ title, detail });

const FR: Record<Family, FamilyCopy> = {
  skin: {
    titles: ["Une peau *nourrie* qui se voit, et qui se sent.", "Une *douceur* qu'on sent dès le premier geste.", "Quelques gouttes, et votre peau *respire*."],
    subs: [
      "Une texture qui pénètre vite, sans film gras. À glisser dans votre routine du soir.",
      "Pensé pour les peaux qui tirent, brillent ou fatiguent. Un geste simple, matin et soir.",
    ],
    notes: [n("Quelques gouttes suffisent", "Un flacon qui dure"), n("Matin & soir", "Un geste de 30 secondes"), n("Toucher sec", "Sans film gras")],
    issue: "Édition 01 · Soin",
  },
  scent: {
    titles: ["Un sillage qu'on vous *demande*.", "Le parfum qui reste *après vous*.", "Une signature, *pas* une tendance."],
    subs: [
      "Des notes chaudes qui s'installent sur la peau et évoluent au fil de la journée.",
      "Deux pulvérisations au creux du cou. Le reste, c'est votre peau qui le raconte.",
    ],
    notes: [n("2 pulvérisations", "Au creux du cou"), n("Sur la peau", "Il évolue avec vous"), n("Un cadeau qui marque", "Pour elle, pour lui")],
    issue: "Édition 01 · Parfum",
  },
  style: {
    titles: ["Le détail qu'on *remarque* en premier.", "Simple à porter, *difficile* à oublier.", "Votre tenue, *finie*."],
    subs: ["Une pièce qui va avec tout : au bureau, au mariage, le week-end.", "Pensé pour être porté tous les jours, et regardé de près."],
    notes: [n("Va avec tout", "Du jean au caftan"), n("Tous les jours", "Pas seulement les grands soirs"), n("Idée cadeau", "Elle ne s'y attend pas")],
    issue: "Édition 01 · Style",
  },
  wellness: {
    titles: ["Un petit geste, *chaque* jour.", "Prenez soin de vous, *simplement*.", "Votre routine bien-être, *sans* prise de tête."],
    subs: ["Facile à intégrer au quotidien, à la maison comme au travail.", "Un rituel simple qui trouve sa place entre le café et le reste de la journée."],
    notes: [n("Facile à prendre", "Maison ou bureau"), n("Chaque jour", "Une habitude, pas une corvée"), n("Format pratique", "Dans le sac, partout")],
    issue: "Édition 01 · Bien-être",
  },
  sport: {
    titles: ["Vos muscles vont vous *remercier*.", "Récupérez mieux, *repartez* plus fort.", "La séance est finie. La *récup* commence."],
    subs: [
      "Après l'entraînement, au bureau ou devant la télé : quelques minutes pour relâcher les tensions.",
      "Pensé pour ceux qui bougent : léger, simple, prêt dès la sortie de la boîte.",
    ],
    notes: [n("Après l'effort", "Quelques minutes suffisent"), n("Léger", "Tient dans le sac de sport"), n("Au bureau aussi", "Nuque, dos, épaules")],
    issue: "Édition 01 · Récupération",
  },
  home: {
    titles: ["Moins de corvées, plus de *temps* pour vous.", "Le quotidien, *en plus simple*.", "Votre maison va *l'adopter*."],
    subs: ["Pratique, facile à nettoyer et pensé pour les vraies journées : celles où tout va vite.", "Un petit objet qui change la routine de toute la maison."],
    notes: [n("Facile à nettoyer", "Un rinçage et c'est fini"), n("Compact", "Trouve sa place partout"), n("Pour toute la famille", "Simple à utiliser")],
    issue: "Édition 01 · Maison",
  },
  play: {
    titles: ["Ils vont *adorer*. Vous aussi.", "Le meilleur moment de *leur* journée.", "Celui qu'ils ne *lâchent* plus."],
    subs: ["Pensé pour jouer longtemps, et pour les parents qui veulent souffler un peu.", "Simple, coloré et solide : de quoi occuper les après-midi."],
    notes: [n("Des heures de jeu", "Dedans comme dehors"), n("Facile à ranger", "Fini le désordre"), n("Idée cadeau", "Anniversaire, Aïd, sans raison")],
    issue: "Édition 01 · Famille",
  },
  tech: {
    titles: ["Le petit appareil qui *change* tout.", "Branchez, *profitez*. C'est tout.", "Ce qui manquait à votre *quotidien*."],
    subs: ["Simple à prendre en main, sans notice de 40 pages. Prêt à servir dès la livraison.", "Pensé pour la maison, la voiture et tout ce qui se trouve entre les deux."],
    notes: [n("Prise en main immédiate", "Aucun réglage compliqué"), n("Compact", "Se range partout"), n("Au quotidien", "Maison, bureau, voiture")],
    issue: "Édition 01 · Tech",
  },
  terroir: {
    titles: ["Le goût *d'ici*, livré chez vous.", "Comme chez *grand-mère*, en mieux rangé.", "Du terroir à votre *table*."],
    subs: ["Choisi avec soin, préparé comme il faut, envoyé partout au Maroc.", "Une recette qu'on connaît depuis toujours, dans un format qui voyage bien."],
    notes: [n("Goût authentique", "Comme on l'aime"), n("À partager", "En famille, au ftour"), n("Idée cadeau", "Pour ceux qui sont loin")],
    issue: "Édition 01 · Terroir",
  },
  other: {
    titles: ["Celui qu'on vous *envie* déjà.", "Simple, utile, *bien fait*.", "Vous vous demanderez comment vous faisiez *avant*."],
    subs: ["Un achat malin, livré chez vous en 24–48h. Vous payez à la réception.", "Pensé pour durer et pour servir tous les jours."],
    notes: [n("Utile chaque jour", "Pas un gadget de tiroir"), n("Bien fini", "Ça se voit de près"), n("Idée cadeau", "Ça fait toujours plaisir")],
    issue: "Édition 01 · Sélection",
  },
};

const AR: Record<Family, FamilyCopy> = {
  skin: {
    titles: ["بشرة *مُغذّاة* تراها وتلمسها", "*نعومة* تُلمس من أول استعمال", "قطرات قليلة، وبشرتك *تتنفّس*"],
    subs: [
      "تركيبة خفيفة تتغلغل بسرعة دون أثر دهني. أضيفيها إلى روتينك المسائي.",
      "لبشرة تشدّ أو تلمع أو تبدو متعبة. خطوة بسيطة، صباحًا ومساءً.",
    ],
    notes: [n("قطرات قليلة تكفي", "القارورة تدوم طويلًا"), n("صباحًا ومساءً", "خطوة في 30 ثانية"), n("لمسة جافة", "بلا أثر دهني")],
    issue: "الإصدار 01 · العناية",
  },
  scent: {
    titles: ["عطر *يسألونك* عنه", "أثرٌ يبقى *بعدك*", "توقيعك أنت، *لا* موضة عابرة"],
    subs: ["نوتات دافئة تستقر على البشرة وتتطوّر مع ساعات النهار.", "رشّتان على العنق، والباقي تحكيه بشرتك."],
    notes: [n("رشّتان تكفيان", "على العنق"), n("على البشرة", "يتطوّر معك"), n("هدية لا تُنسى", "لها أو له")],
    issue: "الإصدار 01 · العطور",
  },
  style: {
    titles: ["التفصيل الذي *يُلاحَظ* أولًا", "سهل الارتداء، *صعب* النسيان", "إطلالتك، *مكتملة*"],
    subs: ["قطعة تناسب كل شيء: العمل، الأعراس، وعطلة نهاية الأسبوع.", "مصممة لتُلبس كل يوم، وتُرى عن قرب."],
    notes: [n("تناسب كل شيء", "من الجينز إلى القفطان"), n("كل يوم", "لا للمناسبات فقط"), n("فكرة هدية", "مفاجأة لا تتوقعها")],
    issue: "الإصدار 01 · الأناقة",
  },
  wellness: {
    titles: ["عادة صغيرة، *كل* يوم", "اعتنِ بنفسك *ببساطة*", "روتين راحتك، *بلا* تعقيد"],
    subs: ["سهل الإدماج في يومك، في البيت أو في العمل.", "طقس بسيط يجد مكانه بين قهوة الصباح وبقية اليوم."],
    notes: [n("سهل الاستعمال", "في البيت أو العمل"), n("كل يوم", "عادة لا عبء"), n("حجم عملي", "في حقيبتك أينما ذهبت")],
    issue: "الإصدار 01 · الراحة",
  },
  sport: {
    titles: ["عضلاتك *ستشكرك*", "استرجع جيدًا، *وعُد* أقوى", "انتهى التمرين. *بدأت* الراحة"],
    subs: [
      "بعد التمرين، في المكتب أو أمام التلفاز: دقائق قليلة لإرخاء العضلات.",
      "مصمم لمن يتحرك: خفيف، بسيط، وجاهز من أول ما تفتح العلبة.",
    ],
    notes: [n("بعد المجهود", "دقائق قليلة تكفي"), n("خفيف", "يدخل في حقيبة الرياضة"), n("حتى في المكتب", "الرقبة، الظهر، الكتفان")],
    issue: "الإصدار 01 · الاسترجاع",
  },
  home: {
    titles: ["تعب أقل، *وقت* أكثر لك", "يومك، *أبسط*", "بيتك *سيحبّه*"],
    subs: ["عملي، سهل التنظيف ومصمم للأيام الحقيقية: تلك التي يجري فيها كل شيء بسرعة.", "قطعة صغيرة تغيّر روتين البيت كله."],
    notes: [n("سهل التنظيف", "شطفة ماء وانتهى"), n("صغير الحجم", "يجد مكانه في كل زاوية"), n("لكل العائلة", "سهل الاستعمال")],
    issue: "الإصدار 01 · البيت",
  },
  play: {
    titles: ["سيحبّونه، *وأنت* أيضًا", "أجمل لحظة في *يومهم*", "اللعبة التي *لن* يتركوها"],
    subs: ["مصمم للعب طويلًا، وللوالدين الذين يحتاجون قليلًا من الراحة.", "بسيط وملوّن ومتين: أمسيات مليئة باللعب."],
    notes: [n("ساعات من اللعب", "داخل البيت وخارجه"), n("سهل الترتيب", "وداعًا للفوضى"), n("فكرة هدية", "عيد ميلاد، العيد، أو بلا مناسبة")],
    issue: "الإصدار 01 · العائلة",
  },
  tech: {
    titles: ["الجهاز الصغير الذي *يغيّر* يومك", "شغّله *واستمتع*. هذا كل شيء", "ما كان *ينقص* يومك"],
    subs: ["سهل من أول استعمال، بلا دليل من 40 صفحة. جاهز للعمل يوم وصوله.", "مصمم للبيت والسيارة وكل ما بينهما."],
    notes: [n("جاهز من أول مرة", "بلا إعدادات معقدة"), n("صغير الحجم", "يُخزَّن في أي مكان"), n("كل يوم", "البيت، العمل، السيارة")],
    issue: "الإصدار 01 · التقنية",
  },
  terroir: {
    titles: ["طعم *بلادنا*، حتى باب بيتك", "كما تصنعه *الجدّة*، في علبة أنيقة", "من الأرض إلى *مائدتك*"],
    subs: ["مختار بعناية، محضّر كما يجب، ويصل إلى جميع مدن المغرب.", "وصفة نعرفها منذ زمن، في عبوة تسافر جيدًا."],
    notes: [n("طعم أصيل", "كما نحبّه"), n("للمشاركة", "مع العائلة، على الفطور"), n("فكرة هدية", "لمن هم بعيدون عنّا")],
    issue: "الإصدار 01 · البلدي",
  },
  other: {
    titles: ["الذي *سيغبطونك* عليه", "بسيط، مفيد، *متقن* الصنع", "ستتساءل كيف كنت *بدونه*"],
    subs: ["اختيار ذكي يصلك خلال 24–48 ساعة، وتدفع عند الاستلام.", "مصنوع ليدوم ويخدمك كل يوم."],
    notes: [n("مفيد كل يوم", "ليس مجرد أداة في الدرج"), n("صنع متقن", "يظهر عن قرب"), n("فكرة هدية", "تُفرح دائمًا")],
    issue: "الإصدار 01 · مختارات",
  },
};

const EN: Record<Family, FamilyCopy> = {
  skin: {
    titles: ["Skin that looks *fed*, and feels it.", "*Softness* you feel from the first touch.", "A few drops, and your skin *breathes*."],
    subs: ["Sinks in fast, no greasy film. Slip it into your evening routine.", "Made for skin that feels tight, shiny or tired. One simple step, morning and night."],
    notes: [n("A few drops is enough", "One bottle lasts"), n("Morning & night", "A 30-second step"), n("Dry touch", "No greasy film")],
    issue: "Edition 01 · Skincare",
  },
  scent: {
    titles: ["The trail people *ask* about.", "A scent that stays *after you*.", "A signature, *not* a trend."],
    subs: ["Warm notes that settle on the skin and shift through the day.", "Two sprays at the neck. Your skin tells the rest."],
    notes: [n("2 sprays", "At the neck"), n("On skin", "It changes with you"), n("A gift that stays", "For her, for him")],
    issue: "Edition 01 · Fragrance",
  },
  style: {
    titles: ["The detail people *notice* first.", "Easy to wear, *hard* to forget.", "Your outfit, *finished*."],
    subs: ["A piece that goes with everything: office, wedding, weekend.", "Made to be worn daily, and looked at closely."],
    notes: [n("Goes with everything", "Jeans to evening wear"), n("Every day", "Not just special nights"), n("Gift idea", "She won't see it coming")],
    issue: "Edition 01 · Style",
  },
  wellness: {
    titles: ["A small habit, *every* day.", "Look after yourself, *simply*.", "Your wellness routine, *without* the fuss."],
    subs: ["Easy to fit into your day, at home or at work.", "A simple ritual that fits between coffee and everything else."],
    notes: [n("Easy to take", "Home or office"), n("Every day", "A habit, not a chore"), n("Handy format", "In your bag, anywhere")],
    issue: "Edition 01 · Wellness",
  },
  sport: {
    titles: ["Your muscles will *thank* you.", "Recover well, *come back* stronger.", "Session's over. *Recovery* starts."],
    subs: ["After training, at the desk or on the sofa: a few minutes to release the tension.", "Made for people who move: light, simple, ready out of the box."],
    notes: [n("After the effort", "A few minutes is enough"), n("Light", "Fits in your gym bag"), n("At the desk too", "Neck, back, shoulders")],
    issue: "Edition 01 · Recovery",
  },
  home: {
    titles: ["Less hassle, more *time* for you.", "Everyday life, *made simpler*.", "Your home will *love* it."],
    subs: ["Practical, easy to clean, made for real days: the busy ones.", "A small thing that changes the whole household routine."],
    notes: [n("Easy to clean", "A quick rinse and done"), n("Compact", "Fits anywhere"), n("For the whole family", "Simple to use")],
    issue: "Edition 01 · Home",
  },
  play: {
    titles: ["They'll *love* it. So will you.", "The best part of *their* day.", "The one they *won't* put down."],
    subs: ["Made for long play, and for parents who need a breather.", "Simple, colorful, sturdy: afternoons, sorted."],
    notes: [n("Hours of play", "Indoors or out"), n("Easy to tidy", "No more mess"), n("Gift idea", "Birthdays, Eid, just because")],
    issue: "Edition 01 · Family",
  },
  tech: {
    titles: ["The small device that *changes* everything.", "Plug in, *enjoy*. That's it.", "What your *day* was missing."],
    subs: ["Easy to pick up, no 40-page manual. Ready the day it arrives.", "Made for the home, the car and everything in between."],
    notes: [n("Instant setup", "No fiddly settings"), n("Compact", "Stores anywhere"), n("Every day", "Home, office, car")],
    issue: "Edition 01 · Tech",
  },
  terroir: {
    titles: ["The taste of *home*, delivered.", "Like *grandma's*, only tidier.", "From the land to your *table*."],
    subs: ["Carefully chosen, properly prepared, shipped across Morocco.", "A recipe we've always known, in a format that travels well."],
    notes: [n("Authentic taste", "Just how we like it"), n("Made to share", "Family breakfast, ftour"), n("Gift idea", "For loved ones far away")],
    issue: "Edition 01 · Pantry",
  },
  other: {
    titles: ["The one they'll *envy*.", "Simple, useful, *well made*.", "You'll wonder how you managed *before*."],
    subs: ["A smart buy, delivered in 24–48h. You pay on delivery.", "Made to last and to be used every day."],
    notes: [n("Useful every day", "Not a drawer gadget"), n("Well finished", "Shows up close"), n("Gift idea", "Always welcome")],
    issue: "Edition 01 · Selection",
  },
};

const LIB: Record<CopyLocale, Record<Family, FamilyCopy>> = { ar: AR, fr: FR, en: EN };

export function familyCopy(locale: Locale, family: Family): FamilyCopy {
  return LIB[copyLocale(locale)][family];
}

/** Section microcopy not covered by the shared UI dictionary. */
const MICRO = {
  fr: {
    packs: "En pack",
    pack: "Pack",
    fig: "Fig. 01",
    ref: "Réf.",
    gallery: "Photos du produit",
    thumb: "Voir la photo {n}",
    choose: "Choisissez votre pack",
    unit: "l'unité",
    outOf: "/5",
    off: "de remise",
    onPack: "en pack ×{qty}",
  },
  ar: {
    packs: "في العروض",
    pack: "عرض",
    fig: "شكل 01",
    ref: "المرجع",
    gallery: "صور المنتج",
    thumb: "عرض الصورة {n}",
    choose: "اختر عرضك",
    unit: "للقطعة",
    outOf: "/5",
    off: "تخفيض",
    onPack: "في عرض ×{qty}",
  },
  en: {
    packs: "In packs",
    pack: "Pack",
    fig: "Fig. 01",
    ref: "Ref.",
    gallery: "Product photos",
    thumb: "Show photo {n}",
    choose: "Choose your pack",
    unit: "each",
    outOf: "/5",
    off: "off",
    onPack: "on the ×{qty} pack",
  },
} as const;

export type MicroKey = keyof (typeof MICRO)["fr"];

export function micro(locale: Locale, key: MicroKey, vars?: Record<string, string | number>): string {
  const s: string = MICRO[copyLocale(locale)][key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/* ------------------------------------------------------------------ */
/* Big word                                                            */
/* ------------------------------------------------------------------ */

const STOP = new Set([
  "de", "du", "des", "la", "le", "les", "et", "au", "aux", "pour", "avec", "en", "à", "a", "the", "of", "and", "for", "with", "eau",
]);

const longest = (list: string[]): string | undefined =>
  list.reduce<string | undefined>((best, w) => (!best || w.length > best.length ? w : best), undefined);

/**
 * The giant background word of the stage/poster heroes: the product's brand-like word when its name
 * has one (a capitalized Latin word after the first: "Pulse", "FreshGo", "Ambre"), else its longest
 * real word ("الأركان", "العنبر").
 */
export function bigWordOf(name: string): string {
  const words = name
    .replace(/[—–\-/|()·,.:;!?"«»،؛؟]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[ldLD]['’]/, ""))
    // Arabic clitics glued to the article ("بالدانتيل", "للبنات", "والعسل"): the noun itself
    // ("الدانتيل", "البنات", "العسل"), never "with the lace" set as a giant graphic
    .map((w) => w.replace(/^لل(?=\p{L}{3})/u, "ال").replace(/^[بوف](?=ال\p{L}{3})/u, ""))
    .filter((w) => w.length >= 3 && !/\d/.test(w) && !STOP.has(w.toLowerCase()));
  const brand = longest(words.slice(1).filter((w) => /^[A-Z][A-Za-z]{2,11}$/.test(w)));
  const pick = brand ?? longest(words) ?? name.trim().split(/\s+/)[0] ?? "";
  return pick.slice(0, 14);
}

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts)                                            */
/* ------------------------------------------------------------------ */

type GarmentVoice = "prayer" | "modest" | "heritage" | "plain";

interface GarmentHeroCopy {
  voices: Record<GarmentVoice, FamilyCopy>;
  /** third note for children: the size, chosen by age */
  kidsNote: Note;
  /** a child's prayer outfit: replaces the third title */
  kidsPrayer: (who: NonNullable<Garment["kids"]>) => string;
}

const GARMENT_HERO: Record<CopyLocale, GarmentHeroCopy> = {
  fr: {
    voices: {
      prayer: {
        titles: ["Ample et douce, *pensée* pour la prière.", "Cinq prières, *une seule* tenue.", "La pudeur, en *toute douceur*."],
        subs: ["Une coupe ample et couvrante, un tissu doux qui respire.", "Couvrante sans gêner, du premier au dernier mouvement."],
        notes: [n("Ample et couvrante", "Libre à chaque mouvement"), n("Tissu doux", "Il respire, il ne colle pas"), n("Taille confirmée", "Revue avec vous avant l'envoi")],
        issue: "Édition 01 · Prière",
      },
      modest: {
        titles: ["Couvrir, *sans encombrer*.", "Ample, douce, *facile* à vivre.", "La pudeur, en *toute douceur*."],
        subs: ["Une coupe ample et couvrante, un tissu doux qui respire.", "Une pièce qu'on porte du matin au soir, sans y penser."],
        notes: [n("Ample et couvrante", "Libre de bouger"), n("Tissu doux", "Il respire, il ne colle pas"), n("Taille confirmée", "Revue avec vous avant l'envoi")],
        issue: "Édition 01 · Essentiels",
      },
      heritage: {
        titles: ["La tradition, *portée* aujourd'hui.", "Une pièce de fête, *facile* à porter.", "Les lignes d'hier, *l'aisance* d'aujourd'hui."],
        subs: ["Les détails de la tradition, dans une coupe facile à vivre.", "Pour les fêtes, les vendredis en famille, et tous les autres jours."],
        notes: [n("Détails soignés", "À regarder de près"), n("Coupe facile", "Elle se porte sans effort"), n("Taille confirmée", "Revue avec vous avant l'envoi")],
        issue: "Édition 01 · Tradition",
      },
      plain: {
        titles: ["Un tissu qui se *ressent*.", "Simple à porter, *juste* dans la coupe.", "Votre pièce de *tous les jours*."],
        subs: ["Un tissu doux, une coupe qui tombe juste, des finitions qui tiennent au lavage.", "La pièce qu'on enfile le matin sans y penser, et qu'on garde."],
        notes: [n("Tissu doux", "Agréable toute la journée"), n("Coupe juste", "Ni trop large, ni trop près"), n("Taille confirmée", "Revue avec vous avant l'envoi")],
        issue: "Édition 01 · Garde-robe",
      },
    },
    kidsNote: n("La bonne taille", "Choisie selon l'âge"),
    kidsPrayer: (who) => (who === "boy" ? "Sa tenue de prière, *tout en douceur*." : "Sa tenue de prière, *toute douce*."),
  },
  ar: {
    voices: {
      prayer: {
        titles: ["واسعة وناعمة، *مصمَّمة* للصلاة", "خمس صلوات، *ولباس واحد*", "الحشمة *بكل نعومة*"],
        subs: ["قصّة واسعة وساترة، وقماش ناعم يتنفّس.", "ساترة دون أن تزعج، من أول حركة إلى آخرها."],
        notes: [n("واسعة وساترة", "حرية في كل حركة"), n("قماش ناعم", "يتنفّس ولا يلتصق"), n("مقاس مؤكَّد", "نراجعه معك قبل الإرسال")],
        issue: "الإصدار 01 · الصلاة",
      },
      modest: {
        titles: ["الستر *بلا تكلّف*", "واسعة وناعمة *وسهلة* في يومك", "الحشمة *بكل نعومة*"],
        subs: ["قصّة واسعة وساترة، وقماش ناعم يتنفّس.", "قطعة تلبسها من الصباح إلى المساء دون تفكير."],
        notes: [n("واسعة وساترة", "حرية في الحركة"), n("قماش ناعم", "يتنفّس ولا يلتصق"), n("مقاس مؤكَّد", "نراجعه معك قبل الإرسال")],
        issue: "الإصدار 01 · الأساسيات",
      },
      heritage: {
        titles: ["التقليد *بلباس اليوم*", "قطعة للمناسبات، *سهلة* اللبس", "خطوط الأمس، *وراحة* اليوم"],
        subs: ["تفاصيل التقليد، بقصّة سهلة في يومك.", "للأعراس، لجمعة العائلة، ولباقي الأيام."],
        notes: [n("تفاصيل متقنة", "تظهر عن قرب"), n("قصّة سهلة", "تُلبس دون عناء"), n("مقاس مؤكَّد", "نراجعه معك قبل الإرسال")],
        issue: "الإصدار 01 · التقليد",
      },
      plain: {
        titles: ["قماش *تحسّ* به", "سهلة اللبس، *مضبوطة* القصّة", "قطعتك *لكل يوم*"],
        subs: ["قماش ناعم، قصّة تنسدل جيدًا، وتشطيب يصمد أمام الغسيل.", "القطعة التي تلبسها صباحًا دون تفكير، وتحتفظ بها طويلًا."],
        notes: [n("قماش ناعم", "مريح طوال اليوم"), n("قصّة مضبوطة", "لا واسعة ولا ضيّقة"), n("مقاس مؤكَّد", "نراجعه معك قبل الإرسال")],
        issue: "الإصدار 01 · الخزانة",
      },
    },
    kidsNote: n("المقاس المناسب", "حسب العمر"),
    kidsPrayer: (who) => (who === "girl" ? "لباس صلاتها، *بكل نعومة*" : who === "boy" ? "لباس صلاته، *بكل نعومة*" : "لباس صلاة الصغار، *بكل نعومة*"),
  },
  en: {
    voices: {
      prayer: {
        titles: ["Loose and soft, *made* for prayer.", "Five prayers, *one* outfit.", "Modesty, *softly* done."],
        subs: ["A loose, covering cut in a soft fabric that breathes.", "Covering without getting in the way, from the first move to the last."],
        notes: [n("Loose and covering", "Free in every move"), n("Soft fabric", "Breathes, never clings"), n("Size confirmed", "Checked with you before shipping")],
        issue: "Edition 01 · Prayer",
      },
      modest: {
        titles: ["Covered, *never* weighed down.", "Loose, soft, *easy* to live in.", "Modesty, *softly* done."],
        subs: ["A loose, covering cut in a soft fabric that breathes.", "A piece you wear from morning to night without a thought."],
        notes: [n("Loose and covering", "Free to move"), n("Soft fabric", "Breathes, never clings"), n("Size confirmed", "Checked with you before shipping")],
        issue: "Edition 01 · Essentials",
      },
      heritage: {
        titles: ["Tradition, *worn* today.", "A piece for celebrations, *easy* to wear.", "Yesterday's lines, today's *ease*."],
        subs: ["Traditional details in a cut that's easy to live in.", "For weddings, family Fridays, and every other day."],
        notes: [n("Careful details", "Seen up close"), n("Easy cut", "Worn without effort"), n("Size confirmed", "Checked with you before shipping")],
        issue: "Edition 01 · Tradition",
      },
      plain: {
        titles: ["A fabric you can *feel*.", "Easy to wear, *right* in the cut.", "Your *everyday* piece."],
        subs: ["Soft fabric, a cut that falls right, finishing that survives the wash.", "The piece you put on without thinking, and keep."],
        notes: [n("Soft fabric", "Comfortable all day"), n("Right cut", "Not too loose, not too close"), n("Size confirmed", "Checked with you before shipping")],
        issue: "Edition 01 · Wardrobe",
      },
    },
    kidsNote: n("The right size", "Chosen by age"),
    kidsPrayer: (who) => (who === "girl" ? "Her prayer outfit, *ever so soft*." : who === "boy" ? "His prayer outfit, *ever so soft*." : "Their prayer outfit, *ever so soft*."),
  },
};

/** Hero copy for a garment: prayer, modest, heritage or everyday voice; children get a size-by-age note. */
export function garmentHero(locale: Locale, g: Garment): FamilyCopy {
  const c = GARMENT_HERO[copyLocale(locale)];
  const voice: GarmentVoice = g.prayer ? "prayer" : g.modest ? "modest" : g.heritage ? "heritage" : "plain";
  const base = c.voices[voice];
  if (!g.kids) return base;
  const [a, b] = base.titles;
  return {
    ...base,
    titles: [a, b, g.prayer ? c.kidsPrayer(g.kids) : base.titles[2]],
    notes: [base.notes[0], base.notes[1], c.kidsNote],
  };
}
