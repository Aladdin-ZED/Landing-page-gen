"use client";
/**
 * Helpers for UI that is code-split out of a route's first-load bundle (dialogs, drawers, charts):
 *
 *   const loadExport = () => import("../export/ExportDialog");
 *   const ExportDialog = dynamic(() => loadExport().then((m) => m.ExportDialog), { ssr: false });
 *   const mounted = useOpenedOnce(open);        // mount on first open, then keep it for its exit animation
 *   const PREFETCH = [loadExport];               // module level
 *   usePrefetchOnIdle(PREFETCH);                 // fetch the chunk once the screen is idle → opens instantly
 */
import { useEffect, useState } from "react";

/** True from the first render where `open` is true on: a lazily loaded dialog mounts when first
 *  opened and then stays mounted, so its close animation and internal state behave as before. */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened || open;
}

type ChunkLoader = () => Promise<unknown>;

/**
 * Loads code-split chunks once the browser is idle after the screen has rendered, so on-demand UI
 * opens without a network wait while staying out of the first load. Pass a module-level array
 * (a new array every render would re-schedule the prefetch). Failures are ignored here: the real
 * open retries the import.
 */
export function usePrefetchOnIdle(loaders: readonly ChunkLoader[], enabled = true): void {
  useEffect(() => {
    if (!enabled || loaders.length === 0) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      for (const load of loaders) load().catch(() => undefined);
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(run, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [loaders, enabled]);
}
