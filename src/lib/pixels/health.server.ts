import "server-only";
/**
 * Pixel health (setting pixel_health, docs/OFFERS.md §A.2 #4, §A.5): the last server outcome per
 * pixel — "ok", "refused" (+ token · permission · pixel · rate · network · other) or "unverified"
 * (a token was saved or migrated and nothing confirmed it yet). No personal data, no token.
 *
 * Writes after each Purchase send are throttled per worker: a pixel's entry is written when its
 * state or code changes, or 10 minutes after the last write for that pixel in this worker. They go
 * straight to the settings row (no "settings.updated" audit line per order); admin writes (token
 * changes, Send test event) use the same path, unthrottled.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import type { HealthCode } from "@/lib/orders/conversions-core";
import { getSetting, invalidateSettings } from "@/lib/settings";
import { PixelHealthSettings, type PixelHealth, type PixelHealthEntry } from "@/lib/settings/schemas";
import type { PixelPlatform } from "./ids";
import { healthWriteDue, pixelKey } from "./library";

/** key → last written entry (this worker) */
const lastWrite: Map<string, { state: string; code?: string; at: number }> = ((globalThis as { __codPixelHealth?: Map<string, { state: string; code?: string; at: number }> }).__codPixelHealth ??= new Map());

export interface HealthUpdate {
  platform: PixelPlatform;
  id: string;
  state: PixelHealthEntry["state"];
  code?: HealthCode;
  testMode: boolean;
}

/** Health of every pixel (fresh read). */
export async function getPixelHealth(): Promise<PixelHealth> {
  return getSetting("pixel_health", { fresh: true });
}

async function writeHealth(next: PixelHealth): Promise<void> {
  const value = PixelHealthSettings.parse(next);
  const updatedAt = new Date();
  await db
    .insert(settings)
    .values({ key: "pixel_health", value, encrypted: false, updatedAt })
    .onDuplicateKeyUpdate({ set: { value, encrypted: false, updatedAt } });
  invalidateSettings("pixel_health");
}

/**
 * Record outcomes. `throttle` (Purchase sends): skip pixels whose state/code did not change and
 * whose last write in this worker is < 10 min old. Never throws.
 */
export async function recordPixelHealth(updates: readonly HealthUpdate[], opts: { throttle?: boolean; now?: number } = {}): Promise<void> {
  try {
    const now = opts.now ?? Date.now();
    const due = updates.filter((u) => {
      if (!opts.throttle) return true;
      return healthWriteDue(lastWrite.get(pixelKey(u.platform, u.id)), u, now);
    });
    if (!due.length) return;
    const current = await getPixelHealth();
    const next: PixelHealth = { ...current };
    const at = new Date(now).toISOString();
    for (const u of due) {
      const key = pixelKey(u.platform, u.id);
      next[key] = { at, state: u.state, ...(u.code && u.state === "refused" ? { code: u.code } : {}), testMode: u.testMode };
      lastWrite.set(key, { state: u.state, code: u.code, at: now });
    }
    await writeHealth(next);
  } catch (err) {
    console.error("[pixels] health write failed:", err instanceof Error ? err.message : "unknown error");
  }
}

/** Drop the health of removed pixels. */
export async function forgetPixelHealth(keys: readonly string[]): Promise<void> {
  if (!keys.length) return;
  const current = await getPixelHealth();
  let changed = false;
  for (const k of keys) {
    if (k in current) {
      delete current[k];
      changed = true;
    }
    lastWrite.delete(k);
  }
  if (changed) await writeHealth(current);
}

/** True when the pixel_health row exists (tests / migration). */
export async function hasHealthRow(): Promise<boolean> {
  const rows = await db.select({ key: settings.key }).from(settings).where(eq(settings.key, "pixel_health")).limit(1);
  return rows.length > 0;
}
