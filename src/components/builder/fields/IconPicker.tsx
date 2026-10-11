"use client";
/**
 * Icon picker for `icon` fields: the landing icon set (the exact glyphs visitors will see),
 * searchable, keyboard-navigable grid in a popover.
 */
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/landing/primitives/Icon";
import { ICON_NAMES, isIconName, type IconName } from "@/landing/primitives/icons";
import { cn } from "@/lib/utils";

const pretty = (name: string) => name.replace(/-/g, " ");

export function IconPicker({ id, value, onChange }: { id?: string; value: unknown; onChange: (name: IconName) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = isIconName(value) ? value : null;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? ICON_NAMES.filter((n) => pretty(n).includes(needle)) : ICON_NAMES;
  }, [q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-input bg-transparent px-2 text-left text-[13px] outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <span className="grid size-6 place-items-center rounded-md bg-foreground/[0.06] text-foreground">
            {current ? <Icon name={current} size={16} /> : null}
          </span>
          <span className="flex-1 truncate capitalize">{current ? pretty(current) : "Choose an icon"}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[17.5rem] p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search icons"
            aria-label="Search icons"
            className="h-8 w-full rounded-lg bg-foreground/[0.04] ps-8 pe-2 text-[13px] outline-none ring-1 ring-inset ring-foreground/[0.06] focus:ring-ring/60"
          />
        </div>
        <div role="listbox" aria-label="Icons" className="bld-scroll grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
          {list.map((name) => (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={name === current}
              aria-label={pretty(name)}
              title={pretty(name)}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              className={cn(
                "grid aspect-square place-items-center rounded-lg text-foreground/80 outline-none transition-[background-color,transform] duration-200 hover:scale-105 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
                name === current && "bg-brand-soft text-foreground ring-1 ring-inset ring-[color-mix(in_oklab,var(--brand)_45%,transparent)]",
              )}
            >
              <Icon name={name} size={20} />
            </button>
          ))}
          {list.length === 0 ? <p className="col-span-6 py-6 text-center text-xs text-muted-foreground">No icon matches “{q}”.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
