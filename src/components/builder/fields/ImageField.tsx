"use client";
/**
 * Image fields.
 *  ImageField   one AssetRef: the whole picture with its analysed subject, heads and hands, the
 *               focal handle, live crops of every frame shape the page uses (arch, circle, square,
 *               portrait, wide — cropped by the renderer's own engine), Auto/Custom status with
 *               "Reset to auto", alt text, choose from the library / upload, "use product cutout",
 *               and a full-size framing dialog. `compact`: one row (thumbnail, alt, framing, remove).
 *  ImagesField  ordered AssetRef list: sortable thumbnails cropped like the page crops them, add,
 *               remove, alt and framing per image; image files dropped from the desktop are
 *               uploaded and appended.
 * Framing: AUTO = no fx/fy, the renderer fits every frame to the subject analysed at upload; a
 * point (fx/fy) = every frame centers on it. A freshly placed image starts from the library's team
 * default point when it has one, else in auto.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "motion/react";
import { CrosshairIcon, ImagePlus, LoaderCircle, Maximize2, Package, Plus, RefreshCw, RotateCcwIcon, Trash2, UploadCloud, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useFocalInfo, withLibraryDefault } from "@/components/admin/media/focal/focal-client";
import { FocalBadge, FocalPicker } from "@/components/admin/media/focal/focal-picker";
import { cropStyle, previewCrop } from "@/components/admin/media/focal/frames";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { parseFocus } from "@/lib/media/focus";
import type { AssetRef } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor } from "../context";
import { assetUrl, useEnv } from "../env";
import { useMedia } from "../media";
import { FieldRow } from "../ui";
import { FocalDialog, refFocal, withFocal, withoutFocal } from "./FocalDialog";

const ASSET_ID = /^[a-f0-9]{16,64}$/;

export function asAssetRef(v: unknown): AssetRef | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string" || !ASSET_ID.test(r.id)) return null;
  return {
    id: r.id,
    alt: typeof r.alt === "string" ? r.alt : "",
    ...(typeof r.fx === "number" ? { fx: r.fx } : {}),
    ...(typeof r.fy === "number" ? { fy: r.fy } : {}),
  };
}

function useAssetRow(id: string | undefined) {
  return useEditor((s) => (id ? s.assets[id] : undefined));
}

/**
 * A square thumbnail cropped the way pages crop a square frame. Uses the analysis carried by the
 * asset row when the editor has it, else the crop data loaded for the picker (`fetch`).
 */
function useThumbCrop(ref: AssetRef | null, fetch: boolean) {
  const row = useAssetRow(ref?.id);
  const rowFocus = row ? parseFocus((row as { focus?: unknown }).focus) : null;
  const image = !!row && row.kind !== "video" && !row.alpha;
  const { info } = useFocalInfo(image && fetch && !rowFocus ? ref?.id : null);
  if (!ref || !row || !image) return undefined;
  const focus = rowFocus ?? info?.focus ?? null;
  return cropStyle(previewCrop("rounded", row.width / Math.max(1, row.height), focus, refFocal(ref), false));
}

/** Glass icon button laid over a photo (kept out of the focal drag). */
function StageButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-stage-action
          aria-label={label}
          onClick={onClick}
          className="adm-glass grid size-7 place-items-center rounded-full text-foreground/80 outline-none transition-[transform,color] duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95 [&_svg]:size-3.5"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ------------------------------------------------------------------ */
/* single image                                                        */
/* ------------------------------------------------------------------ */

export function ImageField({
  label,
  value,
  onChange,
  help,
  error,
  allowCutout = true,
  accept = "image",
  compact = false,
}: {
  label: string;
  value: unknown;
  onChange: (v: AssetRef | undefined) => void;
  help?: string;
  error?: string | null;
  allowCutout?: boolean;
  accept?: "image" | "video";
  compact?: boolean;
}) {
  const id = useId();
  const ref = asAssetRef(value);
  const row = useAssetRow(ref?.id);
  const cutout = useEditor((s) => s.doc.product.cutout);
  const media = useMedia();
  const url = assetUrl(row, compact ? 160 : 640);
  const isVideo = row?.kind === "video";
  const framable = !!ref && !!row && !isVideo && accept === "image";
  const { info, loading } = useFocalInfo(framable && !compact ? ref.id : null);
  const [framing, setFraming] = useState(false);
  const focal = refFocal(ref);
  const thumbCrop = useThumbCrop(compact ? ref : null, true);

  // uploads and crop data arrive later: patch the reference as it is then
  const latest = useRef({ ref, onChange });
  useEffect(() => {
    latest.current = { ref, onChange };
  });

  /** a freshly placed image starts from the library's team default point, when it has one */
  const applyDefault = (placed: AssetRef) => {
    if (accept !== "image" || refFocal(placed)) return;
    void withLibraryDefault(placed).then((filled) => {
      const now = latest.current;
      if (filled.fx === undefined || !now.ref || now.ref.id !== placed.id || refFocal(now.ref)) return;
      now.onChange({ ...now.ref, fx: filled.fx, fy: filled.fy });
    });
  };

  const choose = async () => {
    const picked = await media.pick({ accept, title: label });
    if (!picked) return;
    // the library's description of the new picture wins; the old alt is kept only as a fallback.
    // Its team default framing point comes with the pick (no extra request); none → auto framing.
    const focal = accept === "image" && picked.kind !== "video" ? picked.focal : null;
    const placed: AssetRef = { id: picked.id, alt: picked.alt || ref?.alt || "", ...(focal ? { fx: focal.x, fy: focal.y } : {}) };
    onChange(placed);
    if (picked.kind !== "video") applyDefault(placed);
  };
  const canUseCutout = allowCutout && !!cutout && accept === "image" && cutout.id !== ref?.id;
  const useCutout = () => {
    const placed = asAssetRef(cutout);
    if (!placed) return;
    onChange(placed);
    applyDefault(placed);
  };
  const resetToAuto = () => {
    if (ref) onChange(withoutFocal(ref));
  };

  if (compact) {
    return (
      <FieldRow label={label} hint={help} error={error}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void choose()}
            aria-label={ref ? `Replace ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}
            className={cn(
              "bld-press grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-foreground/[0.04] text-muted-foreground outline-none ring-1 ring-inset ring-foreground/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
              row?.alpha && "bld-checker",
            )}
          >
            {ref && url && !isVideo ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of a /media rendition
              <img src={url} alt="" draggable={false} className={cn("size-full", row?.alpha ? "object-contain p-0.5" : "object-cover")} style={thumbCrop} />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </button>
          {ref ? (
            <>
              <Input
                value={ref.alt}
                maxLength={200}
                dir="auto"
                placeholder="Alt text"
                aria-label={`${label} — alt text`}
                onChange={(e) => onChange({ ...ref, alt: e.target.value })}
                className="h-8 min-w-0 flex-1 text-[12.5px]"
              />
              {framable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Framing of ${label.toLowerCase()}${focal ? " (custom point)" : ""}`}
                  title={focal ? "Framing — custom point" : "Framing — auto"}
                  onClick={() => setFraming(true)}
                  className={cn("text-muted-foreground hover:text-foreground", focal && "text-foreground")}
                >
                  <CrosshairIcon />
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange(undefined)} className="text-muted-foreground hover:text-destructive">
                <X />
              </Button>
              {framable && framing ? <FocalDialog open={framing} onOpenChange={setFraming} assetRef={ref} onChange={onChange} title={`Framing — ${label}`} /> : null}
            </>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => void choose()} className="text-muted-foreground">
                {accept === "video" ? "Choose a video" : "Choose an image"}
              </Button>
              {canUseCutout ? (
                <Button type="button" variant="ghost" size="sm" onClick={useCutout} className="text-muted-foreground">
                  <Package />
                  Cutout
                </Button>
              ) : null}
            </div>
          )}
        </div>
      </FieldRow>
    );
  }

  const actions = (
    <div className="absolute end-2 top-2 z-30 flex gap-1 opacity-0 transition-opacity duration-200 group-focus-within/img:opacity-100 group-hover/img:opacity-100 [@media(hover:none)]:opacity-100">
      {framable ? (
        <StageButton label="Open the framing editor" onClick={() => setFraming(true)}>
          <Maximize2 />
        </StageButton>
      ) : null}
      {canUseCutout ? (
        <StageButton label="Use the product cutout" onClick={useCutout}>
          <Package />
        </StageButton>
      ) : null}
      <StageButton label="Replace" onClick={() => void choose()}>
        <RefreshCw />
      </StageButton>
      <StageButton label="Remove" onClick={() => onChange(undefined)}>
        <Trash2 />
      </StageButton>
    </div>
  );

  return (
    <FieldRow
      label={label}
      hint={help}
      error={error}
      trailing={
        framable ? (
          <span className="flex items-center gap-0.5">
            <FocalBadge mode={focal ? "custom" : "auto"} kind={info?.focus?.kind} loading={loading && !info} />
            {focal ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Reset to auto" onClick={resetToAuto} className="text-muted-foreground hover:text-foreground">
                    <RotateCcwIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset to auto</TooltipContent>
              </Tooltip>
            ) : null}
          </span>
        ) : undefined
      }
    >
      {ref ? (
        <div className="space-y-2.5">
          {framable && url ? (
            <div className="group/img">
              <FocalPicker
                size="compact"
                src={url}
                width={row.width}
                height={row.height}
                alpha={row.alpha}
                dominant={row.dominant}
                value={focal}
                info={info}
                loading={loading}
                name={ref.alt || label}
                onCommit={(p) => onChange(withFocal(ref, p))}
                onReset={resetToAuto}
                overlay={actions}
              />
            </div>
          ) : (
            <div className="group/img relative overflow-hidden rounded-xl bg-muted shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]">
              <div className="grid aspect-[16/10] place-items-center text-xs text-muted-foreground">{isVideo ? "Video selected" : "Image not found in the library"}</div>
              {actions}
            </div>
          )}
          {!isVideo ? (
            <Input
              id={`${id}-alt`}
              value={ref.alt}
              maxLength={200}
              dir="auto"
              placeholder="Describe the image (alt text)"
              aria-label={`${label} — alt text`}
              onChange={(e) => onChange({ ...ref, alt: e.target.value })}
              className="h-8 text-[12.5px]"
            />
          ) : null}
          {framable && framing ? <FocalDialog open={framing} onOpenChange={setFraming} assetRef={ref} onChange={onChange} title={`Framing — ${label}`} /> : null}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void choose()}
            className="bld-press flex h-20 flex-1 flex-col items-center justify-center gap-1.5 rounded-xl bg-foreground/[0.035] text-[12px] font-medium text-muted-foreground outline-none ring-1 ring-inset ring-foreground/[0.06] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ImagePlus className="size-[18px]" />
            {accept === "video" ? "Choose a video" : "Choose an image"}
          </button>
          {canUseCutout ? (
            <button
              type="button"
              onClick={useCutout}
              className="bld-press flex h-20 w-24 flex-col items-center justify-center gap-1.5 rounded-xl bg-foreground/[0.035] text-[11.5px] font-medium text-muted-foreground outline-none ring-1 ring-inset ring-foreground/[0.06] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Package className="size-[18px]" />
              Product cutout
            </button>
          ) : null}
        </div>
      )}
    </FieldRow>
  );
}

/* ------------------------------------------------------------------ */
/* image list                                                          */
/* ------------------------------------------------------------------ */

export function ImagesField({
  label,
  value,
  onChange,
  max = 12,
  help,
  error,
}: {
  label: string;
  value: unknown;
  onChange: (v: AssetRef[]) => void;
  max?: number;
  help?: string;
  error?: string | null;
}) {
  const media = useMedia();
  const { user } = useEnv();
  const list = (Array.isArray(value) ? value : []).map(asAssetRef).filter((r): r is AssetRef => !!r);
  const ids = list.map((r, i) => `${i}:${r.id}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // a stable id for dnd-kit's aria-describedby: its own counter differs between the server render and hydration
  const dndId = useId();
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState(0);
  // uploads and crop data finish later: change the list as it is then, not as it was when they started
  const latest = useRef({ list, onChange });
  useEffect(() => {
    latest.current = { list, onChange };
  });

  /** freshly added photos start from the library's team default point, when they have one */
  const applyDefaults = (added: readonly string[]) => {
    for (const id of new Set(added)) {
      void withLibraryDefault({ id }).then((filled) => {
        if (filled.fx === undefined) return;
        const { list: now, onChange: commit } = latest.current;
        if (!now.some((r) => r.id === id && !refFocal(r))) return;
        commit(now.map((r) => (r.id === id && !refFocal(r) ? { ...r, fx: filled.fx, fy: filled.fy } : r)));
      });
    }
  };

  const add = async () => {
    const picked = await media.pick({ accept: "image", title: label });
    if (picked && list.length < max) {
      const focal = picked.focal;
      onChange([...list, { id: picked.id, alt: picked.alt, ...(focal ? { fx: focal.x, fy: focal.y } : {}) }]);
      if (!focal) applyDefaults([picked.id]);
    }
  };

  const hasFiles = (e: React.DragEvent) => user.canUpload && e.dataTransfer.types.includes("Files");
  const onDrop = async (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setDropping(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, max - list.length));
    if (!files.length) {
      toast.error(list.length >= max ? `At most ${max} images here.` : "Drop image files (JPG, PNG, WebP…).");
      return;
    }
    setUploading(files.length);
    for (const file of files) {
      try {
        const row = await media.upload(file, { name: file.name });
        const { list: now, onChange: commit } = latest.current;
        if (now.length < max && !now.some((r) => r.id === row.id)) {
          commit([...now, { id: row.id, alt: "" }]);
          applyDefaults([row.id]);
        }
      } catch (err) {
        toast.error(`${file.name} was not uploaded`, { description: err instanceof Error ? err.message : undefined });
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove(list, from, to));
  };

  return (
    <FieldRow label={label} hint={help ?? `Drag to reorder. The first image leads.${user.canUpload ? " Drop photos here to upload." : ""}`} error={error} count={list.length} max={max}>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div
            className="relative grid grid-cols-3 gap-2"
            onDragOver={(e) => {
              if (!hasFiles(e)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              if (!dropping) setDropping(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
            }}
            onDrop={(e) => void onDrop(e)}
          >
            {list.map((ref, i) => (
              <Thumb
                key={ids[i]}
                sortId={ids[i]!}
                assetRef={ref}
                index={i}
                onRef={(next) => onChange(list.map((r, k) => (k === i ? next : r)))}
                onRemove={() => onChange(list.filter((_, k) => k !== i))}
              />
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <div key={`up-${i}`} className="bld-shimmer grid aspect-square place-items-center rounded-xl text-muted-foreground" role="status" aria-label="Uploading">
                <LoaderCircle className="size-4 animate-spin" />
              </div>
            ))}
            {list.length + uploading < max ? (
              <button
                type="button"
                onClick={() => void add()}
                aria-label="Add an image"
                className="bld-press grid aspect-square place-items-center rounded-xl bg-foreground/[0.035] text-muted-foreground outline-none ring-1 ring-inset ring-foreground/[0.06] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Plus className="size-5" />
              </button>
            ) : null}
            {dropping ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute -inset-1.5 z-20 grid place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--brand)_10%,var(--background)_82%)] text-[12px] font-medium text-foreground shadow-[inset_0_0_0_1.5px_var(--brand)] backdrop-blur-[2px]"
              >
                <span className="flex items-center gap-1.5">
                  <UploadCloud className="size-4" /> Drop to upload
                </span>
              </motion.div>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>
    </FieldRow>
  );
}

function Thumb({ sortId, assetRef, index, onRef, onRemove }: { sortId: string; assetRef: AssetRef; index: number; onRef: (next: AssetRef) => void; onRemove: () => void }) {
  const row = useAssetRow(assetRef.id);
  const url = assetUrl(row, 360);
  const [framing, setFraming] = useState(false);
  const crop = useThumbCrop(assetRef, true);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });
  const framable = !!row && row.kind !== "video";
  const custom = !!refFocal(assetRef);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square overflow-hidden rounded-xl bg-muted shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]", isDragging && "z-10 shadow-xl", row?.alpha && "bld-checker")}
    >
      <button type="button" className="absolute inset-0 cursor-grab overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/60 active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin preview of a /media rendition, cropped like the page crops a square
          <img
            src={url}
            alt=""
            draggable={false}
            className={cn("size-full transition-[object-position,transform] duration-500 ease-[cubic-bezier(.22,1,.36,1)]", row?.alpha ? "object-contain p-1.5" : "object-cover")}
            style={crop}
          />
        ) : null}
      </button>
      {index === 0 ? <span className="pointer-events-none absolute start-1.5 top-1.5 rounded-full bg-background/85 px-1.5 py-px text-[9.5px] font-semibold backdrop-blur">Main</span> : null}
      {!assetRef.alt.trim() ? <span className="pointer-events-none absolute bottom-1.5 start-1.5 size-1.5 rounded-full bg-warn ring-2 ring-background" title="No alt text" /> : null}
      <div className="absolute end-1 top-1 flex flex-col gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <Button type="button" size="icon-xs" variant="secondary" aria-label="Remove image" onClick={onRemove} className="size-5 bg-background/85 backdrop-blur [&_svg]:size-3">
          <X />
        </Button>
        {framable ? (
          <Button
            type="button"
            size="icon-xs"
            variant="secondary"
            aria-label={custom ? "Framing — custom point" : "Framing — auto"}
            title={custom ? "Framing — custom point" : "Framing — auto"}
            onClick={() => setFraming(true)}
            className={cn("size-5 bg-background/85 backdrop-blur [&_svg]:size-3", custom && "text-brand")}
          >
            <CrosshairIcon />
          </Button>
        ) : null}
      </div>
      {custom ? <span className="pointer-events-none absolute end-1.5 bottom-1.5 size-1.5 rounded-full bg-brand ring-2 ring-background group-hover:opacity-0" title="Custom framing point" /> : null}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute inset-x-1 bottom-1 truncate rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium opacity-0 backdrop-blur transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {assetRef.alt.trim() ? "Edit alt" : "Add alt"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" side="top">
          <label className="mb-1.5 block text-xs font-medium">Alt text</label>
          <Input autoFocus value={assetRef.alt} maxLength={200} dir="auto" onChange={(e) => onRef({ ...assetRef, alt: e.target.value })} placeholder="What the photo shows" className="h-8 text-[12.5px]" />
        </PopoverContent>
      </Popover>
      {framing ? <FocalDialog open={framing} onOpenChange={setFraming} assetRef={assetRef} onChange={onRef} title={index === 0 ? "Framing — main photo" : `Framing — photo ${index + 1}`} /> : null}
    </div>
  );
}
