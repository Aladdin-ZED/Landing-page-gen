"use client";

import { DownloadIcon, GlobeIcon, KeyRoundIcon, MessageCircleIcon, PlugZapIcon, ServerIcon, ShieldOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExportItem } from "@/lib/admin-data/exports";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { EmptyState } from "../common/empty-state";
import { Pager } from "../common/pager";
import { Segmented } from "../common/segmented";
import { StatusChip } from "../common/status-chip";
import { RelativeTime } from "../common/time";
import { runAction, type ActionResult } from "../lib/action-result";
import { bytes, dateTime } from "../lib/format";
import { VERSION_KIND_META } from "../lib/status";
import { useQueryState } from "../lib/use-query-state";
import { ExportDialog } from "../on-demand";

const MODE_META: Record<ExportItem["mode"], { label: string; hint: string; icon: React.ReactNode }> = {
  connected: { label: "Connected", hint: "Orders are sent to this studio (and its Google Sheet).", icon: <PlugZapIcon className="size-3.5" /> },
  php: { label: "Standalone PHP", hint: "Orders go to the host's own order.php and Google Sheet.", icon: <ServerIcon className="size-3.5" /> },
  whatsapp: { label: "WhatsApp", hint: "The form opens a pre-filled WhatsApp message.", icon: <MessageCircleIcon className="size-3.5" /> },
};

export function ExportsView({
  items,
  total,
  page,
  pageSize,
  activeOnly,
  canExport,
  revoke,
}: {
  items: ExportItem[];
  total: number;
  page: number;
  pageSize: number;
  activeOnly: boolean;
  canExport: boolean;
  revoke: (id: string) => Promise<ActionResult<null>>;
}) {
  const router = useRouter();
  const query = useQueryState();
  const [again, setAgain] = useState<ExportItem | null>(null);
  const [revoking, setRevoking] = useState<ExportItem | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="adm-rise flex items-center justify-between gap-3" style={{ ["--i" as string]: 2 }}>
        <Segmented
          label="Filter exports"
          value={activeOnly ? "active" : "all"}
          onChange={(v) => query.set({ active: v === "active" ? 1 : null })}
          options={[
            { value: "all", label: "All exports" },
            { value: "active", label: "Active keys" },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          illustration="exports"
          title={activeOnly ? "No active export keys" : "No exports yet"}
          description="Export any page as a self-contained site (HTML, optimized images, fonts) to host it on another domain. Each export gets its own key you can revoke here."
        />
      ) : (
        <div className={cn("grid grid-cols-1 gap-4 transition-opacity duration-300", query.pending && "opacity-60")}>
          <ul className="grid grid-cols-1 gap-3">
            {items.map((e, i) => {
              const mode = MODE_META[e.mode];
              const revoked = !!e.revokedAt;
              const kind = e.versionKind ? (VERSION_KIND_META[e.versionKind]?.label ?? e.versionKind) : null;
              return (
                <li
                  key={e.id}
                  className={cn("adm-surface adm-rise grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center", revoked && "opacity-70")}
                  style={{ ["--i" as string]: Math.min(i, 10) + 3 }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", revoked ? "bg-foreground/[0.05] text-muted-foreground" : "bg-brand/10 text-brand")}>
                      <GlobeIcon className="size-4.5" />
                    </span>
                    <div className="grid min-w-0 gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{e.pageName ?? "Deleted page"}</span>
                        <StatusChip tone={revoked ? "neutral" : "green"} pulse={!revoked}>
                          {revoked ? "Revoked" : "Active"}
                        </StatusChip>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {kind ? `${kind} version` : "Version"}
                        {e.versionAt && (
                          <>
                            {" of "}
                            {/* the viewer's local time: the server may format in another zone */}
                            <time dateTime={e.versionAt} suppressHydrationWarning>
                              {dateTime(e.versionAt)}
                            </time>
                          </>
                        )}{" "}
                        · exported <RelativeTime iso={e.createdAt} />
                        {e.createdBy ? ` by ${e.createdBy}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="grid min-w-0 gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2.5 text-xs font-medium">
                            {mode.icon}
                            {mode.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-60">{mode.hint}</TooltipContent>
                      </Tooltip>
                      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-foreground/[0.05] px-2.5 font-mono text-[0.7rem] text-muted-foreground" title="End of the export key">
                        <KeyRoundIcon className="size-3" />…{e.keyHint}
                      </span>
                      {e.bytes ? <span className="text-xs text-muted-foreground">{bytes(e.bytes)}</span> : null}
                    </div>
                    {e.allowedOrigins.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {e.allowedOrigins.slice(0, 4).map((o) => (
                          <span key={o} className="max-w-full truncate rounded-md bg-sky-500/8 px-1.5 py-0.5 font-mono text-[0.7rem] text-sky-800 ring-1 ring-sky-500/15 ring-inset dark:text-sky-200">
                            {o.replace(/^https?:\/\//, "")}
                          </span>
                        ))}
                        {e.allowedOrigins.length > 4 && <span className="text-[0.7rem] text-muted-foreground">+{e.allowedOrigins.length - 4} more</span>}
                      </div>
                    )}
                  </div>

                  {canExport && (
                    <div className="flex items-center gap-1.5 lg:justify-end">
                      {e.pageName && (
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setAgain(e)}>
                          <DownloadIcon /> Download again
                        </Button>
                      )}
                      {!revoked && (
                        <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRevoking(e)}>
                          <ShieldOffIcon /> Revoke
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <Pager page={page} pageSize={pageSize} total={total} onPage={(p) => query.set({ page: p > 1 ? p : null }, { resetPage: false })} noun="exports" />
        </div>
      )}

      {again && <ExportDialog pageId={again.pageId} versionId={again.versionId} open onOpenChange={(o: boolean) => !o && setAgain(null)} />}

      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRevoking(null)}
          destructive
          icon={<ShieldOffIcon />}
          title="Revoke this export key?"
          description={
            revoking.mode === "connected"
              ? `The site exported from “${revoking.pageName ?? "this page"}” will stop sending orders to this studio immediately. Re-export to get a new key.`
              : "Analytics from that exported site stop counting. Its own order handling (PHP or WhatsApp) keeps working on its host."
          }
          confirmLabel="Revoke key"
          pendingLabel="Revoking…"
          onConfirm={async () => {
            const ok = (await runAction(revoke(revoking.id), { success: "Key revoked" })) !== undefined;
            if (ok) router.refresh();
            return ok;
          }}
        />
      )}
    </div>
  );
}
