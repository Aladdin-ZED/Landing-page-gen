/**
 * Item options (items[].groups: choice, matrix and field groups) — presets, the color dictionary and
 * the pure helpers shared by the generate wizard, the builder's Product panel and the checks.
 * Framework-free. The v1 names (VariantGroup = a choice group) are kept for the v1 editors.
 *
 *   presetName("size", "ar")                 "المقاس" — group names in the page's language
 *   presetValues("shoe", "fr")               "35" … "46" — quick-fill values
 *   inferPreset(group)                       which preset an existing group is (icons, quick-fill)
 *   swatchFor("Bleu marine")                 "#1f2a44" — a color name (ar / Darija / fr / en…) → hex
 *   photoColorSuggestions(photos, "fr")      colors read from the photos' palettes, named, never added
 *   variantIssues(groups) / cleanVariants()  inline validation / what reaches the page
 *
 * Owner rule: no orange in what the app offers. Colors of the orange family (orange, coral, camel,
 * terracotta, copper, peach, salmon, rust…) are in the dictionary so a name the owner TYPES gets its
 * real swatch — the product's real color — but they are never suggested: not in the quick-add
 * palette, not from photos, not from the AI reading.
 */
import { hexToOklab, inOrangeBand, toOklch } from "@/lib/theme/color";
import type { Choice, ChoiceGroup, ChoiceKind, Locale, MatrixDim, MatrixGroup, OptionGroup } from "./schema";

/** A choice group (v1 "variant group": swatch / text / image options). */
export type VariantGroup = ChoiceGroup;
export type VariantOption = Choice;
export type VariantKind = ChoiceKind;

const isChoice = (g: { kind: string }): g is ChoiceGroup => g.kind === "swatch" || g.kind === "text" || g.kind === "image";
const isMatrix = (g: { kind: string }): g is MatrixGroup => g.kind === "matrix";

/** Schema limits (src/lib/page/schema.ts). Options: the editor's own cap for choice groups (schema: 40). */
export const MAX_VARIANT_GROUPS = 4;
export const MAX_VARIANT_OPTIONS = 24;
export const MAX_VARIANT_LABEL = 40;

/* ------------------------------------------------------------------ */
/* Text                                                                */
/* ------------------------------------------------------------------ */

// Arabic tashkeel, superscript alef, Quranic marks and the tatweel
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * Comparison key of a label: case, Latin accents, Arabic vowel marks and letter variants (أ إ آ → ا,
 * ة → ه, ى → ي) and separators are folded, so "Écru", "ecru" and "ÉCRU" — or "الأسود" and "الاسود" —
 * are the same option.
 */
export function normalizeLabel(s: string): string {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(AR_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase()
    .replace(/[\s\-_'’.]+/g, " ")
    .trim();
}

/** A typed label as stored: single spaces, no control characters, at most 40 characters. */
export function cleanLabel(s: string): string {
  return Array.from(
    String(s ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .slice(0, MAX_VARIANT_LABEL)
    .join("")
    .trim();
}

/** "S, M, L ,XL" / "أسود، بيج" / one per line → the labels, cleaned, duplicates dropped. */
export function splitOptionText(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of String(raw ?? "").split(/[,،;؛\n\r\t]+/)) {
    const label = cleanLabel(part);
    const key = normalizeLabel(label);
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** True when the text holds a separator (typed comma, pasted list). */
export const hasSeparator = (raw: string) => /[,،;؛\n\r\t]/.test(raw);

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** A short id matching the schema's Id pattern ("g-k3m9x"), not in `taken`. */
export function variantId(prefix: "g" | "o", taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const bytes = new Uint8Array(5);
  for (;;) {
    const c = globalThis.crypto;
    if (c?.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    const id = `${prefix}-${Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")}`;
    if (!used.has(id)) return id;
  }
}

/** Every group, option, dim and value id of a list (new ids must avoid them). */
export const variantIds = (groups: readonly OptionGroup[]): string[] =>
  groups.flatMap((g) =>
    isChoice(g) ? [g.id, ...g.options.map((o) => o.id)] : isMatrix(g) ? [g.id, ...g.dims.flatMap((d) => [d.id, ...d.values.map((v) => v.id)])] : [g.id],
  );

/* ------------------------------------------------------------------ */
/* Presets                                                             */
/* ------------------------------------------------------------------ */

export const VARIANT_PRESETS = ["color", "size", "shoe", "capacity", "model", "custom"] as const;
export type VariantPreset = (typeof VARIANT_PRESETS)[number];

type Names = Record<Locale, string>;

interface PresetDef {
  kind: VariantKind;
  /** the group name a new group gets, per page language ("" = typed by the owner) */
  names: Names;
  /** other names an existing group may carry (inferPreset) */
  aliases: readonly string[];
  /** quick-fill values, per language (fallback: `all`) */
  values?: { all?: readonly string[] } & Partial<Record<Locale, readonly string[]>>;
}

const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const SHOE_SIZES = Array.from({ length: 12 }, (_, i) => String(35 + i));
const ml = (n: number[], unit: string, litre: string) => [...n.map((x) => `${x} ${unit}`), `1 ${litre}`];

const PRESETS: Readonly<Record<VariantPreset, PresetDef>> = {
  color: {
    kind: "swatch",
    names: { ar: "اللون", fr: "Couleur", en: "Color", es: "Color", de: "Farbe", it: "Colore", nl: "Kleur", pt: "Cor" },
    aliases: ["لون", "الالوان", "اللون", "couleurs", "coloris", "teinte", "colour", "colors", "colours", "farben", "colori", "kleuren", "cores", "colores"],
  },
  size: {
    kind: "text",
    names: { ar: "المقاس", fr: "Taille", en: "Size", es: "Talla", de: "Größe", it: "Taglia", nl: "Maat", pt: "Tamanho" },
    aliases: ["مقاس", "القياس", "المقاسات", "طاي", "التاي", "tailles", "sizes", "tallas", "grosse", "taglie", "maten", "tamanhos"],
    values: { all: CLOTHING_SIZES },
  },
  shoe: {
    kind: "text",
    names: { ar: "مقاس الحذاء", fr: "Pointure", en: "Shoe size", es: "Número", de: "Schuhgröße", it: "Numero", nl: "Schoenmaat", pt: "Número" },
    aliases: ["مقاس الحذاء", "مقاس الصباط", "النمرة", "نمرة", "pointures", "shoe sizes", "eu size", "taille chaussure"],
    values: { all: SHOE_SIZES },
  },
  capacity: {
    kind: "text",
    names: { ar: "الحجم", fr: "Contenance", en: "Capacity", es: "Capacidad", de: "Inhalt", it: "Capacità", nl: "Inhoud", pt: "Capacidade" },
    aliases: ["السعة", "حجم", "volume", "capacite", "contenance", "taille du flacon", "volumen", "inhalt", "capacita", "inhoud"],
    values: {
      all: ml([30, 50, 100, 250, 500], "ml", "L"),
      ar: ml([30, 50, 100, 250, 500], "مل", "لتر"),
    },
  },
  model: {
    kind: "text",
    names: { ar: "الموديل", fr: "Modèle", en: "Model", es: "Modelo", de: "Modell", it: "Modello", nl: "Model", pt: "Modelo" },
    aliases: ["النموذج", "الطراز", "موديل", "modele", "modeles", "models", "style", "version", "pack", "الباك", "العرض"],
  },
  custom: {
    kind: "text",
    names: { ar: "", fr: "", en: "", es: "", de: "", it: "", nl: "", pt: "" },
    aliases: [],
  },
};

/** Name of a group the owner left unnamed ("custom" preset), in the page language. */
const UNNAMED: Names = { ar: "الاختيار", fr: "Option", en: "Option", es: "Opción", de: "Option", it: "Opzione", nl: "Optie", pt: "Opção" };
export const unnamedGroup = (locale: Locale): string => UNNAMED[locale] ?? UNNAMED.en;

export const presetKind = (p: VariantPreset): VariantKind => PRESETS[p].kind;
export const presetName = (p: VariantPreset, locale: Locale): string => PRESETS[p].names[locale] ?? PRESETS[p].names.en;

/** Quick-fill values of a preset, in display order (colors: see colorPalette). */
export function presetValues(p: VariantPreset, locale: Locale): readonly string[] {
  const v = PRESETS[p].values;
  return v ? (v[locale] ?? v.all ?? []) : [];
}

const PRESET_BY_NAME: ReadonlyMap<string, VariantPreset> = (() => {
  const m = new Map<string, VariantPreset>();
  for (const p of VARIANT_PRESETS) {
    for (const n of [...Object.values(PRESETS[p].names), ...PRESETS[p].aliases]) {
      const k = normalizeLabel(n);
      if (k && !m.has(k)) m.set(k, p);
    }
  }
  return m;
})();

/**
 * The preset an existing group corresponds to: its name in any supported language, else what its
 * options look like (swatches → color, XS…XXL → size, 35…46 → shoe size), else "custom".
 */
export function inferPreset(group: { name: string; kind: string; options: readonly { label: string }[] }): VariantPreset {
  const byName = PRESET_BY_NAME.get(normalizeLabel(group.name));
  if (byName && byName !== "custom") return byName;
  if (group.kind === "swatch") return "color";
  const labels = group.options.map((o) => normalizeLabel(o.label));
  if (labels.length) {
    const sizes = new Set(CLOTHING_SIZES.map((s) => s.toLowerCase()).concat(["xxxl", "3xl", "4xl", "2xl", "xxs"]));
    if (labels.every((l) => sizes.has(l))) return "size";
    if (labels.every((l) => /^\d{2}(?:[.,]5)?$/.test(l) && Number(l.slice(0, 2)) >= 16 && Number(l.slice(0, 2)) <= 50)) return "shoe";
    if (labels.every((l) => byColorKey(l) !== null)) return "color";
  }
  return "custom";
}

/** Canonical position of a quick-fill value (sizes stay XS → XXL when added out of order); -1 = custom. */
export function presetRank(p: VariantPreset, locale: Locale, label: string): number {
  const key = normalizeLabel(label);
  return presetValues(p, locale).findIndex((v) => normalizeLabel(v) === key);
}

/**
 * Presets the product probably needs (shown as gentle hints, never added): garments → size + color,
 * shoes → shoe size + color, bottles and jars → capacity, accessories and objects → color.
 */
export function suggestPresets(category: string, words: string): VariantPreset[] {
  const w = normalizeLabel(words);
  // the words are folded by normalizeLabel (accents off, ة → ه, أ → ا): the Arabic below is folded too
  if (/\b(chaussure|basket|sneaker|sandale|escarpin|botte|bottine|mocassin|shoe|boot|sandal|heel|slipper)s?\b|حذاء|صباط|سباط|صندل|بوط|شبشب|بلغه/.test(w)) return ["shoe", "color"];
  // a garment by its words, whatever the catalog category (a girl's abaya may be filed under kids or other)
  if (
    category === "fashion" ||
    /\b(robe|abaya|jellaba|djellaba|caftan|kaftan|takchita|pyjama|t ?shirt|chemise|pantalon|jean|veste|hoodie|sweat|legging|jupe|dress|shirt|pants|jacket|jogging|ensemble|survetement|gandoura|hijab|khimar|burkini)s?\b|عبايه|جلابه|قفطان|تكشيطه|فستان|سروال|قميص|جاكيط|بيجامه|كندوره|لباس|ملابس|حجاب|خمار/.test(w)
  )
    return ["size", "color"];
  if (["fragrance", "skincare", "haircare", "supplements", "organic-food", "cleaning"].includes(category)) return ["capacity"];
  if (["bags", "jewelry", "watches", "tech", "gadgets", "home", "decor", "kitchen", "toys", "car", "fashion", "kids", "sport", "fitness", "traditional"].includes(category)) return ["color"];
  return [];
}

/* ------------------------------------------------------------------ */
/* Color dictionary                                                    */
/* ------------------------------------------------------------------ */

export interface ColorEntry {
  key: string;
  /** the swatch (absent: multicolor) */
  hex?: string;
  /** orange family: only when typed by the owner, never suggested (owner rule) */
  orange?: boolean;
  /** names per language, the first is the display name; ar includes common Darija words */
  names: Partial<Record<Locale, readonly string[]>>;
}

/** Display order = the quick-add palette order (the most sold COD colors first). */
export const COLORS: readonly ColorEntry[] = [
  { key: "black", hex: "#141414", names: { ar: ["أسود", "سوداء", "كحل", "كحلة", "كحلا", "سود"], fr: ["Noir", "Noire"], en: ["Black"], es: ["Negro"], de: ["Schwarz"], it: ["Nero"], nl: ["Zwart"], pt: ["Preto"] } },
  { key: "white", hex: "#f7f7f5", names: { ar: ["أبيض", "بيضاء", "بيضا", "بيض", "بيضة"], fr: ["Blanc", "Blanche"], en: ["White"], es: ["Blanco"], de: ["Weiß", "Weiss"], it: ["Bianco"], nl: ["Wit"], pt: ["Branco"] } },
  { key: "beige", hex: "#d8c8aa", names: { ar: ["بيج", "بيجي"], fr: ["Beige"], en: ["Beige"], es: ["Beige"], de: ["Beige"], it: ["Beige"], nl: ["Beige"], pt: ["Bege"] } },
  { key: "navy", hex: "#1f2a44", names: { ar: ["كحلي", "أزرق داكن", "أزرق غامق", "بلو مارين", "مارين"], fr: ["Bleu marine", "Marine", "Navy"], en: ["Navy", "Navy blue", "Dark blue"], es: ["Azul marino"], de: ["Marineblau", "Dunkelblau"], it: ["Blu navy", "Blu scuro"], nl: ["Marineblauw", "Donkerblauw"], pt: ["Azul-marinho"] } },
  { key: "grey", hex: "#8d8f93", names: { ar: ["رمادي", "رمادية", "رصاصي", "گري", "غري"], fr: ["Gris", "Grise"], en: ["Grey", "Gray"], es: ["Gris"], de: ["Grau"], it: ["Grigio"], nl: ["Grijs"], pt: ["Cinza"] } },
  { key: "brown", hex: "#4f3d34", names: { ar: ["بني", "بنية", "قهوي", "قهوة", "شوكولا", "شوكولاتة", "ماروني"], fr: ["Marron", "Brun", "Chocolat", "Café"], en: ["Brown", "Chocolate", "Coffee"], es: ["Marrón"], de: ["Braun"], it: ["Marrone"], nl: ["Bruin"], pt: ["Marrom", "Castanho"] } },
  { key: "olive", hex: "#6b6c3c", names: { ar: ["زيتي", "أخضر زيتي", "زيتوني"], fr: ["Olive", "Vert olive"], en: ["Olive", "Olive green"], es: ["Verde oliva"], de: ["Oliv", "Olivgrün"], it: ["Verde oliva"], nl: ["Olijfgroen"], pt: ["Verde-oliva"] } },
  { key: "pink", hex: "#e9a5b9", names: { ar: ["وردي", "وردية", "روز", "زهري", "زهرية"], fr: ["Rose"], en: ["Pink", "Rose"], es: ["Rosa"], de: ["Rosa"], it: ["Rosa"], nl: ["Roze"], pt: ["Rosa"] } },
  { key: "bordeaux", hex: "#6b1a33", names: { ar: ["عنابي", "بوردو", "خمري", "عنّابي"], fr: ["Bordeaux", "Lie-de-vin"], en: ["Burgundy", "Maroon", "Wine", "Bordeaux"], es: ["Burdeos", "Granate"], de: ["Bordeaux", "Weinrot"], it: ["Bordeaux", "Bordò"], nl: ["Bordeaux", "Wijnrood"], pt: ["Bordô", "Vinho"] } },
  { key: "sky", hex: "#8fc3e6", names: { ar: ["سماوي", "أزرق سماوي", "أزرق فاتح", "بلو سييل"], fr: ["Bleu ciel", "Bleu clair"], en: ["Sky blue", "Light blue", "Baby blue"], es: ["Azul cielo", "Celeste"], de: ["Himmelblau", "Hellblau"], it: ["Azzurro", "Celeste"], nl: ["Hemelsblauw", "Lichtblauw"], pt: ["Azul-celeste", "Azul-claro"] } },
  { key: "khaki", hex: "#8c8659", names: { ar: ["كاكي", "خاكي"], fr: ["Kaki"], en: ["Khaki"], es: ["Caqui"], de: ["Khaki"], it: ["Cachi"], nl: ["Kaki"], pt: ["Cáqui"] } },
  { key: "mauve", hex: "#b49cc6", names: { ar: ["موف", "موڤ", "ليلكي"], fr: ["Mauve", "Lilas"], en: ["Mauve", "Lilac"], es: ["Malva", "Lila"], de: ["Mauve", "Flieder"], it: ["Malva", "Lilla"], nl: ["Mauve", "Lila"], pt: ["Malva", "Lilás"] } },
  { key: "cream", hex: "#efe8d6", names: { ar: ["كريمي", "كريم", "أوف وايت", "عاجي"], fr: ["Crème", "Écru", "Blanc cassé", "Ivoire"], en: ["Cream", "Off-white", "Ivory", "Ecru"], es: ["Crema", "Marfil"], de: ["Creme", "Elfenbein"], it: ["Crema", "Avorio"], nl: ["Crème", "Ivoor"], pt: ["Creme", "Marfim"] } },
  { key: "green", hex: "#2f7a4d", names: { ar: ["أخضر", "خضراء", "خضرا", "خضر"], fr: ["Vert", "Verte"], en: ["Green"], es: ["Verde"], de: ["Grün"], it: ["Verde"], nl: ["Groen"], pt: ["Verde"] } },
  { key: "blue", hex: "#2c5aa8", names: { ar: ["أزرق", "زرقاء", "زرقا", "زرق"], fr: ["Bleu", "Bleue"], en: ["Blue"], es: ["Azul"], de: ["Blau"], it: ["Blu"], nl: ["Blauw"], pt: ["Azul"] } },
  { key: "red", hex: "#c4113a", names: { ar: ["أحمر", "حمراء", "حمرا", "حمر"], fr: ["Rouge"], en: ["Red"], es: ["Rojo"], de: ["Rot"], it: ["Rosso"], nl: ["Rood"], pt: ["Vermelho"] } },
  { key: "taupe", hex: "#8b7f75", names: { ar: ["توب", "رمادي بني"], fr: ["Taupe"], en: ["Taupe"], es: ["Topo"], de: ["Taupe"], it: ["Tortora"], nl: ["Taupe"], pt: ["Taupe"] } },
  { key: "nude", hex: "#e3c6b4", names: { ar: ["نود", "لون البشرة"], fr: ["Nude", "Chair"], en: ["Nude"], es: ["Nude"], de: ["Nude"], it: ["Nude"], nl: ["Nude"], pt: ["Nude"] } },
  { key: "dustypink", hex: "#c99099", names: { ar: ["وردي غامق", "روز قديم", "وردي مطفي"], fr: ["Vieux rose", "Rose poudré"], en: ["Dusty pink", "Old rose"], es: ["Rosa palo"], de: ["Altrosa"], it: ["Rosa antico"], nl: ["Oudroze"], pt: ["Rosa antigo"] } },
  { key: "lavender", hex: "#c9bce6", names: { ar: ["لافندر", "بنفسجي فاتح", "خزامى"], fr: ["Lavande"], en: ["Lavender"], es: ["Lavanda"], de: ["Lavendel"], it: ["Lavanda"], nl: ["Lavendel"], pt: ["Lavanda"] } },
  { key: "purple", hex: "#6a3d9a", names: { ar: ["بنفسجي", "بنفسجية", "موف غامق"], fr: ["Violet", "Violette", "Prune"], en: ["Purple", "Violet", "Plum"], es: ["Morado", "Violeta"], de: ["Lila", "Violett"], it: ["Viola"], nl: ["Paars"], pt: ["Roxo"] } },
  { key: "fuchsia", hex: "#c2185b", names: { ar: ["فوشيا", "فوشي"], fr: ["Fuchsia", "Framboise"], en: ["Fuchsia", "Magenta"], es: ["Fucsia"], de: ["Fuchsia", "Pink"], it: ["Fucsia"], nl: ["Fuchsia"], pt: ["Fúcsia"] } },
  { key: "mint", hex: "#a9dcc6", names: { ar: ["نعناعي", "أخضر فاتح", "مينت"], fr: ["Menthe", "Vert d'eau", "Vert menthe"], en: ["Mint", "Mint green"], es: ["Menta"], de: ["Mint"], it: ["Menta"], nl: ["Mint"], pt: ["Menta"] } },
  { key: "emerald", hex: "#11604a", names: { ar: ["زمردي", "أخضر زمردي", "أخضر غامق"], fr: ["Vert émeraude", "Émeraude", "Vert bouteille", "Vert foncé"], en: ["Emerald", "Bottle green", "Dark green"], es: ["Verde esmeralda"], de: ["Smaragdgrün", "Dunkelgrün"], it: ["Verde smeraldo"], nl: ["Smaragdgroen"], pt: ["Verde-esmeralda"] } },
  { key: "turquoise", hex: "#2fb3ae", names: { ar: ["تركواز", "فيروزي", "تركوازي"], fr: ["Turquoise"], en: ["Turquoise"], es: ["Turquesa"], de: ["Türkis"], it: ["Turchese"], nl: ["Turquoise"], pt: ["Turquesa"] } },
  { key: "teal", hex: "#1d4e5a", names: { ar: ["بترولي", "أزرق بترولي"], fr: ["Bleu canard", "Pétrole", "Bleu pétrole"], en: ["Teal", "Petrol blue"], es: ["Azul petróleo"], de: ["Petrol"], it: ["Petrolio", "Ottanio"], nl: ["Petrol"], pt: ["Azul-petróleo"] } },
  { key: "denim", hex: "#3f5f86", names: { ar: ["جينز", "أزرق جينز", "دجين"], fr: ["Denim", "Bleu jean"], en: ["Denim"], es: ["Vaquero"], de: ["Jeansblau"], it: ["Denim"], nl: ["Denim"], pt: ["Jeans"] } },
  { key: "sand", hex: "#c9b896", names: { ar: ["رملي"], fr: ["Sable"], en: ["Sand"], es: ["Arena"], de: ["Sand"], it: ["Sabbia"], nl: ["Zand"], pt: ["Areia"] } },
  { key: "lightgrey", hex: "#cfd0d2", names: { ar: ["رمادي فاتح"], fr: ["Gris clair", "Gris perle"], en: ["Light grey", "Light gray"], es: ["Gris claro"], de: ["Hellgrau"], it: ["Grigio chiaro"], nl: ["Lichtgrijs"], pt: ["Cinza-claro"] } },
  { key: "charcoal", hex: "#3b3d42", names: { ar: ["رمادي غامق", "فحمي", "أنتراسيت"], fr: ["Anthracite", "Gris foncé"], en: ["Charcoal", "Dark grey", "Dark gray"], es: ["Gris oscuro"], de: ["Anthrazit", "Dunkelgrau"], it: ["Antracite"], nl: ["Antraciet"], pt: ["Grafite"] } },
  { key: "yellow", hex: "#f2cf4a", names: { ar: ["أصفر", "صفراء", "صفرا", "صفر"], fr: ["Jaune"], en: ["Yellow"], es: ["Amarillo"], de: ["Gelb"], it: ["Giallo"], nl: ["Geel"], pt: ["Amarelo"] } },
  { key: "mustard", hex: "#c9a52a", names: { ar: ["خردلي", "موتارد"], fr: ["Moutarde"], en: ["Mustard"], es: ["Mostaza"], de: ["Senfgelb"], it: ["Senape"], nl: ["Mosterd"], pt: ["Mostarda"] } },
  { key: "gold", hex: "#c9a646", names: { ar: ["ذهبي", "ذهبية", "دوري"], fr: ["Doré", "Dorée", "Or"], en: ["Gold", "Golden"], es: ["Dorado"], de: ["Gold"], it: ["Oro", "Dorato"], nl: ["Goud"], pt: ["Dourado"] } },
  { key: "silver", hex: "#c2c4c9", names: { ar: ["فضي", "فضية", "أرجونتي"], fr: ["Argenté", "Argent"], en: ["Silver"], es: ["Plateado"], de: ["Silber"], it: ["Argento"], nl: ["Zilver"], pt: ["Prateado"] } },
  { key: "clear", hex: "#e4eaee", names: { ar: ["شفاف", "شفافة"], fr: ["Transparent", "Transparente"], en: ["Clear", "Transparent"], es: ["Transparente"], de: ["Transparent"], it: ["Trasparente"], nl: ["Transparant"], pt: ["Transparente"] } },
  { key: "multi", names: { ar: ["متعدد الألوان", "ملون", "ألوان مختلفة"], fr: ["Multicolore"], en: ["Multicolor", "Multicolour"], es: ["Multicolor"], de: ["Bunt", "Mehrfarbig"], it: ["Multicolore"], nl: ["Meerkleurig"], pt: ["Multicor"] } },
  // orange family: the real swatch when typed, never offered
  { key: "orange", hex: "#e8772e", orange: true, names: { ar: ["برتقالي", "برتقالية", "ليموني", "لشيني"], fr: ["Orange"], en: ["Orange"], es: ["Naranja"], de: ["Orange"], it: ["Arancione"], nl: ["Oranje"], pt: ["Laranja"] } },
  { key: "coral", hex: "#ef7f6a", orange: true, names: { ar: ["مرجاني", "كورال"], fr: ["Corail"], en: ["Coral"], es: ["Coral"], de: ["Koralle"], it: ["Corallo"], nl: ["Koraal"], pt: ["Coral"] } },
  { key: "camel", hex: "#b98a57", orange: true, names: { ar: ["جملي", "كاميل"], fr: ["Camel"], en: ["Camel", "Tan"], es: ["Camel"], de: ["Camel"], it: ["Cammello"], nl: ["Camel"], pt: ["Camelo"] } },
  { key: "caramel", hex: "#a86b32", orange: true, names: { ar: ["كراميل", "عسلي"], fr: ["Caramel", "Cognac", "Miel"], en: ["Caramel", "Cognac", "Honey"], es: ["Caramelo"], de: ["Karamell", "Cognac"], it: ["Caramello"], nl: ["Karamel"], pt: ["Caramelo"] } },
  { key: "terracotta", hex: "#b5603d", orange: true, names: { ar: ["طوبي", "تيراكوتا", "آجري"], fr: ["Terracotta", "Brique", "Rouille"], en: ["Terracotta", "Brick", "Rust"], es: ["Terracota"], de: ["Terrakotta"], it: ["Terracotta"], nl: ["Terracotta"], pt: ["Terracota"] } },
  { key: "copper", hex: "#b87333", orange: true, names: { ar: ["نحاسي"], fr: ["Cuivre", "Cuivré", "Bronze"], en: ["Copper", "Bronze"], es: ["Cobre"], de: ["Kupfer"], it: ["Rame"], nl: ["Koper"], pt: ["Cobre"] } },
  { key: "peach", hex: "#f6b99a", orange: true, names: { ar: ["خوخي", "مشمشي"], fr: ["Pêche", "Abricot"], en: ["Peach", "Apricot"], es: ["Melocotón"], de: ["Pfirsich"], it: ["Pesca"], nl: ["Perzik"], pt: ["Pêssego"] } },
  { key: "salmon", hex: "#f29b88", orange: true, names: { ar: ["سلموني"], fr: ["Saumon"], en: ["Salmon"], es: ["Salmón"], de: ["Lachs"], it: ["Salmone"], nl: ["Zalm"], pt: ["Salmão"] } },
  { key: "ochre", hex: "#c08a2b", orange: true, names: { ar: ["أوكر", "مغرة"], fr: ["Ocre"], en: ["Ochre", "Ocher"], es: ["Ocre"], de: ["Ocker"], it: ["Ocra"], nl: ["Oker"], pt: ["Ocre"] } },
  { key: "rosegold", hex: "#d9a9a4", orange: true, names: { ar: ["ذهبي وردي", "روز غولد", "روز جولد"], fr: ["Or rose"], en: ["Rose gold"], es: ["Oro rosa"], de: ["Roségold"], it: ["Oro rosa"], nl: ["Roségoud"], pt: ["Ouro rosé"] } },
];

const COLOR_BY_KEY: ReadonlyMap<string, ColorEntry> = new Map(COLORS.map((c) => [c.key, c]));
const COLOR_BY_NAME: ReadonlyMap<string, ColorEntry> = (() => {
  const m = new Map<string, ColorEntry>();
  for (const c of COLORS) for (const list of Object.values(c.names)) for (const n of list ?? []) {
    const k = normalizeLabel(n);
    if (k && !m.has(k)) m.set(k, c);
  }
  return m;
})();

function byColorKey(normalized: string): ColorEntry | null {
  const hit = COLOR_BY_NAME.get(normalized);
  if (hit) return hit;
  // Arabic definite article: "الأسود" → "اسود"
  if (normalized.startsWith("ال") && normalized.length > 3) return COLOR_BY_NAME.get(normalized.slice(2)) ?? null;
  return null;
}

/**
 * The dictionary color a label names: the whole label first ("Bleu ciel"), then its longest run of
 * words that is a color ("Noir mat" → noir, "أسود لامع" → أسود). Null for anything else.
 */
export function colorByName(label: string): ColorEntry | null {
  const key = normalizeLabel(label);
  if (!key) return null;
  const whole = byColorKey(key);
  if (whole) return whole;
  const words = key.split(" ");
  for (let len = words.length - 1; len >= 1; len--) {
    for (let at = 0; at + len <= words.length; at++) {
      const hit = byColorKey(words.slice(at, at + len).join(" "));
      if (hit) return hit;
    }
  }
  return null;
}

/** The swatch of a typed color name (orange family included: the owner typed it), or undefined. */
export const swatchFor = (label: string): string | undefined => colorByName(label)?.hex;

/** Display name of a dictionary color in the page language (English when the language has none). */
export function colorLabel(entry: ColorEntry, locale: Locale): string {
  return entry.names[locale]?.[0] ?? entry.names.en?.[0] ?? entry.key;
}

export const colorEntry = (key: string): ColorEntry | null => COLOR_BY_KEY.get(key) ?? null;

export interface ColorChoice {
  key: string;
  label: string;
  hex: string;
}

/** The quick-add palette in the page language: every non-orange color that has a swatch. */
export function colorPalette(locale: Locale): ColorChoice[] {
  return COLORS.filter((c) => !c.orange && c.hex).map((c) => ({ key: c.key, label: colorLabel(c, locale), hex: c.hex! }));
}

/** Whether a hex is in the owner's forbidden orange band (product swatches the app suggests avoid it). */
export function isOrangeHex(hex: string): boolean {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return false;
  return inOrangeBand(toOklch(hex.toLowerCase()));
}

const OKLAB_CACHE = new Map<string, { l: number; a: number; b: number }>();
function lab(hex: string) {
  const k = hex.toLowerCase();
  let v = OKLAB_CACHE.get(k);
  if (!v) {
    v = hexToOklab(k);
    OKLAB_CACHE.set(k, v);
  }
  return v;
}
const deltaE = (x: string, y: string) => {
  const p = lab(x);
  const q = lab(y);
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
};

/**
 * The closest dictionary color to a hex (OKLab distance). The orange family takes part, so a camel
 * or terracotta photo color is recognized as such (and then not suggested) instead of being renamed
 * khaki or taupe.
 */
export function nearestColor(hex: string): { entry: ColorEntry; distance: number } | null {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  let best: { entry: ColorEntry; distance: number } | null = null;
  for (const c of COLORS) {
    if (!c.hex || c.key === "clear") continue;
    const d = deltaE(hex, c.hex);
    if (!best || d < best.distance) best = { entry: c, distance: d };
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

export interface ColorSuggestion extends ColorChoice {
  /** asset id of the photo the color was read from (the option links to it when added) */
  photoId?: string;
  source: "photo" | "ai";
}

/** What the suggestion reader needs of a photo: its asset id and its extracted palette. */
export interface PalettePhoto {
  id: string;
  palette: {
    colors: readonly { hex: string; weight: number; chroma?: number; lightness?: number }[];
    background: string | null;
  } | null;
}

/** Palette colors too close to this are the backdrop, not the product. */
const BACKDROP_DE = 0.06;

/**
 * Colors read from the photos' palettes (main photo first), named in the page language — at most
 * one per photo plus a strong second, deduplicated, without the colors already in `existing`. The
 * swatch is the photo's own color unless that one falls in the orange band (then the dictionary's);
 * orange-family colors are never suggested. Suggestions only: nothing is added without a click.
 */
export function photoColorSuggestions(photos: readonly PalettePhoto[], locale: Locale, existing: readonly string[] = [], limit = 6): ColorSuggestion[] {
  const taken = new Set(existing.map((l) => colorByName(l)?.key ?? `label:${normalizeLabel(l)}`));
  const best = new Map<string, { s: ColorSuggestion; weight: number; order: number }>();
  photos.forEach((photo, order) => {
    const colors = [...(photo.palette?.colors ?? [])].sort((a, b) => b.weight - a.weight);
    const bg = photo.palette?.background ?? null;
    let used = 0;
    for (const c of colors) {
      if (used >= 2 || !/^#[0-9a-fA-F]{6}$/.test(c.hex)) continue;
      if (c.weight < (used === 0 ? 0.08 : 0.22)) continue;
      if (bg && /^#[0-9a-fA-F]{6}$/.test(bg) && deltaE(c.hex, bg) < BACKDROP_DE) continue;
      const near = nearestColor(c.hex);
      if (!near) continue;
      used++;
      const { entry } = near;
      // an orange-family color is the product's own, but the app never offers one (owner rule)
      if (entry.orange || taken.has(entry.key)) continue;
      const hex = isOrangeHex(c.hex) ? entry.hex! : c.hex.toLowerCase();
      const prev = best.get(entry.key);
      if (!prev || c.weight > prev.weight) best.set(entry.key, { s: { key: entry.key, label: colorLabel(entry, locale), hex, photoId: photo.id, source: "photo" }, weight: c.weight, order: prev?.order ?? order });
    }
  });
  return [...best.values()]
    .sort((a, b) => a.order - b.order || b.weight - a.weight)
    .slice(0, limit)
    .map((x) => x.s);
}

/**
 * Colors the on-device photo reading described ("black", "beige", "gold"…) that the dictionary
 * knows, in the page language, without orange-family ones and colors already listed.
 */
export function describedColorSuggestions(described: readonly string[], locale: Locale, existing: readonly string[] = []): ColorSuggestion[] {
  const taken = new Set(existing.map((l) => colorByName(l)?.key ?? `label:${normalizeLabel(l)}`));
  const out: ColorSuggestion[] = [];
  for (const d of described) {
    const entry = colorByName(d);
    if (!entry || entry.orange || !entry.hex || taken.has(entry.key)) continue;
    taken.add(entry.key);
    out.push({ key: entry.key, label: colorLabel(entry, locale), hex: entry.hex, source: "ai" });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Validation and the page value                                       */
/* ------------------------------------------------------------------ */

export interface VariantIssue {
  groupId: string;
  optionId?: string;
  /** "error": the page can't use it as is; "warn": works, but probably not what the owner wants */
  level: "error" | "warn";
  message: string;
}

/** Inline checks of one list of options (a choice group's options or a matrix dim's values). */
function optionIssues(groupId: string, kind: string, list: readonly Choice[], out: VariantIssue[]): void {
  const seen = new Set<string>();
  for (const o of list) {
    const label = cleanLabel(o.label);
    if (!label) {
      out.push({ groupId, optionId: o.id, level: "error", message: "An option has no name." });
      continue;
    }
    const k = normalizeLabel(label);
    if (seen.has(k)) out.push({ groupId, optionId: o.id, level: "error", message: `“${label}” is listed twice.` });
    seen.add(k);
  }
}

/** Swatch / photo completeness of one list of options. */
function lookIssues(groupId: string, kind: string, list: readonly Choice[], out: VariantIssue[]): void {
  if (kind === "swatch") {
    const missing = list.filter((o) => !o.swatch).map((o) => cleanLabel(o.label));
    if (missing.length) out.push({ groupId, level: "warn", message: `${listOf(missing)} ${missing.length === 1 ? "has" : "have"} no color yet — shown as text.` });
  }
  if (kind === "image") {
    const missing = list.filter((o) => !o.image).map((o) => cleanLabel(o.label));
    if (missing.length) out.push({ groupId, level: "warn", message: `${listOf(missing)} ${missing.length === 1 ? "has" : "have"} no photo yet — shown as text.` });
  }
}

/** Some combination of the matrix can be ordered (a value not sold out in every dim, no exception closing all of them). */
function matrixOpen(g: MatrixGroup): boolean {
  let combos: Record<string, string>[] = [{}];
  for (const d of g.dims) combos = combos.flatMap((c) => d.values.filter((v) => !v.soldOut).map((v) => ({ ...c, [d.id]: v.id })));
  return combos.some((c) => !g.cells.some((cell) => cell.state !== "in" && Object.entries(cell.v).every(([k, v]) => c[k] === v)));
}

/** Inline checks of an option list (admin English): choice, combined (matrix) and custom field groups. */
export function variantIssues(groups: readonly OptionGroup[]): VariantIssue[] {
  const out: VariantIssue[] = [];
  const names = new Map<string, string>();
  for (const g of groups) {
    const name = cleanLabel(g.name);
    if (!name) out.push({ groupId: g.id, level: "error", message: "Name this group — customers see it above the choices." });
    else {
      const k = normalizeLabel(name);
      if (names.has(k)) out.push({ groupId: g.id, level: "warn", message: `Two groups are called “${name}”.` });
      names.set(k, g.id);
    }
    if (isChoice(g)) {
      optionIssues(g.id, g.kind, g.options, out);
      if (g.options.length && g.options.every((o) => o.soldOut)) out.push({ groupId: g.id, level: "error", message: "Every option is sold out — nobody could place an order." });
      lookIssues(g.id, g.kind, g.options, out);
    } else if (isMatrix(g)) {
      for (const d of g.dims) {
        if (!cleanLabel(d.name)) out.push({ groupId: g.id, level: "error", message: "Name every dimension of the combined option." });
        optionIssues(g.id, d.kind, d.values, out);
        lookIssues(g.id, d.kind, d.values, out);
      }
      const combos = g.dims.reduce((n, d) => n * d.values.length, 1);
      if (combos > 240) out.push({ groupId: g.id, level: "error", message: `${combos} combinations: at most 240.` });
      if (!matrixOpen(g)) out.push({ groupId: g.id, level: "error", message: "Every combination is sold out or not made — nobody could place an order." });
    } else if (g.required && (g.delta ?? 0) > 0) {
      out.push({ groupId: g.id, level: "error", message: "A required field can't add a price; include it in the offer price or make it optional." });
    }
  }
  return out;
}

function listOf(labels: string[]): string {
  const q = labels.map((l) => `“${l}”`);
  if (q.length <= 2) return q.join(" and ");
  return `${q.slice(0, 2).join(", ")} and ${q.length - 2} more`;
}

/** Labels cleaned, empty and repeated options dropped, the list capped (same objects when nothing changed). */
function cleanOptions(list: readonly Choice[], max: number): Choice[] {
  const seen = new Set<string>();
  const options: Choice[] = [];
  for (const o of list) {
    const label = cleanLabel(o.label);
    const k = normalizeLabel(label);
    if (!label || seen.has(k) || options.length >= max) continue;
    seen.add(k);
    options.push(label === o.label ? o : { ...o, label });
  }
  return options;
}

const sameList = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The option groups as they reach the page: labels and names cleaned, empty and repeated options
 * dropped, empty groups dropped, schema limits applied. A list the editor produced passes unchanged.
 */
export function cleanVariants<G extends OptionGroup>(groups: readonly G[] | null | undefined): G[] {
  const out: G[] = [];
  for (const g of groups ?? []) {
    if (out.length >= MAX_VARIANT_GROUPS) break;
    const name = cleanLabel(g.name);
    if (!name) continue;
    if (isChoice(g)) {
      const options = cleanOptions(g.options, MAX_VARIANT_OPTIONS);
      if (!options.length) continue;
      out.push(name === g.name && sameList(options, g.options) ? g : ({ ...g, name, options } as G));
    } else if (isMatrix(g)) {
      const dims: MatrixDim[] = [];
      for (const d of g.dims) {
        const values = cleanOptions(d.values, 24);
        const dname = cleanLabel(d.name);
        if (!values.length || !dname) continue;
        dims.push(dname === d.name && sameList(values, d.values) ? d : { ...d, name: dname, values });
      }
      if (dims.length < 2) continue;
      out.push(name === g.name && sameList(dims, g.dims) ? g : ({ ...g, name, dims } as G));
    } else {
      out.push(name === g.name ? g : ({ ...g, name } as G));
    }
  }
  return out;
}

/**
 * The photo that should lead the page (hero) when options are linked to photos: the photo the order
 * form shows first — the first group with photos drives the photo swap, and a color (swatch) or photo
 * group starts on its first available option (src/landing/sections/orderForm/variants.tsx). Null
 * when nothing is linked, or when that group starts empty (text groups: sizes are chosen, never
 * preselected).
 */
export function leadPhotoId(groups: readonly OptionGroup[] | null | undefined): string | null {
  const g = (groups ?? []).filter(isChoice).find((x) => x.options.some((o) => o.image));
  if (!g) return null;
  const available = g.options.filter((o) => !o.soldOut);
  const first = g.kind !== "text" || available.length === 1 ? available[0] : undefined;
  return first?.image?.id ?? null;
}

/**
 * The groups re-worded for another page language, where the words are the app's own: a preset
 * group name ("Couleur" → "اللون"), a dictionary color in its display name ("Noir" → "أسود") and
 * a quick-fill value ("50 ml" → "50 مل"). Anything the owner wrote differently stays as written;
 * ids, swatches, photos and stock never change. A renaming that would repeat a label is skipped.
 */
export function relocalizeVariants<G extends OptionGroup>(groups: readonly G[], from: Locale, to: Locale): G[] {
  if (from === to) return groups as G[];
  let changed = false;
  /** One named option list re-worded (a choice group, or a matrix dim). Ids, codes, swatches, photos and stock never change. */
  const reword = (name: string, kind: string, list: readonly Choice[]) => {
    const preset = inferPreset({ name, kind, options: list });
    const nextName = preset !== "custom" && normalizeLabel(name) === normalizeLabel(presetName(preset, from)) ? presetName(preset, to) : name;
    const color = preset === "color" || kind === "swatch";
    const used = new Set(list.map((o) => normalizeLabel(o.label)));
    const options = list.map((o) => {
      let label = o.label;
      const entry = color ? colorByName(o.label) : null;
      if (entry && normalizeLabel(o.label) === normalizeLabel(colorLabel(entry, from))) label = colorLabel(entry, to);
      else {
        const rank = presetRank(preset, from, o.label);
        if (rank >= 0) label = presetValues(preset, to)[rank] ?? label;
      }
      if (label === o.label || used.has(normalizeLabel(label))) return o;
      used.add(normalizeLabel(label));
      return { ...o, label, ...(o.image ? { image: { ...o.image, alt: label } } : {}) };
    });
    return { name: nextName, options, same: nextName === name && options.every((o, i) => o === list[i]) };
  };
  const next = groups.map((g) => {
    if (isChoice(g)) {
      const r = reword(g.name, g.kind, g.options);
      if (r.same) return g;
      changed = true;
      return { ...g, name: r.name, options: r.options } as G;
    }
    if (isMatrix(g)) {
      let touched = false;
      const dims = g.dims.map((d) => {
        const r = reword(d.name, d.kind, d.values);
        if (r.same) return d;
        touched = true;
        return { ...d, name: r.name, values: r.options };
      });
      if (!touched) return g;
      changed = true;
      return { ...g, dims } as G;
    }
    return g; // field names are the owner's own words
  });
  return changed ? next : (groups as G[]);
}

/** The groups without links to a photo that left the page (`available` = asset ids still available). */
export function keepLinkedPhotos<G extends OptionGroup>(groups: readonly G[], available: ReadonlySet<string>): G[] {
  let changed = false;
  const strip = (list: readonly Choice[]) =>
    list.some((o) => o.image && !available.has(o.image.id)) ? list.map((o) => (o.image && !available.has(o.image.id) ? withoutImage(o) : o)) : null;
  const next = groups.map((g) => {
    if (isChoice(g)) {
      const options = strip(g.options);
      if (!options) return g;
      changed = true;
      return { ...g, options } as G;
    }
    if (isMatrix(g)) {
      let touched = false;
      const dims = g.dims.map((d) => {
        const values = strip(d.values);
        if (!values) return d;
        touched = true;
        return { ...d, values };
      });
      const cells = g.cells.map((c) => {
        if (!c.image || available.has(c.image.id)) return c;
        touched = true;
        const { image: _drop, ...rest } = c;
        void _drop;
        return rest;
      });
      if (!touched) return g;
      changed = true;
      return { ...g, dims, cells } as G;
    }
    return g;
  });
  return changed ? next : (groups as G[]);
}

function withoutImage(o: VariantOption): VariantOption {
  const { image: _drop, ...rest } = o;
  void _drop;
  return rest;
}
