/**
 * Default copy for the benefits section, per product story and language.
 * Row = [icon, title, text, stat?, statLabel?]: concrete outcomes in the buyer's day. Figures are
 * product facts the merchant must check (doses, hours, seconds), never social proof.
 * French is written with plain spaces; `typo()` sets the no-break spaces of French typography.
 * Arabic figures are chosen so number + noun agree (3–10 plural, 11–99 singular accusative).
 */
import type { Product, ProductCategory } from "@/lib/page/schema";
import { garmentOf, type Garment } from "../garment";
import type { CopyLang, IconName, Tri } from "./kit";

export type BenefitRow = readonly [icon: IconName, title: string, text: string, stat?: string, statLabel?: string];

export interface BenefitsCommonCopy {
  kickers: readonly string[];
  /** {short} = short product name */
  titles: readonly string[];
  leads: readonly string[];
}

export const COMMON: Tri<BenefitsCommonCopy> = {
  fr: {
    kickers: ["Pourquoi on l'adore", "Les bienfaits", "Au quotidien"],
    titles: ["Ce que change {short}, *au quotidien*", "Les détails qui *font la différence*", "Pensé pour *votre quotidien*"],
    leads: [
      "Pas de promesses vagues : voici ce qui change, concrètement.",
      "Des détails concrets, que vous vérifiez dès la livraison.",
      "Ce que vous remarquerez dès les premiers jours.",
    ],
  },
  ar: {
    kickers: ["لماذا ستحبّه", "المزايا", "في يومك"],
    titles: ["ما الذي يغيّره {short} *في يومك*", "تفاصيل تصنع *الفرق*", "مصمَّم *لحياتك اليومية*"],
    leads: ["بلا وعود فضفاضة: هذا ما سيتغيّر، بالتفصيل.", "تفاصيل ملموسة تتحقّق منها لحظة الاستلام.", "ما ستلاحظه منذ الأيام الأولى."],
  },
  en: {
    kickers: ["Why you'll love it", "The benefits", "Day to day"],
    titles: ["What {short} changes *day to day*", "The details that *make the difference*", "Made for *your everyday*"],
    leads: [
      "No vague promises: here's what changes, concretely.",
      "Concrete details you can check the moment it arrives.",
      "What you'll notice from the very first days.",
    ],
  },
};

/** Finer than the shared copy families: a serum, a necklace and a handbag don't share a story. */
export type Story =
  | "care"
  | "hair"
  | "scent"
  | "jewel"
  | "wear"
  | "active"
  | "kitchen"
  | "home"
  | "tech"
  | "garage"
  | "kids"
  | "pets"
  | "natural"
  | "general";

const STORY_OF: Record<ProductCategory, Story> = {
  beauty: "care",
  skincare: "care",
  grooming: "care",
  haircare: "hair",
  fragrance: "scent",
  jewelry: "jewel",
  watches: "jewel",
  fashion: "wear",
  bags: "wear",
  fitness: "active",
  sport: "active",
  kitchen: "kitchen",
  home: "home",
  cleaning: "home",
  decor: "home",
  garden: "home",
  tech: "tech",
  gadgets: "tech",
  car: "garage",
  tools: "garage",
  kids: "kids",
  toys: "kids",
  pets: "pets",
  health: "natural",
  supplements: "natural",
  "organic-food": "natural",
  traditional: "natural",
  other: "general",
};

export function storyOf(category: ProductCategory | undefined): Story {
  return (category && STORY_OF[category]) || "general";
}

/**
 * Typography pass: French no-break spaces (narrow before ? ! ;, regular before : and inside « »),
 * and a no-break space between a number and its unit in every language ("24 h", "100 %").
 */
export function typo(lang: CopyLang, s: string): string {
  let out = s.replace(/(\d) (h|min|s|ml|g|kg|cm|mm|dB|%)(?=$|[\s.,;:!?)])/g, "$1 $2");
  if (lang === "fr") {
    out = out
      .replace(/ ([?!;])/g, " $1")
      .replace(/ :/g, " :")
      .replace(/« /g, "« ")
      .replace(/ »/g, " »");
  }
  return out;
}

const CHECK_FR: BenefitRow = ["eye", "Vérifiez avant de payer", "Vous ouvrez le colis devant le livreur : satisfait, vous payez ; sinon, vous ne payez rien."];
const CHECK_AR: BenefitRow = ["eye", "عاين قبل أن تدفع", "تفتح الطرد أمام عامل التوصيل: إن أعجبك تدفع، وإلا فلا تدفع شيئًا."];
const CHECK_EN: BenefitRow = ["eye", "Check before you pay", "You open the parcel in front of the courier: happy, you pay; if not, you pay nothing."];

const SWAP_FR: BenefitRow = ["return", "Échange sous 7 jours", "Un défaut à la réception ? On l'échange, sans discussion.", "7", "jours pour l'échanger"];
const SWAP_AR: BenefitRow = ["return", "تبديل خلال 7 أيام", "عيب عند الاستلام؟ نستبدله دون نقاش.", "7", "أيام للتبديل"];
const SWAP_EN: BenefitRow = ["return", "7-day exchange", "A defect on arrival? We swap it, no arguing.", "7", "days to exchange"];

export const ITEMS: Record<Story, Tri<readonly BenefitRow[]>> = {
  care: {
    fr: [
      ["drop", "Absorbé en une minute", "Une petite quantité suffit. La peau boit la texture sans film gras, et le maquillage peut suivre tout de suite.", "60 s", "pour pénétrer"],
      ["leaf", "Une formule courte", "Sans parfum ajouté ni silicone. La liste d'ingrédients se lit en quelques secondes."],
      ["clock", "Visible en 14 jours", "Un grain de peau plus lisse et un teint plus uniforme dès la deuxième semaine d'usage régulier.", "14", "jours d'usage régulier"],
      ["sun", "Matin et soir", "Assez léger pour la journée sous la crème solaire, assez riche pour la routine du soir."],
      ["gem", "Un flacon qui dure", "Une petite dose à chaque fois : un flacon couvre environ deux mois d'usage quotidien.", "60", "jours d'usage, environ"],
    ],
    ar: [
      ["drop", "يتشرّبه الجلد في دقيقة", "كمية صغيرة تكفي. تتشرّب البشرة القوام دون لمعة دهنية، ويمكنك وضع الماكياج بعده مباشرة.", "60", "ثانية ليتغلغل في البشرة"],
      ["leaf", "تركيبة قصيرة وواضحة", "بلا عطر مضاف ولا سيليكون. قائمة المكوّنات تُقرأ في ثوانٍ."],
      ["clock", "نتيجة تظهر خلال 14 يومًا", "بشرة أنعم ولون أكثر توحّدًا ابتداءً من الأسبوع الثاني من الاستعمال المنتظم.", "14", "يومًا من الاستعمال المنتظم"],
      ["sun", "صباحًا ومساءً", "خفيف بما يكفي للنهار تحت واقي الشمس، وغنيّ بما يكفي لروتين الليل."],
      ["gem", "عبوة تدوم طويلًا", "كمية صغيرة في كل مرة: عبوة واحدة تكفي قرابة شهرين من الاستعمال اليومي.", "60", "يومًا من الاستعمال تقريبًا"],
    ],
    en: [
      ["drop", "Absorbed in a minute", "A little goes a long way. Skin drinks it in with no greasy film, so make-up can go straight on.", "60 s", "to sink in"],
      ["leaf", "A short, clear formula", "No added fragrance, no silicones. The ingredient list reads in seconds."],
      ["clock", "Visible in 14 days", "Smoother texture and a more even tone from the second week of regular use.", "14", "days of regular use"],
      ["sun", "Morning and night", "Light enough for daytime under sunscreen, rich enough for your evening routine."],
      ["gem", "A bottle that lasts", "A small amount each time: one bottle covers about two months of daily use.", "60", "days of use, roughly"],
    ],
  },
  hair: {
    fr: [
      ["feather", "Des cheveux plus légers", "Nourrit les longueurs sans les alourdir : les cheveux restent souples et bougent naturellement."],
      ["sun", "De la brillance dès le premier usage", "La fibre se lisse et la lumière glisse dessus, même sur cheveux secs ou colorés."],
      ["clock", "Moins de pointes sèches en 3 semaines", "Deux à trois applications par semaine, et les pointes cassent nettement moins.", "3", "semaines d'usage régulier"],
      ["drop", "Une petite dose suffit", "Deux pressions pour des cheveux mi-longs : le flacon dure longtemps."],
      ["hand-heart", "Pour tous les types de cheveux", "Lisses, ondulés ou frisés : la texture s'adapte, sans effet carton."],
    ],
    ar: [
      ["feather", "شعر أخفّ وأنعم", "يغذّي الأطراف دون أن يثقلها، فيبقى الشعر ليّنًا ويتحرّك بشكل طبيعي."],
      ["sun", "لمعان من أول استعمال", "تتنعّم الشعرة وينساب عليها الضوء، حتى على الشعر الجاف أو المصبوغ."],
      ["clock", "أطراف أقل جفافًا خلال 3 أسابيع", "مرتان إلى ثلاث مرات في الأسبوع، ويقلّ تقصّف الأطراف بوضوح.", "3", "أسابيع من الاستعمال المنتظم"],
      ["drop", "كمية صغيرة تكفي", "ضغطتان تكفيان للشعر المتوسط الطول، لذلك تدوم العبوة طويلًا."],
      ["hand-heart", "لكل أنواع الشعر", "ناعم أو مموّج أو مجعّد: القوام يناسبه دون أن يتركه قاسيًا."],
    ],
    en: [
      ["feather", "Lighter, softer hair", "Feeds the lengths without weighing them down, so hair stays supple and moves naturally."],
      ["sun", "Shine from the first use", "The fibre smooths out and light glides over it, even on dry or coloured hair."],
      ["clock", "Fewer dry ends in 3 weeks", "Two or three times a week, and ends break noticeably less.", "3", "weeks of regular use"],
      ["drop", "A little is enough", "Two pumps for mid-length hair, so the bottle lasts."],
      ["hand-heart", "For every hair type", "Straight, wavy or curly: the texture adapts, never stiff or crunchy."],
    ],
  },
  scent: {
    fr: [
      ["clock", "Du matin à minuit", "Concentration eau de parfum : deux vaporisations le matin, on vous en parle encore le soir.", "12 h", "de tenue sur la peau"],
      ["feather", "Un sillage, pas un nuage", "Il se remarque quand on s'approche, sans envahir la pièce ni l'ascenseur."],
      ["flame", "Des notes qui évoluent", "Une ouverture fraîche, un cœur floral, puis un fond boisé qui s'installe au fil des heures.", "3", "temps : tête, cœur, fond"],
      ["gift", "Prêt à offrir", "Flacon lourd et coffret soigné : il arrive emballé, il n'y a plus qu'à l'offrir."],
      ["gem", "Qualité de niche", "Des matières choisies comme en parfumerie de créateur, sans payer le nom."],
    ],
    ar: [
      ["clock", "من الصباح إلى منتصف الليل", "بتركيز أو دو بارفان: رشّتان في الصباح، وفي المساء ما زالوا يسألونك عنه.", "12", "ساعة من الثبات على البشرة"],
      ["feather", "أثر يُلاحَظ، لا سحابة تخنق", "يُشمّ حين يقترب منك أحدهم، دون أن يملأ الغرفة أو المصعد."],
      ["flame", "نوتات تتطوّر مع الوقت", "افتتاحية منعشة، ثم قلب زهري، ثم قاعدة خشبية تستقرّ على البشرة مع مرور الساعات.", "3", "مراحل: افتتاحية، قلب، قاعدة"],
      ["gift", "جاهز للإهداء", "قارورة ثقيلة وعلبة أنيقة: يصلك مغلّفًا، ولم يبقَ إلا أن تهديه."],
      ["gem", "جودة العطور الراقية", "مواد أولية مختارة كما في عطور المبدعين، دون أن تدفع ثمن الاسم."],
    ],
    en: [
      ["clock", "Morning to midnight", "Eau de parfum strength: two sprays in the morning, and people still mention it at night.", "12 h", "on the skin"],
      ["feather", "A trail, not a cloud", "Noticed when someone leans in, without filling the room or the lift."],
      ["flame", "Notes that unfold", "A fresh opening, a floral heart, then a woody base that settles in over the hours.", "3", "acts: top, heart, base"],
      ["gift", "Ready to gift", "A weighty bottle in a neat box: it arrives wrapped, ready to give."],
      ["gem", "Niche quality", "Materials chosen like a creator's perfume, without paying for the name."],
    ],
  },
  jewel: {
    fr: [
      ["gem", "L'éclat qui dure", "Finition traitée contre l'oxydation : la couleur tient au contact de l'eau et du parfum."],
      ["eye", "Vérifiez avant de payer", "Le livreur attend que vous ouvriez le colis. Pas comme sur la photo ? Vous ne payez rien."],
      ["shield-check", "Pensé pour tous les jours", "Fermoir et finitions renforcés : à porter au quotidien, pas seulement le week-end."],
      ["heart", "Le détail qui fait la tenue", "Un jean, une chemise blanche et cette pièce : on vous demandera où vous l'avez trouvée."],
      ["gift", "Écrin offert", "Livré dans son écrin, prêt à offrir pour un anniversaire ou pour l'Aïd."],
    ],
    ar: [
      ["gem", "بريق يدوم", "تشطيب معالَج ضد التأكسد: يحافظ على لونه رغم الماء والعطر."],
      ["eye", "عاين قبل أن تدفع", "ينتظرك عامل التوصيل حتى تفتح الطرد. إن لم تكن القطعة كما في الصورة، فلا تدفع شيئًا."],
      ["shield-check", "متينة للاستعمال اليومي", "قفل وتشطيب مقوّيان، لتلبسها كل يوم، لا في المناسبات فقط."],
      ["heart", "التفصيل الذي يكمّل الإطلالة", "جينز وقميص أبيض وهذه القطعة: سيسألونك من أين اشتريتها."],
      ["gift", "علبة هدية مرفقة", "تصلك في علبتها، جاهزة للإهداء في عيد ميلاد أو في العيد."],
    ],
    en: [
      ["gem", "Shine that lasts", "Anti-tarnish finish: the colour holds around water and perfume."],
      ["eye", "Check it before you pay", "The courier waits while you open the parcel. Not like the photo? You pay nothing."],
      ["shield-check", "Made for every day", "Reinforced clasp and finish, built for daily wear, not just weekends."],
      ["heart", "The detail that makes the outfit", "Jeans, a white shirt and this piece: people will ask where you found it."],
      ["gift", "Gift box included", "Arrives in its box, ready for a birthday or for Eid."],
    ],
  },
  wear: {
    fr: [
      ["feather", "Une matière agréable", "Douce au toucher et souple à l'usage : elle garde sa forme, même portée tous les jours."],
      ["ruler", "La bonne taille, du premier coup", "Un guide des tailles précis, et la taille revue avec vous à l'appel de confirmation. Pas la bonne ? On l'échange."],
      ["shield-check", "Coutures et finitions solides", "Coutures doublées et finitions nettes : la pièce garde sa forme, même portée tous les jours."],
      ["heart", "Facile à assortir", "Une coupe et une couleur qui vont avec ce que vous avez déjà dans l'armoire."],
      CHECK_FR,
    ],
    ar: [
      ["feather", "خامة مريحة", "ناعمة الملمس ولّينة في الاستعمال: تحافظ على شكلها حتى مع الاستعمال اليومي."],
      ["ruler", "المقاس المناسب من أول مرة", "دليل مقاسات دقيق، ونراجع المقاس معك في مكالمة التأكيد. المقاس غير مناسب؟ نستبدله لك."],
      ["shield-check", "خياطة وتشطيب متينان", "خياطة مزدوجة وتشطيب نظيف: تحافظ القطعة على شكلها حتى مع الاستعمال اليومي."],
      ["heart", "سهلة التنسيق", "قَصّة ولون يتماشيان مع ما في خزانتك أصلًا."],
      CHECK_AR,
    ],
    en: [
      ["feather", "A material that feels good", "Soft to the touch and supple in use: it keeps its shape, even worn every day."],
      ["ruler", "The right size, first time", "A precise size guide, and we check the size with you on the confirmation call. Wrong size? We swap it."],
      ["shield-check", "Solid seams and finish", "Double stitching and clean finishing: it keeps its shape, even worn every day."],
      ["heart", "Easy to style", "A cut and colour that go with what's already in your wardrobe."],
      CHECK_EN,
    ],
  },
  active: {
    fr: [
      ["bolt", "Récupérez plus vite", "Moins de courbatures le lendemain, pour enchaîner les séances sans traîner les jambes.", "10 min", "par jour suffisent"],
      ["dumbbell", "Pensé pour l'effort", "Des matériaux qui encaissent la sueur, les chocs et les séances à répétition."],
      ["bag", "Il vous suit partout", "Compact et léger : salle, bureau ou voyage, il prend à peine de place dans le sac."],
      ["battery", "Une semaine sans recharger", "Une charge USB-C couvre une semaine de séances. Le témoin lumineux vous prévient.", "6 h", "d'autonomie par charge"],
      ["shield-check", "Garanti et suivi", "Un défaut de fabrication ? On l'échange. Et vos questions trouvent une vraie réponse, avant comme après la commande."],
    ],
    ar: [
      ["bolt", "استرجاع أسرع", "تعب عضلي أقل في الغد، لتواصل تمارينك دون أن تجرّ قدميك.", "10", "دقائق في اليوم تكفي"],
      ["dumbbell", "مصنوع للمجهود", "مواد تتحمّل العرق والصدمات والتمارين المتكرّرة كل يوم."],
      ["bag", "يرافقك أينما ذهبت", "صغير وخفيف: في القاعة أو العمل أو السفر، لا يأخذ مكانًا في الحقيبة."],
      ["battery", "أسبوع دون شحن", "شحنة USB-C تكفي أسبوعًا من التمارين، ومؤشر ضوئي ينبّهك حين يحين وقت الشحن.", "6", "ساعات لكل شحنة"],
      ["shield-check", "مضمون ومتابَع", "عيب في الصنع؟ نستبدله. وأسئلتك تجد جوابًا حقيقيًا، قبل الطلب وبعده."],
    ],
    en: [
      ["bolt", "Recover faster", "Less soreness the next day, so you can keep training without dragging your legs.", "10 min", "a day is enough"],
      ["dumbbell", "Built for effort", "Materials that take sweat, knocks and session after session."],
      ["bag", "Goes where you go", "Compact and light: gym, office or travel, it barely takes room in the bag."],
      ["battery", "A week between charges", "One USB-C charge covers a week of sessions. The light tells you when to top up.", "6 h", "of use per charge"],
      ["shield-check", "Guaranteed, with real support", "A manufacturing defect? We swap it. And your questions get a real answer, before and after you order."],
    ],
  },
  kitchen: {
    fr: [
      ["clock", "Prêt en 40 secondes", "Un appui et c'est prêt, le temps de mettre vos chaussures.", "40 s", "du début à la fin"],
      ["drop", "Se rince sous le robinet", "Un peu d'eau, une goutte de savon, vingt secondes : rien à démonter."],
      ["battery", "Sans fil, rechargeable", "Une charge USB tient une quinzaine d'utilisations, avec le chargeur de votre téléphone.", "15", "utilisations par charge"],
      ["home", "Prend peu de place", "Il se range dans un tiroir ou sur une étagère : le plan de travail reste libre."],
      ["shield-check", "Des matériaux sûrs", "Sans BPA, faciles à nettoyer, pensés pour durer bien plus qu'une saison."],
    ],
    ar: [
      ["clock", "جاهز في 40 ثانية", "ضغطة واحدة ويكون جاهزًا، في الوقت الذي تلبس فيه حذاءك.", "40", "ثانية من البداية إلى النهاية"],
      ["drop", "يُغسل تحت الصنبور", "قليل من الماء ونقطة صابون وعشرون ثانية: لا شيء يحتاج إلى تفكيك."],
      ["battery", "بلا سلك، قابل للشحن", "شحنة USB واحدة تكفي قرابة خمسة عشر استعمالًا، بشاحن هاتفك نفسه.", "15", "استعمالًا لكل شحنة"],
      ["home", "لا يأخذ مكانًا", "يُحفظ في درج أو على رفّ، ويبقى سطح المطبخ فارغًا."],
      ["shield-check", "مواد آمنة", "خالٍ من BPA، سهل التنظيف، ومصنوع ليدوم أكثر من موسم."],
    ],
    en: [
      ["clock", "Ready in 40 seconds", "One press and it's done, in the time it takes to put your shoes on.", "40 s", "start to finish"],
      ["drop", "Rinses under the tap", "A little water, a drop of soap, twenty seconds: nothing to take apart."],
      ["battery", "Cordless, rechargeable", "One USB charge lasts about fifteen uses, on your phone charger.", "15", "uses per charge"],
      ["home", "Takes little room", "It fits in a drawer or on a shelf, so the counter stays clear."],
      ["shield-check", "Safe materials", "BPA-free, easy to clean, built to last well beyond a season."],
    ],
  },
  home: {
    fr: [
      ["home", "Il trouve sa place", "Des lignes simples et des couleurs douces qui s'accordent avec votre intérieur."],
      ["clock", "Installé en 5 minutes", "Pas d'outils compliqués ni de notice de vingt pages : on le sort, on le pose, c'est fait.", "5 min", "d'installation"],
      ["drop", "Facile à entretenir", "Un coup de chiffon humide suffit : il garde son aspect neuf au fil des mois."],
      ["shield-check", "Fait pour durer", "Des matériaux choisis pour résister à l'usage quotidien, aux enfants et au temps."],
      CHECK_FR,
    ],
    ar: [
      ["home", "يجد مكانه في بيتك", "خطوط بسيطة وألوان هادئة تنسجم مع ديكور بيتك."],
      ["clock", "يُركَّب في 5 دقائق", "بلا أدوات معقّدة ولا دليل من عشرين صفحة: تُخرجه وتضعه، وانتهى الأمر.", "5", "دقائق للتركيب"],
      ["drop", "سهل التنظيف", "مسحة بقطعة قماش مبلّلة تكفي، ويبقى كالجديد مع مرور الشهور."],
      ["shield-check", "مصنوع ليدوم", "مواد مختارة لتتحمّل الاستعمال اليومي والأطفال ومرور الوقت."],
      CHECK_AR,
    ],
    en: [
      ["home", "It finds its place", "Simple lines and soft colours that sit well with your interior."],
      ["clock", "Set up in 5 minutes", "No complicated tools, no twenty-page manual: take it out, put it in place, done.", "5 min", "to set up"],
      ["drop", "Easy to look after", "A wipe with a damp cloth is enough: it keeps looking new for months."],
      ["shield-check", "Made to last", "Materials chosen to stand up to daily use, kids and time."],
      CHECK_EN,
    ],
  },
  tech: {
    fr: [
      ["battery", "Une journée d'autonomie", "Une charge le matin, et vous n'y pensez plus jusqu'au soir.", "24 h", "sur une seule charge"],
      ["bolt", "Prêt en une minute", "On le sort de la boîte, on l'allume, ça marche. Aucune application obligatoire."],
      ["shield-check", "Solide, bien fini", "Boîtier rigide, boutons francs, rien qui grince ni qui chauffe."],
      ["headset", "Un conseiller au téléphone", "À l'appel de confirmation, posez vos questions d'installation : une vraie personne vous répond, en darija ou en français."],
      SWAP_FR,
    ],
    ar: [
      ["battery", "بطارية ليوم كامل", "شحنة في الصباح، ولن تفكّر فيها حتى المساء.", "24", "ساعة بشحنة واحدة"],
      ["bolt", "جاهز في دقيقة", "تُخرجه من العلبة وتشغّله، فيعمل. بلا تطبيق إلزامي."],
      ["shield-check", "متين وتشطيبه نظيف", "هيكل صلب وأزرار واضحة، بلا صرير ولا سخونة."],
      ["headset", "مستشار على الهاتف", "في مكالمة التأكيد، اسأل عن التشغيل كما تشاء: يجيبك شخص حقيقي بالدارجة أو بالفرنسية."],
      SWAP_AR,
    ],
    en: [
      ["battery", "A full day of battery", "Charge it in the morning and forget about it until night.", "24 h", "on a single charge"],
      ["bolt", "Ready in one minute", "Out of the box, switch on, it works. No app required."],
      ["shield-check", "Solid, cleanly finished", "Rigid body, crisp buttons, nothing that creaks or heats up."],
      ["headset", "An advisor on the phone", "Ask your set-up questions on the confirmation call: a real person answers, in Darija or French."],
      SWAP_EN,
    ],
  },
  garage: {
    fr: [
      ["bolt", "Plus de puissance, moins d'effort", "Le travail se fait plus vite, sans forcer sur le poignet."],
      ["shield-check", "Construit pour encaisser", "Corps renforcé et pièces métalliques là où ça compte : il supporte les chocs du quotidien."],
      ["ruler", "Des réglages précis", "Chaque réglage est net et reste en place : un résultat propre du premier coup."],
      ["box", "Tout est dans la boîte", "Accessoires inclus et rangés dans leur étui : rien à racheter à part."],
      SWAP_FR,
    ],
    ar: [
      ["bolt", "قوة أكبر بجهد أقل", "تُنجز العمل في وقت أقصر، دون أن تُجهد معصمك."],
      ["shield-check", "مصنوع ليتحمّل", "هيكل مقوّى وأجزاء معدنية حيث يلزم: يتحمّل صدمات الاستعمال اليومي."],
      ["ruler", "ضبط دقيق", "كل ضبط واضح ويبقى في مكانه: نتيجة نظيفة من أول مرة."],
      ["box", "كل شيء في العلبة", "الإكسسوارات مرفقة ومرتّبة في حقيبتها: لا حاجة لشراء أي شيء إضافي."],
      SWAP_AR,
    ],
    en: [
      ["bolt", "More power, less effort", "The job gets done faster, without straining your wrist."],
      ["shield-check", "Built to take it", "Reinforced body and metal parts where it matters: it handles everyday knocks."],
      ["ruler", "Precise settings", "Every setting is crisp and stays put: a clean result the first time."],
      ["box", "Everything's in the box", "Accessories included, stored in their case: nothing extra to buy."],
      SWAP_EN,
    ],
  },
  kids: {
    fr: [
      ["heart", "Ils y reviennent", "Assez simple pour commencer seul, assez riche pour inventer un nouveau jeu chaque soir."],
      ["shield-check", "Des matières sûres", "Bords arrondis, peinture à l'eau, pièces pensées pour les petites mains."],
      ["hand-heart", "Moins d'écrans", "Un jeu qui occupe les mains et la tête, et qui vous laisse boire votre thé tranquille."],
      ["medal", "Robuste", "Il survit aux chutes, aux frères et sœurs et aux changements de chambre."],
      ["gift", "Le cadeau qui fait plaisir", "Livré dans sa boîte, prêt à offrir pour un anniversaire."],
    ],
    ar: [
      ["heart", "يعودون إليها دائمًا", "سهلة ليبدؤوا وحدهم، وغنية بما يكفي لابتكار لعبة جديدة كل مساء."],
      ["shield-check", "مواد آمنة", "حواف مستديرة وألوان مائية وقطع مصمَّمة للأيدي الصغيرة."],
      ["hand-heart", "وقت أقل أمام الشاشة", "لعبة تشغل اليدين والعقل، وتترك لك وقتًا لكأس أتاي في هدوء."],
      ["medal", "متينة", "تتحمّل السقطات والإخوة والتنقّل من غرفة إلى أخرى."],
      ["gift", "هدية تُفرح", "تصل في علبتها، جاهزة للإهداء في عيد الميلاد."],
    ],
    en: [
      ["heart", "They keep coming back", "Simple enough to start alone, rich enough to invent a new game every night."],
      ["shield-check", "Safe materials", "Rounded edges, water-based paint, parts sized for small hands."],
      ["hand-heart", "Less screen time", "A game that keeps hands and heads busy, and lets you drink your tea in peace."],
      ["medal", "Tough", "It survives falls, siblings and bedroom moves."],
      ["gift", "A gift that lands", "Arrives in its box, ready to give for a birthday."],
    ],
  },
  pets: {
    fr: [
      ["paw", "Adopté dès le premier jour", "Une forme et une matière qu'il reconnaît vite : il s'y installe tout de suite."],
      ["shield-check", "Des matériaux sûrs", "Aucune pièce qui se détache, aucune odeur chimique : pensé pour être mordillé sans risque."],
      ["drop", "Se nettoie facilement", "Poils et taches partent d'un coup d'éponge ou en machine, selon le modèle."],
      ["home", "Plus de calme à la maison", "Un animal occupé et bien installé, c'est moins de dégâts et des soirées plus tranquilles."],
      CHECK_FR,
    ],
    ar: [
      ["paw", "يتقبّله من اليوم الأول", "شكل وخامة يألفهما بسرعة، فيستقرّ عليه منذ اللحظة الأولى."],
      ["shield-check", "مواد آمنة", "بلا قطع تنفصل ولا رائحة كيميائية، ومصمَّم ليتحمّل العضّ دون خطر."],
      ["drop", "سهل التنظيف", "يزول الشعر والبقع بمسحة إسفنجة أو في الغسالة، حسب الموديل."],
      ["home", "هدوء أكثر في البيت", "حيوان منشغل ومرتاح يعني فوضى أقل وأمسيات أهدأ."],
      CHECK_AR,
    ],
    en: [
      ["paw", "Loved from day one", "A shape and material they recognise fast: they settle in straight away."],
      ["shield-check", "Safe materials", "No parts that come loose, no chemical smell: made to be chewed safely."],
      ["drop", "Easy to clean", "Hair and stains come off with a sponge or in the machine, depending on the model."],
      ["home", "A calmer home", "A busy, comfortable pet means less mess and quieter evenings."],
      CHECK_EN,
    ],
  },
  natural: {
    fr: [
      ["map-pin", "Une origine connue", "Produit par une coopérative, avec la région indiquée sur chaque lot."],
      ["leaf", "Rien d'ajouté", "Ni conservateur, ni arôme, ni sucre caché : la liste tient en une ligne.", "100 %", "d'origine naturelle"],
      ["sun", "Fait en petites quantités", "Des lots courts, préparés à la main, comme on le fait depuis des générations."],
      ["hand-heart", "En direct du producteur", "Vous payez ceux qui le fabriquent, pas trois intermédiaires."],
      ["box", "Bien protégé", "Emballage scellé et carton renforcé jusqu'à votre porte."],
    ],
    ar: [
      ["map-pin", "مصدر معروف", "من إنتاج تعاونية، والمنطقة مذكورة على كل دفعة."],
      ["leaf", "لا شيء مضاف", "بلا مواد حافظة ولا منكّهات ولا سكر خفي: المكوّنات في سطر واحد.", "100%", "من أصل طبيعي"],
      ["sun", "إنتاج بكميات صغيرة", "دفعات قليلة تُحضَّر يدويًا، كما يُفعل منذ أجيال."],
      ["hand-heart", "مباشرة من المنتِج", "تدفع لمن صنعه، لا لثلاثة وسطاء."],
      ["box", "تغليف يحميه", "تغليف محكم وكرتون مقوّى حتى باب بيتك."],
    ],
    en: [
      ["map-pin", "A known origin", "Made by a cooperative, with the region printed on every batch."],
      ["leaf", "Nothing added", "No preservatives, no flavourings, no hidden sugar: the list fits on one line.", "100%", "natural origin"],
      ["sun", "Made in small batches", "Short runs, prepared by hand, the way it's been done for generations."],
      ["hand-heart", "Straight from the maker", "You pay the people who make it, not three middlemen."],
      ["box", "Well protected", "Sealed packaging and a reinforced box all the way to your door."],
    ],
  },
  general: {
    fr: [
      CHECK_FR,
      ["truck", "Livré en 24 à 48 h", "Livraison à domicile, sans frais cachés : un appel pour confirmer, puis le colis arrive.", "48 h", "maximum pour la livraison"],
      ["shield-check", "Qualité contrôlée", "Chaque pièce est vérifiée avant l'envoi : pas de surprise en ouvrant la boîte."],
      ["headset", "Un humain au bout du fil", "Avant l'envoi, on vous appelle pour confirmer : vos questions ont leur réponse, en darija ou en français."],
      SWAP_FR,
    ],
    ar: [
      CHECK_AR,
      ["truck", "يصلك خلال 24 إلى 48 ساعة", "توصيل إلى باب بيتك بلا مصاريف خفية: مكالمة للتأكيد، ثم يصلك الطرد.", "48", "ساعة على الأكثر"],
      ["shield-check", "جودة مراقَبة", "تُفحص كل قطعة قبل الإرسال: لا مفاجآت حين تفتح العلبة."],
      ["headset", "إنسان يجيبك", "قبل الإرسال نتصل بك للتأكيد: أسئلتك تجد جوابها، بالدارجة أو بالفرنسية."],
      SWAP_AR,
    ],
    en: [
      CHECK_EN,
      ["truck", "Delivered in 24 to 48 h", "Home delivery, no hidden fees: a call to confirm, then the parcel arrives.", "48 h", "maximum for delivery"],
      ["shield-check", "Checked quality", "Every piece is inspected before shipping: no surprises when you open the box."],
      ["headset", "A human on the line", "Before shipping, we call to confirm: your questions get answered, in Darija or French."],
      SWAP_EN,
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Garments (../garment.ts): fabric, cut, detail, size, check          */
/* ------------------------------------------------------------------ */

type Who = NonNullable<Garment["kids"]>;

interface GarmentRows {
  fabric: BenefitRow;
  /** a veil that stays put (hijab, khimar, scarf) */
  hold: BenefitRow;
  prayer: BenefitRow;
  modest: BenefitRow;
  heritage: BenefitRow;
  cut: BenefitRow;
  lace: BenefitRow;
  embroidery: BenefitRow;
  /** a child dresses alone */
  dress: (who: Who) => BenefitRow;
  care: BenefitRow;
  size: BenefitRow;
  sizeKids: (who: Who) => BenefitRow;
  check: BenefitRow;
}

const GARMENT_ROWS: Tri<GarmentRows> = {
  fr: {
    fabric: ["feather", "Un tissu doux qui respire", "Il tombe avec fluidité, ne colle pas et reste agréable du matin au soir, même quand il fait chaud."],
    hold: ["waves", "Il tient sans glisser", "Facile à draper, il reste en place toute la journée, sans épingles en trop."],
    prayer: ["moon", "Pensée pour la prière", "Ample et couvrante : on s'incline, on se prosterne, rien ne remonte et rien ne serre."],
    modest: ["waves", "Ample et couvrante", "Une coupe qui couvre sans engoncer et laisse bouger librement, du matin au soir."],
    heritage: ["star", "La tradition, en plus léger", "Les lignes d'une pièce traditionnelle, dans une coupe facile à porter aujourd'hui."],
    cut: ["ruler", "Une coupe qui tombe juste", "Ni trop large ni trop près du corps : la pièce se porte facilement et suit chaque mouvement."],
    lace: ["asterisk", "Une dentelle délicate", "Juste ce qu'il faut de dentelle pour habiller la pièce, sans la charger."],
    embroidery: ["asterisk", "Des broderies nettes", "Des motifs réguliers et des fils bien arrêtés : le détail qui se voit de près."],
    dress: (who) =>
      who === "girl"
        ? ["hand-heart", "Elle l'enfile toute seule", "Légère et sans fermeture compliquée : votre fille s'habille seule, et elle en est fière."]
        : ["hand-heart", "Facile à enfiler", `Légère et sans fermeture compliquée : ${who === "boy" ? "votre fils" : "votre enfant"} s'habille sans aide.`],
    care: ["drop", "Facile à entretenir", "Lavage délicat en machine, séchage à plat : la pièce garde sa forme et sa couleur, lavage après lavage."],
    size: ["ruler", "La bonne taille, sans stress", "Choisissez la taille dans le formulaire. À l'appel de confirmation, on la revoit avec vous avant l'envoi."],
    sizeKids: () => ["ruler", "La bonne taille pour son âge", "Choisissez selon l'âge. À l'appel de confirmation, on revoit la taille avec vous avant l'envoi."],
    check: ["eye", "Touchez le tissu avant de payer", "Vous ouvrez le colis devant le livreur : tissu, couleur, taille. Vous payez seulement si tout vous plaît."],
  },
  ar: {
    fabric: ["feather", "قماش ناعم يتنفّس", "ينسدل بانسيابية، لا يلتصق بالجسم، ويبقى مريحًا من الصباح إلى المساء حتى في الأيام الحارة."],
    hold: ["waves", "يثبت ولا ينزلق", "سهل اللفّ، يبقى في مكانه طوال اليوم دون دبابيس كثيرة."],
    prayer: ["moon", "مصمَّمة للصلاة", "واسعة وساترة: في الركوع والسجود، لا شيء يرتفع ولا شيء يضيق."],
    modest: ["waves", "واسعة وساترة", "قصّة تستر دون أن تُثقل، وتترك لك حرية الحركة طوال اليوم."],
    heritage: ["star", "روح التقليد بخفّة اليوم", "خطوط القطعة التقليدية، بقصّة سهلة اللبس في يومك."],
    cut: ["ruler", "قصّة تنسدل كما يجب", "لا واسعة أكثر من اللازم ولا ضيّقة: تُلبس بسهولة وتتبع كل حركة."],
    lace: ["asterisk", "دانتيل رقيق", "دانتيل بالقدر المناسب، يزيّن القطعة دون أن يُثقلها."],
    embroidery: ["asterisk", "طرز متقن", "نقوش منتظمة وخيوط مثبّتة جيدًا: تفصيل يظهر جماله عن قرب."],
    dress: (who) =>
      who === "girl"
        ? ["hand-heart", "تلبسها وحدها", "خفيفة وبلا أزرار معقّدة: ابنتك تلبسها بنفسها، وتفرح بذلك."]
        : ["hand-heart", "سهلة اللبس", `خفيفة وبلا أزرار معقّدة: ${who === "boy" ? "ابنك" : "طفلك"} يلبسها بنفسه دون مساعدة.`],
    care: ["drop", "سهلة العناية", "غسيل لطيف في الآلة وتجفيف مبسوط: تحافظ القطعة على شكلها ولونها غسلة بعد غسلة."],
    size: ["ruler", "المقاس المناسب بلا قلق", "اختر المقاس في الاستمارة، وفي مكالمة التأكيد نراجعه معك قبل الإرسال."],
    sizeKids: (who) => ["ruler", who === "girl" ? "المقاس المناسب لعمرها" : "المقاس المناسب لعمر طفلك", "اختر حسب العمر، وفي مكالمة التأكيد نراجع المقاس معك قبل الإرسال."],
    check: ["eye", "المس القماش قبل أن تدفع", "تفتح الطرد أمام عامل التوصيل: القماش واللون والمقاس. ولا تدفع إلا إذا أعجبك كل شيء."],
  },
  en: {
    fabric: ["feather", "A soft fabric that breathes", "It drapes fluidly, never clings and stays comfortable from morning to night, even on hot days."],
    hold: ["waves", "It stays put", "Easy to drape, it holds all day without a handful of pins."],
    prayer: ["moon", "Made for prayer", "Loose and covering: bow, prostrate, nothing rides up and nothing pinches."],
    modest: ["waves", "Loose and covering", "A cut that covers without weighing you down, and lets you move freely all day."],
    heritage: ["star", "Tradition, made lighter", "The lines of a traditional piece, in a cut that's easy to wear today."],
    cut: ["ruler", "A cut that falls right", "Not too loose, not too close: easy to wear, and it moves with you."],
    lace: ["asterisk", "Delicate lace", "Just enough lace to dress the piece without weighing it down."],
    embroidery: ["asterisk", "Clean embroidery", "Even patterns and well-secured threads: the detail that shows up close."],
    dress: (who) =>
      who === "girl"
        ? ["hand-heart", "She puts it on herself", "Light, with no fiddly fastening: your daughter dresses on her own, and she's proud of it."]
        : ["hand-heart", "Easy to put on", `Light, with no fiddly fastening: ${who === "boy" ? "your son" : "your child"} dresses without help.`],
    care: ["drop", "Easy to care for", "Gentle machine wash, dry flat: it keeps its shape and colour, wash after wash."],
    size: ["ruler", "The right size, no stress", "Pick your size in the form. On the confirmation call, we go over it with you before shipping."],
    sizeKids: () => ["ruler", "The right size for their age", "Choose by age. On the confirmation call, we go over the size with you before shipping."],
    check: ["eye", "Feel the fabric before you pay", "You open the parcel in front of the courier: fabric, colour, size. You only pay if it's all right."],
  },
};

/**
 * Benefits of a garment: the fabric, its shape (prayer, modest, heritage, a veil that holds, or the
 * cut), one detail (lace, embroidery, a child dressing alone, care), the size, and the check before
 * paying. Never the jewelry lines of the "jewel" story.
 */
export function garmentItems(lang: CopyLang, g: Garment): BenefitRow[] {
  const r = GARMENT_ROWS[lang];
  const who: Who = g.kids ?? "child";
  if (g.scarf) {
    const detail = g.lace ? r.lace : g.embroidery ? r.embroidery : null;
    return [r.fabric, r.hold, ...(detail ? [detail] : []), r.care, r.check];
  }
  const shape = g.prayer ? r.prayer : g.modest ? r.modest : g.heritage ? r.heritage : r.cut;
  const detail = g.lace ? r.lace : g.embroidery ? r.embroidery : g.kids ? r.dress(who) : r.care;
  return [r.fabric, shape, detail, g.kids ? r.sizeKids(who) : r.size, r.check];
}

/** Default benefit rows for a product: a garment's own (../garment.ts), else its story's. */
export function rowsFor(lang: CopyLang, product: Pick<Product, "name" | "category" | "description">): readonly BenefitRow[] {
  const g = garmentOf(product);
  return g ? garmentItems(lang, g) : ITEMS[storyOf(product.category)][lang];
}
