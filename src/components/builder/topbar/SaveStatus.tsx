"use client";
/**
 * Autosave status: "Saving…", "Saved · 4s ago", "Offline · retrying", "Not saved" (with retry),
 * "Conflict". Transitions cross-fade so the bar never jumps.
 */
import { AnimatePresence, motion } from "motion/react";
import { CloudAlert, CloudCheck, CloudOff, LoaderCircle, PencilLine, TriangleAlert } from "lucide-react";
import { useShallow } from "zustand/shallow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditor } from "../context";
import { fullTime, relativeTime, useNow } from "../env";
import { usePersistence } from "../persistence";
import { EASE, MOD } from "../ui";

type Mode = "saving" | "saved" | "dirty" | "offline" | "error" | "conflict" | "idle";

export function SaveStatus() {
  const s = useEditor(
    useShallow((st) => ({
      saving: st.saving,
      savedAt: st.savedAt,
      error: st.saveError,
      conflict: !!st.conflict,
      dirty: st.doc !== st.savedDoc,
    })),
  );
  const now = useNow(5_000);
  const { flush } = usePersistence();

  const mode: Mode = s.conflict
    ? "conflict"
    : s.saving
      ? "saving"
      : s.error === "offline"
        ? "offline"
        : s.error
          ? "error"
          : s.dirty
            ? "dirty"
            : s.savedAt
              ? "saved"
              : "idle";

  const view: Record<Mode, { icon: React.ReactNode; text: string; tone: string }> = {
    saving: { icon: <LoaderCircle className="size-3.5 animate-spin" />, text: "Saving…", tone: "text-muted-foreground" },
    saved: { icon: <CloudCheck className="size-3.5" />, text: `Saved · ${relativeTime(s.savedAt ?? now, now)}`, tone: "text-muted-foreground" },
    idle: { icon: <CloudCheck className="size-3.5" />, text: "All changes saved", tone: "text-muted-foreground" },
    dirty: { icon: <PencilLine className="size-3.5" />, text: "Editing", tone: "text-muted-foreground" },
    offline: { icon: <CloudOff className="size-3.5" />, text: "Offline · retrying", tone: "text-warn-ink" },
    error: { icon: <CloudAlert className="size-3.5" />, text: "Not saved · retry", tone: "text-destructive" },
    conflict: { icon: <TriangleAlert className="size-3.5" />, text: "Changed elsewhere", tone: "text-destructive" },
  };
  const v = view[mode];
  const clickable = mode === "error" || mode === "offline" || mode === "dirty";

  const body = (
    <button
      type="button"
      onClick={clickable ? () => void flush() : undefined}
      disabled={!clickable}
      aria-live="polite"
      className={cn(
        "relative inline-flex h-7 items-center xl:min-w-[8.5rem] justify-end overflow-hidden rounded-md px-2 text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        clickable ? "hover:bg-muted" : "cursor-default",
        v.tone,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={mode}
          initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
          transition={{ duration: 0.24, ease: EASE }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          {v.icon}
          {v.text}
        </motion.span>
      </AnimatePresence>
    </button>
  );

  const tip =
    mode === "error"
      ? s.error
      : mode === "saved" && s.savedAt
        ? `Last saved ${fullTime(s.savedAt)}`
        : mode === "dirty"
          ? `Autosaves in a moment — ${MOD}+S to save now`
          : mode === "offline"
            ? "Your edits are kept here and saved as soon as the connection is back."
            : null;
  if (!tip) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-64">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
