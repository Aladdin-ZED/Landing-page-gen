import type { ReactElement, ReactNode } from "react";
import type { Archetype } from "@/lib/page/schema";
import type { RenderContext } from "../types";
import { Kicker, type KickerProps } from "./Kicker";
import { RichText } from "./RichText";
import { cx, joinPath, reveal, type RevealKind } from "./util";

/** Title entrance per archetype (DESIGN.md §3 motion column) — sections may override. */
export const TITLE_REVEAL: Record<Archetype, RevealKind> = {
  maison: "blur-in",
  apothecary: "rise",
  souk: "rise",
  playground: "tilt-in",
  kinetic: "wipe-up",
  circuit: "blur-in",
  hearth: "rise",
  bloom: "blur-in",
  field: "rise",
  editorial: "wipe-up",
  garage: "wipe-up",
};

export interface SectionHeaderProps {
  ctx: RenderContext;
  kicker?: string | null;
  title: string | null | undefined;
  lead?: string | null;
  /** start (default), center, or split (title | lead side by side on desktop) */
  align?: "start" | "center" | "split";
  /** editorial section number, e.g. "01" */
  number?: string;
  /**
   * Data path prefix for click-to-edit: fields are `${editBase}.kicker|title|lead`
   * ("" → "kicker"/"title"/"lead"). Omit to disable.
   */
  editBase?: string;
  titleAs?: "h1" | "h2" | "h3";
  /** title scale: m → lp-h2, l (default) → lp-h1, xl → lp-display-3 */
  size?: "m" | "l" | "xl";
  /** id on the title (use with SectionShell labelledBy) */
  titleId?: string;
  titleReveal?: RevealKind | false;
  /** reveal the title word by word (blur-to-sharp + rise, staggered). Default true. */
  titleSplit?: boolean;
  /** kicker look (pill / bare label); default per archetype */
  kickerLook?: KickerProps["look"];
  /** false disables all reveal attributes */
  animate?: boolean;
  /** hairline that runs out from the meta row, drawn on reveal */
  rule?: boolean;
  className?: string;
  /** extra content under the lead (rating, CTA…) */
  children?: ReactNode;
}

const TITLE_CLASS = { m: "lp-h2", l: "lp-h1", xl: "lp-display-3" } as const;

/**
 * Modern editorial heading block: a meta row (optional tabular section number · kicker pill with
 * the archetype glyph), a big balanced title on the archetype's fluid scale that reveals word by
 * word, and a lead held to a comfortable measure. Choreography: meta fades, title words cascade,
 * lead follows.
 */
export function SectionHeader({
  ctx,
  kicker,
  title,
  lead,
  align = "start",
  number,
  editBase,
  titleAs = "h2",
  size = "l",
  titleId,
  titleReveal,
  titleSplit = true,
  kickerLook,
  animate = true,
  rule = false,
  className,
  children,
}: SectionHeaderProps): ReactElement | null {
  const hasTitle = !!title && !!title.trim();
  const hasLead = !!lead && !!lead.trim();
  const num = number?.trim();
  const hasMeta = !!num || (!!kicker && !!kicker.trim());
  if (!hasTitle && !hasLead && !hasMeta && !children) return null;
  const tKind = titleReveal === undefined ? TITLE_REVEAL[ctx.archetype] : titleReveal;
  return (
    <header className={cx("lp-sh", `lp-sh--${align}`, `lp-sh--${size}`, rule && "lp-sh--rule", className)}>
      {hasMeta ? (
        <div className="lp-sh__meta" {...reveal(animate && "fade")}>
          {num ? (
            <span className="lp-sh__num" aria-hidden="true">
              {num}
            </span>
          ) : null}
          <Kicker ctx={ctx} text={kicker} as="span" look={kickerLook} editPath={joinPath(editBase, "kicker")} />
          {rule ? <span className="lp-sh__rule" aria-hidden="true" {...reveal(animate && "wipe-side", 120)} /> : null}
        </div>
      ) : null}
      {hasTitle ? (
        <RichText
          as={titleAs}
          id={titleId}
          className={cx("lp-sh__title", TITLE_CLASS[size])}
          text={title}
          ctx={ctx}
          editPath={joinPath(editBase, "title")}
          reveal={animate && tKind}
          delay={hasMeta ? 90 : 0}
          split={animate && !!tKind && titleSplit}
        />
      ) : null}
      {hasLead || children ? (
        <div className="lp-sh__side">
          {hasLead ? (
            <RichText
              as="div"
              block
              className="lp-sh__lead lp-lead"
              text={lead}
              ctx={ctx}
              editPath={joinPath(editBase, "lead")}
              reveal={animate && "fade"}
              delay={320}
            />
          ) : null}
          {children ? <div className="lp-sh__extra">{children}</div> : null}
        </div>
      ) : null}
    </header>
  );
}
