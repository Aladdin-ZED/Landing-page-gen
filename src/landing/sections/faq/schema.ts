/**
 * FAQ data contract — shared by every variant. Field names are part of saved pages and the generator
 * writes `kicker`, `title` and `items[].q / items[].a` (src/lib/generator/copy-map.ts): extend, never
 * rename.
 */
import { z } from "zod";

/** Optional copy: plain string with a max length, empty by default (empty = hidden / built-in text). */
const opt = (max: number) => z.string().max(max).default("");

export const Item = z.object({
  /** the shopper's question, in their words */
  q: z.string().min(1).max(160),
  /** the answer — block text: paragraphs, "- " bullets, *emphasis*, **strong** */
  a: z.string().min(1).max(700),
});

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  items: z.array(Item).min(1).max(10),
  /** accordion: the first answer starts open (one answer open at a time) */
  openFirst: z.boolean().default(true),
  /** "Still a question?" line with a WhatsApp (else phone) button — hidden when the store has neither */
  help: z.boolean().default(true),
  helpTitle: opt(80),
  helpText: opt(160),
  /** button label; empty → the channel's own label ("Écrire sur WhatsApp" / "Nous appeler") */
  helpLabel: opt(40),
  /** the default answers state delivery times and an exchange window: on until the merchant checks them */
  sample: z.boolean().default(false),
});

export type Data = z.infer<typeof schema>;
export type ItemData = Data["items"][number];
