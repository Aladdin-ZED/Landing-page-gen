/**
 * Default copy for the showcase section, per product family and language.
 *   points       product details for hotspots / exploded: [label, text, x%, y%] (x/y = spot on the photo)
 *   ingredients  what it is made of: [name, origin, share, text, art, icon] — art = a Leaf line icon,
 *                or "icon" to use the custom icon (materials)
 *   size         dimensions: height & width for the drawing, spec figures, a scale reference
 * Facts are typical for the category: the section ships with sample: true until the merchant has
 * checked them against the real product.
 */
import type { CopyLang, Family, IconName, Tri } from "../benefits/kit";
import { typo } from "../benefits/copy";
import type { Garment } from "../garment";
import type { Art } from "./schema";

export type PointRow = readonly [label: string, text: string, x: number, y: number];
export type IngredientRow = readonly [name: string, origin: string, share: string, text: string, art: Art, icon: IconName];

export interface SizeCopy {
  height: string;
  width: string;
  specs: readonly (readonly [label: string, value: string])[];
  note: string;
}

export interface FamilyCopy {
  points: readonly PointRow[];
  ingredients: readonly IngredientRow[];
  size: SizeCopy;
}

export interface CommonCopy {
  kickers: readonly string[];
  titles: readonly string[];
  leads: readonly string[];
  /** screen-reader names of the two dimension lines */
  heightLabel: string;
  widthLabel: string;
}

export const COMMON: Tri<CommonCopy> = {
  fr: {
    kickers: ["De près", "Dans le détail", "Fiche produit"],
    titles: ["Regardez-le *de près*", "Chaque détail *a sa raison*", "Ce que vous tenez *en main*"],
    leads: [
      "Ce qui ne se voit pas sur une photo de loin, expliqué point par point.",
      "Chaque choix de fabrication, et ce qu'il change pour vous au quotidien.",
    ],
    heightLabel: "Hauteur",
    widthLabel: "Largeur",
  },
  ar: {
    kickers: ["عن قرب", "بالتفصيل", "بطاقة المنتج"],
    titles: ["تأمّله *عن قرب*", "لكل تفصيل *سببه*", "ما ستحمله *بين يديك*"],
    leads: ["ما لا تُظهره صورة من بعيد، نشرحه لك نقطة بنقطة.", "كل اختيار في صنعه، وما يغيّره في استعمالك اليومي."],
    heightLabel: "الطول",
    widthLabel: "العرض",
  },
  en: {
    kickers: ["Up close", "In detail", "Product sheet"],
    titles: ["Take a *closer look*", "Every detail *has a reason*", "What you'll hold *in your hand*"],
    leads: ["What a photo from afar won't show you, explained point by point.", "Every making choice, and what it changes in your day."],
    heightLabel: "Height",
    widthLabel: "Width",
  },
};

/** What the ingredients board lists — drives the caption chip on the product photo. */
type CaptionKind = "ingredients" | "notes" | "materials" | "safe";

const CAPTION_KIND: Record<Family, CaptionKind> = {
  care: "ingredients",
  natural: "ingredients",
  scent: "notes",
  kids: "safe",
  style: "materials",
  active: "materials",
  home: "materials",
  tech: "materials",
  general: "materials",
};

/** Arabic counted nouns: dual for 2, plural for 3–10 (the list holds 2–6 items). */
const CAPTIONS: Tri<Record<CaptionKind, (n: number) => string>> = {
  fr: {
    ingredients: (n) => `${n} ingrédients, rien d'autre`,
    notes: (n) => `${n} notes, un seul sillage`,
    materials: (n) => `${n} matières choisies pour durer`,
    safe: (n) => `${n} matières sûres pour eux`,
  },
  ar: {
    ingredients: (n) => (n === 2 ? "مكوّنان فقط، لا شيء غيرهما" : `${n} مكونات فقط، لا شيء غيرها`),
    notes: (n) => (n === 2 ? "نفحتان، وأثر واحد" : `${n} نفحات، وأثر واحد`),
    materials: (n) => (n === 2 ? "مادّتان مختارتان لتدوما" : `${n} مواد مختارة لتدوم`),
    safe: (n) => (n === 2 ? "مادّتان آمنتان لأطفالك" : `${n} مواد آمنة لأطفالك`),
  },
  en: {
    ingredients: (n) => `${n} ingredients, nothing else`,
    notes: (n) => `${n} notes, one trail`,
    materials: (n) => `${n} materials chosen to last`,
    safe: (n) => `${n} materials safe for little ones`,
  },
};

/** Default caption of the product photo on the ingredients board. */
export function captionFor(lang: CopyLang, family: Family, count: number): string {
  return CAPTIONS[lang][CAPTION_KIND[family]](count);
}

export const FAMILY_COPY: Record<Family, Tri<FamilyCopy>> = {
  care: {
    fr: {
      points: [
        ["Pipette en verre", "La dose exacte : trois gouttes, sans gaspiller ni graisser le flacon.", 52, 16],
        ["Verre ambré", "Il protège l'huile de la lumière : elle garde ses vitamines jusqu'à la dernière goutte.", 47, 50],
        ["Pressée à froid", "Extraite sans chaleur ni solvant, comme dans les coopératives du Souss.", 55, 66],
        ["Format voyage", "30 ml : il glisse dans une trousse et passe en cabine.", 46, 86],
      ],
      ingredients: [
        ["Huile d'argan", "Souss, Maroc", "97 %", "Riche en vitamine E, elle nourrit sans laisser de film gras.", "olive", "drop"],
        ["Pépins de figue de Barbarie", "Sidi Ifni", "2 %", "Une huile rare qui lisse le grain de peau.", "round", "leaf"],
        ["Vitamine E végétale", "Tournesol", "1 %", "Elle protège naturellement l'huile de l'oxydation.", "daisy", "sun"],
      ],
      size: {
        height: "12 cm",
        width: "3,5 cm",
        specs: [["Contenance", "30 ml"], ["Poids", "95 g"], ["Usage", "≈ 2 mois"]],
        note: "Il tient dans la paume de la main.",
      },
    },
    ar: {
      points: [
        ["قطّارة زجاجية", "الجرعة المضبوطة: ثلاث قطرات، بلا تبذير ولا قارورة دهنية.", 52, 16],
        ["زجاج عنبري", "يحمي الزيت من الضوء، فيحافظ على فيتاميناته حتى آخر قطرة.", 47, 50],
        ["معصور على البارد", "يُستخلص بلا حرارة ولا مذيبات، كما تفعل تعاونيات سوس.", 55, 66],
        ["حجم السفر", "30 مل: يدخل حقيبة اليد ويُسمح به في الطائرة.", 46, 86],
      ],
      ingredients: [
        ["زيت الأركان", "سوس، المغرب", "97%", "غني بفيتامين E، يغذي البشرة دون أن يترك أثراً دهنياً.", "olive", "drop"],
        ["بذور التين الشوكي", "سيدي إفني", "2%", "زيت نادر ينعّم ملمس البشرة.", "round", "leaf"],
        ["فيتامين E نباتي", "دوار الشمس", "1%", "يحمي الزيت من التأكسد بشكل طبيعي.", "daisy", "sun"],
      ],
      size: {
        height: "12 سم",
        width: "3.5 سم",
        specs: [["السعة", "30 مل"], ["الوزن", "95 غ"], ["مدة الاستعمال", "قرابة شهرين"]],
        note: "تتسع لها راحة اليد.",
      },
    },
    en: {
      points: [
        ["Glass dropper", "The exact dose: three drops, no waste, no greasy bottle.", 52, 16],
        ["Amber glass", "Shields the oil from light, so it keeps its vitamins to the last drop.", 47, 50],
        ["Cold-pressed", "Extracted without heat or solvents, the way Souss cooperatives do it.", 55, 66],
        ["Travel size", "30 ml: slips into a pouch and through cabin security.", 46, 86],
      ],
      ingredients: [
        ["Argan oil", "Souss, Morocco", "97%", "Rich in vitamin E, it nourishes without a greasy film.", "olive", "drop"],
        ["Prickly pear seed oil", "Sidi Ifni", "2%", "A rare oil that smooths skin texture.", "round", "leaf"],
        ["Plant vitamin E", "Sunflower", "1%", "Naturally protects the oil from oxidation.", "daisy", "sun"],
      ],
      size: {
        height: "12 cm",
        width: "3.5 cm",
        specs: [["Volume", "30 ml"], ["Weight", "95 g"], ["Lasts", "≈ 2 months"]],
        note: "It fits in the palm of your hand.",
      },
    },
  },
  scent: {
    fr: {
      points: [
        ["Bouchon aimanté", "Il se referme d'un clic et ne s'ouvre jamais dans le sac.", 50, 14],
        ["Vaporisateur fin", "Une brume légère et régulière, jamais de grosses gouttes.", 56, 30],
        ["Verre épais", "Lourd en main, il protège le jus de la chaleur et de la lumière.", 44, 58],
        ["50 ml", "Environ 600 vaporisations : des mois de sillage.", 54, 82],
      ],
      ingredients: [
        ["Bergamote", "Calabre", "Tête", "L'éclat frais et zesté des premières minutes.", "wild", "sun"],
        ["Fleur d'oranger", "Région de Fès", "Cœur", "Un cœur floral qui rappelle les ruelles au printemps.", "flower", "leaf"],
        ["Bois de oud", "Asie du Sud-Est", "Fond", "Un bois chaud et profond qui tient jusqu'au soir.", "sprig", "flame"],
        ["Ambre", "Accord signature", "Fond", "La douceur enveloppante qui reste sur l'écharpe.", "icon", "gem"],
      ],
      size: {
        height: "11 cm",
        width: "6 cm",
        specs: [["Contenance", "50 ml"], ["Poids", "320 g"], ["Concentration", "Eau de parfum"]],
        note: "Il trouve sa place dans un sac à main.",
      },
    },
    ar: {
      points: [
        ["غطاء مغناطيسي", "يُغلق بنقرة ولا ينفتح أبداً داخل الحقيبة.", 50, 14],
        ["بخاخ ناعم", "رذاذ خفيف ومتساوٍ، دون قطرات كبيرة.", 56, 30],
        ["زجاج سميك", "ثقيل في اليد، يحمي العطر من الحرارة والضوء.", 44, 58],
        ["50 مل", "قرابة 600 بخّة: شهور من العطر.", 54, 82],
      ],
      ingredients: [
        ["البرغموت", "كالابريا", "مقدمة", "نفحة منعشة تشرق في الدقائق الأولى.", "wild", "sun"],
        ["زهر الليمون", "نواحي فاس", "قلب", "قلب زهري يذكّر بأزقة المدينة في الربيع.", "flower", "leaf"],
        ["خشب العود", "جنوب شرق آسيا", "قاعدة", "خشب دافئ وعميق يدوم حتى المساء.", "sprig", "flame"],
        ["العنبر", "توقيع العطر", "قاعدة", "دفء ناعم يبقى عالقاً بالوشاح.", "icon", "gem"],
      ],
      size: {
        height: "11 سم",
        width: "6 سم",
        specs: [["السعة", "50 مل"], ["الوزن", "320 غ"], ["التركيز", "أو دو بارفان"]],
        note: "يجد مكانه في حقيبة اليد.",
      },
    },
    en: {
      points: [
        ["Magnetic cap", "Closes with a click and never opens in your bag.", 50, 14],
        ["Fine mist sprayer", "A light, even mist, never big drops.", 56, 30],
        ["Thick glass", "Heavy in the hand, it protects the juice from heat and light.", 44, 58],
        ["50 ml", "About 600 sprays: months of wear.", 54, 82],
      ],
      ingredients: [
        ["Bergamot", "Calabria", "Top", "The fresh, zesty spark of the first minutes.", "wild", "sun"],
        ["Orange blossom", "Fez region", "Heart", "A floral heart that recalls the medina in spring.", "flower", "leaf"],
        ["Oud wood", "Southeast Asia", "Base", "A warm, deep wood that lasts into the evening.", "sprig", "flame"],
        ["Amber", "Signature accord", "Base", "The soft warmth that stays on your scarf.", "icon", "gem"],
      ],
      size: {
        height: "11 cm",
        width: "6 cm",
        specs: [["Volume", "50 ml"], ["Weight", "320 g"], ["Strength", "Eau de parfum"]],
        note: "It fits in a handbag.",
      },
    },
  },
  style: {
    fr: {
      points: [
        ["Fermoir sécurisé", "Il tient toute la journée et s'ouvre d'une seule main.", 50, 20],
        ["Polissage à la main", "Des arêtes douces qui n'accrochent ni la peau ni les pulls.", 40, 48],
        ["Acier inoxydable", "Il ne noircit pas et supporte l'eau du quotidien.", 60, 62],
        ["Écrin offert", "Il arrive dans sa boîte, prêt à offrir.", 50, 86],
      ],
      ingredients: [
        ["Acier 316L", "Qualité médicale", "Base", "Hypoallergénique : il ne verdit pas la peau.", "icon", "shield-check"],
        ["Plaqué or 18 carats", "Finition", "3 µm", "Une couche épaisse pour un éclat qui dure.", "icon", "gem"],
        ["Zircon taillé", "Pierres", "AAA", "Des facettes nettes qui attrapent la lumière.", "icon", "star"],
      ],
      size: {
        height: "4 cm",
        width: "2,5 cm",
        specs: [["Poids", "12 g"], ["Chaîne", "45 cm réglable"], ["Matière", "Acier 316L"]],
        note: "Discret au quotidien, visible le soir.",
      },
    },
    ar: {
      points: [
        ["قفل آمن", "يثبت طوال اليوم ويُفتح بيد واحدة.", 50, 20],
        ["تلميع يدوي", "حواف ناعمة لا تعلق بالجلد ولا بالملابس.", 40, 48],
        ["فولاذ لا يصدأ", "لا يسودّ ويتحمل الماء في الاستعمال اليومي.", 60, 62],
        ["علبة هدية", "يصل في علبته، جاهزاً للإهداء.", 50, 86],
      ],
      ingredients: [
        ["فولاذ 316L", "جودة طبية", "الأساس", "لا يسبب الحساسية ولا يُخضرّ الجلد.", "icon", "shield-check"],
        ["طلاء ذهب عيار 18", "اللمسة النهائية", "3 ميكرون", "طبقة سميكة لبريق يدوم.", "icon", "gem"],
        ["زركون مصقول", "الأحجار", "AAA", "أوجه دقيقة تلتقط الضوء.", "icon", "star"],
      ],
      size: {
        height: "4 سم",
        width: "2.5 سم",
        specs: [["الوزن", "12 غ"], ["السلسلة", "45 سم قابلة للتعديل"], ["المادة", "فولاذ 316L"]],
        note: "هادئ في يومك، لافت في سهرتك.",
      },
    },
    en: {
      points: [
        ["Secure clasp", "Holds all day and opens with one hand.", 50, 20],
        ["Hand-polished", "Soft edges that never catch skin or knitwear.", 40, 48],
        ["Stainless steel", "Won't tarnish and handles everyday water.", 60, 62],
        ["Gift box included", "Arrives boxed, ready to give.", 50, 86],
      ],
      ingredients: [
        ["316L steel", "Medical grade", "Base", "Hypoallergenic: it won't turn your skin green.", "icon", "shield-check"],
        ["18k gold plating", "Finish", "3 µm", "A thick layer for a shine that lasts.", "icon", "gem"],
        ["Cut zircon", "Stones", "AAA", "Crisp facets that catch the light.", "icon", "star"],
      ],
      size: {
        height: "4 cm",
        width: "2.5 cm",
        specs: [["Weight", "12 g"], ["Chain", "45 cm, adjustable"], ["Material", "316L steel"]],
        note: "Quiet by day, noticed at night.",
      },
    },
  },
  active: {
    fr: {
      points: [
        ["6 têtes interchangeables", "Une tête par zone : dos, mollets, nuque, plante des pieds.", 82, 38],
        ["Moteur silencieux", "Moins de 45 dB : il s'utilise devant la télé.", 52, 34],
        ["Poignée antidérapante", "Elle reste en main, même après une séance qui fait transpirer.", 44, 66],
        ["Recharge USB-C", "Le câble de votre téléphone, une semaine d'autonomie.", 44, 90],
      ],
      ingredients: [
        ["Aluminium brossé", "Corps", "650 g", "Léger, robuste, il ne chauffe pas en main.", "icon", "shield-check"],
        ["Silicone médical", "Têtes", "6 têtes", "Doux sur la peau, il se nettoie d'un coup de lingette.", "icon", "drop"],
        ["Moteur brushless", "Cœur", "3 200 cps/min", "Puissant en profondeur, discret dans la pièce.", "icon", "bolt"],
        ["Batterie lithium", "Autonomie", "2 500 mAh", "Une charge pour une semaine de séances.", "icon", "battery"],
      ],
      size: {
        height: "24 cm",
        width: "17 cm",
        specs: [["Poids", "650 g"], ["Vitesses", "5"], ["Autonomie", "6 h"]],
        note: "Plus court qu'une bouteille d'eau : il tient dans le sac de sport.",
      },
    },
    ar: {
      points: [
        ["6 رؤوس قابلة للتبديل", "رأس لكل منطقة: الظهر، الساقان، الرقبة وباطن القدم.", 82, 38],
        ["محرك هادئ", "أقل من 45 ديسيبل: استعمله وأنت أمام التلفاز.", 52, 34],
        ["مقبض لا ينزلق", "يبقى ثابتاً في اليد حتى بعد حصة متعبة.", 44, 66],
        ["شحن USB-C", "كابل هاتفك نفسه، وأسبوع من الاستعمال.", 44, 90],
      ],
      ingredients: [
        ["ألومنيوم مصقول", "الهيكل", "650 غ", "خفيف ومتين، ولا يسخن في اليد.", "icon", "shield-check"],
        ["سيليكون طبي", "الرؤوس", "6 رؤوس", "ناعم على البشرة، ويُنظف بمسحة واحدة.", "icon", "drop"],
        ["محرك بدون فرشاة", "القلب", "3200 نقرة/د", "قوي في العمق، هادئ في الغرفة.", "icon", "bolt"],
        ["بطارية ليثيوم", "الاستقلالية", "2500 mAh", "شحنة واحدة لأسبوع من الحصص.", "icon", "battery"],
      ],
      size: {
        height: "24 سم",
        width: "17 سم",
        specs: [["الوزن", "650 غ"], ["السرعات", "5"], ["مدة البطارية", "6 ساعات"]],
        note: "أقصر من قنينة ماء: يدخل حقيبة الرياضة بسهولة.",
      },
    },
    en: {
      points: [
        ["6 swappable heads", "One per zone: back, calves, neck, soles.", 82, 38],
        ["Quiet motor", "Under 45 dB: use it in front of the TV.", 52, 34],
        ["Non-slip grip", "Stays in your hand, even after a sweaty session.", 44, 66],
        ["USB-C charging", "Your phone's cable, a week per charge.", 44, 90],
      ],
      ingredients: [
        ["Brushed aluminium", "Body", "650 g", "Light, sturdy, never hot in the hand.", "icon", "shield-check"],
        ["Medical silicone", "Heads", "6 heads", "Soft on skin, wipes clean in one go.", "icon", "drop"],
        ["Brushless motor", "Core", "3,200 ppm", "Powerful deep down, quiet in the room.", "icon", "bolt"],
        ["Lithium battery", "Battery", "2,500 mAh", "One charge for a week of sessions.", "icon", "battery"],
      ],
      size: {
        height: "24 cm",
        width: "17 cm",
        specs: [["Weight", "650 g"], ["Speeds", "5"], ["Battery life", "6 h"]],
        note: "Shorter than a water bottle: it fits in your gym bag.",
      },
    },
  },
  home: {
    fr: {
      points: [
        ["Couvercle étanche", "Dans le sac, rien ne coule, même à l'envers.", 50, 12],
        ["Gobelet sans BPA", "On boit directement dedans : une seule pièce à laver.", 46, 40],
        ["Lames inox 6 branches", "Glace et fruits surgelés mixés en 30 secondes.", 54, 70],
        ["Sécurité aimantée", "Les lames ne tournent que si le gobelet est bien fixé.", 48, 88],
      ],
      ingredients: [
        ["Tritan sans BPA", "Gobelet", "380 ml", "Transparent, incassable, sans odeur ni goût.", "icon", "drop"],
        ["Acier inoxydable 304", "Lames", "6 branches", "Il reste tranchant et ne rouille pas au lavage.", "icon", "asterisk"],
        ["Silicone alimentaire", "Joint", "Étanche", "Il garde le couvercle hermétique, jour après jour.", "icon", "shield-check"],
        ["Batterie 4 000 mAh", "Socle", "15 cycles", "Une quinzaine de smoothies par charge.", "icon", "battery"],
      ],
      size: {
        height: "24 cm",
        width: "8 cm",
        specs: [["Contenance", "380 ml"], ["Poids", "450 g"], ["Recharge", "USB-C · 3 h"]],
        note: "Il entre dans un porte-gobelet de voiture.",
      },
    },
    ar: {
      points: [
        ["غطاء محكم", "في الحقيبة لا يتسرب شيء، حتى لو انقلب.", 50, 12],
        ["كوب بدون BPA", "تشرب منه مباشرة: قطعة واحدة فقط للغسل.", 46, 40],
        ["شفرات فولاذية بستة أطراف", "تطحن الثلج والفواكه المجمدة في 30 ثانية.", 54, 70],
        ["أمان مغناطيسي", "لا تدور الشفرات إلا إذا كان الكوب مثبتاً جيداً.", 48, 88],
      ],
      ingredients: [
        ["تريتان بدون BPA", "الكوب", "380 مل", "شفاف ولا ينكسر، بلا رائحة ولا طعم.", "icon", "drop"],
        ["فولاذ 304 لا يصدأ", "الشفرات", "6 أطراف", "يبقى حاداً ولا يصدأ مع الغسل.", "icon", "asterisk"],
        ["سيليكون غذائي", "الحلقة العازلة", "محكم", "يحافظ على إحكام الغطاء يوماً بعد يوم.", "icon", "shield-check"],
        ["بطارية 4000 mAh", "القاعدة", "15 دورة", "حوالي خمسة عشر عصيراً في الشحنة.", "icon", "battery"],
      ],
      size: {
        height: "24 سم",
        width: "8 سم",
        specs: [["السعة", "380 مل"], ["الوزن", "450 غ"], ["الشحن", "USB-C · 3 ساعات"]],
        note: "يدخل في حامل الأكواب داخل السيارة.",
      },
    },
    en: {
      points: [
        ["Leak-proof lid", "Nothing spills in the bag, even upside down.", 50, 12],
        ["BPA-free cup", "Drink straight from it: one piece to wash.", 46, 40],
        ["6-point steel blades", "Ice and frozen fruit blended in 30 seconds.", 54, 70],
        ["Magnetic safety lock", "Blades only spin when the cup is locked on.", 48, 88],
      ],
      ingredients: [
        ["BPA-free Tritan", "Cup", "380 ml", "Clear, shatterproof, no smell, no taste.", "icon", "drop"],
        ["304 stainless steel", "Blades", "6 points", "Stays sharp and never rusts in the wash.", "icon", "asterisk"],
        ["Food-grade silicone", "Seal", "Leak-proof", "Keeps the lid airtight, day after day.", "icon", "shield-check"],
        ["4,000 mAh battery", "Base", "15 cycles", "About fifteen smoothies per charge.", "icon", "battery"],
      ],
      size: {
        height: "24 cm",
        width: "8 cm",
        specs: [["Volume", "380 ml"], ["Weight", "450 g"], ["Charging", "USB-C · 3 h"]],
        note: "It fits a car cup holder.",
      },
    },
  },
  tech: {
    fr: {
      points: [
        ["Bouton unique", "Un appui pour allumer, deux pour changer de mode.", 52, 24],
        ["Batterie longue durée", "Une charge tient plusieurs jours d'usage normal.", 46, 48],
        ["Boîtier robuste", "Il survit aux chutes du quotidien et aux poches pleines.", 58, 66],
        ["Port USB-C", "Le câble de votre téléphone suffit.", 50, 88],
      ],
      ingredients: [
        ["Aluminium", "Boîtier", "Mat", "Il ne garde pas les traces de doigts.", "icon", "shield-check"],
        ["Verre trempé", "Façade", "9H", "Résiste aux rayures des clés dans la poche.", "icon", "gem"],
        ["Batterie lithium", "Autonomie", "3 jours", "Rechargée en deux heures.", "icon", "battery"],
      ],
      size: {
        height: "14 cm",
        width: "7 cm",
        specs: [["Poids", "180 g"], ["Recharge", "USB-C · 2 h"], ["Garantie", "12 mois"]],
        note: "La taille d'un smartphone.",
      },
    },
    ar: {
      points: [
        ["زر واحد", "ضغطة للتشغيل، وضغطتان لتغيير الوضع.", 52, 24],
        ["بطارية تدوم", "شحنة واحدة تكفي لعدة أيام من الاستعمال العادي.", 46, 48],
        ["هيكل متين", "يتحمل السقطات اليومية والجيوب الممتلئة.", 58, 66],
        ["منفذ USB-C", "يكفيك كابل هاتفك.", 50, 88],
      ],
      ingredients: [
        ["ألومنيوم", "الهيكل", "مطفأ", "لا تبقى عليه آثار الأصابع.", "icon", "shield-check"],
        ["زجاج مقوّى", "الواجهة", "9H", "يقاوم خدوش المفاتيح في الجيب.", "icon", "gem"],
        ["بطارية ليثيوم", "الاستقلالية", "3 أيام", "تُشحن في ساعتين.", "icon", "battery"],
      ],
      size: {
        height: "14 سم",
        width: "7 سم",
        specs: [["الوزن", "180 غ"], ["الشحن", "USB-C · ساعتان"], ["الضمان", "12 شهراً"]],
        note: "بحجم هاتف ذكي.",
      },
    },
    en: {
      points: [
        ["One button", "Press once to start, twice to switch modes.", 52, 24],
        ["Long-life battery", "One charge lasts days of normal use.", 46, 48],
        ["Tough casing", "Survives everyday drops and crowded pockets.", 58, 66],
        ["USB-C port", "Your phone's cable is all it needs.", 50, 88],
      ],
      ingredients: [
        ["Aluminium", "Casing", "Matte", "Doesn't hold fingerprints.", "icon", "shield-check"],
        ["Tempered glass", "Front", "9H", "Resists scratches from keys in your pocket.", "icon", "gem"],
        ["Lithium battery", "Battery", "3 days", "Recharged in two hours.", "icon", "battery"],
      ],
      size: {
        height: "14 cm",
        width: "7 cm",
        specs: [["Weight", "180 g"], ["Charging", "USB-C · 2 h"], ["Warranty", "12 months"]],
        note: "The size of a smartphone.",
      },
    },
  },
  kids: {
    fr: {
      points: [
        ["Coins arrondis", "Aucune arête vive : on le leur confie sans stresser.", 50, 22],
        ["Sans BPA", "Testé pour les tout-petits, même quand ça finit à la bouche.", 42, 48],
        ["Se lave en un geste", "Un coup d'éponge et c'est propre.", 58, 66],
        ["Léger", "Ils le portent tout seuls, sans votre aide.", 50, 86],
      ],
      ingredients: [
        ["Silicone alimentaire", "Pièces souples", "Sans BPA", "Doux sous les dents, il passe au lave-vaisselle.", "icon", "drop"],
        ["Bois de hêtre", "Forêts gérées", "Brut", "Poncé à la main, sans vernis toxique.", "sprig", "leaf"],
        ["Peinture à l'eau", "Couleurs", "Norme EN71", "Des couleurs vives qui ne s'écaillent pas.", "icon", "heart"],
      ],
      size: {
        height: "20 cm",
        width: "15 cm",
        specs: [["Poids", "300 g"], ["Âge", "Dès 12 mois"], ["Entretien", "Lave-vaisselle"]],
        note: "Pensé pour la taille de leurs mains.",
      },
    },
    ar: {
      points: [
        ["زوايا مدورة", "لا حواف حادة: تتركه بين أيديهم دون قلق.", 50, 22],
        ["بدون BPA", "مجرَّب للصغار، حتى حين ينتهي في الفم.", 42, 48],
        ["يُنظَّف بسهولة", "مسحة واحدة بالإسفنجة ويعود نظيفاً.", 58, 66],
        ["خفيف", "يحملونه بأنفسهم دون مساعدتك.", 50, 86],
      ],
      ingredients: [
        ["سيليكون غذائي", "الأجزاء الطرية", "بدون BPA", "ناعم تحت الأسنان، ويُغسل في آلة الأواني.", "icon", "drop"],
        ["خشب الزان", "غابات مستدامة", "طبيعي", "مصقول يدوياً، بلا طلاء ضار.", "sprig", "leaf"],
        ["ألوان مائية", "الألوان", "معيار EN71", "ألوان زاهية لا تتقشر.", "icon", "heart"],
      ],
      size: {
        height: "20 سم",
        width: "15 سم",
        specs: [["الوزن", "300 غ"], ["العمر", "من 12 شهراً"], ["التنظيف", "آلة الأواني"]],
        note: "على مقاس أيديهم الصغيرة.",
      },
    },
    en: {
      points: [
        ["Rounded corners", "No sharp edges: hand it over without worrying.", 50, 22],
        ["BPA-free", "Tested for little ones, even when it ends up in their mouth.", 42, 48],
        ["Wipes clean", "One swipe with a sponge and it's clean.", 58, 66],
        ["Lightweight", "They carry it on their own.", 50, 86],
      ],
      ingredients: [
        ["Food-grade silicone", "Soft parts", "BPA-free", "Gentle on teeth, dishwasher-safe.", "icon", "drop"],
        ["Beech wood", "Managed forests", "Raw", "Hand-sanded, no toxic varnish.", "sprig", "leaf"],
        ["Water-based paint", "Colors", "EN71 tested", "Bright colors that never flake.", "icon", "heart"],
      ],
      size: {
        height: "20 cm",
        width: "15 cm",
        specs: [["Weight", "300 g"], ["Age", "12 months +"], ["Care", "Dishwasher"]],
        note: "Made for the size of their hands.",
      },
    },
  },
  natural: {
    fr: {
      points: [
        ["Couvercle hermétique", "Il garde l'arôme intact après ouverture.", 50, 14],
        ["Bocal en verre", "Aucun plastique au contact : le goût reste pur.", 44, 44],
        ["Récolte de saison", "Préparé en petites quantités, au rythme de la récolte.", 56, 64],
        ["Sans additif", "Ni conservateur, ni sucre ajouté.", 50, 86],
      ],
      ingredients: [
        ["Amandes beldi", "Tafraout", "50 %", "Torréfiées doucement, puis moulues sur pierre.", "olive", "leaf"],
        ["Huile d'argan alimentaire", "Souss", "30 %", "Le goût de noisette grillée qui fait l'amlou.", "olive", "drop"],
        ["Miel de thym", "Moyen Atlas", "20 %", "Il adoucit sans écraser le goût des amandes.", "lavender", "sun"],
      ],
      size: {
        height: "10 cm",
        width: "8 cm",
        specs: [["Poids net", "500 g"], ["Conservation", "6 mois"], ["Après ouverture", "À l'abri de la lumière"]],
        note: "Un pot pour environ un mois de petits-déjeuners.",
      },
    },
    ar: {
      points: [
        ["غطاء محكم", "يحافظ على النكهة بعد الفتح.", 50, 14],
        ["برطمان زجاجي", "لا بلاستيك يلامس المنتج: يبقى المذاق نقياً.", 44, 44],
        ["من موسم الجني", "يُحضَّر بكميات صغيرة حسب موسم الجني.", 56, 64],
        ["بدون إضافات", "لا مواد حافظة ولا سكر مضاف.", 50, 86],
      ],
      ingredients: [
        ["لوز بلدي", "تافراوت", "50%", "محمّص على مهل ثم مطحون على الحجر.", "olive", "leaf"],
        ["زيت أركان غذائي", "سوس", "30%", "نكهة البندق المحمّص التي تصنع الأملو.", "olive", "drop"],
        ["عسل الزعتر", "الأطلس المتوسط", "20%", "يُليّن المذاق دون أن يطغى على اللوز.", "lavender", "sun"],
      ],
      size: {
        height: "10 سم",
        width: "8 سم",
        specs: [["الوزن الصافي", "500 غ"], ["الصلاحية", "6 أشهر"], ["بعد الفتح", "بعيداً عن الضوء"]],
        note: "برطمان يكفي فطور شهر تقريباً.",
      },
    },
    en: {
      points: [
        ["Airtight lid", "Keeps the aroma intact once opened.", 50, 14],
        ["Glass jar", "No plastic contact: the taste stays pure.", 44, 44],
        ["Seasonal harvest", "Made in small batches, with the harvest.", 56, 64],
        ["No additives", "No preservatives, no added sugar.", 50, 86],
      ],
      ingredients: [
        ["Beldi almonds", "Tafraout", "50%", "Gently roasted, then stone-ground.", "olive", "leaf"],
        ["Culinary argan oil", "Souss", "30%", "The toasted-hazelnut taste that makes amlou.", "olive", "drop"],
        ["Thyme honey", "Middle Atlas", "20%", "Softens without masking the almonds.", "lavender", "sun"],
      ],
      size: {
        height: "10 cm",
        width: "8 cm",
        specs: [["Net weight", "500 g"], ["Shelf life", "6 months"], ["Once opened", "Away from light"]],
        note: "One jar for about a month of breakfasts.",
      },
    },
  },
  general: {
    fr: {
      points: [
        ["Finitions soignées", "Des bords nets, vérifiés un par un avant l'envoi.", 50, 20],
        ["Matériaux solides", "Pensé pour durer des années, pas une saison.", 44, 48],
        ["Format pratique", "Il trouve sa place, même dans un petit espace.", 56, 66],
        ["Prêt à l'emploi", "Rien à monter : vous déballez, vous l'utilisez.", 50, 86],
      ],
      ingredients: [
        ["Structure", "Matière principale", "Robuste", "Choisie pour durer et bien vieillir.", "icon", "shield-check"],
        ["Finition", "Contrôle qualité", "100 %", "Chaque pièce est vérifiée avant l'envoi.", "icon", "check"],
        ["Emballage", "Protection", "Renforcé", "Il arrive intact, prêt à servir.", "icon", "box"],
      ],
      size: {
        height: "25 cm",
        width: "18 cm",
        specs: [["Poids", "400 g"], ["Garantie", "12 mois"], ["Livraison", "24–48 h"]],
        note: "Compact, il se range facilement.",
      },
    },
    ar: {
      points: [
        ["تشطيب متقن", "حواف نظيفة، مفحوصة قطعة قطعة قبل الإرسال.", 50, 20],
        ["مواد متينة", "مصمم ليدوم سنوات، لا موسماً واحداً.", 44, 48],
        ["حجم عملي", "يجد مكانه حتى في المساحات الصغيرة.", 56, 66],
        ["جاهز للاستعمال", "لا شيء للتركيب: تفتح العلبة وتستعمله.", 50, 86],
      ],
      ingredients: [
        ["الهيكل", "المادة الأساسية", "متين", "مختارة لتدوم وتحافظ على شكلها.", "icon", "shield-check"],
        ["التشطيب", "مراقبة الجودة", "100%", "كل قطعة تُفحص قبل الإرسال.", "icon", "check"],
        ["التغليف", "الحماية", "مُعزَّز", "يصلك سليماً وجاهزاً للاستعمال.", "icon", "box"],
      ],
      size: {
        height: "25 سم",
        width: "18 سم",
        specs: [["الوزن", "400 غ"], ["الضمان", "12 شهراً"], ["التوصيل", "24–48 ساعة"]],
        note: "صغير الحجم وسهل التخزين.",
      },
    },
    en: {
      points: [
        ["Careful finish", "Clean edges, checked one by one before shipping.", 50, 20],
        ["Solid materials", "Built to last years, not a season.", 44, 48],
        ["Practical size", "Finds its place, even in a small space.", 56, 66],
        ["Ready to use", "Nothing to assemble: unbox and use.", 50, 86],
      ],
      ingredients: [
        ["Structure", "Main material", "Sturdy", "Chosen to last and age well.", "icon", "shield-check"],
        ["Finish", "Quality check", "100%", "Every piece is checked before shipping.", "icon", "check"],
        ["Packaging", "Protection", "Reinforced", "Arrives intact, ready to use.", "icon", "box"],
      ],
      size: {
        height: "25 cm",
        width: "18 cm",
        specs: [["Weight", "400 g"], ["Warranty", "12 months"], ["Delivery", "24–48 h"]],
        note: "Compact and easy to store.",
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts)                                            */
/* ------------------------------------------------------------------ */

type GarmentPoint = "lace" | "embroidery" | "fabric" | "prayer" | "modest" | "heritage" | "cut" | "drape" | "finish" | "kids";
type GarmentMaterial = "fabric" | "lace" | "embroidery" | "seams";

interface GarmentCopy {
  titles: readonly string[];
  leads: readonly string[];
  points: Record<GarmentPoint, readonly [label: string, text: string]>;
  materials: Record<GarmentMaterial, IngredientRow>;
  /** spec rows of the size card: cut (by shape), size (adult / child), care */
  shape: { modest: string; drape: string; plain: string };
  size: { adult: string; child: string };
  labels: { cut: string; drape: string; size: string; care: string };
  care: string;
  note: string;
  drapeNote: string;
  caption: (n: number) => string;
}

/**
 * Pins on a standing-figure photo (the usual garment shot), per detail: lace at the sleeve cuff,
 * embroidery at the neckline, fabric on the chest, the cut at the waist, finishing at the hem.
 */
const GARMENT_PINS: Record<GarmentPoint, readonly [x: number, y: number]> = {
  lace: [30, 62],
  embroidery: [50, 22],
  fabric: [54, 36],
  prayer: [61, 54],
  modest: [61, 54],
  heritage: [61, 54],
  cut: [61, 54],
  drape: [56, 30],
  finish: [47, 88],
  kids: [42, 74],
};

const GARMENT: Tri<GarmentCopy> = {
  fr: {
    titles: ["Regardez *de près*", "Chaque détail *a sa raison*", "Le tissu, la coupe, *les finitions*"],
    leads: [
      "Ce qu'une photo ne dit pas : le tissu, la coupe et les finitions, point par point.",
      "Chaque choix de fabrication, et ce qu'il change quand on la porte.",
    ],
    points: {
      lace: ["Dentelle", "Une dentelle fine qui souligne la pièce sans la charger."],
      embroidery: ["Broderie", "Des motifs réguliers, des fils bien arrêtés : un travail qui se voit de près."],
      fabric: ["Tissu", "Doux au toucher, il tombe avec fluidité et ne colle pas à la peau."],
      prayer: ["Coupe ample", "Couvrante, elle laisse bouger librement à chaque mouvement de la prière."],
      modest: ["Coupe ample", "Elle couvre sans engoncer et suit chaque mouvement."],
      heritage: ["Coupe", "Les lignes de la tradition, dans une coupe facile à porter."],
      cut: ["Coupe", "Pensée pour bien tomber, sans serrer ni flotter."],
      drape: ["Tombé", "Il se drape en un geste et reste en place."],
      finish: ["Finitions", "Coutures nettes et ourlets réguliers, faits pour durer lavage après lavage."],
      kids: ["Facile à enfiler", "Légère, sans fermeture compliquée."],
    },
    materials: {
      fabric: ["Tissu principal", "Le corps de la pièce", "Fluide", "Doux et léger, il ne colle pas à la peau.", "icon", "feather"],
      lace: ["Dentelle", "Les finitions", "Fine", "Juste ce qu'il faut pour habiller la pièce.", "icon", "asterisk"],
      embroidery: ["Broderie", "Les détails", "Nette", "Des motifs réguliers, des fils bien arrêtés.", "icon", "asterisk"],
      seams: ["Coutures", "L'assemblage", "Renforcées", "Elles tiennent au lavage comme aux mouvements.", "icon", "shield-check"],
    },
    shape: { modest: "Ample, couvrante", drape: "Se drape et tient", plain: "Fluide" },
    size: { adult: "Selon le guide", child: "Selon l'âge" },
    labels: { cut: "Coupe", drape: "Tombé", size: "Taille", care: "Entretien" },
    care: "Lavage délicat",
    note: "Un doute sur la taille ? On la revoit avec vous à l'appel de confirmation.",
    drapeNote: "Un geste pour le draper, il tient toute la journée.",
    caption: (n) => `${n} détails qui font la pièce`,
  },
  ar: {
    titles: ["عن قرب، *تفصيلًا بتفصيل*", "لكل تفصيل *سببه*", "القماش والقصّة *والتشطيب*"],
    leads: ["ما لا تقوله الصورة: القماش والقصّة والتشطيب، نقطة بنقطة.", "كل اختيار في الخياطة، وما يغيّره حين تُلبس."],
    points: {
      lace: ["الدانتيل", "دانتيل رقيق يزيّن القطعة دون مبالغة."],
      embroidery: ["الطرز", "نقوش منتظمة وخيوط مثبّتة جيدًا: عمل يظهر جماله عن قرب."],
      fabric: ["القماش", "ناعم الملمس، ينسدل بانسيابية ولا يلتصق بالجسم."],
      prayer: ["قصّة واسعة", "ساترة، وتترك حرية الحركة في الركوع والسجود."],
      modest: ["قصّة واسعة", "تستر دون أن تُثقل، وتتبع كل حركة."],
      heritage: ["القصّة", "خطوط تقليدية بقصّة سهلة اللبس."],
      cut: ["القصّة", "مدروسة لتنسدل بشكل جميل، لا ضيّقة ولا فضفاضة."],
      drape: ["الانسدال", "يُلفّ بحركة واحدة ويبقى في مكانه."],
      finish: ["التشطيب", "خياطة نظيفة وحواف متقنة تصمد غسلة بعد غسلة."],
      kids: ["سهلة اللبس", "خفيفة وبلا أزرار معقّدة."],
    },
    materials: {
      fabric: ["القماش الأساسي", "جسم القطعة", "منسدل", "ناعم وخفيف، لا يلتصق بالجسم.", "icon", "feather"],
      lace: ["الدانتيل", "اللمسة الأخيرة", "رقيق", "بالقدر المناسب ليزيّن القطعة.", "icon", "asterisk"],
      embroidery: ["الطرز", "التفاصيل", "متقن", "نقوش منتظمة وخيوط مثبّتة جيدًا.", "icon", "asterisk"],
      seams: ["الخياطة", "التجميع", "مقوّاة", "تصمد أمام الغسيل والحركة.", "icon", "shield-check"],
    },
    shape: { modest: "واسعة وساترة", drape: "يُلفّ ويثبت", plain: "منسدلة" },
    size: { adult: "حسب دليل المقاسات", child: "حسب العمر" },
    labels: { cut: "القصّة", drape: "الانسدال", size: "المقاس", care: "العناية" },
    care: "غسيل لطيف",
    note: "عندك شك في المقاس؟ نراجعه معك في مكالمة التأكيد.",
    drapeNote: "حركة واحدة للفّه، ويبقى ثابتًا طوال اليوم.",
    caption: (n) => (n === 2 ? "تفصيلان يصنعان القطعة" : `${n} تفاصيل تصنع القطعة`),
  },
  en: {
    titles: ["Up close, *detail by detail*", "Every detail *has a reason*", "Fabric, cut *and finish*"],
    leads: ["What a photo can't tell you: the fabric, the cut and the finish, point by point.", "Every making choice, and what it changes when you wear it."],
    points: {
      lace: ["Lace", "Fine lace that dresses the piece without weighing it down."],
      embroidery: ["Embroidery", "Even patterns, well-secured threads: work that shows up close."],
      fabric: ["Fabric", "Soft to the touch, it drapes fluidly and never clings."],
      prayer: ["Loose cut", "Covering, and free to move through every position of prayer."],
      modest: ["Loose cut", "It covers without weighing you down and moves with you."],
      heritage: ["Cut", "Traditional lines, in a cut that's easy to wear."],
      cut: ["Cut", "Designed to fall right: never tight, never shapeless."],
      drape: ["Drape", "Wraps in one move and stays put."],
      finish: ["Finishing", "Clean seams and even hems, made to last wash after wash."],
      kids: ["Easy to put on", "Light, with no fiddly fastening."],
    },
    materials: {
      fabric: ["Main fabric", "The body", "Fluid", "Soft and light, it never clings.", "icon", "feather"],
      lace: ["Lace", "Finishing", "Fine", "Just enough to dress the piece.", "icon", "asterisk"],
      embroidery: ["Embroidery", "Details", "Clean", "Even patterns, well-secured threads.", "icon", "asterisk"],
      seams: ["Seams", "Assembly", "Reinforced", "They hold through washing and movement.", "icon", "shield-check"],
    },
    shape: { modest: "Loose, covering", drape: "Drapes and holds", plain: "Fluid" },
    size: { adult: "See the size guide", child: "By age" },
    labels: { cut: "Cut", drape: "Drape", size: "Size", care: "Care" },
    care: "Gentle wash",
    note: "Unsure about the size? We go over it with you on the confirmation call.",
    drapeNote: "One move to drape it, and it holds all day.",
    caption: (n) => `${n} details that make the piece`,
  },
};

/** Showcase copy for a garment: details pinned on a standing figure, its materials, a size card. */
export function garmentShowcase(lang: CopyLang, g: Garment): FamilyCopy & { titles: readonly string[]; leads: readonly string[]; caption: string } {
  const c = GARMENT[lang];
  const shape: GarmentPoint = g.scarf ? "drape" : g.prayer ? "prayer" : g.modest ? "modest" : g.heritage ? "heritage" : "cut";
  const detail: GarmentPoint | null = g.lace ? "lace" : g.embroidery ? "embroidery" : null;
  const keys: GarmentPoint[] = [...(detail ? [detail] : []), "fabric", shape, g.scarf ? null : "finish", g.kids && !g.scarf ? "kids" : null].filter(
    (k): k is GarmentPoint => !!k,
  );
  // French typography (no-break spaces before ":" and "?"), like the hand-set lines above
  const t = (s: string) => typo(lang, s);
  const points: PointRow[] = keys.slice(0, 4).map((k) => {
    const [label, text] = c.points[k];
    const [x, y] = GARMENT_PINS[k];
    return [label, t(text), x, y] as const;
  });
  const mats: GarmentMaterial[] = ["fabric", ...(g.lace ? (["lace"] as const) : []), ...(g.embroidery ? (["embroidery"] as const) : []), "seams"];
  const ingredients = mats.slice(0, 4).map((m) => c.materials[m]);
  const specs: (readonly [string, string])[] = g.scarf
    ? [[c.labels.drape, c.shape.drape], [c.labels.care, c.care]]
    : [[c.labels.cut, g.modest ? c.shape.modest : c.shape.plain], [c.labels.size, g.kids ? c.size.child : c.size.adult], [c.labels.care, c.care]];
  return {
    titles: c.titles,
    leads: c.leads.map(t),
    points,
    ingredients,
    // a garment's measurements depend on the size: no invented drawing figures, the specs say how to choose
    size: { height: "", width: "", specs, note: t(g.scarf ? c.drapeNote : c.note) },
    caption: c.caption(ingredients.length),
  };
}
