/**
 * Small pure helpers shared by every landing primitive and section.
 * No React state, no globals — safe in react-dom/server, the preview iframe and exports.
 */
import type { CSSProperties } from "react";
import type { Archetype } from "@/lib/page/schema";
// pure data module (type-only imports inside): no palette solver or font manifest comes with it
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import type { RenderContext } from "../types";

export type ClassValue = string | false | null | undefined | 0;

/** Join truthy class names. */
export function cx(...parts: ClassValue[]): string {
  let out = "";
  for (const p of parts) if (p) out += (out ? " " : "") + p;
  return out;
}

/** `{ "data-edit": path }` in preview mode only (editor click-to-edit hook), `{}` otherwise. */
export function editAttr(
  ctx: Pick<RenderContext, "mode">,
  path: string | null | undefined,
): { "data-edit"?: string } {
  return ctx.mode === "preview" && path ? { "data-edit": path } : {};
}

/** Join a data path: editPath("hero", "title") → "hero.title"; editPath("", "title") → "title". */
export function joinPath(base: string | undefined, key: string): string | undefined {
  if (base === undefined) return undefined;
  return base ? `${base}.${key}` : key;
}

/* ------------------------------------------------------------------ */
/* Inline custom properties                                            */
/* ------------------------------------------------------------------ */

const VAR_NAME = /^--[a-zA-Z0-9-]{1,40}$/;
/** Conservative whitelist: numbers, units, %, #hex, keywords, spaces, commas, slashes, calc()/var(). */
const VAR_VALUE = /^[a-zA-Z0-9#%.,/()\s+-]{0,160}$/;

/** Parentheses must nest: an unclosed "(" would swallow the following declarations of the attribute. */
function balanced(v: string): boolean {
  let depth = 0;
  for (const ch of v) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Build a `style` object that contains ONLY CSS custom properties (the landing CSP allows
 * style attributes for this purpose). Names and values are validated so untrusted strings can
 * never inject extra declarations or url() loads; invalid entries are dropped.
 */
export function cssVars(vars: Record<string, string | number | null | undefined>): CSSProperties | undefined {
  let out: Record<string, string> | undefined;
  for (const [k, raw] of Object.entries(vars)) {
    if (raw === null || raw === undefined || !VAR_NAME.test(k)) continue;
    const v = typeof raw === "number" ? (Number.isFinite(raw) ? String(round(raw, 4)) : "") : raw.trim();
    if (!v || !VAR_VALUE.test(v) || !balanced(v) || /url\s*\(|expression|\\/i.test(v)) continue;
    (out ??= {})[k] = v;
  }
  return out as CSSProperties | undefined;
}

/* ------------------------------------------------------------------ */
/* Reveal (runtime contract: data-reveal / data-delay)                 */
/* ------------------------------------------------------------------ */

export const REVEAL_KINDS = [
  "rise",
  "fade",
  "wipe-up",
  "wipe-side",
  "mask-arch",
  "draw",
  "stamp",
  "count",
  "tilt-in",
  "scale-in",
  "blur-in",
] as const;
export type RevealKind = (typeof REVEAL_KINDS)[number];

export interface RevealAttrs {
  "data-reveal"?: RevealKind;
  "data-delay"?: string;
}

/** Reveal attributes for an element; `false`/undefined → none. Delay in ms (runtime maps it to --d). */
export function reveal(kind: RevealKind | false | null | undefined, delayMs?: number): RevealAttrs {
  if (!kind) return {};
  const attrs: RevealAttrs = { "data-reveal": kind };
  if (delayMs !== undefined && Number.isFinite(delayMs) && delayMs > 0) attrs["data-delay"] = String(Math.round(delayMs));
  return attrs;
}

/* ------------------------------------------------------------------ */
/* Seeded imperfection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Rotation range (degrees) per archetype for collage cards and stickers — read straight from
 * `tilt` in src/lib/theme/archetypes.ts (also emitted as --lp-tilt-min/--lp-tilt-max). Modern
 * ranges are small (≤ 3°); calm, gridded archetypes (maison, apothecary, circuit, editorial,
 * garage) stay perfectly straight.
 */
export const ROTATION_RANGE: Readonly<Record<Archetype, readonly [number, number]>> = Object.fromEntries(
  (Object.keys(ARCHETYPE_DEFS) as Archetype[]).map((a) => [a, ARCHETYPE_DEFS[a].tilt]),
) as Record<Archetype, readonly [number, number]>;

/** Deterministic rotation (deg, 0.25 steps) for `key`, inside the archetype range × `scale`. */
export function seededRotation(ctx: Pick<RenderContext, "rng" | "archetype">, key: string, scale = 1): number {
  const [lo, hi] = ROTATION_RANGE[ctx.archetype] ?? [-3, 3];
  if (lo === hi || !Number.isFinite(scale) || scale === 0) return 0;
  const r = ctx.rng(`rot:${key}`)();
  const v = (lo + r * (hi - lo)) * scale;
  // never land on a dead-straight angle when the archetype tilts: keep at least 0.5°
  const q = Math.round(v * 4) / 4;
  return Math.abs(q) < 0.5 ? (r < 0.5 ? -0.5 : 0.5) * Math.sign(scale) : q;
}

/* ------------------------------------------------------------------ */
/* Value guards (defense in depth for values that end up in style vars) */
/* ------------------------------------------------------------------ */

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const POSITION = /^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/;
const RATIO = /^\d{1,4}(?:\.\d+)?(?:\s*\/\s*\d{1,4}(?:\.\d+)?)?$/;

export const safeHex = (v: string | undefined | null): string | undefined => (v && HEX6.test(v) ? v : undefined);
export const safePosition = (v: string | undefined | null): string | undefined => (v && POSITION.test(v) ? v : undefined);
/** "4/5", "4 / 5", "1.5" → normalized "4 / 5"; anything else → undefined. */
export function safeRatio(v: string | number | undefined | null): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!RATIO.test(s)) return undefined;
  return s.replace(/\s*\/\s*/, " / ");
}

export function round(n: number, decimals = 2): number {
  const k = 10 ** decimals;
  return Math.round(n * k) / k;
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, "0");

/* ------------------------------------------------------------------ */
/* Brand name                                                          */
/* ------------------------------------------------------------------ */

/**
 * Store names that are only the settings placeholder (never typed by the merchant): a wordmark must
 * never read "My store". Lowercased, trimmed.
 */
const PLACEHOLDER_STORE_NAMES = new Set(["", "my store", "my shop", "store", "shop", "ma boutique", "mon magasin", "boutique", "متجري", "المتجر"]);

/** True when the store name is empty or the untouched settings placeholder ("My store"…). */
export function isPlaceholderStoreName(name: string | null | undefined): boolean {
  return PLACEHOLDER_STORE_NAMES.has((name ?? "").trim().toLocaleLowerCase());
}

/**
 * The name to show as the brand (wordmark, <title>, og:site_name, favicon monogram): the store name,
 * or — while it is still the placeholder — the product name, cut on a word boundary at 32 characters.
 */
export function brandName(ctx: { store: { name: string }; product: { name: string } }): string {
  const store = ctx.store.name.trim();
  if (!isPlaceholderStoreName(store)) return store;
  const product = ctx.product.name.trim().replace(/\s+/g, " ");
  if (!product) return store;
  const chars = Array.from(product);
  if (chars.length <= 32) return product;
  const head = chars.slice(0, 32).join("");
  const cut = head.lastIndexOf(" ");
  return (cut >= 12 ? head.slice(0, cut) : head).replace(/[\s,.;:–—-]+$/, "");
}
