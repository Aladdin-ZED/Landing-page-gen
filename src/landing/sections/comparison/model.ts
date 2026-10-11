/**
 * Comparison — data model shared by the three views (kept apart from index.tsx so the view modules
 * can import the types without a cycle). Field names match the generator's copy map
 * (src/lib/generator/copy-map.ts: title · usLabel · themLabel · rows[label, us, them]).
 */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { opt } from "../benefits/kit";

const Row = z.object({
  /** the criterion: "Texture", "Paiement", "قبل الدفع" */
  label: z.string().min(1).max(60),
  /** what the shopper gets here (empty → the check mark alone says it) */
  us: opt(80),
  /** what the usual alternative gives (empty → the cross alone says it) */
  them: opt(80),
  /** the alternatives do it only partly: a half mark instead of a cross, never struck through */
  partial: z.boolean().default(false),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(240),
  usLabel: z.string().min(1).max(40),
  themLabel: z.string().min(1).max(40),
  rows: z.array(Row).min(3).max(7),
  /** our side's visual; defaults to the product cutout / photos */
  image: AssetRef.optional(),
  /** text of the versus disc */
  vs: z.string().max(6).default("VS"),
  /** honest footnote: what "the alternatives" are */
  note: opt(160),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
});

export type ComparisonData = z.infer<typeof schema>;
export type ComparisonRow = ComparisonData["rows"][number];

export interface ViewProps {
  ctx: RenderContext;
  data: ComparisonData;
  id: string;
  bg: SectionBg;
  titleId: string;
}
