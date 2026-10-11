"use client";
/**
 * Library details → Framing: the photo with its analysed subject, heads and hands, live crops of
 * every frame shape, and the team's default point. AUTO (no default): pages fit every frame to the
 * subject. A saved default pre-fills the point when the image is placed on a page; pages already
 * built keep their own framing.
 */
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MediaAsset } from "../media-client";
import { saveFocal, useFocalInfo } from "./focal-client";
import { FocalBadge, FocalPicker } from "./focal-picker";
import type { FocalPoint } from "./frames";
import { focalFromTags, sameFocal, type FocalInfo } from "./tags";

/** Draft of the point being edited: a point, or `null` = "back to auto" not saved yet. */
type Draft = { id: string; p: FocalPoint | null };

export function AssetFraming({ asset, canWrite, onSaved }: { asset: MediaAsset; canWrite: boolean; onSaved(id: string, focal: FocalPoint | null): void }) {
  const fetched = useFocalInfo(asset.id);
  // the list JSON already carries the analysis: show it at once, the request only refreshes it
  const info: FocalInfo | null =
    fetched.info ?? (asset.focus ? { id: asset.id, width: asset.width, height: asset.height, alpha: asset.alpha, focus: asset.focus, saved: focalFromTags(asset.tags) } : null);
  const loading = fetched.loading && !info;
  const { error, retry } = fetched;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const saved = info ? info.saved : focalFromTags(asset.tags);
  const pending = draft && draft.id === asset.id ? draft : null;
  const value = pending ? pending.p : saved;
  const dirty = !!pending && (pending.p === null ? saved !== null : !sameFocal(pending.p, saved));

  const persist = async (p: FocalPoint | null) => {
    setBusy(true);
    try {
      const next = await saveFocal(asset.id, p);
      setDraft(null);
      onSaved(asset.id, next.saved);
      toast.success(p ? "Default framing saved" : "Back to auto framing", {
        description: p ? "New placements on pages start from this point." : "Pages fit every frame to the subject.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the framing.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-3" aria-label="Framing">
      <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[0.72rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Framing</h3>
          <FocalBadge mode={value ? "custom" : "auto"} label={value && !dirty ? "Team default" : undefined} kind={info?.focus?.kind} loading={loading && !info} />
          {dirty ? <span className="text-[11px] text-muted-foreground">Not saved</span> : null}
        </div>
        {canWrite ? (
          <div className="flex items-center gap-1">
            {dirty ? (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" disabled={busy} onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button variant="brand" size="sm" className="rounded-full px-3" disabled={busy} onClick={() => pending && void persist(pending.p)}>
                  {busy ? <Loader2Icon className="animate-spin" /> : null}
                  {pending?.p ? "Save as default" : "Save auto"}
                </Button>
              </>
            ) : saved ? (
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" disabled={busy} onClick={() => void persist(null)}>
                {busy ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                Reset to auto
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <FocalPicker
        src={asset.url ?? asset.thumbUrl}
        width={asset.width}
        height={asset.height}
        alpha={asset.alpha}
        dominant={asset.dominant}
        value={value}
        info={info}
        loading={loading}
        name={asset.originalName ?? undefined}
        onCommit={canWrite ? (p) => setDraft({ id: asset.id, p }) : undefined}
        onReset={canWrite ? () => setDraft(saved ? { id: asset.id, p: null } : null) : undefined}
      />
      {error ? (
        <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{error}</span>
          <Button variant="ghost" size="xs" className="rounded-full" onClick={retry}>
            Try again
          </Button>
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {canWrite
            ? "Auto fits every frame to the subject. Click the photo to set a point every frame centers on instead — new placements on pages start from it; pages you already built keep their own framing."
            : "How every frame crops this photo when it is placed on a page."}
        </p>
      )}
    </section>
  );
}
