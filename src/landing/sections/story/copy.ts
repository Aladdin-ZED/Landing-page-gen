/**
 * Default copy for the story section, per product family and language. Written in the shop's "we"
 * voice so it reads right signed by the store itself ("L'équipe …") or, when the store has no name
 * yet, unsigned (parts.tsx hides the byline). Garments have their own voice (garmentStory). Short,
 * concrete, sensory; COD reassurance closes the story. {short} = short product name.
 * French punctuation and figures like "10 s" use no-break spaces (U+00A0), so they never wrap apart.
 */
import type { CopyLang, Family, Tri } from "../benefits/kit";
import type { Garment } from "../garment";

export interface StoryFamilyCopy {
  titles: readonly string[];
  text: string;
  /** manifesto lines (one *emphasis* each, giant type) */
  statements: readonly string[];
  /** [value, label] — usage facts, never performance claims */
  facts: readonly (readonly [string, string])[];
}

export interface StoryCommonCopy {
  kickers: readonly string[];
  ps: string;
}

/** Built-in microcopy (not merchant content, so not in the schema). */
export interface StoryMicrocopy {
  /** signature when none is typed — {store} = store name */
  team: string;
  /** small label before the P.S. line */
  psLabel: string;
}

export const STORY_UI: Tri<StoryMicrocopy> = {
  fr: { team: "L'équipe {store}", psLabel: "P.-S." },
  ar: { team: "فريق {store}", psLabel: "ملاحظة" },
  en: { team: "The {store} team", psLabel: "P.S." },
};

export const COMMON: Tri<StoryCommonCopy> = {
  fr: {
    kickers: ["Notre histoire", "Pourquoi on l'a fait", "L'idée de départ"],
    ps: "Vous ne payez qu'à la livraison, une fois votre commande entre vos mains.",
  },
  ar: {
    kickers: ["قصتنا", "لماذا صنعناه", "من أين بدأت الفكرة"],
    ps: "لا تدفع إلا عند الاستلام، حين يكون طلبك بين يديك.",
  },
  en: {
    kickers: ["Our story", "Why we made it", "Where it started"],
    ps: "You only pay on delivery, once your order is in your hands.",
  },
};

const DELIVERY: Tri<readonly [string, string]> = {
  fr: ["24–48 h", "livré chez vous"],
  ar: ["24–48", "ساعة حتى باب دارك"],
  en: ["24–48 h", "to your door"],
};

export const FAMILY_COPY: Record<Family, Tri<StoryFamilyCopy>> = {
  care: {
    fr: {
      titles: ["On voulait une routine plus courte, *pas plus chère*", "Tout est parti d'une envie simple : une peau *qui respire*"],
      text:
        "Tout a commencé devant une étagère trop pleine : des crèmes chères, des parfums lourds, des promesses en petits caractères. On a cherché l'inverse : peu d'ingrédients, une texture qui pénètre vite, un geste qui tient en dix secondes.\n\n" +
        "C'est devenu {short}. On le prépare, on l'emballe et on vous le livre nous-mêmes : vous ouvrez, vous vérifiez, puis vous payez.",
      statements: [
        "Moins de flacons, *plus de résultats*. Une formule courte, un geste simple, une peau qui change pour de vrai.",
        "Pas de miracle promis. Juste *une peau confortable*, matin et soir, et rien à cacher sur l'étiquette.",
      ],
      facts: [["1", "geste, matin et soir"], ["10 s", "pour l'appliquer"], DELIVERY.fr],
    },
    ar: {
      titles: ["أردنا روتينًا أقصر، *لا أغلى*", "بدأ كل شيء برغبة بسيطة: بشرة *تتنفّس*"],
      text:
        "بدأت الحكاية أمام رفّ مزدحم: كريمات غالية، عطور ثقيلة، ووعود مكتوبة بخط صغير. فبحثنا عن العكس: مكوّنات قليلة، قوام يتشرّبه الجلد بسرعة، وخطوة لا تأخذ أكثر من عشر ثوانٍ.\n\n" +
        "هكذا وُلد {short}. نحضّره ونغلّفه ونوصله إليك بأنفسنا: تفتح الطرد، تتأكد بعينك، ثم تدفع.",
      statements: [
        "قارورات أقل، *ونتيجة أوضح*. تركيبة قصيرة، خطوة بسيطة، وبشرة تتغيّر فعلًا.",
        "لا نعدك بالمعجزات. نعدك *ببشرة مرتاحة* صباحًا ومساءً، ولا شيء نخفيه على الملصق.",
      ],
      facts: [["1", "خطوة صباحًا ومساءً"], ["10 ثوانٍ", "للاستعمال"], DELIVERY.ar],
    },
    en: {
      titles: ["We wanted a *shorter* routine, not a pricier one", "It started with a simple wish: skin that *can breathe*"],
      text:
        "It started in front of an overcrowded shelf: pricey creams, heavy scents, promises in small print. We went the other way: few ingredients, a texture that sinks in fast, a step that takes ten seconds.\n\n" +
        "That became {short}. We prepare it, pack it and deliver it ourselves: you open it, you check it, then you pay.",
      statements: [
        "Fewer bottles, *better results*. A short formula, a simple step, skin that really changes.",
        "No miracles promised. Just *comfortable skin*, morning and night, and nothing to hide on the label.",
      ],
      facts: [["1", "step, morning and night"], ["10 s", "to apply"], DELIVERY.en],
    },
  },
  scent: {
    fr: {
      titles: ["Un parfum qu'on a voulu *porter longtemps*", "L'histoire d'une odeur qui *reste* après vous"],
      text:
        "On voulait un parfum qui ne crie pas, mais qu'on remarque : une ouverture lumineuse, un cœur chaud, un fond qui tient jusqu'au soir. Des dizaines d'essais plus tard, l'équilibre était là.\n\n" +
        "{short} se porte près de la peau et se révèle avec les heures. On vous l'envoie bien protégé, et vous ne payez qu'après l'avoir reçu.",
      statements: [
        "Un parfum ne se montre pas, *il se souvient*. Le vôtre restera dans la pièce bien après votre départ.",
        "Pas de sillage criard. *Une signature*, douce et tenace, qui vous ressemble du matin au soir.",
      ],
      facts: [["3", "temps : tête, cœur, fond"], ["2", "pulvérisations suffisent"], DELIVERY.fr],
    },
    ar: {
      titles: ["عطر أردناه أن *يدوم طويلًا*", "حكاية رائحة *تبقى* بعد أن تغادر"],
      text:
        "أردنا عطرًا لا يصرخ، لكنه يُلاحَظ: افتتاحية مضيئة، قلب دافئ، وقاعدة تثبت حتى المساء. بعد عشرات التجارب، وجدنا التوازن.\n\n" +
        "{short} يُوضع قريبًا من البشرة ويتكشّف مع الساعات. نرسله إليك محميًّا جيدًا، ولا تدفع إلا بعد أن تستلمه.",
      statements: [
        "العطر لا يُعرَض، *بل يُتذكَّر*. عطرك سيبقى في المكان بعد خروجك بوقت طويل.",
        "لا فوحان صاخب. *بصمة* ناعمة وثابتة، تشبهك من الصباح إلى المساء.",
      ],
      facts: [["3", "طبقات: مقدمة، قلب، قاعدة"], ["2", "رشّتان تكفيان"], DELIVERY.ar],
    },
    en: {
      titles: ["A scent we wanted you to *wear for hours*", "The story of a scent that *stays* after you leave"],
      text:
        "We wanted a perfume that doesn't shout but gets noticed: a bright opening, a warm heart, a base that lasts into the evening. Dozens of trials later, the balance was there.\n\n" +
        "{short} sits close to the skin and unfolds over the hours. We ship it well protected, and you only pay once it's in your hands.",
      statements: [
        "A perfume isn't shown, *it's remembered*. Yours will linger in the room long after you've gone.",
        "No loud trail. *A signature*, soft and lasting, that feels like you from morning to night.",
      ],
      facts: [["3", "layers: top, heart, base"], ["2", "sprays are enough"], DELIVERY.en],
    },
  },
  style: {
    fr: {
      titles: ["Une pièce pensée pour tous les jours, *pas pour un tiroir*", "On l'a dessinée pour qu'elle *vous suive* partout"],
      text:
        "On en avait assez des accessoires qui brillent une semaine puis finissent au fond d'un tiroir. Alors on a pris le temps : des finitions nettes, des proportions justes, une matière qui vieillit bien.\n\n" +
        "{short} se porte au bureau comme le week-end. On vous le livre soigneusement emballé : vous le découvrez, vous vérifiez, puis vous payez.",
      statements: [
        "Le style, c'est *ce qu'on garde*. Une pièce juste vaut mieux que dix achats d'un soir.",
        "Des lignes nettes, des finitions honnêtes, et *une pièce qu'on porte* au lieu de la ranger.",
      ],
      facts: [["1", "pièce, dix façons de la porter"], ["7/7", "du bureau au week-end"], DELIVERY.fr],
    },
    ar: {
      titles: ["قطعة صُمّمت لكل يوم، *لا للدرج*", "رسمناها لكي *ترافقك* أينما ذهبت"],
      text:
        "سئمنا الإكسسوارات التي تلمع أسبوعًا ثم تنتهي في قاع الدرج. فأخذنا وقتنا: تشطيبات دقيقة، مقاسات مدروسة، وخامة تبقى جميلة مع الأيام.\n\n" +
        "{short} يناسب العمل كما يناسب عطلة نهاية الأسبوع. نوصله إليك مغلّفًا بعناية: تكتشفه، تتأكد منه، ثم تدفع.",
      statements: [
        "الأناقة هي *ما نحتفظ به*. قطعة واحدة مدروسة أفضل من عشر مشتريات عابرة.",
        "خطوط نظيفة، تشطيب صادق، و*قطعة نلبسها* بدل أن نخبّئها.",
      ],
      facts: [["1", "قطعة، عشر إطلالات"], ["7/7", "من العمل إلى العطلة"], DELIVERY.ar],
    },
    en: {
      titles: ["A piece made for every day, *not for a drawer*", "We designed it to *go everywhere* with you"],
      text:
        "We were tired of accessories that shine for a week, then end up at the back of a drawer. So we took our time: clean finishes, the right proportions, a material that ages well.\n\n" +
        "{short} works at the office as well as on the weekend. We deliver it carefully packed: you unbox it, you check it, then you pay.",
      statements: [
        "Style is *what you keep*. One right piece beats ten impulse buys.",
        "Clean lines, honest finishes, and *a piece you wear* instead of storing it.",
      ],
      facts: [["1", "piece, ten ways to wear it"], ["7/7", "office to weekend"], DELIVERY.en],
    },
  },
  active: {
    fr: {
      titles: ["Né sur le terrain, pas *dans un catalogue*", "On l'a fait pour les muscles *qui ne s'arrêtent pas*"],
      text:
        "Tout est parti des lendemains de séance : des jambes lourdes, un dos noué, et des rendez-vous chez le kiné introuvables. On voulait la même récupération, à la maison, en quelques minutes.\n\n" +
        "On a testé {short} pendant des semaines d'entraînement avant qu'il arrive chez vous. Livraison rapide, et vous payez seulement à la réception.",
      statements: [
        "La performance commence *après l'effort*. Récupérez vite, revenez plus fort, recommencez demain.",
        "Pas besoin d'un cabinet. *Dix minutes*, un appareil, et des muscles prêts pour la suite.",
      ],
      facts: [["10 min", "par séance"], ["0", "rendez-vous à prendre"], DELIVERY.fr],
    },
    ar: {
      titles: ["وُلد في الميدان، لا *في كتالوج*", "صنعناه لعضلات *لا تتوقف*"],
      text:
        "بدأ كل شيء في صباحات ما بعد التمرين: أرجل ثقيلة، ظهر مشدود، ومواعيد ترويض طبي يصعب الحصول عليها. أردنا نفس الاسترجاع، في البيت، وفي دقائق.\n\n" +
        "جرّبنا {short} لأسابيع من التمارين قبل أن يصل إليك. توصيل سريع، ولا تدفع إلا عند الاستلام.",
      statements: [
        "الأداء يبدأ *بعد المجهود*. استرجع بسرعة، عُد أقوى، وابدأ من جديد غدًا.",
        "لا حاجة لعيادة. *عشر دقائق*، جهاز واحد، وعضلات جاهزة لما بعد.",
      ],
      facts: [["10 دقائق", "لكل حصة"], ["0", "موعد تنتظره"], DELIVERY.ar],
    },
    en: {
      titles: ["Born on the field, not *in a catalog*", "We made it for muscles that *never stop*"],
      text:
        "It started with the mornings after training: heavy legs, a knotted back, and physio appointments impossible to get. We wanted the same recovery, at home, in minutes.\n\n" +
        "We tested {short} through weeks of training before it reached you. Fast delivery, and you only pay when it arrives.",
      statements: [
        "Performance starts *after the effort*. Recover fast, come back stronger, go again tomorrow.",
        "No clinic needed. *Ten minutes*, one device, and muscles ready for what's next.",
      ],
      facts: [["10 min", "per session"], ["0", "appointments to book"], DELIVERY.en],
    },
  },
  home: {
    fr: {
      titles: ["Pensé dans une vraie cuisine, pour *de vraies journées*", "On voulait un quotidien plus simple, *pas un gadget de plus*"],
      text:
        "Tout est parti d'un constat : les appareils qu'on achète finissent souvent au fond d'un placard, trop lourds, trop longs à laver. On a voulu un objet qu'on sort tous les jours, sans réfléchir.\n\n" +
        "{short} se prend en main en trente secondes et se range en un geste. On vous le livre chez vous : vous ouvrez, vous vérifiez, puis vous payez.",
      statements: [
        "Une maison, c'est *des petits gestes* répétés chaque jour. On a juste voulu les rendre plus simples.",
        "Pas un gadget de plus. *Un objet utile*, qu'on sort tous les jours et qu'on range en un geste.",
      ],
      facts: [["30 s", "pour s'y mettre"], ["1", "geste pour le ranger"], DELIVERY.fr],
    },
    ar: {
      titles: ["فكّرنا فيه داخل مطبخ حقيقي، *ليوم حقيقي*", "أردنا يومًا أبسط، *لا جهازًا إضافيًا*"],
      text:
        "بدأت الفكرة من ملاحظة بسيطة: الأجهزة التي نشتريها تنتهي غالبًا في عمق الخزانة، ثقيلة أو متعبة في التنظيف. أردنا شيئًا نُخرجه كل يوم دون تفكير.\n\n" +
        "{short} جاهز للاستعمال في ثلاثين ثانية ويُرتَّب بحركة واحدة. نوصله إلى باب دارك: تفتح، تتأكد، ثم تدفع.",
      statements: [
        "البيت هو *حركات صغيرة* نكرّرها كل يوم. أردنا فقط أن نجعلها أبسط.",
        "ليس جهازًا إضافيًا. *أداة مفيدة* تُخرجها كل يوم وتُرتّبها بحركة واحدة.",
      ],
      facts: [["30 ثانية", "وتبدأ"], ["1", "حركة لترتيبه"], DELIVERY.ar],
    },
    en: {
      titles: ["Designed in a real kitchen, for *real days*", "We wanted *simpler* days, not one more gadget"],
      text:
        "It started with a simple observation: the appliances we buy often end up at the back of a cupboard, too heavy, too slow to clean. We wanted something you reach for every day without thinking.\n\n" +
        "{short} is ready in thirty seconds and put away in one move. We deliver it to your door: you open it, you check it, then you pay.",
      statements: [
        "A home is *small gestures* repeated every day. We just wanted to make them easier.",
        "Not one more gadget. *A useful thing* you reach for daily and put away in one move.",
      ],
      facts: [["30 s", "to get started"], ["1", "move to put away"], DELIVERY.en],
    },
  },
  tech: {
    fr: {
      titles: ["Pensé pour marcher *du premier coup*", "La technologie qu'on voulait : simple, solide, *sans manuel*"],
      text:
        "On a testé des dizaines d'appareils : trop de boutons, des applis obligatoires, des batteries fatiguées au bout d'un mois. On a gardé l'essentiel et soigné ce qui compte : la prise en main, l'autonomie, la solidité.\n\n" +
        "{short} s'allume et fait le travail. On vous le livre testé : vous vérifiez à la réception, puis vous payez.",
      statements: [
        "La meilleure technologie est celle qu'on *oublie*. Elle marche, tout simplement, chaque jour.",
        "Moins de boutons, *plus d'usage*. Un objet qui se comprend en une minute et qui dure.",
      ],
      facts: [["1", "minute pour l'adopter"], ["3", "gestes, pas plus"], DELIVERY.fr],
    },
    ar: {
      titles: ["صُمّم ليعمل *من أول مرة*", "التقنية كما أردناها: بسيطة، متينة، *وبلا دليل استعمال*"],
      text:
        "جرّبنا عشرات الأجهزة: أزرار كثيرة، تطبيقات إجبارية، وبطاريات تتعب بعد شهر. احتفظنا بالأساسي واعتنينا بما يهم: سهولة الاستعمال، مدة الشحن، والمتانة.\n\n" +
        "{short} تشغّله فيقوم بعمله. نوصله إليك بعد تجربته: تتأكد منه عند الاستلام، ثم تدفع.",
      statements: ["أفضل تقنية هي التي *تنساها*. تعمل ببساطة، كل يوم.", "أزرار أقل، *واستعمال أكثر*. جهاز تفهمه في دقيقة ويدوم معك."],
      facts: [["1", "دقيقة لتتعوّد عليه"], ["3", "حركات لا أكثر"], DELIVERY.ar],
    },
    en: {
      titles: ["Built to work *the first time*", "Tech the way we wanted it: simple, solid, *no manual*"],
      text:
        "We tested dozens of devices: too many buttons, mandatory apps, batteries worn out after a month. We kept the essentials and cared about what matters: how it feels in the hand, battery life, durability.\n\n" +
        "{short} switches on and does the job. We deliver it tested: you check it on delivery, then you pay.",
      statements: [
        "The best tech is the kind you *forget*. It just works, every day.",
        "Fewer buttons, *more use*. A device you understand in a minute and keep for years.",
      ],
      facts: [["1", "minute to get it"], ["3", "moves, no more"], DELIVERY.en],
    },
  },
  kids: {
    fr: {
      titles: ["On l'a choisi comme pour *les nôtres*", "Des petits moments, *de grands sourires*"],
      text:
        "Tout est parti des questions qu'on se pose tous : est-ce que c'est sûr, est-ce que ça va durer, est-ce que ça va vraiment plaire ? On n'a gardé que ce qui répondait oui trois fois.\n\n" +
        "{short} est solide, facile à nettoyer et pensé pour le quotidien. On vous le livre à la maison : vous vérifiez, puis vous payez.",
      statements: [
        "Ce qui compte, ce n'est pas l'objet. C'est *le moment* qu'il crée, et le sourire qui reste.",
        "Solide, simple, *sans surprise* : exactement ce qu'on attend quand il s'agit des nôtres.",
      ],
      facts: [["3", "questions, trois oui"], ["1", "coup d'éponge pour le nettoyer"], DELIVERY.fr],
    },
    ar: {
      titles: ["اخترناه كما نختار *لأحبّائنا*", "لحظات صغيرة، *وابتسامات كبيرة*"],
      text:
        "بدأ كل شيء بأسئلة نطرحها جميعًا: هل هو آمن؟ هل سيدوم؟ هل سيعجبهم حقًّا؟ واحتفظنا فقط بما كان جوابه نعم ثلاث مرات.\n\n" +
        "{short} متين، سهل التنظيف، ومصمَّم للاستعمال اليومي. نوصله إلى باب دارك: تتأكد منه، ثم تدفع.",
      statements: [
        "المهم ليس الشيء نفسه، بل *اللحظة* التي يصنعها، والابتسامة التي تبقى.",
        "متين، بسيط، *وبلا مفاجآت*: تمامًا ما ننتظره حين يتعلّق الأمر بأحبّائنا.",
      ],
      facts: [["3", "أسئلة، ثلاث مرات نعم"], ["1", "مسحة لتنظيفه"], DELIVERY.ar],
    },
    en: {
      titles: ["We chose it the way we'd choose *for our own*", "Small moments, *big smiles*"],
      text:
        "It started with the questions we all ask: is it safe, will it last, will they actually love it? We only kept what got three yeses.\n\n" +
        "{short} is sturdy, easy to clean and made for everyday life. We deliver it to your home: you check it, then you pay.",
      statements: [
        "What matters isn't the thing itself. It's *the moment* it creates, and the smile that stays.",
        "Sturdy, simple, *no surprises*: exactly what you want when it's for your little ones.",
      ],
      facts: [["3", "questions, three yeses"], ["1", "wipe to clean it"], DELIVERY.en],
    },
  },
  natural: {
    fr: {
      titles: ["De la terre à chez vous, *sans détour*", "On a gardé ce que la nature fait *de mieux*"],
      text:
        "On a grandi avec ces produits-là : simples, bruts, transmis de main en main. On voulait les retrouver tels quels, sans additifs ni intermédiaires inutiles.\n\n" +
        "{short} vient de petits producteurs qu'on connaît par leur prénom. On vous le livre partout : vous ouvrez, vous sentez, vous vérifiez, puis vous payez.",
      statements: [
        "La nature n'a pas besoin *qu'on l'améliore*. Juste qu'on la respecte, du champ jusqu'à chez vous.",
        "Peu d'étapes, *beaucoup de soin* : c'est tout notre secret, et il tient en une phrase.",
      ],
      facts: [["1", "origine, connue et suivie"], ["0", "additif inutile"], DELIVERY.fr],
    },
    ar: {
      titles: ["من الأرض إلى بيتك، *بلا وسطاء*", "احتفظنا بأجمل *ما تمنحه الطبيعة*"],
      text:
        "كبرنا مع هذه المنتجات: بسيطة، أصيلة، تنتقل من يد إلى يد. أردنا أن نجدها كما هي، بلا إضافات ولا وسطاء لا حاجة لهم.\n\n" +
        "{short} يأتي من منتجين صغار نعرفهم بأسمائهم. نوصله إلى باب دارك: تفتح، تشمّ، تتأكد، ثم تدفع.",
      statements: [
        "الطبيعة لا تحتاج *أن نحسّنها*. تحتاج فقط أن نحترمها، من الحقل إلى بيتك.",
        "خطوات قليلة، *وعناية كبيرة*: هذا كل سرّنا، ويكفيه سطر واحد.",
      ],
      facts: [["1", "مصدر معروف ومتتبَّع"], ["0", "إضافات لا حاجة لها"], DELIVERY.ar],
    },
    en: {
      titles: ["From the land to your home, *no detours*", "We kept the *best* of what nature does"],
      text:
        "We grew up with these products: simple, raw, passed from hand to hand. We wanted to find them as they are, with no additives and no needless middlemen.\n\n" +
        "{short} comes from small producers we know by name. We deliver everywhere: you open it, smell it, check it, then you pay.",
      statements: [
        "Nature doesn't need *improving*. Just respecting, from the field to your home.",
        "Few steps, *a lot of care*: that's our whole secret, and it fits in one line.",
      ],
      facts: [["1", "known, traceable origin"], ["0", "needless additives"], DELIVERY.en],
    },
  },
  general: {
    fr: {
      titles: ["Pourquoi on a créé *{short}*", "Un objet bien pensé, *pour de vrai*"],
      text:
        "On cherchait un objet simple, bien fait, au juste prix, et on ne le trouvait pas. Alors on a pris le temps de le choisir, de le tester et de l'améliorer jusqu'à ce qu'il nous convienne vraiment.\n\n" +
        "Aujourd'hui, {short} part de chez nous vers votre porte. Vous ouvrez, vous vérifiez, et vous ne payez qu'à ce moment-là.",
      statements: [
        "On ne vend que ce qu'on *utiliserait nous-mêmes*. C'est notre seule règle, et on la garde.",
        "Bien fait, *bien pensé*, au juste prix : ce qu'on aurait voulu trouver avant de le créer.",
      ],
      facts: [["1", "règle : l'utiliser nous-mêmes"], ["5 min", "pour l'adopter"], DELIVERY.fr],
    },
    ar: {
      titles: ["لماذا صنعنا *{short}*", "منتج مدروس، *بصدق*"],
      text:
        "كنا نبحث عن منتج بسيط، متقن، بثمن معقول، ولم نجده. فأخذنا وقتنا لاختياره وتجربته وتحسينه حتى أصبح يرضينا فعلًا.\n\n" +
        "اليوم، يخرج {short} من عندنا إلى باب دارك. تفتح، تتأكد، ولا تدفع إلا حينها.",
      statements: [
        "لا نبيع إلا ما *نستعمله نحن*. هذه قاعدتنا الوحيدة، ونحافظ عليها.",
        "متقن، *مدروس*، وبثمن معقول: ما تمنّينا أن نجده قبل أن نصنعه.",
      ],
      facts: [["1", "قاعدة: أن نستعمله نحن"], ["5 دقائق", "لتتعوّد عليه"], DELIVERY.ar],
    },
    en: {
      titles: ["Why we made *{short}*", "A well-made thing, *for real*"],
      text:
        "We were looking for something simple, well made and fairly priced, and couldn't find it. So we took the time to choose it, test it and improve it until it truly worked for us.\n\n" +
        "Today, {short} leaves our hands for your door. You open it, you check it, and only then do you pay.",
      statements: [
        "We only sell what we'd *use ourselves*. That's our one rule, and we keep it.",
        "Well made, *well thought out*, fairly priced: what we wished existed before we made it.",
      ],
      facts: [["1", "rule: we use it ourselves"], ["5 min", "to make it yours"], DELIVERY.en],
    },
  },
};

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts)                                            */
/* ------------------------------------------------------------------ */

type GarmentVoice = "prayer" | "modest" | "heritage" | "plain";

interface GarmentStoryCopy extends Record<GarmentVoice, Omit<StoryFamilyCopy, "facts">> {
  /** first fact per voice: [value, label] */
  lead: Record<GarmentVoice, readonly [string, string]>;
  care: readonly [string, string];
}

const GARMENT_STORY: Tri<GarmentStoryCopy> = {
  fr: {
    prayer: {
      titles: ["Une tenue pensée pour *la prière*, et pour tous les jours", "On voulait une tenue qui *couvre* sans gêner"],
      text:
        "Tout est parti d'un détail : des tenues de prière qui serrent, qui remontent, ou dont le tissu gratte au bout d'une heure. On a cherché l'inverse : une coupe ample, un tissu doux qui laisse respirer, des finitions qui tiennent au lavage.\n\n" +
        "{short}, pour la prière comme pour la maison. On vous livre la pièce soigneusement pliée : vous touchez le tissu, vous vérifiez la taille, puis vous payez.",
      statements: [
        "La pudeur n'a pas besoin *d'être compliquée*. Une coupe ample, un tissu doux, et l'esprit tranquille.",
        "Une belle tenue *se ressent* avant de se voir : douce sur la peau, libre à chaque mouvement.",
      ],
    },
    modest: {
      titles: ["Couvrir, *sans encombrer*", "Une pièce pudique, *facile à vivre*"],
      text:
        "On cherchait des pièces couvrantes qui ne serrent pas, ne pèsent pas et ne grattent pas au bout de la journée. On a gardé l'essentiel : une coupe ample, un tissu doux qui respire, des coutures nettes.\n\n" +
        "{short} se porte du matin au soir, sans y penser. On vous livre la pièce soigneusement pliée : vous touchez le tissu, vous vérifiez la taille, puis vous payez.",
      statements: [
        "La pudeur n'a pas besoin *d'être compliquée*. Une coupe ample, un tissu doux, et l'esprit tranquille.",
        "Couvrir sans encombrer : *une pièce qu'on oublie*, tant elle est facile à porter.",
      ],
    },
    heritage: {
      titles: ["La tradition, *portée aujourd'hui*", "Une pièce de fête, *facile à porter*"],
      text:
        "On aime les pièces traditionnelles, mais pas celles qu'on n'ose porter qu'une fois par an. On a gardé leurs lignes et leurs détails, dans une coupe et un tissu faciles à vivre.\n\n" +
        "{short} se porte pour une fête comme pour un vendredi en famille. On vous livre la pièce soigneusement pliée : vous la regardez de près, vous vérifiez la taille, puis vous payez.",
      statements: [
        "La tradition ne se range pas *dans une armoire*. Elle se porte, elle se partage, elle se transmet.",
        "Des lignes d'hier, *une aisance d'aujourd'hui* : la pièce qu'on sort pour les grands jours, et les autres.",
      ],
    },
    plain: {
      titles: ["Un vêtement qu'on a envie de *remettre*", "Un tissu doux, une coupe *juste*"],
      text:
        "Tout est parti d'une armoire pleine de vêtements qu'on ne mettait plus : un tissu qui gratte, une coupe qui serre, des coutures qui lâchent. On a cherché l'inverse : une matière douce, une coupe facile, des finitions qui tiennent au lavage.\n\n" +
        "{short} se porte dès le premier jour. On vous livre la pièce soigneusement pliée : vous touchez le tissu, vous vérifiez la taille, puis vous payez.",
      statements: [
        "Un bon vêtement *se ressent* avant de se voir : doux sur la peau, juste dans la coupe.",
        "Moins de pièces, *mieux choisies* : celles qu'on remet sans y penser.",
      ],
    },
    lead: { prayer: ["5", "prières, une seule tenue"], modest: ["1", "pièce, du matin au soir"], heritage: ["1", "pièce, de la fête au quotidien"], plain: ["1", "pièce, du quotidien aux sorties"] },
    care: ["30 °C", "lavage délicat, en machine"],
  },
  ar: {
    prayer: {
      titles: ["لباس صُمّم *للصلاة*، ولكل يوم", "أردنا لباسًا *يستر* دون أن يزعج"],
      text:
        "بدأت الفكرة من تفصيل صغير: ألبسة صلاة تضيق، أو ترتفع، أو يحكّ قماشها بعد ساعة. فبحثنا عن العكس: قصّة واسعة، قماش ناعم يترك الجسم يتنفّس، وخياطة تصمد أمام الغسيل.\n\n" +
        "{short} للصلاة وللبيت معًا. نوصل إليك القطعة مطويّة بعناية: تلمس القماش، تتأكد من المقاس، ثم تدفع.",
      statements: [
        "الحشمة لا تحتاج *إلى تعقيد*. قصّة واسعة، قماش ناعم، وبال مرتاح.",
        "اللباس الجميل *يُحَسّ* قبل أن يُرى: ناعم على الجسم، وحرّ في كل حركة.",
      ],
    },
    modest: {
      titles: ["الستر *بلا تكلّف*", "قطعة محتشمة، *سهلة في يومك*"],
      text:
        "كنا نبحث عن قطع ساترة لا تضيق ولا تُثقل ولا يحكّ قماشها مع آخر النهار. فاحتفظنا بالأساسي: قصّة واسعة، قماش ناعم يتنفّس، وخياطة نظيفة.\n\n" +
        "{short} من الصباح إلى المساء، براحة تامة. نوصل إليك القطعة مطويّة بعناية: تلمس القماش، تتأكد من المقاس، ثم تدفع.",
      statements: [
        "الحشمة لا تحتاج *إلى تعقيد*. قصّة واسعة، قماش ناعم، وبال مرتاح.",
        "ستر بلا ثقل: *قطعة تنساها* من شدّة راحتها.",
      ],
    },
    heritage: {
      titles: ["التقليد *بلباس اليوم*", "قطعة للمناسبات، *سهلة اللبس*"],
      text:
        "نحبّ القطع التقليدية، لكن ليس تلك التي لا نجرؤ على لبسها إلا مرة في السنة. فاحتفظنا بخطوطها وتفاصيلها، بقصّة وقماش سهلين في يومك.\n\n" +
        "{short} للمناسبات كما لجمعة العائلة. نوصل إليك القطعة مطويّة بعناية: تتأمّلها عن قرب، تتأكد من المقاس، ثم تدفع.",
      statements: [
        "التقليد لا يُخبّأ *في الخزانة*. يُلبس، ويُشارك، ويُورَث.",
        "خطوط الأمس، *وراحة اليوم*: قطعة للأيام الكبيرة، ولباقي الأيام أيضًا.",
      ],
    },
    plain: {
      titles: ["لباس تحبّ أن *تلبسه من جديد*", "قماش ناعم، وقصّة *مضبوطة*"],
      text:
        "بدأت الفكرة من خزانة مليئة بثياب لم نعد نلبسها: قماش يحكّ، قصّة تضيق، وخياطة لا تصمد. فبحثنا عن العكس: خامة ناعمة، قصّة سهلة، وتشطيب يصمد أمام الغسيل.\n\n" +
        "{short}، راحة من أول يوم. نوصل إليك القطعة مطويّة بعناية: تلمس القماش، تتأكد من المقاس، ثم تدفع.",
      statements: [
        "اللباس الجيد *يُحَسّ* قبل أن يُرى: ناعم على الجسم، ومضبوط في القصّة.",
        "قطع أقل، *واختيار أدق*: تلك التي نلبسها من جديد دون تفكير.",
      ],
    },
    lead: { prayer: ["5", "صلوات بلباس واحد"], modest: ["1", "قطعة من الصباح إلى المساء"], heritage: ["1", "قطعة من العرس إلى يومك"], plain: ["1", "قطعة لليوم وللخرجات"] },
    care: ["30°", "غسيل لطيف في الآلة"],
  },
  en: {
    prayer: {
      titles: ["Made for *prayer*, and for every day", "We wanted something that *covers* without getting in the way"],
      text:
        "It started with a small thing: prayer clothes that pinch, ride up, or itch after an hour. We went the other way: a loose cut, a soft fabric that breathes, finishing that survives the wash.\n\n" +
        "{short}, for prayer and for home. We deliver the piece neatly folded: you feel the fabric, check the size, then pay.",
      statements: [
        "Modesty doesn't need to be *complicated*. A loose cut, a soft fabric, and peace of mind.",
        "Good clothes are *felt* before they're seen: soft on the skin, free in every move.",
      ],
    },
    modest: {
      titles: ["Covered, *never weighed down*", "A modest piece, *easy to live in*"],
      text:
        "We wanted covering pieces that don't pinch, don't weigh you down and don't itch by the end of the day. We kept the essentials: a loose cut, a soft fabric that breathes, clean seams.\n\n" +
        "{short} goes from morning to night without a thought. We deliver the piece neatly folded: you feel the fabric, check the size, then pay.",
      statements: [
        "Modesty doesn't need to be *complicated*. A loose cut, a soft fabric, and peace of mind.",
        "Covered, never weighed down: *a piece you forget*, it's that easy to wear.",
      ],
    },
    heritage: {
      titles: ["Tradition, *worn today*", "A piece for celebrations, *easy to wear*"],
      text:
        "We love traditional pieces, just not the ones you only dare wear once a year. We kept their lines and details, in a cut and fabric that are easy to live in.\n\n" +
        "{short} works for a celebration as well as a family Friday. We deliver the piece neatly folded: you look at it closely, check the size, then pay.",
      statements: [
        "Tradition doesn't belong *in a wardrobe*. It's worn, shared and passed on.",
        "Yesterday's lines, *today's ease*: the piece for the big days, and the others.",
      ],
    },
    plain: {
      titles: ["Clothes you want to *wear again*", "A soft fabric, a *right* cut"],
      text:
        "It started with a wardrobe full of clothes we no longer wore: fabric that itched, a cut that pinched, seams that gave up. We went the other way: a soft material, an easy cut, finishing that survives the wash.\n\n" +
        "{short} feels right from day one. We deliver the piece neatly folded: you feel the fabric, check the size, then pay.",
      statements: [
        "Good clothes are *felt* before they're seen: soft on the skin, right in the cut.",
        "Fewer pieces, *better chosen*: the ones you put on again without thinking.",
      ],
    },
    lead: { prayer: ["5", "prayers, one outfit"], modest: ["1", "piece, morning to night"], heritage: ["1", "piece, celebration to everyday"], plain: ["1", "piece, everyday to evenings out"] },
    care: ["30 °C", "gentle machine wash"],
  },
};

/** Story of a garment, in the shop's "we" voice: why it was made, how it reaches you. */
export function garmentStory(lang: CopyLang, g: Garment): StoryFamilyCopy {
  const c = GARMENT_STORY[lang];
  const voice: GarmentVoice = g.prayer ? "prayer" : g.modest ? "modest" : g.heritage ? "heritage" : "plain";
  return { ...c[voice], facts: [c.lead[voice], c.care, DELIVERY[lang]] };
}
