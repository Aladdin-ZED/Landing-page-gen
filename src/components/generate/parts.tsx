"use client";
/**
 * Small building blocks of the generator wizard: the step rail, the on-device AI chip, progress
 * ring and bar, palette swatches, card shell and the floating step footer.
 */
import { CheckIcon, CpuIcon, Loader2Icon } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useId, type ComponentProps, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AiStage, UseAi } from "@/lib/ai/client";
import { cn } from "@/lib/utils";
import { progressRatio, progressText } from "./labels";
import { STEPS, type Step } from "./state";

const SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 0.8 } as const;

/* ------------------------------------------------------------------ */
/* Step rail                                                           */
/* ------------------------------------------------------------------ */

export function StepRail({ step, canGo, onGo }: { step: Step; canGo: (s: Step) => boolean; onGo: (s: Step) => void }) {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <nav aria-label="Generator steps">
        {/* phones: the current step takes the room for its name, the others shrink to their number */}
        <ol className="adm-surface-flat flex gap-1 rounded-2xl p-1.5 sm:grid sm:grid-cols-4">
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const enabled = canGo(i as Step);
            return (
              <li key={s.id} className={cn("min-w-0", active ? "flex-1" : "shrink-0")}>
                <button
                  type="button"
                  disabled={!enabled || active}
                  aria-current={active ? "step" : undefined}
                  onClick={() => onGo(i as Step)}
                  className={cn(
                    "relative flex w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-3.5 sm:py-2.5",
                    enabled && !active && "hover:bg-background/60",
                    !enabled && "cursor-not-allowed opacity-55",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="gen-step"
                      transition={SPRING}
                      className="absolute inset-0 rounded-xl bg-background shadow-[0_1px_2px_rgb(0_0_0/0.05),0_10px_24px_-14px_rgb(0_0_0/0.25)] ring-1 ring-foreground/[0.07] dark:bg-foreground/10"
                    />
                  )}
                  <span
                    className={cn(
                      "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-[0.75rem] font-semibold tabular-nums transition-colors duration-300",
                      done && "bg-brand text-brand-foreground",
                      active && "bg-foreground text-background",
                      !done && !active && "bg-foreground/[0.06] text-muted-foreground ring-1 ring-foreground/[0.06] ring-inset",
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" strokeWidth={2.6} /> : i + 1}
                  </span>
                  <span className={cn("relative z-10 min-w-0", active ? "grid" : "hidden sm:grid")}>
                    <span className={cn("truncate text-[0.85rem] font-medium", active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                    <span className="truncate text-[0.72rem] text-muted-foreground/80">{s.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */
/* On-device AI chip                                                   */
/* ------------------------------------------------------------------ */

const TIER_TEXT = { full: "Full · Qwen3.5 2B", lite: "Lite · Qwen3.5 0.8B", off: "Photo reading only" } as const;

export function AiChip({ ai }: { ai: UseAi }) {
  const caps = ai.capabilities;
  const working = ai.status === "loading" || ai.status === "busy";
  const off = ai.status === "off";
  const tier = caps?.tier ?? null;
  const dot = off ? "bg-muted-foreground/50" : ai.status === "error" ? "bg-destructive" : working ? "bg-warn" : tier === null ? "bg-muted-foreground/40" : "bg-success";
  const text = off ? "On-device AI off" : tier === null ? "Checking this device…" : `On-device AI · ${TIER_TEXT[tier]}`;
  const help = off
    ? "Local AI is switched off in Settings → AI. Pages still get hand-written copy from the library."
    : tier === "off"
      ? `${caps?.note ?? "This browser can't run the language model."} Photos are still read and cut out on this computer; the copy comes from the hand-written library.`
      : "Models run in this browser — your photos and texts never leave this computer. Each model downloads once, then loads from the cache.";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="adm-glass inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[0.8rem] font-medium" tabIndex={0}>
          <span className="relative grid size-2 place-items-center">
            {working && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", dot)} />}
            <span className={cn("relative size-2 rounded-full", dot)} />
          </span>
          <CpuIcon className="size-3.5 text-muted-foreground" />
          <span className="max-w-[16rem] truncate">{working && ai.progress ? progressText(ai.progress) : text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{help}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

/** Thin progress line; indeterminate (gliding) when `value` is null. */
export function ProgressLine({ value, className }: { value: number | null; className?: string }) {
  return (
    <div className={cn("relative h-1 overflow-hidden rounded-full bg-foreground/[0.07]", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      {value === null ? (
        <motion.span
          className="absolute inset-y-0 start-0 w-1/3 rounded-full bg-brand"
          initial={{ x: "-110%" }}
          animate={{ x: "320%" }}
          transition={{ duration: 1.4, ease: [0.45, 0, 0.25, 1], repeat: Infinity }}
        />
      ) : (
        <motion.span className="absolute inset-y-0 start-0 rounded-full bg-brand" initial={false} animate={{ width: `${Math.max(2, value * 100)}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
      )}
    </div>
  );
}

/** AI job progress: label + line, from the shared AI progress state. */
export function AiProgress({ ai, stages, className }: { ai: UseAi; /** stages of this job; another job's progress reads as "queued" */ stages?: readonly AiStage[]; className?: string }) {
  const p = ai.progress;
  const mine = !p || !stages || stages.includes(p.stage);
  return (
    <div className={cn("grid gap-2", className)}>
      <p className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        <span className="truncate">{!mine ? "Queued — the AI finishes the current job first…" : p ? progressText(p) : "Starting…"}</span>
      </p>
      <ProgressLine value={mine ? progressRatio(p) : null} />
    </div>
  );
}

export function ProgressRing({ value, size = 44, className }: { value: number | null; size?: number; className?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("-rotate-90", value === null && "animate-spin", className)} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={3} className="stroke-foreground/10" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
        className="stroke-brand"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: value === null ? c * 0.72 : c * (1 - Math.max(0.03, value)) }}
        transition={{ type: "spring", stiffness: 110, damping: 22 }}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Swatches, cards, footer                                             */
/* ------------------------------------------------------------------ */

export function Swatches({ colors, size = "md", className }: { colors: readonly string[]; size?: "sm" | "md"; className?: string }) {
  if (!colors.length) return null;
  return (
    <ul className={cn("flex items-center", size === "sm" ? "-space-x-1.5" : "gap-2", className)} aria-label="Palette">
      {colors.map((hex, i) => (
        <motion.li key={`${hex}-${i}`} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...SPRING, delay: i * 0.05 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className={cn(
                  "block rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.08)] outline-none ring-background focus-visible:ring-2",
                  size === "sm" ? "size-5 ring-2" : "size-8",
                )}
                style={{ background: hex }}
              />
            </TooltipTrigger>
            <TooltipContent className="font-mono text-xs uppercase">{hex}</TooltipContent>
          </Tooltip>
        </motion.li>
      ))}
    </ul>
  );
}

export function Panel({ children, className, ...rest }: { children: ReactNode; className?: string } & Omit<ComponentProps<"section">, "children" | "className">) {
  return (
    <section className={cn("adm-surface overflow-hidden", className)} {...rest}>
      {children}
    </section>
  );
}

export function PanelHead({ icon, title, description, aside }: { icon: ReactNode; title: ReactNode; description?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-[1.05rem]">{icon}</span>
        <div className="grid min-w-0 gap-0.5">
          <h2 className="text-[0.95rem] font-semibold tracking-[-0.005em]">{title}</h2>
          {description && <p className="text-[0.82rem] leading-relaxed text-pretty text-muted-foreground">{description}</p>}
        </div>
      </div>
      {aside}
    </header>
  );
}

/** Glass footer with the step's navigation (floating while the step needs its button). */
export function StepFooter({ status, back, next, sticky = true }: { status?: ReactNode; back?: ReactNode; next?: ReactNode; sticky?: boolean }) {
  return (
    <div className={cn("z-20 mt-8", sticky && "sticky bottom-4")}>
      <div className="adm-glass flex items-center gap-3 rounded-2xl px-2.5 py-2.5 sm:px-3">
        <div className="shrink-0">{back}</div>
        <div className="min-w-0 flex-1 truncate text-center text-[0.8rem] text-muted-foreground">{status}</div>
        <div className="shrink-0">{next}</div>
      </div>
    </div>
  );
}

/** Enter/leave animation of a step body. */
export const stepMotion = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(4px)" },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
} as const;
