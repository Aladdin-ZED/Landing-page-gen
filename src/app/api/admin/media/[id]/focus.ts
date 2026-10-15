import "server-only";
/**
 * The subject analysis of one library image (src/lib/media/focus.ts AssetFocus), for the framing
 * picker. Uploads analyse new images; rows from before the analysis existed (or analysed by an older
 * FOCUS_VERSION) are analysed here on first view — same input as scripts/media-backfill.ts (the
 * largest stored WebP rendition) — and the result is stored, so pages crop them too from then on.
 * The work itself lives in src/lib/media/ensure-focus.ts (shared with the builder bootstrap).
 */
import { ensureFocus, type AssetFocus, type AssetRecord } from "@/lib/media";

/** Stored analysis when current, else analysed now (once per id at a time) and stored. */
export function focusOfAsset(asset: AssetRecord): Promise<AssetFocus | null> {
  return ensureFocus(asset);
}
