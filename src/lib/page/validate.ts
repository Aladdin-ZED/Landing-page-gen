/**
 * Document validation & repair for render/publish.
 *
 *   const { doc, issues } = validateDoc(draft);   // doc === null → not renderable (see issues)
 *
 * - The page-level fields (product, items, offers, form, theme…) must satisfy PageDoc — they are not
 *   guessed. v1 documents are upgraded to v2 first and everything existing data can break is repaired
 *   (src/lib/page/upgrade.ts: money to 2 decimals, duplicate ids, dangling references…); each repair
 *   is reported as a warning.
 * - Sections are repaired one by one: unknown types and malformed instances are dropped, unknown
 *   variants fall back to the first variant, duplicate ids are renamed, extra singletons dropped,
 *   required sections (the order form) added, and invalid section data is merged over the section's
 *   defaults field by field (see normalizeSection) — a broken section never breaks the page.
 * - Every string is sanitized (control characters, lone surrogates) and prototype keys are dropped.
 * - Documents saved before the v2 (modern) art direction are migrated: retired theme values
 *   (paper/ink textures, hard/stamp shadows, torn/scallop/tape dividers…) fall back to their defaults.
 *
 * Isomorphic: used by the publisher (server), the renderer and the admin preview (browser).
 */
import type { z } from "zod";
import { Divider, PageDocObject, SectionInstance, ThemeSpec, type PageDoc as PageDocT, type SectionInstance as SectionInstanceT } from "./schema";
import { upgradeDocReport } from "./upgrade";
import { seededRandom } from "@/landing/context";
import { getSection, SECTIONS } from "@/landing/registry";
import type { AnySectionDefinition } from "@/landing/types";

export interface DocIssue {
  /** "error": the document cannot be rendered; "warning": repaired automatically */
  level: "error" | "warning";
  /** dotted path in the document, e.g. "offers.bundles.1.price" or "sections.hero-1.data.title" */
  path: string;
  message: string;
  sectionId?: string;
}

export interface ValidateResult {
  doc: PageDocT | null;
  issues: DocIssue[];
}

/* ------------------------------------------------------------------ */
/* Sanitizing                                                          */
/* ------------------------------------------------------------------ */

const MAX_DEPTH = 16;
/** PageDoc.sections max length */
const MAX_SECTIONS = 60;
const BANNED_KEYS = new Set(["__proto__", "prototype", "constructor"]);
// C0 controls except TAB/LF, DEL, C1 controls and U+FEFF (BOM / zero-width no-break space used mid-text).
const ch = (code: number) => String.fromCharCode(code);
const CONTROL = new RegExp(`[${ch(0x00)}-${ch(0x08)}${ch(0x0b)}${ch(0x0c)}${ch(0x0e)}-${ch(0x1f)}${ch(0x7f)}-${ch(0x9f)}${ch(0xfeff)}]`, "g");
/** CRLF, CR, LINE SEPARATOR, PARAGRAPH SEPARATOR */
const LINE_BREAKS = new RegExp(`${ch(0x0d)}${ch(0x0a)}?|${ch(0x2028)}|${ch(0x2029)}`, "g");
const REPLACEMENT = ch(0xfffd);

/** Replace unpaired UTF-16 surrogates (invalid in HTML/JSON output) with U+FFFD. */
function wellFormed(s: string): string {
  let out = "";
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0xd800 || c > 0xdfff) continue;
    const next = s.charCodeAt(i + 1);
    if (c <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      i++;
      continue;
    }
    out += s.slice(from, i) + REPLACEMENT;
    from = i + 1;
  }
  return from === 0 ? s : out + s.slice(from);
}

/** Plain-text hygiene: normalized newlines, no control characters, no lone surrogates, NFC. */
export function sanitizeText(s: string): string {
  return wellFormed(s.replace(LINE_BREAKS, ch(0x0a)).replace(CONTROL, "")).normalize("NFC");
}

/** Deep copy of JSON-like data with sanitized strings; drops functions, non-finite numbers and prototype keys. */
export function sanitizeDeep(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === "string") return sanitizeText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const v of value) {
      const s = sanitizeDeep(v, depth + 1);
      if (s !== undefined) out.push(s);
    }
    return out;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BANNED_KEYS.has(k)) continue;
      const s = sanitizeDeep(v, depth + 1);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return undefined;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Recursive merge: objects merge key by key, everything else (arrays included) is replaced by `over`. */
function mergeOver(base: unknown, over: unknown): unknown {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = mergeOver(base[k], v);
  return out;
}

type Parsed = { success: true; data: unknown; error?: undefined } | { success: false; data?: undefined; error?: z.ZodError };

/** safeParse that also survives a section schema whose refinement/transform throws (→ failure). */
function tryParse(schema: z.ZodTypeAny, value: unknown): Parsed {
  try {
    return schema.safeParse(value);
  } catch {
    return { success: false };
  }
}

function zodPath(path: readonly PropertyKey[]): string {
  return path.map((p) => String(p)).join(".");
}

function zodIssues(err: z.ZodError, prefix: string, level: DocIssue["level"], sectionId?: string): DocIssue[] {
  return err.issues.slice(0, 20).map((i) => ({
    level,
    path: [prefix, zodPath(i.path)].filter(Boolean).join("."),
    message: i.message,
    ...(sectionId ? { sectionId } : {}),
  }));
}

/* ------------------------------------------------------------------ */
/* Legacy values (v1 craft direction → v2 modern)                      */
/* ------------------------------------------------------------------ */

/** Theme fields whose value sets changed in v2; an unknown value is removed so the schema default applies. */
const THEME_ENUM_FIELDS = ["radius", "shadow", "texture", "surfaces", "motion"] as const;
/** Section-instance fields with defaults; an unknown value is removed so the schema default applies. */
const SECTION_ENUM_FIELDS = ["bg", "divider", "spacing"] as const;

const fieldValid = (schema: z.ZodTypeAny, v: unknown) => tryParse(schema, v).success;

/**
 * Migrate retired enum values in place (on the sanitized copy) before strict parsing, so a page
 * saved with the v1 kit (texture "paper", shadow "hard", dividers ["torn", "scallop"], a section
 * divider "marquee-tape"…) still renders — with the modern defaults — instead of failing.
 */
function migrateLegacy(raw: Record<string, unknown>, issues: DocIssue[]): void {
  const theme = raw.theme;
  if (isPlainObject(theme)) {
    for (const key of THEME_ENUM_FIELDS) {
      if (!(key in theme) || fieldValid(ThemeSpec.shape[key], theme[key])) continue;
      issues.push({ level: "warning", path: `theme.${key}`, message: `Retired value "${String(theme[key]).slice(0, 40)}" replaced by the default.` });
      delete theme[key];
    }
    if (Array.isArray(theme.dividers)) {
      const kept = [...new Set(theme.dividers.filter((d) => fieldValid(Divider, d)))].slice(0, 4);
      if (kept.length !== theme.dividers.length) {
        issues.push({ level: "warning", path: "theme.dividers", message: "Retired section transitions removed (modern dividers only)." });
        theme.dividers = kept;
      }
    } else if ("dividers" in theme) {
      delete theme.dividers;
    }
  }
  if (!Array.isArray(raw.sections)) return;
  raw.sections.forEach((item, i) => {
    if (!isPlainObject(item)) return;
    const sid = typeof item.id === "string" ? item.id : undefined;
    for (const key of SECTION_ENUM_FIELDS) {
      if (!(key in item) || fieldValid(SectionInstance.shape[key], item[key])) continue;
      issues.push({
        level: "warning",
        path: `sections.${sid ?? i}.${key}`,
        message: `Retired value "${String(item[key]).slice(0, 40)}" replaced by the default.`,
        ...(sid ? { sectionId: sid } : {}),
      });
      delete item[key];
    }
  });
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export interface NormalizedSection {
  def: AnySectionDefinition;
  variant: string;
  data: Record<string, unknown>;
  issues: DocIssue[];
}

type DocBasics = Pick<PageDocT, "locale" | "product" | "items" | "offers" | "theme">;

/** The section definition's defaults for this page (deterministic per page seed + section id). */
export function sectionDefaults(def: AnySectionDefinition, doc: DocBasics, sectionId: string): unknown {
  return def.defaults({
    locale: doc.locale,
    product: doc.product,
    items: doc.items,
    offers: doc.offers,
    archetype: doc.theme.archetype,
    rng: seededRandom(doc.theme.seed, `defaults:${sectionId}`),
  });
}

/**
 * Validate one section instance against its definition. Returns null when the type is unknown or
 * the definition cannot produce valid data even from its own defaults.
 * Repair order: data as is → data merged over defaults → defaults + every field that still validates.
 */
export function normalizeSection(inst: SectionInstanceT, doc: DocBasics): NormalizedSection | null {
  const def = getSection(inst.type);
  if (!def) return null;
  const issues: DocIssue[] = [];
  const at = `sections.${inst.id}`;

  const variant = def.variants.some((v) => v.id === inst.variant) ? inst.variant : (def.variants[0]?.id ?? "default");
  if (variant !== inst.variant) {
    issues.push({ level: "warning", path: `${at}.variant`, message: `Unknown variant "${inst.variant}" — using "${variant}".`, sectionId: inst.id });
  }

  const direct = tryParse(def.schema, inst.data);
  if (direct.success && isPlainObject(direct.data)) return { def, variant, data: direct.data, issues };

  let defaults: unknown;
  try {
    defaults = sectionDefaults(def, doc, inst.id);
  } catch {
    return null;
  }
  const merged = tryParse(def.schema, mergeOver(defaults, inst.data));
  if (merged.success && isPlainObject(merged.data)) {
    issues.push({ level: "warning", path: `${at}.data`, message: "Missing or invalid fields were filled with defaults.", sectionId: inst.id });
    return { def, variant, data: merged.data, issues };
  }

  // Field-by-field salvage on top of the defaults.
  let current: unknown = defaults;
  const dropped: string[] = [];
  if (isPlainObject(inst.data) && isPlainObject(defaults)) {
    for (const [k, v] of Object.entries(inst.data)) {
      const candidate = { ...(current as Record<string, unknown>), [k]: mergeOver((current as Record<string, unknown>)[k], v) };
      if (tryParse(def.schema, candidate).success) current = candidate;
      else dropped.push(k);
    }
  }
  const salvaged = tryParse(def.schema, current);
  if (!salvaged.success || !isPlainObject(salvaged.data)) return null;
  issues.push({
    level: "warning",
    path: `${at}.data`,
    message: dropped.length ? `Invalid fields replaced by defaults: ${dropped.join(", ")}.` : "Section data replaced by defaults.",
    sectionId: inst.id,
  });
  if (direct.error) issues.push(...zodIssues(direct.error, `${at}.data`, "warning", inst.id).slice(0, 5));
  return { def, variant, data: salvaged.data, issues };
}

/** Unique section id derived from `base` that is not in `taken` (keeps the Id regex). */
function uniqueId(base: string, taken: ReadonlySet<string>): string {
  const stem = base.slice(0, 34).replace(/[^a-zA-Z0-9_-]/g, "-") || "section";
  for (let n = 2; n < 1000; n++) {
    const id = `${stem}-${n}`;
    if (!taken.has(id)) return id;
  }
  return `${stem}-${taken.size + 1000}`;
}

/* ------------------------------------------------------------------ */
/* Document                                                            */
/* ------------------------------------------------------------------ */

export function validateDoc(input: unknown): ValidateResult {
  const issues: DocIssue[] = [];
  const sanitized = sanitizeDeep(input);
  if (!isPlainObject(sanitized)) return { doc: null, issues: [{ level: "error", path: "", message: "The page document is not an object." }] };
  migrateLegacy(sanitized, issues);

  // v1 → v2 + deterministic repairs (offer / line / group / option ids, preselected, dangling refs…)
  const up = upgradeDocReport(sanitized);
  for (const r of up.repairs) issues.push({ level: "warning", path: r.path, message: r.message });
  const raw = isPlainObject(up.doc) ? up.doc : sanitized;

  const rawSections = raw.sections;
  const head = PageDocObject.safeParse({ ...raw, sections: [] });
  if (!head.success) return { doc: null, issues: [...issues, ...zodIssues(head.error, "", "error")] };
  const docBase: PageDocT = head.data;

  /* sections */
  const list = Array.isArray(rawSections) ? rawSections.slice(0, MAX_SECTIONS) : [];
  if (rawSections !== undefined && !Array.isArray(rawSections)) {
    issues.push({ level: "warning", path: "sections", message: "Sections were not a list and were ignored." });
  } else if (Array.isArray(rawSections) && rawSections.length > MAX_SECTIONS) {
    issues.push({ level: "warning", path: "sections", message: `Only the first ${MAX_SECTIONS} sections are kept (${rawSections.length} were given).` });
  }
  const ids = new Set<string>();
  const singletons = new Set<string>();
  const sections: SectionInstanceT[] = [];
  list.forEach((item, i) => {
    const parsed = SectionInstance.safeParse(item);
    if (!parsed.success) {
      issues.push(...zodIssues(parsed.error, `sections.${i}`, "warning"));
      issues.push({ level: "warning", path: `sections.${i}`, message: "Malformed section removed." });
      return;
    }
    let inst = parsed.data;
    const def = getSection(inst.type);
    if (!def) {
      issues.push({ level: "warning", path: `sections.${inst.id}`, message: `Unknown section type "${inst.type}" removed.`, sectionId: inst.id });
      return;
    }
    if (def.singleton && singletons.has(def.type)) {
      issues.push({ level: "warning", path: `sections.${inst.id}`, message: `Only one "${def.label}" section is allowed — extra copy removed.`, sectionId: inst.id });
      return;
    }
    if (ids.has(inst.id)) {
      const id = uniqueId(inst.id, ids);
      issues.push({ level: "warning", path: `sections.${inst.id}`, message: `Duplicate section id "${inst.id}" renamed to "${id}".`, sectionId: id });
      inst = { ...inst, id };
    }
    const norm = normalizeSection(inst, docBase);
    if (!norm) {
      issues.push({ level: "warning", path: `sections.${inst.id}`, message: `"${def.label}" section could not be repaired and was removed.`, sectionId: inst.id });
      return;
    }
    issues.push(...norm.issues);
    ids.add(inst.id);
    if (def.singleton) singletons.add(def.type);
    sections.push({ ...inst, variant: norm.variant, data: norm.data });
  });

  /* required sections (the order form): add them before the first bottom/floating section */
  for (const def of SECTIONS) {
    if (!def.required || sections.some((s) => s.type === def.type)) continue;
    if (sections.length >= MAX_SECTIONS) {
      issues.push({ level: "error", path: "sections", message: `Required "${def.label}" section is missing and the page already has ${MAX_SECTIONS} sections — remove one.` });
      continue;
    }
    const id = ids.has(def.type) ? uniqueId(def.type, ids) : def.type;
    let data: unknown;
    try {
      data = sectionDefaults(def, docBase, id);
    } catch {
      issues.push({ level: "error", path: `sections`, message: `Required "${def.label}" section is missing and its defaults failed.` });
      continue;
    }
    const parsed = tryParse(def.schema, data);
    if (!parsed.success || !isPlainObject(parsed.data)) {
      issues.push({ level: "error", path: `sections`, message: `Required "${def.label}" section is missing and its defaults are invalid.` });
      continue;
    }
    const inst: SectionInstanceT = {
      id,
      type: def.type,
      variant: def.variants[0]?.id ?? "default",
      bg: "soft",
      divider: "auto",
      spacing: "normal",
      hidden: false,
      data: parsed.data,
    };
    const at = sections.findIndex((s) => {
      const cat = getSection(s.type)?.category;
      return cat === "bottom" || cat === "floating";
    });
    sections.splice(at < 0 ? sections.length : at, 0, inst);
    ids.add(id);
    issues.push({ level: "warning", path: `sections.${id}`, message: `Required "${def.label}" section was missing and has been added.`, sectionId: id });
  }
  for (const s of sections) {
    if (s.hidden && getSection(s.type)?.required) {
      issues.push({ level: "warning", path: `sections.${s.id}.hidden`, message: "The order form is hidden: visitors cannot order from this page.", sectionId: s.id });
    }
  }

  const final = PageDocObject.safeParse({ ...docBase, sections });
  if (!final.success) return { doc: null, issues: [...issues, ...zodIssues(final.error, "", "error")] };
  return { doc: final.data, issues };
}
