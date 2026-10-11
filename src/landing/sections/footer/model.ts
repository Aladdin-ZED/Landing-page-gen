/** Footer data model (zod v4) — shared by the section definition and both variants. */
import { z } from "zod";
import { ICON_NAMES, type IconName } from "../../primitives";

/** Icon from the custom landing set. */
export const IconField = z.enum(ICON_NAMES as [IconName, ...IconName[]]);

export const PromiseItem = z.object({
  icon: IconField.default("check"),
  text: z.string().max(60).default(""),
});

export const FooterSchema = z.object({
  /** short brand line under the wordmark (simple) / under the closing statement (big) */
  tagline: z.string().max(160).default(""),
  /** big: the closing statement (h2) above the contact buttons */
  heading: z.string().max(90).default(""),
  /** the COD reassurance line, shown in a capsule */
  cod: z.string().max(100).default(""),
  /** big: "Your order" column — real promises only (COD, delivery, check before paying, exchange) */
  promises: z.array(PromiseItem).max(4).default([]),
  /** big: the giant word across the bottom edge — empty = the store name */
  wordmark: z.string().max(28).default(""),
  showContact: z.boolean().default(true),
  showAddress: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  backToTop: z.boolean().default(true),
});

export type FooterData = z.infer<typeof FooterSchema>;
