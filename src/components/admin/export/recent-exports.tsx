"use client";
/**
 * Recent exports of the page, newest first: mode, version, size, allowed domains and a revocable
 * key. Revoking is a two-step inline confirmation (no stacked modal inside the dialog).
 */
import { LoaderCircleIcon, ShieldOffIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { StatusChip } from "@/components/admin/common/status-chip";
import { Button } from "@/components/ui/button";
import type { ExportRecordJson, ExportVersionJson } from "@/lib/export/types";
import { cn } from "@/lib/utils";
import { absoluteTime, formatBytes, relativeTime, versionTitle } from "./format";
import { MODE_META } from "./mode-cards";
import { revokeExportRequest } from "./use-export";

const REVOKE_HINT = {
  connected: "The API refuses orders from this copy from now on.",
  php: "Marks it retired — the copy keeps taking orders until you delete its order.php.",
  whatsapp: "Marks it retired — remove the files from your host to take it offline.",
} as const;

export function RecentExports({
  exports,
  versions,
  highlightId,
  onChanged,
}: {
  exports: ExportRecordJson[];
  versions: ExportVersionJson[];
  /** the export just downloaded (briefly highlighted) */
  highlightId?: string;
  onChanged: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<Record<string, string>>({});

  const revoke = async (e: ExportRecordJson) => {
    setPending(e.id);
    const res = await revokeExportRequest(e.id);
    setPending(null);
    setConfirming(null);
    if (!res.ok) {
      toast.error(res.message ?? "The export could not be revoked.");
      return;
    }
    setRevoked((r) => ({ ...r, [e.id]: res.export.revokedAt ?? new Date().toISOString() }));
    toast.success(e.mode === "connected" ? "Export revoked — its orders are refused from now on." : "Export marked as retired.");
    onChanged();
  };

  if (!exports.length) {
    return (
      <p className="rounded-2xl bg-foreground/[0.03] px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground ring-1 ring-foreground/[0.06] ring-inset">
        No exports of this page yet. Each one gets its own key, listed here so you can revoke it later.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      <AnimatePresence initial={false}>
        {exports.map((e) => {
          const meta = MODE_META[e.mode];
          const Icon = meta.icon;
          const revokedAt = e.revokedAt ?? revoked[e.id] ?? null;
          const version = versions.find((v) => v.id === e.versionId);
          const isNew = e.id === highlightId;
          const asking = confirming === e.id;
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "grid gap-2.5 rounded-2xl bg-card p-3.5 ring-1 ring-foreground/[0.07] ring-inset transition-shadow duration-700",
                isNew && "shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_22%,transparent)] ring-brand/40",
                revokedAt && "opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", revokedAt ? "bg-foreground/[0.05] text-muted-foreground" : "bg-brand/10 text-brand")}
                >
                  <Icon className="size-4" />
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[0.85rem] font-semibold">{meta.title}</span>
                    <StatusChip tone={revokedAt ? "neutral" : "green"} pulse={!revokedAt && e.mode === "connected"} className="h-5 px-2 text-[0.68rem]">
                      {revokedAt ? (e.mode === "connected" ? "Revoked" : "Retired") : isNew ? "New" : "Active"}
                    </StatusChip>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={absoluteTime(e.createdAt)}>
                    {relativeTime(e.createdAt)}
                    {e.createdByName ? ` · ${e.createdByName}` : ""}
                    {version ? ` · ${versionTitle(version)} version` : ""}
                    {e.bytes ? ` · ${formatBytes(e.bytes)}` : ""}
                  </p>
                </div>
                {!revokedAt && !asking && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirming(e.id)}
                    aria-label={`${e.mode === "connected" ? "Revoke" : "Retire"} the ${meta.title} export from ${absoluteTime(e.createdAt)}`}
                  >
                    <ShieldOffIcon />
                    {e.mode === "connected" ? "Revoke" : "Retire"}
                  </Button>
                )}
              </div>

              {e.allowedOrigins.length > 0 && (
                <div className="flex flex-wrap gap-1 ps-11">
                  {e.allowedOrigins.slice(0, 4).map((o) => (
                    <span key={o} className="max-w-full truncate rounded-md bg-foreground/[0.045] px-1.5 py-0.5 font-mono text-[0.68rem] text-foreground/70">
                      {o.replace(/^https?:\/\//, "")}
                    </span>
                  ))}
                  {e.allowedOrigins.length > 4 && <span className="text-[0.68rem] text-muted-foreground">+{e.allowedOrigins.length - 4} more</span>}
                </div>
              )}

              <AnimatePresence initial={false}>
                {asking && !revokedAt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-destructive/[0.06] p-2.5 ps-3 ring-1 ring-destructive/15 ring-inset">
                      <p className="min-w-0 flex-1 text-xs leading-snug text-foreground/80">{REVOKE_HINT[e.mode]}</p>
                      {/* the row's button is replaced by this panel: keep the keyboard focus here, on the safe choice */}
                      <Button autoFocus variant="ghost" size="sm" className="rounded-full" disabled={pending === e.id} onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                      <Button size="sm" className="rounded-full bg-destructive text-white hover:bg-destructive/90" disabled={pending === e.id} onClick={() => void revoke(e)}>
                        {pending === e.id ? <LoaderCircleIcon className="animate-spin" /> : <ShieldOffIcon />}
                        {e.mode === "connected" ? "Revoke key" : "Mark retired"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
