/**
 * Default copy for the gallery, per product family and language. `{short}` = the short product name.
 * Captions describe the framing ("In detail", "Another angle"), never what a photo may not show —
 * the merchant refines them. Arabic: clear MSA with light Moroccan touches.
 */
import type { Family, Tri } from "../benefits/kit";

export interface GalleryCopy {
  kickers: readonly string[];
  titles: readonly string[];
  lead: string;
  captions: readonly string[];
}

export const COMMON: Tri<GalleryCopy> = {
  fr: {
    kickers: ["En images", "De près", "Galerie"],
    titles: ["Regardez-le *de plus près*", "Tel qu'il arrive *chez vous*", "Chaque détail, *en vrai*"],
    lead: "Le produit sous tous les angles, pour savoir exactement ce que vous commandez.",
    captions: ["Vue d'ensemble", "En détail", "Sous un autre angle", "Les finitions", "Au quotidien", "Prêt à l'emploi"],
  },
  ar: {
    kickers: ["بالصور", "عن قرب", "معرض الصور"],
    titles: ["تأمّله *عن قرب*", "كما *يصلك* بالضبط", "كل التفاصيل *على حقيقتها*"],
    lead: "المنتج من جميع الزوايا، لتعرف بالضبط ما ستتوصل به.",
    captions: ["نظرة شاملة", "بالتفصيل", "من زاوية أخرى", "التشطيب", "في الاستعمال اليومي", "جاهز للاستعمال"],
  },
  en: {
    kickers: ["In pictures", "Up close", "Gallery"],
    titles: ["Take a *closer look*", "Exactly as it *arrives*", "Every detail, *for real*"],
    lead: "Every angle, so you know exactly what you're ordering.",
    captions: ["The full view", "In detail", "Another angle", "The finish", "Every day", "Ready to use"],
  },
};

type FamilyCopy = Tri<Partial<GalleryCopy>>;

export const FAMILY: Partial<Record<Family, FamilyCopy>> = {
  care: {
    fr: {
      titles: ["{short}, *en gros plan*", "Votre rituel, *vu de près*"],
      lead: "Le format, la matière, les détails\u00a0: tout ce que vous verrez en ouvrant le colis.",
    },
    ar: {
      titles: ["{short} *عن قرب*", "روتينك *عن قرب*"],
      lead: "الحجم، الخامة، والتفاصيل: كل ما ستراه عند فتح الطرد.",
    },
    en: {
      titles: ["{short}, *up close*", "Your ritual, *up close*"],
      lead: "The size, the feel, the details: everything you'll see when you open the parcel.",
    },
  },
  scent: {
    fr: {
      titles: ["Le flacon, *dans la lumière*", "{short}, *en détail*"],
      lead: "Le verre, le bouchon, la couleur du jus\u00a0: regardez bien avant de choisir.",
      captions: ["Le flacon", "Dans la lumière", "Le bouchon", "Sous un autre angle", "Les finitions", "Prêt à offrir"],
    },
    ar: {
      titles: ["القارورة *تحت الضوء*", "{short} *بالتفصيل*"],
      lead: "الزجاج، الغطاء، ولون العطر: تأمّل كل شيء قبل أن تختار.",
      captions: ["القارورة", "تحت الضوء", "الغطاء", "من زاوية أخرى", "التشطيب", "جاهز للإهداء"],
    },
    en: {
      titles: ["The bottle, *in the light*", "{short}, *in detail*"],
      lead: "The glass, the cap, the color of the juice: look closely before you choose.",
      captions: ["The bottle", "In the light", "The cap", "Another angle", "The finish", "Ready to gift"],
    },
  },
  style: {
    fr: {
      titles: ["Les finitions, *de près*", "{short}, *sous tous les angles*"],
      lead: "Matière, finitions, reflets\u00a0: les détails qui font la différence, photographiés de près.",
    },
    ar: {
      titles: ["التشطيب *عن قرب*", "{short} *من كل الزوايا*"],
      lead: "الخامة، التشطيب، واللمعان: التفاصيل التي تصنع الفرق، مصوّرة عن قرب.",
    },
    en: {
      titles: ["The finish, *up close*", "{short}, *from every angle*"],
      lead: "Material, finish, shine: the details that make the difference, shot up close.",
    },
  },
  active: {
    fr: {
      titles: ["{short}, *sous tous les angles*", "Pensé pour *bouger avec vous*"],
      lead: "Prise en main, détails, finitions\u00a0: voyez-le de près avant de commander.",
    },
    ar: {
      titles: ["{short} *من كل الزوايا*", "مصمّم *ليتحرك معك*"],
      lead: "المسكة، التفاصيل، والتشطيب: شاهده عن قرب قبل أن تطلب.",
    },
    en: {
      titles: ["{short}, *from every angle*", "Built to *move with you*"],
      lead: "Grip, details, finish: see it up close before you order.",
    },
  },
  home: {
    fr: {
      titles: ["{short}, *chez vous*", "Il trouve vite *sa place*"],
      lead: "Taille, matière, détails\u00a0: à quoi il ressemble vraiment, une fois à la maison.",
    },
    ar: {
      titles: ["{short} *في بيتك*", "يجد مكانه *بسرعة*"],
      lead: "الحجم، الخامة، والتفاصيل: كيف يبدو فعلًا عندما يصل إلى بيتك.",
    },
    en: {
      titles: ["{short}, *at home*", "It finds *its place* fast"],
      lead: "Size, material, details: what it really looks like once it's home.",
    },
  },
  tech: {
    fr: {
      titles: ["{short}, *dans le détail*", "Le design, *de près*"],
      lead: "Commandes, matières, finitions\u00a0: tout est visible avant de commander.",
    },
    ar: {
      titles: ["{short} *بالتفصيل*", "التصميم *عن قرب*"],
      lead: "الأزرار، الخامات، والتشطيب: كل شيء واضح قبل أن تطلب.",
    },
    en: {
      titles: ["{short}, *in detail*", "The design, *up close*"],
      lead: "Controls, materials, finish: it's all visible before you order.",
    },
  },
  kids: {
    fr: {
      titles: ["{short}, *en vrai*", "Des détails qui *font sourire*"],
      lead: "Taille, couleurs, matières\u00a0: voyez exactement ce qui arrive dans le colis.",
    },
    ar: {
      titles: ["{short} *على حقيقته*", "تفاصيل *تُفرح*"],
      lead: "الحجم، الألوان، والخامات: شاهد بالضبط ما سيصل في الطرد.",
    },
    en: {
      titles: ["{short}, *for real*", "Details that *make them smile*"],
      lead: "Size, colors, materials: see exactly what arrives in the parcel.",
    },
  },
  natural: {
    fr: {
      titles: ["{short}, *au naturel*", "Le produit, *tel qu'il est*"],
      lead: "Couleur, texture, emballage\u00a0: regardez-le tel qu'il arrive chez vous.",
    },
    ar: {
      titles: ["{short} *على طبيعته*", "المنتج *كما هو*"],
      lead: "اللون، القوام، والتغليف: شاهده كما يصل إلى بيتك.",
    },
    en: {
      titles: ["{short}, *naturally*", "The product, *as it is*"],
      lead: "Color, texture, packaging: see it just as it arrives at your door.",
    },
  },
};

/** Non-editable microcopy (accessible names of the thumbnails and dots). */
export const MICRO: Tri<{ thumb: string }> = {
  fr: { thumb: "Voir la photo {n}" },
  ar: { thumb: "عرض الصورة {n}" },
  en: { thumb: "Show photo {n}" },
};

/** Garments (../garment.ts): the fabric, the cut and the finish, before the size is chosen. */
export const GARMENT_GALLERY: FamilyCopy = {
  fr: {
    titles: ["Le tissu, *de près*", "{short}, *sous tous les angles*"],
    lead: "Le tissu, la coupe, les finitions : regardez chaque détail avant de choisir votre taille.",
    captions: ["Vue d'ensemble", "Le tissu", "Sous un autre angle", "Les finitions", "Le tombé", "En détail"],
  },
  ar: {
    titles: ["القماش *عن قرب*", "{short} *من كل الزوايا*"],
    lead: "القماش والقصّة والتشطيب: تأمّل كل تفصيل قبل أن تختار المقاس.",
    captions: ["نظرة شاملة", "القماش", "من زاوية أخرى", "التشطيب", "الانسدال", "بالتفصيل"],
  },
  en: {
    titles: ["The fabric, *up close*", "{short}, *from every angle*"],
    lead: "The fabric, the cut, the finish: look at every detail before you pick your size.",
    captions: ["The full view", "The fabric", "Another angle", "The finish", "The drape", "In detail"],
  },
};
