/**
 * Page-level direction over section data, once the order of a generated page is known — the things
 * no single section can decide on its own:
 *
 *   - Promises said once: when a trust bar sits right under the hero, the hero drops its own trust
 *     row (the same COD lines twice in a row read as filler; the hero keeps headline, price and CTA).
 *   - CTA rhythm: an order button closes a section only every other section, and never right before
 *     a block that is itself a conversion moment (order form, offers, final CTA, urgency band). The
 *     hero, the form, the offers and the final CTA always keep theirs. Only switches CTAs off —
 *     a section whose defaults have none stays without.
 *   - Kicker rhythm: a small label above every headline is the template tell. The hero and the order
 *     form keep theirs (product name, "order in 30 seconds" signpost); elsewhere one section in three
 *     carries a kicker, the others open on their headline alone.
 *   - Emphasis rhythm: a highlighted word in every headline is no longer an accent. The statement
 *     sections (hero, problem, story, final CTA) keep theirs; the others alternate, so a marked word
 *     lands every other headline (**strong** is kept everywhere).
 *
 * Applied at generation only: remixes and the builder never touch what the merchant set.
 */
import type { SectionInstance } from "@/lib/page/schema";
import { parseInline, type InlineNode } from "@/landing/primitives/markup";
import { getSection } from "@/landing/registry";

/** Sections that are a conversion moment by themselves (their buttons are the point). */
const CONVERSION = new Set(["orderForm", "offer", "cta"]);

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function convertsByItself(s: SectionInstance): boolean {
  if (CONVERSION.has(s.type) || s.type === "hero") return true;
  return s.type === "urgency" && s.data.showCta !== false;
}

/** true / false for a section with an optional order button (boolean toggle or label), null otherwise. */
function ctaOn(s: SectionInstance): boolean | null {
  const v = s.data.cta;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.trim().length > 0;
  return null;
}

function withoutCta(s: SectionInstance): SectionInstance {
  const v = s.data.cta;
  return { ...s, data: { ...s.data, cta: typeof v === "boolean" ? false : "" } };
}

const KICKER_KEYS = ["kicker", "eyebrow", "overline"] as const;
/** Sections whose kicker is a signpost, not decoration. */
const KEEP_KICKER = new Set(["hero", "orderForm"]);

function kickerKey(s: SectionInstance): (typeof KICKER_KEYS)[number] | null {
  for (const k of KICKER_KEYS) {
    const v = s.data[k];
    if (typeof v === "string" && v.trim().length > 0) return k;
  }
  return null;
}

/** Statement sections: the marked word is the point of their headline. */
const KEEP_EMPHASIS = new Set(["hero", "problem", "story", "cta"]);
const TITLE_KEYS = ["title", "headline", "heading"] as const;

/** Literal text back into markup: backslashes and asterisks escaped (markup.ts tokenizer rules). */
const escapeStars = (t: string) => t.replace(/\\/g, "\\\\").replace(/\*/g, "\\*");

/** Copy markup back from a parsed tree with *emphasis* dissolved (its text stays) and **strong** kept. */
function withoutEmphasis(nodes: readonly InlineNode[]): string {
  return nodes
    .map((n) => {
      if (typeof n === "string") return escapeStars(n);
      if (n.t === "br") return "\n";
      if (n.t === "em") return withoutEmphasis(n.c);
      return `**${withoutEmphasis(n.c)}**`;
    })
    .join("");
}

function titleKey(s: SectionInstance): (typeof TITLE_KEYS)[number] | null {
  for (const k of TITLE_KEYS) if (typeof s.data[k] === "string" && (s.data[k] as string).trim()) return k;
  return null;
}

const hasEmphasis = (nodes: readonly InlineNode[]): boolean =>
  nodes.some((n) => typeof n !== "string" && n.t !== "br" && (n.t === "em" || hasEmphasis(n.c)));

/** Direct the section data of a freshly generated page (pure: returns new instances where changed). */
export function directSections(sections: readonly SectionInstance[]): SectionInstance[] {
  const out = sections.slice();
  const flowAt: number[] = [];
  out.forEach((s, i) => {
    const cat = getSection(s.type)?.category;
    if (cat !== "top" && cat !== "floating" && cat !== "bottom" && !s.hidden) flowAt.push(i);
  });

  // promises said once
  const heroPos = flowAt.findIndex((i) => out[i]!.type === "hero");
  if (heroPos >= 0) {
    const hero = out[flowAt[heroPos]!]!;
    const trustNext = flowAt.slice(heroPos + 1, heroPos + 3).some((i) => out[i]!.type === "trustBar");
    if (trustNext && Array.isArray(hero.data.trust) && hero.data.trust.length > 0) {
      out[flowAt[heroPos]!] = { ...hero, data: { ...hero.data, trust: [] } };
    }
  }

  // CTA rhythm
  let lastCta = Number.NEGATIVE_INFINITY;
  flowAt.forEach((at, k) => {
    const s = out[at]!;
    if (!isRecord(s.data)) return;
    if (convertsByItself(s)) {
      lastCta = k;
      return;
    }
    if (ctaOn(s) !== true) return;
    const next = k + 1 < flowAt.length ? out[flowAt[k + 1]!] : undefined;
    if (k - lastCta < 2 || (next && convertsByItself(next) && next.type !== "hero")) {
      out[at] = withoutCta(s);
      return;
    }
    lastCta = k;
  });

  // kicker rhythm: one in three (strips and sections without a kicker do not count)
  let sinceKicker = Number.POSITIVE_INFINITY;
  for (const at of flowAt) {
    const s = out[at]!;
    const key = kickerKey(s);
    if (!key) continue;
    if (KEEP_KICKER.has(s.type)) {
      sinceKicker = 0;
      continue;
    }
    if (sinceKicker >= 2) {
      sinceKicker = 0;
      continue;
    }
    out[at] = { ...s, data: { ...s.data, [key]: "" } };
    sinceKicker++;
  }

  // emphasis rhythm: every other headline outside the statement sections keeps its marked word
  let keepNext = false;
  for (const at of flowAt) {
    const s = out[at]!;
    if (KEEP_EMPHASIS.has(s.type)) continue;
    const key = titleKey(s);
    if (!key) continue;
    const nodes = parseInline(s.data[key] as string);
    if (!hasEmphasis(nodes)) continue;
    if (keepNext) {
      keepNext = false;
      continue;
    }
    out[at] = { ...s, data: { ...s.data, [key]: withoutEmphasis(nodes) } };
    keepNext = true;
  }
  return out;
}
