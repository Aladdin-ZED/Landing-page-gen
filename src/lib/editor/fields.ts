/**
 * Helpers around section FieldSpecs: validation messages keyed by data path, human labels for a
 * path ("Benefits › 2 › Title"), and walking typed values (datetimes, images) for the checklist.
 * Pure and isomorphic.
 */
import type { AnySectionDefinition, FieldSpec } from "@/landing/types";
import { getAt, issuePath, joinPath, parsePath } from "./paths";

export interface FieldIssue {
  path: string;
  message: string;
}

/** Friendlier wording for the generic zod messages admins would otherwise see. */
function humanize(message: string, code?: string): string {
  if (code === "too_small" && /expected string to have >=1/i.test(message)) return "Required";
  if (/^Invalid input: expected (string|number), received undefined$/i.test(message)) return "Required";
  const tooBig = /expected string to have <=(\d+) characters/i.exec(message);
  if (tooBig) return `At most ${tooBig[1]} characters`;
  const tooFew = /expected array to have >=(\d+) items/i.exec(message);
  if (tooFew) return `Add at least ${tooFew[1]}`;
  const tooMany = /expected array to have <=(\d+) items/i.exec(message);
  if (tooMany) return `At most ${tooMany[1]} items`;
  return message;
}

/** Section data issues (empty when valid). A schema that throws counts as one root issue. */
export function sectionIssues(def: AnySectionDefinition, data: unknown): FieldIssue[] {
  try {
    const res = def.schema.safeParse(data);
    if (res.success) return [];
    return res.error.issues.slice(0, 40).map((i) => ({ path: issuePath(i.path), message: humanize(i.message, i.code) }));
  } catch (err) {
    return [{ path: "", message: err instanceof Error ? err.message : "Invalid section data" }];
  }
}

/** First message per path (a field shows one error at a time). */
export function issuesByPath(issues: readonly FieldIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) if (!(i.path in out)) out[i.path] = i.message;
  return out;
}

/** Breadcrumb label of a data path inside a section's fields, e.g. "Benefits › 2 › Title". */
export function fieldLabel(fields: readonly FieldSpec[], path: string): string {
  const segs = parsePath(path);
  const parts: string[] = [];
  let scope: readonly FieldSpec[] = fields;
  let i = 0;
  outer: while (i < segs.length) {
    const flat = flatten(scope);
    for (const f of flat) {
      if (!("path" in f)) continue;
      const fsegs = parsePath(f.path);
      if (fsegs.every((s, k) => segs[i + k] === s)) {
        parts.push(f.label);
        i += fsegs.length;
        if (f.kind === "list" && i < segs.length && /^\d+$/.test(segs[i]!)) {
          parts.push(String(Number(segs[i]) + 1));
          i += 1;
          scope = f.item;
          continue outer;
        }
        if (i < segs.length) parts.push(segs.slice(i).join("."));
        break outer;
      }
    }
    parts.push(segs.slice(i).join("."));
    break;
  }
  return parts.filter(Boolean).join(" › ") || "Section";
}

/** Groups are presentation only: their children share the parent's data scope. */
export function flatten(fields: readonly FieldSpec[]): FieldSpec[] {
  const out: FieldSpec[] = [];
  for (const f of fields) {
    if (f.kind === "group") out.push(...flatten(f.fields));
    else out.push(f);
  }
  return out;
}

export interface TypedValue {
  path: string;
  label: string;
  value: unknown;
}

/** Every value of the given field kinds in `data` (list items included). */
export function valuesOfKind(fields: readonly FieldSpec[], data: unknown, kinds: readonly FieldSpec["kind"][], base = "", labelBase = ""): TypedValue[] {
  const out: TypedValue[] = [];
  for (const f of flatten(fields)) {
    if (!("path" in f)) continue;
    const path = joinPath(base, f.path);
    const label = labelBase ? `${labelBase} › ${f.label}` : f.label;
    if (kinds.includes(f.kind)) out.push({ path, label, value: getAt(data, f.path) });
    if (f.kind === "list") {
      const items = getAt(data, f.path);
      if (Array.isArray(items)) {
        items.forEach((item, i) => out.push(...valuesOfKind(f.item, item, kinds, joinPath(path, i), `${label} › ${i + 1}`)));
      }
    }
  }
  return out;
}

const ASSET_ID = /^[a-f0-9]{16,64}$/;

/** Every asset reference ({ id, alt }) anywhere inside a value. */
export function assetRefsIn(value: unknown, depth = 0, out: { id: string; alt: string }[] = []): { id: string; alt: string }[] {
  if (depth > 12 || value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    for (const v of value) assetRefsIn(v, depth + 1, out);
    return out;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.id === "string" && ASSET_ID.test(rec.id) && ("alt" in rec || "fx" in rec)) {
    out.push({ id: rec.id, alt: typeof rec.alt === "string" ? rec.alt : "" });
  }
  for (const v of Object.values(rec)) if (v && typeof v === "object") assetRefsIn(v, depth + 1, out);
  return out;
}
