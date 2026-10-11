/**
 * Story — data model shared by the three views (kept apart from index.tsx so the view modules can
 * import the types without a cycle).
 *
 * The story is merchant content: who made the product and why. Defaults are product-aware samples
 * flagged `sample: true`; nothing personal is invented — when no signature is typed the note is
 * signed by the store itself ("L'équipe Dar Argane"), and the place falls back to the store city.
 */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { opt } from "../benefits/kit";

/** A short fact under the story: a big value and what it means ("10 s" · "pour l'appliquer"). */
const Fact = z.object({
  value: z.string().min(1).max(24),
  label: z.string().min(1).max(60),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  /** the story itself — paragraphs and line breaks allowed */
  text: z.string().max(900).default(""),
  /** one big line for the manifesto layout (words light up as the page scrolls) */
  statement: opt(260),
  /** main photo (image & text, manifesto); defaults to the product photos */
  image: AssetRef.optional(),
  /** founder portrait or brand mark next to the signature; defaults to the store logo, then initials */
  portrait: AssetRef.optional(),
  /** who signs; empty → "<store> team" */
  signature: opt(60),
  /** under the signature, e.g. "Fondatrice"; empty → the store city */
  role: opt(80),
  /** location chip on the photo, e.g. "Essaouira"; empty → the store city */
  place: opt(48),
  /** a closing line after the note, introduced by a small "P.S." */
  ps: opt(160),
  facts: z.array(Fact).max(3).default([]),
  cta: z.boolean().default(false),
  ctaLabel: opt(60),
  /** true while the story is the built-in sample (the admin asks for the real one) */
  sample: z.boolean().default(false),
});

export type StoryData = z.infer<typeof schema>;
export type StoryFact = z.infer<typeof Fact>;

export interface ViewProps {
  ctx: RenderContext;
  data: StoryData;
  id: string;
  bg: SectionBg;
  titleId: string;
}
