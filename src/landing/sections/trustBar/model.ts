/**
 * Trust bar data model: 2–5 promises (icon · short promise · optional detail line · optional
 * short ring text for the badges), an accessible heading that can also be shown, and the ribbon
 * pace. Empty promises are skipped at render time (the editor may leave one blank while typing).
 */
import { z } from "zod";
import { ICON_NAMES, type IconName } from "@/landing/primitives";
import type { RenderContext, SectionBg } from "../../types";

const IconField = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

export const Item = z.object({
  icon: IconField.default("check"),
  /** the promise itself — short and true ("Paiement à la livraison") */
  title: z.string().trim().max(60).default(""),
  /** optional second line that makes it concrete ("Vous payez en espèces, au livreur.") */
  detail: z.string().trim().max(90).default(""),
  /** badges variant: the words running around the ring; empty = the promise */
  badge: z.string().trim().max(28).default(""),
});

export const schema = z.object({
  /** names the section for screen readers; shown when showTitle is on */
  title: z.string().trim().max(80).default(""),
  showTitle: z.boolean().default(false),
  items: z.array(Item).min(2).max(5),
  /** ribbon scroll pace; auto = the archetype's tempo */
  speed: z.enum(["auto", "slow", "normal", "fast"]).default("auto"),
});

export type Data = z.infer<typeof schema>;

/** One promise ready to render (`i` = index in data.items, for edit paths). */
export interface Claim {
  i: number;
  icon: IconName;
  title: string;
  detail: string;
  ring: string;
}

/** Longest ring phrase that stays legible around a medal (= the badge field max). */
const RING_MAX = 28;
/** Short function words a phrase must not end on ("Livraison express en 24 à" → "… en 24"). */
const DANGLING = new Set([
  ...["à", "a", "au", "aux", "de", "des", "du", "en", "et", "ou", "la", "le", "les", "l'", "d'", "un", "une", "sur", "sous", "par", "pour", "dans", "avec", "sans", "chez", "avant", "après", "dès", "jusqu'à", "tout", "toute", "tous", "toutes", "chaque"],
  ...["the", "and", "or", "for", "in", "of", "to", "on", "at", "by", "with", "without", "within", "before", "after", "until", "all", "every"],
  ...["في", "فـ", "من", "إلى", "على", "و", "أو", "ولا", "مع", "عند", "خلال", "قبل", "بعد", "حتى", "بلا", "بدون", "جميع", "لجميع", "كل", "لكل", "بكل"],
]);

/**
 * Ring words (the badge text, else the promise) as plain text. A phrase too long to stay legible
 * on the ring keeps its opening words up to RING_MAX characters, never ending on a dangling
 * preposition or punctuation — the full promise is always printed under the medal.
 */
export function ringOf(text: string): string {
  const plain = text.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  if (plain.length <= RING_MAX) return plain;
  const words = plain.split(" ");
  const out: string[] = [];
  for (const w of words) {
    if ([...out, w].join(" ").length > RING_MAX) break;
    out.push(w);
  }
  while (out.length > 1 && DANGLING.has(out[out.length - 1]!.toLowerCase().replace(/[,;:.!?،؛]+$/, ""))) out.pop();
  const ring = out.join(" ").replace(/[\s,;:.!?،؛–—-]+$/, "");
  return ring || plain.slice(0, RING_MAX);
}

/** U+2060 WORD JOINER, and a numeric range's dash between two digits (hyphen, en dash, em dash…). */
const JOINER = String.fromCharCode(0x2060);
const RANGE_DASH = new RegExp(`(\\d)([${String.fromCharCode(0x2010)}-${String.fromCharCode(0x2015)}-])(?=\\d)`, "g");

/**
 * A numeric range ("24–48h", "3-5 jours") never breaks at its dash: a WORD JOINER (U+2060) follows
 * the dash. For left-to-right pages only — on RTL pages the kit already sets every numeric run as
 * one unbreakable left-to-right isolate (and the joiner would split its pattern).
 */
export const glueRanges = (text: string, dir: "ltr" | "rtl"): string =>
  dir === "rtl" ? text : text.replace(RANGE_DASH, `$1$2${JOINER}`);

/** Non-empty promises, in order. */
export function claimsOf(data: Data): Claim[] {
  return data.items.flatMap((it, i) => {
    const title = it.title.trim();
    if (!title) return [];
    return [{ i, icon: it.icon, title, detail: it.detail.trim(), ring: ringOf(it.badge.trim() || title) }];
  });
}

export interface ViewProps {
  id: string;
  bg: SectionBg;
  data: Data;
  ctx: RenderContext;
  claims: Claim[];
  /** id of the h2, or undefined when the section is named by aria-label */
  titleId?: string;
}
