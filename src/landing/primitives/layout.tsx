import type { ReactElement, ReactNode } from "react";
import type { SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../types";
import { cx } from "./util";

export interface ContainerProps {
  /** narrow ≈ reading measure, normal = --lp-container, wide = container + 10rem, bleed = full width */
  size?: "narrow" | "normal" | "wide" | "bleed";
  as?: "div" | "section" | "header" | "footer" | "nav" | "article";
  className?: string;
  children?: ReactNode;
}

/** Centered column with the theme gutter (logical properties, works RTL). */
export function Container({ size = "normal", as = "div", className, children }: ContainerProps): ReactElement {
  const Tag = as;
  return <Tag className={cx("lp-container", size !== "normal" && `lp-container--${size}`, className)}>{children}</Tag>;
}

export type SectionSpace = "tight" | "normal" | "airy";

export interface SectionShellProps {
  /** section instance id (data-sid + default DOM id) */
  id: string;
  ctx: RenderContext;
  /** section type, e.g. "benefits" → class lp-benefits */
  type: string;
  variant: string;
  bg: SectionBg;
  /** vertical rhythm; default = the instance's spacing in the PageDoc */
  space?: SectionSpace;
  /** DOM id override (the order form must be id="order") */
  anchor?: string;
  /** id of the visible heading that names the section */
  labelledBy?: string;
  /** accessible name when there is no visible heading */
  label?: string;
  as?: "section" | "div" | "aside" | "header" | "footer";
  className?: string;
  children?: ReactNode;
}

/**
 * Root element for in-flow sections: `.lp-section.lp-{type}.lp-{type}--{variant}` with
 * data-sid (editor hook), data-bg (color-block → --sec-* vars) and data-space (padding rhythm).
 * Floating sections (sticky bar, WhatsApp bubble) render their own fixed root instead — the
 * section box isolates stacking contexts, which would trap a fixed child under later sections.
 */
export function SectionShell({
  id,
  ctx,
  type,
  variant,
  bg,
  space,
  anchor,
  labelledBy,
  label,
  as = "section",
  className,
  children,
}: SectionShellProps): ReactElement {
  const Tag = as;
  const spacing = space ?? ctx.doc.sections.find((s) => s.id === id)?.spacing ?? "normal";
  // a plain <div> may not carry an accessible name: a named div root becomes a region, like <section>
  const named = !!(labelledBy || label);
  return (
    <Tag
      id={anchor ?? id}
      className={cx("lp-section", `lp-${type}`, `lp-${type}--${variant}`, className)}
      data-sid={id}
      data-bg={bg}
      data-space={spacing}
      role={Tag === "div" && named ? "region" : undefined}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
    >
      {children}
    </Tag>
  );
}

/** "Skip to content" in each page language (i18n.ts carries no a11y.skip key yet). */
const SKIP_LABEL: Record<string, string> = {
  ar: "انتقل إلى المحتوى",
  fr: "Aller au contenu",
  en: "Skip to content",
};

export interface SkipLinkProps {
  ctx: Pick<RenderContext, "locale">;
  /** id of the main landmark (default "main") */
  target?: string;
  label?: string;
}

/**
 * The first focusable element of a document: jumps keyboard users past the bars to the main landmark
 * (give it tabIndex={-1} so focus lands there). Out of sight until focused (base.css .lp-skip).
 */
export function SkipLink({ ctx, target = "main", label }: SkipLinkProps): ReactElement {
  return (
    <a className="lp-skip" href={`#${target}`}>
      {label?.trim() || SKIP_LABEL[ctx.locale] || SKIP_LABEL.en}
    </a>
  );
}
