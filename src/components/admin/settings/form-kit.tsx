"use client";
/**
 * Settings form kit: section cards, labelled fields with hints/errors, secret inputs that keep
 * the stored value unless replaced, a form-state hook validated by the same zod schemas as the
 * server, and a floating glass save bar that rises when there are unsaved changes.
 */
import { EyeIcon, EyeOffIcon, Loader2Icon, LockKeyholeIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  children,
  aside,
  className,
  id,
  style,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** element at the end of the heading row (status chip, link) */
  aside?: ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section id={id} className={cn("adm-surface adm-rise grid grid-cols-1 gap-5 p-5 sm:p-6", className)} style={style}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        {/* grows to fill the row so the aside stays beside the title until space runs out */}
        <div className="grid max-w-2xl min-w-0 flex-1 basis-72 gap-1">
          <h2 className="text-[1rem] font-semibold tracking-[-0.01em]">{title}</h2>
          {description && <div className="text-sm leading-relaxed text-pretty text-muted-foreground">{description}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-muted-foreground">Optional</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-medium text-destructive"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" id={`${id}-hint`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Input styled for settings (taller, softer). */
export function TextInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn("h-10 rounded-xl bg-background px-3 shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)} {...props} />;
}

const MASK_RE = /^••••[^•]{0,4}$/;

/**
 * Secret field: shows the stored value as a mask (••••3f9a). Leaving the mask untouched keeps the
 * stored secret; typing replaces it; clearing removes it.
 */
export function SecretInput({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const masked = MASK_RE.test(value);
  return (
    <div className="relative">
      <LockKeyholeIcon aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <TextInput
        {...rest}
        type={visible && !masked ? "text" : "password"}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onFocus={(e) => masked && e.currentTarget.select()}
        onChange={(e) => onChange(e.target.value)}
        className="ps-8 pe-10 font-mono text-[0.82rem]"
      />
      {!masked && value && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? "Hide value" : "Show value"}
        >
          {visible ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
        </button>
      )}
    </div>
  );
}

/** Form state validated with a zod schema (same schema the server applies). */
export function useSettingsForm<S extends z.ZodType>(schema: S, initial: z.input<S>) {
  const [base, setBase] = useState(initial);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(base), [values, base]);

  const set = useCallback(<K extends keyof z.input<S>>(key: K, value: z.input<S>[K]) => {
    setValues((v) => ({ ...(v as Record<PropertyKey, unknown>), [key]: value }) as z.input<S>);
    setErrors((e) => {
      if (!e[key as string]) return e;
      const next = { ...e };
      delete next[key as string];
      return next;
    });
  }, []);

  /** Parsed value, or null with field errors shown. */
  const validate = useCallback((): z.output<S> | null => {
    const res = schema.safeParse(values);
    if (res.success) {
      setErrors({});
      return res.data;
    }
    const next: Record<string, string> = {};
    for (const issue of res.error.issues) {
      const key = issue.path.join(".");
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return null;
  }, [schema, values]);

  return {
    values,
    set,
    setValues,
    errors,
    dirty,
    validate,
    /** after a successful save: the saved values become the new baseline */
    commit: (saved: z.input<S>) => {
      setBase(saved);
      setValues(saved);
    },
    discard: () => {
      setValues(base);
      setErrors({});
    },
  };
}

/** Floating save bar: slides up when the form is dirty; Ctrl/⌘+S saves. */
export function SaveBar({ dirty, saving, onSave, onDiscard, disabled }: { dirty: boolean; saving: boolean; onSave: () => void; onDiscard: () => void; disabled?: boolean }) {
  useEffect(() => {
    if (!dirty || disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave();
      }
    };
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [dirty, disabled, onSave]);

  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          className="sticky bottom-5 z-20 mx-auto flex w-full max-w-xl items-center justify-between gap-3 rounded-2xl px-4 py-3 adm-glass"
          role="region"
          aria-label="Unsaved changes"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-warn" />
            </span>
            Unsaved changes
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" className="rounded-full" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
            <Button className="rounded-full px-4" onClick={onSave} disabled={saving || disabled}>
              {saving && <Loader2Icon className="animate-spin" />}
              Save changes
            </Button>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Read-only notice for roles that can see but not change settings. */
export function ReadOnlyNote() {
  return (
    <p className="adm-rise flex items-center gap-2 rounded-2xl bg-foreground/[0.035] px-4 py-3 text-sm text-muted-foreground ring-1 ring-foreground/[0.06] ring-inset">
      <LockKeyholeIcon className="size-4" />
      Only the store owner can change these settings.
    </p>
  );
}
