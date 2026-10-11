/**
 * Problem — data model shared by the four views (kept apart from index.tsx so the view modules can
 * import the type without a cycle).
 */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { opt } from "../benefits/kit";

const Pain = z.object({
  /** what the shopper lives today */
  text: z.string().min(1).max(120),
  /** what changes with the product (the "with" panel of the split view) */
  fix: opt(120),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  pains: z.array(Pain).min(2).max(5),
  /** the turn: one line that names the product */
  solution: opt(200),
  /** short label of the turn ("Fini, tout ça."), a glass chip in the chat view */
  note: opt(40),
  image: AssetRef.optional(),
  quote: opt(240),
  quoteCite: opt(80),
  withoutLabel: opt(40),
  withLabel: opt(40),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
});

export type ProblemData = z.infer<typeof schema>;

export interface ViewProps {
  ctx: RenderContext;
  data: ProblemData;
  id: string;
  bg: SectionBg;
  titleId: string;
}
