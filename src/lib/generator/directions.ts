/**
 * generateDirections — product + photos (+ optional AI analysis and copy) → three complete,
 * art-directed PageDocs in three different archetypes, ready to preview and publish.
 */
import { libraryCopy } from "@/lib/ai/copy-library";
import type { PageCopy } from "@/lib/ai/copy-schema";
import { getMarket } from "@/lib/markets/info";
import {
  PageDoc,
  Product,
  Tracking,
  type Archetype,
  type Locale,
  type Market,
  type PageDocInput,
  type SectionInstance,
  type ThemeSpec,
} from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { garmentOf } from "@/landing/sections/garment";
import { ARCHETYPE_DEFS, rankArchetypes, type ExtractedPalette } from "@/lib/theme";
import type { CopyExtras } from "./copy-map";
import { calmBands, chooseOrder, chooseVariant, finishPlan, fullOrder, type PlanContext } from "./plan";
import { CatalogInputError, directionCatalog, displayInput, pickOfferDisplay, safeSelection } from "./offers";
import { deriveSeed } from "./rng";
import { directSections } from "./direct";
import { garmentDetails, garmentPhoto, modestBigWord, type PhotoInfo } from "./garment";
import { glueDeep, glueEmphasis } from "./glue";
import { copyCategory, isGarment, moodFit, productKeywords, readMood, type MoodReading } from "./mood";
import { sectionData, sectionId, type DocBasics } from "./sections";
import { colorDistance, productTheme } from "./theme";
import { themeTones } from "./tones";

export interface GenerateInput {
  /**
   * product as typed in the wizard (validated with the Product schema): the page's story (name,
   * category, photos, rating). Without `items` it is also the page's one item: its price,
   * compare-at, SKU and options (`variants`) make the item "main".
   */
  product: unknown;
  /**
   * The page's items (Offers v2, wizard "Several products"; PageDoc `items`, 1–8, items[0] = lead):
   * given → used verbatim (validated with the Item schema); absent → one item from `product`.
   */
  items?: unknown;
  /**
   * The page's offers (PageDoc `offers.bundles`, 1–8): given → used verbatim (validated with the
   * Offer schema) by every direction; absent → suggestOffers on the items (src/lib/page/offer-presets.ts).
   */
  offers?: unknown;
  /**
   * The offer layout the owner chose in the wizard ("Look": a combo, PageDoc `offers.display`): given
   * → every direction uses it; absent → each archetype picks (docs/OFFERS.md §E.5).
   */
  display?: unknown;
  /** palette extracted from the main product photo */
  palette: ExtractedPalette | null;
  /** vibe keywords from the local AI ("luxury natural") */
  aiVibe?: string | null;
  /** AI copy already merged over the library (see mergeAiCopy), per locale */
  copy?: Partial<Record<Locale, PageCopy>>;
  /** merchant facts (3–5 bullets) */
  facts?: readonly string[];
  locale: Locale;
  market: Market;
  seedBase: number;
  /** Settings → Defaults */
  shippingFee?: number;
  deliveryText?: string | null;
  currency?: string;
  /**
   * Store WhatsApp number, international (wa.me digits, see whatsappDigits): enables the floating
   * button. The page itself does not pin it — the live store number is used when rendering.
   */
  whatsapp?: string | null;
  /**
   * Store identity from Settings → Store, when the caller knows it. Only steers composition (a
   * store without a real name gets no giant footer wordmark, no signed founder note); the page
   * never pins it — the live store details are used when rendering. Omitted = unknown (no steering).
   */
  store?: { name?: string | null } | null;
  /**
   * What the media library knows about the product photos (size, transparency and the upload's
   * subject analysis `focus`), by asset id. Optional: with it a garment's detail pins sit on the
   * real figure (never on a face) and a group shot is not the one the details are pinned on.
   */
  photos?: readonly PhotoInfo[];
  /** force the archetypes instead of ranking them (admin choice) */
  archetypes?: readonly Archetype[];
  /**
   * "Ad tracking for this page", the wizard's required answer (docs/OFFERS.md §A.4): a TrackingChoice
   * `{ kind: "ids", tracking }` (the page's pixels) or `{ kind: "none" }` ("No pixel on this page" →
   * `tracking.none`). A plain Tracking value is still read (one release). Validated with the Tracking
   * schema; omitted or invalid → no answer (`{}`: the checklist and the publish dialog ask for one).
   * The page is created with exactly this tracking: nothing is added when saving.
   */
  tracking?: unknown;
}

export interface Direction {
  archetype: Archetype;
  /** archetype display name ("Maison") */
  label: string;
  description: string;
  /** why this archetype was picked (the theme engine's ranking explanation, for debugging) */
  reason: string;
  /** the same, structured for display: ranking position (0 = best), matched vibe words, admin-forced */
  match: DirectionMatch;
  seed: number;
  doc: PageDoc;
}

export interface DirectionMatch {
  rank: number;
  /** matched vibe words (AI vibe, then the product's own mood words: "calm", "modest", "lace"…) */
  vibes: string[];
  forced: boolean;
}

export class GeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeneratorError";
  }
}

const cleanFacts = (facts: readonly string[] | undefined) =>
  (facts ?? [])
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f.length > 0)
    .slice(0, 6);

/** "- fact" lines for product.description (BlockText bullets). */
export const factsToDescription = (facts: readonly string[]) => facts.map((f) => `- ${f.slice(0, 200)}`).join("\n").slice(0, 4000);

/** Facts back from a product description written by factsToDescription (used by copy remix). */
export const factsFromDescription = (description: string | undefined) =>
  (description ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    .filter(Boolean);

/** Store names older installs stored as placeholders: not a real brand. */
const PLACEHOLDER_STORE = /^(my store|ma boutique|mon magasin|store|boutique|shop|متجري|المتجر)$/i;

/** true / false when the caller passed the store identity, null when unknown. */
function hasRealStoreName(store: GenerateInput["store"]): boolean | null {
  if (store === undefined || store === null) return null;
  const name = (store.name ?? "").replace(/\s+/g, " ").trim();
  return name.length > 0 && !PLACEHOLDER_STORE.test(name);
}

/** The product's mood from everything the merchant told us (see mood.ts). */
function moodOf(input: Pick<GenerateInput, "product" | "palette" | "aiVibe" | "facts">): { reading: MoodReading; keywords: string } {
  const parsed = Product.safeParse(input.product);
  const product = parsed.success ? parsed.data : null;
  const keywords = productKeywords(product ?? {}, cleanFacts(input.facts));
  return { reading: readMood({ keywords, category: product?.category ?? "other", palette: input.palette, aiVibe: input.aiVibe }), keywords };
}

/** OKLab distance from which two accents read as two different color voices (plum vs mocha ≈ 0.07). */
const DISTINCT_ACCENT = 0.065;

/** Section types whose variant sets the composition of a page (spread across the three directions). */
const SPREAD_TYPES = new Set(["hero", "benefits", "problem", "steps", "showcase", "reviews", "socialProof", "orderForm", "offer"]);

/**
 * Build one complete document for an archetype. `avoid` lists variants sibling directions already
 * use (made less likely, never forbidden).
 */
export function buildDirection(input: GenerateInput, archetype: Archetype, seed: number, avoid?: ReadonlyMap<string, ReadonlySet<string>>): PageDoc {
  // the story (name, category, photos); without `items`, the v1 product is also the one item "main"
  const parsedProduct = Product.safeParse(input.product);
  if (!parsedProduct.success) throw new GeneratorError(input.items ? "The product is incomplete: a name is required." : "The product is incomplete: name and price are required.");
  const facts = cleanFacts(input.facts);
  const market = getMarket(input.market);
  const currency = input.currency && /^[A-Z]{3}$/.test(input.currency) ? input.currency : market.currency;
  const shippingFee = Math.max(0, input.shippingFee ?? 0);

  // the merchant's own words only (the library tagline is not product truth)
  const { reading, keywords } = moodOf(input);
  // a garment filed under kids / traditional gets garment copy (cut, fabric, size), not toy or terroir copy
  const copyCat = copyCategory(parsedProduct.data.category, keywords);
  const hasWhatsapp = /^\+?[0-9]{8,15}$/.test(input.whatsapp?.replace(/[\s().-]/g, "") ?? "");
  const copy: PageCopy =
    input.copy?.[input.locale] ??
    libraryCopy({
      // the library reads the family from the catalog category and the product's words: a girl's
      // prayer abaya filed under kids gets modest-wear copy for prayer and for girls; no line
      // promises WhatsApp replies when the store has no number
      category: parsedProduct.data.category,
      keywords,
      locale: input.locale,
      market: input.market,
      seed,
      productName: parsedProduct.data.name,
      deliveryText: input.deliveryText,
      hasWhatsapp,
    });

  const story = parsedProduct.data;
  const product: PageDoc["product"] = {
    ...story,
    tagline: story.tagline || copy.tagline,
    description: story.description || (facts.length ? factsToDescription(facts) : undefined),
  };
  // the items (options as typed: the order form, rendered by every direction, shows their pickers)
  // and the offers: the wizard's verbatim, else suggested from the items' prices and group photos
  let catalog: ReturnType<typeof directionCatalog>;
  try {
    catalog = directionCatalog(input, { currency, product, copy });
  } catch (e) {
    throw new GeneratorError(e instanceof CatalogInputError ? e.message : "The products or offers are invalid.");
  }
  const { items, bundles } = catalog;

  const theme = productTheme({ category: product.category, palette: input.palette, aiVibe: input.aiVibe, keywords, mood: reading.mood, archetype, seed, locale: input.locale });
  // the owner's "Look" for every direction, else the archetype's pick for these offers (§E.5)
  const display = displayInput(input.display) ?? pickOfferDisplay(archetype, bundles, seed);
  const offers: PageDoc["offers"] = {
    bundles,
    display,
    extras: [],
    showPerUnit: true,
    showSavings: "both",
    shippingFee,
    urgency: {},
  };

  const garment = isGarment(product.category, keywords);
  const ctx: PlanContext = {
    archetype,
    seed,
    category: product.category,
    hasCutout: !!product.cutout,
    imageCount: product.images.length,
    hasFacts: facts.length >= 2,
    hasWhatsapp,
    mood: reading.mood,
    storeName: hasRealStoreName(input.store),
    garment,
    ...(avoid ? { avoid } : {}),
  };

  // sections: build data first, then lay out backgrounds/dividers over the ones that exist
  // section defaults are content too, written from the real product: the sections read a garment
  // from its name whatever the category (garmentOf), and a girl's abaya filed under kids keeps its
  // children's lines (size by age, "her prayer outfit"). A product the sections cannot read as a
  // garment still gets its copy family's defaults (fit and fabric sample lines, not toy ones).
  const sectionsReadGarment = garment && garmentOf(product) !== null;
  const basics: DocBasics = { locale: input.locale, product: copyCat === product.category || sectionsReadGarment ? product : { ...product, category: copyCat }, items, offers, theme };
  // a garment's detail callouts describe a garment (the section's family defaults may not), and the
  // promise lines only point to WhatsApp when the store has a number
  // the photo a garment's details are pinned on (a single figure rather than a group shot) and its
  // subject analysis, when the caller knows it; a cutout is what the showcase shows, pins stay generic
  const pinned = garment && !product.cutout ? garmentPhoto(product.images, input.photos) : null;
  const extras: CopyExtras = {
    facts,
    ...(garment ? { details: garmentDetails(input.locale, product.category, keywords, pinned?.focus ?? null) } : {}),
    whatsapp: hasWhatsapp,
    ...(reading.modest ? { bigWord: modestBigWord(input.locale, keywords) } : {}),
  };
  const taken = new Set<string>();
  const chosen: { type: string; variant: string; id: string; data: Record<string, unknown> }[] = [];
  for (const type of fullOrder(ctx, chooseOrder(ctx))) {
    const id = sectionId(type, taken);
    let data = sectionData(type, id, basics, copy, extras);
    // the details were pinned on another photo than the main one: the showcase shows that photo
    // (only while the pins are the generator's own — merchant facts carry no positions to match)
    if (data && type === "showcase" && pinned && pinned.ref.id !== product.images[0]?.id && facts.length < 2) data = { ...data, image: pinned.ref };
    if (data) chosen.push({ type, variant: chooseVariant(type, ctx), id, data });
    else taken.delete(id);
  }
  // one scrolling band in the page body
  const built = calmBands(chosen, ctx);
  // backgrounds judged on the theme's real colors; transitions left to the renderer ("auto")
  const plan = finishPlan(built, archetype, seed, themeTones(theme, input.locale), { mood: reading.mood });
  const planned: SectionInstance[] = built.map((b, i) => ({
    id: b.id,
    type: b.type,
    variant: b.variant,
    bg: plan[i]!.bg,
    divider: plan[i]!.divider,
    spacing: plan[i]!.spacing,
    hidden: false,
    // a fragment written flush against an emphasis ("و*ساترة*", "*X*:") shares its word box (glue.ts)
    data: glueDeep(b.data, input.locale),
  }));
  const sections = directSections(planned);

  // the generator never pairs the bold order form (cards on an accent slab) with a solid selection
  const formVariant = sections.find((s) => s.type === "orderForm" && !s.hidden)?.variant;

  const ogImage = product.images[0];
  const draft: PageDocInput = {
    v: 2,
    locale: input.locale,
    market: input.market,
    currency,
    product,
    items,
    offers: { ...offers, display: safeSelection(display, formVariant) },
    form: {
      city: input.market === "MA" ? "select" : "text",
      address: "required",
      note: "optional",
      email: "hidden",
      // INTL has no phone country: keep the schema default rather than an invalid code
      ...(/^[A-Z]{2}$/.test(market.phone.country) ? { phoneCountry: market.phone.country } : {}),
      title: glueEmphasis(copy.form.title, input.locale),
      submitLabel: copy.form.submit,
      reassurance: glueEmphasis(copy.form.reassurance, input.locale),
    },
    theme,
    sections,
    seo: {
      title: copy.seo.title,
      description: copy.seo.description,
      ...(ogImage ? { ogImage } : {}),
      noindex: false,
    },
    tracking: trackingOf(input.tracking),
    thankYou: { title: glueEmphasis(copy.thankYou.title, input.locale), message: glueEmphasis(copy.thankYou.message, input.locale), showTimeline: true },
  };

  const { doc, issues } = validateDoc(draft);
  if (!doc) throw new GeneratorError(issues[0]?.message ?? "The generated page is invalid.");
  return doc;
}

/**
 * The page's tracking from the wizard's answer: `{ kind: "none" }` → "No pixel on this page";
 * `{ kind: "ids", tracking }` → those pixels; a plain Tracking value (one release) → as is. Invalid
 * or empty → `{}` (no answer yet).
 */
function trackingOf(value: unknown): PageDoc["tracking"] {
  if (value === undefined || value === null || typeof value !== "object") return {};
  const v = value as { kind?: unknown; tracking?: unknown };
  if (v.kind === "none") return { none: true };
  const parsed = Tracking.safeParse(v.kind === "ids" ? v.tracking : value);
  if (!parsed.success) return {};
  // "No pixel" and pixels at once: the pixels win (the same repair as upgradeDoc)
  if (parsed.data.none && hasPixel(parsed.data)) {
    const { none, ...rest } = parsed.data;
    void none;
    return rest;
  }
  return parsed.data;
}

const hasPixel = (t: PageDoc["tracking"]) => [t.metaPixelId, t.tiktokPixelId, t.snapPixelId, t.ga4Id].some((ids) => (Array.isArray(ids) ? ids.length > 0 : !!ids));

/** Vibe words the ranking matched for an archetype ('AI vibe "luxury, heritage" +0.60'). */
const matchedVibes = (reason: string) =>
  (/AI vibe "([^"]+)"/.exec(reason)?.[1] ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

export interface RankedDirection {
  archetype: Archetype;
  score: number;
  /** the engine's explanation, plus the mood adjustment */
  reason: string;
}

/**
 * Archetypes for the product, best first: the theme engine's ranking (category, photo palette, AI
 * vibe and the product's own words) adjusted by the product's mood. A calm product only gets quiet
 * interpretations — the loud languages are left out, not just ranked lower (see mood.ts). Use it
 * for "other styles" too, so every proposal stays appropriate.
 */
export function rankDirections(input: Pick<GenerateInput, "product" | "palette" | "aiVibe" | "facts">): RankedDirection[] {
  const parsed = Product.safeParse(input.product);
  const category = parsed.success ? parsed.data.category : "other";
  const { reading, keywords } = moodOf(input);
  const out: (RankedDirection & { at: number })[] = [];
  rankArchetypes({ category, palette: input.palette, aiVibe: input.aiVibe ?? null, keywords: keywords || null }).forEach((r, at) => {
    const fit = moodFit(r.archetype, reading);
    if (fit === null) return;
    const reason = fit ? `${r.reason}; ${reading.mood} product${reading.modest ? " (modest)" : ""} ${fit > 0 ? "+" : ""}${fit.toFixed(2)}` : r.reason;
    out.push({ archetype: r.archetype, score: Math.round((r.score + fit) * 1000) / 1000, reason, at });
  });
  return out.sort((a, b) => b.score - a.score || a.at - b.at).map(({ archetype, score, reason }) => ({ archetype, score, reason }));
}

/** Three different archetypes for the product, best match first (forced archetypes lead). */
export function pickArchetypes(
  input: Pick<GenerateInput, "product" | "palette" | "aiVibe" | "archetypes" | "facts">,
): { archetype: Archetype; reason: string; match: DirectionMatch }[] {
  const ranked = rankDirections(input);
  const { reading } = moodOf(input);
  const moodWords = reading.mood === "calm" ? ["calm", ...(reading.modest ? ["modest"] : [])] : [];
  const entry = (archetype: Archetype, forced: boolean) => {
    const rank = ranked.findIndex((r) => r.archetype === archetype);
    const reason = ranked[rank]?.reason ?? "Chosen by you";
    const vibes = [...new Set([...matchedVibes(reason), ...moodWords])].slice(0, 3);
    return { archetype, reason, match: { rank: rank < 0 ? ranked.length : rank, vibes, forced } };
  };
  const forced = (input.archetypes ?? []).filter((a, i, all) => all.indexOf(a) === i).map((a) => entry(a, true));
  const out = forced.slice(0, 3);
  for (const r of ranked) {
    if (out.length >= 3) break;
    if (!out.some((o) => o.archetype === r.archetype)) out.push(entry(r.archetype, false));
  }
  return out;
}

/** What an earlier direction looks like, for the next one to differ from. */
interface Look {
  base: string;
  accent: string;
}

/**
 * Seed of direction `i`. A few alternative seeds are tried when the first one would repeat what the
 * earlier directions already show:
 *   - every earlier direction on the same page mood (light, tinted or dark) → another mood;
 *   - a calm product: the engine draws its accent from a few quiet partners (plum, dusty rose, sage,
 *     ink, the product's own deepened hue) — two directions in the same accent read as one proposal,
 *     so a seed with a clearly different accent is preferred.
 * The theme engine still decides what the archetype and the product colors allow.
 */
function directionSeed(input: GenerateInput, archetype: Archetype, i: number, looks: readonly Look[]): number {
  const first = deriveSeed(input.seedBase, `direction:${i}:${archetype}`);
  if (looks.length === 0) return first;
  const { reading, keywords } = moodOf(input);
  const sameMood = new Set(looks.map((l) => l.base)).size === 1;
  const calm = reading.mood === "calm";
  if (!sameMood && !calm) return first;
  const product = Product.safeParse(input.product);
  const category = product.success ? product.data.category : "other";
  const score = (theme: ThemeSpec) =>
    (sameMood && theme.palette.base !== looks[0]!.base ? 1 : 0) +
    (calm && looks.every((l) => colorDistance(l.accent, theme.palette.accent) >= DISTINCT_ACCENT) ? 2 : 0);
  const goal = (sameMood ? 1 : 0) + (calm ? 2 : 0);
  let best = { seed: first, score: -1 };
  // ~6 ms per try; the quiet partners are few, a dozen draws all but guarantee a distinct one
  for (let k = 0; k < (calm ? 12 : 6); k++) {
    const seed = k === 0 ? first : deriveSeed(input.seedBase, `direction:${i}:${archetype}:${k}`);
    const theme = productTheme({ category, palette: input.palette, aiVibe: input.aiVibe, keywords, mood: reading.mood, archetype, seed, locale: input.locale }, { scout: true });
    const s = score(theme);
    if (s > best.score) best = { seed, score: s };
    if (s >= goal) break;
  }
  return best.seed;
}

/**
 * Three art-directed directions (distinct archetypes), deterministic per `seedBase`. Built in
 * order: each one steers away from the hero and section compositions of the ones before it.
 */
export function generateDirections(input: GenerateInput): Direction[] {
  const avoid = new Map<string, Set<string>>();
  const looks: Look[] = [];
  return pickArchetypes(input).map(({ archetype, reason, match }, i) => {
    const seed = directionSeed(input, archetype, i, looks);
    const doc = buildDirection(input, archetype, seed, avoid);
    looks.push({ base: doc.theme.palette.base, accent: doc.theme.palette.accent });
    for (const s of doc.sections) {
      if (!SPREAD_TYPES.has(s.type)) continue;
      const used = avoid.get(s.type) ?? new Set<string>();
      used.add(s.variant);
      avoid.set(s.type, used);
    }
    const def = ARCHETYPE_DEFS[archetype];
    return { archetype, label: def.label, description: def.description, reason, match, seed, doc };
  });
}
