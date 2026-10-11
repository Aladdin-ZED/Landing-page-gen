"use client";
/**
 * Code-split entry points of the admin preview. The real components carry the whole landing
 * renderer — every section with its copy, the theme engine, the landing CSS strings and the vanilla
 * runtime, ~400 KB gzip — so they are loaded on demand and never sit in a route's first-load bundle.
 *
 *  - LandingThumbnail loads once its box comes within 300 px of the viewport. Until then (and on
 *    the server) it renders the same empty box the real thumbnail shows before it mounts its frame.
 *  - LandingPreview loads once mounted in the browser and shows the preview's own backdrop
 *    meanwhile (the real one is blank until it has measured its container, so nothing jumps).
 *
 * Both take exactly the props of the real components. One chunk request per component, shared by
 * every instance.
 */
import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { LandingPreviewProps } from "./LandingPreview";
import type { LandingThumbnailProps } from "./LandingThumbnail";

/** React.lazy caches a rejection for good: a chunk that fails to load (offline, or a redeploy
 *  replaced it) renders `Fallback` instead of throwing into the screen's error boundary. */
function settle<P extends object>(load: Promise<ComponentType<P>>, Fallback: ComponentType<P>) {
  return load.then(
    (component) => ({ default: component }),
    (err: unknown) => {
      console.warn("[preview] the page renderer could not be loaded", err);
      return { default: Fallback };
    },
  );
}

const ThumbnailImpl = lazy(() => settle(import("./LandingThumbnail").then((m) => m.LandingThumbnail), ThumbnailBox));
const PreviewImpl = lazy(() => settle(loadPreview(), PreviewUnavailable));

let previewChunk: Promise<ComponentType<LandingPreviewProps>> | null = null;
function loadPreview(): Promise<ComponentType<LandingPreviewProps>> {
  return (previewChunk ??= import("./LandingPreview").then(
    (m) => m.LandingPreview,
    (err: unknown) => {
      previewChunk = null;
      throw err;
    },
  ));
}

/** Starts loading the renderer ahead of time (e.g. when the next step of a flow will show previews). */
export function preloadLandingPreview(): void {
  loadPreview().catch(() => undefined);
}

/** The empty box of a thumbnail that hasn't mounted its frame yet (same markup as the real one). */
function ThumbnailBox({ device = "mobile", aspectRatio, className, label, boxRef }: LandingThumbnailProps & { boxRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <div
      ref={boxRef}
      className={cn("relative overflow-hidden bg-muted", className)}
      style={{ aspectRatio: aspectRatio ?? (device === "mobile" ? "9 / 16" : "16 / 10") }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

function PreviewBackdrop({ className }: LandingPreviewProps) {
  return <div className={cn("relative h-full w-full overflow-auto bg-muted/50", className)} aria-busy="true" />;
}

function PreviewUnavailable({ className }: LandingPreviewProps) {
  return (
    <div className={cn("relative grid h-full w-full place-items-center overflow-auto bg-muted/50 p-6", className)}>
      <p role="alert" className="max-w-xs text-center text-sm text-muted-foreground">
        The preview couldn&apos;t be loaded. Reload the page to try again.
      </p>
    </div>
  );
}

export function LandingThumbnail(props: LandingThumbnailProps) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (near || !box) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: "300px" },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [near, box]);

  if (!near) return <ThumbnailBox {...props} boxRef={setBox} />;
  return (
    <Suspense fallback={<ThumbnailBox {...props} />}>
      <ThumbnailImpl {...props} />
    </Suspense>
  );
}

const noopSubscribe = () => () => {};

export function LandingPreview(props: LandingPreviewProps) {
  // browser only: the server (and hydration) render the backdrop, never the renderer
  const client = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!client) return <PreviewBackdrop {...props} />;
  return (
    <Suspense fallback={<PreviewBackdrop {...props} />}>
      <PreviewImpl {...props} />
    </Suspense>
  );
}
