"use client";
/**
 * "Crop {item} from this photo" (docs/OFFERS.md §B.4, D12): drag a rectangle on a group photo (free
 * aspect, at least 5% each way) to cut one product out of a photo that shows several. Stores a box
 * (0..1 of the photo) on a copy of the reference in that item's photos; pages render it with CSS
 * only (no new image file, no server crop).
 *
 * Pointer: drag outside the box draws a new one, inside moves it, the eight handles resize it.
 * Keyboard: arrows move the box (Shift = 5%), Alt + arrows resize it from its end edges.
 * Shared by the generate wizard and the builder (FocalDialog's box mode).
 */
import { Crop, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CropBox } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { roundBox } from "./model";

const MIN = 0.05;

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Drag = { kind: "move" | "draw" | Handle; x0: number; y0: number; box: CropBox };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A box from two corners, at least MIN, inside the photo. */
function fromCorners(ax: number, ay: number, bx: number, by: number): CropBox {
  let x = clamp(Math.min(ax, bx), 0, 1);
  let y = clamp(Math.min(ay, by), 0, 1);
  const w = clamp(Math.abs(bx - ax), MIN, 1);
  const h = clamp(Math.abs(by - ay), MIN, 1);
  if (x + w > 1) x = 1 - w;
  if (y + h > 1) y = 1 - h;
  return { x, y, w, h };
}

function resize(b: CropBox, handle: Handle, dx: number, dy: number): CropBox {
  let { x, y, w, h } = b;
  if (handle.includes("w")) {
    const nx = clamp(x + dx, 0, x + w - MIN);
    w = w + (x - nx);
    x = nx;
  }
  if (handle.includes("e")) w = clamp(w + dx, MIN, 1 - x);
  if (handle.includes("n")) {
    const ny = clamp(y + dy, 0, y + h - MIN);
    h = h + (y - ny);
    y = ny;
  }
  if (handle.includes("s")) h = clamp(h + dy, MIN, 1 - y);
  return { x, y, w, h };
}

export interface CropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** a large rendition of the photo */
  src: string | null;
  width: number;
  height: number;
  /** the current crop (editing), else a suggested starting box */
  value?: CropBox | null;
  /** start box when there is no value (e.g. the left half for the first of two products) */
  initial?: CropBox;
  title: string;
  description?: string;
  onDone: (box: CropBox) => void;
  /** remove the crop (shown when editing one) */
  onRemove?: () => void;
}

export function CropDialog(p: CropDialogProps) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="flex max-h-[94dvh] w-[min(96vw,48rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 pe-8 text-[15px]">
            <Crop className="size-4 text-brand" />
            <bdi>{p.title}</bdi>
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {p.description ?? "Drag a frame around this product only. The page shows the framed part wherever this product appears; the photo itself is not changed."}
          </DialogDescription>
        </DialogHeader>
        {p.open ? <CropBody {...p} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CropBody(p: CropDialogProps) {
  const start = p.value ?? p.initial ?? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
  const [box, setBox] = useState<CropBox>(start);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const ratio = p.width > 0 && p.height > 0 ? p.width / p.height : 1;

  const point = (e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>, kind: Drag["kind"]) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = point(e);
    drag.current = { kind, x0: pt.x, y0: pt.y, box };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !stage.current) return;
    const pt = point(e);
    const dx = pt.x - d.x0;
    const dy = pt.y - d.y0;
    if (d.kind === "move") setBox({ ...d.box, x: clamp(d.box.x + dx, 0, 1 - d.box.w), y: clamp(d.box.y + dy, 0, 1 - d.box.h) });
    else if (d.kind === "draw") setBox(fromCorners(d.x0, d.y0, pt.x, pt.y));
    else setBox(resize(d.box, d.kind, dx, dy));
  }, []);
  const onUp = () => {
    drag.current = null;
  };

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const map: Record<string, [number, number]> = { ArrowLeft: [rtl ? step : -step, 0], ArrowRight: [rtl ? -step : step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    setBox((b) => (e.altKey ? resize(b, "se", m[0], m[1]) : { ...b, x: clamp(b.x + m[0], 0, 1 - b.w), y: clamp(b.y + m[1], 0, 1 - b.h) }));
  };

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const cropRatio = (box.w * p.width) / Math.max(1, box.h * p.height);
  const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const HANDLE_POS: Record<Handle, string> = {
    nw: "start-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rtl:translate-x-1/2",
    n: "start-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rtl:translate-x-1/2",
    ne: "end-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize rtl:-translate-x-1/2",
    e: "end-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rtl:-translate-x-1/2",
    se: "end-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rtl:-translate-x-1/2",
    s: "start-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rtl:translate-x-1/2",
    sw: "start-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize rtl:translate-x-1/2",
    w: "start-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rtl:translate-x-1/2",
  };

  return (
    <>
      <div className="adm-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="grid place-items-center rounded-xl bg-[repeating-conic-gradient(color-mix(in_oklab,var(--foreground)_6%,transparent)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
          {/* the stage keeps the photo's own ratio: box coordinates are fractions of it (always LTR) */}
          <div
            ref={stage}
            dir="ltr"
            role="application"
            aria-label="Crop frame: drag to draw, move or resize; arrow keys move it, Alt + arrows resize it"
            tabIndex={0}
            onKeyDown={onKey}
            onPointerDown={(e) => onDown(e, "draw")}
            onPointerMove={onMove}
            onPointerUp={onUp}
            className="relative max-h-[58dvh] w-full touch-none rounded-lg outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            style={{ aspectRatio: String(ratio), maxWidth: `calc(58dvh * ${ratio})` }}
          >
            {/* the photo and the shade are clipped to the photo; the frame and its handles are not */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              {p.src ? (
                // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                <img src={p.src} alt="" draggable={false} className="absolute inset-0 size-full object-fill" />
              ) : (
                <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">Photo unavailable</div>
              )}
              <div aria-hidden="true" className="pointer-events-none absolute rounded-[3px] shadow-[0_0_0_9999px_rgb(0_0_0/0.52)]" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }} />
            </div>
            <div
              role="presentation"
              onPointerDown={(e) => onDown(e, "move")}
              className="absolute cursor-move rounded-[3px] ring-2 ring-white"
              style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,transparent_33.2%,rgb(255_255_255/0.35)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.35)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgb(255_255_255/0.35)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.35)_66.6%,transparent_66.8%)]" />
              {handles.map((h) => (
                <span
                  key={h}
                  role="presentation"
                  onPointerDown={(e) => onDown(e as unknown as ReactPointerEvent<HTMLDivElement>, h)}
                  className={cn("absolute size-3.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.4)] ring-2 ring-brand", HANDLE_POS[h].replace(/rtl:\S+/g, ""))}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <span className="text-[11.5px] font-medium text-foreground/80">Preview</span>
          <div className="overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10" style={{ aspectRatio: String(cropRatio) }}>
            <CroppedImg src={p.src} box={box} ratio={ratio} frame={cropRatio} className="size-full" />
          </div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11.5px] tabular-nums">
            <dt className="text-muted-foreground">Width</dt>
            <dd className="text-end">{Math.round(box.w * 100)}%</dd>
            <dt className="text-muted-foreground">Height</dt>
            <dd className="text-end">{Math.round(box.h * 100)}%</dd>
            <dt className="text-muted-foreground">Shape</dt>
            <dd className="text-end">{cropRatio >= 1 ? `${cropRatio.toFixed(2)} : 1` : `1 : ${(1 / cropRatio).toFixed(2)}`}</dd>
          </dl>
          <div className="grid gap-1">
            <Button type="button" variant="outline" size="sm" className="justify-start rounded-full" onClick={() => setBox({ x: 0, y: 0, w: 0.5, h: 1 })}>
              Left half
            </Button>
            <Button type="button" variant="outline" size="sm" className="justify-start rounded-full" onClick={() => setBox({ x: 0.5, y: 0, w: 0.5, h: 1 })}>
              Right half
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-between gap-2 rounded-none border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setBox(start)}>
            <RotateCcw />
            Reset
          </Button>
          {p.onRemove && p.value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              onClick={() => {
                p.onRemove?.();
                p.onOpenChange(false);
              }}
            >
              Remove crop
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => p.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full px-4"
            onClick={() => {
              p.onDone(roundBox(box));
              p.onOpenChange(false);
            }}
          >
            Use this crop
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/**
 * A cropped photo as a thumbnail (same math as the landing `Picture`: the box fills the frame,
 * object-fit cover of the crop). `frame` is the frame's width / height.
 */
export function CroppedImg({ src, box, ratio, className, frame = 1 }: { src: string | null; box?: CropBox; ratio: number; className?: string; frame?: number }) {
  if (!src) return <span className={cn("block bg-muted", className)} />;
  if (!box) {
    // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
    return <img src={src} alt="" draggable={false} className={cn("size-full object-cover", className)} />;
  }
  // scale the photo so the crop covers the frame (object-fit: cover of the crop), crop centered
  const cropRatio = (box.w * ratio) / box.h;
  const w = cropRatio <= frame ? 100 / box.w : (100 * ratio) / (box.h * frame);
  const h = (w * frame) / ratio;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return (
    <span className={cn("relative block overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- media-library rendition */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="absolute max-w-none"
        style={{ width: `${w}%`, height: `${h}%`, left: `${50 - cx * w}%`, top: `${50 - cy * h}%` }}
      />
    </span>
  );
}
