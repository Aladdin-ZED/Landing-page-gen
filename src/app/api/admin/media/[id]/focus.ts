import "server-only";
/**
 * The subject analysis of one library image (src/lib/media/focus.ts AssetFocus), for the framing
 * picker. Uploads analyse new images; rows from before the analysis existed (or analysed by an older
 * FOCUS_VERSION) are analysed here on first view — same input as scripts/media-backfill.ts (the
 * largest stored WebP rendition) — and the result is stored, so pages crop them too from then on.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { FOCUS_VERSION, getMediaFile, parseFocus, type AssetFocus, type AssetRecord } from "@/lib/media";
import { analyzeImageFocus } from "@/lib/media/focus-analyze";

declare global {
  var __codFocusFlights: Map<string, Promise<AssetFocus | null>> | undefined;
}

const flights = () => (globalThis.__codFocusFlights ??= new Map());

function largestRendition(asset: AssetRecord) {
  const still = asset.variants.filter((v) => v.fmt === "webp" || v.fmt === "png" || v.fmt === "jpeg");
  const webp = still.filter((v) => v.fmt === "webp");
  const pool = webp.length ? webp : still;
  return [...pool].sort((a, b) => b.w - a.w)[0] ?? null;
}

async function analyse(asset: AssetRecord, stored: AssetFocus | null): Promise<AssetFocus | null> {
  const variant = largestRendition(asset);
  const file = variant ? await getMediaFile(variant.key) : null;
  if (!file) return stored;
  let focus: AssetFocus;
  try {
    focus = await analyzeImageFocus(file.data, { alpha: asset.alpha });
  } catch {
    return stored;
  }
  await db.update(assets).set({ focus, focusVersion: FOCUS_VERSION }).where(eq(assets.id, asset.id));
  return focus;
}

/** Stored analysis when current, else analysed now (once per id at a time) and stored. */
export async function focusOfAsset(asset: AssetRecord): Promise<AssetFocus | null> {
  if (asset.kind !== "image") return null;
  const stored = parseFocus(asset.focus);
  if (stored && (asset.focusVersion ?? 0) >= FOCUS_VERSION) return stored;
  const map = flights();
  let p = map.get(asset.id);
  if (!p) {
    p = analyse(asset, stored).finally(() => map.delete(asset.id));
    map.set(asset.id, p);
  }
  return p;
}
