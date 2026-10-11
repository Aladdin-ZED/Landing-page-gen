import "server-only";
/**
 * Per-process memory of what the public routes serve: published pages (by slug and "/") and the
 * rendered legal documents. Positive and negative entries expire after TTL_MS (another Node process
 * may have published or unpublished); invalidatePublished() clears this process at once.
 *
 * Call invalidatePublished() after anything that changes what visitors get:
 *   publish (publishPage does it) · unpublish · slug change · page deletion · the "home" setting ·
 *   Settings → Store (legal documents read it at request time).
 * Deliberately dependency-free (no DB, no renderer) so admin actions can import it cheaply.
 */

/** Entries older than this are reloaded (other processes may have changed the database). */
export const RENDER_CACHE_TTL_MS = 60_000;

interface Entry {
  at: number;
  value: unknown;
}

type Bucket = "published" | "legal";

/** Max entries per bucket (legal documents are ~100 KB of HTML each). */
const LIMITS: Record<Bucket, number> = { published: 64, legal: 48 };

declare global {
  var __codRenderCache: Map<Bucket, Map<string, Entry>> | undefined;
}

function bucket(name: Bucket): Map<string, Entry> {
  const all = (globalThis.__codRenderCache ??= new Map<Bucket, Map<string, Entry>>());
  let b = all.get(name);
  if (!b) all.set(name, (b = new Map<string, Entry>()));
  return b;
}

/** A fresh cached value (`{ value }`, which may hold null for a negative lookup) or undefined. */
export function cacheGet<T>(name: Bucket, key: string): { value: T } | undefined {
  const b = bucket(name);
  const hit = b.get(key);
  if (!hit) return undefined;
  b.delete(key);
  if (Date.now() - hit.at > RENDER_CACHE_TTL_MS) return undefined;
  b.set(key, hit); // most recently used last
  return { value: hit.value as T };
}

export function cacheSet<T>(name: Bucket, key: string, value: T): T {
  const b = bucket(name);
  b.delete(key);
  b.set(key, { at: Date.now(), value });
  while (b.size > LIMITS[name]) b.delete(b.keys().next().value!);
  return value;
}

/** Forget every cached page and legal document of this process (slugs and "/" may share a page). */
export function invalidatePublished(): void {
  globalThis.__codRenderCache?.clear();
}
