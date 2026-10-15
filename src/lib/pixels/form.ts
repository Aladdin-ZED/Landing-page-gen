/**
 * Settings → Pixels form model — isomorphic (the client form validates with it as you type, the
 * server action re-validates with it before saving).
 *
 * One row per pixel: the id, and for Meta / TikTok the server token and the test event code.
 * Tokens travel as: "" (none / remove), the mask "••••3f9a" (keep the stored token of the row's
 * ORIGINAL id — rows can be re-typed or re-ordered without losing their token), or a new value.
 */
import { PIXEL_ID_RE, PIXEL_LIMIT, PIXEL_NAMES, PIXEL_PLATFORMS, isServerPlatform, normalizePixelId, type PixelPlatform } from "./ids";

export interface PixelRow {
  /** the id this row had when the page loaded ("" for a new row) — mask resolution */
  origin: string;
  id: string;
  /** "" · mask · new token (Meta / TikTok only) */
  token: string;
  /** "" or the platform's Test events code (Meta / TikTok only) */
  testCode: string;
}

export type PixelFormValues = Record<PixelPlatform, PixelRow[]>;

/** Field errors keyed "<platform>.<row>.<field>", e.g. "meta.1.id". */
export type PixelFormErrors = Record<string, string>;

export const MASK_RE = /^••••[^•]{0,4}$/;
export const isMask = (s: string) => MASK_RE.test(s);

/** Same rule as the stored secret schema (src/lib/settings/schemas.ts secretToken). */
export const TOKEN_RE = /^[A-Za-z0-9_\-.:|=+/]{8,512}$/;
export const TEST_CODE_RE = /^[A-Z0-9]{4,20}$/;

export const ID_HELP: Record<PixelPlatform, string> = {
  meta: "A Meta pixel ID is 6–20 digits, e.g. 1234567890123456.",
  tiktok: "A TikTok pixel ID is 8–30 capital letters and digits, e.g. C4ABCDEF12345678.",
  snap: "A Snap pixel ID looks like 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d.",
  ga4: "A GA4 measurement ID starts with G-, e.g. G-AB12CD34EF.",
};

export const emptyRow = (): PixelRow => ({ origin: "", id: "", token: "", testCode: "" });

/** A row the save drops: nothing typed in it. */
export const isBlankRow = (r: PixelRow) => !r.id.trim() && !r.token.trim() && !r.testCode.trim();

/** Rows with their id / test code in canonical form (what is validated and saved). */
export function normalizeForm(values: PixelFormValues): PixelFormValues {
  const out = {} as PixelFormValues;
  for (const p of PIXEL_PLATFORMS) {
    out[p] = (values[p] ?? []).map((r) => ({
      origin: String(r.origin ?? ""),
      id: normalizePixelId(p, String(r.id ?? "")),
      token: isServerPlatform(p) ? String(r.token ?? "").trim() : "",
      testCode: isServerPlatform(p) ? String(r.testCode ?? "").replace(/\s+/g, "").toUpperCase() : "",
    }));
  }
  return out;
}

/** Field errors of a (normalized) form; empty when it can be saved. */
export function validatePixelForm(values: PixelFormValues): PixelFormErrors {
  const errors: PixelFormErrors = {};
  for (const p of PIXEL_PLATFORMS) {
    const rows = values[p] ?? [];
    const kept = rows.filter((r) => !isBlankRow(r));
    if (kept.length > PIXEL_LIMIT[p]) errors[`${p}.0.id`] = `${PIXEL_NAMES[p]} takes up to ${PIXEL_LIMIT[p]} pixel${PIXEL_LIMIT[p] === 1 ? "" : "s"}.`;
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (isBlankRow(r)) return;
      const at = (f: keyof PixelRow) => `${p}.${i}.${f}`;
      if (!r.id) errors[at("id")] = "Add the pixel ID.";
      else if (!PIXEL_ID_RE[p].test(r.id)) errors[at("id")] = ID_HELP[p];
      else if (seen.has(r.id)) errors[at("id")] = "This pixel is already in the list.";
      seen.add(r.id);
      if (r.token && !isMask(r.token) && !TOKEN_RE.test(r.token)) errors[at("token")] = "This doesn't look like a valid token — paste it again.";
      if (r.testCode && !TEST_CODE_RE.test(r.testCode)) errors[at("testCode")] = "4–20 capital letters and digits, e.g. TEST12345.";
    });
  }
  return errors;
}

export type PixelStatus = "off" | "browser" | "partial" | "server";

/**
 * A platform's status for the admin: "off" (no pixel), "browser" (pixels, no server token),
 * "partial" (some pixels have a token) or "server" (every pixel has one).
 */
export function platformStatus(platform: PixelPlatform, rows: readonly PixelRow[]): PixelStatus {
  const live = rows.filter((r) => r.id && PIXEL_ID_RE[platform].test(r.id));
  if (!live.length) return "off";
  if (!isServerPlatform(platform)) return "browser";
  const withToken = live.filter((r) => !!r.token).length;
  return withToken === 0 ? "browser" : withToken === live.length ? "server" : "partial";
}
