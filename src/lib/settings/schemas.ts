/**
 * Typed settings registry: one zod schema + default per key, and which keys are stored encrypted.
 * Isomorphic (no I/O) so admin forms can validate with the same schemas before submitting.
 */
import { z } from "zod";
import { AssetRef, Locale, Market, Money, Tracking } from "@/lib/page/schema";

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

export const PixelsSettings = Tracking;

export const TrackingSecretsSettings = z.object({
  metaCapiToken: optional(secretToken),
  /** Meta "Test events" code, only while testing */
  metaTestEventCode: optional(z.string().trim().regex(/^[A-Z0-9]{4,20}$/)),
  tiktokToken: optional(secretToken),
  /** TikTok Events Manager "Test events" code, only while testing */
  tiktokTestEventCode: optional(z.string().trim().regex(/^[A-Z0-9]{4,20}$/)),
  snapToken: optional(secretToken),
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
  tracking_secrets: def({
    schema: TrackingSecretsSettings,
    secret: true,
    defaults: () => ({}),
    sensitive: ["metaCapiToken", "tiktokToken", "snapToken", "ga4ApiSecret"],
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
  }
  return copy as SettingValue<K>;
}

/** True when a submitted field is the mask produced by redactSetting (i.e. unchanged). */
export function isMaskedSecret(value: unknown): boolean {
  return typeof value === "string" && /^••••[^•]{0,4}$/.test(value);
}
