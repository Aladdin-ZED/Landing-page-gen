"use client";
/**
 * Small pieces shared by the option, item and offer editors (wizard and builder): icon buttons with
 * tooltips, a text input that keeps its draft while focused (undo from outside still shows), a money
 * input that commits at most 2 decimals, and a disclosure row.
 */
import { ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { NumberInput } from "@/components/builder/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function IconAction({
  label,
  onClick,
  disabled,
  compact,
  danger,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  compact: boolean;
  danger?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? "icon-xs" : "icon-sm"}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn("text-muted-foreground", danger && "hover:bg-destructive/10 hover:text-destructive", className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A text input bound to `value` that keeps what the user types while focused: `onCommit` gets the
 * cleaned value on each keystroke (only when it is valid and different), blur shows the stored one.
 */
export function DraftInput({
  value,
  onCommit,
  clean = (s) => s,
  ...rest
}: { value: string; onCommit: (v: string) => void; clean?: (raw: string) => string | null } & Omit<ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue">) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      {...rest}
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const v = clean(e.target.value);
        if (v !== null && v !== value) onCommit(v);
      }}
      onBlur={(e) => {
        setDraft(null);
        rest.onBlur?.(e);
      }}
    />
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Money (≥ 0, at most 2 decimals) with the currency as suffix. */
export function MoneyInput({
  value,
  onCommit,
  currency,
  optional,
  placeholder,
  max = 10_000_000,
  ariaLabel,
  id,
  className,
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  currency?: string;
  optional?: boolean;
  placeholder?: string;
  max?: number;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <NumberInput
      id={id}
      value={value}
      min={0}
      max={max}
      optional={optional}
      placeholder={placeholder}
      suffix={currency}
      ariaLabel={ariaLabel}
      className={className}
      onCommit={(v) => onCommit(v === undefined ? undefined : round2(v))}
    />
  );
}

/** A row that opens a section below it (state kept by the caller or locally). */
export function Disclosure({ title, summary, defaultOpen = false, children, className }: { title: ReactNode; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn("grid", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-7 w-full items-center gap-1.5 rounded-md text-start text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform duration-300 rtl:-scale-x-100", open && "rotate-90 rtl:rotate-90")} />
        <span className="shrink-0">{title}</span>
        {!open && summary ? <span className="min-w-0 flex-1 truncate text-end font-normal">{summary}</span> : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div id={id} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: EASE }} className="overflow-hidden">
            <div className="pt-2">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
