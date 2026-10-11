"use client";
/**
 * Allow-list editor of connected exports: domains become chips as they are typed (Enter, comma,
 * space, paste or blur). Each entry is validated with the order API's own matcher, so a chip the
 * server would ignore ("*.co.ma", "localhost/path") is never added.
 */
import { GlobeIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { MAX_ALLOWED_ORIGINS, normalizeAllowedOrigins } from "@/lib/export/options";
import { cn } from "@/lib/utils";

export function DomainInput({
  id,
  value,
  onChange,
  error,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** server-side message for the field */
  error?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  /** Adds every entry of `raw`; returns the part that could not be added (kept in the box). */
  const commit = (raw: string): string => {
    const parts = raw.split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return "";
    const { origins, invalid } = normalizeAllowedOrigins(parts);
    const next = [...value];
    for (const o of origins) if (!next.includes(o)) next.push(o);
    if (next.length > MAX_ALLOWED_ORIGINS) {
      setLocal(`At most ${MAX_ALLOWED_ORIGINS} domains per export.`);
      return raw.trim();
    }
    if (next.length !== value.length) onChange(next);
    if (invalid.length) {
      setLocal(`“${invalid[0]}” can't be used — write shop.ma, https://shop.ma or *.shop.ma (one site per entry).`);
      return invalid.join(" ");
    }
    setLocal(null);
    return "";
  };

  const message = local ?? error ?? null;
  return (
    <div className="grid gap-1.5">
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2 py-1.5 transition-[border-color,box-shadow] duration-200 dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          message ? "border-destructive/60" : "border-input",
        )}
        onClick={(e) => {
          if (e.target === e.currentTarget) document.getElementById(id)?.focus();
        }}
      >
        <GlobeIcon aria-hidden="true" className="ms-1 size-4 shrink-0 text-muted-foreground" />
        <AnimatePresence initial={false} mode="popLayout">
          {value.map((o) => (
            <motion.span
              key={o}
              layout
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 520, damping: 32 }}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-lg bg-brand/10 ps-2.5 pe-1 font-mono text-xs text-foreground ring-1 ring-brand/20 ring-inset"
            >
              <span className="truncate">{o}</span>
              <button
                type="button"
                aria-label={`Remove ${o}`}
                onClick={() => onChange(value.filter((v) => v !== o))}
                className="flex size-5 items-center justify-center rounded-md text-foreground/55 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                <XIcon className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          id={id}
          value={text}
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          placeholder={value.length ? "Add another domain" : "shop.ma, www.shop.ma or *.shop.ma"}
          className="h-7 min-w-[10rem] flex-1 bg-transparent px-1 font-mono text-[0.8rem] outline-none placeholder:font-sans placeholder:text-muted-foreground"
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;\s]$/.test(v)) setText(commit(v));
            else {
              setText(v);
              if (local) setLocal(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setText(commit(text));
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (/[,;\s]/.test(pasted.trim())) {
              e.preventDefault();
              setText(commit(`${text}${pasted}`));
            }
          }}
          onBlur={() => setText(commit(text))}
        />
      </div>
      <AnimatePresence initial={false}>
        {message && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-xs text-destructive"
          >
            {message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
