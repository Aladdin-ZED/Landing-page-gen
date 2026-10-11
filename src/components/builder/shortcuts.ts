"use client";
/**
 * Builder keyboard shortcuts, active in the admin window AND inside the preview iframe (its
 * keydown events never reach the parent window, so the handler is attached to the frame too).
 * Typing in fields keeps native behaviour (their own undo, arrows, Delete) except Ctrl/⌘+S.
 */
import { useEffect, useRef, type RefObject } from "react";
import { toast } from "sonner";
import { getSection } from "@/landing/registry";
import { isRequired } from "@/lib/editor/sections";
import { useEditorStore } from "./context";
import { usePersistence } from "./persistence";

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return el.isContentEditable || !!el.closest(EDITABLE);
}

/** A modal surface (dialog, sheet, menu) owns the keyboard while it is open. */
function overlayOpen(): boolean {
  return !!document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [data-slot="popover-content"][data-state="open"]');
}

export function useBuilderShortcuts(canvasHost: RefObject<HTMLElement | null>, onHelp: () => void) {
  const store = useEditorStore();
  const { flush } = usePersistence();
  const help = useRef(onHelp);
  useEffect(() => {
    help.current = onHelp;
  }, [onHelp]);

  useEffect(() => {
    const removeSelected = () => {
      const s = store.getState();
      const sec = s.selectedId ? s.doc.sections.find((x) => x.id === s.selectedId) : null;
      if (!sec) return;
      if (isRequired(sec.type)) {
        toast("The order form can't be removed", { description: "Every page needs it. You can change its style instead." });
        return;
      }
      if (s.removeSection(sec.id)) {
        toast(`${getSection(sec.type)?.label ?? "Section"} removed`, { action: { label: "Undo", onClick: () => store.getState().undo() } });
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const s = store.getState();

      if (mod && key === "s") {
        e.preventDefault();
        void flush().then((ok) => {
          if (ok) toast.success("Saved", { duration: 1200 });
        });
        return;
      }
      if (isEditable(e.target) || overlayOpen()) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        if (s.selectedId && !s.duplicateSection(s.selectedId)) toast("This section can only appear once on a page.");
        return;
      }
      // plain keys only act on the canvas (page body, the preview frame) — panels keep their own keys
      const target = e.target as Element | null;
      const onCanvas =
        !target ||
        target === document.body ||
        target.ownerDocument !== document ||
        !!target.closest?.("[data-bld-canvas]") ||
        (!!target.closest?.("[data-bld-keys]") && !target.closest?.("[data-dnd-handle]"));
      if (!onCanvas && e.key !== "?" && e.key !== "Escape") return;

      switch (e.key) {
        case "Delete":
        case "Backspace":
          if (!s.selectedId) return;
          e.preventDefault();
          removeSelected();
          return;
        case "ArrowUp":
        case "ArrowDown": {
          if (!s.selectedId || mod) return;
          const delta = e.key === "ArrowUp" ? -1 : 1;
          e.preventDefault();
          if (e.altKey) s.moveSection(s.selectedId, delta);
          else s.selectSibling(delta);
          return;
        }
        case "Escape":
          if (s.interactive) s.setInteractive(false);
          else if (s.selectedId) s.select(null);
          return;
        case "?":
          e.preventDefault();
          help.current();
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKey);
    const host = canvasHost.current;

    // the preview iframe: attach once its document is ready (and again if it is ever replaced)
    const attached = new WeakSet<Window>();
    const scan = () => {
      const frame = host?.querySelector("iframe");
      const win = frame?.contentWindow;
      const ready = frame?.contentDocument?.documentElement?.getAttribute("data-lp-frame") === "1";
      if (win && ready && !attached.has(win)) {
        attached.add(win);
        win.addEventListener("keydown", onKey);
      }
    };
    scan();
    const timer = window.setInterval(scan, 700);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(timer);
      host?.querySelector("iframe")?.contentWindow?.removeEventListener("keydown", onKey);
    };
  }, [store, flush, canvasHost]);
}

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Mod", "Z"], label: "Undo" },
  { keys: ["Mod", "Shift", "Z"], label: "Redo" },
  { keys: ["Mod", "S"], label: "Save now" },
  { keys: ["Mod", "D"], label: "Duplicate section" },
  { keys: ["Del"], label: "Remove section" },
  { keys: ["↑", "↓"], label: "Select previous / next section" },
  { keys: ["Alt", "↑ ↓"], label: "Move section up / down" },
  { keys: ["Esc"], label: "Deselect · leave test mode" },
  { keys: ["Double-click"], label: "Edit text in the preview" },
  { keys: ["?"], label: "Show shortcuts" },
];
