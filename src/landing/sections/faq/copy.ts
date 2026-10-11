/**
 * FAQ default copy (ar · fr · en) and the section's own microcopy.
 *
 * Every default page answers the COD questions shoppers really ask — how to pay, delivery time and
 * cities, inspecting the parcel before paying, exchanges — plus two product questions tailored to
 * the category family (usage, then its typical doubt). Questions use the shopper's voice (light
 * Darija in Arabic), answers the brand's clear voice. Promises (delays, 7-day exchange) mirror the
 * kit's trust lines; the section ships with `sample: true` so the merchant confirms them.
 */
import type { Locale, Offers, Product, ProductCategory } from "@/lib/page/schema";
import { garmentOf, type Garment } from "../garment";
import type { Data, ItemData } from "./schema";

type Lang = "ar" | "fr" | "en";
type Tri<T> = Record<Lang, T>;
type Qa = ItemData;

export const langOf = (locale: Locale): Lang => (locale === "ar" || locale === "fr" ? locale : "en");

const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;

/** Short product name for answers: drops the size/format tail ("— 50 ml", "(x2)") and long tails. */
export function shortName(name: string): string {
  let s = name.split(/\s[—–-]\s|\(|,|·|\|/)[0]!.trim() || name.trim();
  if (s.length > 32) {
    const cut = s.slice(0, 32);
    s = cut.slice(0, Math.max(cut.lastIndexOf(" "), 16)).trim();
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* COD essentials — two phrasings each                                 */
/* ------------------------------------------------------------------ */

interface Essentials {
  cod: readonly Qa[];
  delivery: readonly Qa[];
  inspect: readonly Qa[];
  exchange: readonly Qa[];
  /** appended to the delivery answer when shipping costs nothing */
  free: string;
}

const ESSENTIALS: Tri<Essentials> = {
  fr: {
    cod: [
      {
        q: "Comment se passe le paiement ?",
        a: "Vous payez en espèces au livreur, à la réception du colis. Rien à régler en ligne, aucune carte bancaire.",
      },
      {
        q: "Dois-je payer quelque chose à l'avance ?",
        a: "Non, rien. Vous commandez en 30 secondes, et vous ne payez qu'une fois le colis entre vos mains.",
      },
    ],
    delivery: [
      {
        q: "Quels sont les délais de livraison ?",
        a: "24 à 48 h à Casablanca, Rabat, Marrakech, Tanger, Fès et Agadir ; 2 à 4 jours dans les autres villes. On vous appelle d'abord pour confirmer l'adresse.",
      },
      {
        q: "Livrez-vous dans ma ville ?",
        a: "Oui, partout au Maroc, des grandes villes aux petites communes. Comptez 24 à 48 h dans les grandes villes, 2 à 4 jours ailleurs.",
      },
    ],
    inspect: [
      {
        q: "Puis-je vérifier le colis avant de payer ?",
        a: "Oui. Vous ouvrez le colis devant le livreur, vous vérifiez le produit, et **seulement ensuite** vous payez.",
      },
      {
        q: "Et si le produit ne me convient pas à la livraison ?",
        a: "Vous le vérifiez devant le livreur, avant de payer. S'il ne correspond pas à votre commande, vous le refusez, sans rien payer.",
      },
    ],
    exchange: [
      {
        q: "Puis-je échanger mon produit ?",
        a: "Oui, sous 7 jours après la livraison, si le produit est intact et dans son emballage. Contactez-nous avec votre numéro de commande, on s'occupe du reste.",
      },
      {
        q: "Et si mon article arrive abîmé ?",
        a: "C'est rare, mais si ça arrive : envoyez-nous une photo sous 7 jours, on vous l'échange sans frais.",
      },
    ],
    free: " La livraison est offerte.",
  },
  ar: {
    cod: [
      {
        q: "كيف يتم الدفع؟",
        a: "تدفع نقداً لعامل التوصيل عند استلام طلبك. لا دفع عبر الإنترنت، ولا حاجة لبطاقة بنكية.",
      },
      {
        q: "واش خاصني نخلص شي حاجة مسبقاً؟",
        a: "لا، لا شيء. تطلب في 30 ثانية، ولا تدفع إلا عندما يصل الطرد إلى يديك.",
      },
    ],
    delivery: [
      {
        q: "شحال كتاخد مدة التوصيل؟",
        a: "من 24 إلى 48 ساعة في الدار البيضاء والرباط ومراكش وطنجة وفاس وأكادير، ومن 2 إلى 4 أيام في باقي المدن. نتصل بك أولاً لتأكيد العنوان.",
      },
      {
        q: "واش كتوصلو لمدينتي؟",
        a: "نعم، لجميع مدن المغرب، الكبيرة والصغيرة. من 24 إلى 48 ساعة في المدن الكبرى، ومن 2 إلى 4 أيام في باقي المناطق.",
      },
    ],
    inspect: [
      {
        q: "واش نقدر نشوف السلعة قبل ما نخلص؟",
        a: "نعم. تفتح الطرد أمام عامل التوصيل، تتأكد من المنتج، و**بعدها فقط** تدفع.",
      },
      {
        q: "وإلا ما عجبنيش المنتج عند الاستلام؟",
        a: "تعاينه أمام عامل التوصيل قبل الدفع. إذا لم يكن مطابقاً لطلبك، ترفضه دون أن تدفع أي درهم.",
      },
    ],
    exchange: [
      {
        q: "واش نقدر نبدّل المنتج؟",
        a: "نعم، خلال 7 أيام من التوصيل، إذا كان المنتج سليماً وفي علبته. تواصل معنا برقم الطلب، والباقي علينا.",
      },
      {
        q: "وإلا وصلني المنتج فيه عيب؟",
        a: "نادراً ما يحدث، لكن إن حصل: أرسل لنا صورة خلال 7 أيام، ونبدّله لك دون أي مصاريف.",
      },
    ],
    free: " والتوصيل مجاني.",
  },
  en: {
    cod: [
      {
        q: "How do I pay?",
        a: "In cash, to the courier, when your parcel arrives. Nothing to pay online, no card needed.",
      },
      {
        q: "Do I pay anything upfront?",
        a: "Nothing at all. Ordering takes 30 seconds, and you only pay once the parcel is in your hands.",
      },
    ],
    delivery: [
      {
        q: "How long does delivery take?",
        a: "24–48 h in Casablanca, Rabat, Marrakech, Tangier, Fes and Agadir; 2–4 days everywhere else. We call first to confirm your address.",
      },
      {
        q: "Do you deliver to my city?",
        a: "Yes, to every city in Morocco, big or small. Allow 24–48 h in major cities and 2–4 days elsewhere.",
      },
    ],
    inspect: [
      {
        q: "Can I check the parcel before paying?",
        a: "Yes. Open it in front of the courier, check the product, and **only then** pay.",
      },
      {
        q: "What if it isn't right when it arrives?",
        a: "You check it in front of the courier, before paying. If it doesn't match your order, refuse it and pay nothing.",
      },
    ],
    exchange: [
      {
        q: "Can I exchange my product?",
        a: "Yes, within 7 days of delivery, if it's unused and in its box. Send us your order number and we'll handle the rest.",
      },
      {
        q: "What if my item arrives damaged?",
        a: "It's rare, but if it happens, send us a photo within 7 days and we'll exchange it at no cost.",
      },
    ],
    free: " Delivery is free.",
  },
};

/* ------------------------------------------------------------------ */
/* Product questions per category family: [usage, typical doubt]       */
/* ------------------------------------------------------------------ */

type Topic =
  | "care"
  | "hair"
  | "scent"
  | "style"
  | "active"
  | "home"
  | "tech"
  | "kids"
  | "pets"
  | "natural"
  | "health"
  | "general";

const TOPIC_OF: Record<ProductCategory, Topic> = {
  beauty: "care",
  skincare: "care",
  grooming: "care",
  haircare: "hair",
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
  health: "health",
  supplements: "health",
  "organic-food": "natural",
  traditional: "natural",
  other: "general",
};

/* shared answers, reused by several topics */
const AUTHENTIC: Tri<Qa> = {
  fr: {
    q: "Est-ce un produit original ?",
    a: "Oui. Et vous n'avez pas à nous croire sur parole : vous ouvrez le colis et vous vérifiez le produit avant de payer.",
  },
  ar: { q: "واش المنتج أصلي؟", a: "نعم. ولا تحتاج أن تصدقنا بالكلام فقط: تفتح الطرد وتتأكد من المنتج قبل أن تدفع." },
  en: { q: "Is it the original?", a: "Yes. And you don't have to take our word for it: open the parcel and check it before you pay." },
};

const SAFE_MATERIALS: Tri<Qa> = {
  fr: {
    q: "Les matériaux sont-ils sûrs ?",
    a: "La composition et les précautions d'usage figurent sur l'emballage. Et vous vérifiez la qualité vous-même à la livraison, avant de payer.",
  },
  ar: { q: "واش المواد آمنة؟", a: "التركيبة واحتياطات الاستعمال مكتوبة على العلبة. وتتأكد من الجودة بنفسك عند الاستلام، قبل الدفع." },
  en: { q: "Are the materials safe?", a: "The composition and safety notes are on the pack. And you check the quality yourself on delivery, before paying." },
};

const NATURAL: Tri<Qa> = {
  fr: {
    q: "Est-il 100 % naturel ?",
    a: "La composition complète figure sur l'emballage, sans rien de caché. Demandez-la-nous avant de commander si vous voulez la lire.",
  },
  ar: { q: "واش طبيعي 100%؟", a: "التركيبة الكاملة مكتوبة على العلبة، بلا أي شيء مخفي. اطلبها منا قبل الطلب إذا أردت قراءتها." },
  en: { q: "Is it 100% natural?", a: "The full ingredient list is on the pack, nothing hidden. Ask us for it before ordering if you'd like to read it." },
};

const PRODUCT_QA: Record<Topic, Tri<readonly [Qa, Qa]>> = {
  care: {
    fr: [
      {
        q: "Comment l'utiliser ?",
        a: "Appliquez une petite quantité et massez doucement, matin, soir, ou les deux. Le mode d'emploi détaillé est sur l'emballage.",
      },
      {
        q: "Convient-il aux peaux sensibles ?",
        a: "Faites d'abord un petit test au creux du coude, 24 h avant la première utilisation. Un doute sur un ingrédient ? Demandez-nous la composition complète.",
      },
    ],
    ar: [
      { q: "كيف أستعمل {short}؟", a: "ضع كمية صغيرة ودلّك بلطف، صباحاً أو مساءً أو الاثنين معاً. طريقة الاستعمال بالتفصيل مكتوبة على العلبة." },
      {
        q: "واش مناسب للبشرة الحساسة؟",
        a: "جرّب أولاً كمية صغيرة على ثنية المرفق، 24 ساعة قبل أول استعمال. عندك شك في مكوّن؟ اطلب منا التركيبة الكاملة.",
      },
    ],
    en: [
      { q: "How do I use it?", a: "Apply a small amount and massage in gently, morning, evening or both. Full directions are on the pack." },
      {
        q: "Is it suitable for sensitive skin?",
        a: "Try a little on the inside of your elbow 24 h before first use. Unsure about an ingredient? Ask us for the full list.",
      },
    ],
  },
  hair: {
    fr: [
      {
        q: "Comment l'utiliser ?",
        a: "Sur cheveux humides ou secs, une petite quantité sur les longueurs et les pointes, en évitant les racines. Le mode d'emploi détaillé est sur l'emballage.",
      },
      {
        q: "Convient-il à tous les types de cheveux ?",
        a: "Oui : dosez selon votre chevelure, un peu pour les cheveux fins, davantage pour les longueurs épaisses ou bouclées.",
      },
    ],
    ar: [
      { q: "كيف أستعمل {short}؟", a: "على شعر مبلل أو جاف، كمية صغيرة على الأطراف والأطوال، بعيداً عن الجذور. طريقة الاستعمال بالتفصيل مكتوبة على العلبة." },
      { q: "واش مناسب لجميع أنواع الشعر؟", a: "نعم: عدّل الكمية حسب شعرك، قليل للشعر الرقيق، وأكثر للشعر الكثيف أو المجعد." },
    ],
    en: [
      { q: "How do I use it?", a: "On damp or dry hair, a small amount through the lengths and ends, away from the roots. Full directions are on the pack." },
      { q: "Does it suit every hair type?", a: "Yes. Adjust the amount to your hair: a little for fine hair, more for thick or curly lengths." },
    ],
  },
  scent: {
    fr: [
      {
        q: "Combien de temps tient-il ?",
        a: "Plusieurs heures sur la peau, et encore plus sur les vêtements. Vaporisez sur les points chauds, poignets et cou, sans frotter.",
      },
      AUTHENTIC.fr,
    ],
    ar: [{ q: "شحال كيدوم العطر؟", a: "عدة ساعات على البشرة، وأكثر على الملابس. رشّه على نقاط النبض، المعصم والعنق، دون فرك." }, AUTHENTIC.ar],
    en: [
      { q: "How long does it last?", a: "Several hours on skin, even longer on clothes. Spray on pulse points, wrists and neck, without rubbing." },
      AUTHENTIC.en,
    ],
  },
  style: {
    fr: [
      {
        q: "Comment choisir la bonne taille ?",
        a: "Les mesures exactes sont dans la description. Un doute ? Donnez-nous les vôtres à l'appel de confirmation : on vous conseille avant l'envoi.",
      },
      {
        q: "Les couleurs sont-elles fidèles aux photos ?",
        a: "Nos photos sont prises à la lumière du jour, sans filtre. Et vous vérifiez l'article à la livraison, avant de payer.",
      },
    ],
    ar: [
      { q: "كيف أختار المقاس المناسب؟", a: "القياسات الدقيقة موجودة في الوصف. عندك شك؟ أعطنا قياساتك في مكالمة التأكيد، ونساعدك قبل الإرسال." },
      { q: "واش الألوان بحال الصور؟", a: "صورنا ملتقطة في ضوء النهار، بلا فلاتر. وتتأكد من القطعة عند الاستلام، قبل الدفع." },
    ],
    en: [
      { q: "How do I pick the right size?", a: "Exact measurements are in the description. Not sure? Give us yours on the confirmation call and we'll advise you before shipping." },
      { q: "Are the colours true to the photos?", a: "Our photos are shot in daylight, with no filter. And you check the item on delivery, before paying." },
    ],
  },
  active: {
    fr: [
      {
        q: "Comment l'utiliser ?",
        a: "Il se prend en main en quelques minutes : la notice détaille chaque étape, et notre équipe vous guide si besoin.",
      },
      {
        q: "Est-ce adapté aux débutants ?",
        a: "Oui. Commencez doucement, quelques minutes par séance, puis augmentez au fil des jours.",
      },
    ],
    ar: [
      { q: "كيف أستعمل {short}؟", a: "تتعلّم استعماله في دقائق: الدليل يشرح كل خطوة، وفريقنا يرافقك إذا احتجت." },
      { q: "واش مناسب للمبتدئين؟", a: "نعم. ابدأ بهدوء، دقائق قليلة في كل حصة، ثم زِد تدريجياً مع الأيام." },
    ],
    en: [
      { q: "How do I use it?", a: "You'll get the hang of it in minutes: the guide covers every step, and our team helps if you need it." },
      { q: "Is it suitable for beginners?", a: "Yes. Start gently, a few minutes per session, then build up over the days." },
    ],
  },
  home: {
    fr: [
      {
        q: "Est-il facile à utiliser et à nettoyer ?",
        a: "Oui : il arrive prêt à l'emploi, avec sa notice. Un rinçage ou un coup de chiffon suffit pour l'entretien.",
      },
      {
        q: "Quelles sont ses dimensions ?",
        a: "Toutes les mesures sont dans la description du produit. Un doute sur la place ? Posez la question à l'appel de confirmation, on vérifie avec vous.",
      },
    ],
    ar: [
      { q: "واش ساهل فالاستعمال والتنظيف؟", a: "نعم: يصلك جاهزاً للاستعمال مع دليله. وللتنظيف، يكفي شطفه أو مسحه بقطعة قماش." },
      { q: "شنو هي القياسات ديالو؟", a: "جميع القياسات موجودة في وصف المنتج. عندك شك في المكان؟ اسألنا في مكالمة التأكيد ونتأكد معك." },
    ],
    en: [
      { q: "Is it easy to use and clean?", a: "Yes. It arrives ready to use, with its guide, and a rinse or a wipe is all the cleaning it needs." },
      { q: "What are its dimensions?", a: "Every measurement is in the product description. Unsure about the space? Ask on the confirmation call and we'll check with you." },
    ],
  },
  tech: {
    fr: [
      {
        q: "Est-ce compliqué à utiliser ?",
        a: "Non : il fonctionne dès la sortie de la boîte. Et si vous bloquez sur un réglage, notre équipe vous guide pas à pas.",
      },
      {
        q: "Est-il garanti ?",
        a: "Oui, contre les défauts de fabrication. Gardez votre bon de livraison : il sert de preuve d'achat.",
      },
    ],
    ar: [
      { q: "واش صعيب فالاستعمال؟", a: "لا: {short} يشتغل مباشرة بعد إخراجه من العلبة. وإذا توقفت عند إعداد ما، فريقنا يرشدك خطوة بخطوة." },
      { q: "واش عندو ضمان؟", a: "نعم، ضد عيوب التصنيع. احتفظ بوصل التوصيل: فهو إثبات الشراء." },
    ],
    en: [
      { q: "Is it complicated to use?", a: "No. It works straight out of the box, and if you get stuck on a setting, our team walks you through it." },
      { q: "Is there a warranty?", a: "Yes, against manufacturing defects. Keep your delivery slip: it's your proof of purchase." },
    ],
  },
  kids: {
    fr: [
      {
        q: "À partir de quel âge ?",
        a: "L'âge conseillé est indiqué dans la description. Un doute pour votre enfant ? Demandez-nous, on vous répond franchement.",
      },
      SAFE_MATERIALS.fr,
    ],
    ar: [{ q: "من أي عمر يناسب؟", a: "العمر المناسب مذكور في الوصف. عندك شك بالنسبة لطفلك؟ اسألنا، ونجيبك بصراحة." }, SAFE_MATERIALS.ar],
    en: [
      { q: "What age is it for?", a: "The recommended age is in the description. Unsure for your child? Ask us and we'll give you an honest answer." },
      SAFE_MATERIALS.en,
    ],
  },
  pets: {
    fr: [
      {
        q: "Convient-il à mon animal ?",
        a: "Les tailles et les poids conseillés sont dans la description. Donnez-nous la race ou le poids de votre animal, on vous conseille.",
      },
      SAFE_MATERIALS.fr,
    ],
    ar: [
      { q: "واش مناسب لحيواني؟", a: "المقاسات والأوزان المناسبة موجودة في الوصف. أخبرنا بسلالة حيوانك أو وزنه، ونساعدك في الاختيار." },
      SAFE_MATERIALS.ar,
    ],
    en: [
      { q: "Will it suit my pet?", a: "Recommended sizes and weights are in the description. Tell us your pet's breed or weight and we'll advise you." },
      SAFE_MATERIALS.en,
    ],
  },
  natural: {
    fr: [
      {
        q: "Comment le conserver ?",
        a: "Bien refermé, à l'abri de la chaleur et de la lumière. Il garde ainsi son goût et ses qualités jusqu'à la date indiquée.",
      },
      NATURAL.fr,
    ],
    ar: [{ q: "كيف أحفظه؟", a: "مغلقاً جيداً، بعيداً عن الحرارة والضوء. هكذا يحتفظ بمذاقه وجودته حتى التاريخ المذكور على العلبة." }, NATURAL.ar],
    en: [
      { q: "How should I store it?", a: "Tightly closed, away from heat and light. It keeps its taste and quality until the date on the pack." },
      NATURAL.en,
    ],
  },
  health: {
    fr: [
      {
        q: "Comment le prendre ?",
        a: "Suivez la dose indiquée sur l'emballage, sans la dépasser. Enceinte, allaitante ou sous traitement ? Demandez d'abord l'avis de votre médecin.",
      },
      NATURAL.fr,
    ],
    ar: [
      { q: "كيف أتناوله؟", a: "التزم بالجرعة المذكورة على العلبة دون تجاوزها. حامل، مرضعة أو تتبعين علاجاً؟ استشيري طبيبك أولاً." },
      NATURAL.ar,
    ],
    en: [
      { q: "How do I take it?", a: "Follow the dose on the pack and don't exceed it. Pregnant, breastfeeding or on medication? Ask your doctor first." },
      NATURAL.en,
    ],
  },
  general: {
    fr: [
      {
        q: "Comment l'utiliser ?",
        a: "Il s'utilise simplement, notice à l'appui. Une question avant ou après la commande ? Notre équipe vous répond.",
      },
      AUTHENTIC.fr,
    ],
    ar: [{ q: "كيف أستعمل {short}؟", a: "استعماله بسيط، والدليل مرفق معه. عندك سؤال قبل الطلب أو بعده؟ فريقنا يجيبك." }, AUTHENTIC.ar],
    en: [
      { q: "How do I use it?", a: "It's simple to use, and a guide comes with it. A question before or after ordering? Our team answers." },
      AUTHENTIC.en,
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Heading & help line                                                 */
/* ------------------------------------------------------------------ */

const HEAD: Tri<{ kicker: string; titles: readonly string[]; leads: readonly string[]; helpTitle: string; helpTexts: readonly string[] }> = {
  fr: {
    kicker: "Questions fréquentes",
    titles: ["Vos questions, *nos réponses*", "Tout savoir *avant de commander*", "Des réponses claires, *sans détour*"],
    leads: [
      "Paiement, livraison, échange : tout est simple. Et s'il reste une question, on vous répond.",
      "Les réponses aux questions qu'on nous pose le plus, avant comme après la commande.",
    ],
    helpTitle: "Une autre question ?",
    helpTexts: [
      "Notre équipe vous répond avec plaisir, avant comme après la commande.",
      "Écrivez-nous : une vraie personne de l'équipe vous répond.",
    ],
  },
  ar: {
    kicker: "أسئلة شائعة",
    titles: ["أسئلتكم، *وأجوبتنا*", "كل ما تحتاج معرفته *قبل الطلب*", "أجوبة واضحة *بلا تعقيد*"],
    leads: ["الدفع، التوصيل، الاستبدال: كل شيء واضح. وإلا بقى عندك شي سؤال، حنا هنا.", "أجوبة الأسئلة التي تصلنا أكثر، قبل الطلب وبعده."],
    helpTitle: "عندك سؤال آخر؟",
    helpTexts: ["فريقنا يجيبك بكل سرور، قبل الطلب وبعده.", "راسلنا: شخص حقيقي من فريقنا يرد عليك."],
  },
  en: {
    kicker: "Questions & answers",
    titles: ["Your questions, *answered*", "Everything to know *before you order*", "Clear answers, *no fine print*"],
    leads: [
      "Payment, delivery, exchanges: all simple. And if a question remains, we're here.",
      "Answers to what people ask us most, before and after they order.",
    ],
    helpTitle: "Still have a question?",
    helpTexts: ["Our team is glad to help, before and after you order.", "Message us: a real person on our team replies."],
  },
};

export interface DefaultsArgs {
  locale: Locale;
  product: Product;
  offers: Offers;
  rng: () => number;
}

export function faqDefaults({ locale, product, offers, rng }: DefaultsArgs): Data {
  const l = langOf(locale);
  const e = ESSENTIALS[l];
  const h = HEAD[l];
  const short = shortName(product.name);
  const fill = (s: string) => s.replace(/\{short\}/g, short);
  // a garment asks about size and fit, not about clasps or a gift box
  const garment = garmentOf(product);
  const [usage, doubt] = garment ? garmentQa(l, garment) : PRODUCT_QA[TOPIC_OF[product.category] ?? "general"][l];
  const delivery = pick(rng, e.delivery);
  const items: Qa[] = [
    pick(rng, e.cod),
    { q: delivery.q, a: delivery.a + (offers.shippingFee === 0 ? e.free : "") },
    pick(rng, e.inspect),
    { q: fill(usage.q), a: fill(usage.a) },
    { q: fill(doubt.q), a: fill(doubt.a) },
    pick(rng, e.exchange),
  ];
  return {
    kicker: h.kicker,
    title: pick(rng, h.titles),
    lead: pick(rng, h.leads),
    items,
    openFirst: true,
    help: true,
    helpTitle: h.helpTitle,
    helpText: pick(rng, h.helpTexts),
    helpLabel: "",
    sample: true,
  };
}

/* ------------------------------------------------------------------ */
/* Render-time microcopy (channel labels, chat chrome)                 */
/* ------------------------------------------------------------------ */

const UI: Tri<{
  wa: string;
  call: string;
  waStatus: string;
  care: string;
  compose: string;
  message: string;
  toc: string;
  thread: string;
  /** chat opener: the COD line under the product preview, and the shopper's greeting */
  cod: string;
  hello: string;
}> = {
  fr: {
    wa: "Écrire sur WhatsApp",
    call: "Appeler le service client",
    waStatus: "Répond sur WhatsApp",
    care: "Service client",
    compose: "Posez votre question…",
    message: "Bonjour, j'ai une question sur : {name}",
    toc: "Toutes les questions",
    thread: "Questions et réponses",
    cod: "Paiement à la livraison",
    hello: "Bonjour, j'ai quelques questions avant de commander.",
  },
  ar: {
    wa: "راسلنا على واتساب",
    call: "اتصل بخدمة الزبناء",
    waStatus: "يرد على واتساب",
    care: "خدمة الزبناء",
    compose: "اكتب سؤالك…",
    message: "السلام عليكم، عندي سؤال على: {name}",
    toc: "جميع الأسئلة",
    thread: "أسئلة وأجوبة",
    cod: "الدفع عند الاستلام",
    hello: "السلام عليكم، عندي شي أسئلة قبل ما نطلب.",
  },
  en: {
    wa: "Message us on WhatsApp",
    call: "Call customer care",
    waStatus: "Replies on WhatsApp",
    care: "Customer care",
    compose: "Ask your question…",
    message: "Hello, I have a question about: {name}",
    toc: "All questions",
    thread: "Questions and answers",
    cod: "Cash on delivery",
    hello: "Hi, a few questions before I order.",
  },
};

export const ui = (locale: Locale) => UI[langOf(locale)];

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts): size, then the garment's typical doubt    */
/* ------------------------------------------------------------------ */

interface GarmentQa {
  size: Qa;
  sizeKids: (who: NonNullable<Garment["kids"]>) => Qa;
  prayer: Qa;
  drape: Qa;
}

const GARMENT_QA: Tri<GarmentQa> = {
  fr: {
    size: {
      q: "Comment choisir la bonne taille ?",
      a: "Le guide des tailles est dans la description. Entre deux tailles, prenez la plus grande : à l'appel de confirmation, on revoit la taille avec vous avant l'envoi.",
    },
    sizeKids: (who) => ({
      q: who === "girl" ? "Quelle taille choisir pour ma fille ?" : who === "boy" ? "Quelle taille choisir pour mon fils ?" : "Quelle taille choisir pour mon enfant ?",
      a: "Choisissez selon son âge ; entre deux tailles, prenez la plus grande. À l'appel de confirmation, on revoit la taille avec vous avant l'envoi.",
    }),
    prayer: {
      q: "La coupe est-elle assez ample pour la prière ?",
      a: "Oui : ample et couvrante, elle laisse bouger librement, de l'inclinaison à la prosternation. Et vous vérifiez à la livraison, avant de payer.",
    },
    drape: {
      q: "Est-il facile à draper ?",
      a: "Oui : un tour, une épingle, et il tient en place. Et vous touchez le tissu à la livraison, avant de payer.",
    },
  },
  ar: {
    size: {
      q: "كيف أختار المقاس المناسب؟",
      a: "دليل المقاسات موجود في الوصف. بين مقاسين؟ خذ الأكبر، وفي مكالمة التأكيد نراجع المقاس معك قبل الإرسال.",
    },
    sizeKids: (who) => ({
      q: who === "girl" ? "أي مقاس نختار لبنتي؟" : who === "boy" ? "أي مقاس نختار لولدي؟" : "أي مقاس نختار لطفلي؟",
      a:
        who === "girl"
          ? "اختر حسب عمرها، وإن كانت بين مقاسين فخذ الأكبر. وفي مكالمة التأكيد نراجع المقاس معك قبل الإرسال."
          : "اختر حسب عمره، وإن كان بين مقاسين فخذ الأكبر. وفي مكالمة التأكيد نراجع المقاس معك قبل الإرسال.",
    }),
    prayer: {
      q: "واش القصّة واسعة بما يكفي للصلاة؟",
      a: "نعم: واسعة وساترة، تترك حرية الحركة من الركوع إلى السجود. وتعاينها عند الاستلام قبل أن تدفع.",
    },
    drape: {
      q: "واش ساهل يتلفّ؟",
      a: "نعم: لفّة ودبوس واحد، ويبقى في مكانه. وتلمس القماش عند الاستلام قبل أن تدفع.",
    },
  },
  en: {
    size: {
      q: "How do I pick the right size?",
      a: "The size guide is in the description. Between two sizes? Take the bigger one, and we go over it with you on the confirmation call before shipping.",
    },
    sizeKids: (who) => ({
      q: who === "girl" ? "Which size for my daughter?" : who === "boy" ? "Which size for my son?" : "Which size for my child?",
      a: "Choose by age; between two sizes, take the bigger one. We go over the size with you on the confirmation call before shipping.",
    }),
    prayer: {
      q: "Is the cut loose enough for prayer?",
      a: "Yes: loose and covering, it moves freely from bowing to prostration. And you check it on delivery, before paying.",
    },
    drape: {
      q: "Is it easy to drape?",
      a: "Yes: one wrap, one pin, and it stays put. And you feel the fabric on delivery, before paying.",
    },
  },
};

/** The two product questions of a garment: the size (by age for children), then its typical doubt. */
function garmentQa(l: Lang, g: Garment): readonly [Qa, Qa] {
  const c = GARMENT_QA[l];
  const colours = PRODUCT_QA.style[l][1];
  if (g.scarf) return [c.drape, colours];
  return [g.kids ? c.sizeKids(g.kids) : c.size, g.prayer ? c.prayer : colours];
}
