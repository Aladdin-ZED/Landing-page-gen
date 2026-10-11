/**
 * Generator wizard state: photos (local preview → uploaded asset), AI readings, product details and
 * the generation seed. Kept in a reducer and mirrored to sessionStorage, so a reload or a detour
 * to the media library never loses uploads or typed facts (local previews and blobs are not
 * stored; restored photos are read back from the media library).
 */
import { z } from "zod";
import type { ClassifyResult } from "@/lib/ai/client";
import { AnalysisSchema, VIBES, type Analysis } from "@/lib/ai/copy-schema";
import { MARKETS, PRODUCT_CATEGORIES, type Market, type ProductCategory } from "@/lib/page/schema";
import { ExtractedPaletteSchema, type ExtractedPalette } from "@/lib/theme";
import type { AssetRowLike } from "@/landing/context";
import type { PageLocale } from "./labels";

export const STEPS = [
  { id: "photos", label: "Photos", hint: "Drop the product" },
  { id: "analysis", label: "Analysis", hint: "What the AI sees" },
  { id: "details", label: "Details", hint: "Name, price, facts" },
  { id: "directions", label: "Directions", hint: "Pick a design" },
] as const;
export type Step = 0 | 1 | 2 | 3;

const FORMATS = ["webp", "avif", "png", "jpeg", "mp4", "webm"] as const;

/** The slice of a media-library asset the wizard keeps (= preview row + display URLs). */
export const PhotoAssetSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{16,64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alpha: z.boolean(),
  dominant: z.string().max(16),
  variants: z.array(z.object({ key: z.string().max(120), w: z.number(), h: z.number(), fmt: z.enum(FORMATS) })).max(24),
  url: z.string().max(400).nullable(),
  thumbUrl: z.string().max(400).nullable(),
});
export type PhotoAsset = z.infer<typeof PhotoAssetSchema>;

export const toAssetRow = (a: PhotoAsset): AssetRowLike => ({
  id: a.id,
  kind: "image",
  width: a.width,
  height: a.height,
  alpha: a.alpha,
  dominant: a.dominant,
  variants: a.variants,
});

/** Media API / picker JSON → PhotoAsset (null for anything unusable, e.g. a video). */
export function photoAssetFrom(raw: unknown): PhotoAsset | null {
  const r = raw as { variants?: { fmt?: string }[]; thumbUrl?: unknown; kind?: unknown } | null;
  if (!r || r.kind === "video") return null;
  const parsed = PhotoAssetSchema.safeParse({
    ...r,
    variants: (r.variants ?? []).filter((v) => (FORMATS as readonly string[]).includes(String(v?.fmt))),
    thumbUrl: typeof r.thumbUrl === "string" ? r.thumbUrl : null,
  });
  return parsed.success ? parsed.data : null;
}

export type PhotoStatus = "preparing" | "uploading" | "processing" | "ready" | "error";

export interface Photo {
  key: string;
  name: string;
  /** local object URL while this tab lives, else the asset thumbnail */
  preview: string | null;
  status: PhotoStatus;
  /** upload transfer 0..1 */
  progress: number;
  error?: string;
  width: number;
  height: number;
  palette: ExtractedPalette | null;
  asset: PhotoAsset | null;
}

export interface Cutout {
  asset: PhotoAsset;
  /** key of the photo it was cut from */
  sourceKey: string;
  palette: ExtractedPalette | null;
  /** use it as the product cutout (hero stage) */
  use: boolean;
}

export interface Details {
  name: string;
  /** raw input text (validated when generating) */
  price: string;
  category: ProductCategory;
  /** the admin picked the category (AI guesses no longer override it) */
  categoryTouched: boolean;
  facts: string[];
  locale: PageLocale;
  market: Market;
  /** write the copy with the on-device language model */
  aiCopy: boolean;
}

export interface WizardState {
  step: Step;
  /** furthest step reached (the rail lets the admin jump back and forth up to it) */
  reached: Step;
  photos: Photo[];
  mainKey: string | null;
  cutout: Cutout | null;
  /** AI readings, keyed by the photo set they were made from */
  classify: { key: string; result: ClassifyResult } | null;
  analysis: { key: string; result: Analysis } | null;
  details: Details;
  seedBase: number;
}

export type Action =
  | { type: "goto"; step: Step }
  | { type: "addPhotos"; photos: Photo[] }
  | { type: "patchPhoto"; key: string; patch: Partial<Photo> }
  | { type: "uploaded"; key: string; asset: PhotoAsset }
  | { type: "removePhoto"; key: string }
  | { type: "setMain"; key: string }
  | { type: "setCutout"; cutout: Cutout | null }
  | { type: "useCutout"; use: boolean }
  | { type: "classified"; key: string; result: ClassifyResult }
  | { type: "analyzed"; key: string; result: Analysis }
  | { type: "details"; patch: Partial<Details> }
  | { type: "reseed"; seed: number }
  | { type: "reset"; state: WizardState };

export const newSeed = () => Math.floor(Math.random() * 2_147_483_647);

export function initialState(defaults: { locale: PageLocale; market: Market; aiCopy: boolean }): WizardState {
  return {
    step: 0,
    reached: 0,
    photos: [],
    mainKey: null,
    cutout: null,
    classify: null,
    analysis: null,
    details: { name: "", price: "", category: "other", categoryTouched: false, facts: ["", "", ""], locale: defaults.locale, market: defaults.market, aiCopy: defaults.aiCopy },
    seedBase: newSeed(),
  };
}

/** Identity of the uploaded photo set (AI readings are redone when it changes). */
export const photosKey = (photos: readonly Photo[]) =>
  photos
    .map((p) => p.asset?.id)
    .filter(Boolean)
    .join(",");

export function reducer(state: WizardState, action: Action): WizardState {
  switch (action.type) {
    case "goto":
      return { ...state, step: action.step, reached: Math.max(state.reached, action.step) as Step };
    case "addPhotos": {
      const photos = [...state.photos, ...action.photos].slice(0, 12);
      return { ...state, photos, mainKey: state.mainKey ?? photos[0]?.key ?? null };
    }
    case "patchPhoto":
      return { ...state, photos: state.photos.map((p) => (p.key === action.key ? { ...p, ...action.patch } : p)) };
    case "uploaded": {
      // the same file added twice is stored once by the server: keep a single tile
      if (state.photos.some((p) => p.key !== action.key && p.asset?.id === action.asset.id)) return reducer(state, { type: "removePhoto", key: action.key });
      return reducer(state, { type: "patchPhoto", key: action.key, patch: { status: "ready", progress: 1, asset: action.asset, error: undefined } });
    }
    case "removePhoto": {
      const photos = state.photos.filter((p) => p.key !== action.key);
      const mainKey = state.mainKey === action.key ? (photos.find((p) => p.status !== "error")?.key ?? photos[0]?.key ?? null) : state.mainKey;
      const cutout = state.cutout?.sourceKey === action.key ? null : state.cutout;
      return { ...state, photos, mainKey, cutout };
    }
    case "setMain":
      return { ...state, mainKey: action.key };
    case "setCutout":
      return { ...state, cutout: action.cutout };
    case "useCutout":
      return state.cutout ? { ...state, cutout: { ...state.cutout, use: action.use } } : state;
    case "classified": {
      const details = state.details.categoryTouched || state.analysis?.key === action.key ? state.details : { ...state.details, category: action.result.category };
      return { ...state, classify: { key: action.key, result: action.result }, details };
    }
    case "analyzed": {
      const details = state.details.categoryTouched ? state.details : { ...state.details, category: action.result.category };
      return { ...state, analysis: { key: action.key, result: action.result }, details };
    }
    case "details":
      return { ...state, details: { ...state.details, ...action.patch } };
    case "reseed":
      return { ...state, seedBase: action.seed };
    case "reset":
      return action.state;
  }
}

/* ------------------------------------------------------------------ */
/* Session persistence                                                 */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "cod-studio:generate:v1";

const Stored = z.object({
  step: z.number().int().min(0).max(3),
  reached: z.number().int().min(0).max(3),
  photos: z
    .array(
      z.object({
        key: z.string().max(40),
        name: z.string().max(200),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        palette: ExtractedPaletteSchema.nullable(),
        asset: PhotoAssetSchema,
      }),
    )
    .max(12),
  mainKey: z.string().max(40).nullable(),
  cutout: z.object({ asset: PhotoAssetSchema, sourceKey: z.string().max(40), palette: ExtractedPaletteSchema.nullable(), use: z.boolean() }).nullable(),
  classify: z
    .object({
      key: z.string().max(2000),
      result: z.object({ category: z.enum(PRODUCT_CATEGORIES), vibe: z.enum(VIBES), scores: z.record(z.string().max(60), z.number()) }),
    })
    .nullable(),
  analysis: z.object({ key: z.string().max(2000), result: AnalysisSchema }).nullable(),
  details: z.object({
    name: z.string().max(120),
    price: z.string().max(20),
    category: z.enum(PRODUCT_CATEGORIES),
    categoryTouched: z.boolean(),
    facts: z.array(z.string().max(200)).max(6),
    locale: z.enum(["ar", "fr", "en"]),
    market: z.enum(MARKETS),
    aiCopy: z.boolean(),
  }),
  seedBase: z.number().int().min(0).max(2_147_483_647),
});

/** Saved wizard (photos that finished uploading only), or null. Browser only. */
export function loadState(): WizardState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = Stored.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const s = parsed.data;
    const photos: Photo[] = s.photos.map((p) => ({ ...p, preview: p.asset.thumbUrl ?? p.asset.url, status: "ready", progress: 1 }));
    const step = (photos.length ? s.step : 0) as Step;
    return { ...s, step, reached: Math.max(step, photos.length ? s.reached : 0) as Step, photos, mainKey: photos.some((p) => p.key === s.mainKey) ? s.mainKey : (photos[0]?.key ?? null) };
  } catch {
    return null;
  }
}

export function saveState(state: WizardState): void {
  try {
    const photos = state.photos.flatMap((p) => (p.status === "ready" && p.asset ? [{ key: p.key, name: p.name, width: p.width, height: p.height, palette: p.palette, asset: p.asset }] : []));
    if (!photos.length && !state.details.name.trim()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, photos }));
  } catch {
    // storage full or disabled (private mode): the wizard simply won't survive a reload
  }
}

export function clearState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
