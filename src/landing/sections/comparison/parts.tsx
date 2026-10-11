/**
 * Pieces shared by the comparison views: the product visual pick, the yes / no / partly marks
 * (with their screen-reader words) and the foot (order button + honest footnote).
 */
import type { ReactElement } from "react";
import { CheckMark, CrossMark } from "@/landing/illustrations";
import { Cta, Icon, RichText, cx, reveal } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { copyLang, productShots } from "../benefits/kit";
import { A11Y } from "./copy";
import type { ComparisonData, ComparisonRow } from "./model";

/**
 * Our side's visual: the section's own image, else the cutout (when `prefer` asks for it) or an
 * upright shot (tall frames crop landscape photos down to a detail), then any product photo.
 */
export function pickVisual(ctx: RenderContext, data: ComparisonData, prefer: "cutout" | "upright"): ResolvedAsset | null {
  const own = ctx.asset(data.image);
  if (own) return own;
  const cutout = ctx.asset(ctx.product.cutout);
  if (prefer === "cutout" && cutout) return cutout;
  const shots = productShots(ctx);
  const tall = shots.find((a) => a.height >= a.width * 0.9);
  return (prefer === "upright" ? tall : undefined) ?? shots[0] ?? cutout ?? ctx.asset(ctx.product.images[0]);
}

export const words = (ctx: RenderContext) => A11Y[copyLang(ctx.locale)];

export type MarkKind = "yes" | "no" | "partial";

export const themKind = (row: ComparisonRow): MarkKind => (row.partial ? "partial" : "no");

interface MarkProps {
  ctx: RenderContext;
  kind: MarkKind;
  className?: string;
  /** draw the mark on when it scrolls into view (ms delay) */
  delay?: number;
  /** skip the screen-reader word (the cell text already says it) */
  quiet?: boolean;
}

/**
 * Clean geometric marks: an accent disc with a knocked-out check (ours), a hairline ring with a
 * cross (theirs), a ring with a level bar (theirs, partly). They draw on when revealed.
 */
export function Mark({ ctx, kind, className, delay, quiet = false }: MarkProps): ReactElement {
  const w = words(ctx);
  const cls = cx("lp-comparison__mark", `lp-comparison__mark--${kind}`, className);
  const draw = delay !== undefined;
  const svg =
    kind === "yes" ? (
      <CheckMark className={cls} frame="disc" tone="accent" weight={4} reveal={draw} delay={delay} />
    ) : kind === "no" ? (
      <CrossMark className={cls} frame="ring" tone="soft" weight={3} reveal={draw} delay={delay} />
    ) : (
      <svg
        className={cx("lp-ill lp-ill--partial", cls)}
        viewBox="0 0 48 48"
        data-tone="soft"
        data-reveal={draw ? "draw" : undefined}
        data-delay={draw && delay ? Math.round(delay) : undefined}
        aria-hidden="true"
        focusable="false"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round">
          <circle cx={24} cy={24} r={21} transform="rotate(-90 24 24)" strokeWidth={1.9} pathLength={1} className="lp-draw" data-d={1} />
          <path d="M16.5 24h15" strokeWidth={3.2} pathLength={1} className="lp-draw" data-d={2} />
        </g>
      </svg>
    );
  return (
    <>
      {svg}
      {quiet ? null : <span className="lp-visually-hidden">{kind === "yes" ? w.yes : kind === "no" ? w.no : w.partly}</span>}
    </>
  );
}

interface FootProps {
  ctx: RenderContext;
  data: ComparisonData;
  className?: string;
  delay?: number;
  /** render the order button (views that place it elsewhere pass false) */
  button?: boolean;
}

/** Order button + the honest footnote on what "the alternatives" are. */
export function Foot({ ctx, data, className, delay = 0, button = true }: FootProps): ReactElement | null {
  const note = data.note.trim();
  const cta = button && data.cta;
  if (!cta && !note) return null;
  return (
    <div className={cx("lp-comparison__foot", className)} {...reveal("rise", delay)}>
      {cta ? <Cta ctx={ctx} label={data.ctaLabel} size="l" wide editPath="ctaLabel" /> : null}
      {note ? (
        <p className="lp-comparison__note lp-small">
          <Icon name="info" size="1.15em" className="lp-comparison__noteicon" />
          <RichText as="span" text={note} ctx={ctx} decorate={false} editPath="note" />
        </p>
      ) : null}
    </div>
  );
}

/** Small editable label span. */
export function Label({ ctx, text, path, className }: { ctx: RenderContext; text: string; path: string; className?: string }): ReactElement {
  return (
    <RichText as="span" className={className} text={text} ctx={ctx} decorate={false} editPath={path} />
  );
}
