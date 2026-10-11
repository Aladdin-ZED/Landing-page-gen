/**
 * Legal documents of a landing page (privacy, terms of sale, shipping & returns, contact).
 *
 *   <LegalBody ctx={ctx} kind="privacy" updatedAt={iso} />     (wrapped by LegalDocument in ../document)
 *   legalNav(ctx)   → [{ kind, label, href }] links to the four documents (footers, thank-you page)
 *   legalGaps(ctx)  → store details still missing ("ICE (15 chiffres)", …) for admin warnings
 * Styles: ./legal.css (compiled into legalCss by scripts/build-landing-assets.mjs).
 */
import type { RenderContext } from "../types";
import { legalTexts } from "./content";
import { gapsOf, type LegalKind } from "./model";

export { LegalBody, LEGAL_ORDER, legalNav, legalTitle, type LegalBodyProps } from "./LegalBody";
export { contactChannels, displayWhatsapp, legalChrome, legalLang, legalText, legalTexts, type LegalLang } from "./content";
export type { Block, Inline, LegalChrome, LegalKind, LegalSection, LegalText } from "./model";

/** Every gap (missing store detail) across the four documents, in the page language. */
export function legalGaps(ctx: RenderContext): string[] {
  const texts = legalTexts(ctx);
  const out = new Set<string>();
  for (const k of Object.keys(texts) as LegalKind[]) for (const g of gapsOf(texts[k])) out.add(g);
  return [...out];
}
