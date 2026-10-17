/**
 * Which published version an order is validated against (docs/OFFERS.md §G.2, D8) — the pure rule
 * behind resolve.ts orderVersion(): the shopper's tab keeps ordering against the version it was
 * rendered from while that version was replaced less than 72 h ago; otherwise the current version
 * is used with `fallback` (the validation then answers "stale" on any mismatch and the runtime
 * reloads the page).
 *
 *  - v2 payload: `ver` = current → current; `ver` = a publish version of this page replaced < 72 h
 *    ago → that version; anything else → current + fallback;
 *  - v1 payload (no `ver`, old runtimes): the newest publish version with runtime_v = 1, when it is
 *    current or was replaced < 72 h ago; else current + fallback.
 *
 * orderDocOf(raw, id) — a stored version's document for orders, repaired when it must be.
 * Pure (no database): resolve.ts loads the rows.
 */
import { PageDoc } from "@/lib/page/schema";

/** A replaced version keeps taking orders this long after its replacement was published (open tabs). */
export const STALE_WINDOW_MS = 72 * 3600_000;

/** A "publish" version of the page (any order). */
export interface PublishRow {
  id: string;
  createdAt: Date;
  /** runtime contract of its HTML (page_versions.runtime_v) */
  runtimeV: number;
}

export interface VersionChoice {
  versionId: string;
  fallback: boolean;
}

/** The publish that replaced `row` (the earliest one created after it), if any. */
function replacedBy(rows: readonly PublishRow[], row: PublishRow): PublishRow | null {
  let next: PublishRow | null = null;
  for (const r of rows) {
    if (r.createdAt.getTime() <= row.createdAt.getTime() || r.id === row.id) continue;
    if (!next || r.createdAt.getTime() < next.createdAt.getTime()) next = r;
  }
  return next;
}

/** `row` is current, or its replacement was published less than 72 h ago. */
function inWindow(rows: readonly PublishRow[], row: PublishRow, currentId: string, now: number): boolean {
  if (row.id === currentId) return true;
  const next = replacedBy(rows, row);
  return !next || now - next.createdAt.getTime() < STALE_WINDOW_MS;
}

export function chooseOrderVersion(currentId: string, rows: readonly PublishRow[], payload: { v?: unknown; ver?: unknown }, now: number): VersionChoice {
  const current: VersionChoice = { versionId: currentId, fallback: false };
  if (payload.v === 2) {
    const ver = typeof payload.ver === "string" ? payload.ver : "";
    if (ver && ver === currentId) return current;
    const row = ver ? rows.find((r) => r.id === ver) : undefined;
    if (row && inWindow(rows, row, currentId, now)) return { versionId: row.id, fallback: false };
    return { versionId: currentId, fallback: true };
  }
  let v1: PublishRow | null = null;
  for (const r of rows) if (r.runtimeV === 1 && (!v1 || r.createdAt.getTime() > v1.createdAt.getTime())) v1 = r;
  if (!v1) return { versionId: currentId, fallback: true };
  if (v1.id === currentId) return current;
  if (inWindow(rows, v1, currentId, now)) return { versionId: v1.id, fallback: false };
  return { versionId: currentId, fallback: true };
}

/**
 * The document of a stored version for orders: PageDoc.safeParse (v1 → v2 upgrade + repairs); when
 * that fails, the full validateDoc repair (sections included), logged loudly. Null only when the
 * document cannot be recovered: a repairable doc never makes a live page refuse orders.
 */
export async function orderDocOf(raw: unknown, versionId: string): Promise<PageDoc | null> {
  const parsed = PageDoc.safeParse(raw);
  if (parsed.success) return parsed.data;
  // the full repair needs the section registry: loaded only for the rare document that needs it
  const { validateDoc } = await import("@/lib/page/validate");
  const repaired = validateDoc(raw);
  if (repaired.doc) {
    const what = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    console.error(`[orders] version ${versionId} needed repair: ${what}`);
    return repaired.doc;
  }
  console.error(`[orders] page version ${versionId} has an invalid document`);
  return null;
}
