/** Steps — data model shared by the section definition and its four compositions. */
import { z } from "zod";
import { AssetRef, type SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { IconField, opt } from "../benefits/kit";

export const Step = z.object({
  icon: IconField.default("check"),
  title: z.string().min(1).max(70),
  text: opt(180),
  /** how long the gesture takes: "30 s", "2 min" */
  time: opt(16),
  image: AssetRef.optional(),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  steps: z.array(Step).min(2).max(5),
  /** timeline: photo beside the rail on wide screens (falls back to the product photos) */
  image: AssetRef.optional(),
  media: z.boolean().default(true),
  note: opt(80),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
});

export type Data = z.infer<typeof schema>;
export type StepItem = Data["steps"][number];

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  /** section id (anchors, uids) */
  id: string;
  titleId: string;
  bg: SectionBg;
}
