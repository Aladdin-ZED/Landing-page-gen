/** Pieces shared by the four steps compositions. */
import type { ReactElement } from "react";
import { Cta, Icon, RichText, SectionHeader, cx, editAttr, reveal, type RevealKind } from "@/landing/primitives";
import type { Archetype } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { Val } from "../benefits/val";
import type { Data, StepItem } from "./model";

/** Entrance of a step block per archetype (DESIGN.md §3 motion column). */
const ITEM_REVEAL: Partial<Record<Archetype, RevealKind>> = {
  maison: "blur-in",
  bloom: "blur-in",
  circuit: "blur-in",
  playground: "tilt-in",
};

export const itemReveal = (ctx: RenderContext): RevealKind => ITEM_REVEAL[ctx.archetype] ?? "rise";

interface HeadProps {
  ctx: RenderContext;
  data: Data;
  titleId: string;
  align?: "start" | "center" | "split";
}

export function Head({ ctx, data, titleId, align = "start" }: HeadProps) {
  return <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} align={align} className="lp-steps__head" />;
}

export function Title({ ctx, step, i }: { ctx: RenderContext; step: StepItem; i: number }) {
  return <RichText as="h3" className="lp-steps__title" text={step.title} ctx={ctx} editPath={`steps.${i}.title`} decorate={false} />;
}

export function Text({ ctx, step, i }: { ctx: RenderContext; step: StepItem; i: number }) {
  return step.text.trim() ? <RichText as="p" className="lp-steps__text" text={step.text} ctx={ctx} editPath={`steps.${i}.text`} /> : null;
}

/** Duration pill: clock + "30 s" (Val keeps "30 ث" and "24–48 س" in reading order in RTL). */
export function Time({ ctx, step, i, className }: { ctx: RenderContext; step: StepItem; i: number; className?: string }) {
  const t = step.time.trim();
  if (!t) return null;
  return (
    <span className={cx("lp-steps__time", className)}>
      <Icon name="clock" size="1.1em" strokeWidth={2} />
      <Val ctx={ctx} text={t} editPath={`steps.${i}.time`} />
    </span>
  );
}

/** Closing line ("That's it."), display face. */
export function Note({ ctx, data, className, delay = 0 }: { ctx: RenderContext; data: Data; className?: string; delay?: number }) {
  const note = data.note.trim();
  return note ? (
    <p className={cx("lp-steps__note", className)} {...reveal("blur-in", delay)} {...editAttr(ctx, "note")}>
      {note}
    </p>
  ) : null;
}

export function OrderButton({ ctx, data, className, delay = 0 }: { ctx: RenderContext; data: Data; className?: string; delay?: number }) {
  return data.cta ? (
    <div className={cx("lp-steps__cta", className)} {...reveal("rise", delay)}>
      <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" />
    </div>
  ) : null;
}

/** Note + order button under a composition; nothing when both are off. */
export function Outro({ ctx, data, className, delay = 0 }: { ctx: RenderContext; data: Data; className?: string; delay?: number }) {
  if (!data.note.trim() && !data.cta) return null;
  return (
    <div className={cx("lp-steps__outro", className)}>
      <Note ctx={ctx} data={data} delay={delay} />
      <OrderButton ctx={ctx} data={data} delay={delay + 120} />
    </div>
  );
}

/** "Done" mark: a clean check stroke that draws on (inside a [data-reveal="draw"] ancestor). */
export function DoneCheck({ className }: { className?: string }): ReactElement {
  return (
    <svg className={cx("lp-steps__check", className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="lp-draw" d="M5.5 12.6l4.1 4.1 8.9-9.4" pathLength={1} />
    </svg>
  );
}
