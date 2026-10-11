/**
 * beforeAfter model — one content shape for the three compositions (switching variant keeps the
 * merchant's photos and words): a `before` and an `after` moment, up to two in-between `stages`
 * (timeline), short result points, a credit line and an honesty note.
 *
 * Photos are merchant proof. Until real ones are uploaded the section shows the product photo
 * with a muted "before" grade (and a half grade for the stages): a clear sample, flagged
 * `sample: true` by the defaults. Real photos are always shown untouched.
 */
import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../../types";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import { COMMON, UI, langOf } from "./copy";

/** Optional copy: a bounded string with an empty default. */
const opt = (max: number) => z.string().max(max).default("");

const Moment = z.object({
  image: AssetRef.optional(),
  /** "Avant" / "Après" (empty → the page language's default) */
  label: opt(24),
  /** when it was taken: "Jour 1", "Semaine 4", "20 h" */
  when: opt(32),
  /** what you see in this photo */
  caption: opt(140),
});

const Stage = z.object({
  image: AssetRef.optional(),
  when: z.string().min(1).max(32),
  caption: opt(140),
});

const Result = z.object({ text: z.string().min(1).max(48) });

export const schema = z.object({
  kicker: opt(60),
  title: z.string().min(1).max(140),
  lead: opt(280),
  before: Moment,
  after: Moment,
  /** in-between moments, shown by the timeline */
  stages: z.array(Stage).max(2).default([]),
  results: z.array(Result).max(4).default([]),
  /** whose photos these are: "Salma B. · Casablanca" */
  who: opt(60),
  /** honesty note under the photos */
  note: opt(180),
  /** slider: where the divider rests, in % from the start side */
  start: z.number().int().min(10).max(90).default(50),
  /** example content — the admin asks for the customer's real photos before publishing */
  sample: z.boolean().default(false),
  cta: z.boolean().default(false),
  ctaLabel: opt(60),
});

export type Data = z.infer<typeof schema>;

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  id: string;
  titleId: string;
}

/* ------------------------------------------------------------------ */
/* Shots                                                               */
/* ------------------------------------------------------------------ */

export type Side = "before" | "stage" | "after";
/** sample grade applied to the product photo standing in for a missing customer photo */
export type Grade = "before" | "mid";

export interface Shot {
  side: Side;
  /** short tag ("Avant") — empty for in-between stages */
  label: string;
  when: string;
  caption: string;
  asset: ResolvedAsset | null;
  grade?: Grade;
  alt: string;
  /** data path of this moment (click-to-edit) */
  path: string;
}

export interface Shots {
  before: Shot;
  after: Shot;
  /** before → stages → after, in order */
  all: Shot[];
  /** true while the before photo is the graded product photo (sample look) */
  graded: boolean;
  /** frame ratio shared by the photos */
  ratio: string;
}

/** The product's own photo: a real shot first, the cutout otherwise. */
function productPhoto(ctx: RenderContext): ResolvedAsset | null {
  for (const ref of ctx.product.images) {
    const a = ctx.asset(ref);
    if (a && !a.alpha) return a;
  }
  return (
    ctx.asset(ctx.product.cutout) ?? ctx.asset(ctx.product.images[0]) ?? null
  );
}

const describe = (label: string, when: string, caption: string): string =>
  [[label, when].filter(Boolean).join(" · "), caption]
    .filter(Boolean)
    .join(": ")
    .slice(0, 200);

function defaultLabel(ctx: RenderContext, side: "before" | "after"): string {
  return COMMON[langOf(ctx.locale)][side];
}

export const ui = (ctx: RenderContext) => UI[langOf(ctx.locale)];

/**
 * Resolve the photos of every moment. Missing customer photos fall back to the product photo:
 * graded "before" (muted) / "mid" for the stages when the before photo is missing, untouched for
 * the after. A stage without its own photo on a page with real before/after photos shows its
 * words only (never a made-up in-between photo).
 */
export function resolveShots(ctx: RenderContext, data: Data): Shots {
  const realBefore = ctx.asset(data.before.image);
  const realAfter = ctx.asset(data.after.image);
  const product = productPhoto(ctx);
  const base = realAfter ?? product;
  const graded = !realBefore && !!base;

  const labelB = data.before.label.trim() || defaultLabel(ctx, "before");
  const labelA = data.after.label.trim() || defaultLabel(ctx, "after");
  const before: Shot = {
    side: "before",
    label: labelB,
    when: data.before.when.trim(),
    caption: data.before.caption.trim(),
    asset: realBefore ?? base,
    grade: graded ? "before" : undefined,
    // the graded stand-in duplicates the after photo: decorative
    alt: realBefore
      ? realBefore.alt.trim() ||
        describe(labelB, data.before.when.trim(), data.before.caption.trim())
      : "",
    path: "before",
  };
  const afterAsset = realAfter ?? product;
  const after: Shot = {
    side: "after",
    label: labelA,
    when: data.after.when.trim(),
    caption: data.after.caption.trim(),
    asset: afterAsset,
    alt: afterAsset
      ? afterAsset.alt.trim() ||
        describe(labelA, data.after.when.trim(), data.after.caption.trim())
      : "",
    path: "after",
  };
  const stages: Shot[] = data.stages.map((s, i) => {
    const real = ctx.asset(s.image);
    const asset = real ?? (graded ? base : null);
    return {
      side: "stage",
      label: "",
      when: s.when.trim(),
      caption: s.caption.trim(),
      asset,
      grade: !real && graded ? "mid" : undefined,
      alt: real
        ? real.alt.trim() || describe("", s.when.trim(), s.caption.trim())
        : "",
      path: `stages.${i}`,
    };
  });
  const ref = after.asset ?? before.asset;
  const ratio = ref && ref.width > ref.height * 1.08 ? "4/3" : "4/5";
  return { before, after, all: [before, ...stages, after], graded, ratio };
}

/**
 * The frame the photos are shown in: the shared ratio, an arch for tall pairs on arch / capsule
 * pages (`archable`: the slider and the cards draw it there), a continuous rounded rectangle elsewhere.
 */
export interface BaFrame {
  shape: "arch" | "rounded";
  ratio: number;
  /** 1: the cut and the tags are placed from the crop — no zoom, so markup math and pixels agree */
  maxZoom: number;
}

export function frameOf(ctx: RenderContext, shots: Shots, archable: boolean): BaFrame {
  const tall = shots.ratio === "4/5";
  const mask = ARCHETYPE_DEFS[ctx.archetype]?.mask;
  return { shape: archable && tall && (mask === "arch" || mask === "pill") ? "arch" : "rounded", ratio: tall ? 4 / 5 : 4 / 3, maxZoom: 1 };
}

/** Between a name and a city: "·", ",", "|", "•" or a spaced dash (hyphenated names stay whole). */
const CREDIT_SEP = /\s[-–—]\s|[·,|•]/;

/** "Salma B. · Casablanca" → { name: "Salma B.", place: "Casablanca" } */
export function splitCredit(who: string): { name: string; place: string } {
  const m = CREDIT_SEP.exec(who);
  if (!m) return { name: who.trim(), place: "" };
  return {
    name: who.slice(0, m.index).trim(),
    place: who.slice(m.index + m[0].length).trim(),
  };
}

/**
 * Initials for the credit avatar: "Salma B." → "SB", "Fatima-Zahra E." → "FE". Arabic names keep one
 * letter ("سلمى ب." → "س"): joined Arabic letters would shape into a word.
 */
export function initials(who: string): string {
  const words = splitCredit(who).name.split(/\s+/).filter(Boolean);
  const first = (w: string | undefined) =>
    w ? (Array.from(w.replace(/[.'’]/g, ""))[0] ?? "") : "";
  if (/\p{Script=Arabic}/u.test(words.join(" "))) return first(words[0]);
  return (first(words[0]) + first(words[1])).toUpperCase();
}
