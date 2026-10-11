/**
 * Pieces shared by the three socialProof views: heading, CTA row, initials avatar and small helpers.
 */
import type { ReactElement } from "react";
import { Cta, SectionHeader, cx, reveal } from "../../primitives";
import type { RenderContext } from "../../types";
import { bucket, initials } from "../reviews/parts";
import type { Data } from "./schema";

export const titleId = (id: string): string => `${id}-title`;

/** "Casablanca, Rabat, Fès" → ["Casablanca", "Rabat", "Fès"] (Latin or Arabic commas, or new lines). */
export const splitList = (s: string): string[] =>
  s
    .split(/[,،\n]/)
    .map((x) => x.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 24);

export function Header({
  ctx,
  data,
  id,
  align = "start",
  size,
  className,
}: {
  ctx: RenderContext;
  data: Data;
  id: string;
  align?: "start" | "center" | "split";
  /** "m" in a half-width column (the counter's heading beside its card) */
  size?: "m" | "l";
  className?: string;
}): ReactElement | null {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      editBase=""
      titleId={titleId(id)}
      align={align}
      size={size}
      className={cx("lp-sp__sh", className)}
    />
  );
}

export function CtaRow({ ctx, data, className }: { ctx: RenderContext; data: Data; className?: string }): ReactElement | null {
  if (!data.cta.trim()) return null;
  return (
    <div className={cx("lp-sp__cta", className)} {...reveal("rise", 120)}>
      <Cta ctx={ctx} label={data.cta} withPrice editPath="cta" />
    </div>
  );
}

/** Initials disc in one of four palette tones (stable per name). Decorative: the name is always written next to it. */
export function Avatar({ name, className }: { name: string; className?: string }): ReactElement {
  return (
    <span className={cx("lp-sp__av", className)} data-tone={bucket(name, 4)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
