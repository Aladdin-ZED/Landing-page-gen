/**
 * Which copy goes into which section. Field names are candidates (see overlay.ts): the overlay writes
 * a value only where the section's schema has a compatible field, and validates every write.
 */
import type { PageCopy } from "@/lib/ai/copy-schema";
import type { IconName } from "@/landing/primitives/icons";
import type { PatchEntry, SemanticItem } from "./overlay";

export interface CopyExtras {
  /** merchant facts (bullets) — used as product callouts */
  facts: readonly string[];
  /**
   * Detail callouts written for this kind of product (garment.ts), used when the merchant gave fewer
   * than two facts — instead of the section's family defaults, which may describe another product.
   */
  details?: readonly SemanticItem[];
  /**
   * false when the store has no WhatsApp number: the short promise lines (top bar, trust bar,
   * guarantee) leave out "we answer on WhatsApp" — a channel the visitor cannot reach.
   */
  whatsapp?: boolean;
  /** the hero's giant background word, when the product's mood calls for another one (garment.ts) */
  bigWord?: string;
}

/** A promise line that sends the visitor to WhatsApp. */
const WHATSAPP_LINE = /whats\s?app|واتساب|واتس اب|واتس آب/i;

const KICKER = ["kicker", "eyebrow", "overline"] as const;
const TITLE = ["title", "headline", "heading"] as const;
const LEAD = ["lead", "subtitle", "intro", "description"] as const;
const CTA_LABEL = ["ctaLabel", "buttonLabel", "button"] as const;

/**
 * Icon for a reassurance line, from its meaning (lines come from AI or the library in any locale).
 * The inspection promise is read first: "check before you pay" / "عاين طلبك قبل الدفع" is about
 * looking, not paying; then payment, then delivery ("open it in front of the courier" is no truck).
 */
export function iconForLine(text: string): IconName {
  const t = text.toLowerCase();
  if (/(vérif|verif|check|inspect|ouvrez|عاين|معاينة|تعاين|تفتح)/.test(t)) return "eye";
  if (/(paiement|payment|pay\b|pay |payez|payer|cash|espèces|الدفع|تدفع|نقدا|نقداً)/.test(t)) return "cash-hand";
  if (/(livraison|delivery|deliver|livr|توصيل|التوصيل)/.test(t)) return "truck";
  if (/(whatsapp|واتساب)/.test(t)) return "whatsapp";
  if (/(échange|exchange|retour|return|تبديل|استبدال)/.test(t)) return "return";
  if (/(appel|call|اتصال|نتصل|يتصل)/.test(t)) return "phone";
  return "check";
}

/** Textile ornament words: lace and embroidery are a motif, not a jewel. */
const TEXTILE_ORNAMENT = /(dentelle|lace|دانتيل|دانتيلا|broderie|brodé|embroider|طرز|مطرز)/i;

/**
 * A benefit's icon checked against its own words: a gem on a lace or embroidery line reads as
 * jewelry on a garment page, so it becomes the six-point motif mark the section uses for lace.
 */
export function fitBenefitIcon(icon: string | undefined, title: string, text: string): string | undefined {
  if (icon === "gem" && TEXTILE_ORNAMENT.test(`${title} ${text}`)) return "asterisk";
  return icon;
}

const items = (list: readonly SemanticItem[]) => list;

/** Copy patch for one section type (empty when the generator leaves the section's defaults as is). */
export function copyPatch(type: string, c: PageCopy, extras: CopyExtras): PatchEntry[] {
  const facts = extras.facts.filter(Boolean);
  // without a WhatsApp number the promise lines never point there (a list never empties: the
  // section keeps its minimum from the remaining lines)
  const reachable = <T>(list: readonly T[], text: (t: T) => string, min: number): T[] => {
    if (extras.whatsapp !== false) return list.slice();
    const kept = list.filter((t) => !WHATSAPP_LINE.test(text(t)));
    return kept.length >= min ? kept : list.slice();
  };
  switch (type) {
    case "announcement":
      return [{ keys: ["items", "lines", "messages"], value: items(reachable(c.announcement, (t) => t, 1).map((text) => ({ text, icon: iconForLine(text) }))) }];
    case "header":
      return [{ keys: CTA_LABEL, value: c.sticky.label }];
    case "hero":
      return [
        { keys: KICKER, value: c.hero.kicker },
        { keys: TITLE, value: c.hero.headline },
        { keys: ["subtitle", "sub", "lead", "text"], value: c.hero.sub },
        { keys: CTA_LABEL, value: c.hero.cta },
        { keys: ["bigWord"], value: extras.bigWord ?? c.hero.bigWord },
        {
          keys: ["notes", "callouts", "chips"],
          value: items((facts.length >= 2 ? facts : c.benefits.items.map((b) => b.title)).slice(0, 3).map((title) => ({ title }))),
        },
        { keys: ["trust", "trustItems"], value: items(reachable(c.trust, (t) => t.text, 1).slice(0, 3).map((t) => ({ icon: t.icon, text: t.text }))) },
      ];
    case "trustBar":
      return [{ keys: ["items", "points", "badges"], value: items(reachable(c.trust, (t) => t.text, 2).map((t) => ({ icon: t.icon, title: t.text }))) }];
    case "marquee":
      return [{ keys: ["items", "words", "lines"], value: c.marquee }];
    case "problem":
      return [
        { keys: KICKER, value: c.problem.kicker },
        { keys: TITLE, value: c.problem.title },
        { keys: LEAD, value: c.problem.lead },
        { keys: ["pains", "points", "items"], value: items(c.problem.points.map((p) => ({ pain: p.pain, fix: p.fix }))) },
        { keys: ["solution", "answer"], value: c.problem.solution },
        { keys: CTA_LABEL, value: c.hero.cta },
      ];
    case "benefits":
      return [
        { keys: KICKER, value: c.benefits.kicker },
        { keys: TITLE, value: c.benefits.title },
        { keys: LEAD, value: c.benefits.lead },
        { keys: ["items", "benefits"], value: items(c.benefits.items.map((b) => ({ title: b.title, text: b.text, icon: fitBenefitIcon(b.icon, b.title, b.text) }))) },
        { keys: CTA_LABEL, value: c.hero.cta },
      ];
    case "showcase":
      return [
        { keys: KICKER, value: c.showcase.kicker },
        { keys: TITLE, value: c.showcase.title },
        { keys: LEAD, value: c.showcase.lead },
        ...(facts.length >= 2
          ? [{ keys: ["points", "callouts"], value: items(facts.slice(0, 6).map((f) => ({ label: f }))) }]
          : extras.details?.length
            ? [{ keys: ["points", "callouts"], value: items(extras.details) }]
            : []),
        { keys: CTA_LABEL, value: c.hero.cta },
      ];
    case "steps":
      return [
        { keys: KICKER, value: c.steps.kicker },
        { keys: TITLE, value: c.steps.title },
        { keys: ["steps", "items"], value: items(c.steps.items.map((s) => ({ title: s.title, text: s.text, icon: s.icon }))) },
        { keys: CTA_LABEL, value: c.hero.cta },
      ];
    case "story":
      return [
        { keys: KICKER, value: c.story.kicker },
        { keys: TITLE, value: c.story.title },
        { keys: ["text", "body", "story", "paragraph", "lead"], value: c.story.text },
      ];
    case "gallery":
      return [
        { keys: KICKER, value: c.gallery.kicker },
        { keys: TITLE, value: c.gallery.title },
      ];
    case "comparison":
      return [
        { keys: TITLE, value: c.comparison.title },
        { keys: ["usLabel", "oursLabel", "ourLabel"], value: c.comparison.us },
        { keys: ["themLabel", "othersLabel", "theirLabel"], value: c.comparison.them },
        { keys: ["rows", "items", "lines"], value: items(c.comparison.rows.map((r) => ({ label: r.label, us: r.us, them: r.them }))) },
      ];
    case "specs":
      return [
        { keys: KICKER, value: c.specs.kicker },
        { keys: TITLE, value: c.specs.title },
      ];
    case "reviews":
      return [
        { keys: KICKER, value: c.reviews.kicker },
        { keys: TITLE, value: c.reviews.title },
      ];
    case "socialProof":
      return [
        { keys: KICKER, value: c.socialProof.kicker },
        { keys: TITLE, value: c.socialProof.title },
      ];
    case "offer":
      return [
        { keys: KICKER, value: c.offer.kicker },
        { keys: TITLE, value: c.offer.title },
        { keys: LEAD, value: c.offer.lead },
        { keys: CTA_LABEL, value: c.offer.cta },
      ];
    case "guarantee":
      return [
        { keys: KICKER, value: c.guarantee.kicker },
        { keys: TITLE, value: c.guarantee.title },
        { keys: ["lines", "items", "points", "promises"], value: items(reachable(c.guarantee.lines, (t) => t, 2).map((text) => ({ text, icon: iconForLine(text) }))) },
      ];
    case "orderForm":
      return [
        { keys: KICKER, value: c.form.kicker },
        { keys: TITLE, value: c.form.title },
        { keys: LEAD, value: c.form.lead },
        { keys: ["submitLabel"], value: c.form.submit },
        { keys: ["reassurance"], value: c.form.reassurance },
      ];
    case "cta":
      return [
        { keys: KICKER, value: c.cta.kicker },
        { keys: TITLE, value: c.cta.title },
        { keys: ["text", "lead", "subtitle"], value: c.cta.text },
        { keys: [...CTA_LABEL, "label"], value: c.cta.button },
      ];
    case "faq":
      return [
        { keys: KICKER, value: c.faq.kicker },
        { keys: TITLE, value: c.faq.title },
        { keys: ["items", "faqs", "questions"], value: items(c.faq.items.map((f) => ({ q: f.q, a: f.a }))) },
      ];
    case "stickyCta":
      return [
        { keys: ["label"], value: c.sticky.label },
        { keys: ["note"], value: c.sticky.note },
      ];
    case "whatsappFloat":
      return [
        { keys: ["label"], value: c.whatsapp.label },
        { keys: ["message"], value: c.whatsapp.message },
      ];
    default:
      return [];
  }
}
