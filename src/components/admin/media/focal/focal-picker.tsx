"use client";
/**
 * Framing picker: the whole image with its analysed subject (viewfinder brackets), heads and hands,
 * the focal handle, and live crops of the frame shapes landing pages use — cropped by the kit's own
 * engine (src/lib/media/focus.ts), so the previews are exactly what pages show.
 *
 *   <FocalPicker src width height value={fx/fy | null} info={useFocalInfo(id).info}
 *                onCommit={(p) => setPoint(p)} onReset={() => backToAuto()} size="compact" />
 *
 * AUTO (value null): every frame is fitted to the subject — heads whole, hands never cut in half, a
 * product's top kept; the handle rests on the analysed focal point (eyes level for people).
 * CUSTOM: click or drag anywhere — every frame centres on that point as well as it can.
 * Hovering a preview outlines its crop on the photo.
 */
import { CircleCheckIcon, CropIcon, CrosshairIcon, FocusIcon, LoaderCircleIcon, ScanFaceIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { AssetFocus, Box, FocusKind } from "@/lib/media/focus";
import { cn } from "@/lib/utils";
import { CHECKER } from "../asset-tile";
import { cropStyle, frameRadius, judgeFrames, verdictSummary, type FocalPoint, type FrameId, type FrameVerdict, type PreviewFrame } from "./frames";
import { analysedFocal, round3, type FocalInfo } from "./tags";

const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } as const;
const EASE = [0.22, 1, 0.36, 1] as const;
const pct = (v: number) => `${Math.round(v * 10_000) / 100}%`;

function stageBackground(alpha: boolean | undefined, dominant: string | undefined): CSSProperties | undefined {
  if (alpha) return undefined;
  return { backgroundColor: `color-mix(in oklab, ${/^#[0-9a-f]{6}$/i.test(dominant ?? "") ? dominant : "#cccccc"} 34%, var(--muted))` };
}

/** border-radius of a frame's crop outlined on the photo (percentages of the window box). */
function windowRadius(f: PreviewFrame): string {
  if (f.spec.shape === "circle") return "50%";
  if (f.spec.shape === "arch") {
    const v = Math.min(50, (f.ratio / 2) * 100);
    return `50% 50% 7% 7% / ${v}% ${v}% ${7 * f.ratio}% ${7 * f.ratio}%`;
  }
  return `7% / ${7 * f.ratio}%`;
}

/* ------------------------------------------------------------------ */
/* stage                                                               */
/* ------------------------------------------------------------------ */

interface StageProps {
  src: string | null;
  width: number;
  height: number;
  alpha?: boolean;
  dominant?: string;
  /** the custom point (null = auto) */
  value: FocalPoint | null;
  /** live point while dragging */
  draft: FocalPoint | null;
  focus: AssetFocus | null;
  loading?: boolean;
  readOnly?: boolean;
  maxHeight: number;
  compact?: boolean;
  /** crop of the hovered frame preview, outlined on the photo */
  highlight: { frame: PreviewFrame; window: Box } | null;
  name?: string;
  onDraft(p: FocalPoint | null): void;
  onCommit(p: FocalPoint): void;
  onReset?(): void;
  children?: ReactNode;
}

function FocalStage({ src, width, height, alpha, dominant, value, draft, focus, loading, readOnly, maxHeight, compact, highlight, name, onDraft, onCommit, onReset, children }: StageProps) {
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const latest = useRef<FocalPoint | null>(null);
  const frame = useRef(0);
  const reduce = useReducedMotion();
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const auto = !value && !draft;
  const point = draft ?? value ?? analysedFocal(focus);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const fromEvent = useCallback((e: PointerEvent<HTMLElement>): FocalPoint => {
    const r = box.current!.getBoundingClientRect();
    let x = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
    let y = Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height)));
    // magnetic center lines (6 px)
    if (Math.abs(x - 0.5) * r.width < 6) x = 0.5;
    if (Math.abs(y - 0.5) * r.height < 6) y = 0.5;
    return { x: round3(x), y: round3(y) };
  }, []);

  const move = (p: FocalPoint) => {
    latest.current = p;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onDraft(p));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (readOnly || e.button !== 0 || !src) return;
    if ((e.target as HTMLElement).closest("[data-stage-action]")) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    handle.current?.focus({ preventScroll: true });
    move(fromEvent(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) move(fromEvent(e));
  };
  const finish = (commit: boolean) => {
    if (!dragging) return;
    setDragging(false);
    cancelAnimationFrame(frame.current);
    const p = latest.current;
    latest.current = null;
    onDraft(null);
    if (commit && p) onCommit(p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (readOnly) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[e.key];
    if (d) {
      e.preventDefault();
      onCommit({ x: round3(Math.min(1, Math.max(0, point.x + d[0]))), y: round3(Math.min(1, Math.max(0, point.y + d[1]))) });
    } else if (onReset && value && (e.key === "Backspace" || e.key === "Delete" || ((e.key === "a" || e.key === "A") && !e.metaKey && !e.ctrlKey))) {
      e.preventDefault();
      onReset();
    }
  };

  const keep = focus?.keep ?? [];
  const heads = keep.filter((k) => k.k === "head");
  const hands = keep.filter((k) => k.k === "hand");
  const showBox = !!focus && (focus.kind !== "scene" || focus.box.w * focus.box.h < 0.8);
  const found = loading
    ? "Finding the subject…"
    : !focus
      ? null
      : heads.length
        ? `${heads.length === 1 ? "Face" : `${heads.length} faces`}${hands.length ? ` · ${hands.length === 1 ? "hand" : `${hands.length} hands`}` : ""}`
        : focus.kind === "cutout"
          ? "Cutout"
          : focus.kind === "scene"
            ? "Scene"
            : "Product";
  const dim = dragging ? 0.4 : 1;
  const autoPoint = focus ? analysedFocal(focus) : null;

  return (
    <div
      ref={box}
      className={cn(
        "relative mx-auto touch-none overflow-hidden select-none ring-1 ring-foreground/[0.07] ring-inset",
        compact ? "rounded-xl" : "rounded-2xl",
        alpha && CHECKER,
        readOnly || !src ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-crosshair",
      )}
      style={{ width: `min(100%, ${Math.round(maxHeight * aspect)}px)`, aspectRatio: `${width} / ${height}`, ...stageBackground(alpha, dominant) }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => finish(true)}
      onPointerCancel={() => finish(false)}
      onLostPointerCapture={() => finish(true)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of a /media rendition
        <img src={src} alt="" draggable={false} className={cn("pointer-events-none absolute inset-0 size-full", alpha ? "object-contain" : "object-cover")} />
      ) : null}

      {/* a soft scan while the subject is being found */}
      <AnimatePresence>
        {loading && !reduce ? (
          <motion.span
            key="scan"
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-[linear-gradient(to_bottom,transparent,color-mix(in_oklab,var(--brand)_24%,transparent)_72%,color-mix(in_oklab,white_50%,transparent)_100%)] mix-blend-screen"
            initial={{ y: "-110%", opacity: 0 }}
            animate={{ y: ["-110%", "320%"], opacity: [0, 1, 1, 0], transition: { duration: 1.6, ease: "easeInOut", repeat: Infinity } }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          />
        ) : null}
      </AnimatePresence>

      {/* the subject: viewfinder brackets */}
      <AnimatePresence>
        {showBox && focus ? (
          <motion.span
            key={`subject-${focus.box.x}-${focus.box.y}-${focus.box.w}`}
            aria-hidden="true"
            className="pointer-events-none absolute drop-shadow-[0_0_1.5px_rgb(0_0_0/0.55)]"
            style={{
              left: `max(4px, ${pct(focus.box.x)})`,
              top: `max(4px, ${pct(focus.box.y)})`,
              right: `max(4px, ${pct(1 - focus.box.x - focus.box.w)})`,
              bottom: `max(4px, ${pct(1 - focus.box.y - focus.box.h)})`,
            }}
            initial={{ opacity: 0, scale: reduce ? 1 : 1.06 }}
            animate={{ opacity: 0.95 * dim, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <Brackets size={compact ? 9 : 13} />
          </motion.span>
        ) : null}
      </AnimatePresence>

      {/* heads (kept whole in every auto crop) and hands (never cut in half) */}
      {heads.map((k, i) => (
        <motion.span
          key={`head-${i}-${k.b.x}-${k.b.y}`}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[42%] shadow-[0_0_0_1px_rgb(0_0_0/0.22),inset_0_0_0_1.5px_rgb(255_255_255/0.92)]"
          style={{ left: pct(k.b.x), top: pct(k.b.y), width: pct(k.b.w), height: pct(k.b.h) }}
          initial={{ opacity: 0, scale: reduce ? 1 : 0.86 }}
          animate={{ opacity: dim, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.12 + i * 0.06, ease: EASE }}
        />
      ))}
      {hands.map((k, i) => (
        <motion.span
          key={`hand-${i}-${k.b.x}-${k.b.y}`}
          aria-hidden="true"
          className="pointer-events-none absolute rounded-[46%] shadow-[0_0_0_1px_rgb(0_0_0/0.16),inset_0_0_0_1px_rgb(255_255_255/0.75)]"
          style={{ left: pct(k.b.x), top: pct(k.b.y), width: pct(k.b.w), height: pct(k.b.h) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 * dim }}
          transition={{ duration: 0.45, delay: 0.24 + i * 0.05, ease: EASE }}
        />
      ))}

      {/* crop of the hovered frame */}
      <AnimatePresence>
        {highlight ? (
          <motion.span
            key="window"
            aria-hidden="true"
            className="pointer-events-none absolute shadow-[0_0_0_100vmax_rgb(10_12_16/0.5),inset_0_0_0_1.5px_rgb(255_255_255/0.95)]"
            style={{ left: pct(highlight.window.x), top: pct(highlight.window.y), width: pct(highlight.window.w), height: pct(highlight.window.h), borderRadius: windowRadius(highlight.frame) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          />
        ) : null}
      </AnimatePresence>

      {/* guides while dragging */}
      {dragging ? (
        <>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-white/70 shadow-[0_0_0_0.5px_rgb(0_0_0/0.25)]" style={{ left: pct(point.x) }} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 h-px bg-white/70 shadow-[0_0_0_0.5px_rgb(0_0_0/0.25)]" style={{ top: pct(point.y) }} />
        </>
      ) : null}

      {/* in custom mode, the analysed point stays visible: click it to go back to auto */}
      <AnimatePresence>
        {value && autoPoint && onReset && !readOnly ? (
          <motion.button
            key="ghost"
            type="button"
            data-stage-action
            aria-label="Back to auto framing"
            title="Auto point — click to go back to auto framing"
            onClick={onReset}
            className="absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ left: pct(autoPoint.x), top: pct(autoPoint.y) }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: dragging ? 0.5 : 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING}
          >
            <span className="size-2.5 rounded-full bg-brand shadow-[0_0_0_2px_rgb(255_255_255/0.9),0_1px_4px_rgb(0_0_0/0.35)]" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* the focal handle: jade disc in auto, white glass ring on a custom point */}
      {src ? (
        <motion.button
          ref={handle}
          type="button"
          role="slider"
          aria-label={`Focal point${name ? ` of ${name}` : ""}${auto ? " (auto)" : ""}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(point.y * 100)}
          aria-valuetext={`${auto ? "Auto, " : ""}${Math.round(point.x * 100)}% across, ${Math.round(point.y * 100)}% down`}
          aria-readonly={readOnly || undefined}
          aria-keyshortcuts={readOnly ? undefined : "ArrowLeft ArrowRight ArrowUp ArrowDown Delete"}
          tabIndex={readOnly ? -1 : 0}
          title={auto ? "Auto — each frame is fitted to the subject. Click or drag on the photo to choose a point." : undefined}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none backdrop-blur-[3px]",
            auto
              ? "size-[22px] bg-[color-mix(in_oklab,var(--brand)_78%,transparent)] shadow-[inset_0_0_0_2px_rgb(255_255_255/0.9),0_0_0_1px_rgb(0_0_0/0.14),0_3px_12px_rgb(0_0_0/0.3)]"
              : "size-[26px] bg-white/20 shadow-[inset_0_0_0_2px_rgb(255_255_255/0.95),0_0_0_1px_rgb(0_0_0/0.16),0_3px_12px_rgb(0_0_0/0.32)]",
            "focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--ring)_75%,transparent)]",
            readOnly ? "pointer-events-none" : dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          initial={false}
          animate={{ left: pct(point.x), top: pct(point.y), scale: dragging ? 1.14 : 1 }}
          transition={dragging || reduce ? { duration: 0 } : SPRING}
        >
          <span className={cn("rounded-full", auto ? "size-[6px] bg-white" : "size-[7px] bg-brand shadow-[0_0_0_1.5px_rgb(255_255_255/0.95)]")} />
        </motion.button>
      ) : null}

      {/* corner chips: what was found · the exact point */}
      {found ? (
        <span
          className={cn(
            "adm-glass pointer-events-none absolute start-2 bottom-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full font-medium text-foreground/85",
            compact ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]",
          )}
        >
          {loading ? <LoaderCircleIcon className="size-3 shrink-0 animate-spin text-brand" /> : null}
          {found}
        </span>
      ) : null}
      <AnimatePresence>
        {(dragging || focused) && !readOnly ? (
          <motion.span
            key="readout"
            aria-hidden="true"
            className={cn("adm-glass pointer-events-none absolute end-2 bottom-2 inline-flex items-center rounded-full font-mono tabular-nums text-foreground/85", compact ? "h-5 px-2 text-[10px]" : "h-6 px-2.5 text-[11px]")}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {auto ? "auto" : `${Math.round(point.x * 100)} · ${Math.round(point.y * 100)}`}
          </motion.span>
        ) : null}
      </AnimatePresence>

      {children}
    </div>
  );
}

/** Four L-shaped corners (camera lock-on), crisp at any size. */
function Brackets({ size }: { size: number }) {
  const s = { width: size, height: size };
  const c = "absolute border-white";
  return (
    <>
      <span className={cn(c, "top-0 left-0 rounded-tl-[5px] border-t-2 border-l-2")} style={s} />
      <span className={cn(c, "top-0 right-0 rounded-tr-[5px] border-t-2 border-r-2")} style={s} />
      <span className={cn(c, "bottom-0 left-0 rounded-bl-[5px] border-b-2 border-l-2")} style={s} />
      <span className={cn(c, "right-0 bottom-0 rounded-br-[5px] border-r-2 border-b-2")} style={s} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* frame previews                                                      */
/* ------------------------------------------------------------------ */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function FrameRail({
  src,
  alpha,
  dominant,
  verdicts,
  maxHeight,
  gap,
  active,
  live,
  onActive,
}: {
  src: string;
  alpha?: boolean;
  dominant?: string;
  verdicts: readonly FrameVerdict[];
  maxHeight: number;
  gap: number;
  active: FrameId | null;
  /** dragging: crops follow the pointer without easing */
  live: boolean;
  onActive(id: FrameId | null): void;
}) {
  const [ref, width] = useWidth<HTMLUListElement>();
  const total = verdicts.reduce((s, v) => s + v.frame.ratio, 0);
  const h = width ? Math.max(30, Math.min(maxHeight, (width - gap * (verdicts.length - 1)) / total)) : maxHeight;
  return (
    // contain: inline-size — the row measures the width it is given, never widens its container
    <ul ref={ref} aria-label="How each frame crops this image" className="flex min-w-0 items-end justify-between [contain:inline-size]" style={{ gap }} onPointerLeave={() => onActive(null)}>
      {verdicts.map((v) => {
        const on = active === v.frame.id;
        const w = h * v.frame.ratio;
        const tip =
          v.state === "ok"
            ? `${v.frame.label} — keeps it whole`
            : v.state === "tight"
              ? `${v.frame.label} — too small to hold ${v.cut === "head" ? "every head" : v.cut === "hand" ? "the hands" : "the whole product"}`
              : `${v.frame.label} — cuts ${v.cut === "head" ? "a head" : v.cut === "hand" ? "a hand" : "the product"} at this point`;
        return (
          <li key={v.frame.id} className="shrink-0" style={{ width: w }}>
            <button
              type="button"
              aria-label={tip}
              title={tip}
              onPointerEnter={() => onActive(v.frame.id)}
              onFocus={() => onActive(v.frame.id)}
              onBlur={() => onActive(null)}
              className="group/frame grid w-full justify-items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span
                className={cn(
                  "relative block overflow-hidden transition-[box-shadow,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)]",
                  alpha && CHECKER,
                  on
                    ? "-translate-y-0.5 shadow-[0_0_0_1.5px_var(--brand),0_10px_22px_-12px_color-mix(in_oklab,var(--brand)_70%,transparent)]"
                    : v.state === "cut"
                      ? "shadow-[0_0_0_1.5px_var(--warn),0_6px_16px_-12px_rgb(0_0_0/0.4)]"
                      : "shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_9%,transparent),0_6px_16px_-12px_rgb(0_0_0/0.4)]",
                )}
                style={{ height: h, width: w, borderRadius: frameRadius(v.frame, w, h), ...stageBackground(alpha, dominant) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- live crop preview of a /media rendition */}
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className={cn("absolute inset-0 size-full object-cover", !live && "transition-[object-position,transform] duration-300 ease-[cubic-bezier(.22,1,.36,1)]")}
                  style={cropStyle(v.crop)}
                />
              </span>
              {/* the label may overhang a narrow frame, centred under it (it never widens the row) */}
              <span className="flex w-max items-center gap-1 text-[10px] leading-none font-medium whitespace-nowrap text-muted-foreground group-hover/frame:text-foreground">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0 rounded-full transition-colors",
                    v.state === "ok" ? "bg-brand/75" : v.state === "cut" ? "bg-warn shadow-[0_0_0_1px_color-mix(in_oklab,var(--warn-ink)_35%,transparent)]" : "bg-muted-foreground/45",
                  )}
                />
                <span>{v.frame.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* composite                                                           */
/* ------------------------------------------------------------------ */

export interface FocalPickerProps {
  /** a rendition URL (≥ 640 px is plenty) */
  src: string | null;
  width: number;
  height: number;
  alpha?: boolean;
  dominant?: string;
  /** the custom point (AssetRef fx/fy); null = auto framing */
  value: FocalPoint | null;
  /** subject analysis + library default (useFocalInfo) */
  info: FocalInfo | null;
  loading?: boolean;
  /** a custom point: end of a drag, a click, an arrow key */
  onCommit?(p: FocalPoint): void;
  /** back to auto framing (the ghost auto point, Delete / A on the handle) */
  onReset?(): void;
  readOnly?: boolean;
  size?: "compact" | "full";
  /** accessible name of the image */
  name?: string;
  /** controls laid over the photo (replace, remove…) — mark them data-stage-action */
  overlay?: ReactNode;
  className?: string;
}

export function FocalPicker({ src, width, height, alpha, dominant, value, info, loading, onCommit, onReset, readOnly, size = "full", name, overlay, className }: FocalPickerProps) {
  const compact = size === "compact";
  const [draft, setDraft] = useState<FocalPoint | null>(null);
  const [active, setActive] = useState<FrameId | null>(null);
  const focus = info?.focus ?? null;
  const point = draft ?? value;
  const aspect = width > 0 && height > 0 ? width / height : 1;
  const verdicts = useMemo(() => judgeFrames(aspect, focus, point, !!alpha), [aspect, focus, point, alpha]);
  const highlight = active ? (verdicts.find((v) => v.frame.id === active) ?? null) : null;
  const clean = verdicts.every((v) => v.state !== "cut");

  return (
    <div className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)]", compact ? "gap-3" : "gap-4", className)}>
      <FocalStage
        src={src}
        width={width}
        height={height}
        alpha={alpha}
        dominant={dominant}
        value={value}
        draft={draft}
        focus={focus}
        loading={loading}
        readOnly={readOnly || !onCommit}
        maxHeight={compact ? 236 : 340}
        compact={compact}
        highlight={highlight ? { frame: highlight.frame, window: highlight.window } : null}
        name={name}
        onDraft={setDraft}
        onCommit={(p) => onCommit?.(p)}
        onReset={onReset}
      >
        {overlay}
      </FocalStage>
      {src ? (
        <div
          className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] transition-[opacity,filter] duration-300", compact ? "gap-2" : "gap-2.5", loading && "opacity-[0.45] saturate-50")}
          aria-busy={loading || undefined}
        >
          <FrameRail
            src={src}
            alpha={alpha}
            dominant={dominant}
            verdicts={verdicts}
            maxHeight={compact ? 54 : 78}
            gap={compact ? 8 : 12}
            active={active}
            live={!!draft}
            onActive={setActive}
          />
          <p className={cn("flex items-start gap-1.5 leading-snug text-muted-foreground", compact ? "text-[11px]" : "text-[12px]")} aria-live="polite">
            {focus && !loading ? clean ? <CircleCheckIcon className="mt-px size-3.5 shrink-0 text-brand" /> : <CropIcon className="mt-px size-3.5 shrink-0 text-warn-ink" /> : null}
            <span>{loading ? "Reading the photo…" : verdictSummary(verdicts, focus, !!point)}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Small status pill: Auto (with what was analysed) · Custom (or another label) · reading. */
export function FocalBadge({ mode, kind, loading, label, className }: { mode: "auto" | "custom"; kind?: FocusKind | "none" | null; loading?: boolean; label?: string; className?: string }) {
  const base = "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold leading-none [&_svg]:size-3";
  if (loading) {
    return (
      <span className={cn(base, "bg-foreground/[0.05] text-muted-foreground", className)}>
        <LoaderCircleIcon className="animate-spin" />
        Reading
      </span>
    );
  }
  if (mode === "auto") {
    return (
      <span
        className={cn(base, "bg-brand-soft text-[color-mix(in_oklab,var(--brand)_78%,var(--foreground))]", className)}
        title={kind === "person" ? "Auto — every frame keeps the faces whole" : "Auto — every frame is fitted to the subject"}
      >
        {kind === "person" ? <ScanFaceIcon /> : <FocusIcon />}
        {label ?? "Auto"}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-foreground/[0.06] text-foreground/70", className)} title="Every frame centers on a point you chose">
      <CrosshairIcon />
      {label ?? "Custom"}
    </span>
  );
}
