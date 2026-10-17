/**
 * Pixel input rules — isomorphic (the admin forms validate with them as you type, the server
 * re-validates with them before saving): id help per platform, token and test-code formats, and the
 * token mask. Tokens travel as "" (none / remove), the mask "••••3f9a" (keep the stored token) or a
 * new value.
 */
import type { PixelPlatform } from "./ids";

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
