/**
 * Video section — data model and media resolution (pure, no React).
 *
 * The playable file comes from ctx.video(data.video). The picture under it (poster while the file
 * loads, and the whole visual when there is no video) is the merchant's poster, else a product photo,
 * else the product cutout. The composition adapts to the media's shape: landscape demos, square
 * supplier clips and vertical phone videos each get a layout made for them.
 */
import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset, ResolvedVideo } from "../../types";

const opt = (max: number) => z.string().max(max).default("");

/** empty chapters (a row just added in the editor) are skipped at render */
export const Chapter = z.object({
  text: opt(48),
});
export type Chapter = z.infer<typeof Chapter>;

export const schema = z.object({
  kicker: opt(60),
  title: opt(140),
  lead: opt(280),
  /** uploaded MP4/WebM (muted inline autoplay while visible) */
  video: AssetRef.optional(),
  /** still shown while the video loads — and instead of it when there is none */
  poster: AssetRef.optional(),
  /** short line on a glass chip over the video */
  caption: opt(80),
  /** what the viewer sees, in order (framed and fullbleed: a segmented chapter track) */
  chapters: z.array(Chapter).max(4).default([]),
  /** UGC credit + words (phone) — merchant proof */
  creatorName: opt(40),
  creatorCity: opt(40),
  quote: opt(140),
  cta: z.boolean().default(true),
  ctaLabel: opt(60),
  sample: z.boolean().default(false),
});
export type Data = z.infer<typeof schema>;

/** Media orientation: drives the composition of every variant. */
export type Shape = "land" | "square" | "tall";

export interface Media {
  video: ResolvedVideo | null;
  /** poster / still picture (null → tinted placeholder) */
  still: ResolvedAsset | null;
  /** width / height of what plays (the video, else the still) */
  ratio: number;
  shape: Shape;
  /** object-position of the video (its focal point; the still keeps its own) */
  pos: string;
}

const pct = (v: number | undefined) => `${Math.round(Math.min(1, Math.max(0, v ?? 0.5)) * 1000) / 10}%`;

const shapeOf = (r: number): Shape => (r < 0.9 ? "tall" : r <= 1.15 ? "square" : "land");

/** First usable product picture: photos before the cutout (a framed video wants a full frame). */
function productStill(ctx: RenderContext): ResolvedAsset | null {
  let cutout: ResolvedAsset | null = null;
  for (const ref of ctx.product.images) {
    const a = ctx.asset(ref);
    if (a && !a.alpha) return a;
    if (a && !cutout) cutout = a;
  }
  return ctx.asset(ctx.product.cutout) ?? cutout;
}

export function resolveMedia(ctx: RenderContext, data: Data): Media {
  const video = ctx.video(data.video);
  // an image picked in the video slot still makes a fine still
  const still = ctx.asset(data.poster) ?? (video ? null : ctx.asset(data.video)) ?? productStill(ctx);
  const w = video?.width ?? still?.width ?? 16;
  const h = video?.height ?? still?.height ?? 9;
  const ratio = w > 0 && h > 0 ? w / h : 16 / 9;
  const ref = data.video;
  const pos = ref && (ref.fx !== undefined || ref.fy !== undefined) ? `${pct(ref.fx)} ${pct(ref.fy)}` : "50% 50%";
  return { video, still, ratio, shape: shapeOf(ratio), pos };
}

/** CSS aspect-ratio value, kept inside sane bounds (9:16 … 21:9). */
export function ratioCss(ratio: number): string {
  const r = Math.min(21 / 9, Math.max(9 / 16, ratio));
  return String(Math.round(r * 10000) / 10000);
}

/** Initials for the creator avatar (first letters of up to two words, any script). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const chars = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "");
  return chars.join("").toUpperCase();
}

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  id: string;
  titleId: string;
  media: Media;
}
