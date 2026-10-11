"use client";
/**
 * "How orders arrive" — the three export modes as selectable cards (a radiogroup: arrows move the
 * selection). The selected card gets a brand ring that glides between cards and a check that pops.
 */
import { CheckIcon, MessageCircleIcon, PlugZapIcon, ServerIcon, type LucideIcon } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useId } from "react";
import { EXPORT_MODES, type ExportMode } from "@/lib/export/options";
import { cn } from "@/lib/utils";

export const MODE_META: Record<ExportMode, { title: string; tagline: string; description: string; icon: LucideIcon; tags: string[] }> = {
  connected: {
    title: "Connected",
    tagline: "Orders come back here",
    description: "Host it anywhere. Orders, Sheets sync, upsells and stats stay in this studio.",
    icon: PlugZapIcon,
    tags: ["Any host", "Revocable key"],
  },
  php: {
    title: "Standalone PHP",
    tagline: "order.php on your hosting",
    description: "A self-contained endpoint re-checks prices and writes to your Google Sheet.",
    icon: ServerIcon,
    tags: ["Hostinger · cPanel", "PHP 8.1+"],
  },
  whatsapp: {
    title: "WhatsApp",
    tagline: "Orders arrive in your chats",
    description: "No server at all: the form opens WhatsApp with the order written out.",
    icon: MessageCircleIcon,
    tags: ["Any host", "Zero setup"],
  },
};

const SPRING = { type: "spring", stiffness: 460, damping: 36, mass: 0.8 } as const;

export function ModeCards({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: ExportMode;
  onChange: (mode: ExportMode) => void;
  /** modes that cannot be chosen, with the reason shown on the card */
  disabled: Partial<Record<ExportMode, string>>;
  labelledBy: string;
}) {
  const group = useId();
  const enabled = EXPORT_MODES.filter((m) => !disabled[m]);
  const cardId = (mode: ExportMode) => `${group}-${mode}`;
  /** Radio pattern: the selection and the focus move together (Home/End jump to the ends). */
  const select = (next: ExportMode | undefined) => {
    if (!next) return;
    onChange(next);
    document.getElementById(cardId(next))?.focus();
  };
  const move = (dir: number) => {
    const i = enabled.indexOf(value);
    select(enabled[(Math.max(0, i) + dir + enabled.length) % enabled.length]);
  };
  return (
    <LayoutGroup id={group}>
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        className="grid gap-2.5 sm:grid-cols-3"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            select(e.key === "Home" ? enabled[0] : enabled[enabled.length - 1]);
          }
        }}
      >
        {EXPORT_MODES.map((mode) => {
          const meta = MODE_META[mode];
          const Icon = meta.icon;
          const active = mode === value;
          const reason = disabled[mode];
          return (
            <button
              key={mode}
              id={cardId(mode)}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={reason ? true : undefined}
              tabIndex={active ? 0 : -1}
              onClick={() => !reason && onChange(mode)}
              className={cn(
                "group relative flex min-h-full flex-col items-start gap-3 rounded-2xl p-4 text-left outline-none",
                "bg-card ring-1 ring-foreground/[0.08] ring-inset transition-[background-color,box-shadow,transform] duration-300",
                // focus gets its own outline outside the card: the selection ring would hide an inset one
                "focus-visible:[outline:2px_solid_var(--ring)] focus-visible:[outline-offset:5px]",
                reason ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-20px_rgb(30_22_14/0.35)] active:translate-y-0",
                active && "bg-brand/[0.035] dark:bg-brand/[0.07]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="mode-ring"
                  aria-hidden="true"
                  transition={SPRING}
                  className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand ring-inset shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent),0_18px_40px_-24px_color-mix(in_oklab,var(--brand)_70%,transparent)]"
                />
              )}
              <span className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl transition-colors duration-300",
                    active ? "bg-brand text-brand-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]" : "bg-foreground/[0.05] text-foreground/70",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <AnimatePresence initial={false}>
                  {active && (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 600, damping: 26 }}
                      className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground"
                    >
                      <CheckIcon className="size-3" strokeWidth={3} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className="grid gap-1">
                <span className="text-[0.95rem] font-semibold tracking-[-0.01em]">{meta.title}</span>
                <span className="text-[0.8rem] font-medium text-foreground/75">{meta.tagline}</span>
                <span className="text-xs leading-relaxed text-pretty text-muted-foreground">{reason ?? meta.description}</span>
              </span>
              <span className="mt-auto flex flex-wrap gap-1">
                {meta.tags.map((t) => (
                  <span key={t} className="rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[0.68rem] font-medium text-foreground/65">
                    {t}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
