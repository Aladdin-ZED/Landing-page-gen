"use client";
/**
 * Scaled-down, non-interactive picture of a page for galleries (pages list, generator directions,
 * version history). Renders the first sections only, mounts when scrolled near, runs no runtime
 * (no html.lp-js → every reveal is in its final, visible state).
 *
 *   <LandingThumbnail doc={doc} assets={assetsById} device="mobile" className="w-full rounded-lg" />
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { StoreInfo } from "@/landing/context";
import { renderPageBody } from "@/landing/page";
import { getSection } from "@/landing/registry";
import type { PageDoc } from "@/lib/page/schema";
import { DEVICES, FRAME_EXTRA_CSS, useElementSize, useFrameDocument, useFrameHead, usePreviewContext, type PreviewAssets, type PreviewDevice } from "./frame";
import { SectionBoundary } from "./SectionBoundary";

export interface LandingThumbnailProps {
  doc: PageDoc;
  assets: PreviewAssets;
  /** Settings → Store (header wordmark, footer); pass a stable object (memoized) */
  store?: StoreInfo;
  device?: Exclude<PreviewDevice, "tablet">;
  /** number of in-flow sections to render (from the top) */
  sections?: number;
  /** CSS aspect-ratio of the thumbnail box (default 9/16 mobile, 16/10 desktop) */
  aspectRatio?: string;
  className?: string;
  /** accessible name; thumbnails are decorative by default */
  label?: string;
}

/** First `n` visible in-flow sections (floating bars would cover a tiny picture). */
function topSections(doc: PageDoc, n: number): PageDoc {
  const sections = doc.sections.filter((s) => !s.hidden && getSection(s.type)?.category !== "floating").slice(0, Math.max(1, n));
  return { ...doc, sections };
}

export function LandingThumbnail({ doc, assets, store, device = "mobile", sections = 4, aspectRatio, className, label }: LandingThumbnailProps) {
  const [sizeRef, size] = useElementSize<HTMLDivElement>();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  const [frameRef, frameDoc] = useFrameDocument();
  const trimmed = useMemo(() => topSections(doc, sections), [doc, sections]);
  const { ctx, theme } = usePreviewContext(trimmed, assets, "pk_preview_thumb", store);
  useFrameHead(frameDoc, trimmed, theme, { classes: ["lp"], extraCss: FRAME_EXTRA_CSS, page: "landing" });

  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      sizeRef(el);
      setBox(el);
    },
    [sizeRef],
  );

  useEffect(() => {
    if (!box || near) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setNear(true);
    }, { rootMargin: "300px" });
    io.observe(box);
    return () => io.disconnect();
  }, [box, near]);

  const body = useMemo(
    () =>
      renderPageBody(trimmed, ctx, {
        guard: (s, node) => (
          <SectionBoundary sectionId={s.id} label={getSection(s.type)?.label ?? s.type} bg={s.bg} resetKey={JSON.stringify(s)}>
            {node}
          </SectionBoundary>
        ),
      }),
    [trimmed, ctx],
  );

  const width = DEVICES[device].width;
  const scale = size.width > 0 ? size.width / width : 0;
  const height = scale > 0 ? Math.ceil(size.height / scale) : 0;

  return (
    <div
      ref={setRefs}
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ aspectRatio: aspectRatio ?? (device === "mobile" ? "9 / 16" : "16 / 10") }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {near ? (
        <iframe
          ref={frameRef}
          title={label ?? "Page thumbnail"}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
          style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      ) : null}
      {frameDoc ? createPortal(body, frameDoc.body) : null}
    </div>
  );
}
