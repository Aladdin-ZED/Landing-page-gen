import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import { ICON_NAMES, type IconName } from "../../primitives";

const IconId = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

/** A short product fact shown around the product: glass callout, cover line, spec label, bullet. */
export const HeroNote = z.object({
  title: z.string().min(1).max(40),
  detail: z.string().max(60).default(""),
});

export const HeroTrust = z.object({
  icon: IconId.default("check"),
  text: z.string().min(1).max(60),
});

export const HeroSchema = z.object({
  /** small line above the headline — defaults to the product name */
  kicker: z.string().max(90).default(""),
  /** h1 — supports *emphasis* and **strong** */
  title: z.string().max(140).default(""),
  subtitle: z.string().max(260).default(""),
  /** giant display word (stage, poster) */
  bigWord: z.string().max(16).default(""),
  /** editorial masthead line, e.g. "Édition 01 · Soin" */
  issue: z.string().max(60).default(""),
  ctaLabel: z.string().max(48).default(""),
  ctaPrice: z.boolean().default(false),
  showRating: z.boolean().default(true),
  /** "×2 −10% · ×3 −20%" pack teaser, computed from the real bundles */
  showTeaser: z.boolean().default(true),
  /** compact pack chips (split) */
  showBundles: z.boolean().default(true),
  /** product facts: glass callouts (stage, spec), cover lines (editorial), chips (collage), bullets (split) */
  notes: z.array(HeroNote).max(4).default([]),
  trust: z.array(HeroTrust).max(4).default([]),
  /** main visual override (default: product cutout, else first product photo) */
  image: AssetRef.optional(),
  /** extra photos for the collage and the split gallery (default: product photos) */
  images: z.array(AssetRef).max(4).default([]),
});

export type HeroData = z.infer<typeof HeroSchema>;
export type HeroNoteData = z.infer<typeof HeroNote>;
