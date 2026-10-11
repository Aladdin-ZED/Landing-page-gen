/**
 * Section-level rules of the builder: zones (top bar / page / footer & floating), new instances with
 * archetype-aware variants and a background that keeps the page rhythm, duplication and ids.
 * Pure and isomorphic.
 */
import { getSection, SECTIONS } from "@/landing/registry";
import type { AnySectionDefinition, SectionCategory } from "@/landing/types";
import { ARCHETYPE_DEFS } from "@/lib/theme";
import { sectionDefaults } from "@/lib/page/validate";
import type { PageDoc, SectionBg, SectionInstance } from "@/lib/page/schema";

export type Zone = "top" | "main" | "end";

export function zoneOf(type: string): Zone {
  const cat = getSection(type)?.category;
  if (cat === "top") return "top";
  if (cat === "bottom" || cat === "floating") return "end";
  return "main";
}

const ZONE_RANK: Record<Zone, number> = { top: 0, main: 1, end: 2 };
/** Inside the end zone the footer comes before the floating bars. */
const endRank = (type: string) => (getSection(type)?.category === "floating" ? 1 : 0);

/** Stable sort into top → page → footer → floating (page order inside each zone is kept). */
export function normalizeOrder(sections: readonly SectionInstance[]): SectionInstance[] {
  return sections
    .map((s, i) => ({ s, i, z: ZONE_RANK[zoneOf(s.type)], e: endRank(s.type) }))
    .sort((a, b) => a.z - b.z || a.e - b.e || a.i - b.i)
    .map((x) => x.s);
}

export const CATEGORY_LABELS: Record<SectionCategory, string> = {
  top: "Top bar",
  hero: "Hero",
  proof: "Proof",
  story: "Story",
  product: "Product",
  offer: "Offer",
  conversion: "Conversion",
  info: "Info",
  bottom: "Footer",
  floating: "Floating",
};

export const CATEGORY_ORDER: SectionCategory[] = ["hero", "proof", "story", "product", "offer", "conversion", "info", "top", "bottom", "floating"];

/** Library entries grouped by category (registry order inside a group). */
export function libraryByCategory(): { category: SectionCategory; label: string; sections: AnySectionDefinition[] }[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    sections: SECTIONS.filter((s) => s.category === category),
  })).filter((g) => g.sections.length > 0);
}

/** Why a section type cannot be added right now (null = it can). */
export function addBlocker(doc: PageDoc, type: string): string | null {
  const def = getSection(type);
  if (!def) return "Unknown section";
  if (def.singleton && doc.sections.some((s) => s.type === type)) return "Already on the page";
  if (doc.sections.length >= 60) return "The page already has 60 sections";
  return null;
}

/* ------------------------------------------------------------------ */
/* ids                                                                 */
/* ------------------------------------------------------------------ */

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

function randomSuffix(len: number): string {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** New section id "<type>-<4 chars>" that is not taken (keeps the Id regex: 2–40 url-safe chars). */
export function newSectionId(type: string, taken: ReadonlySet<string>): string {
  const stem = type.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30) || "section";
  for (let len = 4; len < 9; len++) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const id = `${stem}-${randomSuffix(len)}`;
      if (!taken.has(id)) return id;
    }
  }
  return `${stem}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* variants & backgrounds                                              */
/* ------------------------------------------------------------------ */

/** The archetype's favourite variant of a section type that actually exists. */
export function preferredVariant(def: AnySectionDefinition, doc: PageDoc): string {
  const prefs = (ARCHETYPE_DEFS[doc.theme.archetype]?.preferredVariants as Record<string, readonly string[]> | undefined)?.[def.type] ?? [];
  const ids = new Set(def.variants.map((v) => v.id));
  return prefs.find((p) => ids.has(p)) ?? def.variants[0]?.id ?? "default";
}

/** Backgrounds a variant supports (all when unrestricted). */
export function allowedBgs(def: AnySectionDefinition | undefined, variant: string): SectionBg[] {
  const v = def?.variants.find((x) => x.id === variant);
  return v?.bgs?.length ? [...v.bgs] : ["base", "soft", "surface", "accent", "dark", "pop"];
}

/**
 * Background for a section inserted between `prev` and `next`: never the same as a neighbour
 * (DESIGN §4.1), calm blocks first, then the archetype's color moments.
 */
export function pickBackground(doc: PageDoc, def: AnySectionDefinition, variant: string, prev?: SectionBg, next?: SectionBg): SectionBg {
  const allowed = new Set(allowedBgs(def, variant));
  const moments = ARCHETYPE_DEFS[doc.theme.archetype]?.colorMoments ?? [];
  const order: SectionBg[] = [...new Set<SectionBg>(["base", "soft", "surface", ...moments, "accent", "dark", "pop"])];
  return order.find((bg) => allowed.has(bg) && bg !== prev && bg !== next) ?? order.find((bg) => allowed.has(bg)) ?? "base";
}

/* ------------------------------------------------------------------ */
/* instances                                                           */
/* ------------------------------------------------------------------ */

/** Default data of a section for this page (validated so schema defaults are applied). */
export function defaultData(def: AnySectionDefinition, doc: PageDoc, id: string): Record<string, unknown> {
  let raw: unknown = {};
  try {
    raw = sectionDefaults(def, doc, id);
  } catch {
    raw = {};
  }
  const parsed = def.schema.safeParse(raw);
  const data = parsed.success ? parsed.data : raw;
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
}

export interface InsertPlan {
  section: SectionInstance;
  index: number;
}

/**
 * A new section of `type` and where it goes: top-bar sections at the top, footer/floating at the
 * end, page sections right after `afterId` (when it is a page section) or before the footer.
 */
export function planInsert(doc: PageDoc, type: string, opts: { variant?: string; afterId?: string | null } = {}): InsertPlan | null {
  const def = getSection(type);
  if (!def || addBlocker(doc, type)) return null;
  const variant = opts.variant && def.variants.some((v) => v.id === opts.variant) ? opts.variant : preferredVariant(def, doc);
  const id = newSectionId(type, new Set(doc.sections.map((s) => s.id)));
  const zone = zoneOf(type);
  const list = doc.sections;

  let index: number;
  if (zone === "top") {
    index = type === "header" ? list.filter((s) => zoneOf(s.type) === "top").length : 0;
  } else if (zone === "end") {
    index = getSection(type)?.category === "floating" ? list.length : list.filter((s) => zoneOf(s.type) !== "end").length;
  } else {
    const after = opts.afterId ? list.findIndex((s) => s.id === opts.afterId) : -1;
    const lastMain = list.reduce((acc, s, i) => (zoneOf(s.type) === "end" ? acc : i), -1);
    index = after >= 0 && zoneOf(list[after]!.type) === "main" ? after + 1 : lastMain + 1;
  }

  const inFlow = (s: SectionInstance | undefined) => (s && zoneOf(s.type) === "main" ? s.bg : undefined);
  const bg = zone === "main" ? pickBackground(doc, def, variant, inFlow(list[index - 1]), inFlow(list[index])) : allowedBgs(def, variant)[0]!;

  return {
    index,
    section: {
      id,
      type,
      variant,
      bg,
      divider: "auto",
      spacing: "normal",
      hidden: false,
      data: defaultData(def, doc, id),
    },
  };
}

/** Deep copy of a section with a fresh id (null for singletons, which cannot be duplicated). */
export function duplicateOf(doc: PageDoc, id: string): InsertPlan | null {
  const index = doc.sections.findIndex((s) => s.id === id);
  const src = doc.sections[index];
  const def = src ? getSection(src.type) : undefined;
  if (!src || !def || def.singleton || doc.sections.length >= 60) return null;
  const copy: SectionInstance = structuredClone(src);
  copy.id = newSectionId(src.type, new Set(doc.sections.map((s) => s.id)));
  return { section: copy, index: index + 1 };
}

/** Index range [start, end) of the zone a section lives in (moves never cross zones). */
export function zoneRange(doc: PageDoc, id: string): [number, number] | null {
  const s = doc.sections.find((x) => x.id === id);
  if (!s) return null;
  const zone = zoneOf(s.type);
  let start = -1;
  let end = -1;
  doc.sections.forEach((x, i) => {
    if (zoneOf(x.type) !== zone) return;
    if (start < 0) start = i;
    end = i + 1;
  });
  return [start, end];
}

export const isRequired = (type: string) => getSection(type)?.required === true;
export const isSingleton = (type: string) => getSection(type)?.singleton === true;
