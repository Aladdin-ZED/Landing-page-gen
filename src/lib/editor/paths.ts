/**
 * Dotted data paths ("items.0.title", "items[0].title") used by FieldSpecs, the inline text editor
 * (data-edit) and validation messages. Pure and isomorphic.
 *
 * Writes go through `setAt`, which is meant for immer drafts: it creates missing containers, refuses
 * prototype keys (paths can come from page data / the preview DOM) and deletes the key when the
 * value is `undefined` (optional fields).
 */

const BANNED = new Set(["__proto__", "prototype", "constructor"]);

export function parsePath(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);
}

export function joinPath(...parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p !== undefined && p !== null && p !== "").join(".");
}

const isIndex = (seg: string) => /^\d+$/.test(seg);

export function isSafePath(path: string | readonly string[]): boolean {
  const segs = typeof path === "string" ? parsePath(path) : path;
  return segs.length > 0 && segs.length <= 16 && segs.every((s) => !BANNED.has(s) && s.length <= 64);
}

/** Value at a path (undefined when any step is missing). */
export function getAt(root: unknown, path: string | readonly string[]): unknown {
  const segs = typeof path === "string" ? parsePath(path) : path;
  let cur: unknown = root;
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object" || BANNED.has(seg)) return undefined;
    cur = Array.isArray(cur) ? cur[Number(seg)] : (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Write `value` at `path` inside `root` (an immer draft or a plain mutable object).
 * Returns false (and changes nothing) for unsafe paths or when a step crosses a primitive.
 */
export function setAt(root: unknown, path: string | readonly string[], value: unknown): boolean {
  const segs = typeof path === "string" ? parsePath(path) : [...path];
  if (!isSafePath(segs) || root === null || typeof root !== "object") return false;
  let cur = root as Record<string, unknown> | unknown[];
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const key = Array.isArray(cur) ? Number(seg) : seg;
    let next = (cur as Record<string | number, unknown>)[key];
    if (next === undefined || next === null) {
      next = isIndex(segs[i + 1]!) ? [] : {};
      (cur as Record<string | number, unknown>)[key] = next;
    }
    if (typeof next !== "object") return false;
    cur = next as Record<string, unknown> | unknown[];
  }
  const last = segs[segs.length - 1]!;
  if (Array.isArray(cur)) {
    const idx = Number(last);
    if (!Number.isInteger(idx) || idx < 0 || idx > cur.length) return false;
    if (value === undefined) cur.splice(idx, 1);
    else cur[idx] = value;
    return true;
  }
  if (value === undefined) delete cur[last];
  else cur[last] = value;
  return true;
}

/** Turns zod issue paths into the dotted form used by FieldSpecs. */
export function issuePath(path: readonly PropertyKey[]): string {
  return path.map((p) => String(p)).join(".");
}

/** Strip the inline markup (*emphasis*, **strong**) for list row titles and summaries. */
export function plainLabel(text: unknown, max = 60): string {
  if (typeof text !== "string") return "";
  const s = text.replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
