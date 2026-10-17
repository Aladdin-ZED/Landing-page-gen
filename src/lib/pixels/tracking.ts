/**
 * Helpers on a page's (or the store's) Tracking value — isomorphic, no I/O.
 *
 * Shape (PageDoc.tracking, store setting "pixels"):
 *   { metaPixelId?: string[]; tiktokPixelId?: string[]; snapPixelId?: string[]; ga4Id?: string[] }
 * Each list holds 1…PIXEL_LIMIT valid ids; a platform without ids has no key (never []).
 * Older documents stored single strings; the schema reads them as one-id lists.
 */
import type { LandingRuntimeConfigV1 as LandingRuntimeConfig } from "@/landing/runtime/config";
import type { Tracking } from "@/lib/page/schema";
import type { PixelFlags } from "@/lib/render/csp";
import { PIXEL_PLATFORMS, TRACKING_KEYS, normalizePixelId, pixelIdList, type PixelPlatform } from "./ids";

export type { Tracking };

/** The valid ids of one platform (also reads legacy single-string values). */
export function trackingIds(t: Partial<Record<string, unknown>> | null | undefined, platform: PixelPlatform): string[] {
  return pixelIdList(platform, t ? t[TRACKING_KEYS[platform]] : undefined);
}

/** Every platform's ids. */
export function trackingLists(t: Partial<Record<string, unknown>> | null | undefined): Record<PixelPlatform, string[]> {
  return { meta: trackingIds(t, "meta"), tiktok: trackingIds(t, "tiktok"), snap: trackingIds(t, "snap"), ga4: trackingIds(t, "ga4") };
}

/**
 * A Tracking value from id lists (normalized, validated, deduplicated, capped; empty platforms
 * omitted) — the shape to write into a new PageDoc or the store setting.
 */
export function trackingFromLists(lists: Partial<Record<PixelPlatform, readonly string[] | undefined>>): Tracking {
  const out: Tracking = {};
  for (const p of PIXEL_PLATFORMS) {
    const ids = pixelIdList(
      p,
      (lists[p] ?? []).map((s) => normalizePixelId(p, s)),
    );
    if (ids.length) out[TRACKING_KEYS[p]] = ids;
  }
  return out;
}

/** `t` with one platform's ids replaced (an empty list removes the platform). */
export function withTrackingIds(t: Tracking, platform: PixelPlatform, ids: readonly string[]): Tracking {
  const next: Tracking = { ...t };
  const list = pixelIdList(platform, ids.map((s) => normalizePixelId(platform, s)));
  if (list.length) next[TRACKING_KEYS[platform]] = list;
  else delete next[TRACKING_KEYS[platform]];
  return next;
}

export function hasAnyPixel(t: Partial<Record<string, unknown>> | null | undefined): boolean {
  return PIXEL_PLATFORMS.some((p) => trackingIds(t, p).length > 0);
}

/** Same ids in the same order for every platform (or the given ones). */
export function sameTracking(
  a: Partial<Record<string, unknown>> | null | undefined,
  b: Partial<Record<string, unknown>> | null | undefined,
  platforms: readonly PixelPlatform[] = PIXEL_PLATFORMS,
): boolean {
  return platforms.every((p) => trackingIds(a, p).join(",") === trackingIds(b, p).join(","));
}

/** The runtime config's `pixels` (public ids only). */
export function runtimePixels(t: Partial<Record<string, unknown>> | null | undefined): LandingRuntimeConfig["pixels"] {
  const out: LandingRuntimeConfig["pixels"] = {};
  for (const p of PIXEL_PLATFORMS) {
    const ids = trackingIds(t, p);
    if (ids.length) out[p] = ids;
  }
  return out;
}

/** Which platforms a document loads (CSP hosts). */
export function trackingFlags(t: Partial<Record<string, unknown>> | null | undefined): PixelFlags {
  const lists = trackingLists(t);
  return { meta: lists.meta.length > 0, tiktok: lists.tiktok.length > 0, snap: lists.snap.length > 0, ga4: lists.ga4.length > 0 };
}

/**
 * @deprecated (GN removes the last caller) — pages own their pixels; nothing fills them from the store.
 * Store pixels into a page's tracking:
 *  - "fill": only platforms the page has no ids for (a page's own ids always win) — new pages;
 *  - "replace": every platform the store has ids for takes the store's list (others untouched) —
 *    "Apply to pages".
 */
export function mergeStorePixels(page: Tracking, store: Tracking, mode: "fill" | "replace"): Tracking {
  let next: Tracking = { ...page };
  for (const p of PIXEL_PLATFORMS) {
    const ids = trackingIds(store, p);
    if (!ids.length) continue;
    if (mode === "fill" && trackingIds(page, p).length) continue;
    next = withTrackingIds(next, p, ids);
  }
  return next;
}
