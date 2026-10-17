/**
 * Pixel library migration — the pure part (docs/OFFERS.md §A.6), unit-tested by
 * scripts/qa/conversions-check.ts; the I/O lives in ./migrate.server.ts.
 */
import type { PixelPlatform } from "./ids";
import { LABEL_MAX, maskPixelId, pixelKey, trackingRefs } from "./library";

/** Collected pixels in migration order (pure on the scanned rows; exported for the QA check). */
export function collectPixels(
  store: Record<string, unknown> | null,
  sources: readonly { pageName: string; tracking: Record<string, unknown> | null }[],
): { platform: PixelPlatform; id: string; store: boolean; firstPage: string | null; uses: number }[] {
  const found = new Map<string, { platform: PixelPlatform; id: string; store: boolean; firstPage: string | null; uses: number; seq: number }>();
  let seq = 0;
  for (const r of trackingRefs(store)) found.set(pixelKey(r.platform, r.id), { ...r, store: true, firstPage: null, uses: 0, seq: seq++ });
  for (const s of sources) {
    for (const r of trackingRefs(s.tracking)) {
      const k = pixelKey(r.platform, r.id);
      const cur = found.get(k) ?? { ...r, store: false, firstPage: null, uses: 0, seq: seq++ };
      cur.uses++;
      if (!cur.firstPage) cur.firstPage = s.pageName;
      found.set(k, cur);
    }
  }
  return [...found.values()]
    .sort((a, b) => Number(b.store) - Number(a.store) || (a.store ? a.seq - b.seq : b.uses - a.uses || a.seq - b.seq))
    .map((x) => ({ platform: x.platform, id: x.id, store: x.store, firstPage: x.firstPage, uses: x.uses }));
}

/** Library labels: store ids per platform "Pixel principal", "Pixel 2"…; others "{page} · ••••4321". */
export function migrationLabel(p: { platform: PixelPlatform; id: string; store: boolean; firstPage: string | null }, storeIndex: number): string {
  if (p.store) return storeIndex === 0 ? "Pixel principal" : `Pixel ${storeIndex + 1}`;
  const tail = ` · ${maskPixelId(p.id)}`;
  const name = (p.firstPage ?? "Page").replace(/\s+/g, " ").trim();
  return `${name.slice(0, Math.max(1, LABEL_MAX - tail.length))}${tail}`.slice(0, LABEL_MAX);
}
