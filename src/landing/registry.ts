/**
 * Section registry — the catalog the builder, generator and renderer use.
 * Order here = order in the "Add section" library.
 */
import type { AnySectionDefinition } from "./types";
import announcement from "./sections/announcement";
import header from "./sections/header";
import hero from "./sections/hero";
import trustBar from "./sections/trustBar";
import marquee from "./sections/marquee";
import problem from "./sections/problem";
import benefits from "./sections/benefits";
import showcase from "./sections/showcase";
import steps from "./sections/steps";
import story from "./sections/story";
import gallery from "./sections/gallery";
import video from "./sections/video";
import beforeAfter from "./sections/beforeAfter";
import comparison from "./sections/comparison";
import specs from "./sections/specs";
import reviews from "./sections/reviews";
import socialProof from "./sections/socialProof";
import stats from "./sections/stats";
import offer from "./sections/offer";
import urgency from "./sections/urgency";
import guarantee from "./sections/guarantee";
import orderForm from "./sections/orderForm";
import cta from "./sections/cta";
import faq from "./sections/faq";
import footer from "./sections/footer";
import stickyCta from "./sections/stickyCta";
import whatsappFloat from "./sections/whatsappFloat";

export const SECTIONS: AnySectionDefinition[] = [
  announcement,
  header,
  hero,
  trustBar,
  marquee,
  problem,
  benefits,
  showcase,
  steps,
  story,
  gallery,
  video,
  beforeAfter,
  comparison,
  specs,
  reviews,
  socialProof,
  stats,
  offer,
  urgency,
  guarantee,
  orderForm,
  cta,
  faq,
  footer,
  stickyCta,
  whatsappFloat,
];

const BY_TYPE = new Map<string, AnySectionDefinition>(SECTIONS.map((s) => [s.type, s]));

export function getSection(type: string): AnySectionDefinition | undefined {
  return BY_TYPE.get(type);
}

export const SECTION_TYPES = SECTIONS.map((s) => s.type);
