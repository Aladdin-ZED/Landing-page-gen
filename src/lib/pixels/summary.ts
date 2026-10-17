/**
 * @deprecated Store pixel summary — the store-wide pixel defaults are gone (docs/OFFERS.md §A:
 * pixels belong to pages; Settings → Pixels is a library). Kept for one release so the generate
 * wizard compiles until it mounts PageTrackingChoice (src/components/admin/pixels): the
 * deprecated storePixelSummaryAction() answers emptySummary(), so nothing is pre-ticked or copied
 * into new pages. Use pixelLibraryAction() and the library view (src/lib/pixels/library.ts).
 */
import type { Tracking } from "@/lib/page/schema";
import { PIXEL_PLATFORMS, isServerPlatform, type PixelPlatform, type ServerPlatform } from "./ids";
import { trackingFromLists } from "./tracking";

export interface StorePixel {
  id: string;
  server: boolean;
  testMode: boolean;
}

export interface StorePixelSummary {
  platforms: Record<PixelPlatform, StorePixel[]>;
  tracking: Tracking;
  configured: boolean;
  server: Record<ServerPlatform, { ids: string[]; anyId: boolean }>;
}

/** The summary the deprecated action answers: no store pixels (no store-wide auto-fill). */
export function emptySummary(): StorePixelSummary {
  return {
    platforms: { meta: [], tiktok: [], snap: [], ga4: [] },
    tracking: {},
    configured: false,
    server: { meta: { ids: [], anyId: false }, tiktok: { ids: [], anyId: false } },
  };
}

/** @deprecated */
export function serverEventsFor(s: Pick<StorePixelSummary, "server">, platform: PixelPlatform, id: string): boolean {
  if (!isServerPlatform(platform)) return false;
  const x = s.server[platform];
  return x.anyId || x.ids.includes(id);
}

/** @deprecated the wizard's PageTrackingChoice gives the page's tracking directly */
export function trackingForNewPage(s: Pick<StorePixelSummary, "platforms">, picked?: Partial<Record<PixelPlatform, readonly string[]>>): Tracking {
  const lists: Partial<Record<PixelPlatform, readonly string[]>> = {};
  for (const p of PIXEL_PLATFORMS) lists[p] = picked?.[p] ?? s.platforms[p].map((x) => x.id);
  return trackingFromLists(lists);
}
