"use client";
/**
 * "Pixels that will fire" block of the publish dialog (docs/OFFERS.md §A.4): the draft's pixels with
 * the diff against the live version (+ added / − removed), the "This page sends no ad events" warning
 * with an inline Add pixel (the publish button then reads "Publish without pixels":
 * `onNeedsConfirm(true)`), the browser-only info, "Not in library" ids (publishing them needs an
 * owner) and "Pixels copied from {page}".
 *
 * `live`: the caller's live tracking; when it passes null the block reads the live version itself
 * (pagePixelsAction), so a never-published page and an unknown live state look the same to callers.
 */
import { CircleAlertIcon, CopyIcon, InfoIcon, MinusIcon, PlusIcon, RadarIcon } from "lucide-react";
import { useEffect, useMemo, type ReactElement } from "react";
import type { Tracking } from "@/lib/page/schema";
import { isServerPlatform } from "@/lib/pixels/ids";
import { findEntryView, missingPixels, pixelLabel, trackingDiff, trackingRefs } from "@/lib/pixels/library";
import { cn } from "@/lib/utils";
import { MaskedId, PixelStatusChip, PlatformMark } from "./parts";
import { useNow, usePagePixels } from "./use-page-pixels";

export interface PublishPixelsBlockProps {
  pageId: string;
  /** the draft's pixels */
  draft: Tracking;
  /** the live version's pixels (null: never published, or not known by the caller) */
  live: Tracking | null;
  /** true while publishing needs the "without pixels" confirmation */
  onNeedsConfirm(needs: boolean): void;
  /** open the page's pixels section (SEO & tracking) */
  onAddPixel(): void;
}

export function PublishPixelsBlock({ pageId, draft, live: liveProp, onNeedsConfirm, onAddPixel }: PublishPixelsBlockProps): ReactElement {
  const { state } = usePagePixels(pageId);
  const library = state?.library ?? null;
  const live = liveProp ?? state?.live?.tracking ?? null;
  const refs = trackingRefs(draft);
  const missing = missingPixels(draft);
  const diff = useMemo(() => (live ? trackingDiff(draft, live) : { added: [], removed: [] }), [draft, live]);
  const now = useNow();

  useEffect(() => {
    onNeedsConfirm(missing);
  }, [missing, onNeedsConfirm]);

  const added = new Set(diff.added.map((r) => `${r.platform}:${r.id}`));
  const browserOnly = library ? refs.filter((r) => isServerPlatform(r.platform) && findEntryView(library, r.platform, r.id) && !findEntryView(library, r.platform, r.id)!.server) : [];
  const unknown = library ? refs.filter((r) => !findEntryView(library, r.platform, r.id)) : [];

  return (
    <section aria-label="Pixels that will fire" className="mt-4 grid gap-2">
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground/80">
        <RadarIcon className="size-3.5 text-muted-foreground" />
        Pixels that will fire
      </h3>

      {missing ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn/10 px-3 py-2.5 text-[12px] leading-relaxed text-warn-ink ring-1 ring-warn/30 ring-inset">
          <span className="flex min-w-0 items-start gap-2">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>This page sends no ad events; ads can&apos;t optimize.</span>
          </span>
          <button
            type="button"
            onClick={onAddPixel}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground shadow-[0_0_0_1px_var(--border)] outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <PlusIcon className="size-3" />
            Add pixel
          </button>
        </div>
      ) : draft.none && !refs.length ? (
        <p className="rounded-xl bg-foreground/[0.035] px-3 py-2.5 text-[12px] text-muted-foreground">No pixel on this page (organic / test).</p>
      ) : (
        <ul className="grid gap-1 rounded-xl bg-foreground/[0.025] p-1 ring-1 ring-foreground/[0.06] ring-inset">
          {refs.map((r) => {
            const px = findEntryView(library, r.platform, r.id);
            const isNew = added.has(`${r.platform}:${r.id}`);
            return (
              <li key={`${r.platform}:${r.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5">
                <PlatformMark platform={r.platform} size="sm" />
                <span className="min-w-0 truncate text-[12.5px] font-medium" dir="auto">
                  {pixelLabel(px, r.platform, r.id)}
                </span>
                {px?.label ? <MaskedId id={r.id} className="text-[11px]" /> : null}
                <span className="ms-auto flex items-center gap-1.5">
                  {live && isNew && <DiffTag kind="added" />}
                  {px ? <PixelStatusChip pixel={px} pageId={pageId} now={now} className="h-5 px-2 text-[10.5px]" /> : null}
                </span>
              </li>
            );
          })}
          {diff.removed.map((r) => (
            <li key={`rm:${r.platform}:${r.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 opacity-70">
              <PlatformMark platform={r.platform} size="sm" className="grayscale" />
              <span className="min-w-0 truncate text-[12.5px] line-through decoration-foreground/30" dir="auto">
                {pixelLabel(findEntryView(library, r.platform, r.id), r.platform, r.id)}
              </span>
              {findEntryView(library, r.platform, r.id)?.label ? <MaskedId id={r.id} className="text-[11px]" /> : null}
              <span className="ms-auto">
                <DiffTag kind="removed" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {unknown.length > 0 && !library?.canCreate && (
        <p className="flex items-start gap-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-[12px] leading-relaxed text-destructive">
          <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
          {unknown.length === 1 ? "One pixel isn't" : `${unknown.length} pixels aren't`} in the pixel library. Ask an owner to add {unknown.length === 1 ? "it" : "them"} in Settings → Pixels, or remove {unknown.length === 1 ? "it" : "them"} from this page.
        </p>
      )}
      {browserOnly.length > 0 && (
        <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
          {browserOnly.map((r) => pixelLabel(findEntryView(library, r.platform, r.id))).join(", ")}: no server events — in-app and iOS purchases are under-counted.
        </p>
      )}
      {draft.copiedFrom && refs.length > 0 && (
        <p className="flex items-start gap-2 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
          <CopyIcon className="mt-0.5 size-3.5 shrink-0" />
          Pixels copied from {draft.copiedFrom}.
        </p>
      )}
    </section>
  );
}

function DiffTag({ kind }: { kind: "added" | "removed" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-0.5 rounded-full px-1.5 text-[10.5px] font-medium ring-1 ring-inset",
        kind === "added" ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" : "bg-foreground/[0.05] text-foreground/65 ring-foreground/10",
      )}
    >
      {kind === "added" ? <PlusIcon className="size-2.5" /> : <MinusIcon className="size-2.5" />}
      {kind === "added" ? "New" : "Removed"}
    </span>
  );
}
