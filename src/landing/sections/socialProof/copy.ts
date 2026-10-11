/**
 * Sample proof copy for socialProof (WhatsApp threads, story captions, counter labels) in ar / fr / en.
 * Customers write the way they text: Darija in Arabic script, warm plain French, short English.
 * Headings stay clear (MSA with a light Moroccan touch); the CTA speaks Darija.
 * Store replies stay gender-neutral in Arabic (noun phrases, no imperatives) so any customer name fits.
 * Everything built from here is sample content (data.sample = true) — the admin swaps in real proof.
 */
import type { Garment } from "../garment";
import type { Family, L3 } from "../reviews/copy";

export interface ChatCopy {
  /** customer, right after unboxing (sent under the photo) */
  first: L3;
  /** store: one usage tip */
  tip: L3;
  /** customer, a few weeks later — also the quote of a text-only story */
  result: L3;
  /** short story caption */
  story: L3;
}

const c = (first: L3, tip: L3, result: L3, story: L3): ChatCopy => ({ first, tip, result, story });

export const FAMILY_CHAT: Record<Family, ChatCopy> = {
  skin: c(
    { ar: "الملمس خفيف وكيتشرب بسرعة", fr: "La texture est légère, ça pénètre vite", en: "Light texture, it sinks in fast" },
    {
      ar: "نصيحة صغيرة: جوج نقط فالليل على بشرة نقية",
      fr: "Petit conseil : deux gouttes le soir sur peau propre",
      en: "Quick tip: two drops at night on clean skin",
    },
    {
      ar: "من بعد سيمانتين، ما بقاش داك الشد من بعد الدوش",
      fr: "Deux semaines après : plus de tiraillements après la douche",
      en: "Two weeks in: no more tightness after the shower",
    },
    { ar: "روتين الليل ديالي", fr: "Ma routine du soir", en: "My night routine" },
  ),
  hair: c(
    { ar: "الريحة ديالو خفيفة وزوينة", fr: "L'odeur est douce, pas entêtante", en: "Soft smell, not overpowering" },
    {
      ar: "نصيحة صغيرة: على الشعر وهو فازك، خصوصا الأطراف",
      fr: "Petit conseil : sur cheveux humides, surtout les pointes",
      en: "Quick tip: on damp hair, mostly the ends",
    },
    {
      ar: "من بعد 3 سيمانات، الطيحان نقص بزاف",
      fr: "Trois semaines après, beaucoup moins de cheveux sur la brosse",
      en: "Three weeks in, far less hair on the brush",
    },
    { ar: "الشعر بعد شهر", fr: "Mes cheveux, un mois après", en: "My hair, one month in" },
  ),
  wellness: c(
    { ar: "توصلت بيه، والعلبة مسدودة مزيان", fr: "Bien reçu, la boîte est bien scellée", en: "Got it, the box is properly sealed" },
    {
      ar: "نصيحة صغيرة: وحدة فالصباح مع كاس ديال الما",
      fr: "Petit conseil : une prise le matin avec un grand verre d'eau",
      en: "Quick tip: one in the morning with a big glass of water",
    },
    {
      ar: "هادي 3 سيمانات، ما بقاش داك العيا فالعشية",
      fr: "Trois semaines déjà, plus de coup de fatigue l'après-midi",
      en: "Three weeks now, no more afternoon slump",
    },
    { ar: "فطور الصباح", fr: "Mon rituel du matin", en: "Morning ritual" },
  ),
  scent: c(
    { ar: "القرعة زوينة بزاف، حسن من التصاور", fr: "Le flacon est superbe, encore plus beau qu'en photo", en: "The bottle is stunning, nicer than the photos" },
    {
      ar: "نصيحة صغيرة: جوج بخات فالعنق والمعاصم، بلا حكان",
      fr: "Petit conseil : deux vaporisations sur le cou et les poignets, sans frotter",
      en: "Quick tip: two sprays on neck and wrists, no rubbing",
    },
    {
      ar: "حطيتو مع 8 فالصباح، وفالعشية باقي كيشمو فيا",
      fr: "Mis à 8 h, on le sentait encore le soir",
      en: "Sprayed at 8 a.m., still noticed in the evening",
    },
    { ar: "على الطابلة ديالي", fr: "Sur ma coiffeuse", en: "On my dresser" },
  ),
  style: c(
    { ar: "حسن فالحقيقة من التصاور", fr: "Il est encore plus beau en vrai", en: "Even nicer in person" },
    {
      ar: "نصيحة صغيرة: خليه فالبوشيط ديالو باش يبقى كيلمع",
      fr: "Petit conseil : rangez-le dans sa pochette pour garder l'éclat",
      en: "Quick tip: keep it in its pouch to keep the shine",
    },
    {
      ar: "كنلبسو كل نهار، وكيسولوني فين شريتو",
      fr: "Je le porte tous les jours, on me demande où je l'ai trouvé",
      en: "I wear it daily, people ask where I got it",
    },
    { ar: "لوك اليوم", fr: "Le look du jour", en: "Today's look" },
  ),
  body: c(
    { ar: "صحيح، وقوي كثر مما كنت متوقع", fr: "Solide, et plus puissant que prévu", en: "Solid, and stronger than I expected" },
    {
      ar: "نصيحة صغيرة: البداية بالسرعة 1، دقيقتين فكل بلاصة",
      fr: "Petit conseil : commencez en vitesse 1, deux minutes par zone",
      en: "Quick tip: start on speed 1, two minutes per area",
    },
    {
      ar: "من بعد الرياضة، الوجع ديال الغد نقص بزاف",
      fr: "Après le sport, les courbatures du lendemain ont presque disparu",
      en: "After training, next-day soreness is almost gone",
    },
    { ar: "من بعد التمرين", fr: "Après la séance", en: "Post-workout" },
  ),
  home: c(
    { ar: "توصلت بيه، وجربتو دابا فالصباح", fr: "Reçu, et déjà testé ce matin", en: "Arrived, and already tried it this morning" },
    {
      ar: "نصيحة صغيرة: شوية ديال الما مباشرة من بعد، ويبقى ديما نقي",
      fr: "Petit conseil : un rinçage juste après, et il reste comme neuf",
      en: "Quick tip: rinse right after and it stays like new",
    },
    { ar: "كنربح 20 دقيقة كل صباح", fr: "Je gagne vingt minutes chaque matin", en: "I save twenty minutes every morning" },
    { ar: "فالكوزينة ديالي", fr: "Dans ma cuisine", en: "In my kitchen" },
  ),
  tech: c(
    { ar: "ركبتو فدقيقتين، وخدام مزيان", fr: "Installé en deux minutes, il marche nickel", en: "Set up in two minutes, works perfectly" },
    {
      ar: "نصيحة صغيرة: شارجة كاملة أول مرة قبل الاستعمال",
      fr: "Petit conseil : une charge complète avant la première utilisation",
      en: "Quick tip: a full charge before first use",
    },
    { ar: "سيمانة كاملة بشارجة وحدة", fr: "Une semaine entière sur une seule charge", en: "A full week on a single charge" },
    { ar: "خدام من أول نهار", fr: "Adopté dès le premier jour", en: "Day-one favorite" },
  ),
  family: c(
    { ar: "الدراري حلوه قبل مني", fr: "Les enfants l'ont ouvert avant moi", en: "The kids opened it before I could" },
    {
      ar: "نصيحة صغيرة: شيفون فازك كافي باش يتنقى",
      fr: "Petit conseil : un chiffon humide suffit pour le nettoyer",
      en: "Quick tip: a damp cloth is all it takes to clean",
    },
    { ar: "من داك النهار وهما كيلعبو بيه كل نهار", fr: "Depuis, ils jouent avec tous les jours", en: "They've played with it every day since" },
    { ar: "الدراري فرحانين", fr: "Les enfants sont ravis", en: "Happy kids" },
  ),
  craft: c(
    { ar: "الخدمة نقية، باينة الجودة", fr: "Le travail est soigné, on sent la qualité", en: "Careful work, you can feel the quality" },
    {
      ar: "نصيحة صغيرة: بعيد على الرطوبة، ويعيش سنين",
      fr: "Petit conseil : à l'abri de l'humidité, il durera des années",
      en: "Quick tip: away from damp, it will last for years",
    },
    { ar: "العائلة كاملة لاحظاتو فالدار", fr: "Toute la famille l'a remarqué à la maison", en: "The whole family noticed it at home" },
    { ar: "فبلاصتو", fr: "Il a trouvé sa place", en: "Found its spot" },
  ),
};

/** Universal chat lines ({name}, {product}, {city} are filled in by defaults()). */
export const CHAT = {
  hello: { ar: "السلام عليكم، توصلت بالكولي اليوم فالصباح", fr: "Salam, colis bien reçu ce matin", en: "Hi, the parcel arrived this morning" },
  here: { ar: "ها هو", fr: "Le voilà", en: "Here it is" },
  thanks: { ar: "مرحبا {name}، شكرا على الصورة.", fr: "Merci {name}, et merci pour la photo.", en: "Thanks {name}, and thanks for the photo." },
  again: {
    ar: "سلام، بغيت نطلب {product} مرة أخرى، هاد المرة لختي",
    fr: "Bonjour, je voudrais repasser commande, cette fois pour ma sœur",
    en: "Hello, I'd like to order again, this time for my sister",
  },
  address: { ar: "بكل فرح. نفس العنوان اللي ف{city}؟", fr: "Avec plaisir. Même adresse à {city} ?", en: "Happy to. Same address in {city}?" },
  cod: {
    ar: "إيه. ونخلص عند الاستلام بحال المرة اللي فاتت",
    fr: "Oui. Et je paie à la livraison comme la dernière fois",
    en: "Yes. And I'll pay on delivery like last time",
  },
  booked: { ar: "تمام، الطلب مسجل. التوصيل غدا إن شاء الله", fr: "C'est noté, livraison demain", en: "Done, it's on its way tomorrow" },
  followup: {
    ar: "سلام {name}، كيفاش لقيتيه حتى لدابا؟",
    fr: "Bonjour {name}, alors, ça vous plaît ?",
    en: "Hi {name}, how are you getting on with it?",
  },
  serious: { ar: "شكرا على المتابعة، ناس معقولين", fr: "Merci pour le suivi, vous êtes sérieux", en: "Thanks for the follow-up, you're reliable" },
  glad: { ar: "هادشي كيفرحنا بزاف، شكرا على الرجوع", fr: "Ça nous fait vraiment plaisir, merci pour le retour", en: "That really makes our day, thanks for writing back" },
} satisfies Record<string, L3>;

/** Date chips at the top of each thread. */
export const DAYS: readonly L3[] = [
  { ar: "اليوم", fr: "Aujourd'hui", en: "Today" },
  { ar: "البارح", fr: "Hier", en: "Yesterday" },
  { ar: "الاثنين", fr: "Lundi", en: "Monday" },
];

/** Story ages as the apps print them. */
export const AGES: readonly L3[] = [
  { ar: "2 س", fr: "2 h", en: "2h" },
  { ar: "5 س", fr: "5 h", en: "5h" },
  { ar: "9 س", fr: "9 h", en: "9h" },
  { ar: "1 ي", fr: "1 j", en: "1d" },
];

export const STORY_EXTRA: readonly L3[] = [
  { ar: "وصلني فـ 24 ساعة", fr: "Reçu en 24 h", en: "Here in 24 hours" },
  { ar: "الطلب الثاني", fr: "Deuxième commande", en: "Second order" },
  { ar: "خلصت عند الباب", fr: "Payé à la porte", en: "Paid at the door" },
];

export const TITLES: readonly L3[] = [
  { ar: "وصلهم، جرّبوه، ثم *كتبوا لنا*", fr: "Livrés, essayés, puis *ils nous écrivent*", en: "Delivered, tried, then *they wrote back*" },
  { ar: "ما يصلنا *بعد التوصيل*", fr: "Ce qu'on reçoit *après la livraison*", en: "What lands *after delivery*" },
  { ar: "زبناؤنا *يتحدثون عنه*", fr: "Nos clients en *parlent*", en: "Our customers *talk about it*" },
];

export const LEADS: readonly L3[] = [
  {
    ar: "طلبات تصل إلى كل المدن، ورسائل تصلنا بعدها.",
    fr: "Des colis livrés partout au Maroc, et les messages qui arrivent ensuite.",
    en: "Parcels delivered all over the country, and the messages that follow.",
  },
  {
    ar: "دفعوا عند الاستلام، جرّبوه، ثم راسلونا.",
    fr: "Ils ont payé à la réception, l'ont essayé, puis nous ont écrit.",
    en: "They paid on delivery, tried it, then wrote back.",
  },
];

export const UI = {
  kicker: { ar: "من زبنائنا", fr: "Vos messages", en: "From our customers" },
  note: { ar: "صورتها يوم وصل الطلب", fr: "Sa photo, le jour de la livraison", en: "Her photo, on delivery day" },
  countLabel: { ar: "طلبية وصلت ودُفعت عند الاستلام", fr: "colis livrés et payés à la réception", en: "parcels delivered and paid on delivery" },
  since: { ar: "منذ افتتاح المتجر", fr: "depuis l'ouverture de la boutique", en: "since we opened" },
  cta: { ar: "بغيت نطلب حتى أنا", fr: "Je commande aussi", en: "I'll order one too" },
  /* render-time microcopy */
  store: { ar: "المتجر", fr: "La boutique", en: "The store" },
  chatWith: { ar: "محادثة واتساب مع {name}", fr: "Conversation WhatsApp avec {name}", en: "WhatsApp chat with {name}" },
  storyOf: { ar: "ستوري {name}", fr: "Story de {name}", en: "{name}'s story" },
  typing: { ar: "رسالة", fr: "Message", en: "Message" },
  reply: { ar: "رد على {name}…", fr: "Répondre à {name}…", en: "Reply to {name}…" },
  delivered: { ar: "وصلت طلبياتنا إلى", fr: "Livré à", en: "Delivered to" },
} satisfies Record<string, L3>;

/** Fill {name}/{product}/{city} placeholders. */
export function fillIn(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** Female first names (thread 1's note says "her photo"). Index into PEOPLE. */
export { WOMEN as FEMALE } from "../reviews/copy";

/** Garments (../garment.ts): the fabric on unboxing, a care tip, the size and the fall (or prayer comfort). */
export function garmentChat(g: Garment): ChatCopy {
  return c(
    { ar: "وصلني اليوم، القماش ناعم بزاف", fr: "Reçu aujourd'hui, le tissu est tout doux", en: "Arrived today, the fabric is so soft" },
    {
      ar: "نصيحة صغيرة: الغسيل على 30 درجة والتنشاف مبسوط، وتبقى بحال الجديدة",
      fr: "Petit conseil : lavage à 30 °C et séchage à plat, c'est tout ce qu'il faut",
      en: "Quick tip: wash at 30 °C and dry flat, that's all it needs",
    },
    g.prayer
      ? { ar: "المقاس جا مضبوط، وفالصلاة مريحة بزاف", fr: "La taille est parfaite, et pour la prière c'est très confortable", en: "The size is perfect, and it's so comfortable for prayer" }
      : { ar: "المقاس جا مضبوط، وكتطيح مزيان", fr: "La taille est parfaite, et le tombé est beau", en: "The size is perfect, and it falls beautifully" },
    g.prayer ? { ar: "قبل صلاة العصر", fr: "Avant la prière du Asr", en: "Before Asr prayer" } : { ar: "لوك اليوم", fr: "La tenue du jour", en: "Today's outfit" },
  );
}
