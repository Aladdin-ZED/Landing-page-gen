"use client";
/**
 * Center stage: the live preview (selection synced both ways, inline text editing), a floating
 * Edit / Test switch, and the empty state of a page without sections.
 */
import { AnimatePresence, motion } from "motion/react";
import { Hand, Keyboard, MousePointer2, Plus } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { LandingPreview } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { useEditor, useEditorApi } from "./context";
import { useEnv } from "./env";
import { EASE, Segmented } from "./ui";

export function Canvas({
  hostRef,
  onShowShortcuts,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  onShowShortcuts: () => void;
}) {
  const api = useEditorApi();
  const doc = useEditor((s) => s.doc);
  const assets = useEditor((s) => s.assets);
  const device = useEditor((s) => s.device);
  const zoom = useEditor((s) => s.zoom);
  const selectedId = useEditor((s) => s.selectedId);
  const interactive = useEditor((s) => s.interactive);
  const { store } = useEnv();
  // keep typing in the panels responsive: the preview catches up in a lower-priority render
  const shownDoc = useDeferredValue(doc);
  // select (and scroll to) a just-added section only once the deferred preview has rendered it
  const shownSelected = selectedId && shownDoc.sections.some((s) => s.id === selectedId) ? selectedId : null;
  const empty = doc.sections.filter((s) => !s.hidden).length === 0;

  const [hint, setHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const onEditText = useCallback(
    (sectionId: string, path: string, value: string) => {
      if (!api.editText(sectionId, path, value))
        toast.error("That text can't be used here", {
          description: "It may be empty or too long for this field.",
        });
    },
    [api],
  );

  return (
    <div
      ref={hostRef}
      data-bld-canvas
      className="bld-canvas relative min-h-0 min-w-0 flex-1 overflow-hidden"
      tabIndex={-1}
    >
      {/* the bottom band is reserved for the floating mode switch */}
      <div className="absolute inset-x-0 top-0 bottom-14">
        <LandingPreview
          doc={shownDoc}
          assets={assets}
          store={store}
          device={device}
          selectedSectionId={shownSelected}
          onSelectSection={api.select}
          onEditText={onEditText}
          interactive={interactive}
          scale={zoom === "fit" ? undefined : zoom}
          className="bld-scroll bg-transparent"
        />
      </div>

      <AnimatePresence>
        {empty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute inset-0 grid place-items-center p-6"
          >
            <div className="bld-float max-w-xs px-6 py-6 text-center">
              <p className="font-display text-[19px] leading-tight font-semibold tracking-[-0.025em]">
                An empty stage
              </p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Start with a hero, then add proof, offer and the order form.
              </p>
              <Button
                variant="brand"
                className="mt-4"
                onClick={() => api.setLibraryOpen(true)}
              >
                <Plus />
                Add a section
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* floating mode switch */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
        <div className="bld-float pointer-events-auto flex items-center gap-1.5 p-1.5">
          <Segmented
            value={interactive ? "test" : "edit"}
            onChange={(v) => api.setInteractive(v === "test")}
            label="Preview mode"
            stretch={false}
            options={[
              {
                value: "edit",
                label: (
                  <>
                    <MousePointer2 /> Edit
                  </>
                ),
                title: "Click to select, double-click text to edit",
              },
              {
                value: "test",
                label: (
                  <>
                    <Hand /> Test
                  </>
                ),
                title: "Use the page like a visitor",
              },
            ]}
          />
          <AnimatePresence initial={false}>
            {hint && !interactive ? (
              <motion.span
                key="hint"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="overflow-hidden whitespace-nowrap pe-1 text-[11.5px] text-muted-foreground"
              >
                Double-click any text to edit it
              </motion.span>
            ) : null}
          </AnimatePresence>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts"
            onClick={onShowShortcuts}
            className="text-muted-foreground"
          >
            <Keyboard />
          </Button>
        </div>
      </div>
    </div>
  );
}
