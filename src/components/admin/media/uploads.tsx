"use client";

import { CheckIcon, ImageUpIcon, Loader2Icon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IMAGE_ACCEPT, MAX_IMAGE_MB, MAX_VIDEO_MB, precheck, uploadMedia, VIDEO_ACCEPT, type MediaAsset } from "./media-client";

export interface UploadItem {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "processing" | "done" | "error";
  error?: string;
  preview?: string;
}

const CONCURRENCY = 2;

/** Upload queue with 2 parallel transfers, live progress, previews, and per-file errors. */
export function useUploads(onUploaded: (asset: MediaAsset, deduped: boolean) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const active = useRef(0);
  const callback = useRef(onUploaded);
  useEffect(() => {
    callback.current = onUploaded;
  }, [onUploaded]);

  const queue = useRef<string[]>([]);

  const patch = useCallback((id: string, p: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  // the queue restarts itself from .finally(); a ref avoids a self-referencing callback
  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      const file = files.current.get(id);
      if (!file) continue;
      active.current++;
      patch(id, { status: "uploading" });
      uploadMedia(file, { onProgress: (r) => patch(id, r >= 1 ? { progress: 1, status: "processing" } : { progress: r }) })
        .then(({ asset, deduped }) => {
          patch(id, { status: "done", progress: 1 });
          callback.current(asset, deduped);
        })
        .catch((err: unknown) => patch(id, { status: "error", error: err instanceof Error ? err.message : "Upload failed." }))
        .finally(() => {
          active.current--;
          files.current.delete(id);
          pumpRef.current();
        });
    }
  }, [patch]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const add = useCallback(
    (list: FileList | File[]) => {
      const added: UploadItem[] = [];
      for (const file of Array.from(list)) {
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const problem = precheck(file);
        const preview = !problem && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        if (!problem) {
          files.current.set(id, file);
          queue.current.push(id);
        }
        added.push({ id, name: file.name, progress: 0, status: problem ? "error" : "queued", error: problem ?? undefined, preview });
      }
      setItems((cur) => [...added, ...cur].slice(0, 40));
      pump();
    },
    [pump],
  );

  const dismiss = useCallback((id: string) => {
    setItems((list) => {
      const item = list.find((i) => i.id === id);
      if (item?.preview) URL.revokeObjectURL(item.preview);
      return list.filter((i) => i.id !== id);
    });
  }, []);

  // finished items fade out on their own
  useEffect(() => {
    const done = items.filter((i) => i.status === "done");
    if (!done.length) return;
    const t = setTimeout(() => done.forEach((i) => dismiss(i.id)), 2200);
    return () => clearTimeout(t);
  }, [items, dismiss]);

  return { items, add, dismiss, busy: items.some((i) => i.status === "uploading" || i.status === "processing" || i.status === "queued") };
}

/** Drop target (also click / keyboard to browse). Whole area glows while files hover it. */
export function Dropzone({
  onFiles,
  accept = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`,
  compact = false,
  disabled = false,
  children,
  className,
}: {
  onFiles: (files: FileList) => void;
  accept?: string;
  compact?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragEnter={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!disabled && e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative isolate flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--adm-radius)] text-center ring-1 transition-all duration-300 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        compact ? "gap-1 px-4 py-5" : "gap-3 px-6 py-10",
        over ? "scale-[1.01] bg-brand/[0.07] ring-brand/50" : "bg-foreground/[0.025] ring-foreground/10 hover:bg-foreground/[0.04] hover:ring-foreground/20",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-background shadow-sm ring-1 ring-border transition-transform duration-500 ease-[cubic-bezier(.34,1.36,.64,1)]",
          compact ? "size-9" : "size-12",
          over ? "-translate-y-1 scale-110 text-brand" : "text-foreground/70 group-hover:-translate-y-0.5",
        )}
      >
        <ImageUpIcon className={compact ? "size-4" : "size-5"} />
      </span>
      {children ?? (
        <span className="grid gap-1">
          <span className="text-sm font-medium">{over ? "Drop to upload" : "Drop photos here, or click to browse"}</span>
          {!compact && (
            <span className="text-xs text-muted-foreground">
              JPG, PNG, WebP, AVIF up to {MAX_IMAGE_MB} MB · MP4, WebM up to {MAX_VIDEO_MB} MB. Photos are optimized automatically.
            </span>
          )}
        </span>
      )}
    </div>
  );
}

/** Compact live list of uploads (thumbnail, name, progress bar / state). */
export function UploadQueue({ items, onDismiss, className }: { items: UploadItem[]; onDismiss: (id: string) => void; className?: string }) {
  return (
    <ul className={cn("grid gap-2", className)} aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((u) => (
          <motion.li
            key={u.id}
            layout
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="adm-surface flex items-center gap-3 rounded-2xl p-2.5 pe-3"
          >
            <span className="size-10 shrink-0 overflow-hidden rounded-xl bg-muted">
              {u.preview && (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img src={u.preview} alt="" className="size-full object-cover" />
              )}
            </span>
            <span className="grid min-w-0 flex-1 gap-1.5">
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{u.name}</span>
                <span className={cn("shrink-0 tabular-nums", u.status === "error" ? "text-destructive" : "text-muted-foreground")}>
                  {u.status === "queued" && "Waiting"}
                  {u.status === "uploading" && `${Math.round(u.progress * 100)}%`}
                  {u.status === "processing" && "Optimizing…"}
                  {u.status === "done" && "Ready"}
                  {u.status === "error" && "Failed"}
                </span>
              </span>
              {u.status === "error" ? (
                <span className="truncate text-xs text-destructive">{u.error}</span>
              ) : (
                <span className="h-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                  <motion.span
                    className={cn("block h-full rounded-full", u.status === "done" ? "bg-emerald-500" : "bg-brand", u.status === "processing" && "adm-shimmer")}
                    animate={{ width: `${Math.max(4, u.progress * 100)}%` }}
                    transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.4 }}
                  />
                </span>
              )}
            </span>
            {u.status === "done" ? (
              <CheckIcon className="size-4 shrink-0 text-emerald-600" />
            ) : u.status === "uploading" || u.status === "processing" ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <button type="button" onClick={() => onDismiss(u.id)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Dismiss ${u.name}`}>
                <XIcon className="size-3.5" />
              </button>
            )}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
