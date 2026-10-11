"use client";
/**
 * Instant live preview of a PageDoc in the admin builder.
 *
 *   <LandingPreview doc={doc} assets={assetsById} device="mobile"
 *     selectedSectionId={sel} onSelectSection={setSel} onEditText={(sid, path, value) => …} />
 *
 * React renders the landing body (the same renderPageBody as publish) through a portal into a
 * same-origin about:blank iframe, so updates are patched in place (scroll position kept) — no HTML
 * round trip. Head styles (font faces, theme tokens, base + all section chunks) and <html>
 * attributes are synced from here; the vanilla runtime runs inside the frame in preview mode
 * (never sends orders or events) and is refreshed (debounced) after every update.
 *
 * Edit mode (default): hover outlines + label chips, click selects a section, double-click on
 * editable text edits it in place. `interactive` turns that off to test the page like a visitor.
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { StoreInfo } from "@/landing/context";
import { renderPageBody } from "@/landing/page";
import { getSection } from "@/landing/registry";
import { initLanding, type LandingInstance } from "@/landing/runtime";
import type { PageDoc, SectionInstance } from "@/lib/page/schema";
import { buildRuntimeConfig } from "@/lib/render/config";
import { attachEditor, type EditorHandle, type EditorHandlers } from "./editor";
import { DEVICES, FRAME_EXTRA_CSS, useElementSize, useFrameDocument, useFrameHead, useIsoLayoutEffect, usePreviewContext, type PreviewAssets, type PreviewDevice } from "./frame";
import { FrameBoundary, SectionBoundary, SectionErrorNote } from "./SectionBoundary";

export interface LandingPreviewProps {
  doc: PageDoc;
  /** asset rows by id (DB rows or the media API JSON) for every asset the doc references (+ the store logo) */
  assets: PreviewAssets;
  /** Settings → Store (footer, WhatsApp, legal identity); pass a stable object (memoized) */
  store?: StoreInfo;
  device: PreviewDevice;
  selectedSectionId?: string | null;
  onSelectSection?: (sectionId: string) => void;
  onEditText?: (sectionId: string, path: string, value: string) => void;
  /** behave like the live page (no selection/editing; clicks reach the page) */
  interactive?: boolean;
  /** fixed zoom (1 = 100 %); default: fit the container */
  scale?: number;
  className?: string;
}

const PREVIEW_PAGE_KEY = "pk_preview_page";
/** Debounce of runtime refreshes while the admin types. */
const REFRESH_MS = 120;
/** Padding around the device frame inside the container (px). */
const GAP = 24;

const FRAME_CHROME: Record<PreviewDevice, { bezel: number; bar: number }> = {
  mobile: { bezel: 12, bar: 0 },
  tablet: { bezel: 14, bar: 0 },
  desktop: { bezel: 0, bar: 36 },
};

export function sectionLabel(doc: PageDoc, id: string): string {
  const s = doc.sections.find((x) => x.id === id);
  if (!s) return id;
  const def = getSection(s.type);
  return `${def?.label ?? s.type} · ${s.variant}`;
}

/** Value at a dotted data path ("items.0.title" or "items[0].title"). */
function readPath(root: unknown, path: string): unknown {
  let cur: unknown = root;
  for (const seg of path.replace(/\[(\d+)\]/g, ".$1").split(".")) {
    if (!seg) continue;
    if (cur === null || typeof cur !== "object") return undefined;
    cur = Array.isArray(cur) ? cur[Number(seg)] : (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function rawTextOf(doc: PageDoc, sectionId: string, path: string): string | null {
  const section = doc.sections.find((s) => s.id === sectionId);
  const inData = section ? readPath(section.data, path) : undefined;
  if (typeof inData === "string") return inData;
  const inDoc = readPath(doc, path);
  return typeof inDoc === "string" ? inDoc : null;
}

export function LandingPreview({
  doc,
  assets,
  store,
  device,
  selectedSectionId = null,
  onSelectSection,
  onEditText,
  interactive = false,
  scale,
  className,
}: LandingPreviewProps) {
  const [frameRef, frameDoc] = useFrameDocument();
  const [boxRef, box] = useElementSize<HTMLDivElement>();
  const { ctx, theme } = usePreviewContext(doc, assets, PREVIEW_PAGE_KEY, store);
  useFrameHead(frameDoc, doc, theme, { classes: ["lp", "lp-js"], extraCss: FRAME_EXTRA_CSS, page: "landing" });

  const editor = useRef<EditorHandle | null>(null);

  /* ---- body ---- */
  const labelOf = useCallback((s: SectionInstance) => getSection(s.type)?.label ?? s.type, []);
  const body = useMemo(
    () =>
      renderPageBody(doc, ctx, {
        guard: (s, node): ReactNode => (
          <SectionBoundary sectionId={s.id} label={labelOf(s)} bg={s.bg} resetKey={JSON.stringify(s)}>
            {node}
          </SectionBoundary>
        ),
        onError: (s, err) => <SectionErrorNote label={labelOf(s)} message={err instanceof Error ? err.message : "render error"} />,
      }),
    [doc, ctx, labelOf],
  );

  /* ---- crash recovery: remount the body, keep the scroll position ---- */
  const [generation, setGeneration] = useState(0);
  const crashes = useRef<number[]>([]);
  const savedScroll = useRef(0);
  /** the doc that kept crashing the frame; the next edit (a new doc object) retries */
  const [brokenDoc, setBrokenDoc] = useState<PageDoc | null>(null);
  const broken = brokenDoc === doc;
  const onCrash = useCallback(() => {
    const now = Date.now();
    crashes.current = [...crashes.current.filter((t) => now - t < 5000), now];
    if (crashes.current.length > 3) {
      crashes.current = [];
      setBrokenDoc(doc);
      return;
    }
    savedScroll.current = frameDoc?.defaultView?.scrollY ?? 0;
    setGeneration((g) => g + 1);
  }, [frameDoc, doc]);
  useIsoLayoutEffect(() => {
    if (generation > 0) frameDoc?.defaultView?.scrollTo(0, savedScroll.current);
  }, [generation, frameDoc]);

  /* ---- runtime ---- */
  const config = useMemo(
    () =>
      buildRuntimeConfig(doc, ctx, {
        page: "landing",
        mode: "preview",
        pageKey: PREVIEW_PAGE_KEY,
        endpoints: { order: "/api/public/order" },
        thankYouUrl: "#",
        landingUrl: "#",
      }),
    [doc, ctx],
  );
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  const runtime = useRef<{ instance: LandingInstance; key: string } | null>(null);

  useEffect(() => {
    const win = frameDoc?.defaultView;
    if (!frameDoc || !win) return;
    const apply = () => {
      try {
        if (!runtime.current || runtime.current.key !== configKey) {
          runtime.current = { instance: initLanding({ doc: frameDoc, win, config, preview: true }), key: configKey };
        } else {
          runtime.current.instance.refresh();
        }
      } catch (err) {
        console.warn("[preview] runtime failed", err);
      }
      editor.current?.refresh();
    };
    if (!runtime.current) {
      apply();
      return;
    }
    const t = window.setTimeout(apply, REFRESH_MS);
    return () => window.clearTimeout(t);
  }, [frameDoc, body, config, configKey, generation]);

  useEffect(
    () => () => {
      runtime.current?.instance.destroy();
      runtime.current = null;
    },
    [frameDoc],
  );

  /* ---- editor affordances ---- */
  const handlers = useRef<EditorHandlers>({
    label: () => "",
    rawText: () => null,
    select: () => undefined,
    editText: () => undefined,
  });
  useEffect(() => {
    handlers.current = {
      label: (id) => sectionLabel(doc, id),
      rawText: (sid, path) => rawTextOf(doc, sid, path),
      select: (id) => onSelectSection?.(id),
      editText: (sid, path, value) => onEditText?.(sid, path, value),
    };
  }, [doc, onSelectSection, onEditText]);

  useEffect(() => {
    if (!frameDoc) return;
    const handle = attachEditor(frameDoc, () => handlers.current);
    editor.current = handle;
    return () => {
      handle.destroy();
      editor.current = null;
    };
  }, [frameDoc]);
  useEffect(() => editor.current?.setInteractive(interactive), [interactive, frameDoc]);
  useEffect(() => editor.current?.setSelected(selectedSectionId, true), [selectedSectionId, frameDoc]);
  useEffect(() => editor.current?.refresh(), [body, device]);

  /* ---- device frame & fit ---- */
  const dev = DEVICES[device];
  const chrome = FRAME_CHROME[device];
  const frameW = dev.width + chrome.bezel * 2;
  const availW = Math.max(0, box.width - GAP * 2);
  const availH = Math.max(0, box.height - GAP * 2);
  const fixedH = dev.height !== null ? dev.height + chrome.bezel * 2 + chrome.bar : null;
  const fit = scale ?? Math.min(1, availW / frameW, fixedH ? availH / fixedH : Number.POSITIVE_INFINITY);
  const s = Number.isFinite(fit) && fit > 0 ? fit : 0;
  const viewportH = dev.height ?? Math.max(480, Math.floor((s > 0 ? availH / s : 0) - chrome.bar));
  const frameH = fixedH ?? viewportH + chrome.bar;

  return (
    <div ref={boxRef} className={cn("relative h-full w-full overflow-auto bg-muted/50", className)}>
      <div className="flex min-h-full min-w-full items-start justify-center" style={{ padding: GAP }}>
        <div className="relative shrink-0" style={{ width: frameW * s, height: frameH * s, visibility: s > 0 ? "visible" : "hidden" }}>
          <div
            className={cn(
              "absolute left-0 top-0 overflow-hidden",
              device === "mobile" && "rounded-[3.25rem] bg-neutral-900 shadow-2xl ring-1 ring-black/10",
              device === "tablet" && "rounded-[2.25rem] bg-neutral-900 shadow-2xl ring-1 ring-black/10",
              device === "desktop" && "rounded-lg border bg-background shadow-xl",
            )}
            style={{ width: frameW, height: frameH, padding: chrome.bezel, transform: `scale(${s})`, transformOrigin: "0 0" }}
          >
            {device === "desktop" ? (
              <div className="flex h-9 items-center gap-1.5 border-b bg-muted px-3" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="size-2.5 rounded-full bg-foreground/15" />
                <span className="mx-auto h-5 w-2/5 rounded-md bg-background/80" />
              </div>
            ) : null}
            <div className={cn("overflow-hidden bg-white", device === "mobile" && "rounded-[2.5rem]", device === "tablet" && "rounded-[1.5rem]")}>
              <iframe
                ref={frameRef}
                title="Landing page preview"
                className="block border-0 bg-white"
                style={{ width: dev.width, height: viewportH }}
              />
            </div>
          </div>
        </div>
      </div>
      {broken ? (
        <p role="alert" className="absolute inset-x-6 top-6 rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive shadow">
          The preview could not be updated. Keep editing — it refreshes on the next change.
        </p>
      ) : null}
      {frameDoc && !broken
        ? createPortal(
            <FrameBoundary key={generation} onCrash={onCrash}>
              {body}
            </FrameBoundary>,
            frameDoc.body,
          )
        : null}
    </div>
  );
}
