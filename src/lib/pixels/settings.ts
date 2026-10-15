/**
 * Store pixel settings — the pure parts (no I/O, unit-tested in scripts/qa/conversions-check.ts):
 *
 *   summarize(pixels, secrets)              → StorePixelSummary (ids + flags, never a token)
 *   pixelFormValues(pixels, secrets)        → Settings → Pixels rows (tokens masked)
 *   resolvePixelSettings(rows, secrets)     → the settings a submitted form produces
 *
 * Server code only (reads secrets); the I/O wrappers live in ./store.server.ts.
 */
import { serverCredentials, type TrackingSecrets } from "@/lib/orders/conversions-core";
import type { Tracking } from "@/lib/page/schema";
import { maskSecret } from "@/lib/settings/schemas";
import { PIXEL_PLATFORMS, SERVER_PLATFORMS, isServerPlatform, type PixelPlatform, type ServerPlatform } from "./ids";
import { isBlankRow, isMask, normalizeForm, validatePixelForm, type PixelFormValues, type PixelRow } from "./form";
import type { StorePixel, StorePixelSummary } from "./summary";
import { hasAnyPixel, trackingFromLists, trackingIds } from "./tracking";

const TOKEN_MAP = { meta: "metaTokens", tiktok: "tiktokTokens" } as const;
const TEST_MAP = { meta: "metaTestCodes", tiktok: "tiktokTestCodes" } as const;
const LEGACY_TOKEN = { meta: "metaCapiToken", tiktok: "tiktokToken" } as const;
const LEGACY_TEST = { meta: "metaTestEventCode", tiktok: "tiktokTestEventCode" } as const;

/** The test event code server events of this pixel carry (own, else the legacy single one). */
function testCodeOf(s: TrackingSecrets, p: ServerPlatform, id: string): string {
  return s[TEST_MAP[p]]?.[id] || s[LEGACY_TEST[p]] || "";
}

/* ------------------------------------------------------------------ */
/* summary (builder, generate wizard)                                  */
/* ------------------------------------------------------------------ */

export function summarize(pixels: Tracking, secrets: TrackingSecrets): StorePixelSummary {
  const platforms = {} as Record<PixelPlatform, StorePixel[]>;
  for (const p of PIXEL_PLATFORMS) {
    platforms[p] = trackingIds(pixels, p).map((id) => {
      const cred = isServerPlatform(p) ? serverCredentials(secrets, p, id) : null;
      return { id, server: !!cred, testMode: !!cred?.testCode };
    });
  }
  const server = {} as StorePixelSummary["server"];
  for (const p of SERVER_PLATFORMS) server[p] = { ids: Object.keys(secrets[TOKEN_MAP[p]] ?? {}), anyId: !!secrets[LEGACY_TOKEN[p]] };
  const tracking = trackingFromLists(Object.fromEntries(PIXEL_PLATFORMS.map((p) => [p, platforms[p].map((x) => x.id)])));
  return { platforms, tracking, configured: hasAnyPixel(tracking), server };
}

/* ------------------------------------------------------------------ */
/* Settings → Pixels form                                              */
/* ------------------------------------------------------------------ */

/** Form rows of the saved settings (tokens as masks). */
export function pixelFormValues(pixels: Tracking, secrets: TrackingSecrets): PixelFormValues {
  const out = {} as PixelFormValues;
  for (const p of PIXEL_PLATFORMS) {
    out[p] = trackingIds(pixels, p).map((id): PixelRow => {
      if (!isServerPlatform(p)) return { origin: id, id, token: "", testCode: "" };
      const cred = serverCredentials(secrets, p, id);
      return { origin: id, id, token: cred ? maskSecret(cred.token) : "", testCode: testCodeOf(secrets, p, id) };
    });
  }
  return out;
}

export class PixelSettingsError extends Error {}

/**
 * The settings a submitted form produces (pure): the store pixel lists, and the server secrets with
 * per-pixel tokens / test codes. Masked tokens resolve to the stored token of the row's ORIGINAL id
 * (its own or the legacy single token). Once a platform has rows, its legacy single token / test
 * code are folded into the rows and cleared. Snap / GA4 secrets are kept as they are.
 */
export function resolvePixelSettings(submitted: PixelFormValues, current: TrackingSecrets): { pixels: Tracking; secrets: TrackingSecrets } {
  const values = normalizeForm(submitted);
  const errors = validatePixelForm(values);
  const first = Object.values(errors)[0];
  if (first) throw new PixelSettingsError(first);

  const lists = {} as Record<PixelPlatform, string[]>;
  const secrets: TrackingSecrets = { ...current };
  for (const p of PIXEL_PLATFORMS) {
    const rows = values[p].filter((r) => !isBlankRow(r));
    lists[p] = rows.map((r) => r.id);
    if (!isServerPlatform(p)) continue;
    const tokens: Record<string, string> = {};
    const codes: Record<string, string> = {};
    for (const r of rows) {
      let token = "";
      if (isMask(r.token)) {
        token = r.origin ? (serverCredentials(current, p, r.origin)?.token ?? "") : "";
        if (!token) throw new PixelSettingsError(`The saved token of ${r.id} is no longer there — paste it again.`);
      } else token = r.token;
      if (token) tokens[r.id] = token;
      if (r.testCode) codes[r.id] = r.testCode;
    }
    secrets[TOKEN_MAP[p]] = tokens;
    secrets[TEST_MAP[p]] = codes;
    if (rows.length) {
      secrets[LEGACY_TOKEN[p]] = undefined;
      secrets[LEGACY_TEST[p]] = undefined;
    }
  }
  return { pixels: trackingFromLists(lists), secrets };
}
