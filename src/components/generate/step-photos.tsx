"use client";
/**
 * Step 1 — photos. Drop, paste or pick product photos; each one is decoded and downscaled in the
 * browser, its palette read instantly, then uploaded to the media library with live progress.
 * Once a photo is in the library its subject analysis shows how pages will frame it: tiles crop like
 * a square frame does, and the main photo shows the subject, heads and every frame shape's crop.
 */
import { AlertCircleIcon, FocusIcon, ImagePlusIcon, LibraryIcon, PaletteIcon, RotateCcwIcon, ScanFaceIcon, StarIcon, UploadCloudIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { useFocalInfo } from "@/components/admin/media/focal/focal-client";
import { FocalPicker } from "@/components/admin/media/focal/focal-picker";
import { cropStyle, previewCrop } from "@/components/admin/media/focal/frames";
import { IMAGE_ACCEPT } from "@/components/admin/media/media-client";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Panel, PanelHead, ProgressRing, Swatches } from "./parts";
import { MAX_INPUT_MB, swatches } from "./photos";
import type { Photo } from "./state";

export interface StepPhotosProps {
  photos: Photo[];
  mainKey: string | null;
  canUpload: boolean;
  onFiles(files: File[]): void;
  onLibrary(): void;
  onRemove(key: string): void;
  onSetMain(key: string): void;
  onRetry(key: string): void;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

export function StepPhotos({ photos, mainKey, canUpload, onFiles, onLibrary, onRemove, onSetMain, onRetry }: StepPhotosProps) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  const main = photos.find((p) => p.key === mainKey) ?? photos[0] ?? null;

  const pick = useCallback(() => input.current?.click(), []);

  // paste a photo straight from the clipboard (screenshots, copied images)
  useEffect(() => {
    if (!canUpload) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        onFiles(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [canUpload, onFiles]);

  const dragProps = canUpload
    ? {
        onDragEnter: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current++;
          setOver(true);
        },
        onDragOver: (e: DragEvent) => {
          if (hasFiles(e)) e.preventDefault();
        },
        onDragLeave: () => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(false);
        },
        onDrop: (e: DragEvent) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          depth.current = 0;
          setOver(false);
          const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || !f.type);
          if (files.length) onFiles(files);
        },
      }
    : {};

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]" {...dragProps}>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />

      <div className="min-w-0">
        {photos.length === 0 ? (
          <Dropzone over={over} canUpload={canUpload} onPick={pick} onLibrary={onLibrary} />
        ) : (
          <motion.ul layout className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4", over && "opacity-60")}>
            <AnimatePresence initial={false}>
              {photos.map((p) => (
                <PhotoTile key={p.key} photo={p} main={p.key === main?.key} onRemove={() => onRemove(p.key)} onSetMain={() => onSetMain(p.key)} onRetry={() => onRetry(p.key)} />
              ))}
            </AnimatePresence>
            {photos.length < 12 && (
              <motion.li layout key="add" className="aspect-square">
                <div
                  className={cn(
                    "flex size-full flex-col items-center justify-center gap-2 rounded-2xl bg-foreground/[0.03] text-center ring-1 ring-foreground/[0.08] transition-all duration-300 ring-inset",
                    over && "scale-[1.02] bg-brand-soft ring-2 ring-brand",
                  )}
                >
                  {canUpload && (
                    <Button variant="ghost" className="h-auto flex-col gap-1.5 rounded-xl px-4 py-3 text-muted-foreground hover:text-foreground" onClick={pick}>
                      <ImagePlusIcon className="size-5" />
                      <span className="text-[0.8rem]">Add photos</span>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="rounded-full text-[0.75rem] text-muted-foreground" onClick={onLibrary}>
                    <LibraryIcon />
                    From library
                  </Button>
                </div>
              </motion.li>
            )}
          </motion.ul>
        )}
      </div>

      <aside className="grid content-start gap-4">
        <Panel>
          <PanelHead
            icon={<PaletteIcon />}
            title="Main photo"
            description={main ? "It leads the hero and sets the page colors. Star another photo to change it." : "The first photo you add leads the page."}
          />
          <div className="grid gap-4 p-5 sm:p-6">
            {main?.asset && main.preview && main.status === "ready" ? (
              <MainFraming key={main.key} photo={main} />
            ) : (
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                <AnimatePresence mode="popLayout" initial={false}>
                  {main?.preview ? (
                    <motion.img
                      key={main.key}
                      src={main.preview}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                      initial={{ opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    />
                  ) : (
                    <motion.div key="empty" className="adm-dots absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
                  )}
                </AnimatePresence>
              </div>
            )}
            <div className="flex min-h-8 items-center justify-between gap-3">
              <span className="text-[0.8rem] text-muted-foreground">{main?.palette ? "Palette" : main ? "Reading colors…" : "Palette appears here"}</span>
              <Swatches colors={swatches(main?.palette ?? null)} size="sm" />
            </div>
          </div>
        </Panel>
        <div className="adm-surface-flat grid gap-2.5 p-5 text-[0.8rem] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Photos that make great pages</p>
          <p>3–6 photos: the product alone, a close-up detail, in use, and the packaging.</p>
          <p>A plain, even background gives the cleanest cutout for the hero stage.</p>
          <p>Photos up to {MAX_INPUT_MB} MB are fine: they are resized to 2400 px in your browser before upload.</p>
        </div>
      </aside>
    </div>
  );
}

function Dropzone({ over, canUpload, onPick, onLibrary }: { over: boolean; canUpload: boolean; onPick: () => void; onLibrary: () => void }) {
  return (
    <div
      className={cn(
        "adm-aurora adm-grain relative flex min-h-[25rem] flex-col items-center justify-center gap-6 overflow-hidden rounded-[var(--adm-radius)] px-6 py-14 text-center ring-1 ring-border/70 transition-all duration-500 ring-inset sm:min-h-[30rem]",
        over && "scale-[1.01] ring-2 ring-brand",
      )}
    >
      <div aria-hidden="true" className="adm-dots pointer-events-none absolute inset-0" />
      <motion.div
        aria-hidden="true"
        className="relative z-10 grid size-20 place-items-center rounded-[1.6rem] bg-background/80 text-brand shadow-[0_1px_2px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(0_0_0/0.35)] ring-1 ring-foreground/[0.06]"
        animate={over ? { y: -6, scale: 1.06 } : { y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        <UploadCloudIcon className="size-8" strokeWidth={1.6} />
      </motion.div>
      <div className="relative z-10 grid max-w-md gap-2">
        <h2 className="font-display text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance">{over ? "Let go to add them" : "Drop your product photos"}</h2>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          JPG, PNG, WebP or AVIF, or paste one with {typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘V" : "Ctrl+V"}. They are read on this computer, then saved to your media library.
        </p>
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-2">
        {canUpload && (
          <Button variant="brand" className="h-10 rounded-full px-5" onClick={onPick}>
            <ImagePlusIcon />
            Choose photos
          </Button>
        )}
        <Button variant="outline" className="h-10 rounded-full px-5" onClick={onLibrary}>
          <LibraryIcon />
          From the library
        </Button>
      </div>
      {!canUpload && <p className="relative z-10 text-xs text-muted-foreground">Your role can&apos;t upload files — pick photos from the library.</p>}
    </div>
  );
}

/** The main photo as pages will frame it: subject, heads and hands, and every frame shape's crop. */
function MainFraming({ photo }: { photo: Photo }) {
  const asset = photo.asset!;
  const { info, loading } = useFocalInfo(asset.id);
  return (
    <FocalPicker
      size="compact"
      readOnly
      src={photo.preview}
      width={asset.width}
      height={asset.height}
      alpha={asset.alpha}
      dominant={asset.dominant}
      value={info?.saved ?? null}
      info={info}
      loading={loading}
      name={photo.name}
    />
  );
}

/** How a square frame crops an uploaded photo (null until the analysis is known). */
function useSquareCrop(photo: Photo) {
  const asset = photo.status === "ready" ? photo.asset : null;
  const { info } = useFocalInfo(asset && !asset.alpha ? asset.id : null);
  if (!asset || !info?.focus) return null;
  return { style: cropStyle(previewCrop("rounded", asset.width / Math.max(1, asset.height), info.focus, info.saved, false)), kind: info.focus.kind };
}

function PhotoTile({ photo, main, onRemove, onSetMain, onRetry }: { photo: Photo; main: boolean; onRemove: () => void; onSetMain: () => void; onRetry: () => void }) {
  const busy = photo.status === "preparing" || photo.status === "uploading" || photo.status === "processing";
  const framed = useSquareCrop(photo);
  const label =
    photo.status === "preparing" ? "Reading…" : photo.status === "uploading" ? `Uploading ${Math.round(photo.progress * 100)}%` : photo.status === "processing" ? "Optimizing…" : null;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.94, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.94, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-2xl bg-muted ring-1 ring-border transition-shadow duration-300",
        main && "ring-2 ring-brand shadow-[0_14px_34px_-18px_color-mix(in_oklab,var(--brand)_70%,transparent)]",
      )}
    >
      {photo.preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local object URLs and media-library renditions
        <img
          src={photo.preview}
          alt={photo.name}
          className="size-full object-cover transition-[object-position,transform,scale] duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.04]"
          style={framed?.style}
          draggable={false}
        />
      ) : (
        <div className="adm-shimmer size-full" />
      )}

      <AnimatePresence>
        {busy && (
          <motion.div
            className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
          >
            <div className="grid justify-items-center gap-2">
              <ProgressRing value={photo.status === "uploading" ? photo.progress : null} />
              <span className="text-[0.72rem] font-medium tabular-nums">{label}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {photo.status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-background/80 p-3 text-center backdrop-blur-sm">
          <div className="grid justify-items-center gap-2">
            <AlertCircleIcon className="size-5 text-destructive" />
            <p className="line-clamp-3 text-[0.72rem] leading-snug text-destructive">{photo.error ?? "Upload failed."}</p>
            <Button size="xs" variant="outline" className="rounded-full" onClick={onRetry}>
              <RotateCcwIcon />
              Retry
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {framed && (framed.kind === "person" || framed.kind === "product") ? (
          <motion.span
            key="framed"
            className="adm-glass pointer-events-none absolute start-2 bottom-2 inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.68rem] font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            initial={{ y: 4 }}
            animate={{ y: 0 }}
            exit={{ opacity: 0 }}
          >
            {framed.kind === "person" ? <ScanFaceIcon className="size-3 text-brand" /> : <FocusIcon className="size-3 text-brand" />}
            {framed.kind === "person" ? "Framed on the face" : "Framed on the product"}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {main && photo.status !== "error" && (
        <span className="adm-glass absolute start-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold">
          <StarIcon className="size-3 fill-brand text-brand" />
          Main
        </span>
      )}

      <div className="absolute end-2 top-2 flex gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {!main && photo.status === "ready" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={onSetMain} className="adm-glass grid size-8 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Use as main photo">
                <StarIcon className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Use as main photo</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={onRemove} className="adm-glass grid size-8 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Remove photo">
              <XIcon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Remove from this page</TooltipContent>
        </Tooltip>
      </div>
    </motion.li>
  );
}
