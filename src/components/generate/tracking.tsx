"use client";
/**
 * Details step — "Ad tracking": the store's pixels (Settings → Pixels: Meta, TikTok, Snapchat, GA4)
 * that the new page fires, each one ticked by default and untickable for this page only. Ids are
 * shown masked; server events and test mode are flagged. Without any store pixel, a short empty
 * state points to Settings → Pixels.
 *
 * The data is the store summary (storePixelSummaryAction: ids and flags, never a token); the page's
 * tracking is trackingForNewPage(summary, kept) — see pixelTracking().
 */
import { ExternalLinkIcon, RadarIcon } from "lucide-react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import type { Tracking } from "@/lib/page/schema";
import { PIXEL_NAMES, PIXEL_PLATFORMS, type PixelPlatform } from "@/lib/pixels/ids";
import { trackingForNewPage, type StorePixelSummary } from "@/lib/pixels/summary";
import { cn } from "@/lib/utils";

export interface PixelStore {
  /** null while loading or when it couldn't be read */
  summary: StorePixelSummary | null;
  failed: boolean;
}

/** Key of one store pixel in Details.pixelsOff. */
export const pixelKey = (platform: PixelPlatform, id: string) => `${platform}:${id}`;

/** The page's tracking: every store pixel except the unticked ones; undefined until the store is read. */
export function pixelTracking(summary: StorePixelSummary | null, off: readonly string[]): Tracking | undefined {
  if (!summary) return undefined;
  const skip = new Set(off);
  const picked = Object.fromEntries(PIXEL_PLATFORMS.map((p) => [p, summary.platforms[p].map((x) => x.id).filter((id) => !skip.has(pixelKey(p, id)))])) as Record<PixelPlatform, string[]>;
  return trackingForNewPage(summary, picked);
}

/** "••••3456" — enough to recognize a pixel, not to copy it. */
export const maskPixelId = (id: string) => (id.length > 6 ? `••••${id.slice(-4)}` : id);

export function TrackingBlock({ store, off, onChange }: { store: PixelStore; off: readonly string[]; onChange: (off: string[]) => void }) {
  const { summary } = store;
  if (!summary) {
    return store.failed ? (
      <p className="text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">Your store pixels couldn&apos;t be read just now — the page still gets them when it is saved.</p>
    ) : (
      <div className="grid gap-2" aria-busy="true" aria-label="Reading your store pixels">
        <div className="h-12 animate-pulse rounded-xl bg-foreground/[0.04]" />
      </div>
    );
  }

  if (!summary.configured) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-foreground/[0.025] p-4 ring-1 ring-foreground/[0.06] ring-inset sm:flex-row sm:items-center sm:justify-between">
        <span className="flex min-w-0 items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-muted-foreground ring-1 ring-foreground/[0.08] [&_svg]:size-4">
            <RadarIcon />
          </span>
          <span className="grid gap-0.5">
            <span className="text-[0.85rem] font-medium">No ad pixels yet</span>
            <span className="text-[0.78rem] leading-relaxed text-pretty text-muted-foreground">
              Add your Meta or TikTok pixel once in Settings → Pixels — every new page then fires it, ready for your ads.
            </span>
          </span>
        </span>
        <Link
          href="/admin/settings/pixels"
          target="_blank"
          rel="noopener"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full bg-background px-3.5 text-[0.8rem] font-medium shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-foreground/[0.1] outline-none transition-colors hover:bg-foreground/[0.03] focus-visible:ring-2 focus-visible:ring-ring/60 sm:self-center"
        >
          Open Settings → Pixels
          <ExternalLinkIcon className="size-3.5 text-muted-foreground" />
        </Link>
      </div>
    );
  }

  const skip = new Set(off);
  const rows = PIXEL_PLATFORMS.flatMap((p) => summary.platforms[p].map((px, i) => ({ platform: p, px, backup: i > 0 })));
  const on = rows.filter((r) => !skip.has(pixelKey(r.platform, r.px.id))).length;
  const toggle = (key: string, checked: boolean) => onChange(checked ? off.filter((k) => k !== key) : [...off.filter((k) => k !== key), key]);

  return (
    <div className="grid gap-2.5">
      <ul className="grid gap-1.5">
        {rows.map(({ platform, px, backup }) => {
          const key = pixelKey(platform, px.id);
          const checked = !skip.has(key);
          const id = `px-${key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
          return (
            <li key={key}>
              <label
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 ring-inset transition-colors",
                  checked ? "bg-background ring-foreground/[0.09] hover:ring-foreground/[0.16]" : "bg-foreground/[0.02] ring-foreground/[0.05] text-muted-foreground",
                )}
              >
                <Checkbox id={id} checked={checked} onCheckedChange={(v) => toggle(key, v === true)} className="data-checked:border-brand data-checked:bg-brand data-checked:text-brand-foreground" />
                <span className="grid min-w-0 flex-1 gap-0.5 sm:flex sm:items-baseline sm:gap-2.5">
                  <span className={cn("text-[0.85rem] font-medium", !checked && "line-through decoration-foreground/30")}>
                    {PIXEL_NAMES[platform]}
                    {backup ? <span className="font-normal text-muted-foreground"> · backup</span> : null}
                  </span>
                  <span className="font-mono text-[0.75rem] text-muted-foreground tabular-nums" dir="ltr" title={`Pixel ending in ${px.id.slice(-4)}`}>
                    {maskPixelId(px.id)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {px.server ? <Badge tone="brand">Server events</Badge> : null}
                  {px.testMode ? <Badge tone="warn">Test mode</Badge> : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-[0.75rem] leading-relaxed text-pretty text-muted-foreground">
        {on === 0
          ? "No pixel on this page."
          : `${on} pixel${on === 1 ? "" : "s"} on this page.`}{" "}
        They fire on the live page only, never in previews. Change them later in the builder → SEO &amp; tracking.
      </p>
    </div>
  );
}

function Badge({ tone, children }: { tone: "brand" | "warn"; children: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-semibold whitespace-nowrap", tone === "brand" ? "bg-brand-soft text-brand" : "bg-warn/20 text-warn-ink")}>{children}</span>
  );
}
