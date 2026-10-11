/**
 * Minimal runtime introspection of zod v4 schemas.
 *
 * Section schemas are owned by the sections and evolve independently, so the generator never
 * hard-codes their shape: it discovers which fields exist (and their string/array limits) from the
 * schema itself, writes copy only where a compatible field exists, and re-validates with safeParse.
 */
import type { z } from "zod";

interface ZodDefLike {
  type: string;
  innerType?: z.ZodTypeAny;
  in?: z.ZodTypeAny;
  out?: z.ZodTypeAny;
  shape?: Record<string, z.ZodTypeAny>;
  element?: z.ZodTypeAny;
  entries?: Record<string, string | number>;
  options?: z.ZodTypeAny[];
  getter?: () => z.ZodTypeAny;
  checks?: { _zod: { def: { check: string; minimum?: number; maximum?: number; length?: number } } }[];
}

const defOf = (s: z.ZodTypeAny): ZodDefLike => (s as unknown as { _zod: { def: ZodDefLike } })._zod.def;

/** Wrappers whose inner type carries the actual value shape. */
const WRAPPERS = new Set(["default", "prefault", "optional", "nullable", "catch", "readonly", "nonoptional", "success"]);

/** Strip optional/default/nullable/pipe/lazy wrappers. For pipes, the INPUT side decides the kind. */
export function unwrap(schema: z.ZodTypeAny, depth = 0): z.ZodTypeAny {
  if (depth > 12) return schema;
  const d = defOf(schema);
  if (WRAPPERS.has(d.type) && d.innerType) return unwrap(d.innerType, depth + 1);
  if (d.type === "pipe" && d.in) return unwrap(d.in, depth + 1);
  if (d.type === "lazy" && d.getter) return unwrap(d.getter(), depth + 1);
  return schema;
}

export type Kind = "string" | "number" | "boolean" | "enum" | "array" | "object" | "other";

export function kindOf(schema: z.ZodTypeAny): Kind {
  const t = defOf(unwrap(schema)).type;
  if (t === "string" || t === "number" || t === "boolean" || t === "enum" || t === "array" || t === "object") return t;
  if (t === "literal") return "other";
  return "other";
}

/** Object shape (after unwrapping), or null. */
export function shapeOf(schema: z.ZodTypeAny): Record<string, z.ZodTypeAny> | null {
  const d = defOf(unwrap(schema));
  return d.type === "object" && d.shape ? d.shape : null;
}

export function elementOf(schema: z.ZodTypeAny): z.ZodTypeAny | null {
  const d = defOf(unwrap(schema));
  return d.type === "array" && d.element ? d.element : null;
}

export function enumValues(schema: z.ZodTypeAny): string[] {
  const d = defOf(unwrap(schema));
  return d.type === "enum" && d.entries ? Object.values(d.entries).map(String) : [];
}

/** Length limits from every layer of the schema (wrappers and both sides of pipes). */
export function lengthBounds(schema: z.ZodTypeAny): { min: number; max: number } {
  let min = 0;
  let max = Number.POSITIVE_INFINITY;
  const visit = (s: z.ZodTypeAny, depth: number) => {
    if (depth > 12) return;
    const d = defOf(s);
    for (const c of d.checks ?? []) {
      const cd = c._zod.def;
      if (cd.check === "max_length" && typeof cd.maximum === "number") max = Math.min(max, cd.maximum);
      if (cd.check === "min_length" && typeof cd.minimum === "number") min = Math.max(min, cd.minimum);
      if (cd.check === "length_equals" && typeof cd.length === "number") {
        min = Math.max(min, cd.length);
        max = Math.min(max, cd.length);
      }
    }
    if (WRAPPERS.has(d.type) && d.innerType) visit(d.innerType, depth + 1);
    if (d.type === "pipe") {
      if (d.in) visit(d.in, depth + 1);
      if (d.out) visit(d.out, depth + 1);
    }
  };
  visit(schema, 0);
  return { min, max };
}

/** Does the schema accept this value on its own? (never throws) */
export function accepts(schema: z.ZodTypeAny, value: unknown): boolean {
  try {
    return schema.safeParse(value).success;
  } catch {
    return false;
  }
}

/** Parsed value or null (never throws). */
export function parseOr<T = unknown>(schema: z.ZodTypeAny, value: unknown): T | null {
  try {
    const r = schema.safeParse(value);
    return r.success ? (r.data as T) : null;
  } catch {
    return null;
  }
}
