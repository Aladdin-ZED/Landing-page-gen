/**
 * Legal document model — structured, framework-free content rendered by LegalBody.tsx.
 * Text is plain strings (React escapes them); links are built here from validated store data only.
 */
import type { LegalKind } from "../context";

export type { LegalKind } from "../context";

/** One run of inline content. `ph` = information the merchant still has to provide (shown as a marked gap). */
export type Inline =
  | string
  | { kind: "b"; text: string }
  | { kind: "ph"; label: string }
  | { kind: "link"; text: string; href: string; external?: boolean };

export type Block =
  | { kind: "p"; content: Inline[] }
  | { kind: "list"; items: Inline[][] }
  /** label → value ledger (identity, delivery facts) */
  | { kind: "facts"; rows: { label: string; value: Inline[] }[] }
  | { kind: "callout"; icon: "cash-hand" | "shield-check" | "info" | "return" | "truck"; content: Inline[] };

export interface LegalSection {
  /** anchor id (ASCII, unique in the document) */
  id: string;
  title: string;
  blocks: Block[];
}

export interface LegalText {
  kind: LegalKind;
  title: string;
  /** "in short" lines shown in the hero card */
  summary: Inline[][];
  sections: LegalSection[];
}

/** Page chrome strings of the legal documents. */
export interface LegalChrome {
  kicker: string;
  updated: string;
  toc: string;
  inShort: string;
  back: string;
  questions: string;
  questionsText: string;
  whatsapp: string;
  call: string;
  email: string;
  /** prefix read by screen readers before a gap the merchant must complete */
  todo: string;
  documents: string;
  identity: string;
  cod: string;
}

export const b = (text: string): Inline => ({ kind: "b", text });
export const ph = (label: string): Inline => ({ kind: "ph", label });
export const link = (text: string, href: string, external = false): Inline => ({ kind: "link", text, href, external });
export const p = (...content: Inline[]): Block => ({ kind: "p", content });
export const list = (...items: Inline[][]): Block => ({ kind: "list", items });
export const callout = (icon: Extract<Block, { kind: "callout" }>["icon"], ...content: Inline[]): Block => ({ kind: "callout", icon, content });

/** Every gap left in a document (admin warnings: "complete your store details"). */
export function gapsOf(text: LegalText): string[] {
  const out = new Set<string>();
  const scan = (xs: readonly Inline[]) => {
    for (const x of xs) if (typeof x !== "string" && x.kind === "ph") out.add(x.label);
  };
  for (const line of text.summary) scan(line);
  for (const s of text.sections) {
    for (const blk of s.blocks) {
      if (blk.kind === "p" || blk.kind === "callout") scan(blk.content);
      else if (blk.kind === "list") blk.items.forEach(scan);
      else blk.rows.forEach((r) => scan(r.value));
    }
  }
  return [...out];
}
