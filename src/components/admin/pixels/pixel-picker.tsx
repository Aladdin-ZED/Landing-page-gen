"use client";
/**
 * "Add a pixel" combobox over the library (builder section, wizard choice): search by label or id,
 * grouped by platform; pixels already on the page are hidden; a full platform is disabled with its
 * reason ("TikTok takes up to 3 pixels"). Owners also get "New pixel…".
 */
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tracking } from "@/lib/page/schema";
import { PIXEL_LIMIT, PIXEL_NAMES, PIXEL_PLATFORMS, type PixelPlatform } from "@/lib/pixels/ids";
import { pixelLabel, type LibraryPixel, type PixelLibraryView } from "@/lib/pixels/library";
import { trackingIds } from "@/lib/pixels/tracking";
import { cn } from "@/lib/utils";
import { MaskedId, PlatformMark } from "./parts";

export const limitText = (p: PixelPlatform) => `${PIXEL_NAMES[p]} takes up to ${PIXEL_LIMIT[p]} pixel${PIXEL_LIMIT[p] === 1 ? "" : "s"}`;

export function PixelPicker({
  library,
  tracking,
  onPick,
  onNew,
  label = "Add a pixel",
  className,
  size = "sm",
}: {
  library: PixelLibraryView;
  tracking: Tracking;
  onPick: (p: LibraryPixel) => void;
  /** owners: "New pixel…" */
  onNew?: () => void;
  label?: string;
  className?: string;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const available = library.pixels.filter((p) => !trackingIds(tracking, p.platform).includes(p.id));
  const full = (p: PixelPlatform) => trackingIds(tracking, p).length >= PIXEL_LIMIT[p];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size={size} className={cn("w-fit rounded-full border-dashed", className)}>
          <PlusIcon />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] rounded-xl p-0">
        <Command>
          {library.pixels.length > 5 && <CommandInput placeholder="Search pixels" />}
          <CommandList className="max-h-72">
            <CommandEmpty>{library.pixels.length ? "No other pixel in the library." : "The library is empty."}</CommandEmpty>
            {PIXEL_PLATFORMS.map((platform) => {
              const list = available.filter((p) => p.platform === platform);
              if (!list.length) return null;
              const disabled = full(platform);
              return (
                <CommandGroup key={platform} heading={disabled ? `${PIXEL_NAMES[platform]} · ${limitText(platform)}` : PIXEL_NAMES[platform]}>
                  {list.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${platform} ${p.label} ${p.id}`}
                      disabled={disabled}
                      onSelect={() => {
                        onPick(p);
                        setOpen(false);
                      }}
                      className="gap-2.5 rounded-lg py-2"
                    >
                      <PlatformMark platform={platform} size="sm" />
                      <span className="min-w-0 flex-1 truncate" dir="auto">
                        {pixelLabel(p)}
                      </span>
                      {p.label ? <MaskedId id={p.id} /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {onNew && (
              <>
                {available.length ? <CommandSeparator /> : null}
                <CommandGroup>
                  <CommandItem
                    value="new pixel"
                    onSelect={() => {
                      setOpen(false);
                      onNew();
                    }}
                    className="gap-2.5 rounded-lg py-2"
                  >
                    <span className="flex size-6 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <PlusIcon className="size-3.5" />
                    </span>
                    New pixel…
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
