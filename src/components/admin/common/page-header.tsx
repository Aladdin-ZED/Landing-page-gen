import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Screen heading: an optional quiet kicker (a date, a step: never a section name the breadcrumb
 * already shows), a tight semibold title, a muted lead, and actions aligned to the title's baseline
 * row. Enters with a soft blur-rise.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  still = false,
}: {
  /** small muted line above the title; use it for context the breadcrumb doesn't carry */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** extra row under the heading (tabs, filters) */
  children?: ReactNode;
  className?: string;
  /** no entrance motion: for a header that replaces an identical placeholder (it already rose) */
  still?: boolean;
}) {
  const rise = still ? "" : "adm-rise";
  return (
    <header className={cn("mb-8 grid gap-6", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className={cn(rise, "grid min-w-0 gap-2")}>
          {eyebrow && <p className="text-[0.8rem] font-medium text-muted-foreground tabular-nums">{eyebrow}</p>}
          <h1 className="font-display text-[1.95rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-[2.25rem]">{title}</h1>
          {description && <div className="max-w-[62ch] text-[0.95rem] leading-relaxed text-pretty text-muted-foreground">{description}</div>}
        </div>
        {actions && (
          <div className={cn(rise, "flex shrink-0 flex-wrap items-center gap-2")} style={{ ["--i" as string]: 2 }}>
            {actions}
          </div>
        )}
      </div>
      {children && (
        <div className={rise || undefined} style={{ ["--i" as string]: 3 }}>
          {children}
        </div>
      )}
    </header>
  );
}

/** Section title inside a screen (cards, settings groups). */
export function SectionTitle({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="grid gap-1">
        <h2 className="text-[0.95rem] font-semibold tracking-[-0.01em]">{title}</h2>
        {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
