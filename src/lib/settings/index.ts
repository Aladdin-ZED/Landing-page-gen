/**
 * Settings store (MariaDB `settings` table) with typed accessors.
 *  - every key is validated by its zod schema on write and on read (bad rows fall back to defaults)
 *  - secret keys are stored as AES-GCM envelopes bound to the key (purpose "settings:<key>")
 *  - small in-process cache (30 s TTL), invalidated on write by this process
 *
 *   const store = await getSetting("store");
 *   await updateSetting("ai", { tier: "full" }, { id: user.id, ip });
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { errorSummary } from "@/lib/orders/log";
import { decrypt, encrypt } from "@/lib/security/crypto";
import { SETTINGS, isMaskedSecret, settingSchema, type SettingInput, type SettingKey, type SettingValue } from "./schemas";

export * from "./schemas";

const TTL_MS = 30_000;

interface CacheEntry {
  value: unknown;
  expires: number;
}

declare global {
  var __codSettingsCache: Map<SettingKey, CacheEntry> | undefined;
}

const cache = () => (globalThis.__codSettingsCache ??= new Map<SettingKey, CacheEntry>());
const purpose = (key: SettingKey) => `settings:${key}`;

interface Row {
  key: string;
  value: unknown;
  encrypted: boolean;
}

function defaultsFor<K extends SettingKey>(key: K): SettingValue<K> {
  const schema = settingSchema(key);
  const parsed = schema.safeParse(SETTINGS[key].defaults());
  if (parsed.success) return parsed.data;
  console.error(`[settings] defaults for "${key}" are invalid (check related env vars); using empty defaults`);
  return schema.parse({});
}

function decode<K extends SettingKey>(key: K, row: Row | undefined): SettingValue<K> {
  if (!row) return defaultsFor(key);
  const schema = settingSchema(key);
  let raw: unknown;
  try {
    raw = row.encrypted ? JSON.parse(decrypt(String(row.value), purpose(key))) : row.value;
  } catch (err) {
    // JSON.parse quotes the text it choked on — here the decrypted secret — so its message is never logged
    console.error(`[settings] cannot read "${key}" (${err instanceof SyntaxError ? "stored value is not valid JSON" : errorSummary(err)}); using defaults`);
    return defaultsFor(key);
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.error(`[settings] stored "${key}" failed validation; using defaults`);
  return defaultsFor(key);
}

function remember(key: SettingKey, value: unknown) {
  cache().set(key, { value, expires: Date.now() + TTL_MS });
}

function cached<K extends SettingKey>(key: K): SettingValue<K> | undefined {
  const hit = cache().get(key);
  if (!hit || hit.expires <= Date.now()) return undefined;
  return structuredClone(hit.value) as SettingValue<K>;
}

async function load<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const value = decode(key, rows[0]);
  remember(key, value);
  return structuredClone(value);
}

export async function getSetting<K extends SettingKey>(key: K, opts: { fresh?: boolean } = {}): Promise<SettingValue<K>> {
  if (!opts.fresh) {
    const hit = cached(key);
    if (hit !== undefined) return hit;
  }
  return load(key);
}

/** Several keys in one query. */
export async function getSettings<K extends SettingKey>(keys: readonly K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const out = {} as { [P in K]: SettingValue<P> };
  const missing: K[] = [];
  for (const key of keys) {
    const hit = cached(key);
    if (hit !== undefined) out[key] = hit;
    else missing.push(key);
  }
  if (missing.length) {
    const rows = await db.select().from(settings).where(inArray(settings.key, missing));
    for (const key of missing) {
      const value = decode(key, rows.find((r) => r.key === key));
      remember(key, value);
      out[key] = structuredClone(value);
    }
  }
  return out;
}

/** Validates without saving (for form feedback). */
export function parseSettingInput<K extends SettingKey>(key: K, input: unknown) {
  return settingSchema(key).safeParse(input);
}

export interface SettingsActor {
  id: string;
  ip?: string | null;
}

/** Replaces the whole value of a key. Throws ZodError when invalid. */
export async function setSetting<K extends SettingKey>(
  key: K,
  input: SettingInput<K>,
  actor?: SettingsActor,
): Promise<SettingValue<K>> {
  const def = SETTINGS[key];
  const value = settingSchema(key).parse(input);
  const stored: unknown = def.secret ? encrypt(JSON.stringify(value), purpose(key)) : value;
  const updatedAt = new Date();
  await db
    .insert(settings)
    .values({ key, value: stored, encrypted: def.secret, updatedAt })
    .onDuplicateKeyUpdate({ set: { value: stored, encrypted: def.secret, updatedAt } });
  invalidateSettings(key);
  await audit("settings.updated", {
    userId: actor?.id ?? null,
    target: key,
    meta: { fields: Object.keys(value as Record<string, unknown>) },
    ip: actor?.ip,
  });
  return structuredClone(value);
}

/**
 * Shallow-merges a partial update into the stored value. Sensitive fields submitted as the
 * redacted mask (unchanged in the form) keep their stored secret. Throws ZodError when invalid.
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  patch: Partial<SettingInput<K>>,
  actor?: SettingsActor,
): Promise<SettingValue<K>> {
  const current = (await getSetting(key, { fresh: true })) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...current };
  for (const [field, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined || isMaskedSecret(value)) continue;
    merged[field] = value;
  }
  return setSetting(key, merged as SettingInput<K>, actor);
}

export function invalidateSettings(key?: SettingKey): void {
  if (key) cache().delete(key);
  else cache().clear();
}
