/**
 * Typed settings registry: one zod schema + default per key, and which keys are stored encrypted.
 * Isomorphic (no I/O) so admin forms can validate with the same schemas before submitting.
 */
import { z } from "zod";
import { AssetRef, Locale, Market, Money, Tracking } from "@/lib/page/schema";
import { ID_HELP } from "@/lib/pixels/form";
import { PIXEL_ID_RE, PIXEL_PLATFORMS } from "@/lib/pixels/ids";

const text = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
    .pipe(z.string().max(max));

const optionalText = (max: number) =>
  text(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** International phone, digits with optional leading + (spaces/dashes/dots allowed on input). */
const phone = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{6,15}$/, { error: "Enter a valid phone number." }));

const httpsUrl = z
  .url({ protocol: /^https$/, error: "Use a full https:// link." })
  .max(300);

/** Optional field where an empty form value ("") means "not set". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.union([z.literal("").transform(() => undefined), schema]).optional();

/** Opaque API token / secret (Meta CAPI, TikTok Events API, Turnstile…). */
const secretToken = z.string().trim().regex(/^[A-Za-z0-9_\-.:|=+/]{8,512}$/, { error: "This doesn't look like a valid token." });

export const StoreSettings = z.object({
  /**
   * Required when the admin saves the form; "" until then (never a made-up "My store": landing
   * pages fall back to the product name, the dashboard checklist keeps asking for the real one).
   * zod 4: the default short-circuits — a missing value becomes "", a submitted "" is still refused.
   */
  storeName: text(80).pipe(z.string().min(1, { error: "Enter the store name." })).default(""),
  legalName: optionalText(160),
  logo: AssetRef.optional(),
  phone: optional(phone),
  whatsapp: optional(phone),
  email: optional(z.email({ error: "Enter a valid email address." }).max(160)),
  address: optionalText(300),
  city: optionalText(120),
  country: z.string().regex(/^[A-Z]{2}$/).default("MA"),
  /** Moroccan Identifiant Commun de l'Entreprise — 15 digits */
  ice: optional(z.string().regex(/^[0-9]{15}$/, { error: "ICE is 15 digits." })),
  /** Registre de commerce number (format varies by city) */
  rc: optional(z.string().trim().regex(/^[A-Za-z0-9 ./-]{1,30}$/, { error: "Invalid RC number." })),
  socials: z
    .object({
      facebook: optional(httpsUrl),
      instagram: optional(httpsUrl),
      tiktok: optional(httpsUrl),
      youtube: optional(httpsUrl),
      snapchat: optional(httpsUrl),
    })
    .default({}),
});

export const DefaultsSettings = z.object({
  market: Market.default("MA"),
  locale: Locale.default("ar"),
  currency: z.string().regex(/^[A-Z]{3}$/).default("MAD"),
  phoneCountry: z.string().regex(/^[A-Z]{2}$/).default("MA"),
  shippingFee: Money.default(0),
  /** e.g. "Livraison gratuite 24–48h" / "التوصيل مجاني خلال 24–48 ساعة" */
  deliveryText: text(140).default(""),
});

export const SheetsSettings = z.object({
  enabled: z.boolean().default(false),
  url: optional(z.url({ protocol: /^https$/, hostname: /^docs\.google\.com$/ }).max(500)),
  spreadsheetId: optional(z.string().regex(/^[A-Za-z0-9_-]{20,100}$/)),
  sheetId: z.number().int().nonnegative().optional(),
  sheetTitle: optionalText(100),
  connectedAt: z.iso.datetime({ offset: true }).optional(),
});

/**
 * Store-level ad pixels from before per-page pixels (docs/OFFERS.md §A): read once by the pixel
 * library migration (src/lib/pixels/migrate.server.ts), ignored afterwards, deleted in the cleanup
 * release. Pages own their pixels; nothing copies this value into pages any more.
 */
export const PixelsSettings = Tracking;

/* ------------------------------------------------------------------ */
/* Pixel library (§A.2): every pixel the store knows, labels, test windows */
/* ------------------------------------------------------------------ */

/** A per-page, time-boxed test window: events of THIS page carry the pixel's test code until `until`. */
export const PixelTestWindow = z.object({ pageId: z.string().length(26), until: z.iso.datetime({ offset: true }) });
export type PixelTestWindow = z.infer<typeof PixelTestWindow>;

export const PixelLibraryEntry = z
  .object({
    platform: z.enum(PIXEL_PLATFORMS),
    /** canonical (normalizePixelId); immutable once saved */
    id: z.string(),
    /** "Compte principal", "BM backup 2" */
    label: z.string().trim().max(40).default(""),
    addedAt: z.iso.datetime({ offset: true }),
    /** expired windows are pruned on every write */
    tests: z.array(PixelTestWindow).max(5).default([]),
  })
  .superRefine((e, c) => {
    if (!PIXEL_ID_RE[e.platform].test(e.id)) c.addIssue({ code: "custom", message: ID_HELP[e.platform], path: ["id"] });
  });
export type PixelLibraryEntry = z.infer<typeof PixelLibraryEntry>;

/** The UI adds up to 100; the schema keeps headroom so the migration never drops an id. */
export const PIXEL_LIBRARY_UI_MAX = 100;
export const PixelLibrarySettings = z
  .object({ v: z.literal(1).default(1), pixels: z.array(PixelLibraryEntry).max(200).default([]) })
  .refine((l) => new Set(l.pixels.map((p) => `${p.platform}:${p.id}`)).size === l.pixels.length, { error: "Duplicate pixel." });

/** Last server outcome of a pixel (no personal data). */
export const PixelHealthEntry = z.object({
  at: z.iso.datetime({ offset: true }),
  state: z.enum(["ok", "refused", "unverified"]),
  code: z.enum(["token", "permission", "pixel", "rate", "network", "other"]).optional(),
  testMode: z.boolean(),
});
export type PixelHealthEntry = z.infer<typeof PixelHealthEntry>;
/** key "platform:id" */
export const PixelHealthSettings = z.record(z.string().max(80), PixelHealthEntry);
/** Spec name (§A.2). */
export const PixelHealth = PixelHealthSettings;
export type PixelHealth = z.infer<typeof PixelHealthSettings>;

/** A platform's "Test events" code (Meta Events Manager / TikTok Events Manager), e.g. TEST12345. */
export const TestEventCode = z.string().trim().regex(/^[A-Z0-9]{4,20}$/, { error: "4–20 capital letters and digits, e.g. TEST12345." });

/** Server credentials keyed by pixel id (each pixel optional; at most a few per store). */
const perPixel = <T extends z.ZodType>(platform: "meta" | "tiktok", value: T) =>
  z
    .record(z.string().regex(PIXEL_ID_RE[platform]), value)
    .refine((o) => Object.keys(o).length <= 200, { error: "Too many pixels." })
    .default({});

/**
 * Server-side event credentials (stored encrypted). Tokens and test codes are per pixel id — a
 * Conversions API token / Events API token belongs to one pixel (dataset). A test code is a stored
 * value: it is attached to an event only inside an active test window of that event's page (pixel
 * library, §A.2). The single-value fields are how they were stored before multi-pixel support: the
 * library migration copies them into the per-pixel maps; they stay stored (rollback only), are never
 * read by this build, and are deleted in the cleanup release.
 */
export const TrackingSecretsSettings = z.object({
  /** Meta Conversions API access token per Meta pixel id */
  metaTokens: perPixel("meta", secretToken),
  /** Meta "Test events" code per Meta pixel id — only while testing */
  metaTestCodes: perPixel("meta", TestEventCode),
  /** TikTok Events API access token per TikTok pixel code */
  tiktokTokens: perPixel("tiktok", secretToken),
  /** TikTok "Test events" code per TikTok pixel code — only while testing */
  tiktokTestCodes: perPixel("tiktok", TestEventCode),
  /** legacy single Meta token (any Meta pixel without its own) */
  metaCapiToken: optional(secretToken),
  /** legacy single Meta test code */
  metaTestEventCode: optional(TestEventCode),
  /** legacy single TikTok token (any TikTok pixel without its own) */
  tiktokToken: optional(secretToken),
  /** legacy single TikTok test code */
  tiktokTestEventCode: optional(TestEventCode),
  /** kept for a later Snap Conversions API; not used */
  snapToken: optional(secretToken),
  /** kept for a later GA4 Measurement Protocol; not used */
  ga4ApiSecret: optional(secretToken),
});

export const AiSettings = z.object({
  enabled: z.boolean().default(true),
  tier: z.enum(["lite", "full"]).default("lite"),
  bgRemoval: z.boolean().default(true),
});

export const TurnstileSettings = z.object({
  siteKey: optional(z.string().trim().regex(/^[A-Za-z0-9_-]{10,100}$/)),
  secretKey: optional(secretToken),
});

export const HomeSettings = z.object({
  /** page shown at "/" (null → none) */
  pageId: z
    .string()
    .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    .nullable()
    .default(null),
});

interface SettingDef<S extends z.ZodType> {
  schema: S;
  /** whole value stored as an AES-GCM envelope (settings.encrypted = true) */
  secret: boolean;
  /** value used when the row is missing or unreadable (computed lazily: may read env) */
  defaults: () => z.input<S>;
  /** fields shown masked in admin UIs (see redactSetting) */
  sensitive?: readonly string[];
}

const def = <S extends z.ZodType>(d: SettingDef<S>) => d;

export const SETTINGS = {
  store: def({ schema: StoreSettings, secret: false, defaults: () => ({}) }),
  defaults: def({ schema: DefaultsSettings, secret: false, defaults: () => ({}) }),
  sheets: def({ schema: SheetsSettings, secret: false, defaults: () => ({ enabled: false }) }),
  pixels: def({ schema: PixelsSettings, secret: false, defaults: () => ({}) }),
  /** the pixel library (§A.2) — also the migration marker: written last by migrate.server.ts */
  pixel_library: def({ schema: PixelLibrarySettings, secret: false, defaults: () => ({ v: 1 as const, pixels: [] }) }),
  /** last server outcome per pixel, "platform:id" → entry (§A.2) */
  pixel_health: def({ schema: PixelHealthSettings, secret: false, defaults: () => ({}) }),
  tracking_secrets: def({
    schema: TrackingSecretsSettings,
    secret: true,
    defaults: () => ({}),
    sensitive: ["metaTokens", "tiktokTokens", "metaCapiToken", "tiktokToken", "snapToken", "ga4ApiSecret"],
  }),
  ai: def({ schema: AiSettings, secret: false, defaults: () => ({}) }),
  turnstile: def({
    schema: TurnstileSettings,
    secret: true,
    // environment keys act as defaults until the admin saves their own
    defaults: () => ({
      siteKey: process.env.TURNSTILE_SITE_KEY || undefined,
      secretKey: process.env.TURNSTILE_SECRET_KEY || undefined,
    }),
    sensitive: ["secretKey"],
  }),
  home: def({ schema: HomeSettings, secret: false, defaults: () => ({ pageId: null }) }),
} as const;

export type SettingKey = keyof typeof SETTINGS;
export type SettingValue<K extends SettingKey> = z.output<(typeof SETTINGS)[K]["schema"]>;
export type SettingInput<K extends SettingKey> = z.input<(typeof SETTINGS)[K]["schema"]>;
export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

/** The schema of a key, typed by key (the registry is a heterogeneous map). */
export function settingSchema<K extends SettingKey>(key: K): z.ZodType<SettingValue<K>, SettingInput<K>> {
  return SETTINGS[key].schema as unknown as z.ZodType<SettingValue<K>, SettingInput<K>>;
}

export function isSettingKey(value: unknown): value is SettingKey {
  return typeof value === "string" && Object.hasOwn(SETTINGS, value);
}

/** Masked secret preview, e.g. "••••3f9a" (never the full value). */
export function maskSecret(value: string): string {
  return value.length <= 8 ? "••••" : `••••${value.slice(-4)}`;
}

/**
 * Copy of a value that is safe to send to the browser: sensitive fields are replaced by a mask.
 * Forms should treat an untouched masked field as "keep the stored secret" (see updateSetting()).
 */
export function redactSetting<K extends SettingKey>(key: K, value: SettingValue<K>): SettingValue<K> {
  const sensitive: readonly string[] = SETTINGS[key].sensitive ?? [];
  if (!sensitive.length) return value;
  const copy: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const field of sensitive) {
    const v = copy[field];
    if (typeof v === "string" && v) copy[field] = maskSecret(v);
    // a map of secrets (e.g. a token per pixel id): every value masked, keys kept
    else if (v && typeof v === "object" && !Array.isArray(v))
      copy[field] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, s]) => [k, typeof s === "string" && s ? maskSecret(s) : s]));
  }
  return copy as SettingValue<K>;
}

/** True when a submitted field is the mask produced by redactSetting (i.e. unchanged). */
export function isMaskedSecret(value: unknown): boolean {
  return typeof value === "string" && /^••••[^•]{0,4}$/.test(value);
}
