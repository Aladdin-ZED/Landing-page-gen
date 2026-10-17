/**
 * Default copy for the specs section: shared lines per language, and a typical spec sheet per product
 * family (written in ar · fr · en). Defaults are product-aware where the product says it: a size found
 * in the name or description ("30 ml", "250 g") replaces the family's typical one, the variant groups
 * become real rows ("Couleur: Noir · Sable"), and the SKU closes the sheet. Everything else is a
 * typical figure for the category — the section ships with `sample: true` until the merchant checks it.
 */
import type { IconName } from "@/landing/primitives";
import { isChoiceGroup, type Item, type Locale, type Product, type ProductCategory } from "@/lib/page/schema";
import { copyLang, fill, pick, shortName, type CopyLang, type Tri } from "../benefits/kit";
import { nameFitsTitle } from "../guarantee/model";
import { garmentOf, type Garment } from "../garment";
import type { Data } from "./schema";

type Pair = readonly [label: string, value: string];

interface FamilyCopy {
  /** title of the group that lists the rows */
  specsTitle: string;
  rows: readonly Pair[];
  highlights: readonly string[];
  /** "How to use" body (block text) */
  use: string;
  /** description fallback when the product has none */
  about: string;
}

type SizeKind = "volume" | "capacity" | "weight";

interface Family {
  /** the first row is a size slot that a size found on the product replaces */
  size?: SizeKind;
  specsIcon: IconName;
  useIcon: IconName;
  copy: Tri<FamilyCopy>;
  /** variant for products that run on a battery or a motor */
  powered?: { specsIcon: IconName; copy: Tri<FamilyCopy> };
}

type FamilyId = "care" | "scent" | "style" | "active" | "home" | "tech" | "kids" | "pets" | "natural" | "general";

const FAMILY_OF: Record<ProductCategory, FamilyId> = {
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
  pets: "pets",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
  other: "general",
};

/* ------------------------------------------------------------------ */
/* Shared lines                                                        */
/* ------------------------------------------------------------------ */

interface Common {
  kickers: readonly string[];
  titles: readonly string[];
  leads: readonly string[];
  description: string;
  details: string;
  use: string;
  delivery: string;
  deliveryBody: string;
  sku: string;
  size: Record<SizeKind, string>;
}

const COMMON: Tri<Common> = {
  ar: {
    kickers: ["بطاقة المنتج", "المواصفات", "بالتفصيل"],
    titles: ["كل ما يجب *معرفته*", "البطاقة *الكاملة*", "{short}، *بالتفصيل*"],
    leads: [
      "الأرقام والمكونات وطريقة التوصيل، بوضوح وفي نظرة واحدة.",
      "ما الذي سيصلك بالضبط، كيف تستعمله، ومتى يصل إلى باب دارك.",
    ],
    description: "الوصف",
    details: "المواصفات",
    use: "الاستعمال",
    delivery: "التوصيل",
    deliveryBody:
      "تدفع **نقدًا عند الاستلام**، ولا درهم قبل ذلك.\n- توصيل خلال 24–48 ساعة حتى باب الدار\n- تفتح الطرد وتتأكد منه قبل الدفع\n- مستشارنا يتصل بك لتأكيد الطلب\n- استبدال سهل خلال 7 أيام",
    sku: "المرجع",
    size: { volume: "السعة", capacity: "السعة", weight: "الوزن الصافي" },
  },
  fr: {
    kickers: ["Fiche produit", "Caractéristiques", "Dans le détail"],
    titles: ["Tout ce qu'il faut *savoir*", "La fiche *complète*", "{short}, *en détail*"],
    leads: [
      "Les chiffres, la composition et la livraison, clairement et en un coup d'œil.",
      "Ce que vous recevez exactement, comment l'utiliser, et quand il arrive chez vous.",
    ],
    description: "Description",
    details: "Détails",
    use: "Utilisation",
    delivery: "Livraison",
    deliveryBody:
      "Vous payez **en espèces à la livraison**, rien avant.\n- Livraison en 24–48 h, jusqu'à votre porte\n- Vous ouvrez et vérifiez le colis avant de payer\n- Un conseiller vous appelle pour confirmer la commande\n- Échange facile sous 7 jours",
    sku: "Référence",
    size: { volume: "Contenance", capacity: "Capacité", weight: "Poids net" },
  },
  en: {
    kickers: ["Product sheet", "Specifications", "In detail"],
    titles: ["Everything you need *to know*", "The *full* product sheet", "{short}, *in detail*"],
    leads: [
      "The numbers, what's inside and how delivery works, clear at a glance.",
      "Exactly what you receive, how to use it, and when it reaches your door.",
    ],
    description: "Details",
    details: "Specs",
    use: "How to use",
    delivery: "Delivery",
    deliveryBody:
      "You pay **cash on delivery**, nothing upfront.\n- Delivered in 24–48 h, right to your door\n- Open and check the parcel before you pay\n- An advisor calls to confirm your order\n- Easy exchange within 7 days",
    sku: "Reference",
    size: { volume: "Volume", capacity: "Capacity", weight: "Net weight" },
  },
};

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

const FAMILIES: Record<FamilyId, Family> = {
  care: {
    size: "volume",
    specsIcon: "drop",
    useIcon: "hand-heart",
    copy: {
      ar: {
        specsTitle: "التركيبة",
        rows: [
          ["السعة", "30 مل"],
          ["القوام", "خفيف، يتشرّب بلا لمعان دهني"],
          ["البشرة", "جميع الأنواع، حتى الحساسة"],
          ["بدون", "عطر مضاف، بارابين، سيليكون"],
          ["الصلاحية", "12 شهرًا بعد الفتح"],
        ],
        highlights: ["بدون بارابين", "قوام خفيف", "للاستعمال اليومي"],
        use: "- ضع كمية صغيرة على بشرة نظيفة وجافة\n- دلّك بلطف حتى يتشرّب تمامًا\n- صباحًا ومساءً، كل يوم",
        about: "تركيبة بسيطة وفعّالة، مصممة للاستعمال اليومي.",
      },
      fr: {
        specsTitle: "Composition",
        rows: [
          ["Contenance", "30 ml"],
          ["Texture", "Légère, pénètre sans graisser"],
          ["Peau", "Tous types, même sensibles"],
          ["Sans", "Parfum ajouté, parabènes, silicones"],
          ["Conservation", "12 mois après ouverture"],
        ],
        highlights: ["Sans parabènes", "Texture légère", "Usage quotidien"],
        use: "- Appliquez une petite quantité sur peau propre et sèche\n- Massez doucement jusqu'à absorption complète\n- Matin et soir, chaque jour",
        about: "Une formule courte et efficace, pensée pour le quotidien.",
      },
      en: {
        specsTitle: "Composition",
        rows: [
          ["Volume", "30 ml"],
          ["Texture", "Light, absorbs without residue"],
          ["Skin", "All types, even sensitive"],
          ["Free from", "Added fragrance, parabens, silicones"],
          ["Shelf life", "12 months after opening"],
        ],
        highlights: ["Paraben-free", "Light texture", "Everyday use"],
        use: "- Apply a small amount to clean, dry skin\n- Massage gently until fully absorbed\n- Morning and night, every day",
        about: "A short, effective formula made for every day.",
      },
    },
  },
  scent: {
    size: "volume",
    specsIcon: "drop",
    useIcon: "feather",
    copy: {
      ar: {
        specsTitle: "التركيبة",
        rows: [
          ["السعة", "50 مل"],
          ["التركيز", "أو دو بارفان"],
          ["الثبات", "من 10 إلى 12 ساعة"],
          ["الفوحان", "حاضر، دون مبالغة"],
          ["العائلة", "عنبرية خشبية"],
        ],
        highlights: ["أو دو بارفان", "ثبات 10–12 ساعة", "قارورة زجاجية"],
        use: "- رشّ من مسافة 15 سم على الرقبة والمعصمين\n- لا تفرك، دع العطر يستقر وحده\n- رشة على الملابس تطيل ثباته أكثر",
        about: "عطر دافئ يحتضنك ويتطوّر مع ساعات اليوم.",
      },
      fr: {
        specsTitle: "Composition",
        rows: [
          ["Contenance", "50 ml"],
          ["Concentration", "Eau de parfum"],
          ["Tenue", "10 à 12 heures"],
          ["Sillage", "Présent, jamais envahissant"],
          ["Famille", "Ambrée boisée"],
        ],
        highlights: ["Eau de parfum", "Tenue 10–12 h", "Flacon en verre"],
        use: "- Vaporisez à 15 cm, sur le cou et les poignets\n- Ne frottez pas : laissez le parfum se poser\n- Une touche sur vos vêtements le fait durer plus longtemps",
        about: "Un sillage chaud et enveloppant, qui évolue au fil de la journée.",
      },
      en: {
        specsTitle: "Composition",
        rows: [
          ["Volume", "50 ml"],
          ["Concentration", "Eau de parfum"],
          ["Longevity", "10 to 12 hours"],
          ["Sillage", "Noticeable, never loud"],
          ["Family", "Woody amber"],
        ],
        highlights: ["Eau de parfum", "Lasts 10–12 h", "Glass bottle"],
        use: "- Spray from 15 cm onto the neck and wrists\n- Don't rub: let the scent settle\n- A touch on your clothes makes it last even longer",
        about: "A warm, enveloping trail that unfolds through the day.",
      },
    },
  },
  style: {
    specsIcon: "gem",
    useIcon: "hand-heart",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["المادة", "فولاذ مقاوم للصدأ 316L"],
          ["التشطيب", "مطلي بالذهب، لمعان مرآة"],
          ["المقاس", "قابل للتعديل، مقاس موحّد"],
          ["يقاوم", "الماء، العرق والعطر"],
          ["التغليف", "في علبة أنيقة، جاهز للإهداء"],
        ],
        highlights: ["فولاذ 316L", "لا يسودّ", "علبة هدية"],
        use: "- انزعه قبل الدوش أو المسبح ليحافظ على لمعانه\n- امسحه بقطعة قماش ناعمة وجافة\n- احفظه في علبته بعيدًا عن الرطوبة",
        about: "قطعة صُممت لتلبسها كل يوم، وتلفت الأنظار.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Matière", "Acier inoxydable 316L"],
          ["Finition", "Plaqué or, poli miroir"],
          ["Taille", "Réglable, taille unique"],
          ["Résiste à", "L'eau, la sueur, le parfum"],
          ["Livré", "En écrin, prêt à offrir"],
        ],
        highlights: ["Acier 316L", "Ne noircit pas", "Écrin offert"],
        use: "- Retirez-le avant la douche ou la piscine pour garder l'éclat\n- Essuyez-le avec un chiffon doux et sec\n- Rangez-le dans son écrin, à l'abri de l'humidité",
        about: "Une pièce faite pour être portée tous les jours, et remarquée.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Material", "316L stainless steel"],
          ["Finish", "Gold-plated, mirror polish"],
          ["Size", "Adjustable, one size"],
          ["Resists", "Water, sweat, perfume"],
          ["Comes", "In a gift box, ready to give"],
        ],
        highlights: ["316L steel", "Won't tarnish", "Gift box"],
        use: "- Take it off before the shower or pool to keep the shine\n- Wipe with a soft, dry cloth\n- Store it in its box, away from moisture",
        about: "A piece made to be worn every day, and noticed.",
      },
    },
  },
  active: {
    specsIcon: "dumbbell",
    useIcon: "clock",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["المادة", "متينة، بلا رائحة"],
          ["الوزن", "خفيف، يدخل في أي حقيبة"],
          ["المستوى", "من المبتدئ إلى المتمرّس"],
          ["التنظيف", "ماء فاتر وصابون لطيف"],
          ["التخزين", "صغير الحجم، يُخزَّن في أي مكان"],
        ],
        highlights: ["بلا رائحة", "خفيف", "لكل المستويات"],
        use: "- سخّن جسمك 5 دقائق قبل البداية\n- ابدأ بهدوء ثم زِد الإيقاع\n- نظّفه بعد كل حصة",
        about: "مصمم للتمرين في الدار أو في القاعة، بكل بساطة.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Matière", "Résistante, sans odeur"],
          ["Poids", "Léger, tient dans un sac"],
          ["Niveau", "Débutant à confirmé"],
          ["Entretien", "Eau tiède et savon doux"],
          ["Rangement", "Compact, se range partout"],
        ],
        highlights: ["Sans odeur", "Léger", "Tous niveaux"],
        use: "- Échauffez-vous 5 minutes avant de commencer\n- Démarrez en douceur, puis augmentez le rythme\n- Nettoyez-le après chaque séance",
        about: "Pensé pour s'entraîner à la maison ou en salle, sans prise de tête.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Material", "Durable, odour-free"],
          ["Weight", "Light, fits any bag"],
          ["Level", "Beginner to advanced"],
          ["Care", "Warm water and mild soap"],
          ["Storage", "Compact, stores anywhere"],
        ],
        highlights: ["Odour-free", "Lightweight", "All levels"],
        use: "- Warm up for 5 minutes before you start\n- Begin gently, then pick up the pace\n- Clean it after every session",
        about: "Made for training at home or at the gym, without the fuss.",
      },
    },
    powered: {
      specsIcon: "bolt",
      copy: {
        ar: {
          specsTitle: "المواصفات",
          rows: [
            ["السرعات", "6 مستويات"],
            ["البطارية", "حتى 6 ساعات"],
            ["الشحن", "USB-C، خلال ساعتين"],
            ["مستوى الصوت", "أقل من 45 ديسيبل"],
            ["الوزن", "1 كغ"],
          ],
          highlights: ["لاسلكي", "شحن USB-C", "هادئ"],
          use: "- اشحنه بالكامل قبل أول استعمال\n- ابدأ بأخف مستوى، ثم زِد تدريجيًا\n- من 10 إلى 15 دقيقة تكفي في كل حصة",
          about: "مصمم للاسترجاع والتمارين في الدار، بلا معدات ثقيلة.",
        },
        fr: {
          specsTitle: "Détails",
          rows: [
            ["Vitesses", "6 niveaux"],
            ["Autonomie", "Jusqu'à 6 heures"],
            ["Recharge", "USB-C, en 2 heures"],
            ["Niveau sonore", "Moins de 45 dB"],
            ["Poids", "1 kg"],
          ],
          highlights: ["Sans fil", "Recharge USB-C", "Silencieux"],
          use: "- Chargez-le complètement avant la première séance\n- Commencez au niveau le plus doux, puis montez progressivement\n- 10 à 15 minutes par séance suffisent",
          about: "Pensé pour la récupération et l'entraînement à la maison, sans matériel encombrant.",
        },
        en: {
          specsTitle: "Specs",
          rows: [
            ["Speeds", "6 levels"],
            ["Battery", "Up to 6 hours"],
            ["Charging", "USB-C, 2 hours"],
            ["Noise", "Under 45 dB"],
            ["Weight", "1 kg"],
          ],
          highlights: ["Cordless", "USB-C charging", "Quiet"],
          use: "- Fully charge it before the first session\n- Start at the gentlest level, then build up\n- 10 to 15 minutes per session is enough",
          about: "Made for recovery and training at home, without bulky gear.",
        },
      },
    },
  },
  home: {
    size: "capacity",
    specsIcon: "box",
    useIcon: "check-hand",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["السعة", "واسعة، تكفي العائلة"],
          ["المادة", "متينة، سهلة التنظيف"],
          ["الحجم", "صغير، يُخزَّن في أي مكان"],
          ["التنظيف", "بالماء والصابون"],
          ["التركيب", "لا يحتاج تركيبًا، جاهز للاستعمال"],
        ],
        highlights: ["جاهز للاستعمال", "سهل التنظيف", "صغير الحجم"],
        use: "- أخرجه من العلبة، اغسله، وهو جاهز\n- نظّفه بالماء والصابون، بلا مواد خشنة\n- اتركه يجف في الهواء قبل تخزينه",
        about: "من أساسيات الدار، متين وسهل الاستعمال.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Capacité", "Généreuse, pour toute la famille"],
          ["Matière", "Robuste, facile à nettoyer"],
          ["Dimensions", "Compacte, se range partout"],
          ["Entretien", "À l'eau savonneuse"],
          ["Montage", "Aucun, prêt à l'emploi"],
        ],
        highlights: ["Prêt à l'emploi", "Facile à nettoyer", "Compact"],
        use: "- Déballez, rincez, c'est prêt\n- Nettoyez à l'eau savonneuse, sans produit abrasif\n- Laissez sécher à l'air avant de ranger",
        about: "Un indispensable de la maison, robuste et simple à vivre.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Capacity", "Generous, family-size"],
          ["Material", "Sturdy, easy to clean"],
          ["Size", "Compact, stores anywhere"],
          ["Care", "Soapy water"],
          ["Assembly", "None, ready to use"],
        ],
        highlights: ["Ready to use", "Easy to clean", "Compact"],
        use: "- Unbox, rinse, and it's ready\n- Clean with soapy water, nothing abrasive\n- Let it air-dry before storing",
        about: "A home essential: sturdy and easy to live with.",
      },
    },
    powered: {
      specsIcon: "bolt",
      copy: {
        ar: {
          specsTitle: "المواصفات",
          rows: [
            ["السعة", "380 مل"],
            ["القوة", "محرك هادئ، سرعتان"],
            ["الشحن", "USB-C، خلال 3 ساعات"],
            ["البطارية", "15 استعمالًا بشحنة واحدة"],
            ["المواد", "بدون BPA، سهلة الغسل"],
          ],
          highlights: ["لاسلكي", "شحن USB-C", "بدون BPA"],
          use: "- اشحنه بالكامل قبل أول استعمال\n- املأه دون تجاوز علامة الحد الأقصى\n- اغسله بالماء والصابون مباشرة بعد الاستعمال",
          about: "جهاز صغير يسهّل يومك، في الدار أو خارجها.",
        },
        fr: {
          specsTitle: "Détails",
          rows: [
            ["Capacité", "380 ml"],
            ["Puissance", "Moteur silencieux, 2 vitesses"],
            ["Recharge", "USB-C, en 3 heures"],
            ["Autonomie", "15 utilisations par charge"],
            ["Matériaux", "Sans BPA, faciles à laver"],
          ],
          highlights: ["Sans fil", "Recharge USB-C", "Sans BPA"],
          use: "- Chargez-le complètement avant la première utilisation\n- Remplissez sans dépasser le repère maximum\n- Rincez à l'eau savonneuse juste après usage",
          about: "Un appareil compact qui simplifie le quotidien, à la maison comme en déplacement.",
        },
        en: {
          specsTitle: "Specs",
          rows: [
            ["Capacity", "380 ml"],
            ["Power", "Quiet motor, 2 speeds"],
            ["Charging", "USB-C, 3 hours"],
            ["Battery", "15 uses per charge"],
            ["Materials", "BPA-free, easy to wash"],
          ],
          highlights: ["Cordless", "USB-C charging", "BPA-free"],
          use: "- Fully charge it before first use\n- Fill without passing the max line\n- Rinse with soapy water right after use",
          about: "A compact appliance that makes every day simpler, at home or on the go.",
        },
      },
    },
  },
  tech: {
    specsIcon: "ruler",
    useIcon: "check-hand",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["المواد", "ألومنيوم وبلاستيك ABS مقوّى"],
          ["الحجم", "صغير، يُمسك باليد"],
          ["التوافق", "عالمي"],
          ["التركيب", "دقيقتان، بلا أدوات"],
          ["داخل العلبة", "الملحقات ودليل الاستعمال"],
        ],
        highlights: ["عالمي", "بلا أدوات", "صغير الحجم"],
        use: "- أخرجه من العلبة وانزع أغشية الحماية\n- ركّبه في دقيقتين، بلا أدوات\n- امسحه بقطعة قماش جافة للتنظيف",
        about: "عملي، متين ومصمم ليدوم.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Matériaux", "Aluminium et ABS renforcé"],
          ["Dimensions", "Compact, tient dans la main"],
          ["Compatibilité", "Universelle"],
          ["Installation", "2 minutes, sans outil"],
          ["Dans la boîte", "Accessoires et notice"],
        ],
        highlights: ["Universel", "Sans outil", "Compact"],
        use: "- Sortez-le de la boîte et retirez les films de protection\n- Installez-le en 2 minutes, sans outil\n- Essuyez avec un chiffon sec pour l'entretien",
        about: "Pratique, solide et pensé pour durer.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Materials", "Aluminium and reinforced ABS"],
          ["Size", "Compact, fits in the hand"],
          ["Compatibility", "Universal"],
          ["Setup", "2 minutes, no tools"],
          ["In the box", "Accessories and guide"],
        ],
        highlights: ["Universal", "No tools", "Compact"],
        use: "- Unbox it and peel off the protective film\n- Set it up in 2 minutes, no tools\n- Wipe with a dry cloth to clean",
        about: "Practical, solid and built to last.",
      },
    },
    powered: {
      specsIcon: "battery",
      copy: {
        ar: {
          specsTitle: "المواصفات",
          rows: [
            ["البطارية", "حتى 10 ساعات"],
            ["الشحن", "USB-C سريع، 90 دقيقة"],
            ["التحكم", "بسيط، بزر واحد"],
            ["المواد", "ألومنيوم وبلاستيك ABS مقوّى"],
            ["داخل العلبة", "كابل USB-C ودليل الاستعمال"],
          ],
          highlights: ["شحن USB-C", "بطارية 10 ساعات", "جاهز للاستعمال"],
          use: "- اشحنه بالكامل قبل أول استعمال\n- ضغطة طويلة للتشغيل، ضغطة قصيرة لتغيير الوضع\n- احفظه في مكان جاف بعيدًا عن الحرارة",
          about: "تقنية بسيطة تشتغل من أول ما تفتح العلبة.",
        },
        fr: {
          specsTitle: "Détails",
          rows: [
            ["Batterie", "Jusqu'à 10 heures"],
            ["Recharge", "USB-C rapide, 90 min"],
            ["Commandes", "Simples, un seul bouton"],
            ["Matériaux", "Aluminium et ABS renforcé"],
            ["Dans la boîte", "Câble USB-C, notice"],
          ],
          highlights: ["Recharge USB-C", "Autonomie 10 h", "Prêt à l'emploi"],
          use: "- Chargez-le complètement avant la première utilisation\n- Un appui long pour allumer, un appui court pour changer de mode\n- Rangez-le au sec, loin de la chaleur",
          about: "Une technologie simple, qui marche dès la sortie de la boîte.",
        },
        en: {
          specsTitle: "Specs",
          rows: [
            ["Battery", "Up to 10 hours"],
            ["Charging", "Fast USB-C, 90 min"],
            ["Controls", "Simple, one button"],
            ["Materials", "Aluminium and reinforced ABS"],
            ["In the box", "USB-C cable, guide"],
          ],
          highlights: ["USB-C charging", "10 h battery", "Ready to use"],
          use: "- Fully charge it before first use\n- Long press to switch on, short press to change mode\n- Store it dry, away from heat",
          about: "Simple tech that works straight out of the box.",
        },
      },
    },
  },
  kids: {
    specsIcon: "shield-check",
    useIcon: "baby",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["العمر", "من 3 سنوات"],
          ["المادة", "سيليكون غذائي، بدون BPA"],
          ["الأمان", "حواف مستديرة، قطع صغيرة مثبّتة"],
          ["التنظيف", "يُغسل بالماء الفاتر"],
          ["الحجم", "خفيف، يدخل في الحقيبة"],
        ],
        highlights: ["بدون BPA", "حواف مستديرة", "قابل للغسل"],
        use: "- اغسله بالماء الفاتر قبل أول استعمال\n- يُستعمل تحت مراقبة شخص بالغ\n- تأكد من حالته بانتظام",
        about: "مصمم للأيادي الصغيرة: ناعم، متين ومطمئن للوالدين.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Âge", "Dès 3 ans"],
          ["Matière", "Silicone alimentaire, sans BPA"],
          ["Sécurité", "Bords arrondis, petites pièces fixées"],
          ["Entretien", "Lavable à l'eau tiède"],
          ["Format", "Léger, se glisse dans le sac"],
        ],
        highlights: ["Sans BPA", "Bords arrondis", "Lavable"],
        use: "- Lavez-le à l'eau tiède avant la première utilisation\n- Utilisez-le sous la surveillance d'un adulte\n- Vérifiez régulièrement son bon état",
        about: "Pensé pour les petites mains : doux, solide et rassurant pour les parents.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Age", "3 years and up"],
          ["Material", "Food-grade silicone, BPA-free"],
          ["Safety", "Rounded edges, small parts secured"],
          ["Care", "Washable in warm water"],
          ["Size", "Light, slips into a bag"],
        ],
        highlights: ["BPA-free", "Rounded edges", "Washable"],
        use: "- Wash in warm water before first use\n- Use under adult supervision\n- Check its condition regularly",
        about: "Made for little hands: soft, sturdy and reassuring for parents.",
      },
    },
  },
  pets: {
    specsIcon: "shield-check",
    useIcon: "paw",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["مناسب لـ", "القطط والكلاب بجميع الأحجام"],
          ["المادة", "متينة وغير سامة"],
          ["التنظيف", "يُغسل بالماء والصابون"],
          ["الحجم", "خفيف، سهل الحمل"],
          ["الرائحة", "بلا رائحة، حتى وهو جديد"],
        ],
        highlights: ["غير سام", "قابل للغسل", "متين"],
        use: "- دع حيوانك يكتشفه على راحته\n- اغسله كل أسبوع بالماء والصابون\n- استبدله إذا تلف",
        about: "مصمم لراحة حيوانك الأليف، ولراحة بالك.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Pour", "Chiens et chats, toutes tailles"],
          ["Matière", "Résistante, non toxique"],
          ["Entretien", "Lavable à l'eau savonneuse"],
          ["Format", "Léger, facile à transporter"],
          ["Odeur", "Aucune, même neuf"],
        ],
        highlights: ["Non toxique", "Lavable", "Résistant"],
        use: "- Laissez votre animal le découvrir à son rythme\n- Lavez-le chaque semaine à l'eau savonneuse\n- Remplacez-le s'il est abîmé",
        about: "Pensé pour le confort de votre animal, et pour votre tranquillité.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["For", "Cats and dogs, all sizes"],
          ["Material", "Durable, non-toxic"],
          ["Care", "Washable with soapy water"],
          ["Size", "Light, easy to carry"],
          ["Smell", "None, even when new"],
        ],
        highlights: ["Non-toxic", "Washable", "Durable"],
        use: "- Let your pet discover it at its own pace\n- Wash it weekly with soapy water\n- Replace it if damaged",
        about: "Made for your pet's comfort, and your peace of mind.",
      },
    },
  },
  natural: {
    size: "weight",
    specsIcon: "leaf",
    useIcon: "sun",
    copy: {
      ar: {
        specsTitle: "التركيبة",
        rows: [
          ["الوزن الصافي", "250 غ"],
          ["المصدر", "المغرب"],
          ["التركيبة", "طبيعية 100%، بدون إضافات"],
          ["العبوة", "برطمان زجاجي يُغلق بإحكام"],
          ["الحفظ", "في مكان جاف، بعيدًا عن الضوء"],
        ],
        highlights: ["طبيعي 100%", "من المغرب", "بدون إضافات"],
        use: "- اتبع الكمية المشار إليها على العبوة\n- أغلق العبوة جيدًا بعد كل استعمال\n- احفظه في مكان جاف بعيدًا عن الحرارة",
        about: "منتج بسيط وطبيعي، مختار بعناية.",
      },
      fr: {
        specsTitle: "Composition",
        rows: [
          ["Poids net", "250 g"],
          ["Origine", "Maroc"],
          ["Composition", "100 % naturelle, sans additif"],
          ["Format", "Pot en verre refermable"],
          ["Conservation", "Au sec, à l'abri de la lumière"],
        ],
        highlights: ["100 % naturel", "Origine Maroc", "Sans additif"],
        use: "- Suivez la dose indiquée sur l'emballage\n- Refermez bien après chaque usage\n- Conservez au sec, loin de la chaleur",
        about: "Un produit simple et naturel, sélectionné avec soin.",
      },
      en: {
        specsTitle: "Composition",
        rows: [
          ["Net weight", "250 g"],
          ["Origin", "Morocco"],
          ["Composition", "100% natural, no additives"],
          ["Packaging", "Resealable glass jar"],
          ["Storage", "Dry, away from light"],
        ],
        highlights: ["100% natural", "From Morocco", "No additives"],
        use: "- Follow the serving shown on the pack\n- Close it tightly after each use\n- Keep it dry, away from heat",
        about: "A simple, natural product, carefully sourced.",
      },
    },
  },
  general: {
    specsIcon: "ruler",
    useIcon: "check-hand",
    copy: {
      ar: {
        specsTitle: "المواصفات",
        rows: [
          ["المادة", "متينة، بتشطيب متقن"],
          ["الحجم", "صغير، يُخزَّن في أي مكان"],
          ["التنظيف", "بسيط، بالماء والصابون"],
          ["داخل العلبة", "المنتج ودليل الاستعمال"],
          ["الاستعمال", "يومي"],
        ],
        highlights: ["جاهز للاستعمال", "تشطيب متقن", "صغير الحجم"],
        use: "- أخرجه من العلبة: هو جاهز للاستعمال\n- اتبع الدليل للإعدادات الأولى\n- احفظه في مكان جاف بعد الاستعمال",
        about: "منتج عملي، بتشطيب متقن، مصمم ليدوم.",
      },
      fr: {
        specsTitle: "Détails",
        rows: [
          ["Matière", "Robuste, finitions soignées"],
          ["Dimensions", "Compact, se range partout"],
          ["Entretien", "Simple, à l'eau savonneuse"],
          ["Dans la boîte", "Le produit et sa notice"],
          ["Usage", "Au quotidien"],
        ],
        highlights: ["Prêt à l'emploi", "Finitions soignées", "Compact"],
        use: "- Déballez-le : il est prêt à l'emploi\n- Suivez la notice pour les premiers réglages\n- Rangez-le au sec après usage",
        about: "Un produit pratique, bien fini, pensé pour durer.",
      },
      en: {
        specsTitle: "Specs",
        rows: [
          ["Material", "Sturdy, carefully finished"],
          ["Size", "Compact, stores anywhere"],
          ["Care", "Simple, soapy water"],
          ["In the box", "The product and its guide"],
          ["Use", "Every day"],
        ],
        highlights: ["Ready to use", "Fine finish", "Compact"],
        use: "- Unbox it: it's ready to use\n- Follow the guide for the first settings\n- Store it dry after use",
        about: "A practical, well-finished product built to last.",
      },
    },
  },
};

/* ------------------------------------------------------------------ */
/* Product facts                                                       */
/* ------------------------------------------------------------------ */

/** Runs on a battery or a motor (picks the "powered" sheet where a family has one). */
const POWERED = /batter|usb|recharg|rechargeable|sans fil|cordless|wireless|moteur|motor|watt|électri|electri|بطارية|شحن|لاسلكي|محرك|كهرب/i;

const VOLUME = new Set(["ml", "cl", "l", "مل", "ملل", "لتر"]);

/**
 * First size written on the product ("30 ml", "250 g", "1,5 L", "50 مل") — name first, then
 * description. Returns the text as written (normalized spacing) and whether it is a volume.
 */
export function sizeOf(product: Pick<Product, "name" | "description">): { text: string; volume: boolean } | null {
  const re = /(\d{1,4}(?:[.,]\d{1,2})?)\s?(ml|cl|kg|g|l|ملل|مل|لتر|كلغ|كغ|غرام|غ)(?![\p{L}\p{N}])/iu;
  for (const src of [product.name, product.description ?? ""]) {
    const m = re.exec(src);
    if (m) {
      const unit = m[2]!;
      const lower = unit.toLowerCase();
      return { text: `${m[1]} ${lower === "l" ? "L" : lower}`, volume: VOLUME.has(lower) };
    }
  }
  return null;
}

/** Cut a block text at a line boundary so it fits `max` characters. */
function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const nl = cut.lastIndexOf("\n");
  return (nl > max * 0.5 ? cut.slice(0, nl) : cut.slice(0, Math.max(cut.lastIndexOf(" "), 1))).trim();
}

const clipLine = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…");

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export function specsDefaults(input: { locale: Locale; product: Product; item: Item; rng: () => number }): Data {
  const { product, item, rng } = input;
  const lang: CopyLang = copyLang(input.locale);
  const c = COMMON[lang];
  const fam = FAMILIES[FAMILY_OF[product.category] ?? "general"];
  // a garment has its own sheet (fabric, cut, size, care), never the jewelry or toy one
  const garment = garmentOf(product);
  const gs = garment ? garmentSheet(lang, garment) : null;
  const powered = !gs && !!fam.powered && POWERED.test(`${product.name}\n${product.description ?? ""}`);
  const f = gs ?? (powered ? fam.powered!.copy[lang] : fam.copy[lang]);
  const specsIcon: IconName = gs ? "feather" : powered ? fam.powered!.specsIcon : fam.specsIcon;
  const vars = { name: product.name, short: shortName(product.name) };

  // real facts first: the product's variant groups and its reference
  const variantRows = item.groups.filter(isChoiceGroup).slice(0, 2).map((g) => ({
    label: clipLine(g.name, 40),
    value: clipLine(g.options.map((o) => o.label).join(" · "), 90),
  }));
  const taken = new Set(variantRows.map((r) => r.label.toLowerCase()));
  const size = !gs && fam.size ? sizeOf(product) : null;
  const familyRows = f.rows
    .map(([label, value], i) => {
      if (i === 0 && size) {
        const kind: SizeKind = size.volume ? (fam.size === "weight" ? "volume" : fam.size!) : "weight";
        return { label: c.size[kind], value: size.text };
      }
      return { label, value };
    })
    .filter((r) => !taken.has(r.label.toLowerCase()));
  const rows = [...familyRows, ...variantRows];
  if (item.sku?.trim()) rows.push({ label: c.sku, value: clipLine(item.sku.trim(), 90) });

  const about = product.description?.trim() ? clip(product.description, 1200) : f.about;
  return {
    kicker: pick(rng, c.kickers),
    // a title naming the product only when the name reads well in the page's own display type:
    // short, and in the page's script ("Abaya de prière…، بالتفصيل" breaks into a mixed-direction poster)
    title: fill(pick(rng, nameFitsTitle(lang, vars.short) ? c.titles : c.titles.filter((t) => !t.includes("{short}"))), vars).slice(0, 140),
    lead: pick(rng, gs?.leads ?? c.leads),
    rows: rows.slice(0, 10),
    groups: [
      { title: c.description, icon: "info", kind: "text", body: about },
      { title: f.specsTitle, icon: specsIcon, kind: "specs", body: "" },
      { title: gs?.careTitle ?? c.use, icon: gs ? "drop" : fam.useIcon, kind: "text", body: f.use },
      { title: c.delivery, icon: "truck", kind: "text", body: c.deliveryBody },
    ],
    highlights: f.highlights.map((text) => ({ text })),
    note: "",
    cta: true,
    ctaLabel: "",
    sample: true,
  };
}

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts)                                            */
/* ------------------------------------------------------------------ */

interface GarmentSheet {
  leads: readonly string[];
  specsTitle: string;
  /** title of the care group (replaces "How to use": a garment is looked after, not operated) */
  careTitle: string;
  fabric: Pair;
  shape: { prayer: Pair; modest: Pair; drape: Pair; heritage: Pair; plain: Pair };
  detail: { lace: Pair; embroidery: Pair; plain: Pair };
  size: { adult: Pair; child: Pair };
  care: Pair;
  use: { prayer: Pair };
  highlights: { prayer: readonly string[]; modest: readonly string[]; kids: readonly string[]; plain: readonly string[] };
  careBody: string;
  laceCare: string;
  about: { prayer: string; modest: string; plain: string };
}

const GARMENT_SHEET: Tri<GarmentSheet> = {
  fr: {
    leads: ["Le tissu, la coupe, la taille et la livraison, en un coup d'œil.", "Ce que vous recevez exactement, comment en prendre soin, et quand il arrive chez vous."],
    specsTitle: "Tissu & coupe",
    careTitle: "Entretien",
    fabric: ["Tissu", "Fluide et doux, ne colle pas"],
    shape: {
      prayer: ["Coupe", "Ample et couvrante, pour la prière"],
      modest: ["Coupe", "Ample et couvrante"],
      drape: ["Tombé", "Se drape et tient en place"],
      heritage: ["Coupe", "Lignes traditionnelles, facile à porter"],
      plain: ["Coupe", "Tombe juste, sans serrer"],
    },
    detail: { lace: ["Détails", "Dentelle fine"], embroidery: ["Détails", "Broderie"], plain: ["Finitions", "Coutures nettes, ourlets soignés"] },
    size: { adult: ["Taille", "Selon le guide, revue à l'appel de confirmation"], child: ["Taille", "Selon l'âge, revue à l'appel de confirmation"] },
    care: ["Entretien", "Lavage délicat à 30 °C"],
    use: { prayer: ["Usage", "La prière et la maison"] },
    highlights: {
      prayer: ["Ample et couvrante", "Tissu doux", "Pour la prière"],
      modest: ["Ample et couvrante", "Tissu doux", "Lavage facile"],
      kids: ["Tissu doux", "Facile à enfiler", "Lavage facile"],
      plain: ["Tissu doux", "Coupe facile", "Lavage facile"],
    },
    careBody: "- Lavez à 30 °C, en cycle délicat, sur l'envers\n- Séchez à plat ou sur un cintre, à l'ombre\n- Repassez à basse température",
    laceCare: "- Sans insister sur la dentelle",
    about: {
      prayer: "Une tenue de prière ample et douce, pensée pour bouger librement et se porter au quotidien.",
      modest: "Une pièce ample et couvrante, douce à porter du matin au soir.",
      plain: "Une pièce douce et facile à porter, pensée pour le quotidien.",
    },
  },
  ar: {
    leads: ["القماش والقصّة والمقاس والتوصيل، في نظرة واحدة.", "ما الذي سيصلك بالضبط، كيف تعتني به، ومتى يصل إلى باب دارك."],
    specsTitle: "القماش والقصّة",
    careTitle: "العناية",
    fabric: ["القماش", "ناعم ومنسدل، لا يلتصق بالجسم"],
    shape: {
      prayer: ["القصّة", "واسعة وساترة، مناسبة للصلاة"],
      modest: ["القصّة", "واسعة وساترة"],
      drape: ["الانسدال", "يُلفّ بسهولة ويثبت في مكانه"],
      heritage: ["القصّة", "خطوط تقليدية، سهلة اللبس"],
      plain: ["القصّة", "تنسدل جيدًا دون أن تضيق"],
    },
    detail: { lace: ["التفاصيل", "دانتيل رقيق"], embroidery: ["التفاصيل", "طرز"], plain: ["التشطيب", "خياطة نظيفة وحواف متقنة"] },
    size: { adult: ["المقاس", "حسب الدليل، ونراجعه معك في مكالمة التأكيد"], child: ["المقاس", "حسب العمر، ونراجعه معك في مكالمة التأكيد"] },
    care: ["العناية", "غسيل لطيف على 30 درجة"],
    use: { prayer: ["الاستعمال", "للصلاة وللبيت"] },
    highlights: {
      prayer: ["واسعة وساترة", "قماش ناعم", "مناسبة للصلاة"],
      modest: ["واسعة وساترة", "قماش ناعم", "سهلة الغسل"],
      kids: ["قماش ناعم", "سهلة اللبس", "سهلة الغسل"],
      plain: ["قماش ناعم", "قصّة مريحة", "سهلة الغسل"],
    },
    careBody: "- اغسلها على 30 درجة، ببرنامج لطيف، على الوجه الداخلي\n- جفّفها مبسوطة أو على علّاقة، بعيدًا عن الشمس\n- كوِها على حرارة منخفضة",
    laceCare: "- دون الضغط على الدانتيل",
    about: {
      prayer: "لباس صلاة واسع وناعم، مصمَّم لحرية الحركة وللاستعمال اليومي.",
      modest: "قطعة واسعة وساترة، ناعمة في اللبس من الصباح إلى المساء.",
      plain: "قطعة ناعمة وسهلة اللبس، مصمَّمة للاستعمال اليومي.",
    },
  },
  en: {
    leads: ["Fabric, cut, size and delivery, at a glance.", "Exactly what you receive, how to care for it, and when it reaches your door."],
    specsTitle: "Fabric & cut",
    careTitle: "Care",
    fabric: ["Fabric", "Soft and fluid, never clingy"],
    shape: {
      prayer: ["Cut", "Loose and covering, made for prayer"],
      modest: ["Cut", "Loose and covering"],
      drape: ["Drape", "Wraps easily and stays put"],
      heritage: ["Cut", "Traditional lines, easy to wear"],
      plain: ["Cut", "Falls right, never tight"],
    },
    detail: { lace: ["Details", "Fine lace"], embroidery: ["Details", "Embroidery"], plain: ["Finishing", "Clean seams, neat hems"] },
    size: { adult: ["Size", "See the guide, checked on the confirmation call"], child: ["Size", "By age, checked on the confirmation call"] },
    care: ["Care", "Gentle wash at 30 °C"],
    use: { prayer: ["Use", "Prayer and home"] },
    highlights: {
      prayer: ["Loose and covering", "Soft fabric", "Made for prayer"],
      modest: ["Loose and covering", "Soft fabric", "Easy care"],
      kids: ["Soft fabric", "Easy to put on", "Easy care"],
      plain: ["Soft fabric", "Easy cut", "Easy care"],
    },
    careBody: "- Wash at 30 °C on a gentle cycle, inside out\n- Dry flat or on a hanger, out of the sun\n- Iron on a low setting",
    laceCare: "- Go lightly over the lace",
    about: {
      prayer: "A loose, soft prayer outfit, made to move freely and to wear every day.",
      modest: "A loose, covering piece, soft to wear from morning to night.",
      plain: "A soft, easy-to-wear piece made for every day.",
    },
  },
};

/** The spec sheet of a garment: fabric, shape, detail, size, care (+ use for prayer wear). */
function garmentSheet(lang: CopyLang, g: Garment): FamilyCopy & { careTitle: string; leads: readonly string[] } {
  const c = GARMENT_SHEET[lang];
  const shape = g.scarf ? c.shape.drape : g.prayer ? c.shape.prayer : g.modest ? c.shape.modest : g.heritage ? c.shape.heritage : c.shape.plain;
  const detail = g.lace ? c.detail.lace : g.embroidery ? c.detail.embroidery : c.detail.plain;
  const rows: Pair[] = [c.fabric, shape, detail, ...(g.scarf ? [] : [g.kids ? c.size.child : c.size.adult]), c.care, ...(g.prayer ? [c.use.prayer] : [])];
  const highlights = g.prayer ? c.highlights.prayer : g.kids ? c.highlights.kids : g.modest ? c.highlights.modest : c.highlights.plain;
  return {
    leads: c.leads,
    specsTitle: c.specsTitle,
    careTitle: c.careTitle,
    rows,
    highlights,
    use: g.lace ? `${c.careBody}\n${c.laceCare}` : c.careBody,
    about: g.prayer ? c.about.prayer : g.modest ? c.about.modest : c.about.plain,
  };
}
