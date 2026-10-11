"use client";
/**
 * Small building blocks shared by the builder panels: panel headers and collapsible groups, field
 * rows with counters and inline errors, a gliding segmented control, tooltip buttons, color and
 * number inputs that only commit valid values.
 */
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;
/** Label of the platform's shortcut modifier (tooltips and the shortcuts sheet render on the client). */
export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
export const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } as const;

/* ------------------------------------------------------------------ */
/* panel structure                                                     */
/* ------------------------------------------------------------------ */

export function PanelHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}

/** A titled group of controls; collapsible when `collapsible` (open state animates its height). */
export function PanelSection({
  title,
  children,
  action,
  collapsible = false,
  defaultOpen = true,
  className,
  hint,
}: {
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  hint?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={cn("border-t border-[var(--bld-hairline)] px-4 py-3.5 first:border-t-0", className)}>
      {title ? (
        <div className="mb-2.5 flex min-h-6 items-center justify-between gap-2">
          {collapsible ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => setOpen((o) => !o)}
              className="group -mx-1 flex flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-xs font-semibold text-foreground/80 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-300", !open && "-rotate-90")} />
              {title}
            </button>
          ) : (
            <h3 className="text-xs font-semibold text-foreground/80">{title}</h3>
          )}
          {action}
        </div>
      ) : null}
      {hint ? <p className="-mt-1 mb-2.5 text-[11.5px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      {collapsible ? (
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              id={id}
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="-mx-1 overflow-hidden px-1"
            >
              <div className="space-y-3 pb-0.5">{children}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* field rows                                                          */
/* ------------------------------------------------------------------ */

export function FieldRow({
  label,
  htmlFor,
  hint,
  error,
  count,
  max,
  inline = false,
  children,
  className,
  trailing,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  count?: number;
  max?: number;
  /** label and control on one line (toggles, small selects) */
  inline?: boolean;
  children: ReactNode;
  className?: string;
  trailing?: ReactNode;
}) {
  const over = max !== undefined && count !== undefined && count > max;
  const near = max !== undefined && count !== undefined && count >= max * 0.85;
  return (
    <div className={cn("group/field", className)}>
      <div className={cn("flex items-center justify-between gap-3", inline ? "min-h-8" : "mb-1.5")}>
        <label htmlFor={htmlFor} className="min-w-0 text-[12.5px] font-medium leading-tight text-foreground/85">
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {max !== undefined && count !== undefined ? (
            <span
              className={cn(
                "font-mono text-[10.5px] tabular-nums text-muted-foreground/70 transition-opacity",
                !near && "opacity-0 group-focus-within/field:opacity-100",
                near && "text-warn-ink",
                over && "text-destructive",
              )}
              aria-live="polite"
            >
              {count}/{max}
            </span>
          ) : null}
          {inline ? children : null}
        </div>
      </div>
      {inline ? null : children}
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="mt-1.5 text-[11.5px] font-medium text-destructive"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* segmented control                                                   */
/* ------------------------------------------------------------------ */

export interface SegOption<V extends string> {
  value: V;
  label: ReactNode;
  title?: string;
}

/** Radio group with a pill that glides between options. */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  label,
  size = "default",
  className,
  stretch = true,
}: {
  value: V;
  onChange: (v: V) => void;
  options: readonly SegOption<V>[];
  label: string;
  size?: "default" | "sm";
  className?: string;
  stretch?: boolean;
}) {
  const id = useId();
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (dir: number) => {
    const next = options[(index + dir + options.length) % options.length];
    if (next) onChange(next.value);
  };
  return (
    <LayoutGroup id={id}>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-[10px] bg-foreground/[0.05] p-[3px] ring-1 ring-inset ring-foreground/[0.05]",
          stretch && "flex w-full",
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowDown") {
            e.preventDefault();
            move(1);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              title={o.title}
              onClick={() => onChange(o.value)}
              className={cn(
                "relative inline-flex min-w-0 items-center justify-center gap-1.5 rounded-[7px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                stretch && "flex-1",
                size === "sm" ? "h-6 px-2 text-[11.5px]" : "h-7 px-2.5 text-xs",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="pill"
                  className="absolute inset-0 rounded-[7px] bg-background shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.04)] dark:bg-foreground/[0.12]"
                  transition={SPRING}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1.5 truncate [&_svg]:size-3.5">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/[0.04] px-1 font-sans text-[10.5px] font-medium text-current opacity-80",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Icon button with a tooltip (and optional shortcut hint). */
export function TipButton({
  label,
  shortcut,
  side = "bottom",
  children,
  className,
  ...props
}: ComponentProps<typeof Button> & { label: string; shortcut?: string; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} className={cn("bld-press text-foreground/75 hover:text-foreground", className)} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6} className="gap-2">
        {label}
        {shortcut ? <Kbd className="border-background/20 bg-background/10">{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* inputs that commit only valid values                                */
/* ------------------------------------------------------------------ */

/**
 * Text being typed that commits to the store only when `parse` accepts it — keeps the page document
 * valid while the admin types (an empty required name, a half-typed pixel id…). While a draft is
 * being typed it is shown as is; on blur the field shows the stored value again.
 */
export function useCommitted<T>(value: T, format: (v: T) => string, parse: (raw: string) => { value: T } | { error: string }, commit: (v: T) => void) {
  const external = format(value);
  const [draft, setDraft] = useState<string | null>(null);
  const checked = draft === null ? null : parse(draft);
  return {
    raw: draft ?? external,
    error: checked && "error" in checked ? checked.error : null,
    onChange: (next: string) => {
      setDraft(next);
      const res = parse(next);
      if (!("error" in res) && format(res.value) !== external) commit(res.value);
    },
    onFocus: () => undefined,
    onBlur: () => setDraft(null),
  };
}

const num = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? "" : String(v));

/** Number input with an optional unit suffix (currency, %, h…). Empty = undefined when `optional`. */
export function NumberInput({
  id,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  optional = false,
  integer = false,
  placeholder,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  optional?: boolean;
  integer?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const f = useCommitted<number | undefined>(
    value,
    num,
    (raw) => {
      const s = raw.trim().replace(",", ".");
      if (!s) return optional ? { value: undefined } : { error: "Required" };
      const n = Number(s);
      if (!Number.isFinite(n)) return { error: "Enter a number" };
      if (integer && !Number.isInteger(n)) return { error: "Whole numbers only" };
      if (min !== undefined && n < min) return { error: `At least ${min}` };
      if (max !== undefined && n > max) return { error: `At most ${max}` };
      return { value: n };
    },
    onCommit,
  );
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode={integer ? "numeric" : "decimal"}
        value={f.raw}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={!!f.error || undefined}
        onFocus={f.onFocus}
        onBlur={f.onBlur}
        onChange={(e) => f.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
          e.preventDefault();
          const cur = Number((e.currentTarget.value || "0").replace(",", "."));
          if (!Number.isFinite(cur)) return;
          const mult = e.shiftKey ? 10 : 1;
          let next = cur + (e.key === "ArrowUp" ? step : -step) * mult;
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          f.onChange(String(Math.round(next * 100) / 100));
        }}
        className={cn("h-8 tabular-nums", suffix && "pe-12")}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 end-2.5 flex items-center text-[11px] font-medium text-muted-foreground">{suffix}</span>
      ) : null}
      {f.error ? <p className="mt-1 text-[11px] font-medium text-destructive">{f.error}</p> : null}
    </div>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Swatch + hex input + native picker; commits only valid #rrggbb. */
export function ColorInput({ value, onCommit, label, id }: { value: string; onCommit: (hex: string) => void; label: string; id?: string }) {
  const f = useCommitted<string>(
    value,
    (v) => v,
    (raw) => {
      const s = raw.trim();
      const hex = s.startsWith("#") ? s : `#${s}`;
      return HEX.test(hex) ? { value: hex.toLowerCase() } : { error: "Use #rrggbb" };
    },
    onCommit,
  );
  return (
    <div className="flex items-center gap-2">
      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]" style={{ background: value }}>
        <span className="sr-only">{label}</span>
        <input
          type="color"
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onCommit(e.target.value.toLowerCase())}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        id={id}
        value={f.raw}
        aria-label={`${label} hex`}
        aria-invalid={!!f.error || undefined}
        spellCheck={false}
        onFocus={f.onFocus}
        onBlur={f.onBlur}
        onChange={(e) => f.onChange(e.target.value)}
        className="h-8 font-mono text-xs uppercase"
        maxLength={7}
      />
    </div>
  );
}

/** Quiet empty / info block for panels. */
export function Hint({ icon, children, tone = "muted", className }: { icon?: ReactNode; children: ReactNode; tone?: "muted" | "warn" | "brand"; className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed",
        tone === "muted" && "bg-foreground/[0.035] text-muted-foreground",
        tone === "warn" && "bg-warn/10 text-warn-ink",
        tone === "brand" && "bg-brand-soft text-foreground/80",
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0 [&_svg]:size-3.5">{icon}</span> : null}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* select                                                              */
/* ------------------------------------------------------------------ */

/** Compact select over string options (falls back to the raw value when unknown). */
export function Choice<V extends string>({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  ariaLabel,
}: {
  id?: string;
  value: V | undefined;
  onChange: (v: V) => void;
  options: readonly { value: V; label: ReactNode }[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <Select value={value ?? ""} onValueChange={(v) => onChange(v as V)}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn("h-8 w-full text-[13px]", className)}>
        <SelectValue placeholder={placeholder ?? "Choose…"} />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4} className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
