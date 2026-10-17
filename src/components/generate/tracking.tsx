"use client";
/**
 * @deprecated Details step — "Ad tracking". Pixels belong to pages (docs/OFFERS.md §A): the page's
 * pixels are chosen on the wizard's last step (src/components/admin/pixels/page-tracking-choice.tsx,
 * next to "Create page"), from the pixel library, nothing pre-ticked. Until the wizard drops this
 * block (AD), it only points there, and pixelTracking() answers an empty tracking so no store pixel
 * reaches a new page.
 */
import { ArrowRightIcon, RadarIcon } from "lucide-react";
import type { Tracking } from "@/lib/page/schema";
import type { PixelPlatform } from "@/lib/pixels/ids";
import { maskPixelId as mask } from "@/lib/pixels/library";
import type { StorePixelSummary } from "@/lib/pixels/summary";

export interface PixelStore {
  /** null while loading or when it couldn't be read */
  summary: StorePixelSummary | null;
  failed: boolean;
}

/** @deprecated */
export const pixelKey = (platform: PixelPlatform, id: string) => `${platform}:${id}`;

/** @deprecated no store-wide pixels: a new page gets the pixels chosen on the last step. */
export function pixelTracking(summary: StorePixelSummary | null, off: readonly string[]): Tracking | undefined {
  void off;
  return summary ? {} : undefined;
}

/** "••••3456" — enough to recognize a pixel, not to copy it. */
export const maskPixelId = mask;

/** @deprecated points to the last step, where each page picks its own pixels. */
export function TrackingBlock(props: { store: PixelStore; off: readonly string[]; onChange: (off: string[]) => void }) {
  void props;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-foreground/[0.025] p-4 ring-1 ring-foreground/[0.06] ring-inset">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground ring-1 ring-foreground/[0.08] [&_svg]:size-4">
        <RadarIcon />
      </span>
      <span className="grid gap-0.5">
        <span className="text-[0.85rem] font-medium">Chosen for this page on the last step</span>
        <span className="flex flex-wrap items-center gap-1 text-[0.78rem] leading-relaxed text-pretty text-muted-foreground">
          Every page has its own pixels: pick them next to “Create page”
          <ArrowRightIcon className="size-3.5 rtl:rotate-180" />
        </span>
      </span>
    </div>
  );
}
