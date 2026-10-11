/**
 * Small pure building blocks shared by the proof sections (reviews, socialProof): initials
 * avatars, local microcopy, the honest rating score and a single star glyph. Markup only — every
 * section styles these through its own class names (section CSS chunks are inlined per type).
 */
import type { ReactElement } from "react";
import type { RenderContext } from "../../types";
import { cx } from "../../primitives";
import { langOf, type L3 } from "./copy";

/** Pick the page-language string from a local ar/fr/en triple. */
export const say = (ctx: Pick<RenderContext, "locale">, s: L3): string => s[langOf(ctx.locale)];

const ARABIC = /[؀-ۿ]/;

/** "Salma B." → "SB", "سلمى ب." → "س" (Arabic letters are shown alone, never paired). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ? Array.from(words[0])[0] : undefined;
  if (!first) return "•";
  if (ARABIC.test(first)) return first;
  const second = words[1] ? Array.from(words[1].replace(/[^\p{L}]/gu, ""))[0] ?? "" : "";
  return (first + second).toLocaleUpperCase();
}

/** Stable 0..n-1 bucket for a string (avatar colors). */
export function bucket(s: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % n;
}

/** Initials disc. Decorative: the name is always written next to it. */
export function Avatar({ name, className }: { name: string; className: string }): ReactElement {
  return (
    <span className={className} data-tone={bucket(name, 4)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export interface Score {
  value: number;
  count: number;
  /** true when the number is the product's real aggregated rating */
  fromProduct: boolean;
}

/**
 * The rating to display: the product's real aggregated rating when the admin set one, otherwise
 * the plain average of the reviews actually shown on the page (with their count) — never invented.
 */
export function scoreOf(ctx: RenderContext, ratings: readonly number[]): Score | null {
  const r = ctx.product.rating;
  if (r) return { value: r.value, count: r.count, fromProduct: true };
  if (!ratings.length) return null;
  const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { value: Math.round(avg * 10) / 10, count: ratings.length, fromProduct: false };
}

/** "312 avis" in the page language with the page's digits. */
export function countLabel(ctx: RenderContext, n: number): string {
  return ctx.t("reviews.basedOn", { n }).replace(String(n), ctx.num(n));
}

/** One five-point star (filled with currentColor). */
export function StarGlyph({ className }: { className?: string }): ReactElement {
  return (
    <svg className={cx("lp-star1", className)} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 1.6l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.5l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" fill="currentColor" />
    </svg>
  );
}

/** Small round check (knock-out: the tick shows the surface behind it) for "verified" chips. */
export function CheckSeal({ className }: { className?: string }): ReactElement {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        fill="currentColor"
        d="M8 0a8 8 0 1 0 0 16A8 8 0 1 0 8 0zM3.9 8.1L5 7l1.8 1.8L11 4.4l1.1 1.1L6.8 11z"
      />
    </svg>
  );
}
