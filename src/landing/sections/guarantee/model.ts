/**
 * Guarantee — data model shared by the three views (kept apart from index.tsx so the views import
 * the types without a cycle). Field names follow the generator's copy map
 * (src/lib/generator/copy-map.ts: kicker · title · promises[{ text, icon }]): generated one-line
 * promises land in `text` with an empty `title`, so every view renders a promise from either field.
 */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import { ICON_NAMES, type IconName } from "@/landing/primitives";
import type { RenderContext } from "../../types";

/** Plain string with a max length and an empty default (optional copy). */
const opt = (max: number) => z.string().max(max).default("");

const IconField = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

const PromiseItem = z.object({
  icon: IconField.default("check"),
  /** short promise: “Payez à la réception” */
  title: opt(70),
  /** one concrete sentence under it */
  text: opt(170),
});

/** What sits in the middle of the badge: “0 DH / d'avance”, a check mark, or the merchant's own word. */
export const BADGE_CENTERS = ["zero", "check", "text"] as const;

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  promises: z.array(PromiseItem).min(2).max(4),
  /** badge ring text: 1–4 short phrases separated by “·” (empty → the promise titles) */
  ring: opt(110),
  badgeCenter: z.enum(BADGE_CENTERS).default("zero"),
  badgeLabel: opt(10),
  badgeSub: opt(22),
  /** split: the photo (defaults to the product photos) */
  image: AssetRef.optional(),
  /** split: frosted chip over the photo with the live price, payable at the door */
  priceChip: z.boolean().default(true),
  /** letter: who signs the promise (empty → the store name) */
  signName: opt(60),
  signRole: opt(60),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
  /** small link to the delivery & returns policy page */
  policyLink: z.boolean().default(true),
});

export type GuaranteeData = z.infer<typeof schema>;
export type PromiseData = GuaranteeData["promises"][number];

export interface ViewProps {
  ctx: RenderContext;
  data: GuaranteeData;
  id: string;
  bg: SectionBg;
  titleId: string;
}

/** A promise ready to render: `head` is the bold line, `body` the optional sentence under it. */
export interface PromiseLine {
  icon: IconName;
  head: string;
  body: string;
  /** the bold line is the merchant's short title (not a lone sentence) */
  titled: boolean;
  /** data path of each part (click-to-edit) */
  headPath: string;
  bodyPath: string | undefined;
}

/** Promises with something to say; a text-only promise (generated copy) becomes the bold line. */
export function promiseLines(data: GuaranteeData): PromiseLine[] {
  const out: PromiseLine[] = [];
  data.promises.forEach((p, i) => {
    const title = p.title.trim();
    const text = p.text.trim();
    if (!title && !text) return;
    out.push({
      icon: p.icon,
      head: title || text,
      body: title ? text : "",
      titled: !!title,
      headPath: `promises.${i}.${title ? "title" : "text"}`,
      bodyPath: title && text ? `promises.${i}.text` : undefined,
    });
  });
  return out;
}

/** Badge ring phrases: the merchant's “·”-separated text, else the short promise lines. */
export function ringPhrases(data: GuaranteeData, lines: readonly PromiseLine[]): string[] {
  const own = data.ring
    .split(/\s*[·•|]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (own.length) return own.slice(0, 4);
  return lines
    .map((l) => l.head.replace(/[.!؟?:،,;]+$/u, "").trim())
    .filter((s) => s.length > 0 && s.length <= 34)
    .slice(0, 3);
}

/**
 * French typography: a no-break space before ? ! : ; » and after « (a lone “?” never wraps to the
 * next line). Other languages pass through unchanged.
 */
export function typo(locale: string, text: string): string {
  if (locale !== "fr") return text;
  return text.replace(/[ \u00a0\u202f]+([?!:;»])/g, "\u00a0$1").replace(/«[ \u00a0\u202f]+/g, "«\u00a0");
}

/**
 * Display typography over every string of a section's data (arrays and plain objects; anything else
 * untouched), for sections that render many merchant-typed fields (FAQ, comparison, specs, story):
 * French punctuation spacing (typo()), and in every language a number glued to the word after it, so
 * “6 vitesses” or “30 مل” never splits across a line end. The editor keeps the stored text.
 */
export function typoDeep<T>(locale: string, value: T): T {
  const fix = (s: string): string => typo(locale, s).replace(/(\d) (?=\p{L})/gu, "$1\u00a0");
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return fix(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  return walk(value) as T;
}


/**
 * Does a product's short name sit well inside a display title on this page? Only when short and
 * written in the page's own script: a Latin name in an Arabic headline ("Abaya de prière: هنا أو في
 * مكان آخر") breaks into a mixed-direction poster. Default-copy pickers drop their {short} titles
 * otherwise (comparison, specs, story).
 */
export function nameFitsTitle(locale: string, short: string): boolean {
  const arabic = /[؀-ۿ]/.test(short);
  const latin = /[A-Za-zÀ-ɏ]/.test(short);
  return short.length <= 22 && (locale === "ar" ? arabic && !latin : !arabic);
}

/** Initial for the monogram disc (first letter of the first word, any script). */
export function initialOf(name: string): string {
  const m = /\p{L}|\p{N}/u.exec(name.trim());
  return m ? m[0].toLocaleUpperCase() : "·";
}
