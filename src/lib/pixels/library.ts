/**
 * Pixel library — the pure parts (docs/OFFERS.md §A.2–A.4), isomorphic, no I/O:
 *
 *   testWindow(lib, platform, id, pageId, now)   the active test window of a pixel for ONE page
 *   withEntry / withoutEntry / pruneLibrary       library edits (expired windows dropped)
 *   trackingRefs / trackingDiff / editTracking    a page's pixels as refs, live diff, edits
 *   pixelLabel / maskPixelId / pixelStatus        what the admin shows (never a token)
 *
 * Pixels belong to pages: the library is only the list of pixels the store knows (ids, labels, test
 * windows), so the wizard and the builder can pick them quickly. Nothing here copies pixels into pages.
 */
import type { Tracking } from "@/lib/page/schema";
import type { PixelHealth, PixelHealthEntry, PixelLibraryEntry, PixelTestWindow, SettingValue } from "@/lib/settings/schemas";
import { PIXEL_NAMES, PIXEL_PLATFORMS, isServerPlatform, type PixelPlatform } from "./ids";
import { trackingFromLists, trackingIds, trackingLists, withTrackingIds } from "./tracking";

export type { PixelHealth, PixelHealthEntry, PixelLibraryEntry, PixelTestWindow };
export type PixelLibrary = SettingValue<"pixel_library">;

/** Test windows last 30, 60 or 120 minutes; at most 5 per pixel. */
export const TEST_MINUTES = [30, 60, 120] as const;
export type TestMinutes = (typeof TEST_MINUTES)[number];
export const TEST_WINDOWS_MAX = 5;
export const LABEL_MAX = 40;

/** Key of a pixel in pixel_health and in UI maps. */
export const pixelKey = (platform: PixelPlatform, id: string) => `${platform}:${id}`;

/** "••••3456": enough to recognize a pixel, not to copy it. */
export const maskPixelId = (id: string) => (id.length > 6 ? `••••${id.slice(-4)}` : id);

export const emptyLibrary = (): PixelLibrary => ({ v: 1, pixels: [] });

const ms = (iso: string) => Date.parse(iso);
export const isActiveWindow = (w: PixelTestWindow, now: number) => ms(w.until) > now;

export function findEntry(lib: PixelLibrary | null | undefined, platform: PixelPlatform, id: string): PixelLibraryEntry | undefined {
  return lib?.pixels.find((p) => p.platform === platform && p.id === id);
}

/** The active test window of a pixel for this page (expired windows are ignored), else null. */
export function testWindow(lib: PixelLibrary | null | undefined, platform: PixelPlatform, id: string, pageId: string, now: number): PixelTestWindow | null {
  const e = findEntry(lib, platform, id);
  return e?.tests.find((w) => w.pageId === pageId && isActiveWindow(w, now)) ?? null;
}

/** Active windows of an entry. */
export const activeWindows = (e: Pick<PixelLibraryEntry, "tests">, now: number) => e.tests.filter((w) => isActiveWindow(w, now));

/** The library without expired test windows. */
export function pruneLibrary(lib: PixelLibrary, now: number): PixelLibrary {
  return { v: 1, pixels: lib.pixels.map((p) => ({ ...p, tests: activeWindows(p, now) })) };
}

/** The library with `entry` added (appended) or replaced in place. */
export function withEntry(lib: PixelLibrary, entry: PixelLibraryEntry): PixelLibrary {
  const i = lib.pixels.findIndex((p) => p.platform === entry.platform && p.id === entry.id);
  const pixels = [...lib.pixels];
  if (i >= 0) pixels[i] = entry;
  else pixels.push(entry);
  return { v: 1, pixels };
}

export function withoutEntry(lib: PixelLibrary, platform: PixelPlatform, id: string): PixelLibrary {
  return { v: 1, pixels: lib.pixels.filter((p) => !(p.platform === platform && p.id === id)) };
}

/* ------------------------------------------------------------------ */
/* a page's pixels                                                     */
/* ------------------------------------------------------------------ */

export interface PixelRef {
  platform: PixelPlatform;
  id: string;
}

type TrackingLike = Partial<Record<string, unknown>> | null | undefined;

/** Every pixel of a tracking value (platform order, then list order). Reads raw JSON too. */
export function trackingRefs(t: TrackingLike): PixelRef[] {
  return PIXEL_PLATFORMS.flatMap((platform) => trackingIds(t, platform).map((id) => ({ platform, id })));
}

/** Ids added to and removed from `prev` (live) by `next` (draft). */
export function trackingDiff(next: TrackingLike, prev: TrackingLike): { added: PixelRef[]; removed: PixelRef[] } {
  const a = trackingRefs(next);
  const b = trackingRefs(prev);
  const has = (list: PixelRef[], r: PixelRef) => list.some((x) => x.platform === r.platform && x.id === r.id);
  return { added: a.filter((r) => !has(b, r)), removed: b.filter((r) => !has(a, r)) };
}

/** The page answered the pixel question: it has ids, or "No pixel on this page". */
export const hasPixelAnswer = (t: TrackingLike) => trackingRefs(t).length > 0 || (!!t && t.none === true);

/** No ids and no explicit "No pixel": a live page in this state gets the "No pixel" filter and warning. */
export const missingPixels = (t: TrackingLike) => !hasPixelAnswer(t);

/**
 * The tracking after an owner edit of one platform's ids: "No pixel" is dropped once an id is set,
 * and an edit answers "Pixels copied from {page}" (copiedFrom cleared).
 */
export function editTracking(t: Tracking, platform: PixelPlatform, ids: readonly string[]): Tracking {
  const next = withTrackingIds(t, platform, ids);
  delete next.copiedFrom;
  if (trackingRefs(next).length) delete next.none;
  return next;
}

/** "No pixel on this page" (organic / test): no ids. */
export const noPixelTracking = (): Tracking => ({ none: true });

/** The ids of a tracking value only (no `none`, no `copiedFrom`): what a live page fires. */
export const idsOnly = (t: TrackingLike): Tracking => trackingFromLists(trackingLists(t));

/** Same ids, same order, every platform. */
export const sameIds = (a: TrackingLike, b: TrackingLike) => JSON.stringify(trackingRefs(a)) === JSON.stringify(trackingRefs(b));

/* ------------------------------------------------------------------ */
/* admin view (never a token)                                          */
/* ------------------------------------------------------------------ */

export interface PixelUsageCount {
  /** pages whose draft or live version uses the pixel */
  pages: number;
  /** live pages firing it */
  live: number;
  /** non-revoked exports firing it */
  exports: number;
  /** pages whose draft uses it */
  drafts: number;
}

export const NO_USAGE: PixelUsageCount = { pages: 0, live: 0, exports: 0, drafts: 0 };

export interface LibraryPixel {
  platform: PixelPlatform;
  id: string;
  label: string;
  addedAt: string;
  /** a server token is saved for this pixel (Meta / TikTok) */
  server: boolean;
  /** the saved token as a mask ("••••3f9a"): what the edit form shows (owners) */
  tokenMask?: string;
  /** a test event code is saved (used only inside a page's test window) */
  testCode: boolean;
  /** active test windows (page names resolved) */
  activeTests: { pageId: string; until: string; pageName: string }[];
  health: PixelHealthEntry | null;
  usage: PixelUsageCount;
}

/** The pixel library as the admin UIs see it (labels and booleans, never a token). */
export interface PixelLibraryView {
  pixels: LibraryPixel[];
  /** the user may add new ids and edit tokens (settings.write) */
  canCreate: boolean;
}

/** A pixel's name for people: its label, else "Meta ••••3456". */
export function pixelLabel(p: { platform: PixelPlatform; id: string; label?: string } | undefined, platform?: PixelPlatform, id?: string): string {
  const pl = p?.platform ?? platform!;
  const pid = p?.id ?? id!;
  return p?.label?.trim() || `${PIXEL_NAMES[pl]} ${maskPixelId(pid)}`;
}

export type PixelStatusKind = "browser" | "server" | "test";

/**
 * What a pixel does on a page (or anywhere, without a page): Browser only, Browser + server, or
 * Test mode with the minutes left of the window (a page's window, else the soonest-ending one).
 */
export function pixelStatus(p: Pick<LibraryPixel, "platform" | "server" | "activeTests">, now: number, pageId?: string): { kind: PixelStatusKind; minutesLeft?: number; pageName?: string } {
  if (!isServerPlatform(p.platform) || !p.server) return { kind: "browser" };
  const windows = p.activeTests.filter((w) => ms(w.until) > now && (!pageId || w.pageId === pageId)).sort((a, b) => ms(a.until) - ms(b.until));
  const w = windows[0];
  if (!w) return { kind: "server" };
  return { kind: "test", minutesLeft: Math.max(1, Math.ceil((ms(w.until) - now) / 60_000)), pageName: w.pageName };
}

const HEALTH_CODE_TEXT: Record<NonNullable<PixelHealthEntry["code"]>, string> = {
  token: "token",
  permission: "permission",
  pixel: "pixel",
  rate: "rate limit",
  network: "network",
  other: "error",
};

/** "14:02" in the viewer's time zone (24 h). */
export const clock = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

/** Health line: "Server OK · 14:02" / "Refused (permission) · 13:40" / "Unverified: send a test event". */
export function healthText(h: PixelHealthEntry | null | undefined, withTime = true): { tone: "ok" | "refused" | "unverified"; text: string } | null {
  if (!h) return null;
  const at = withTime ? ` · ${clock(h.at)}` : "";
  if (h.state === "ok") return { tone: "ok", text: `Server OK${at}` };
  if (h.state === "refused") return { tone: "refused", text: `Refused (${HEALTH_CODE_TEXT[h.code ?? "other"]})${at}` };
  return { tone: "unverified", text: "Unverified: send a test event" };
}

/** "Used on 3 pages · 2 live · 1 export". */
export function usageText(u: PixelUsageCount): string {
  if (!u.pages && !u.exports) return "Not used yet";
  const parts = [`Used on ${u.pages} page${u.pages === 1 ? "" : "s"}`];
  if (u.live) parts.push(`${u.live} live`);
  if (u.exports) parts.push(`${u.exports} export${u.exports === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Removed from every draft but still firing somewhere (live page or export). */
export const isDetached = (u: PixelUsageCount) => u.drafts === 0 && (u.live > 0 || u.exports > 0);

export const inUse = (u: PixelUsageCount) => u.pages > 0 || u.exports > 0;

/** A pixel of the library view (labels, flags), if the library knows it. */
export function findEntryView(view: Pick<PixelLibraryView, "pixels"> | null | undefined, platform: PixelPlatform, id: string): LibraryPixel | undefined {
  return view?.pixels.find((p) => p.platform === platform && p.id === id);
}

/** Health writes after Purchase sends: when the state or code changes, else at most every 10 min per pixel (§A.5). */
export const HEALTH_THROTTLE_MS = 10 * 60_000;
export function healthWriteDue(prev: { state: string; code?: string; at: number } | undefined, next: { state: string; code?: string }, now: number): boolean {
  return !prev || prev.state !== next.state || prev.code !== next.code || now - prev.at >= HEALTH_THROTTLE_MS;
}

/** The health map of a library view (pixelChecks' `health` from pixelLibraryAction / pagePixelsAction data). */
export function healthMap(view: Pick<PixelLibraryView, "pixels"> | null | undefined): PixelHealth {
  const out: PixelHealth = {};
  for (const p of view?.pixels ?? []) if (p.health) out[pixelKey(p.platform, p.id)] = p.health;
  return out;
}
