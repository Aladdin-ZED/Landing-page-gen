"use client";

import { BanIcon, Loader2Icon, PlusIcon, ShieldOffIcon, SmartphoneIcon, WifiIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BlockRow } from "@/lib/admin-data/orders";
import { cn } from "@/lib/utils";
import { EmptyState } from "../common/empty-state";
import { Pager } from "../common/pager";
import { RelativeTime } from "../common/time";
import { runAction, type ActionResult } from "../lib/action-result";
import { phone as fmtPhone } from "../lib/format";
import { useQueryState } from "../lib/use-query-state";

export interface BlocklistActions {
  blockPhone: (phone: string, reason: string) => Promise<ActionResult<{ e164: string }>>;
  unblock: (id: string) => Promise<ActionResult<null>>;
}

/** Blocked phones and networks: add a phone by hand, remove entries. */
export function BlocklistPanel({
  blocked,
  canWrite,
  actions,
}: {
  blocked: { items: BlockRow[]; total: number; page: number; pageSize: number };
  canWrite: boolean;
  actions: BlocklistActions;
}) {
  const router = useRouter();
  const query = useQueryState();
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await runAction(actions.blockPhone(phone, reason), { success: (d) => `${fmtPhone(d.e164)} is blocked` });
      if (res) {
        setPhone("");
        setReason("");
        router.refresh();
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="grid gap-4">
        {blocked.items.length === 0 ? (
          <EmptyState
            illustration="shield"
            title="Nobody is blocked"
            description="Block a phone from an order's details, or add one here, to refuse its future orders. Useful for serial refusals and pranks."
          />
        ) : (
          <>
            <ul className="adm-surface adm-rise divide-y divide-border/60 overflow-hidden" style={{ ["--i" as string]: 3 }}>
              {blocked.items.map((b, i) => (
                <li key={b.id} className="adm-fade flex items-center gap-4 px-4 py-3.5" style={{ ["--i" as string]: Math.min(i, 12) }}>
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", b.kind === "phone" ? "bg-destructive/10 text-destructive" : "bg-warn/10 text-warn-ink")}>
                    {b.kind === "phone" ? <SmartphoneIcon className="size-4" /> : <WifiIcon className="size-4" />}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium tabular-nums">{b.kind === "phone" ? fmtPhone(b.value) : b.value}</span>
                    <span className="truncate text-xs text-muted-foreground">{b.reason || "No reason given"}</span>
                  </div>
                  <RelativeTime iso={b.createdAt} className="hidden text-xs text-muted-foreground sm:block" />
                  {canWrite && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      disabled={removing === b.id}
                      onClick={async () => {
                        setRemoving(b.id);
                        try {
                          if (await runAction(actions.unblock(b.id), { success: "Removed from the blocklist" }) !== undefined) router.refresh();
                        } finally {
                          setRemoving(null);
                        }
                      }}
                    >
                      {removing === b.id ? <Loader2Icon className="animate-spin" /> : <ShieldOffIcon />}
                      Unblock
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pager page={blocked.page} pageSize={blocked.pageSize} total={blocked.total} onPage={(p) => query.set({ page: p > 1 ? p : null }, { resetPage: false })} noun="entries" />
          </>
        )}
      </div>

      {canWrite && (
        <form onSubmit={add} className="adm-surface adm-rise grid gap-4 p-5" style={{ ["--i" as string]: 4 }}>
          <div className="grid gap-1">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold">
              <BanIcon className="size-4 text-destructive" /> Block a phone number
            </h2>
            <p className="text-sm text-muted-foreground">Any common format works: 06…, +212 6…, 00212…</p>
          </div>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" required minLength={6} maxLength={32} aria-label="Phone number" className="h-10 rounded-xl" />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={200} aria-label="Reason" className="h-10 rounded-xl" />
          <Button type="submit" variant="destructive" className="h-10 rounded-xl" disabled={adding || phone.trim().length < 6}>
            {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Add to blocklist
          </Button>
        </form>
      )}
    </div>
  );
}
