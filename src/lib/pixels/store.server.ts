import "server-only";
/**
 * Store-level ad pixels (settings "pixels" + "tracking_secrets"):
 *
 *   storePixelSummary()           ids + server/test flags for the builder and the generate wizard
 *   pixelFormValues(…)            Settings → Pixels form rows (tokens masked)
 *   savePixelSettings(rows, …)    validate, resolve masked tokens, write both settings
 *   applyStorePixelsToDrafts(…)   "Apply to pages": the store lists into every page draft
 *
 * Tokens never leave this module unmasked.
 */
import { and, eq, ne } from "drizzle-orm";
import { affected } from "@/lib/admin-data/pages";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { serverCredentials } from "@/lib/orders/conversions-core";
import type { PageDoc, Tracking } from "@/lib/page/schema";
import { getSetting, getSettings, setSetting, type SettingsActor } from "@/lib/settings";
import { isMask, type PixelFormValues } from "./form";
import { PIXEL_PLATFORMS, type PixelPlatform, type ServerPlatform } from "./ids";
import { pixelFormValues, resolvePixelSettings, summarize } from "./settings";
import type { StorePixelSummary } from "./summary";
import { mergeStorePixels, sameTracking, trackingIds } from "./tracking";

export { PixelSettingsError, pixelFormValues } from "./settings";

/** The store's pixels for admin UIs: ids, server/test flags — never a token. */
export async function storePixelSummary(): Promise<StorePixelSummary> {
  const { pixels, tracking_secrets } = await getSettings(["pixels", "tracking_secrets"]);
  return summarize(pixels, tracking_secrets);
}

/** Validate + save the Pixels form; returns the saved rows (masked) for the form's new baseline. */
export async function savePixelSettings(submitted: PixelFormValues, actor: SettingsActor): Promise<PixelFormValues> {
  const current = await getSetting("tracking_secrets", { fresh: true });
  const next = resolvePixelSettings(submitted, current);
  const pixels = await setSetting("pixels", next.pixels, actor);
  const secrets = await setSetting("tracking_secrets", next.secrets, actor);
  return pixelFormValues(pixels, secrets);
}

/** The stored server token of a pixel row (mask → stored; "" → none; else the typed token). */
export async function rowToken(platform: ServerPlatform, origin: string, token: string): Promise<string> {
  if (!isMask(token)) return token.trim();
  if (!origin) return "";
  const secrets = await getSetting("tracking_secrets", { fresh: true });
  return serverCredentials(secrets, platform, origin)?.token ?? "";
}

/* ------------------------------------------------------------------ */
/* Apply to pages                                                      */
/* ------------------------------------------------------------------ */

/**
 * Copy the store's pixel lists into every non-archived page draft: each platform the store has ids
 * for takes the store's list (a page keeps its own ids for the others). Each draft is updated with the
 * builder's compare-and-swap on updatedAt, so a page being edited elsewhere is skipped, never
 * overwritten. Live pages get "unpublished changes": the pixels reach visitors at the next publish.
 */
export async function applyStorePixelsToDrafts(actor: SettingsActor): Promise<{ updated: number; live: number; skipped: number; platforms: PixelPlatform[] }> {
  const store = await getSetting("pixels", { fresh: true });
  const platforms = PIXEL_PLATFORMS.filter((p) => trackingIds(store, p).length > 0);
  if (!platforms.length) return { updated: 0, live: 0, skipped: 0, platforms };
  const rows = await db
    .select({ id: pages.id, status: pages.status, draft: pages.draft, updatedAt: pages.updatedAt })
    .from(pages)
    .where(ne(pages.status, "archived"))
    .limit(1000);
  let updated = 0;
  let live = 0;
  let skipped = 0;
  for (const r of rows) {
    const draft: unknown = r.draft;
    if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
      skipped++;
      continue;
    }
    const raw = (draft as { tracking?: unknown }).tracking;
    const current = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Tracking;
    const tracking = mergeStorePixels(current, store, "replace");
    if (sameTracking(current, tracking, platforms)) continue;
    const next = { ...(draft as PageDoc), tracking };
    const res = await db
      .update(pages)
      .set({ draft: next, updatedAt: new Date(Math.max(Date.now(), r.updatedAt.getTime() + 1)) })
      .where(and(eq(pages.id, r.id), eq(pages.updatedAt, r.updatedAt)));
    if (affected(res) === 1) {
      updated++;
      if (r.status === "published") live++;
    } else skipped++;
  }
  if (updated) await audit("page.pixels_applied", { userId: actor.id, meta: { pages: updated, platforms }, ip: actor.ip });
  return { updated, live, skipped, platforms };
}
