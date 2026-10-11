/**
 * Zero-shot vocabulary for the instant photo classifier (SigLIP). Prompts are short and visual —
 * SigLIP's text tower is limited to ~64 tokens and works best with concrete nouns.
 */
import type { ProductCategory } from "@/lib/page/schema";
import type { Vibe } from "./copy-schema";

/** "a product photo of {prompt}" for every product category. */
export const CATEGORY_PROMPTS: Readonly<Record<ProductCategory, string>> = {
  beauty: "makeup or a beauty cosmetic",
  skincare: "a skincare cream, serum or face oil bottle",
  haircare: "a hair care product or a hair styling tool",
  fragrance: "a perfume bottle",
  jewelry: "jewelry such as a necklace, ring, bracelet or earrings",
  watches: "a wristwatch",
  fashion: "clothing or shoes",
  bags: "a handbag, wallet or backpack",
  health: "a health care or body care device",
  supplements: "vitamins or dietary supplement capsules",
  fitness: "fitness or massage equipment",
  sport: "sports gear or outdoor equipment",
  kitchen: "a kitchen appliance, cookware or kitchen utensil",
  home: "a home accessory or small furniture",
  cleaning: "a cleaning tool or household cleaning product",
  decor: "a decorative lamp, vase or home decor object",
  kids: "a baby or children's product",
  toys: "a toy",
  pets: "a pet accessory for a dog or a cat",
  tech: "an electronic device or accessory",
  gadgets: "a small smart gadget",
  car: "a car accessory",
  tools: "a hand tool or a power tool",
  grooming: "a beard trimmer, shaver or men's grooming product",
  "organic-food": "honey, oil, spices or natural food in a jar",
  traditional: "a traditional Moroccan handicraft or garment",
  garden: "a garden tool or a plant product",
  other: "an everyday object",
};

/** "a photo of {prompt}" for each visual vibe (keywords understood by the theme engine). */
export const VIBE_PROMPTS: Readonly<Record<Vibe, string>> = {
  luxury: "an elegant luxury product, dark background, gold accents",
  playful: "a colorful, fun and playful product",
  natural: "an organic natural product with plants and earthy tones",
  tech: "a sleek modern high-tech gadget",
  sport: "an energetic sporty athletic product",
  beauty: "a soft pastel beauty and self-care product",
  home: "a cozy warm home product",
  heritage: "a traditional handcrafted artisanal product",
  minimal: "a clean minimalist product on a plain background",
  rugged: "a rugged industrial tool or heavy-duty product",
  clinical: "a clean clinical pharmacy product",
};

export const CATEGORY_TEMPLATE = "a product photo of {}";
export const VIBE_TEMPLATE = "a photo of {}";
