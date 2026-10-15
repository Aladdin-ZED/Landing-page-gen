/**
 * PageDoc — the single source of truth for a landing page.
 * Admin edits it, the generator produces it, the renderer turns it into HTML,
 * the exporter zips that HTML. Every field is validated before render/publish.
 *
 * Shared, framework-free (safe in browser, server and web workers).
 */
import { z } from "zod";
import { PIXEL_ID_RE, PIXEL_LIMIT, type PixelPlatform } from "../pixels/ids";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const Hex = z.string().regex(HEX, "Expected #rrggbb");

export const LOCALES = ["ar", "fr", "en", "es", "de", "it", "nl", "pt"] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;
export const RTL_LOCALES: readonly Locale[] = ["ar"];
export const dirOf = (l: Locale): "rtl" | "ltr" => (RTL_LOCALES.includes(l) ? "rtl" : "ltr");

export const MARKETS = ["MA", "FR", "BE", "ES", "DE", "IT", "NL", "PT", "INTL"] as const;
export const Market = z.enum(MARKETS);
export type Market = z.infer<typeof Market>;

/** Short id helper for sections/bundles (url-safe, 4-40 chars). */
export const Id = z.string().regex(/^[a-zA-Z0-9_-]{2,40}$/);

export const Money = z.number().nonnegative().max(10_000_000);

/** Inline text: plain text with a tiny safe markup: *emphasis* and **strong**. Never HTML. */
export const InlineText = z.string().max(400);
/** Block text: InlineText rules + line breaks + "- " bullet lines. Never HTML. */
export const BlockText = z.string().max(4000);

/** Reference to an uploaded asset (image/video). Resolved to URLs by RenderContext.asset(). */
export const AssetRef = z.object({
  id: z.string().regex(/^[a-f0-9]{16,64}$/),
  alt: z.string().max(200).default(""),
  /** focal point for object-position, 0..1 */
  fx: z.number().min(0).max(1).optional(),
  fy: z.number().min(0).max(1).optional(),
});
export type AssetRef = z.infer<typeof AssetRef>;

/* ------------------------------------------------------------------ */
/* Product                                                             */
/* ------------------------------------------------------------------ */

export const PRODUCT_CATEGORIES = [
  "beauty",
  "skincare",
  "haircare",
  "fragrance",
  "jewelry",
  "watches",
  "fashion",
  "bags",
  "health",
  "supplements",
  "fitness",
  "sport",
  "kitchen",
  "home",
  "cleaning",
  "decor",
  "kids",
  "toys",
  "pets",
  "tech",
  "gadgets",
  "car",
  "tools",
  "grooming",
  "organic-food",
  "traditional",
  "garden",
  "other",
] as const;
export const ProductCategory = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof ProductCategory>;

export const VariantOption = z.object({
  id: Id,
  label: z.string().min(1).max(40),
  swatch: Hex.optional(),
  image: AssetRef.optional(),
  soldOut: z.boolean().default(false),
});

export const VariantGroup = z.object({
  id: Id,
  name: z.string().min(1).max(40), // "Couleur", "Taille", "اللون"
  kind: z.enum(["swatch", "text", "image"]).default("text"),
  options: z.array(VariantOption).min(1).max(24),
  /** true → customer picks an option per unit in multi-unit bundles */
  perUnit: z.boolean().default(true),
});

export const Product = z.object({
  name: z.string().min(1).max(120),
  tagline: InlineText.optional(),
  description: BlockText.optional(),
  category: ProductCategory.default("other"),
  images: z.array(AssetRef).max(30).default([]),
  /** transparent background cutout of the product (hero stage) */
  cutout: AssetRef.optional(),
  price: Money,
  /** genuine previous unit price, shown struck-through only if set */
  compareAt: Money.optional(),
  sku: z.string().max(60).optional(),
  variants: z.array(VariantGroup).max(3).default([]),
  /** real aggregated rating — never invent */
  rating: z
    .object({ value: z.number().min(1).max(5), count: z.number().int().min(1).max(1_000_000) })
    .optional(),
});
export type Product = z.infer<typeof Product>;

/* ------------------------------------------------------------------ */
/* Offers / bundles                                                    */
/* ------------------------------------------------------------------ */

export const BUNDLE_CARD_STYLES = ["stack", "tiers", "ticket", "pills", "visual"] as const;

export const Bundle = z.object({
  id: Id,
  qty: z.number().int().min(1).max(20),
  /** e.g. "Pack Duo" / "عرض الثنائي" — optional, falls back to "x2" */
  title: z.string().max(60).optional(),
  subtitle: z.string().max(90).optional(),
  /** total price for the bundle */
  price: Money,
  /** genuine reference total. Default (when absent) = product.price * qty */
  compareAt: Money.optional(),
  badge: z.enum(["none", "popular", "best", "custom"]).default("none"),
  badgeText: z.string().max(28).optional(),
  freeShipping: z.boolean().default(true),
  gift: z.object({ label: z.string().min(1).max(60), image: AssetRef.optional() }).optional(),
  image: AssetRef.optional(),
  preselected: z.boolean().default(false),
});
export type Bundle = z.infer<typeof Bundle>;

export const Offers = z.object({
  bundles: z.array(Bundle).min(1).max(5),
  cardStyle: z.enum(BUNDLE_CARD_STYLES).default("stack"),
  showPerUnit: z.boolean().default(true),
  showSavings: z.enum(["amount", "percent", "both", "none"]).default("both"),
  /** delivery fee added to every order (0 = free) */
  shippingFee: Money.default(0),
  orderBump: z
    .object({
      enabled: z.boolean().default(false),
      title: z.string().max(80),
      description: z.string().max(160).optional(),
      price: Money,
      image: AssetRef.optional(),
    })
    .optional(),
  upsell: z
    .object({
      enabled: z.boolean().default(false),
      title: z.string().max(80),
      description: z.string().max(240).optional(),
      price: Money,
      compareAt: Money.optional(),
      image: AssetRef.optional(),
      /** offer window on thank-you page, minutes */
      windowMinutes: z.number().int().min(1).max(120).default(10),
    })
    .optional(),
  urgency: z
    .object({
      /** ISO datetime set by admin. Countdown hides itself after it passes. Never auto-resets. */
      countdownEnd: z.string().datetime({ offset: true }).optional(),
      /** real stock number typed by admin */
      stockLeft: z.number().int().min(0).max(100_000).optional(),
    })
    .default({}),
});
export type Offers = z.infer<typeof Offers>;

/* ------------------------------------------------------------------ */
/* Order form                                                          */
/* ------------------------------------------------------------------ */

export const FormConfig = z.object({
  city: z.enum(["select", "text", "hidden"]).default("select"),
  address: z.enum(["required", "optional", "hidden"]).default("required"),
  note: z.enum(["optional", "hidden"]).default("hidden"),
  email: z.enum(["required", "optional", "hidden"]).default("hidden"),
  /** ISO 3166 alpha-2 used for phone validation + city list */
  phoneCountry: z.string().regex(/^[A-Z]{2}$/).default("MA"),
  title: InlineText.optional(),
  submitLabel: z.string().max(60).optional(),
  /** small reassurance line under the submit button */
  reassurance: z.string().max(140).optional(),
  whatsapp: z
    .object({ enabled: z.boolean().default(false), number: z.string().regex(/^\+?[0-9]{8,15}$/) })
    .optional(),
});
export type FormConfig = z.infer<typeof FormConfig>;

/* ------------------------------------------------------------------ */
/* Theme spec (source of truth; tokens are derived by the engine)      */
/* ------------------------------------------------------------------ */

export const ARCHETYPES = [
  "maison",
  "apothecary",
  "souk",
  "playground",
  "kinetic",
  "circuit",
  "hearth",
  "bloom",
  "field",
  "editorial",
  "garage",
] as const;
export const Archetype = z.enum(ARCHETYPES);
export type Archetype = z.infer<typeof Archetype>;

export const HARMONIES = [
  "mono-luxe",
  "clay-sage",
  "earth-triad",
  "pop-complement",
  "contrast-neon",
  "cool-precise",
  "warm-butter",
  "blush-berry",
  "ink-accent",
] as const;
export const Harmony = z.enum(HARMONIES);

/** Modern section transitions only (DESIGN.md §4.6) — no torn/zigzag/scallop/stitch/tape edges. */
export const DIVIDERS = ["none", "curve", "diagonal", "steps", "arch", "wave", "fade"] as const;
export const Divider = z.enum(DIVIDERS);
export type Divider = z.infer<typeof Divider>;

/** Font ids are keys of the font manifest (src/lib/theme/fonts.ts). */
export const FontId = z.string().regex(/^[a-z0-9-]{2,48}$/);

export const ThemeSpec = z.object({
  archetype: Archetype,
  /** deterministic seed for every procedural choice (illustrations, rotations, blobs) */
  seed: z.number().int().min(0).max(2_147_483_647),
  palette: z.object({
    accent: Hex,
    pop: Hex,
    /** hue (0-360) used to tint neutrals; defaults to accent hue */
    neutralHue: z.number().min(0).max(360).optional(),
    /** overall page lightness mood */
    base: z.enum(["light", "tinted", "dark"]).default("light"),
    harmony: Harmony,
  }),
  fonts: z.object({
    display: FontId,
    body: FontId,
    accent: FontId.optional(),
    /** used when page locale is Arabic */
    displayAr: FontId,
    bodyAr: FontId,
  }),
  radius: z.enum(["archetype", "none", "subtle", "soft", "round"]).default("archetype"),
  shadow: z.enum(["archetype", "none", "soft", "deep", "glow"]).default("archetype"),
  /** only an ultra-subtle film grain is allowed (modern direction) */
  texture: z.enum(["archetype", "none", "grain"]).default("archetype"),
  /** "panels": sections float as large rounded panels inset from the viewport; "flush": edge-to-edge */
  surfaces: z.enum(["archetype", "flush", "panels"]).default("archetype"),
  motion: z.enum(["calm", "lively", "off"]).default("lively"),
  dividers: z.array(Divider).max(4).default([]), // empty → archetype family
  /** 0..2 multiplier on decorative illustration density */
  ornament: z.number().min(0).max(2).default(1),
});
export type ThemeSpec = z.infer<typeof ThemeSpec>;

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export const SECTION_BGS = ["base", "soft", "surface", "accent", "dark", "pop"] as const;
export const SectionBg = z.enum(SECTION_BGS);
export type SectionBg = z.infer<typeof SectionBg>;

export const SectionInstance = z.object({
  id: Id,
  type: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{1,40}$/),
  variant: z.string().regex(/^[a-z0-9-]{1,40}$/),
  bg: SectionBg.default("base"),
  /** divider drawn ABOVE this section; "auto" lets the engine decide */
  divider: z.union([Divider, z.literal("auto")]).default("auto"),
  spacing: z.enum(["tight", "normal", "airy"]).default("normal"),
  hidden: z.boolean().default(false),
  /** section data — validated against the section definition's schema */
  data: z.record(z.string(), z.unknown()).default({}),
});
export type SectionInstance = z.infer<typeof SectionInstance>;

/* ------------------------------------------------------------------ */
/* Tracking / SEO / thank-you                                          */
/* ------------------------------------------------------------------ */

/**
 * The ad pixel ids of one platform: 1…PIXEL_LIMIT ids, deduplicated. A single id string — how pages
 * and the store setting stored it before multi-pixel support — reads as [id]; an empty list is
 * "not set" (undefined), so `!!tracking.metaPixelId` keeps meaning "this platform is on".
 */
const pixelIds = (platform: PixelPlatform) => {
  const id = z.string().regex(PIXEL_ID_RE[platform]);
  return z
    .union([id.transform((s) => [s]), z.array(id).max(PIXEL_LIMIT[platform])])
    .transform((ids) => (ids.length ? [...new Set(ids)] : undefined))
    .optional();
};

/** Ad pixels of a page (and of the store "pixels" setting): see src/lib/pixels. */
export const Tracking = z.object({
  metaPixelId: pixelIds("meta"),
  tiktokPixelId: pixelIds("tiktok"),
  snapPixelId: pixelIds("snap"),
  ga4Id: pixelIds("ga4"),
});
export type Tracking = z.infer<typeof Tracking>;

export const Seo = z.object({
  title: z.string().max(70).optional(),
  description: z.string().max(170).optional(),
  ogImage: AssetRef.optional(),
  noindex: z.boolean().default(false),
});

export const ThankYou = z.object({
  title: InlineText.optional(),
  message: BlockText.optional(),
  /** show delivery timeline steps */
  showTimeline: z.boolean().default(true),
});

/* ------------------------------------------------------------------ */
/* PageDoc                                                             */
/* ------------------------------------------------------------------ */

export const PageDoc = z.object({
  v: z.literal(1),
  locale: Locale,
  market: Market,
  currency: z.string().regex(/^[A-Z]{3}$/),
  product: Product,
  offers: Offers,
  form: FormConfig,
  theme: ThemeSpec,
  sections: z.array(SectionInstance).max(60),
  seo: Seo.default({ noindex: false }),
  tracking: Tracking.default({}),
  thankYou: ThankYou.default({ showTimeline: true }),
});
export type PageDoc = z.infer<typeof PageDoc>;
export type PageDocInput = z.input<typeof PageDoc>;
