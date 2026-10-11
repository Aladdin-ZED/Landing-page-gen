/**
 * Specs data contract — shared by every variant. Field names are part of saved pages (and the
 * generator writes kicker / title): extend, never rename.
 *
 *  rows        the specification sheet (label → value): sheet rows, the spec card's grid, and the
 *              content of any group whose kind is "specs"
 *  groups      tabs (tabs variant) and expanding groups (accordion variant): free text, or the rows
 *  highlights  short attribute chips ("Sans parabènes")
 */
import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import { IconField, opt } from "../benefits/kit";

export const Row = z.object({
  label: z.string().min(1).max(40),
  value: z.string().min(1).max(90),
});

export const GROUP_KINDS = ["text", "specs"] as const;

export const Group = z.object({
  /** tab / group title — keep it short, it sits in a pill on phones */
  title: z.string().min(1).max(32),
  icon: IconField.default("info"),
  /** text: the body below · specs: the spec rows (the body, when set, is a short intro above them) */
  kind: z.enum(GROUP_KINDS).default("text"),
  /** block text: paragraphs, "- " bullets, *emphasis*, **strong** */
  body: z.string().max(1200).default(""),
});

export const Highlight = z.object({
  text: z.string().min(1).max(32),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  /** product visual — falls back to the cutout, then the product photos */
  image: AssetRef.optional(),
  rows: z.array(Row).min(1).max(14),
  groups: z.array(Group).min(1).max(6),
  highlights: z.array(Highlight).max(6).default([]),
  /** small footnote under the specs ("Valeurs mesurées en laboratoire") */
  note: opt(160),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
  /** the defaults are typical figures for the category: on until the merchant has checked them */
  sample: z.boolean().default(false),
});

export type Data = z.infer<typeof schema>;
export type RowData = Data["rows"][number];
export type GroupData = Data["groups"][number];
