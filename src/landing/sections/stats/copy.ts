/**
 * Default copy for the stats section. Numbers are MERCHANT PROOF: every default here is an example
 * (data.sample = true) that the admin must replace with real figures before publishing.
 * Stat = [value, prefix, suffix, label, of?]. Suffixes stay symbols/Latin units; Arabic units live in
 * the label, so the figure never fights the bidi order. `of` = the whole a ring or meter measures against.
 * Captions read as the end of a sentence that starts with the figure ("94% … say their skin…").
 */
import type { Family, Tri } from "../benefits/kit";

export type StatRow = readonly [value: number, prefix: string, suffix: string, label: string, of?: number];

export interface StatsCommonCopy {
  kickers: readonly string[];
  /** {short} = short product name */
  titles: readonly string[];
  leads: readonly string[];
  /** label of the product's real rating, {count} = number of reviews */
  rating: string;
}

export const COMMON: Tri<StatsCommonCopy> = {
  fr: {
    kickers: ["En chiffres", "Les preuves", "Ce qu'on mesure"],
    titles: ["Des *chiffres*, pas des promesses", "Ce que disent *les chiffres*", "*Mesuré*, pas imaginé", "{short}, *en chiffres*"],
    leads: ["Des chiffres précis, avec leur source juste en dessous.", "Pas d'adjectifs : des mesures, et d'où elles viennent."],
    rating: "de note moyenne, sur {count} avis",
  },
  ar: {
    kickers: ["بالأرقام", "الدليل", "ما نقيسه"],
    titles: ["*أرقام*، لا وعود", "ماذا تقول *الأرقام*", "*مقيس*، لا متخيَّل", "{short} *بالأرقام*"],
    leads: ["أرقام دقيقة، ومصدرها مكتوب تحتها.", "بلا مبالغة: أرقام واضحة، ومن أين جاءت."],
    rating: "معدّل تقييم زبنائنا، من {count} تقييمًا",
  },
  en: {
    kickers: ["By the numbers", "The proof", "What we measure"],
    titles: ["*Numbers*, not promises", "What the *numbers* say", "*Measured*, not imagined", "{short}, *by the numbers*"],
    leads: ["Precise figures, with their source right underneath.", "No adjectives: measurements, and where they come from."],
    rating: "average rating, from {count} reviews",
  },
};

const STORE_SOURCE: Tri<string> = {
  fr: "Chiffres de la boutique, mis à jour chaque mois.",
  ar: "أرقام المتجر، تُحدَّث كل شهر.",
  en: "Store figures, updated every month.",
};

export interface FamilyStats {
  items: readonly StatRow[];
  source: string;
}

export const STATS: Record<Family, Tri<FamilyStats>> = {
  care: {
    fr: {
      items: [
        [94, "", "%", "trouvent leur peau plus souple après deux semaines", 100],
        [3, "", "", "gouttes suffisent pour tout le visage"],
        [60, "", " j", "d'usage quotidien dans un seul flacon"],
      ],
      source: "Questionnaire auprès de nos clientes après 14 jours d'utilisation.",
    },
    ar: {
      items: [
        [94, "", "%", "يجدن بشرتهن أنعم بعد أسبوعين", 100],
        [3, "", "", "قطرات تكفي للوجه كاملًا"],
        [60, "", "", "يومًا من الاستعمال اليومي في قارورة واحدة"],
      ],
      source: "استبيان لدى زبوناتنا بعد 14 يومًا من الاستعمال.",
    },
    en: {
      items: [
        [94, "", "%", "say their skin feels softer after two weeks", 100],
        [3, "", "", "drops cover the whole face"],
        [60, "", " days", "of daily use in a single bottle"],
      ],
      source: "Survey of our customers after 14 days of use.",
    },
  },
  scent: {
    fr: {
      items: [
        [12, "", " h", "de tenue sur la peau", 24],
        [2, "", "", "vaporisations suffisent pour la journée"],
        [20, "", "%", "de concentration en essences", 100],
      ],
      source: "Tenue mesurée sur peau, en conditions normales.",
    },
    ar: {
      items: [
        [12, "", "", "ساعة من الثبات على البشرة", 24],
        [2, "", "", "رشّتان تكفيان ليوم كامل"],
        [20, "", "%", "تركيز الزيوت العطرية", 100],
      ],
      source: "الثبات مقيس على البشرة في ظروف عادية.",
    },
    en: {
      items: [
        [12, "", " h", "of wear on the skin", 24],
        [2, "", "", "sprays last the whole day"],
        [20, "", "%", "perfume oil concentration", 100],
      ],
      source: "Wear measured on skin, under normal conditions.",
    },
  },
  style: {
    fr: {
      items: [
        [9400, "+", "", "pièces livrées partout au Maroc"],
        [7, "", " j", "pour l'échanger, sans discussion"],
        [48, "", " h", "de délai moyen de livraison"],
      ],
      source: STORE_SOURCE.fr,
    },
    ar: {
      items: [
        [9400, "+", "", "قطعة وصلت إلى زبنائنا في كل المغرب"],
        [7, "", "", "أيام للتبديل دون نقاش"],
        [48, "", "", "ساعة هي متوسط مدة التوصيل"],
      ],
      source: STORE_SOURCE.ar,
    },
    en: {
      items: [
        [9400, "+", "", "pieces delivered across Morocco"],
        [7, "", " days", "to exchange it, no questions asked"],
        [48, "", " h", "average delivery time"],
      ],
      source: STORE_SOURCE.en,
    },
  },
  active: {
    fr: {
      items: [
        [3200, "", "", "percussions par minute à pleine vitesse"],
        [6, "", " h", "d'utilisation sur une seule charge"],
        [45, "", " dB", "seulement, plus discret qu'une conversation"],
      ],
      source: "Fiche technique du fabricant.",
    },
    ar: {
      items: [
        [3200, "", "", "ضربة في الدقيقة بأقصى سرعة"],
        [6, "", "", "ساعات من الاستعمال بشحنة واحدة"],
        [45, "", "", "ديسيبل فقط، أهدأ من محادثة عادية"],
      ],
      source: "حسب المعطيات التقنية للمصنّع.",
    },
    en: {
      items: [
        [3200, "", "", "percussions per minute at full speed"],
        [6, "", " h", "of use on a single charge"],
        [45, "", " dB", "only, quieter than a conversation"],
      ],
      source: "Manufacturer's technical sheet.",
    },
  },
  home: {
    fr: {
      items: [
        [30, "", " s", "et c'est prêt à servir", 60],
        [8500, "+", "", "foyers l'utilisent chaque jour au Maroc"],
        [7, "", " j", "pour l'échanger s'il ne vous plaît pas"],
      ],
      source: STORE_SOURCE.fr,
    },
    ar: {
      items: [
        [30, "", "", "ثانية ويصبح جاهزًا", 60],
        [8500, "+", "", "بيت مغربي يستعمله كل يوم"],
        [7, "", "", "أيام لتبديله إن لم يعجبك"],
      ],
      source: STORE_SOURCE.ar,
    },
    en: {
      items: [
        [30, "", " s", "and it's ready to serve", 60],
        [8500, "+", "", "homes in Morocco use it every day"],
        [7, "", " days", "to exchange it if you don't love it"],
      ],
      source: STORE_SOURCE.en,
    },
  },
  tech: {
    fr: {
      items: [
        [24, "", " h", "d'autonomie sur une charge", 24],
        [1, "", "", "bouton, zéro réglage"],
        [6200, "+", "", "appareils livrés au Maroc"],
      ],
      source: "Fiche technique et chiffres de la boutique.",
    },
    ar: {
      items: [
        [24, "", "", "ساعة من الاستعمال بشحنة واحدة", 24],
        [1, "", "", "زرّ واحد، بلا أي إعداد"],
        [6200, "+", "", "جهاز وصل إلى زبنائنا في المغرب"],
      ],
      source: "المعطيات التقنية وأرقام المتجر.",
    },
    en: {
      items: [
        [24, "", " h", "of battery on one charge", 24],
        [1, "", "", "button, zero settings"],
        [6200, "+", "", "devices delivered in Morocco"],
      ],
      source: "Technical sheet and store figures.",
    },
  },
  kids: {
    fr: {
      items: [
        [6100, "+", "", "familles livrées partout au Maroc"],
        [3, "", "+", "ans et plus, l'âge recommandé"],
        [7, "", " j", "pour l'échanger, sans discussion"],
      ],
      source: STORE_SOURCE.fr,
    },
    ar: {
      items: [
        [6100, "+", "", "عائلة وصلها طلبها في كل المغرب"],
        [3, "", "+", "سنوات فما فوق، السن الموصى به"],
        [7, "", "", "أيام للتبديل دون نقاش"],
      ],
      source: STORE_SOURCE.ar,
    },
    en: {
      items: [
        [6100, "+", "", "families delivered across Morocco"],
        [3, "", "+", "years and up, the recommended age"],
        [7, "", " days", "to exchange it, no questions asked"],
      ],
      source: STORE_SOURCE.en,
    },
  },
  natural: {
    fr: {
      items: [
        [100, "", "%", "naturel, sans additif ni conservateur", 100],
        [1, "", "", "cuillère par jour suffit"],
        [180, "", "", "villes livrées au Maroc"],
      ],
      source: "Composition indiquée sur l'étiquette, chiffres de la boutique.",
    },
    ar: {
      items: [
        [100, "", "%", "طبيعي، بلا إضافات ولا مواد حافظة", 100],
        [1, "", "", "ملعقة في اليوم تكفي"],
        [180, "", "", "مدينة نوصل إليها في المغرب"],
      ],
      source: "التركيبة مكتوبة على الملصق، وأرقام المتجر.",
    },
    en: {
      items: [
        [100, "", "%", "natural, no additives or preservatives", 100],
        [1, "", "", "spoonful a day is enough"],
        [180, "", "", "cities we deliver to in Morocco"],
      ],
      source: "Composition as on the label; store figures.",
    },
  },
  general: {
    fr: {
      items: [
        [12400, "+", "", "commandes livrées"],
        [180, "", "", "villes desservies au Maroc"],
        [48, "", " h", "de délai moyen de livraison"],
      ],
      source: STORE_SOURCE.fr,
    },
    ar: {
      items: [
        [12400, "+", "", "طلبية وصلت إلى أصحابها"],
        [180, "", "", "مدينة نوصل إليها في المغرب"],
        [48, "", "", "ساعة هي متوسط مدة التوصيل"],
      ],
      source: STORE_SOURCE.ar,
    },
    en: {
      items: [
        [12400, "+", "", "orders delivered"],
        [180, "", "", "cities served in Morocco"],
        [48, "", " h", "average delivery time"],
      ],
      source: STORE_SOURCE.en,
    },
  },
};
