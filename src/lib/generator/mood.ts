/**
 * Product mood — how loud the page may be, read from the product's own words (name, tagline,
 * description, merchant facts), its photo palette, its category and the on-device AI vibe.
 *
 *   calm    modest, soft, delicate, quiet (a beige lace prayer abaya, a silk scarf, a baby muslin):
 *           quiet archetypes only (Maison, Bloom, Editorial…), calm motion, low-chroma color,
 *           few color blocks, no scrolling bands, no poster/sticker compositions.
 *   lively  loud on purpose (toys, neon gadgets, sport gear): the archetypes' full energy.
 *   neutral everything else: the archetype decides.
 *
 * The category alone never makes a product calm or loud: a kids' prayer abaya is "kids" in the
 * catalog and calm in spirit. Pure & deterministic.
 */
import type { Archetype, ProductCategory } from "@/lib/page/schema";
import { CALM_ARCHETYPES, isQuietProduct, type ExtractedPalette } from "@/lib/theme";

export type ProductMood = "calm" | "lively" | "neutral";

export interface MoodReading {
  mood: ProductMood;
  /** modest-wear / devotional product (abaya, hijab, prayer mat…) */
  modest: boolean;
  /** the product words that decided it, for the direction's "why" line (≤ 3) */
  words: string[];
}

export const NEUTRAL_MOOD: MoodReading = { mood: "neutral", modest: false, words: [] };

/* ------------------------------------------------------------------ */
/* Keywords                                                            */
/* ------------------------------------------------------------------ */

interface KeywordSource {
  name?: string | null;
  tagline?: string | null;
  description?: string | null;
}

/**
 * The product's own words as one short text: name, tagline, description and merchant facts
 * (markup and list dashes stripped, de-duplicated, ≤ 600 chars). Fed to the theme engine and to
 * readMood().
 */
export function productKeywords(product: KeywordSource, facts: readonly string[] = []): string {
  const parts = [product.name, product.tagline, product.description, ...facts]
    .filter((p): p is string => typeof p === "string")
    .map((p) =>
      p
        .replace(/\*+/g, "")
        .replace(/^\s*[-•·]\s*/gm, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  return [...new Set(parts)].join(" · ").slice(0, 600);
}

/* ------------------------------------------------------------------ */
/* Lexicon (en / fr / ar / darija in Latin letters)                    */
/* ------------------------------------------------------------------ */

/** Modest wear and devotional objects: always a calm, respectful page. */
const MODEST = [
  "abaya", "abayas", "hijab", "hijabs", "khimar", "jilbab", "jilbeb", "isdal", "esdal", "niqab", "burkini",
  "modest", "modesty", "modeste", "pudique", "prayer", "priere", "prière", "salat", "salah", "sajada", "sajjada",
  "tasbih", "misbaha", "chapelet", "quran", "coran", "koran", "islamic", "islamique", "ramadan", "djellaba",
  "jellaba", "jalaba", "kaftan", "caftan", "takchita", "gandoura", "jabador", "voile", "veil", "tarha",
  "عباية", "عبايه", "عبايات", "حجاب", "خمار", "جلباب", "اسدال", "إسدال", "نقاب", "صلاة", "الصلاة", "للصلاة",
  "سجادة", "سجاده", "مسبحة", "سبحة", "قرآن", "القرآن", "مصحف", "رمضان", "محتشم", "محتشمة", "قفطان", "جلابة",
  "جلابية", "تكشيطة", "طرحة", "شال",
];

/** Soft materials, pale colors and quiet adjectives. */
const SOFT = [
  "lace", "dentelle", "silk", "soie", "satin", "chiffon", "mousseline", "muslin", "linen", "lin", "cashmere",
  "cachemire", "tulle", "crepe", "crêpe", "velvet", "velours", "pastel", "pastels", "beige", "ivory", "ivoire",
  "cream", "creme", "crème", "ecru", "écru", "nude", "sand", "sable", "taupe", "champagne", "pearl", "perle",
  "powder", "poudre", "poudré", "poudrée", "dusty", "soft", "doux", "douce", "delicate", "délicat", "délicate",
  "elegant", "élégant", "élégante", "elegance", "élégance", "graceful", "gracieux", "gracieuse", "serene",
  "serein", "sereine", "calm", "calme", "gentle", "minimal", "minimalist", "minimaliste", "sobre", "timeless",
  "intemporel", "intemporelle", "baby", "bébé", "bebe", "newborn", "naissance", "sleep", "sommeil", "cotton",
  "coton", "fluid", "fluide", "flowing", "léger", "légère", "refined", "raffiné",
  "raffinée", "quiet", "luxury", "luxe", "premium",
  "دانتيل", "دانتال", "حرير", "حريري", "ساتان", "شيفون", "كتان", "قطن", "بيج", "عاجي", "كريمي", "ناعم", "ناعمة",
  "رقيق", "رقيقة", "أنيق", "أنيقة", "انيق", "انيقة", "هادئ", "هادئة", "بسيط", "بسيطة", "رضيع", "مولود", "فاخر",
  "فاخرة", "خفيف", "خفيفة",
];

/** Loud on purpose. */
const LOUD = [
  "neon", "néon", "fluo", "fluorescent", "rgb", "led", "gaming", "gamer", "turbo", "racing", "extreme", "extrême",
  "power", "boost", "party", "fête", "explosive", "crazy", "fun", "funny", "rigolo", "rigolote", "jouet", "jouets",
  "toy", "toys", "glow-in-the-dark", "disco", "sport", "sports", "fitness", "muscle", "workout", "drift", "tuning",
  "نيون", "ألعاب", "لعبة", "لعب", "سباق", "رياضة", "رياضي", "حفلة",
];

const toSet = (words: readonly string[]) => new Set(words.map((w) => w.normalize("NFC").toLowerCase()));
const MODEST_SET = toSet(MODEST);
const SOFT_SET = toSet(SOFT);
const LOUD_SET = toSet(LOUD);

/** Arabic attached particles: "والعباية", "بالدانتيل", "للصلاة" still read as their word. */
const AR_PREFIX = /^(?:[وفبكل]?ال|لل|[وفبكل])/;

function words(text: string): string[] {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "") // Arabic diacritics and tatweel
    .split(/[^\p{L}\p{N}-]+/u)
    .filter((w) => w.length >= 2 && w.length <= 32)
    .slice(0, 160);
}

function hits(list: readonly string[], set: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const w of list) {
    const bare = w.replace(AR_PREFIX, "");
    const plural = w.endsWith("s") ? w.slice(0, -1) : w;
    if (set.has(w) || (bare.length >= 2 && set.has(bare)) || set.has(plural)) out.push(w);
  }
  return [...new Set(out)];
}

/** Categories that lean calm or loud before any word is read. */
const CATEGORY_LEAN: Partial<Record<ProductCategory, number>> = {
  fragrance: 0.25,
  jewelry: 0.25,
  watches: 0.1,
  skincare: 0.2,
  beauty: 0.15,
  fashion: 0.1,
  bags: 0.1,
  traditional: 0.2,
  decor: 0.1,
  toys: -0.8,
  fitness: -0.6,
  sport: -0.6,
  gadgets: -0.4,
  car: -0.5,
  tools: -0.5,
};

const CALM_VIBES = /^(luxury|luxe|luxurious|premium|elegant|elegance|chic|refined|minimal|minimalist|clean|soft|delicate|feminine|timeless|understated|serene|calm|natural|modest)$/;
const LOUD_VIBES = /^(playful|fun|funny|kawaii|cheerful|vibrant|colorful|colourful|sport|sporty|energetic|bold|neon|power|powerful|speed|fast|dynamic|joyful)$/;

export interface MoodInput {
  keywords: string;
  category: ProductCategory;
  palette: ExtractedPalette | null;
  aiVibe?: string | null;
}

/**
 * Read the product's mood. Calm needs real evidence (a modest-wear word, or soft words backed by a
 * soft, pale photo); one loud word outweighs a single soft one.
 */
export function readMood(input: MoodInput): MoodReading {
  const list = words(input.keywords ?? "");
  const modest = hits(list, MODEST_SET);
  const soft = hits(list, SOFT_SET).filter((w) => !modest.includes(w));
  const loud = hits(list, LOUD_SET);
  const vibeWords = words(input.aiVibe ?? "");
  const calmVibes = vibeWords.filter((w) => CALM_VIBES.test(w));
  const loudVibes = vibeWords.filter((w) => LOUD_VIBES.test(w));

  let calm = Math.min(2, modest.length) * 1.1 + Math.min(3, soft.length) * 0.45 + Math.min(2, calmVibes.length) * 0.3;
  calm += CATEGORY_LEAN[input.category] ?? 0;
  const p = input.palette;
  if (p) {
    // a pale, quiet photo (ivory, sand, blush) is calm evidence; a vivid one is the opposite
    if (p.colorfulness < 0.2 && p.brightness > 0.55) calm += 0.5;
    else if (p.colorfulness < 0.3) calm += 0.15;
    if (p.colorfulness > 0.55) calm -= 0.6;
  }
  const lively = loud.length * 0.9 + loudVibes.length * 0.45 + Math.max(0, -(CATEGORY_LEAN[input.category] ?? 0));

  const isModest = modest.length > 0;
  // the theme engine's own quiet words (modest, devotional, baby) agree with a calm page
  const engineQuiet = isQuietProduct({ keywords: input.keywords ?? null, palette: null });
  if ((calm >= 1 && calm > lively + 0.4) || ((isModest || engineQuiet) && lively < 1.5)) {
    return { mood: "calm", modest: isModest, words: [...modest, ...soft, ...calmVibes].slice(0, 3) };
  }
  if (lively >= 1 && lively > calm) return { mood: "lively", modest: false, words: [...loud, ...loudVibes].slice(0, 3) };
  return NEUTRAL_MOOD;
}

/* ------------------------------------------------------------------ */
/* Copy family                                                         */
/* ------------------------------------------------------------------ */

/** Garments (modest wear included): their copy talks about cut, fabric and size. */
const APPAREL = toSet([
  "abaya", "abayas", "hijab", "hijabs", "khimar", "jilbab", "isdal", "esdal", "niqab", "burkini", "djellaba", "jellaba",
  "kaftan", "caftan", "takchita", "gandoura", "jabador", "tarha", "robe", "robes", "dress", "dresses", "pyjama", "pyjamas",
  "pajama", "pajamas", "ensemble", "tenue", "outfit", "jupe", "skirt", "pantalon", "trousers", "chemise", "shirt",
  "t-shirt", "tshirt", "sweat", "hoodie", "gilet", "cardigan", "manteau", "coat", "veste", "jacket", "tunique", "tunic",
  "عباية", "عبايه", "حجاب", "خمار", "جلباب", "اسدال", "إسدال", "نقاب", "قفطان", "جلابة", "جلابية", "تكشيطة", "طرحة",
  "فستان", "فساتين", "بيجامة", "ملابس", "لباس", "طقم", "تنورة", "قميص", "سروال", "معطف", "سترة",
]);

/** Categories whose copy family is about something else than garments (toys, honey, generic). */
const NON_APPAREL_COPY = new Set<ProductCategory>(["kids", "toys", "traditional", "other"]);

/**
 * Category for the copy library: a garment filed under "kids" or "traditional" (a girl's prayer
 * abaya, a djellaba) gets the fashion copy (cut, fabric, size) instead of toy or terroir copy
 * ("Des heures de jeu", "Miel de thym"). Everything else keeps its own category.
 */
export function copyCategory(category: ProductCategory, keywords: string): ProductCategory {
  if (!NON_APPAREL_COPY.has(category)) return category;
  return hits(words(keywords), APPAREL).length > 0 ? "fashion" : category;
}

/**
 * A garment: a clothing word in the product's own words (abaya, robe, kaftan, فستان…), or the
 * fashion category itself. Its page shows the garment's details, never a spec sheet or a material
 * board written for another kind of product (see plan.ts, garment.ts).
 */
export function isGarment(category: ProductCategory, keywords: string): boolean {
  return category === "fashion" || hits(words(keywords), APPAREL).length > 0;
}

/** Product words found in the keywords, for the detail callouts of a garment (garment.ts). */
export function keywordHits(keywords: string, list: readonly string[]): string[] {
  return hits(words(keywords), toSet(list));
}

/* ------------------------------------------------------------------ */
/* Archetype fit                                                       */
/* ------------------------------------------------------------------ */

/**
 * How well each calm language (the theme engine's CALM_ARCHETYPES) interprets a calm product. The
 * others are left out entirely: three calm proposals are three quiet interpretations (quiet luxury,
 * soft beauty, Swiss editorial…), never one loud outlier.
 */
const CALM_FIT: Readonly<Partial<Record<Archetype, number>>> = {
  maison: 0.55,
  editorial: 0.5,
  bloom: 0.45,
  apothecary: 0.3,
  field: 0.2,
  hearth: 0.05,
};

/** Modest wear: the most respectful, elegant languages lead. */
const MODEST_FIT: Partial<Record<Archetype, number>> = { maison: 0.15, editorial: 0.1, bloom: 0.1 };

/** Score adjustment for an archetype under a mood; null = not an appropriate interpretation. */
export function moodFit(archetype: Archetype, reading: MoodReading): number | null {
  if (reading.mood !== "calm") return 0;
  if (!CALM_ARCHETYPES.includes(archetype)) return null;
  return (CALM_FIT[archetype] ?? 0) + (reading.modest ? (MODEST_FIT[archetype] ?? 0) : 0);
}
