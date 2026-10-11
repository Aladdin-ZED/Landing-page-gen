"use client";
/**
 * Media picker (contract): a dialog over the media library to choose one image or video, with
 * search, photo/cutout filters and in-place uploads (a fresh upload is selected automatically).
 *
 *   <MediaPicker open={open} onOpenChange={setOpen} onPick={(asset) => …} accept="image" />
 *
 * `onPick` receives the asset fields the renderer needs ({ id, width, height, alpha, dominant,
 * variants, focus }) plus `kind`, `mime`, `url`, the library's default `alt` text and default
 * framing point (`focal`, null = auto). Tiles crop like pages crop a square frame.
 */
import { CheckIcon, ImageIcon, Loader2Icon, ScissorsIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AssetFocus } from "@/lib/media/focus";
import { cn } from "@/lib/utils";
// the picker also opens inside the full-screen builder, which doesn't load the panel stylesheet
import "../styles/admin.css";
import { EmptyState } from "../common/empty-state";
import { SearchField } from "../common/search-field";
import { Segmented } from "../common/segmented";
import { AssetTile } from "./asset-tile";
import { focalFromTags } from "./focal/tags";
import { altOf, IMAGE_ACCEPT, useMediaList, VIDEO_ACCEPT, type MediaAsset, type MediaFilter } from "./media-client";
import { Dropzone, UploadQueue, useUploads } from "./uploads";

export interface PickedAsset {
  id: string;
  width: number;
  height: number;
  alpha: boolean;
  dominant: string;
  variants: { key: string; w: number; h: number; fmt: string }[];
  kind: "image" | "video";
  mime: string;
  url: string | null;
  /** the library's default alt text ("" when none) */
  alt: string;
  /** subject analysis (src/lib/media/focus.ts) — what the renderer's auto crops use; null when not analysed */
  focus: AssetFocus | null;
  /** the library's default framing point (pre-fills AssetRef fx/fy); null = auto framing */
  focal: { x: number; y: number } | null;
}

export interface MediaPickerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onPick(asset: PickedAsset): void;
  accept?: "image" | "video";
  allowUpload?: boolean;
  title?: string;
}

function toPicked(a: MediaAsset): PickedAsset {
  return {
    id: a.id,
    width: a.width,
    height: a.height,
    alpha: a.alpha,
    dominant: a.dominant,
    variants: a.variants.map((v) => ({ key: v.key, w: v.w, h: v.h, fmt: v.fmt })),
    kind: a.kind,
    mime: a.mime,
    url: a.url,
    alt: altOf(a),
    focus: a.focus ?? null,
    focal: focalFromTags(a.tags),
  };
}

export function MediaPicker(props: MediaPickerProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex h-[min(88dvh,46rem)] w-[min(96vw,64rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-2xl p-0 duration-200 sm:max-w-none">
        {props.open && <PickerBody {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function PickerBody({ onOpenChange, onPick, accept = "image", allowUpload = true, title }: MediaPickerProps) {
  const [filter, setFilter] = useState<MediaFilter>(accept === "video" ? "video" : "image");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const list = useMediaList({ filter, q, pageSize: 36 });

  const onUploaded = useCallback(
    (asset: MediaAsset) => {
      const fits = accept === "video" ? asset.kind === "video" : asset.kind === "image";
      if (!fits) return;
      list.mutate((items) => [asset, ...items.filter((i) => i.id !== asset.id)], 1);
      setSelected(asset);
    },
    [accept, list],
  );
  const uploads = useUploads(onUploaded);

  const choose = (a: MediaAsset | null) => {
    if (!a) return;
    onPick(toPicked(a));
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader className="gap-3 border-b border-border/70 p-5 pe-14">
        <div className="grid gap-1">
          <DialogTitle className="text-[1.05rem] font-semibold">{title ?? (accept === "video" ? "Choose a video" : "Choose an image")}</DialogTitle>
          <DialogDescription>Pick from your library{allowUpload ? " or drop new files below" : ""}. Double-click to use right away.</DialogDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {accept === "image" ? (
            <Segmented
              label="Filter"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "image", label: "All images" },
                { value: "photo", label: "Photos", icon: <ImageIcon /> },
                { value: "cutout", label: "Cutouts", icon: <ScissorsIcon /> },
              ]}
            />
          ) : (
            <span />
          )}
          <SearchField value={q} onCommit={setQ} placeholder="Search by name or alt text" pending={list.loading && list.items.length > 0} className="sm:w-64" />
        </div>
      </DialogHeader>

      <div className="adm-scroll min-h-0 flex-1 overflow-y-auto p-5">
        <div className="grid gap-4">
          {allowUpload && (
            <div className="grid gap-3">
              <Dropzone compact onFiles={uploads.add} accept={accept === "video" ? VIDEO_ACCEPT : IMAGE_ACCEPT} />
              {uploads.items.length > 0 && <UploadQueue items={uploads.items} onDismiss={uploads.dismiss} className="sm:grid-cols-2" />}
            </div>
          )}

          {list.error ? (
            <EmptyState compact illustration="media" title="The library didn't load" description={list.error} actions={<Button variant="outline" className="rounded-full" onClick={list.reload}>Try again</Button>} />
          ) : list.items.length === 0 ? (
            list.loading ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="adm-shimmer aspect-square rounded-2xl" style={{ animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                illustration={q ? "search" : "media"}
                title={q ? `Nothing matches “${q}”` : filter === "cutout" ? "No cutouts yet" : "Your library is empty"}
                description={q ? "Try another word." : allowUpload ? "Drop a file above to add it." : "Upload files in Media first."}
              />
            )
          ) : (
            <div className={cn("grid grid-cols-3 gap-3 transition-opacity duration-300 sm:grid-cols-4 lg:grid-cols-6", list.loading && "opacity-60")}>
              {list.items.map((a, i) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selected={selected?.id === a.id}
                  onClick={() => setSelected(a)}
                  onDoubleClick={() => choose(a)}
                  className="adm-fade"
                  style={{ ["--i" as string]: Math.min(i, 12) }}
                />
              ))}
            </div>
          )}
          {list.hasMore && !list.error && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" className="rounded-full px-4" onClick={list.loadMore} disabled={list.loading}>
                {list.loading && <Loader2Icon className="animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="m-0 flex-row items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {selected ? (
            <>
              <span className="font-medium text-foreground">{selected.originalName ?? "Selected file"}</span> · {selected.width}×{selected.height}
              {selected.alpha ? " · cutout" : ""}
            </>
          ) : (
            "Nothing selected"
          )}
        </span>
        <span className="flex shrink-0 gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-full px-4" disabled={!selected || uploads.busy} onClick={() => choose(selected)}>
            <CheckIcon />
            {accept === "video" ? "Use video" : "Use image"}
          </Button>
        </span>
      </DialogFooter>
    </>
  );
}
