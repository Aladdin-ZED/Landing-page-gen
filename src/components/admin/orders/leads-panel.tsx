"use client";

import { MessageCircleIcon, PhoneIcon, ShoppingBagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LeadRow } from "@/lib/admin-data/orders";
import { cn } from "@/lib/utils";
import { CopyButton } from "../common/copy-button";
import { EmptyState } from "../common/empty-state";
import { Pager } from "../common/pager";
import { SearchField } from "../common/search-field";
import { RelativeTime } from "../common/time";
import { phone as fmtPhone } from "../lib/format";
import { useQueryState } from "../lib/use-query-state";

/**
 * Abandoned checkouts: visitors who typed a valid phone but never ordered. A quick call or a
 * WhatsApp message often rescues them — both are one tap away. What they had picked in the form
 * (`leads.selection`, the text the Sheet would get) tells the agent what to offer on the call.
 */
export function LeadsPanel({ leads, pages }: { leads: { items: LeadRow[]; total: number; page: number; pageSize: number }; pages: { id: string; name: string }[] }) {
  const query = useQueryState();
  const filtered = !!(query.get("q") || query.get("page_id"));
  return (
    <div className="grid gap-4">
      <div className="adm-rise flex flex-col gap-2 sm:flex-row sm:items-center" style={{ ["--i" as string]: 3 }}>
        <SearchField value={query.get("q")} onCommit={(v) => query.set({ q: v })} placeholder="Name or phone" pending={query.pending} />
        <Select value={query.get("page_id") || "all"} onValueChange={(v) => query.set({ page_id: v === "all" ? null : v })}>
          <SelectTrigger className="h-9 max-w-60 rounded-full" aria-label="Filter by page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-80 rounded-xl">
            <SelectItem value="all">All pages</SelectItem>
            {pages.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground sm:ms-auto">Kept 30 days, then deleted automatically.</p>
      </div>

      {leads.items.length === 0 ? (
        <EmptyState
          illustration="leads"
          title={filtered ? "No abandoned checkouts match" : "No abandoned checkouts"}
          description={
            filtered
              ? "Try another name, phone or page."
              : "When someone types their phone number in an order form and leaves without ordering, they show up here so you can follow up."
          }
        />
      ) : (
        <div className={cn("grid gap-4 transition-opacity duration-300", query.pending && "opacity-60")}>
          <ul className="adm-surface adm-rise divide-y divide-border/60 overflow-hidden" style={{ ["--i" as string]: 4 }}>
            {leads.items.map((l, i) => (
              <li key={l.id} className="adm-fade flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-5" style={{ ["--i" as string]: Math.min(i, 12) }}>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="truncate font-medium">{l.name || "No name given"}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                    {fmtPhone(l.phone)}
                    <CopyButton value={l.phone} label="Copy phone" toastMessage="Phone copied" size="icon-xs" className="-my-1" />
                    {l.city && <span>· {l.city}</span>}
                  </span>
                  {l.selection && (
                    <span className="mt-1 flex min-w-0 items-start gap-1.5 text-xs">
                      <ShoppingBagIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <bdi className="line-clamp-2 min-w-0 font-medium text-foreground/80 [overflow-wrap:anywhere]" title={l.selection}>
                        {l.selection}
                      </bdi>
                    </span>
                  )}
                </div>
                <div className="grid min-w-0 gap-0.5 text-xs text-muted-foreground sm:w-56">
                  <span className="truncate">{l.pageName ?? "Deleted page"}</span>
                  <span className="truncate">
                    {l.bundleId ? `Pack ${l.bundleId}` : "No pack chosen"}
                    {l.utmSource ? ` · via ${l.utmSource}` : ""}
                  </span>
                </div>
                <RelativeTime iso={l.createdAt} className="w-24 text-xs text-muted-foreground sm:text-end" />
                <div className="flex gap-1.5">
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <a href={`tel:${l.phone}`}>
                      <PhoneIcon /> Call
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-full text-emerald-700 dark:text-emerald-400">
                    <a href={`https://wa.me/${l.phone.replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircleIcon /> WhatsApp
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pager page={leads.page} pageSize={leads.pageSize} total={leads.total} onPage={(p) => query.set({ page: p > 1 ? p : null }, { resetPage: false, scroll: true })} noun="checkouts" />
        </div>
      )}
    </div>
  );
}
