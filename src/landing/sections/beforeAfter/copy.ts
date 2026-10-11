/**
 * Default copy for the before/after section, written per product family in ar / fr / en.
 * Before/after is MERCHANT PROOF: every default is a sample (data.sample = true) that the admin
 * replaces with the customer's real photos and words before publishing.
 * Each family tells one concrete change in three moments (before → a middle step → after); the
 * `when` tags stay short so they read as the nodes of the timeline and the tags over the photos.
 */
import type { Locale, ProductCategory } from "@/lib/page/schema";

export type Lang = "ar" | "fr" | "en";
export type L3 = Record<Lang, string>;

export const langOf = (l: Locale): Lang =>
  l === "ar" || l === "fr" ? l : "en";

/** Before/after stories: categories that share the same kind of change. */
export type BaFamily =
  | "skin"
  | "hair"
  | "body"
  | "kitchen"
  | "clean"
  | "home"
  | "scent"
  | "style"
  | "tech"
  | "kids"
  | "general";

const FAMILY: Record<ProductCategory, BaFamily> = {
  beauty: "skin",
  skincare: "skin",
  grooming: "skin",
  haircare: "hair",
  fitness: "body",
  sport: "body",
  kitchen: "kitchen",
  cleaning: "clean",
  car: "clean",
  home: "home",
  decor: "home",
  garden: "home",
  fragrance: "scent",
  jewelry: "style",
  watches: "style",
  fashion: "style",
  bags: "style",
  tech: "tech",
  gadgets: "tech",
  tools: "tech",
  kids: "kids",
  toys: "kids",
  pets: "kids",
  health: "general",
  supplements: "general",
  "organic-food": "general",
  traditional: "general",
  other: "general",
};

export const baFamilyOf = (c: ProductCategory | undefined): BaFamily =>
  (c ? FAMILY[c] : undefined) ?? "general";

/** Families whose story is about a person's own results (credited to a woman by default). */
export const PERSONAL: ReadonlySet<BaFamily> = new Set<BaFamily>([
  "skin",
  "hair",
  "scent",
]);

interface Moment {
  when: string;
  caption: string;
}

export interface FamilyCopy {
  titles: readonly string[];
  lead: string;
  before: Moment & { label?: string };
  stage: Moment;
  after: Moment & { label?: string };
  results: readonly string[];
  /** which disclaimer fits: results that vary per person, or results of normal use */
  note: "people" | "use";
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export const COMMON: Record<
  Lang,
  {
    kickers: readonly string[];
    before: string;
    after: string;
    notes: Record<FamilyCopy["note"], string>;
  }
> = {
  fr: {
    kickers: ["Avant / après", "Le résultat", "La différence"],
    before: "Avant",
    after: "Après",
    notes: {
      people: "Résultats individuels : ils varient d'une personne à l'autre.",
      use: "Résultat obtenu en conditions normales d'utilisation.",
    },
  },
  ar: {
    kickers: ["قبل / بعد", "النتيجة", "الفرق"],
    before: "قبل",
    after: "بعد",
    notes: {
      people: "النتائج فردية وتختلف من شخص لآخر.",
      use: "نتيجة مُحقَّقة في ظروف استعمال عادية.",
    },
  },
  en: {
    kickers: ["Before / after", "The result", "The difference"],
    before: "Before",
    after: "After",
    notes: {
      people: "Individual results: they vary from person to person.",
      use: "Result obtained under normal use.",
    },
  },
};

/** Interface strings (not editable): the knob word, accessible names and the credit line. */
export const UI: Record<
  Lang,
  {
    /** one word inside the slider knob while it introduces itself */
    knob: string;
    /** accessible name of the compare control */
    range: string;
    /** accessible name of the result list */
    results: string;
    /** small line above the customer credit */
    credit: string;
  }
> = {
  fr: {
    knob: "Glissez",
    range: "Comparer avant et après",
    results: "Ce qui change",
    credit: "Photos de",
  },
  ar: {
    knob: "اسحب",
    range: "قارن بين قبل وبعد",
    results: "ما الذي يتغيّر",
    credit: "صور من",
  },
  en: {
    knob: "Drag",
    range: "Compare before and after",
    results: "What changes",
    credit: "Photos from",
  },
};

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

export const FAMILIES: Record<BaFamily, Record<Lang, FamilyCopy>> = {
  skin: {
    fr: {
      titles: [
        "Le même visage, *quatre semaines après*",
        "Une différence qui se voit *à l'œil nu*",
      ],
      lead: "Une routine simple, matin et soir. Voici ce qu'elle change sur la peau.",
      before: {
        when: "Jour 1",
        caption: "Teint terne, zones sèches autour du nez.",
      },
      stage: {
        when: "Jour 14",
        caption: "Le grain de peau s'affine, moins de tiraillements.",
      },
      after: {
        when: "Jour 28",
        caption: "Peau souple, éclat uniforme, même sans maquillage.",
      },
      results: [
        "Teint plus lumineux",
        "Peau plus souple",
        "Moins de zones sèches",
      ],
      note: "people",
    },
    ar: {
      titles: ["نفس الوجه، بعد *أربعة أسابيع*", "فرق *يُرى بالعين*"],
      lead: "روتين بسيط صباحًا ومساءً، وهذا ما يتغيّر في البشرة.",
      before: {
        when: "اليوم الأول",
        caption: "بشرة باهتة وجفاف خفيف حول الأنف.",
      },
      stage: { when: "اليوم 14", caption: "ملمس أنعم وإحساس أقل بالشدّ." },
      after: {
        when: "اليوم 28",
        caption: "بشرة ليّنة وإشراقة متجانسة، حتى بدون مكياج.",
      },
      results: ["إشراقة أوضح", "بشرة أنعم", "جفاف أقل"],
      note: "people",
    },
    en: {
      titles: ["Same face, *four weeks later*", "A difference you can *see*"],
      lead: "A simple routine, morning and night. Here's what it changes on skin.",
      before: {
        when: "Day 1",
        caption: "Dull tone, dry patches around the nose.",
      },
      stage: { when: "Day 14", caption: "Smoother texture, less tightness." },
      after: {
        when: "Day 28",
        caption: "Supple skin and an even glow, even without makeup.",
      },
      results: ["Brighter tone", "Softer skin", "Fewer dry patches"],
      note: "people",
    },
  },
  hair: {
    fr: {
      titles: [
        "Des cheveux qui *reprennent vie*",
        "Du frisottis à la *brillance*",
      ],
      lead: "Quelques gouttes sur les longueurs, deux fois par semaine.",
      before: {
        when: "Jour 1",
        caption: "Pointes sèches, frisottis dès qu'il fait humide.",
      },
      stage: {
        when: "Semaine 2",
        caption: "Les longueurs se démêlent plus facilement.",
      },
      after: {
        when: "Semaine 4",
        caption: "Cheveux souples et brillants, pointes nourries.",
      },
      results: ["Moins de frisottis", "Brillance visible", "Démêlage facile"],
      note: "people",
    },
    ar: {
      titles: ["شعر *يستعيد حيويته*", "من التجعّد إلى *اللمعان*"],
      lead: "قطرات قليلة على الأطراف، مرتين في الأسبوع.",
      before: {
        when: "اليوم الأول",
        caption: "أطراف جافة وتجعّد مع أي رطوبة.",
      },
      stage: { when: "الأسبوع 2", caption: "تسريح أسهل للأطراف." },
      after: { when: "الأسبوع 4", caption: "شعر ناعم ولامع، وأطراف مغذّاة." },
      results: ["تجعّد أقل", "لمعان واضح", "تسريح سهل"],
      note: "people",
    },
    en: {
      titles: ["Hair that *comes back to life*", "From frizz to *shine*"],
      lead: "A few drops on the lengths, twice a week.",
      before: {
        when: "Day 1",
        caption: "Dry ends, frizz at the first hint of humidity.",
      },
      stage: { when: "Week 2", caption: "The lengths detangle more easily." },
      after: {
        when: "Week 4",
        caption: "Soft, glossy hair with nourished ends.",
      },
      results: ["Less frizz", "Visible shine", "Easy detangling"],
      note: "people",
    },
  },
  body: {
    fr: {
      titles: [
        "Dix minutes pour *repartir léger*",
        "Après l'effort, *le relâchement*",
      ],
      lead: "Avant et après une récupération ciblée, sur les mêmes muscles.",
      before: {
        when: "Après l'effort",
        caption: "Épaules nouées, amplitude réduite.",
      },
      stage: {
        when: "5 min",
        caption: "Les tensions se relâchent, le muscle se réchauffe.",
      },
      after: {
        when: "10 min",
        caption: "Mouvement fluide, prêt pour la séance suivante.",
      },
      results: [
        "Muscles détendus",
        "Amplitude retrouvée",
        "Récupération plus rapide",
      ],
      note: "people",
    },
    ar: {
      titles: ["عشر دقائق *لتستعيد خفّتك*", "بعد التمرين، *راحة العضلات*"],
      lead: "قبل وبعد استرجاع مركّز، على نفس العضلات.",
      before: { when: "بعد التمرين", caption: "أكتاف مشدودة وحركة محدودة." },
      stage: { when: "5 دقائق", caption: "التوتر يرتخي والعضلة تسترجع دفأها." },
      after: { when: "10 دقائق", caption: "حركة سلسة، وجاهز للحصة التالية." },
      results: ["عضلات مرتاحة", "حركة أوسع", "استرجاع أسرع"],
      note: "people",
    },
    en: {
      titles: [
        "Ten minutes to *feel loose again*",
        "After training, *the release*",
      ],
      lead: "Before and after targeted recovery, on the same muscles.",
      before: {
        when: "After training",
        caption: "Knotted shoulders, limited range.",
      },
      stage: { when: "5 min", caption: "Tension eases, the muscle warms up." },
      after: {
        when: "10 min",
        caption: "Fluid movement, ready for the next session.",
      },
      results: ["Relaxed muscles", "Range of motion back", "Faster recovery"],
      note: "people",
    },
  },
  kitchen: {
    fr: {
      titles: [
        "Des fruits entiers au smoothie en *40 secondes*",
        "Du panier au verre, *sans détour*",
      ],
      lead: "Pas de gros blender à sortir, pas de vaisselle : tout se passe dans la gourde.",
      before: {
        when: "0 s",
        caption: "Fraises, banane et un trait de lait, entiers.",
      },
      stage: {
        when: "20 s",
        caption: "Les fruits se brisent, la texture s'épaissit.",
      },
      after: {
        when: "40 s",
        caption: "Un smoothie lisse, prêt à boire, sans morceaux.",
      },
      results: ["Lisse en 40 s", "Zéro vaisselle", "À emporter partout"],
      note: "use",
    },
    ar: {
      titles: [
        "من فواكه كاملة إلى عصير في *40 ثانية*",
        "من السلة إلى الكأس *مباشرة*",
      ],
      lead: "لا خلاط كبير ولا أواني للغسل: كل شيء يحدث داخل القارورة.",
      before: {
        when: "0 ثانية",
        caption: "فراولة وموز وقليل من الحليب، كما هي.",
      },
      stage: { when: "20 ثانية", caption: "الفواكه تتفتّت والقوام يتماسك." },
      after: { when: "40 ثانية", caption: "عصير ناعم جاهز للشرب، بلا قطع." },
      results: ["ناعم في 40 ثانية", "بلا أواني", "معك أينما ذهبت"],
      note: "use",
    },
    en: {
      titles: [
        "Whole fruit to smoothie in *40 seconds*",
        "From basket to glass, *no detours*",
      ],
      lead: "No big blender to haul out, no washing up: it all happens in the bottle.",
      before: {
        when: "0 s",
        caption: "Strawberries, banana and a splash of milk, whole.",
      },
      stage: {
        when: "20 s",
        caption: "The fruit breaks down, the texture thickens.",
      },
      after: {
        when: "40 s",
        caption: "A smooth drink, ready to sip, no chunks.",
      },
      results: ["Smooth in 40 s", "Zero washing up", "Goes wherever you go"],
      note: "use",
    },
  },
  clean: {
    fr: {
      titles: [
        "Un passage, et *tout change*",
        "La même surface, après *un seul passage*",
      ],
      lead: "Sans frotter pendant des heures : on applique, on laisse agir, on essuie.",
      before: { when: "0 min", caption: "Traces grasses et dépôts incrustés." },
      stage: {
        when: "2 min",
        caption: "Le produit agit, les dépôts se détachent.",
      },
      after: {
        when: "5 min",
        caption: "Surface nette et brillante, sans rayure.",
      },
      results: ["Sans frotter fort", "Sans rayer", "Brillance immédiate"],
      note: "use",
    },
    ar: {
      titles: ["مسحة واحدة، و*كل شيء يتغيّر*", "نفس السطح، بعد *مسحة واحدة*"],
      lead: "بلا فرك لساعات: ضع المنتج، اتركه قليلًا، ثم امسح.",
      before: { when: "0 دقيقة", caption: "بقع دهنية وترسّبات عالقة." },
      stage: { when: "دقيقتان", caption: "المنتج يعمل والترسّبات تنفصل." },
      after: { when: "5 دقائق", caption: "سطح نظيف ولامع، بلا خدوش." },
      results: ["بلا فرك قوي", "بلا خدوش", "لمعان فوري"],
      note: "use",
    },
    en: {
      titles: [
        "One pass, and *everything changes*",
        "Same surface, after *a single pass*",
      ],
      lead: "No hours of scrubbing: apply, let it work, wipe.",
      before: { when: "0 min", caption: "Greasy marks and baked-on deposits." },
      stage: {
        when: "2 min",
        caption: "The product works, deposits lift away.",
      },
      after: {
        when: "5 min",
        caption: "A clean, glossy surface, no scratches.",
      },
      results: ["No hard scrubbing", "No scratches", "Instant shine"],
      note: "use",
    },
  },
  home: {
    fr: {
      titles: [
        "La même pièce, *une autre ambiance*",
        "Un détail, et la pièce *respire*",
      ],
      lead: "Installé en quelques minutes, sans outils ni travaux.",
      before: {
        when: "Samedi matin",
        caption: "Un coin vide, une lumière plate.",
      },
      stage: { when: "10 min", caption: "Installation, sans perçage." },
      after: {
        when: "Le soir même",
        caption: "Une pièce chaleureuse où l'on a envie de rester.",
      },
      results: ["Installé en 10 min", "Sans travaux", "Ambiance chaleureuse"],
      note: "use",
    },
    ar: {
      titles: ["نفس الغرفة، *بأجواء مختلفة*", "تفصيل واحد، والغرفة *تتنفّس*"],
      lead: "يُركَّب في دقائق، بلا أدوات ولا أشغال.",
      before: { when: "صباح السبت", caption: "زاوية فارغة وإضاءة باهتة." },
      stage: { when: "10 دقائق", caption: "تركيب سريع، بلا ثقب." },
      after: { when: "نفس المساء", caption: "غرفة دافئة تحب أن تبقى فيها." },
      results: ["تركيب في 10 دقائق", "بلا أشغال", "أجواء دافئة"],
      note: "use",
    },
    en: {
      titles: [
        "Same room, *a whole new mood*",
        "One detail, and the room *breathes*",
      ],
      lead: "Set up in minutes: no tools, no renovation.",
      before: {
        when: "Saturday morning",
        caption: "An empty corner, flat light.",
      },
      stage: { when: "10 min", caption: "Set up, no drilling." },
      after: {
        when: "That evening",
        caption: "A warm room you want to stay in.",
      },
      results: ["10-minute setup", "No renovation", "Warm atmosphere"],
      note: "use",
    },
  },
  scent: {
    fr: {
      titles: [
        "Vaporisé à 8 h, *encore là à 20 h*",
        "Un sillage qui *tient la journée*",
      ],
      lead: "Deux vaporisations au creux du cou. Voici comment le parfum évolue sur la peau.",
      before: {
        label: "Le matin",
        when: "8 h",
        caption: "Notes de tête : bergamote, éclat frais.",
      },
      stage: {
        when: "14 h",
        caption: "Le cœur s'ouvre : rose et épices douces.",
      },
      after: {
        label: "Le soir",
        when: "20 h",
        caption: "Fond ambré, chaud, toujours perceptible.",
      },
      results: ["12 h de tenue", "Sillage discret", "Fond ambré chaleureux"],
      note: "people",
    },
    ar: {
      titles: ["رشّة في الصباح، *وحاضرة في المساء*", "أثر *يدوم طوال اليوم*"],
      lead: "رشّتان على العنق، وهكذا يتطوّر العطر على البشرة.",
      before: {
        label: "صباحًا",
        when: "الثامنة صباحًا",
        caption: "المقدمة: برغموت ونفحة منعشة.",
      },
      stage: {
        when: "الثانية ظهرًا",
        caption: "القلب يتفتّح: ورد وتوابل ناعمة.",
      },
      after: {
        label: "مساءً",
        when: "الثامنة مساءً",
        caption: "قاعدة عنبرية دافئة، ما زالت واضحة.",
      },
      results: ["ثبات 12 ساعة", "أثر هادئ", "قاعدة عنبرية دافئة"],
      note: "people",
    },
    en: {
      titles: [
        "Sprayed at 8 am, *still there at 8 pm*",
        "A trail that *lasts the day*",
      ],
      lead: "Two sprays at the neck. Here's how the scent evolves on skin.",
      before: {
        label: "Morning",
        when: "8 am",
        caption: "Top notes: bergamot, a fresh burst.",
      },
      stage: { when: "2 pm", caption: "The heart opens: rose and soft spice." },
      after: {
        label: "Evening",
        when: "8 pm",
        caption: "A warm amber base, still noticeable.",
      },
      results: ["12-hour wear", "Soft trail", "Warm amber base"],
      note: "people",
    },
  },
  style: {
    fr: {
      titles: [
        "La même tenue, *une autre allure*",
        "Le détail qui *change tout*",
      ],
      lead: "Rien d'autre n'a changé : même tenue, même lumière.",
      before: {
        label: "Sans",
        when: "",
        caption: "Une base sobre, un peu trop sage.",
      },
      stage: { when: "2 s", caption: "Un geste, et c'est en place." },
      after: {
        label: "Avec",
        when: "",
        caption: "La même base, avec du caractère.",
      },
      results: ["Allure immédiate", "Se porte avec tout", "Finition soignée"],
      note: "use",
    },
    ar: {
      titles: ["نفس اللباس، *بإطلالة أخرى*", "التفصيل الذي *يغيّر كل شيء*"],
      lead: "لم يتغيّر شيء آخر: نفس اللباس ونفس الإضاءة.",
      before: {
        label: "بدونه",
        when: "",
        caption: "إطلالة بسيطة، هادئة أكثر من اللازم.",
      },
      stage: { when: "ثانيتان", caption: "حركة واحدة، وكل شيء في مكانه." },
      after: { label: "معه", when: "", caption: "نفس الإطلالة، بشخصية واضحة." },
      results: ["أناقة فورية", "يناسب كل لباس", "لمسة متقنة"],
      note: "use",
    },
    en: {
      titles: [
        "Same outfit, *a different presence*",
        "The detail that *changes everything*",
      ],
      lead: "Nothing else changed: same outfit, same light.",
      before: {
        label: "Without",
        when: "",
        caption: "A plain base, a little too quiet.",
      },
      stage: { when: "2 s", caption: "One move, and it's on." },
      after: {
        label: "With",
        when: "",
        caption: "The same base, now with character.",
      },
      results: ["Instant presence", "Goes with everything", "Refined finish"],
      note: "use",
    },
  },
  tech: {
    fr: {
      titles: [
        "Le même quotidien, *en plus simple*",
        "Ce qui change *dès le premier jour*",
      ],
      lead: "On l'a mis à l'épreuve d'une vraie semaine. Voici le résultat.",
      before: {
        when: "Jour 1",
        caption: "Câbles, manipulations, temps perdu.",
      },
      stage: {
        when: "Jour 3",
        caption: "Les réglages sont faits, les gestes deviennent automatiques.",
      },
      after: {
        when: "Jour 7",
        caption: "Tout est à portée de main, en un geste.",
      },
      results: [
        "Prise en main immédiate",
        "Moins d'encombrement",
        "Du temps gagné",
      ],
      note: "use",
    },
    ar: {
      titles: ["نفس اليوم، *بشكل أبسط*", "ما يتغيّر *من اليوم الأول*"],
      lead: "جرّبناه طيلة أسبوع عادي، وهذه هي النتيجة.",
      before: { when: "اليوم الأول", caption: "أسلاك ومحاولات ووقت ضائع." },
      stage: {
        when: "اليوم 3",
        caption: "الإعدادات جاهزة والاستعمال يصبح تلقائيًا.",
      },
      after: {
        when: "اليوم 7",
        caption: "كل شيء في متناول اليد، بحركة واحدة.",
      },
      results: ["سهل من أول استعمال", "فوضى أقل", "وقت أكثر لك"],
      note: "use",
    },
    en: {
      titles: ["The same day, *made simpler*", "What changes *from day one*"],
      lead: "We put it through a real week. Here's the result.",
      before: { when: "Day 1", caption: "Cables, fiddling, wasted time." },
      stage: {
        when: "Day 3",
        caption: "Settings done, it becomes second nature.",
      },
      after: {
        when: "Day 7",
        caption: "Everything within reach, in one move.",
      },
      results: ["Easy from the start", "Less clutter", "Time saved"],
      note: "use",
    },
  },
  kids: {
    fr: {
      titles: [
        "À la maison, des journées *plus calmes*",
        "Ce qui a changé *à la maison*",
      ],
      lead: "Le quotidien, avant et après son arrivée à la maison.",
      before: {
        when: "Jour 1",
        caption: "Jouets éparpillés, attention qui s'envole.",
      },
      stage: { when: "Jour 3", caption: "Il le réclame déjà, chaque matin." },
      after: {
        when: "Jour 10",
        caption: "Un moment calme et concentré, qui dure.",
      },
      results: ["Plus de calme", "Moins d'écrans", "Rangé en une minute"],
      note: "use",
    },
    ar: {
      titles: ["في البيت، أيام *أهدأ*", "ما الذي تغيّر *في البيت*"],
      lead: "الحياة اليومية، قبل وبعد وصوله إلى البيت.",
      before: {
        when: "اليوم الأول",
        caption: "ألعاب متناثرة وانتباه سريع الضياع.",
      },
      stage: { when: "اليوم 3", caption: "صار يطلبه كل صباح." },
      after: { when: "اليوم 10", caption: "لحظة هادئة ومركّزة، تدوم." },
      results: ["هدوء أكثر", "شاشات أقل", "ترتيب في دقيقة"],
      note: "use",
    },
    en: {
      titles: ["At home, *calmer days*", "What changed *at home*"],
      lead: "Everyday life, before and after it arrived at home.",
      before: {
        when: "Day 1",
        caption: "Toys everywhere, attention drifting.",
      },
      stage: { when: "Day 3", caption: "Already asking for it every morning." },
      after: { when: "Day 10", caption: "A calm, focused moment that lasts." },
      results: ["More calm", "Less screen time", "Tidied in a minute"],
      note: "use",
    },
  },
  general: {
    fr: {
      titles: [
        "La différence, *en une image*",
        "Avant, après : *jugez vous-même*",
      ],
      lead: "Même angle, même lumière : seule la routine a changé.",
      before: { when: "Jour 1", caption: "Le point de départ, sans filtre." },
      stage: {
        when: "Jour 7",
        caption: "Les premiers changements se remarquent.",
      },
      after: {
        when: "Jour 21",
        caption: "Un résultat net, qui se voit au quotidien.",
      },
      results: ["Résultat visible", "Simple à utiliser", "Au quotidien"],
      note: "people",
    },
    ar: {
      titles: ["الفرق *في صورة واحدة*", "قبل وبعد: *احكم بنفسك*"],
      lead: "نفس الزاوية ونفس الإضاءة: الروتين وحده تغيّر.",
      before: { when: "اليوم الأول", caption: "نقطة البداية، بلا فلتر." },
      stage: { when: "اليوم 7", caption: "أولى التغييرات تظهر." },
      after: { when: "اليوم 21", caption: "نتيجة واضحة تلاحظها كل يوم." },
      results: ["نتيجة واضحة", "سهل الاستعمال", "كل يوم"],
      note: "people",
    },
    en: {
      titles: [
        "The difference, *in one picture*",
        "Before, after: *see for yourself*",
      ],
      lead: "Same angle, same light: only the routine changed.",
      before: { when: "Day 1", caption: "The starting point, no filter." },
      stage: { when: "Day 7", caption: "The first changes show." },
      after: {
        when: "Day 21",
        caption: "A clear result you notice every day.",
      },
      results: ["Visible result", "Easy to use", "Every day"],
      note: "people",
    },
  },
};
