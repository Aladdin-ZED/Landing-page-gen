/**
 * Copy contracts shared by the local AI (browser worker), the fallback copy library and the generator.
 *
 *  - PageCopy  every text the generator places on a page, for ONE locale. The hand-written library
 *              always produces a complete PageCopy; AI output is merged over it field by field.
 *  - AiCopy    the compact JSON the language model writes (one constrained call per locale).
 *              `AI_COPY_JSON_SCHEMA` is the same contract as JSON Schema for constrained decoding —
 *              only keywords the structured-output engine supports (no `pattern`, no `format`).
 *  - Analysis  what the vision model reads from the product photos.
 *
 * Pure & isomorphic (server, browser, worker). Text never contains HTML: only the landing kit's
 * inline markup (*emphasis*, **strong**), which the renderer escapes and interprets.
 */
import { z } from "zod";
import { PRODUCT_CATEGORIES, type ProductCategory } from "@/lib/page/schema";
import { ICON_NAMES, type IconName } from "@/landing/primitives/icons";

/* ------------------------------------------------------------------ */
/* Tiny dual builder: one declaration → zod schema + JSON Schema       */
/* ------------------------------------------------------------------ */

type Json = { [k: string]: unknown };
interface Spec<T extends z.ZodTypeAny> {
  zod: T;
  json: Json;
}

const str = (max: number, min = 1): Spec<z.ZodString> => ({
  zod: z.string().trim().min(min).max(max),
  json: { type: "string", minLength: min, maxLength: max },
});

const oneOf = <const V extends readonly [string, ...string[]]>(values: V): Spec<z.ZodEnum<{ [K in V[number]]: K }>> => ({
  zod: z.enum(values),
  json: { type: "string", enum: [...values] },
});

const arr = <T extends z.ZodTypeAny>(item: Spec<T>, min: number, max: number): Spec<z.ZodArray<T>> => ({
  zod: z.array(item.zod).min(min).max(max),
  json: { type: "array", items: item.json, minItems: min, maxItems: max },
});

const obj = <S extends Record<string, Spec<z.ZodTypeAny>>>(shape: S): Spec<z.ZodObject<{ [K in keyof S]: S[K]["zod"] }>> => {
  const zodShape = Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.zod])) as { [K in keyof S]: S[K]["zod"] };
  return {
    zod: z.object(zodShape),
    json: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(shape),
      properties: Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, v.json])),
    },
  };
};

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

/** Icons that make sense next to a product benefit or a step (subset of the landing icon set). */
const BENEFIT_ICON_CANDIDATES = [
  "check",
  "drop",
  "leaf",
  "sun",
  "moon",
  "flame",
  "snowflake",
  "feather",
  "gem",
  "bolt",
  "battery",
  "ruler",
  "heart",
  "hand-heart",
  "star",
  "clock",
  "eye",
  "home",
  "baby",
  "paw",
  "dumbbell",
  "waves",
  "gift",
  "lock",
  "shield-check",
  "medal",
  "box",
  "bag",
  "user",
  "asterisk",
  "thumb-up",
  "map-pin",
] as const;

export const BENEFIT_ICONS = BENEFIT_ICON_CANDIDATES.filter((n): n is (typeof BENEFIT_ICON_CANDIDATES)[number] & IconName =>
  (ICON_NAMES as readonly string[]).includes(n),
) as unknown as readonly [IconName, ...IconName[]];

export type BenefitIcon = (typeof BENEFIT_ICONS)[number];
export const isIconName = (v: unknown): v is IconName => typeof v === "string" && (ICON_NAMES as readonly string[]).includes(v);

/* ------------------------------------------------------------------ */
/* PageCopy — complete copy for one page locale                        */
/* ------------------------------------------------------------------ */

const S = (max: number) => z.string().max(max);
const Icon = z.custom<IconName>(isIconName, { error: "Unknown icon" });

export const PageCopy = z.object({
  /** one line under the product name (product.tagline, header) */
  tagline: S(90),
  hero: z.object({ kicker: S(60), headline: S(110), sub: S(220), cta: S(40), bigWord: S(16) }),
  announcement: z.array(S(60)).min(2).max(4),
  trust: z.array(z.object({ icon: Icon, text: S(56) })).min(3).max(4),
  marquee: z.array(S(28)).min(4).max(8),
  benefits: z.object({
    kicker: S(60),
    title: S(110),
    lead: S(220),
    items: z.array(z.object({ title: S(60), text: S(200), icon: Icon })).min(3).max(6),
  }),
  problem: z.object({
    kicker: S(60),
    title: S(110),
    lead: S(220),
    points: z.array(z.object({ pain: S(110), fix: S(110) })).min(2).max(5),
    solution: S(190),
  }),
  showcase: z.object({ kicker: S(60), title: S(110), lead: S(220) }),
  steps: z.object({
    kicker: S(60),
    title: S(110),
    items: z.array(z.object({ title: S(60), text: S(170), icon: Icon })).min(3).max(4),
  }),
  story: z.object({ kicker: S(60), title: S(110), text: S(700) }),
  comparison: z.object({
    title: S(110),
    us: S(30),
    them: S(30),
    rows: z.array(z.object({ label: S(70), us: S(60), them: S(60) })).min(3).max(6),
  }),
  reviews: z.object({ kicker: S(60), title: S(110) }),
  socialProof: z.object({ kicker: S(60), title: S(110) }),
  gallery: z.object({ kicker: S(60), title: S(110) }),
  specs: z.object({ kicker: S(60), title: S(110) }),
  offer: z.object({ kicker: S(60), title: S(110), lead: S(220), cta: S(40) }),
  guarantee: z.object({ kicker: S(60), title: S(110), lines: z.array(S(130)).min(2).max(4) }),
  form: z.object({ kicker: S(60), title: S(110), lead: S(220), submit: S(48), reassurance: S(150) }),
  cta: z.object({ kicker: S(60), title: S(110), text: S(200), button: S(40) }),
  faq: z.object({ kicker: S(60), title: S(110), items: z.array(z.object({ q: S(110), a: S(320) })).min(3).max(8) }),
  sticky: z.object({ label: S(36), note: S(56) }),
  whatsapp: z.object({ label: S(56), message: S(180) }),
  bundles: z.array(z.object({ title: S(50), subtitle: S(80) })).length(3),
  seo: z.object({ title: S(70), description: S(165) }),
  thankYou: z.object({ title: S(110), message: S(400) }),
});
export type PageCopy = z.infer<typeof PageCopy>;

/* ------------------------------------------------------------------ */
/* AiCopy — what the language model writes (compact keys)              */
/* ------------------------------------------------------------------ */

const AI_COPY = obj({
  tagline: str(90),
  kicker: str(56),
  headline: str(84, 8),
  sub: str(190, 20),
  cta: str(32, 3),
  benefits: arr(obj({ title: str(52, 3), text: str(170, 12), icon: oneOf(BENEFIT_ICONS) }), 4, 5),
  problem_title: str(90, 6),
  pains: arr(obj({ pain: str(100, 6), fix: str(100, 6) }), 3, 4),
  solution: str(170, 10),
  steps: arr(obj({ title: str(52, 3), text: str(150, 10) }), 3, 3),
  faq: arr(obj({ q: str(100, 8), a: str(280, 12) }), 5, 5),
  guarantee: arr(str(120, 8), 3, 3),
  cta_title: str(90, 6),
  cta_text: str(170, 10),
  story_title: str(80, 4),
  story: str(560, 60),
  comparison: arr(obj({ label: str(60, 3), us: str(50, 2), them: str(50, 2) }), 4, 4),
  announcement: arr(str(56, 4), 3, 3),
  marquee: arr(str(24, 2), 5, 6),
  seo_title: str(60, 10),
  seo_description: str(155, 40),
});

export const AiCopy = AI_COPY.zod;
export type AiCopy = z.infer<typeof AiCopy>;
/** JSON Schema of AiCopy for StructuredOutputProcessor (no pattern/format keywords). */
export const AI_COPY_JSON_SCHEMA: Json = AI_COPY.json;

/* ------------------------------------------------------------------ */
/* Vision analysis                                                     */
/* ------------------------------------------------------------------ */

/** Visual vibes, each a keyword the theme engine's vibe table understands. */
export const VIBES = ["luxury", "playful", "natural", "tech", "sport", "beauty", "home", "heritage", "minimal", "rugged", "clinical"] as const;
export type Vibe = (typeof VIBES)[number];

const ANALYSIS = obj({
  category: oneOf(PRODUCT_CATEGORIES),
  vibe: oneOf(VIBES),
  secondary_vibe: oneOf([...VIBES, "none"] as const),
  materials: arr(str(28), 0, 4),
  colors: arr(str(24), 1, 4),
  audience: str(90),
  summary: str(170, 10),
});

/** Raw model output (snake_case, as constrained). */
export const AnalysisRaw = ANALYSIS.zod;
export const ANALYSIS_JSON_SCHEMA: Json = ANALYSIS.json;

export interface Analysis {
  category: ProductCategory;
  vibe: Vibe;
  secondaryVibe: Vibe | null;
  materials: string[];
  colorsDescribed: string[];
  audience: string;
  summary: string;
}

export function toAnalysis(raw: z.infer<typeof AnalysisRaw>): Analysis {
  return {
    category: raw.category,
    vibe: raw.vibe,
    secondaryVibe: raw.secondary_vibe === "none" || raw.secondary_vibe === raw.vibe ? null : raw.secondary_vibe,
    materials: raw.materials,
    colorsDescribed: raw.colors,
    audience: raw.audience,
    summary: raw.summary,
  };
}

/** Analysis shape for values coming back from storage or a worker. */
export const AnalysisSchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES),
  vibe: z.enum(VIBES),
  secondaryVibe: z.enum(VIBES).nullable(),
  materials: z.array(z.string().max(28)).max(4),
  colorsDescribed: z.array(z.string().max(24)).max(4),
  audience: z.string().max(90),
  summary: z.string().max(170),
});

/** The vibe string handed to the theme engine (rankArchetypes / themeFromProduct `aiVibe`). */
export function vibeHint(a: Pick<Analysis, "vibe" | "secondaryVibe"> | null | undefined): string | null {
  if (!a) return null;
  return a.secondaryVibe ? `${a.vibe} ${a.secondaryVibe}` : a.vibe;
}
