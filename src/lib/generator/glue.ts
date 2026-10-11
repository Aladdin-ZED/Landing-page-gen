/**
 * Emphasis glue — a fragment written flush against an *emphasis* belongs to the same word: the Arabic
 * proclitic of "و*ساترة*" (and), the French elision of "l’*essayer*", the colon or full stop of
 * "*المحتشمة*:". The kit draws a decorated emphasis as word boxes (inline-blocks) and a line may
 * break at every box edge, so such a fragment can be carried to another line: "ناعمة مثلها، و" |
 * "ساترة كما يجب.", or a line that starts with ": Abaya de prière". The generator moves the fragment
 * inside the emphasis, where it shares the word's box ("*وساترة*", "*l’essayer ?*", "*المحتشمة:*").
 *
 * Only plain single-asterisk emphasis is touched (no strong, no escapes), and a fragment joins a word
 * only when it reads the same way: letters of the word's own script, or punctuation next to a word
 * written in the page's direction (a Latin name on an Arabic page keeps its punctuation outside, where
 * the bidi algorithm places it). Pure & deterministic; strings without such a case come back as is.
 */
import type { Locale } from "@/lib/page/schema";

type Script = "R" | "L" | "N" | "M";

const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z\u00C0-\u024F]/;

function scriptOf(s: string): Script {
  const r = ARABIC.test(s);
  const l = LATIN.test(s);
  return r && l ? "M" : r ? "R" : l ? "L" : "N";
}

/** single-asterisk emphasis: `*…*` not part of `**`, content trimmed on both sides, one line */
const EMPHASIS = /(?<![*\\])\*(?![*\s])([^*\n]*?[^*\s\\])\*(?!\*)/g;
/** a fragment glued before the emphasis: an Arabic prefix (و، ف، ب، ل، ك, "ول"…) or an elision (l’, qu’) */
const BEFORE = /(?:^|(?<=[\s\u00A0\u202F]))([\u0600-\u06FF]{1,4}|[A-Za-z\u00C0-\u00FF]{1,5}[\u2019'])$/u;
/** sentence punctuation glued after the emphasis (quotes and brackets stay out: they come in pairs) */
const AFTER = /^([.,:;!?\u060C\u061B\u061F\u2026]{1,3})(?=[\s\u00A0\u202F]|$)/u;
/** French high punctuation set off by a (narrow) space: "*l’essayer* ?" — the mark must not open a line */
const AFTER_FR = /^([ \u00A0\u202F][!?;:]{1,2})(?=[\s\u00A0\u202F]|$)/u;

function joins(fragment: string, word: string, page: Script): boolean {
  const f = scriptOf(fragment);
  const w = scriptOf(word);
  if (f === "M" || w === "M") return false;
  if (f === "N") return w === page || w === "N";
  return f === w;
}

/** Move fragments glued to an emphasis inside it. */
export function glueEmphasis(text: string, locale: Locale): string {
  if (!text.includes("*") || text.includes("\\")) return text;
  const page: Script = locale === "ar" ? "R" : "L";
  const out: string[] = [];
  let cursor = 0;
  let pendingSkip = 0; // characters after the previous emphasis already moved inside it
  let changed = false;
  for (const m of text.matchAll(EMPHASIS)) {
    const start = m.index;
    const end = start + m[0].length;
    let inner = m[1]!;
    let before = text.slice(cursor + pendingSkip, start);
    const words = inner.split(/\s+/);
    const bm = BEFORE.exec(before);
    if (bm && joins(bm[1]!, words[0]!, page)) {
      before = before.slice(0, before.length - bm[1]!.length);
      inner = bm[1]! + inner;
      changed = true;
    }
    const rest = text.slice(end);
    const am = AFTER.exec(rest) ?? (locale === "fr" ? AFTER_FR.exec(rest) : null);
    let skip = 0;
    if (am && joins(am[1]!, words[words.length - 1]!, page)) {
      inner += am[1]!;
      skip = am[1]!.length;
      changed = true;
    }
    out.push(before, `*${inner}*`);
    cursor = end;
    pendingSkip = skip;
  }
  if (!changed) return text;
  out.push(text.slice(cursor + pendingSkip));
  return out.join("");
}

/** glueEmphasis over every string of a section's data (or any JSON-like value). */
export function glueDeep<T>(value: T, locale: Locale): T {
  if (typeof value === "string") return glueEmphasis(value, locale) as T;
  if (Array.isArray(value)) return value.map((v) => glueDeep(v, locale)) as T;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    let next: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(o)) {
      const g = glueDeep(v, locale);
      if (g !== v) (next ??= { ...o })[k] = g;
    }
    return (next ?? o) as T;
  }
  return value;
}
