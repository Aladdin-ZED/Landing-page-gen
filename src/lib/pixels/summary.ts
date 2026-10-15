/**
 * Store pixel summary — what the admin UIs (builder Pixels section, generate wizard) may know about
 * the store's ad pixels: public ids and booleans only, never a token. Isomorphic types + helpers;
 * the data comes from storePixelSummary() (src/lib/pixels/store.server.ts) or the server action
 * storePixelSummaryAction() (src/app/admin/(panel)/settings/pixels/actions.ts).
 *
 * Generate wizard (new page):
 *   const s = await storePixelSummaryAction();             // { ok, data: StorePixelSummary }
 *   show s.data.platforms[p] (id, server, testMode) as pickable chips, all picked by default;
 *   doc.tracking = trackingForNewPage(s.data, picked);       // PageDoc["tracking"]
 */
import type { Tracking } from "@/lib/page/schema";
import { PIXEL_PLATFORMS, isServerPlatform, type PixelPlatform, type ServerPlatform } from "./ids";
import { trackingFromLists } from "./tracking";

export interface StorePixel {
  id: string;
  /** server-side events (Conversions API / Events API token) reach this pixel */
  server: boolean;
  /** a test event code is set: its server events land in Test events only */
  testMode: boolean;
}

export interface StorePixelSummary {
  /** the store pixels per platform, in order (first = main) */
  platforms: Record<PixelPlatform, StorePixel[]>;
  /** every store pixel as a PageDoc tracking value — what a new page gets by default */
  tracking: Tracking;
  /** at least one store pixel */
  configured: boolean;
  /**
   * Server tokens beyond the store list: pixel ids with their own token, and whether a legacy
   * single token covers any other id (pages may use ids that are not store defaults).
   */
  server: Record<ServerPlatform, { ids: string[]; anyId: boolean }>;
}

/** Whether server-side events reach a pixel id (store pixel or not). */
export function serverEventsFor(s: Pick<StorePixelSummary, "server">, platform: PixelPlatform, id: string): boolean {
  if (!isServerPlatform(platform)) return false;
  const x = s.server[platform];
  return x.anyId || x.ids.includes(id);
}

/**
 * The tracking of a new page from the store pixels the user kept (default: all of them). Ids that
 * are not store pixels are accepted too (validated, normalized) — e.g. typed in the wizard.
 */
export function trackingForNewPage(s: Pick<StorePixelSummary, "platforms">, picked?: Partial<Record<PixelPlatform, readonly string[]>>): Tracking {
  const lists: Partial<Record<PixelPlatform, readonly string[]>> = {};
  for (const p of PIXEL_PLATFORMS) lists[p] = picked?.[p] ?? s.platforms[p].map((x) => x.id);
  return trackingFromLists(lists);
}
