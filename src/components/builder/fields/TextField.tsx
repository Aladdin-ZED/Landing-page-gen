"use client";
/**
 * Text and multi-line text fields with a character counter and an *emphasis* toggle on the selected
 * words (✱ button or Ctrl/⌘+I; the landing renders it as the theme's accent treatment). The ✱ shows
 * faintly while the field is focused as a hint. Direction follows the content, so Arabic copy is
 * edited right-to-left.
 */
import { Asterisk } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FieldRow, MOD } from "../ui";


export function TextField({
  id,
  label,
  value,
  onChange,
  max,
  placeholder,
  help,
  error,
  multiline = false,
  rows = 3,
  emphasis = true,
  mono = false,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
  help?: string;
  error?: string | null;
  multiline?: boolean;
  rows?: number;
  emphasis?: boolean;
  mono?: boolean;
}) {
  const text = typeof value === "string" ? value : "";
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const pendingSel = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const sel = pendingSel.current;
    if (sel && ref.current) {
      ref.current.setSelectionRange(sel[0], sel[1]);
      pendingSel.current = null;
    }
  });

  const track = () => {
    const el = ref.current;
    setHasSelection(!!el && el.selectionStart !== null && el.selectionEnd !== null && el.selectionEnd > el.selectionStart);
  };

  const toggleEmphasis = () => {
    const el = ref.current;
    if (!el || el.selectionStart === null || el.selectionEnd === null) return;
    let a = el.selectionStart;
    let b = el.selectionEnd;
    if (b <= a) return;
    const v = el.value;
    // trim the selection to the words
    while (a < b && v[a] === " ") a++;
    while (b > a && v[b - 1] === " ") b--;
    const words = v.slice(a, b);
    let next: string;
    if (v[a - 1] === "*" && v[b] === "*") {
      next = v.slice(0, a - 1) + words + v.slice(b + 1);
      pendingSel.current = [a - 1, b - 1];
    } else {
      next = `${v.slice(0, a)}*${words.replace(/\*/g, "")}*${v.slice(b)}`;
      pendingSel.current = [a + 1, a + 1 + words.replace(/\*/g, "").length];
    }
    if (max !== undefined && next.length > max) return;
    onChange(next);
  };

  const shared = {
    id,
    ref,
    value: text,
    dir: "auto" as const,
    placeholder,
    maxLength: max,
    "aria-invalid": !!error || undefined,
    "aria-describedby": error || help ? `${id}-note` : undefined,
    onSelect: track,
    onBlur: () => setHasSelection(false),
    onKeyUp: track,
    onMouseUp: track,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (emphasis && (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggleEmphasis();
      }
    },
  };

  return (
    <FieldRow
      label={label}
      htmlFor={id}
      hint={help ? <span id={`${id}-note`}>{help}</span> : undefined}
      error={error}
      count={text.length}
      max={max}
      trailing={
        emphasis ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                tabIndex={-1}
                aria-label="Emphasize the selected words"
                disabled={!hasSelection}
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggleEmphasis}
                className={cn(
                  "grid size-5 place-items-center rounded-md transition-[opacity,background-color,color] duration-200 hover:bg-brand-soft hover:text-foreground",
                  hasSelection ? "text-foreground opacity-100" : "pointer-events-none text-muted-foreground opacity-0 group-focus-within/field:opacity-50",
                )}
              >
                <Asterisk className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-56">
              Select words, then click (or {MOD}+I) to emphasize them in the theme&apos;s accent style — saved as *words*.
            </TooltipContent>
          </Tooltip>
        ) : null
      }
    >
      {multiline ? (
        <Textarea
          {...shared}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={cn("field-sizing-content min-h-[4.5rem] resize-none text-[13px] leading-relaxed", mono && "font-mono text-xs")}
        />
      ) : (
        <Input {...shared} onChange={(e) => onChange(e.target.value)} className={cn("h-8 text-[13px]", mono && "font-mono text-xs")} />
      )}
    </FieldRow>
  );
}
