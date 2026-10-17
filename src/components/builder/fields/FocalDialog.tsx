"use client";
/**
 * Full-size framing editor for one AssetRef: the picker (subject, heads, hands, live crops of every
 * frame shape) with the image's alt text. AUTO = no fx/fy (pages fit every frame to the subject);
 * a point = every frame centers on it. Edits apply to the page as they are made (undoable).
 *
 * Box mode (docs/OFFERS.md §B.4, "Crop {item} from this photo"): `mode="box"` opens the crop frame
 * instead (src/components/admin/items/crop-dialog.tsx, shared with the generate wizard): drag a
 * rectangle around one product of a group photo; `onBox` gets the box (0..1 of the photo).
 */
import { RotateCcwIcon } from "lucide-react";
import { useId, useRef } from "react";
import { useFocalInfo } from "@/components/admin/media/focal/focal-client";
import { FocalBadge, FocalPicker } from "@/components/admin/media/focal/focal-picker";
import type { FocalPoint } from "@/components/admin/media/focal/frames";
import { roundFocal } from "@/components/admin/media/focal/tags";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CropDialog } from "@/components/admin/items/crop-dialog";
import type { AssetRef, CropBox } from "@/lib/page/schema";
import { useEditor } from "../context";
import { assetUrl } from "../env";

/** The custom point of a reference (null = auto framing). */
export function refFocal(ref: Pick<AssetRef, "fx" | "fy"> | null | undefined): FocalPoint | null {
  return ref && (ref.fx !== undefined || ref.fy !== undefined) ? { x: ref.fx ?? 0.5, y: ref.fy ?? 0.5 } : null;
}

/** The reference with a custom point (three decimals). */
export function withFocal<T extends { fx?: number; fy?: number }>(ref: T, p: FocalPoint): T {
  const r = roundFocal(p);
  return { ...ref, fx: r.x, fy: r.y };
}

/** The reference back to auto framing (no fx/fy). */
export function withoutFocal<T extends { fx?: number; fy?: number }>(ref: T): T {
  const next = { ...ref };
  delete next.fx;
  delete next.fy;
  return next;
}

export function FocalDialog({
  open,
  onOpenChange,
  assetRef,
  onChange,
  title = "Framing",
  mode = "focal",
  onBox,
  initialBox,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  assetRef: AssetRef;
  onChange(next: AssetRef): void;
  title?: string;
  /** "box": crop one product out of the photo (assetRef.box is the current crop) */
  mode?: "focal" | "box";
  onBox?(box: CropBox): void;
  /** box mode: where a new crop starts */
  initialBox?: CropBox;
}) {
  const altId = useId();
  const done = useRef<HTMLButtonElement>(null);
  const row = useEditor((s) => s.assets[assetRef.id]);
  const { info, loading } = useFocalInfo(open && mode === "focal" ? assetRef.id : null);
  const value = refFocal(assetRef);
  const src = assetUrl(row, 960);

  if (mode === "box") {
    return (
      <CropDialog
        open={open}
        onOpenChange={onOpenChange}
        src={assetUrl(row, 1440)}
        width={row?.width ?? 1}
        height={row?.height ?? 1}
        value={assetRef.box ?? null}
        initial={initialBox}
        title={title}
        onDone={(box) => {
          onBox?.(box);
          onChange({ ...assetRef, box });
        }}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] w-[min(96vw,36rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none"
        // the handle would take focus first (and show its readout): start on Done instead
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          done.current?.focus({ preventScroll: true });
        }}
      >
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 pe-8">
            <DialogTitle className="text-[15px]">{title}</DialogTitle>
            <FocalBadge mode={value ? "custom" : "auto"} kind={info?.focus?.kind} loading={loading} />
          </div>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            Auto fits every frame to the subject. Click or drag on the photo to set a point every frame centers on instead — hover a preview to see its crop.
          </DialogDescription>
        </DialogHeader>
        <div className="adm-scroll grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
          {row && row.kind !== "video" ? (
            <FocalPicker
              src={src}
              width={row.width}
              height={row.height}
              alpha={row.alpha}
              dominant={row.dominant}
              value={value}
              info={info}
              loading={loading}
              name={assetRef.alt || undefined}
              onCommit={(p) => onChange(withFocal(assetRef, p))}
              onReset={() => onChange(withoutFocal(assetRef))}
            />
          ) : (
            <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">This image isn&apos;t in the library anymore.</p>
          )}
          <div className="grid gap-1.5">
            <label htmlFor={altId} className="text-[12.5px] font-medium text-foreground/85">
              Alt text
            </label>
            <Input
              id={altId}
              value={assetRef.alt}
              maxLength={200}
              dir="auto"
              placeholder="What the photo shows"
              onChange={(e) => onChange({ ...assetRef, alt: e.target.value })}
              className="h-9 text-[13px]"
            />
          </div>
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-between gap-2 rounded-none border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" disabled={!value} onClick={() => onChange(withoutFocal(assetRef))}>
            <RotateCcwIcon />
            Reset to auto
          </Button>
          <Button ref={done} type="button" size="sm" className="rounded-full px-4" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
