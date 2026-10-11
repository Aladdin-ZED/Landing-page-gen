import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "../lib/status";

/** Soft tinted pill per tone: translucent fill, hairline ring, saturated dot. Works in dark mode. */
export const TONE_CLASSES: Record<Tone, { chip: string; dot: string }> = {
  neutral: { chip: "bg-foreground/[0.05] text-foreground/70 ring-foreground/10", dot: "bg-foreground/35" },
  brand: { chip: "bg-brand/10 text-brand ring-brand/20", dot: "bg-brand" },
  blue: { chip: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300", dot: "bg-sky-500" },
  green: { chip: "bg-green-500/10 text-green-700 ring-green-500/20 dark:text-green-300", dot: "bg-green-500" },
  emerald: { chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300", dot: "bg-emerald-500" },
  /* yellow, never amber/orange (see the color rule in src/app/globals.css) */
  warn: { chip: "bg-warn/15 text-warn-ink ring-warn/40", dot: "bg-warn" },
  violet: { chip: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300", dot: "bg-violet-500" },
  teal: { chip: "bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300", dot: "bg-teal-500" },
  rose: { chip: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300", dot: "bg-rose-500" },
  /* crimson (Tailwind's red-500+ drifts into red-orange) */
  red: { chip: "bg-destructive/10 text-destructive ring-destructive/20", dot: "bg-destructive" },
};

export function StatusChip({
  tone,
  children,
  dot = true,
  pulse = false,
  className,
  title,
}: {
  tone: Tone;
  children: ReactNode;
  dot?: boolean;
  /** a soft pulsing halo on the dot (live states) */
  pulse?: boolean;
  className?: string;
  title?: string;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs leading-none font-medium whitespace-nowrap ring-1 ring-inset",
        t.chip,
        className,
      )}
    >
      {dot && (
        <span aria-hidden="true" className="relative flex size-1.5">
          {pulse && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", t.dot)} />}
          <span className={cn("relative inline-flex size-1.5 rounded-full", t.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
