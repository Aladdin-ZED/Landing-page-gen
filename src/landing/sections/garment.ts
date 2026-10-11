/**
 * Garment copy family — shared by the section defaults (copy.ts files and the defaults() that read
 * them). A garment is clothing: an abaya, a djellaba, a prayer dress, a hijab, a girl's kaftan… Its
 * copy talks about fabric, cut, finishing, care and size — never about clasps, 316L steel or a gift
 * box, which is what the "style" (jewelry & accessories) family says.
 *
 * Detection reads the category and the merchant's own words:
 *   - fashion            → a garment, unless the name names an accessory (bag, watch, necklace…);
 *   - kids, toys, traditional, other, sport, fitness → a garment only when the NAME names a garment
 *     ("Abaya de prière…", "عباية صلاة…", "Girls' prayer dress"), and not as the object of "pour /
 *     for / لل" ("Cintre pour robes", "مكواة للملابس" are not garments);
 *   - every other category (jewelry, bags, beauty, kitchen…) is never a garment.
 * Flavors (prayer, kids, lace…) then tune a few lines; they read the name and the description.
 * Pure & deterministic: no globals, no React.
 */
import type { Product, ProductCategory } from "@/lib/page/schema";

export interface Garment {
  /** modest wear (abaya, hijab, jilbab, khimar, isdal…) or prayer wear */
  modest: boolean;
  /** made for prayer (isdal, "de prière", "للصلاة"…) */
  prayer: boolean;
  /** traditional Moroccan wear (djellaba, kaftan, takchita, gandoura, jabador) */
  heritage: boolean;
  /** a veil or scarf (hijab, khimar, tarha, foulard): drape and hold, no length or cut */
  scarf: boolean;
  /** lace trim in the merchant's words */
  lace: boolean;
  /** embroidery (brodé, sfifa, randa, طرز…) */
  embroidery: boolean;
  /** who wears it when it is for children: a girl, a boy, or a child (unknown) */
  kids: "girl" | "boy" | "child" | null;
}

/* ------------------------------------------------------------------ */
/* Lexicon (fr · en · ar · darija in Latin letters)                    */
/* ------------------------------------------------------------------ */

const SCARF = ["hijab", "hijabs", "khimar", "khimars", "tarha", "foulard", "foulards", "écharpe", "echarpe", "châle", "chale", "scarf", "shawl", "حجاب", "خمار", "طرحة", "شال", "وشاح", "فولار"];

const MODEST = [
  ...SCARF,
  "abaya", "abayas", "jilbab", "jilbeb", "isdal", "esdal", "niqab", "burkini", "modest", "modeste", "pudique",
  "عباية", "عبايه", "عبايات", "جلباب", "اسدال", "إسدال", "نقاب", "بوركيني", "محتشم", "محتشمة",
];

const PRAYER = ["prière", "priere", "prayer", "salat", "salah", "isdal", "esdal", "صلاة", "الصلاة", "للصلاة", "اسدال", "إسدال"];

const HERITAGE = [
  "djellaba", "djellabas", "jellaba", "jellabas", "jalaba", "jlaba", "kaftan", "kaftans", "caftan", "caftans", "takchita",
  "takchitas", "gandoura", "gandouras", "jabador", "jabadors", "قفطان", "جلابة", "جلابية", "تكشيطة", "قندورة", "كندورة", "جبادور",
];

const GARMENT = [
  ...MODEST,
  ...HERITAGE,
  "robe", "robes", "dress", "dresses", "jupe", "jupes", "skirt", "skirts", "pantalon", "pantalons", "trousers", "jean", "jeans",
  "chemise", "chemises", "shirt", "shirts", "t-shirt", "t-shirts", "tshirt", "tee-shirt", "blouse", "blouses", "tunique",
  "tuniques", "tunic", "tunics", "pull", "pulls", "sweater", "sweatshirt", "hoodie", "gilet", "cardigan", "manteau", "manteaux",
  "coat", "veste", "vestes", "jacket", "blouson", "doudoune", "pyjama", "pyjamas", "pajama", "pajamas", "survêtement",
  "survetement", "jogging", "legging", "leggings", "salopette", "barboteuse", "kimono", "kimonos",
  "فستان", "فساتين", "كسوة", "تنورة", "صاية", "سروال", "قميص", "بلوزة", "تونيك", "معطف", "سترة", "جاكيت", "بيجامة",
  "ملابس", "لباس", "تريكو", "بدلة",
];

/** Outfit words: a garment when the outfit is for prayer or modest wear ("Ensemble de prière fillette"). */
const OUTFIT = ["ensemble", "ensembles", "tenue", "tenues", "outfit", "outfits", "طقم", "أطقم", "زي"];

/** Fashion items that are accessories, not garments: they keep the style copy. */
const ACCESSORY = [
  "sac", "sacs", "bag", "bags", "pochette", "portefeuille", "wallet", "montre", "montres", "watch", "watches", "bijou",
  "bijoux", "collier", "colliers", "necklace", "bracelet", "bracelets", "bague", "bagues", "ring", "rings", "boucles",
  "earrings", "ceinture", "ceintures", "belt", "lunettes", "sunglasses", "glasses", "chaussure", "chaussures", "shoes",
  "basket", "baskets", "sneakers", "sandale", "sandales", "sandals", "babouche", "babouches", "talons", "heels", "casquette",
  "cap", "chapeau", "hat",
  "حقيبة", "حقائب", "ساعة", "نظارات", "نظارة", "حذاء", "أحذية", "صندل", "بلغة", "سوار", "قلادة", "خاتم", "حزام", "قبعة", "اكسسوارات", "إكسسوارات",
];

const LACE = ["dentelle", "dentelles", "lace", "guipure", "دانتيل", "دانتال", "الدانتيل", "تخريم"];
const EMBROIDERY = ["brodé", "brodée", "brodee", "brode", "broderie", "broderies", "embroidered", "embroidery", "sfifa", "randa", "طرز", "مطرز", "مطرزة", "تطريز", "سفيفة", "راندة"];

const GIRL = ["fille", "filles", "fillette", "fillettes", "girl", "girls", "بنات", "بنت", "طفلة", "البنات"];
const BOY = ["garçon", "garcon", "garçons", "garcons", "boy", "boys", "ولد", "أولاد", "اولاد", "طفل"];
const CHILD = ["enfant", "enfants", "kid", "kids", "bébé", "bebe", "baby", "junior", "أطفال", "اطفال", "صغار", "رضيع"];

/** Prepositions after which a garment word is the object, not the product ("Cintre pour robes"). */
const FOR = new Set(["pour", "for", "à", "anti", "spécial", "special"]);

/** Categories that may hold a garment when the name says so. */
const MAYBE = new Set<ProductCategory>(["kids", "toys", "traditional", "other", "sport", "fitness"]);

const set = (list: readonly string[]) => new Set(list.map((w) => w.normalize("NFC").toLowerCase()));
const GARMENT_SET = set(GARMENT);
const MODEST_SET = set(MODEST);
const PRAYER_SET = set(PRAYER);
const HERITAGE_SET = set(HERITAGE);
const SCARF_SET = set(SCARF);
const ACCESSORY_SET = set(ACCESSORY);
const OUTFIT_SET = set(OUTFIT);
const LACE_SET = set(LACE);
const EMBROIDERY_SET = set(EMBROIDERY);
const GIRL_SET = set(GIRL);
const BOY_SET = set(BOY);
const CHILD_SET = set(CHILD);

/** Arabic attached particles ("والعباية", "بالجلابة") still read as their word. */
const AR_PREFIX = /^(?:[وفبك]?ال|[وفبك])/;

function words(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "") // Arabic diacritics and tatweel
    .replace(/[’']/g, " ")
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length >= 2 && w.length <= 32)
    .slice(0, 200);
}

/**
 * The word, or its bare form without an Arabic prefix, is in the set. `loose` also reads through
 * "لل" ("للبنات", "للصلاة"): right for flavors, wrong for "is this a garment" (an object).
 */
function inSet(w: string, s: ReadonlySet<string>, loose = false): boolean {
  if (s.has(w)) return true;
  const bare = w.replace(loose ? /^(?:لل|[وفبك]?ال|[وفبكل])/ : AR_PREFIX, "");
  return bare.length >= 2 && bare !== w && s.has(bare);
}

const anyIn = (list: readonly string[], s: ReadonlySet<string>, loose = true) => list.some((w) => inSet(w, s, loose));

/**
 * The product's name names a garment as the thing sold: a garment word that is not the object of
 * "pour / for / à" (Latin), or an outfit word with a prayer / modest word. An Arabic object carries "لل" ("مكواة للملابس"), which AR_PREFIX never
 * strips, so it does not count either.
 */
function namesGarment(name: readonly string[]): boolean {
  let afterFor = false;
  let outfit = false;
  for (const w of name) {
    if (FOR.has(w)) afterFor = true;
    if (afterFor) continue;
    if (inSet(w, GARMENT_SET)) return true;
    if (inSet(w, OUTFIT_SET)) outfit = true;
  }
  // "Ensemble de prière", "Tenue modeste", "طقم صلاة": an outfit named by what it is worn for
  return outfit && (anyIn(name, PRAYER_SET) || anyIn(name, MODEST_SET));
}

/** The garment profile of a product, or null when it is not clothing. */
export function garmentOf(product: Pick<Product, "name" | "category"> & { description?: string | undefined }): Garment | null {
  const name = words(product.name);
  const all = [...name, ...words(product.description ?? "")];
  const category = product.category;
  let garment = false;
  if (category === "fashion") garment = namesGarment(name) || !anyIn(name, ACCESSORY_SET, false);
  else if (MAYBE.has(category)) garment = namesGarment(name);
  if (!garment) return null;

  const prayer = anyIn(all, PRAYER_SET);
  const girl = anyIn(all, GIRL_SET);
  const boy = !girl && anyIn(all, BOY_SET);
  const child = category === "kids" || category === "toys" || girl || boy || anyIn(all, CHILD_SET);
  return {
    modest: prayer || anyIn(name, MODEST_SET),
    prayer,
    heritage: anyIn(name, HERITAGE_SET),
    scarf: anyIn(name, SCARF_SET) && !name.some((w) => inSet(w, GARMENT_SET) && !inSet(w, SCARF_SET)),
    lace: anyIn(all, LACE_SET),
    embroidery: anyIn(all, EMBROIDERY_SET),
    kids: girl ? "girl" : boy ? "boy" : child ? "child" : null,
  };
}
