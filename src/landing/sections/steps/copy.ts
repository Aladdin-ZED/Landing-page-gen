/**
 * Default copy for the steps section, per product family and language.
 * Step = [icon, title, text, time?]. The product's own ritual, told as gestures (what the hands do,
 * how long it takes); the "general" family falls back to the cash-on-delivery order flow.
 * Arabic: clear MSA with light Moroccan touches, written gender-neutral (instruction style).
 */
import { typo } from "../benefits/copy";
import type { CopyLang, Family, IconName, Tri } from "../benefits/kit";
import type { Garment } from "../garment";

export type StepRow = readonly [icon: IconName, title: string, text: string, time?: string];

export interface StepsCommonCopy {
  kickers: readonly string[];
  /** product-agnostic titles, mixed in with the family's own */
  titles: readonly string[];
  notes: readonly string[];
  /** mobile hint under the swipe strip (not editable) */
  swipe: string;
  /** "3 steps" — glass chip on the timeline photo (not editable) */
  count: (n: number) => string;
  /** "≈ 2 min" — total gesture time on the same chip (not editable) */
  total: (minutes: number) => string;
}

export interface FamilyCopy {
  kicker?: string;
  titles: readonly string[];
  lead: string;
  steps: readonly StepRow[];
}

export const COMMON: Tri<StepsCommonCopy> = {
  fr: {
    kickers: ["Mode d'emploi", "Comment ça marche", "Pas à pas"],
    titles: ["Aussi simple que *ça*", "Facile dès le *premier jour*", "Le mode d'emploi, *en clair*"],
    notes: ["Et c'est tout.", "Rien de plus."],
    swipe: "Faites glisser",
    count: (n) => `${n} étapes`,
    total: (m) => `≈ ${m} min`,
  },
  ar: {
    kickers: ["طريقة الاستعمال", "كيف يعمل؟", "خطوة بخطوة"],
    titles: ["بسيط *إلى هذا الحد*", "سهل من *أول يوم*", "طريقة الاستعمال *بكل وضوح*"],
    notes: ["وهذا كل شيء.", "لا أكثر من ذلك."],
    swipe: "اسحب لترى الباقي",
    count: (n) => (n === 2 ? "خطوتان" : `${n} خطوات`),
    total: (m) => `≈ ${m} د`,
  },
  en: {
    kickers: ["How to use it", "How it works", "Step by step"],
    titles: ["As simple as *that*", "Easy from *day one*", "The manual, *in plain words*"],
    notes: ["That's it.", "Nothing more to it."],
    swipe: "Swipe",
    count: (n) => `${n} steps`,
    total: (m) => `≈ ${m} min`,
  },
};

export const FAMILY: Record<Family, Tri<FamilyCopy>> = {
  care: {
    fr: {
      titles: ["Trois gestes, *une minute*", "Votre rituel *en trois gestes*"],
      lead: "Pas besoin d'une routine en dix étapes : le matin ou le soir, voici tout ce qu'il faut faire.",
      steps: [
        ["drop", "Trois gouttes dans la paume", "Sur une peau propre, le matin ou le soir. Inutile d'en mettre plus.", "10 s"],
        ["hand-heart", "Réchauffez, puis pressez", "Frottez vos paumes et appliquez par pressions sur le visage, sans tirer la peau.", "30 s"],
        ["check", "Laissez agir une minute", "L'huile pénètre et le fini reste sec. Ensuite crème, maquillage ou oreiller, au choix.", "1 min"],
      ],
    },
    ar: {
      titles: ["ثلاث خطوات، *ودقيقة واحدة*", "روتينك *في ثلاث خطوات*"],
      lead: "لا حاجة لروتين من عشر خطوات: صباحًا أو مساءً، هذا كل ما في الأمر.",
      steps: [
        ["drop", "ثلاث قطرات في راحة اليد", "على بشرة نظيفة، صباحًا أو مساءً. لا حاجة لأكثر من ذلك.", "10 ث"],
        ["hand-heart", "دفء بين الكفّين، ثم ضغط خفيف", "فرك الكفّين، ثم وضعهما على الوجه بلمسات ضاغطة دون شدّ البشرة.", "30 ث"],
        ["check", "دقيقة واحدة ويتشرّبها الجلد", "يتشرّب الجلد الزيت ويبقى الملمس جافًا، ثم الكريم أو الماكياج أو النوم مباشرة.", "1 د"],
      ],
    },
    en: {
      titles: ["Three steps, *one minute*", "Your ritual *in three steps*"],
      lead: "No ten-step routine needed: morning or night, this is all it takes.",
      steps: [
        ["drop", "Three drops in your palm", "On clean skin, morning or night. You won't need more.", "10 s"],
        ["hand-heart", "Warm it, then press", "Rub your palms together and press onto your face, without pulling the skin.", "30 s"],
        ["check", "Give it one minute", "It sinks in and the finish stays dry. Then moisturiser, make-up or pillow, your call.", "1 min"],
      ],
    },
  },
  scent: {
    fr: {
      titles: ["Comment le porter *pour qu'il dure*", "Trois secrets *de tenue*"],
      lead: "Bien posé, il vous accompagne du matin jusqu'au soir. Voici comment.",
      steps: [
        ["drop", "Sur les points chauds", "Une vaporisation dans le cou, une à l'intérieur du poignet. La chaleur de la peau fait le reste.", "5 s"],
        ["hand-heart", "Surtout, ne frottez pas", "Laissez sécher seul : frotter écrase les notes de tête et raccourcit la tenue."],
        ["moon", "Laissez-le évoluer", "Frais au départ, floral vers midi, chaud et boisé le soir venu.", "12 h"],
      ],
    },
    ar: {
      titles: ["كيف تضعه *ليدوم أطول*", "ثلاثة أسرار *لثبات أطول*"],
      lead: "عندما يوضع بالطريقة الصحيحة، يرافقك من الصباح حتى المساء. إليك الطريقة.",
      steps: [
        ["drop", "على نقاط النبض", "رشّة على العنق ورشّة على باطن المعصم، وحرارة البشرة تكمل الباقي.", "5 ث"],
        ["hand-heart", "ودون فرك", "اتركه يجفّ وحده: الفرك يكسر النوتات الأولى ويقلّل من ثباته."],
        ["moon", "ثم دعه يتطوّر", "انتعاش في البداية، قلب زهري عند الظهر، ودفء خشبي مع المساء.", "12 س"],
      ],
    },
    en: {
      titles: ["How to wear it *so it lasts*", "Three secrets *to longer wear*"],
      lead: "Applied the right way, it stays with you from morning to night. Here's how.",
      steps: [
        ["drop", "On the pulse points", "One spray on the neck, one inside the wrist. Body heat does the rest.", "5 s"],
        ["hand-heart", "Don't rub it in", "Let it dry on its own: rubbing crushes the top notes and shortens the wear."],
        ["moon", "Let it unfold", "Fresh at first, floral by noon, warm and woody by evening.", "12 h"],
      ],
    },
  },
  style: {
    fr: {
      titles: ["Choisi en ligne, *vérifié chez vous*", "Zéro risque, *trois étapes*"],
      lead: "Vous voyez la pièce de vos propres yeux avant de payer quoi que ce soit.",
      steps: [
        ["tag", "Choisissez votre finition", "Taille, couleur, finition : tout se choisit dans le formulaire, en trente secondes.", "30 s"],
        ["eye", "Ouvrez, regardez de près", "Le livreur attend pendant que vous vérifiez la pièce. Vous ne payez qu'ensuite."],
        ["gift", "Portez-la le jour même", "Elle arrive prête, dans son écrin. Au bureau, à un mariage ou le week-end."],
      ],
    },
    ar: {
      titles: ["تختارها هنا، *وتعاينها في بيتك*", "بلا مخاطرة، *في ثلاث خطوات*"],
      lead: "ترى القطعة بعينيك قبل أن تدفع أي درهم.",
      steps: [
        ["tag", "اختر ما يناسبك", "المقاس واللون والتشطيب: كل شيء يُختار في الاستمارة خلال ثلاثين ثانية.", "30 ث"],
        ["eye", "افتح الطرد وعاين", "عامل التوصيل ينتظرك وأنت تعاين القطعة عن قرب، ولا تدفع إلا بعدها."],
        ["gift", "والبسها في اليوم نفسه", "تصلك جاهزة في علبتها: للعمل أو للعرس أو لنهاية الأسبوع."],
      ],
    },
    en: {
      titles: ["Chosen here, *checked at home*", "Zero risk, *three steps*"],
      lead: "You see the piece with your own eyes before paying anything.",
      steps: [
        ["tag", "Pick your finish", "Size, colour, finish: everything is chosen in the form, in thirty seconds.", "30 s"],
        ["eye", "Open it, look closely", "The courier waits while you check the piece. You only pay after that."],
        ["gift", "Wear it the same day", "It arrives ready, in its box. For the office, a wedding or the weekend."],
      ],
    },
  },
  active: {
    fr: {
      titles: ["Bien l'utiliser, *en trois gestes*", "Deux minutes par zone, *c'est tout*"],
      lead: "Pas besoin d'être kiné : l'appareil fait le travail, vous le guidez.",
      steps: [
        ["bolt", "Choisissez la tête", "Boule pour les grands muscles, pointe pour les nœuds, fourche pour la nuque.", "5 s"],
        ["waves", "Glissez sans appuyer", "Vitesse basse, le long du muscle : le poids de l'appareil suffit. Jamais sur un os.", "30 s"],
        ["heart", "Deux minutes par zone", "Mollets, cuisses, dos. Puis un grand verre d'eau : demain, vos jambes vous remercient.", "2 min"],
      ],
    },
    ar: {
      titles: ["استعمله كما يجب، *في ثلاث خطوات*", "دقيقتان لكل منطقة، *لا أكثر*"],
      lead: "لا تحتاج أن تكون مختصًّا: الجهاز يقوم بالعمل، وأنت توجّهه فقط.",
      steps: [
        ["bolt", "اختر الرأس المناسب", "الكروي للعضلات الكبيرة، والمدبّب للعُقد، والمشقوق للرقبة.", "5 ث"],
        ["waves", "مرّره دون ضغط", "بسرعة منخفضة وعلى طول العضلة، فوزن الجهاز يكفي. وتجنّب العظام.", "30 ث"],
        ["heart", "دقيقتان لكل منطقة", "الساقان والفخذان والظهر، ثم كأس ماء. وغدًا تشعر بالفرق.", "2 د"],
      ],
    },
    en: {
      titles: ["Use it right, *in three moves*", "Two minutes per area, *that's all*"],
      lead: "No physio degree needed: the device does the work, you just guide it.",
      steps: [
        ["bolt", "Pick the head", "Ball for big muscles, bullet for knots, fork for the neck.", "5 s"],
        ["waves", "Glide, don't press", "Low speed, along the muscle: the device's weight is enough. Never on bone.", "30 s"],
        ["heart", "Two minutes per area", "Calves, thighs, back. Then a big glass of water. Tomorrow, your legs will thank you.", "2 min"],
      ],
    },
  },
  home: {
    fr: {
      titles: ["Prêt à servir *dès le déballage*", "Trois gestes, *zéro prise de tête*"],
      lead: "Pas de notice à déchiffrer : on le sort de la boîte et on s'en sert.",
      steps: [
        ["box", "Déballez, c'est prêt", "Aucun montage : il est prêt à servir dès la sortie de la boîte.", "1 min"],
        ["bolt", "Un bouton, c'est parti", "Prise en main immédiate : toute la famille s'en sert dès le premier jour.", "30 s"],
        ["drop", "Rincez, rangez", "Un coup d'eau et c'est propre. Compact, il trouve sa place dans le placard."],
      ],
    },
    ar: {
      titles: ["جاهز للاستعمال *من أول يوم*", "ثلاث خطوات، *بلا تعقيد*"],
      lead: "لا دليل تحتاج لفكّ رموزه: تخرجه من العلبة وتستعمله.",
      steps: [
        ["box", "أخرجه من العلبة", "بلا تركيب ولا تعقيد: جاهز للاستعمال من أول دقيقة.", "1 د"],
        ["bolt", "زرّ واحد ويبدأ", "استعماله واضح من أول نظرة، والعائلة كلها تستعمله من اليوم الأول.", "30 ث"],
        ["drop", "اشطفه وضعه في مكانه", "قليل من الماء ويصبح نظيفًا، وحجمه الصغير يجد مكانه في أي خزانة."],
      ],
    },
    en: {
      titles: ["Ready *straight out of the box*", "Three steps, *zero hassle*"],
      lead: "No manual to decode: take it out of the box and use it.",
      steps: [
        ["box", "Unbox, and it's ready", "No assembly: it's ready to use straight out of the box.", "1 min"],
        ["bolt", "One button, go", "Obvious from the first try: the whole family uses it on day one.", "30 s"],
        ["drop", "Rinse, put away", "A splash of water and it's clean. Compact, it fits in any cupboard."],
      ],
    },
  },
  tech: {
    fr: {
      titles: ["Sans appli, *sans réglage*", "Branché, connecté, *c'est parti*"],
      lead: "Une charge, un appui long, et il vous suit partout.",
      steps: [
        ["battery", "Une charge pour commencer", "Câble USB-C fourni : le voyant passe au vert quand c'est prêt.", "2 h"],
        ["bolt", "Appui long, c'est connecté", "Il se connecte tout seul, sans application ni réglage à chercher.", "5 s"],
        ["map-pin", "Emportez-le partout", "Maison, bureau, voiture : il tient dans une poche de veste."],
      ],
    },
    ar: {
      titles: ["بلا تطبيق *ولا إعدادات*", "شحن، اتصال، *وانطلاق*"],
      lead: "شحنة واحدة، ضغطة طويلة، ويرافقك أينما ذهبت.",
      steps: [
        ["battery", "شحنة أولى قبل البدء", "كابل USB-C في العلبة، والضوء يصبح أخضر عندما يكتمل الشحن.", "2 س"],
        ["bolt", "ضغطة طويلة ويتصل", "يتصل وحده، بلا تطبيق ولا إعدادات تبحث عنها.", "5 ث"],
        ["map-pin", "وخذه معك أينما ذهبت", "في البيت أو المكتب أو السيارة: يدخل في جيب السترة."],
      ],
    },
    en: {
      titles: ["No app, *no settings*", "Charged, paired, *done*"],
      lead: "One charge, one long press, and it goes wherever you go.",
      steps: [
        ["battery", "Charge it once", "USB-C cable included: the light turns green when it's ready.", "2 h"],
        ["bolt", "Long press, connected", "It pairs on its own, no app and no settings to dig for.", "5 s"],
        ["map-pin", "Take it everywhere", "Home, office, car: it fits in a jacket pocket."],
      ],
    },
  },
  kids: {
    fr: {
      titles: ["Ouvert, compris, *adopté*", "Prêt à jouer *tout de suite*"],
      lead: "Pas d'outil, rien à chercher : tout est dans la boîte.",
      steps: [
        ["gift", "Ouvrez la boîte ensemble", "Tout est dedans, prêt à jouer : pas d'outil, rien à chercher."],
        ["eye", "Montrez une fois", "Quelques secondes de démonstration et ils prennent le relais.", "1 min"],
        ["box", "Rangez en un geste", "Tout retourne dans sa boîte, et le salon redevient un salon."],
      ],
    },
    ar: {
      titles: ["تُفتح، تُفهم، *وتُحَبّ*", "جاهزة للعب *في الحال*"],
      lead: "بلا أدوات ولا بحث عن قطع: كل شيء داخل العلبة.",
      steps: [
        ["gift", "افتحوا العلبة معًا", "كل شيء بداخلها وجاهز للعب: بلا أدوات ولا قطع ناقصة."],
        ["eye", "اشرح لهم مرة واحدة", "ثوانٍ قليلة من الشرح، ثم يكملون وحدهم.", "1 د"],
        ["box", "ورتّبوها في لحظة", "كل قطعة تعود إلى علبتها، ويبقى الصالون صالونًا."],
      ],
    },
    en: {
      titles: ["Opened, understood, *loved*", "Ready to play *right away*"],
      lead: "No tools, nothing to hunt for: everything's in the box.",
      steps: [
        ["gift", "Open the box together", "Everything is inside and ready to play: no tools, nothing missing."],
        ["eye", "Show them once", "A few seconds of demo and they take it from there.", "1 min"],
        ["box", "Tidy up in one go", "Everything goes back in its box, and the living room stays a living room."],
      ],
    },
  },
  natural: {
    fr: {
      titles: ["Un geste *chaque matin*", "La régularité, *tout simplement*"],
      lead: "Rien de compliqué : une cuillère, un rituel, et la régularité fait le reste.",
      steps: [
        ["sun", "Une cuillère le matin", "Nature, dans un verre d'eau tiède ou sur une tranche de pain chaud.", "1 min"],
        ["calendar", "Chaque jour, sans pause", "C'est la régularité qui compte : posez le pot à côté de la théière."],
        ["leaf", "Bien refermé, au sec", "À l'abri de la lumière, il garde son goût jusqu'à la dernière cuillère."],
      ],
    },
    ar: {
      titles: ["عادة صغيرة *كل صباح*", "السرّ في *الانتظام*"],
      lead: "لا شيء معقّد: ملعقة واحدة، عادة يومية، والانتظام يكمل الباقي.",
      steps: [
        ["sun", "ملعقة في الصباح", "كما هو، أو في كأس ماء دافئ، أو على قطعة خبز ساخن.", "1 د"],
        ["calendar", "كل يوم دون انقطاع", "الانتظام هو السر: ضع العلبة بجانب البرّاد كي لا تنساها."],
        ["leaf", "مُحكم الإغلاق وفي مكان جاف", "بعيدًا عن الضوء، يحافظ على مذاقه حتى آخر ملعقة."],
      ],
    },
    en: {
      titles: ["One small habit, *every morning*", "Consistency, *simply*"],
      lead: "Nothing complicated: one spoonful, one daily habit, and consistency does the rest.",
      steps: [
        ["sun", "A spoonful in the morning", "As it is, in a glass of warm water, or on a slice of warm bread.", "1 min"],
        ["calendar", "Every day, no breaks", "Consistency is what counts: keep the jar next to the teapot."],
        ["leaf", "Closed tight, kept dry", "Away from light, it keeps its taste down to the last spoonful."],
      ],
    },
  },
  general: {
    fr: {
      kicker: "Comment commander",
      titles: ["Commander en *trois étapes*", "Vous payez *à la livraison*"],
      lead: "Sans carte bancaire et sans compte : vous payez quand le colis est entre vos mains.",
      steps: [
        ["user", "Remplissez le formulaire", "Nom, téléphone, ville : trente secondes, sans compte ni carte bancaire.", "30 s"],
        ["phone", "On vous appelle", "Un conseiller confirme la commande et l'adresse dans la journée."],
        ["cash-hand", "Payez à la réception", "Vous ouvrez le colis, vous vérifiez, puis vous payez le livreur.", "24–48 h"],
      ],
    },
    ar: {
      kicker: "كيف تطلب؟",
      titles: ["اطلب في *ثلاث خطوات*", "تدفع فقط *عند الاستلام*"],
      lead: "بلا بطاقة بنكية ولا حساب: تدفع عندما يصبح الطرد بين يديك.",
      steps: [
        ["user", "املأ الاستمارة", "الاسم والهاتف والمدينة: ثلاثون ثانية، بلا حساب ولا بطاقة بنكية.", "30 ث"],
        ["phone", "نتصل بك للتأكيد", "يتصل بك مستشار خلال اليوم لتأكيد الطلب والعنوان."],
        ["cash-hand", "وتدفع عند الاستلام", "تفتح الطرد وتعاين، ثم تدفع لعامل التوصيل.", "24–48 س"],
      ],
    },
    en: {
      kicker: "How to order",
      titles: ["Order in *three steps*", "You pay *on delivery*"],
      lead: "No card, no account: you pay once the parcel is in your hands.",
      steps: [
        ["user", "Fill in the form", "Name, phone, city: thirty seconds, no account and no card.", "30 s"],
        ["phone", "We call you", "An advisor confirms the order and the address the same day."],
        ["cash-hand", "Pay on delivery", "Open the parcel, check it, then pay the courier.", "24–48 h"],
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/* Durations                                                           */
/* ------------------------------------------------------------------ */

const UNIT_SECONDS: readonly [RegExp, number][] = [
  [/^(s|sec|secs|seconde?s?|seconds?|ث|ثانية|ثوان|ثوانٍ)$/i, 1],
  [/^(mn|min|mins|minutes?|د|دق|دقيقة|دقائق)$/i, 60],
  [/^(h|hr|hrs|heures?|hours?|س|ساعة|ساعات)$/i, 3600],
];

/** "30 s" / "1 min" / "2 د" → seconds; null for ranges ("24–48 h"), words or unknown units. */
export function parseDuration(s: string): number | null {
  const m = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*([^\d\s.,]+)$/.exec(s.trim());
  if (!m) return null;
  const unit = UNIT_SECONDS.find(([re]) => re.test(m[2]!));
  return unit ? Number(m[1]!.replace(",", ".")) * unit[1] : null;
}

/**
 * Whole-minute total of the hands-on time, when every step carries a parseable duration and the
 * sum stays a "gesture" (≤ 30 min — a 12 h wear time or a 2 h charge is not hands-on time).
 */
export function totalMinutes(times: readonly string[]): number | null {
  let sum = 0;
  for (const t of times) {
    const s = parseDuration(t);
    if (s === null) return null;
    sum += s;
  }
  return sum > 0 && sum <= 1800 ? Math.max(1, Math.ceil(sum / 60)) : null;
}

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts): choose the size, we confirm it, you check */
/* ------------------------------------------------------------------ */

interface GarmentStepsCopy {
  kicker: string;
  titles: readonly string[];
  lead: string;
  choose: { adult: StepRow; child: StepRow; drape: StepRow };
  confirm: { sized: StepRow; plain: StepRow };
  check: StepRow;
}

const GARMENT_STEPS: Tri<GarmentStepsCopy> = {
  fr: {
    kicker: "Comment commander",
    titles: ["Choisie ici, *vérifiée chez vous*", "La bonne taille, *sans risque*"],
    lead: "Vous touchez le tissu et vérifiez la taille avant de payer quoi que ce soit.",
    choose: {
      adult: ["tag", "Choisissez taille et couleur", "Dans le formulaire, en trente secondes, sans compte ni carte bancaire.", "30 s"],
      child: ["tag", "Choisissez l'âge et la couleur", "Dans le formulaire, en trente secondes. Entre deux tailles ? Prenez la plus grande.", "30 s"],
      drape: ["tag", "Choisissez votre couleur", "Dans le formulaire, en trente secondes, sans compte ni carte bancaire.", "30 s"],
    },
    confirm: {
      sized: ["phone", "On confirme avec vous", "Un conseiller vous appelle pour valider la commande, la taille et l'adresse avant l'envoi."],
      plain: ["phone", "On confirme avec vous", "Un conseiller vous appelle pour valider la commande, la couleur et l'adresse avant l'envoi."],
    },
    check: ["eye", "Touchez, vérifiez, puis payez", "Devant le livreur : tissu, couleur, taille. Vous payez seulement si tout vous plaît.", "24–48 h"],
  },
  ar: {
    kicker: "كيف تطلب؟",
    titles: ["تختارها هنا، *وتعاينها في بيتك*", "المقاس المناسب، *بلا مخاطرة*"],
    lead: "تلمس القماش وتتأكد من المقاس قبل أن تدفع أي درهم.",
    choose: {
      adult: ["tag", "اختر المقاس واللون", "في الاستمارة، خلال ثلاثين ثانية، بلا حساب ولا بطاقة بنكية.", "30 ث"],
      child: ["tag", "اختر العمر واللون", "في الاستمارة، خلال ثلاثين ثانية. بين مقاسين؟ خذ الأكبر.", "30 ث"],
      drape: ["tag", "اختر اللون", "في الاستمارة، خلال ثلاثين ثانية، بلا حساب ولا بطاقة بنكية.", "30 ث"],
    },
    confirm: {
      sized: ["phone", "نؤكّد معك", "يتصل بك مستشار لتأكيد الطلب والمقاس والعنوان قبل الإرسال."],
      plain: ["phone", "نؤكّد معك", "يتصل بك مستشار لتأكيد الطلب واللون والعنوان قبل الإرسال."],
    },
    check: ["eye", "المس، عاين، ثم ادفع", "أمام عامل التوصيل: القماش واللون والمقاس. ولا تدفع إلا إذا أعجبك كل شيء.", "24–48 س"],
  },
  en: {
    kicker: "How to order",
    titles: ["Chosen here, *checked at home*", "The right size, *no risk*"],
    lead: "You feel the fabric and check the size before paying anything.",
    choose: {
      adult: ["tag", "Pick size and colour", "In the form, in thirty seconds, no account and no card.", "30 s"],
      child: ["tag", "Pick the age and colour", "In the form, in thirty seconds. Between two sizes? Take the bigger one.", "30 s"],
      drape: ["tag", "Pick your colour", "In the form, in thirty seconds, no account and no card.", "30 s"],
    },
    confirm: {
      sized: ["phone", "We confirm with you", "An advisor calls to confirm the order, the size and the address before shipping."],
      plain: ["phone", "We confirm with you", "An advisor calls to confirm the order, the colour and the address before shipping."],
    },
    check: ["eye", "Feel it, check it, then pay", "In front of the courier: fabric, colour, size. You only pay if it's all right.", "24–48 h"],
  },
};

/** How a garment is ordered: pick the size (or age), we confirm it by phone, you check before paying. */
export function garmentSteps(lang: CopyLang, g: Garment): FamilyCopy {
  const c = GARMENT_STEPS[lang];
  const t = (s: string) => typo(lang, s);
  const choose = g.scarf ? c.choose.drape : g.kids ? c.choose.child : c.choose.adult;
  return {
    kicker: c.kicker,
    titles: c.titles,
    lead: t(c.lead),
    steps: [choose, g.scarf ? c.confirm.plain : c.confirm.sized, c.check].map(([icon, title, text, time]) => [icon, t(title), t(text), time] as const),
  };
}
