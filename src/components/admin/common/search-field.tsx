"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Debounced search box (commits after 250 ms of quiet or on Enter). Shows a spinner while the
 * parent's list is refreshing, and a clear button.
 */
export function SearchField({
  value,
  onCommit,
  placeholder = "Search…",
  pending = false,
  className,
  label,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  pending?: boolean;
  className?: string;
  label?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // the URL changed from elsewhere (back button, a chip): follow it
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const schedule = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(next.trim()), 250);
  };

  return (
    <div className={cn("group relative w-full sm:w-72", className)}>
      <SearchIcon aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-foreground" />
      <input
        type="search"
        value={draft}
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        onChange={(e) => schedule(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) clearTimeout(timer.current);
            onCommit(draft.trim());
          }
          if (e.key === "Escape" && draft) {
            e.preventDefault();
            schedule("");
          }
        }}
        className="h-9 w-full rounded-full bg-foreground/[0.04] ps-9 pe-9 text-sm ring-1 ring-foreground/[0.07] transition-all duration-300 ring-inset outline-none placeholder:text-muted-foreground hover:bg-foreground/[0.055] focus:bg-background focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--ring)_18%,transparent)] focus:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
      />
      <span className="absolute end-2 top-1/2 flex -translate-y-1/2 items-center">
        {pending ? (
          <Loader2Icon aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
        ) : draft ? (
          <button
            type="button"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setDraft("");
              onCommit("");
            }}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Clear search"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}
