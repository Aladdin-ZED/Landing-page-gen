import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Illustration, type IllustrationName } from "./illustrations";

/**
 * Delightful empty state: an illustration floating on a soft brand aurora with a faint dot grid
 * and film grain, a short title, one sentence, and the next action.
 */
export function EmptyState({
  illustration,
  title,
  description,
  actions,
  compact = false,
  className,
}: {
  illustration: IllustrationName;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** smaller variant for cards and drawers */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "adm-aurora adm-grain adm-fade relative flex flex-col items-center justify-center overflow-hidden rounded-[var(--adm-radius)] text-center",
        compact ? "gap-3 px-6 py-10" : "gap-5 px-6 py-16 sm:py-20",
        "ring-1 ring-border/70 ring-inset",
        className,
      )}
    >
      <div aria-hidden="true" className="adm-dots pointer-events-none absolute inset-0" />
      <Illustration name={illustration} className={cn("relative z-10 drop-shadow-sm", compact ? "w-28" : "w-44")} />
      <div className="relative z-10 grid max-w-md gap-1.5">
        <h3 className={cn("font-semibold tracking-[-0.01em] text-balance", compact ? "text-[0.95rem]" : "text-lg")}>{title}</h3>
        {description && <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
