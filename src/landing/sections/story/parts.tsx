/**
 * Pieces shared by the story views: media picks, the avatar (portrait → store logo → initials),
 * the signature, the facts row, the quote mark and the optional order button.
 */
import type { ReactElement } from "react";
import { DotGrid, GridLines, Swoosh, ZelligeLines } from "@/landing/illustrations";
import { Cta, Picture, RichText, cx, editAttr, frameRegions, pictureCrop, reveal, type PictureFrame } from "@/landing/primitives";
import type { FrameShape } from "@/lib/media/focus";
import type { RenderContext, ResolvedAsset } from "../../types";
import { copyLang, density, productShots } from "../benefits/kit";
import { hasStoreName } from "../persona";
import { STORY_UI } from "./copy";
import { pageShape, shapeFor } from "./fit";
import type { StoryData } from "./model";

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

/**
 * The story photo: the section's own image, else the second product shot (the hero already shows
 * the first), else the first shot, else the cutout.
 */
export function pickMedia(ctx: RenderContext, data: StoryData): ResolvedAsset | null {
  const own = ctx.asset(data.image);
  if (own) return own;
  const shots = productShots(ctx);
  return shots[1] ?? shots[0] ?? ctx.asset(ctx.product.cutout);
}

/** A second, different product shot for a small detail inset (null when there is none). */
export function pickInset(ctx: RenderContext, main: ResolvedAsset | null): ResolvedAsset | null {
  if (!main) return null;
  return productShots(ctx).find((a) => a.id !== main.id) ?? null;
}

/** Frame ratio that suits the shot (landscape photos keep a landscape crop). */
export const frameRatio = (a: ResolvedAsset | null): string => (a && a.width > a.height * 1.08 ? "4/3" : "4/5");

/** "4/5" → 0.8 */
export const ratioNum = (r: string): number => {
  const [a, b] = r.split("/").map(Number);
  return b ? a! / b : a!;
};

/** Parallax slack: the photo layer is this much taller than its frame (base CSS: inset -5% 0). */
const SLACK = 1.1;

export interface StoryFrame {
  /** the mask drawn: the page's own (a circle would crop a large photo too hard: rounded), or rounded
   *  when the page's curved mask would cut a head */
  shape: FrameShape;
  /** mask class on the frame element */
  cls: string;
  /** the top corners are cut away (arch, pill, blob): chips sit inside the dome */
  dome: boolean;
  /** the frame's entrance (the arch rises open, the others wipe up) */
  reveal: "mask-arch" | "wipe-up";
  /** people are framed exactly (no parallax slack hiding a veil that touches the photo's top) */
  still: boolean;
  /** Picture crop props for the photo layer */
  fit: { frame?: PictureFrame; frameLg?: PictureFrame; frameMin?: string };
  /** origin of the settle zoom (scroll-driven 1.12 → 1): the heads, so they never leave the frame */
  org?: string;
}

/**
 * How a large story photo is framed: the page's mask fitted subject-first at the frame's ratio (and
 * at `lg` from `min` up). Products and scenes ride a parallax layer 10% taller than the frame; people
 * are framed exactly (their layer fills the frame) and only the frame itself drifts.
 */
export function storyFrame(ctx: RenderContext, media: ResolvedAsset | null, ratio: number, lg?: number, min = "60rem"): StoryFrame {
  const page = pageShape(ctx);
  const base: FrameShape = page === "circle" ? "rounded" : page;
  const keep = (r: number) => shapeFor(media, base, r) === base;
  const shape: FrameShape = media && !media.alpha && (!keep(ratio) || (lg !== undefined && !keep(lg))) ? "rounded" : base;
  const still = !!media && !media.alpha && media.subjectKind === "person";
  const box = (r: number) => (still ? r : r / SLACK);
  const fit =
    !media || media.alpha
      ? {}
      : lg !== undefined && Math.abs(lg - ratio) > 0.01
        ? { frame: { shape, ratio: box(ratio) }, frameLg: { shape, ratio: box(lg) }, frameMin: min }
        : { frame: { shape, ratio: box(ratio) } };
  let org: string | undefined;
  if (still && media) {
    const r = lg ?? ratio;
    const reg = frameRegions(media, r, pictureCrop(media, { frame: { shape, ratio: r } }));
    if (reg.heads.length) {
      const cx = reg.heads.reduce((a, h) => a + h.x + h.w / 2, 0) / reg.heads.length;
      const top = Math.min(...reg.heads.map((h) => h.y));
      const pct = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10}%`;
      org = `${pct(cx)} ${pct(top)}`;
    }
  }
  return {
    shape,
    cls: shape === page ? "lp-mask" : `lp-mask-${shape}`,
    dome: shape === "arch" || shape === "pill" || shape === "blob",
    reveal: shape === "arch" ? "mask-arch" : "wipe-up",
    still,
    fit,
    org,
  };
}

/**
 * The archetype's quiet section backdrop (fills the section root, behind everything): zellige line
 * geometry for souk, a fine dot matrix for the precise languages, a hairline grid for the editorial
 * ones. Nothing for the others — their light comes from glows.
 */
export function Backdrop({ ctx, id }: { ctx: RenderContext; id: string }): ReactElement | null {
  if (density(ctx) === 0) return null;
  switch (ctx.archetype) {
    case "souk":
      return <ZelligeLines uid={`${id}-z`} variant="rosette" className="lp-story__backdrop" />;
    case "circuit":
    case "apothecary":
      return <DotGrid cell={24} opacity={0.42} fade="radial" className="lp-story__backdrop" />;
    case "editorial":
    case "garage":
      return <GridLines cell={88} opacity={0.11} fade="radial" className="lp-story__backdrop" />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Who signs                                                           */
/* ------------------------------------------------------------------ */

/**
 * The typed signature, or the store itself ("L'équipe Dar Argane") — never an invented person.
 * Empty when the store has no name yet: "L'équipe Abaya de prière" would sign with the product.
 */
export function signatureOf(ctx: RenderContext, data: StoryData): string {
  const typed = data.signature.trim();
  if (typed) return typed;
  if (!hasStoreName(ctx)) return "";
  return STORY_UI[copyLang(ctx.locale)].team.replace("{store}", ctx.store.name.trim());
}

/** The typed role, else the store city (real data from Settings → Store). */
export const roleOf = (ctx: RenderContext, data: StoryData): string => data.role.trim() || (ctx.store.city ?? "").trim();

/** The typed place, else the store city. */
export const placeOf = (ctx: RenderContext, data: StoryData): string => data.place.trim() || (ctx.store.city ?? "").trim();

const ARABIC = /[؀-ۿ]/;

/** Initials for the monogram: one letter for Arabic names, up to two otherwise ("Dar Argane" → "DA"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "";
  const first = (w: string) => Array.from(w)[0] ?? "";
  if (ARABIC.test(words[0]!)) return first(words[0]!);
  return (first(words[0]!) + (words[1] ? first(words[1]) : "")).toLocaleUpperCase();
}

interface AvatarProps {
  ctx: RenderContext;
  data: StoryData;
  size: "s" | "l";
  /** l only: a precise accent hairline ring that draws around the avatar on reveal */
  ring?: boolean;
  delay?: number;
}

/**
 * Portrait → store logo → initials monogram (decorative: the name is always written next to it).
 * With no one to show (no portrait, no logo, no typed signature, no store name) the product itself
 * takes the frame: a monogram of the product's name would read as a person.
 */
export function Avatar({ ctx, data, size, ring = false, delay = 0 }: AvatarProps): ReactElement | null {
  const box = cx("lp-story__avatar", `lp-story__avatar--${size}`);
  const sizes = size === "l" ? "8rem" : "3.5rem";
  const portrait = ctx.asset(data.portrait);
  const logo = portrait ? null : (ctx.store.logo ?? null);
  const nobody = !portrait && !logo && !data.signature.trim() && !hasStoreName(ctx);
  const product = nobody ? (ctx.asset(ctx.product.cutout) ?? productShots(ctx)[0] ?? null) : null;
  if (nobody && !product) return null;
  const face = product ? (
    <span className={cx(box, product.alpha && "lp-story__avatar--logo")} aria-hidden="true" {...editAttr(ctx, "portrait")}>
      <Picture asset={product} sizes={sizes} ratio={1} fit={product.alpha ? "contain" : "cover"} alt="" className="lp-story__avpic" />
    </span>
  ) : portrait ? (
    <span className={box} aria-hidden="true" {...editAttr(ctx, "portrait")}>
      <Picture asset={portrait} sizes={sizes} ratio={1} alt="" className="lp-story__avpic" />
    </span>
  ) : logo ? (
    <span className={cx(box, "lp-story__avatar--logo")} aria-hidden="true" {...editAttr(ctx, "portrait")}>
      <Picture asset={logo} sizes={sizes} fit="contain" alt="" className="lp-story__avpic" />
    </span>
  ) : (
    <span className={cx(box, "lp-story__avatar--mono")} aria-hidden="true" {...editAttr(ctx, "portrait")}>
      <span className="lp-story__mono">{initialsOf(data.signature.trim() || ctx.store.name)}</span>
    </span>
  );
  if (!ring) return face;
  return (
    <span className="lp-story__avwrap" {...reveal("scale-in", delay)}>
      {face}
      <svg className="lp-story__avring lp-flip-rtl" viewBox="0 0 100 100" aria-hidden="true" focusable="false" {...reveal("draw", delay + 220)}>
        <circle cx="50" cy="50" r="49" pathLength={1} transform="rotate(-90 50 50)" className="lp-draw" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Signature                                                           */
/* ------------------------------------------------------------------ */

interface SignatureProps {
  ctx: RenderContext;
  data: StoryData;
  /**
   * note — the name written in the emphasis face, revealed in the reading direction while one clean
   *        pen stroke draws under it (letter)
   * row  — avatar · name · role on one compact line (image & text, manifesto)
   */
  look: "note" | "row";
  delay?: number;
}

export function Signature({ ctx, data, look, delay = 0 }: SignatureProps): ReactElement | null {
  const name = signatureOf(ctx, data);
  // no store name and nothing typed: the note stays unsigned rather than signed by the product
  if (!name) return null;
  const role = roleOf(ctx, data);
  const note = look === "note";
  return (
    <span className={cx("lp-story__sign", `lp-story__sign--${look}`)}>
      {note ? null : <Avatar ctx={ctx} data={data} size="s" />}
      <span className="lp-story__signtext">
        <span className="lp-story__signame lp-hand" {...reveal(note ? "wipe-side" : false, delay)} {...editAttr(ctx, "signature")}>
          {name}
          {note ? (
            <Swoosh
              seed={`${ctx.seed}:story:sign`}
              variant="line"
              aspect={10}
              weight={3.6}
              tone="accent"
              reveal
              delay={delay + 380}
              rtlFlip
              className="lp-story__pen"
            />
          ) : null}
        </span>
        {role ? (
          <RichText as="span" className="lp-story__role lp-label" text={role} ctx={ctx} decorate={false} editPath="role" />
        ) : null}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Facts, P.S., quote mark, CTA                                        */
/* ------------------------------------------------------------------ */

export function Facts({ ctx, data, delay = 0 }: { ctx: RenderContext; data: StoryData; delay?: number }): ReactElement | null {
  const facts = data.facts.filter((f) => f.value.trim() && f.label.trim());
  if (!facts.length) return null;
  return (
    <ul className="lp-story__facts" role="list">
      {facts.map((f, i) => (
        <li key={i} className="lp-story__fact" {...reveal("rise", delay + i * 90)}>
          <RichText as="strong" className="lp-story__fval" text={f.value} ctx={ctx} decorate={false} editPath={`facts.${i}.value`} />
          <RichText as="span" className="lp-story__flabel" text={f.label} ctx={ctx} decorate={false} editPath={`facts.${i}.label`} />
        </li>
      ))}
    </ul>
  );
}

export function Postscript({ ctx, data, delay = 0 }: { ctx: RenderContext; data: StoryData; delay?: number }): ReactElement | null {
  if (!data.ps.trim()) return null;
  return (
    <p className="lp-story__ps" {...reveal("fade", delay)}>
      <span className="lp-story__pslabel lp-label">{STORY_UI[copyLang(ctx.locale)].psLabel}</span>{" "}
      <RichText as="span" text={data.ps} ctx={ctx} decorate={false} editPath="ps" />
    </p>
  );
}

/**
 * Opening quote mark: two solid geometric commas (circle + tapered tail), mirrored in RTL where the
 * opening mark is the reversed glyph.
 */
export function QuoteMark({ delay = 0 }: { delay?: number }): ReactElement {
  const mark = (x: number) =>
    `M${x + 2} 28C${x + 2} 17.5 ${x + 8} 9.6 ${x + 19.4} 5.4L${x + 21.4} 9.4C${x + 15.6} 12.4 ${x + 12.7} 15.3 ${x + 11.7} 18.05A10 10 0 1 1 ${x + 2} 28Z`;
  return (
    <svg
      className="lp-story__qmark lp-flip-rtl"
      viewBox="0 0 52 40"
      aria-hidden="true"
      focusable="false"
      {...reveal("scale-in", delay)}
    >
      <path d={mark(0)} />
      <path d={mark(28)} />
    </svg>
  );
}

export function StoryCta({ ctx, data, delay = 0 }: { ctx: RenderContext; data: StoryData; delay?: number }): ReactElement | null {
  if (!data.cta) return null;
  return (
    <div className="lp-story__cta" {...reveal("rise", delay)}>
      <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" size="l" wide />
    </div>
  );
}
