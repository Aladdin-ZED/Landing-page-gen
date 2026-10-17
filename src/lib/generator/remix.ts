/**
 * remixDoc — new take on an existing page without losing the merchant's work.
 *
 *   design  same archetype & product colors; new font pairing, mood, illustration seed, section
 *           variants (archetype-compatible), backgrounds and transitions. Content untouched.
 *   layout  re-orders the movable middle of the page along another proven storyline (top bars,
 *           hero, footer and floating bars stay put; sections the admin added keep their place
 *           relative to their neighbors), then re-flows backgrounds and transitions.
 *   copy    re-picks wording alternatives from the copy library for every text the generator
 *           owns (headlines, benefits, FAQ…). Product facts, prices and offers are kept; only the
 *           titles of ×N packs on single-item pages are re-worded ("Pack Duo").
 *   all     layout → design → copy.
 *
 * Pure & deterministic per seed. Always returns a valid document (the input on failure).
 */
import { libraryCopy } from "@/lib/ai/copy-library";
import { isLegacyOffer, offerUnits } from "@/lib/page/catalog";
import { PageDoc, type PageDoc as PageDocT, type SectionInstance } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { getSection } from "@/landing/registry";
import { factsFromDescription } from "./directions";
import { garmentDetails, modestBigWord } from "./garment";
import { formVariantOf, safeSelection } from "./offers";
import { glueDeep, glueEmphasis } from "./glue";
import { isGarment, moodFit, productKeywords, readMood, type MoodReading } from "./mood";
import { LAYOUT_TYPES, TEMPLATE_COUNT, calmBands, chooseVariant, finishPlan, templateOrder, type PlanContext } from "./plan";
import { deriveSeed } from "./rng";
import { recopySection } from "./sections";
import { rerollTheme } from "./theme";
import { themeTones } from "./tones";

export type RemixScope = "design" | "layout" | "copy" | "all";

export interface RemixOptions {
  seed: number;
  scope: RemixScope;
}

const isFloating = (s: SectionInstance) => getSection(s.type)?.category === "floating";
const isTop = (s: SectionInstance) => getSection(s.type)?.category === "top";

/**
 * The page's product mood, read again from the product's words (the photo palette is not stored in
 * the page). A page whose archetype a calm product would never get (chosen by hand) is not calmed.
 */
function moodOfDoc(doc: PageDocT): { reading: MoodReading; keywords: string } {
  const keywords = productKeywords(doc.product, factsFromDescription(doc.product.description));
  const reading = readMood({ keywords, category: doc.product.category, palette: null });
  return { reading: moodFit(doc.theme.archetype, reading) === null ? { ...reading, mood: "neutral" } : reading, keywords };
}

/** The page carries a WhatsApp channel: its own pinned number, or the store's floating button. */
const hasWhatsapp = (doc: PageDocT) => !!doc.form.whatsapp?.enabled || doc.sections.some((s) => s.type === "whatsappFloat");

function planContext(doc: PageDocT, seed: number): PlanContext {
  const { reading, keywords } = moodOfDoc(doc);
  return {
    mood: reading.mood,
    garment: isGarment(doc.product.category, keywords),
    archetype: doc.theme.archetype,
    seed,
    category: doc.product.category,
    hasCutout: !!doc.product.cutout,
    imageCount: doc.product.images.length,
    hasFacts: factsFromDescription(doc.product.description).length >= 2,
    // the page pins its own number, or follows the store's (then it carries the floating button)
    hasWhatsapp: hasWhatsapp(doc),
  };
}

/**
 * Re-flow backgrounds and spacing over the current order (variants as given), judged on the colors
 * of `doc.theme`; transitions go back to "auto" (the renderer draws them from the live theme).
 */
function reflow(doc: PageDocT, sections: SectionInstance[], seed: number): SectionInstance[] {
  const plan = finishPlan(
    sections.map((s) => ({ type: s.type, variant: s.variant })),
    doc.theme.archetype,
    seed,
    themeTones(doc.theme, doc.locale),
    { mood: moodOfDoc(doc).reading.mood },
  );
  return sections.map((s, i) => ({ ...s, bg: plan[i]!.bg, divider: plan[i]!.divider, spacing: plan[i]!.spacing }));
}

function remixDesign(doc: PageDocT, seed: number): PageDocT {
  const { reading, keywords } = moodOfDoc(doc);
  const theme = rerollTheme(doc.theme, doc.product.category, deriveSeed(seed, "theme"), { keywords, mood: reading.mood, locale: doc.locale });
  const next: PageDocT = { ...doc, theme };
  const ctx = planContext(next, deriveSeed(seed, "variants"));
  const rechosen = doc.sections.map((s) => {
    const def = getSection(s.type);
    // keep variants the admin cannot get back from the archetype (unknown types, single-variant sections)
    if (!def || def.variants.length < 2) return s;
    return { ...s, variant: chooseVariant(s.type, ctx, ":remix") };
  });
  // one scrolling band in the page body (a single-variant section keeps its own)
  const sections = reflow(next, calmBands(rechosen, ctx), deriveSeed(seed, "flow"));
  // a new bold order form never gets a solid selection (accent on accent, §E.3)
  const display = safeSelection(doc.offers.display, formVariantOf({ sections }));
  return { ...next, sections, ...(display !== doc.offers.display ? { offers: { ...doc.offers, display } } : {}) };
}

function remixLayout(doc: PageDocT, seed: number): PageDocT {
  const all = doc.sections;
  const head = all.filter(isTop);
  const floating = all.filter(isFloating);
  const body = all.filter((s) => !isTop(s) && !isFloating(s));
  const heroAt = body.findIndex((s) => s.type === "hero");
  const footerAt = body.findIndex((s) => s.type === "footer");
  const start = heroAt >= 0 ? heroAt + 1 : 0;
  const end = footerAt >= 0 ? footerAt : body.length;
  const middle = body.slice(start, end);
  if (middle.length < 3) return doc;

  // target order of the known types along a storyline different from the current one when possible
  const current = middle.filter((s) => LAYOUT_TYPES.has(s.type)).map((s) => s.type).join(",");
  let order: string[] = [];
  for (let k = 0; k < TEMPLATE_COUNT; k++) {
    const candidate = templateOrder(seed + k).filter((t) => t !== "hero");
    order = candidate;
    const projected = middle
      .filter((s) => LAYOUT_TYPES.has(s.type))
      .slice()
      .sort((a, b) => rank(candidate, a.type) - rank(candidate, b.type))
      .map((s) => s.type)
      .join(",");
    if (projected !== current) break;
  }

  // movable sections take the template order; the others keep their slots
  const movable = middle.filter((s) => LAYOUT_TYPES.has(s.type)).sort((a, b) => rank(order, a.type) - rank(order, b.type) || middle.indexOf(a) - middle.indexOf(b));
  let m = 0;
  const reordered = middle.map((s) => (LAYOUT_TYPES.has(s.type) ? movable[m++]! : s));
  const sections = [...head, ...body.slice(0, start), ...reordered, ...body.slice(end), ...floating];
  return { ...doc, sections: reflow(doc, sections, deriveSeed(seed, "flow")) };
}

/** Position of a type in a template order (unknown types sort last, stable). */
function rank(order: readonly string[], type: string): number {
  const i = order.indexOf(type);
  return i < 0 ? order.length + 1 : i;
}

/** Pin positions of the page's showcase details ({x, y} per point, in order; empty when none). */
function pinsOf(doc: PageDocT): { x: number; y: number }[] {
  const s = doc.sections.find((x) => x.type === "showcase");
  const points = (s?.data as { points?: unknown } | undefined)?.points;
  if (!Array.isArray(points)) return [];
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    const { x, y } = (p ?? {}) as { x?: unknown; y?: unknown };
    if (typeof x !== "number" || typeof y !== "number") return [];
    out.push({ x, y });
  }
  return out;
}

function remixCopy(doc: PageDocT, seed: number): PageDocT {
  const facts = factsFromDescription(doc.product.description);
  const { keywords, reading } = moodOfDoc(doc);
  const copy = libraryCopy({
    // catalog category + the product's words pick the family and its facets (see directions.ts)
    category: doc.product.category,
    keywords,
    locale: doc.locale,
    market: doc.market,
    seed: deriveSeed(seed, "copy"),
    productName: doc.product.name,
    hasWhatsapp: hasWhatsapp(doc),
  });
  // new words for a garment's details, same pins: the page's pins were placed on its photo (on the
  // real figure when the photo analysis was known) and a copy remix does not move them
  const pins = pinsOf(doc);
  const fresh = isGarment(doc.product.category, keywords) ? garmentDetails(doc.locale, doc.product.category, keywords) : null;
  const details = fresh && pins.length === fresh.length ? fresh.map((d, i) => ({ ...d, ...pins[i]! })) : fresh;
  const extras = {
    facts,
    ...(details ? { details } : {}),
    whatsapp: hasWhatsapp(doc),
    ...(reading.modest ? { bigWord: modestBigWord(doc.locale, keywords) } : {}),
  };
  const sections = doc.sections.map((s) => ({ ...s, data: glueDeep(recopySection(s, copy, extras), doc.locale) }));
  const bundleText = copy.bundles;
  return {
    ...doc,
    product: { ...doc.product, tagline: copy.tagline },
    offers: {
      ...doc.offers,
      bundles: doc.offers.bundles.map((b) => {
        // titles are rewritten only on ×N packs of a single-item page ("Pack Duo"); every other
        // offer (several items, choices, gifts, color packs) keeps the owner's words
        const qty = doc.items.length === 1 && isLegacyOffer(doc, b) ? offerUnits(b) : 0;
        const t = qty >= 1 && qty <= 3 ? bundleText[qty - 1] : undefined;
        return t ? { ...b, title: t.title, subtitle: t.subtitle } : b;
      }),
    },
    form: { ...doc.form, title: glueEmphasis(copy.form.title, doc.locale), submitLabel: copy.form.submit, reassurance: glueEmphasis(copy.form.reassurance, doc.locale) },
    seo: { ...doc.seo, title: copy.seo.title, description: copy.seo.description },
    thankYou: { ...doc.thankYou, title: glueEmphasis(copy.thankYou.title, doc.locale), message: glueEmphasis(copy.thankYou.message, doc.locale) },
    sections,
  };
}

export function remixDoc(doc: PageDocT, opts: RemixOptions): PageDocT {
  const parsed = PageDoc.safeParse(doc);
  if (!parsed.success) return doc;
  const seed = Math.abs(Math.trunc(Number.isFinite(opts.seed) ? opts.seed : 0)) % 2_147_483_647;
  let next = parsed.data;
  if (opts.scope === "layout" || opts.scope === "all") next = remixLayout(next, deriveSeed(seed, "layout"));
  if (opts.scope === "design" || opts.scope === "all") next = remixDesign(next, deriveSeed(seed, "design"));
  if (opts.scope === "copy" || opts.scope === "all") next = remixCopy(next, deriveSeed(seed, "copy"));
  const { doc: valid } = validateDoc(next);
  return valid ?? doc;
}
