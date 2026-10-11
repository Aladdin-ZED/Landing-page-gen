"use client";
/**
 * Builder dialogs: the editing conflict (page changed in another tab or by a teammate) and the
 * keyboard shortcuts sheet.
 */
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { loadPage } from "@/lib/editor/actions";
import { useEditor, useEditorStore } from "./context";
import { fullTime } from "./env";
import { usePersistence } from "./persistence";
import { SHORTCUTS } from "./shortcuts";
import { Kbd, MOD } from "./ui";

export function ConflictDialog() {
  const store = useEditorStore();
  const conflict = useEditor((s) => s.conflict);
  const pageId = useEditor((s) => s.page.id);
  const { call, overwrite } = usePersistence();
  const [busy, setBusy] = useState<"load" | "keep" | null>(null);

  const loadTheirs = async () => {
    setBusy("load");
    const res = await call(() => loadPage({ pageId }));
    setBusy(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    store.getState().reset(res.boot);
    toast.success("Loaded the latest version");
  };

  const keepMine = async () => {
    setBusy("keep");
    const ok = await overwrite();
    setBusy(null);
    if (ok) toast.success("Your version was saved");
    else toast.error("Could not save your version. Check your connection and try again.");
  };

  return (
    <Dialog open={!!conflict}>
      <DialogContent showCloseButton={false} className="gap-0 p-0 sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <div className="px-6 pb-5 pt-6">
          <span className="grid size-10 place-items-center rounded-xl bg-warn/14 text-warn-ink">
            <TriangleAlert className="size-5" />
          </span>
          <DialogTitle className="mt-4 text-[17px] font-semibold tracking-[-0.01em]">This page changed somewhere else</DialogTitle>
          <DialogDescription className="mt-1.5 text-[13px] leading-relaxed">
            It was saved from another tab or by a teammate{conflict?.serverUpdatedAt ? ` (${fullTime(conflict.serverUpdatedAt)})` : ""}. Autosave is paused until you choose. <strong className="font-medium text-foreground">Load the latest</strong> drops your unsaved edits;{" "}
            <strong className="font-medium text-foreground">Keep my version</strong> replaces the other change.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--bld-hairline)] bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void loadTheirs()} disabled={!!busy}>
            {busy === "load" ? <LoaderCircle className="animate-spin" /> : null}
            Load the latest
          </Button>
          <Button onClick={() => void keepMine()} disabled={!!busy}>
            {busy === "keep" ? <LoaderCircle className="animate-spin" /> : null}
            Keep my version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-[16px] font-semibold">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="-mt-2 text-[12.5px]">Work faster on the canvas and in the sections list.</DialogDescription>
        <ul className="divide-y divide-[var(--bld-hairline)]">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-4 py-2 text-[13px]">
              <span className="text-foreground/85">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k === "Mod" ? MOD : k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
