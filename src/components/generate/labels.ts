/**
 * Display names for the generator wizard (admin UI is English): product categories, page languages,
 * AI stages and byte sizes.
 */
import type { AiProgress } from "@/lib/ai/client";
import type { ProductCategory } from "@/lib/page/schema";

export const CATEGORY_LABELS: Readonly<Record<ProductCategory, string>> = {
  beauty: "Beauty & makeup",
  skincare: "Skincare",
  haircare: "Haircare",
  fragrance: "Fragrance",
  jewelry: "Jewelry",
  watches: "Watches",
  fashion: "Fashion",
  bags: "Bags",
  health: "Health & wellness",
  supplements: "Supplements",
  fitness: "Fitness",
  sport: "Sport",
  kitchen: "Kitchen",
  home: "Home",
  cleaning: "Cleaning",
  decor: "Decor",
  kids: "Kids",
  toys: "Toys",
  pets: "Pets",
  tech: "Tech",
  gadgets: "Gadgets",
  car: "Car",
  tools: "Tools",
  grooming: "Grooming",
  "organic-food": "Organic food",
  traditional: "Traditional",
  garden: "Garden",
  other: "Other",
};

/** Category picker groups (same order as the copy library families). */
export const CATEGORY_GROUPS: readonly { label: string; items: readonly ProductCategory[] }[] = [
  { label: "Beauty", items: ["beauty", "skincare", "haircare", "fragrance"] },
  { label: "Style", items: ["jewelry", "watches", "fashion", "bags"] },
  { label: "Wellness & sport", items: ["health", "supplements", "fitness", "sport"] },
  { label: "Home", items: ["kitchen", "home", "cleaning", "decor", "garden"] },
  { label: "Family", items: ["kids", "toys", "pets"] },
  { label: "Tech & tools", items: ["tech", "gadgets", "car", "tools", "grooming"] },
  { label: "Food & tradition", items: ["organic-food", "traditional"] },
  { label: "Other", items: ["other"] },
];

export const PAGE_LOCALES = [
  { value: "ar", label: "العربية", hint: "Arabic · RTL" },
  { value: "fr", label: "Français", hint: "French" },
  { value: "en", label: "English", hint: "English" },
] as const;
export type PageLocale = (typeof PAGE_LOCALES)[number]["value"];

export const VIBE_LABELS: Readonly<Record<string, string>> = {
  luxury: "Luxury",
  playful: "Playful",
  natural: "Natural",
  tech: "Tech",
  sport: "Sport",
  beauty: "Beauty",
  home: "Home",
  heritage: "Heritage",
  minimal: "Minimal",
  rugged: "Rugged",
  clinical: "Clinical",
};

const STAGE_LABELS: Readonly<Record<AiProgress["stage"], string>> = {
  "load-classifier": "Downloading the photo reader",
  classify: "Reading your photos",
  "load-vlm": "Downloading the language model",
  analyze: "Studying the product",
  write: "Writing the copy",
  "load-matting": "Downloading the cutout model",
  matting: "Cutting out the product",
};

export const stageLabel = (stage: AiProgress["stage"]) => STAGE_LABELS[stage] ?? "Working";

/** True when `loaded/total` are bytes of a download (not generated tokens). */
export const isDownload = (p: AiProgress | null) => !!p && p.stage.startsWith("load-");

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 MB";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(n >= 10 * 1024 ** 3 ? 0 : 1)} GB`;
  return `${Math.max(1, Math.round(n / 1024 ** 2))} MB`;
}

/** 0..1 progress of a job, or null when indeterminate. */
export function progressRatio(p: AiProgress | null): number | null {
  if (!p || !p.total || p.loaded === undefined) return null;
  return Math.min(1, Math.max(0, p.loaded / p.total));
}

/** "Downloading the language model · 412 MB of 900 MB" / "Writing the copy · 40%". */
export function progressText(p: AiProgress | null): string {
  if (!p) return "";
  const label = stageLabel(p.stage);
  const ratio = progressRatio(p);
  if (ratio === null) return `${label}…`;
  if (isDownload(p)) return `${label} · ${formatBytes(p.loaded ?? 0)} of ${formatBytes(p.total ?? 0)}`;
  return `${label} · ${Math.round(ratio * 100)}%`;
}
