"use client";

import { GiftIcon, PhoneCallIcon, SheetIcon } from "lucide-react";
import type { OrderDetailJson } from "@/lib/admin-data/orders";
import { cn } from "@/lib/utils";
import { CopyButton } from "../common/copy-button";
import { StatusChip } from "../common/status-chip";
import { money } from "../lib/format";
import type { Tone } from "../lib/status";
import type { OrderPart, PartKind } from "./parts";

/**
 * What the order contains (docs/OFFERS.md §G.4 "Admin"): one row per group of identical pieces — the
 * item name in bold, option chips with swatch dots and the warehouse code in small type, typed values
 * in « », badges Free / Add-on / Upsell — then the gift and the order-level choices, the exact text
 * the Sheet gets, and the money block with one row per surcharge.
 */
export function OrderContents({ order }: { order: OrderDetailJson }) {
  const { view, items, currency } = order;
  // v1 rows store no offer price: the subtotal without the bump and the upsell is that price
  const packPrice = items.price ?? order.subtotal - (items.bump?.price ?? 0) - (items.upsell?.price ?? 0);
  // a SKU per row only tells something when the rows differ (one-product pages repeat the same one)
  const showSku = new Set(view.parts.map((p) => p.sku).filter(Boolean)).size > 1;
  const hasContents = view.parts.some((p) => p.item || p.options.length || p.fields.length || p.kind !== "unit") || !!view.gift || view.extras.length > 0;
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid min-w-0 gap-0.5">
        <span className="font-medium [overflow-wrap:anywhere]">{order.productName}</span>
        <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {items.bundleLabel}
          <span aria-hidden="true"> · </span>
          {view.pieces} piece{view.pieces === 1 ? "" : "s"}
        </span>
      </div>

      {hasContents && (
        <div className="overflow-hidden rounded-xl bg-foreground/[0.025] ring-1 ring-border/60 ring-inset">
          <ul className="divide-y divide-border/60">
            {view.parts.map((p, i) => (
              <PartRow key={i} part={p} currency={currency} showSku={showSku} />
            ))}
            {view.gift && (
              <li className="flex items-center gap-3 px-3 py-2.5">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 ring-1 ring-violet-500/20 ring-inset dark:text-violet-300">
                  <GiftIcon className="size-3.5" />
                </span>
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Gift with the pack</span>
                  <bdi className="text-sm font-medium [overflow-wrap:anywhere]">{view.gift}</bdi>
                </span>
              </li>
            )}
          </ul>
          {view.extras.length > 0 && (
            <dl className="grid grid-cols-1 gap-2 border-t border-border/60 bg-background/60 px-3 py-2.5 text-sm">
              {view.extras.map((x, i) =>
                x.typed ? (
                  // a typed message: the label above, the words in full below (never squeezed into a column)
                  <div key={i} className="grid gap-0.5">
                    <dt className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                      <span className="min-w-0 [overflow-wrap:anywhere]">{x.name}</span>
                      {x.delta ? <span className="shrink-0 tabular-nums">+{money(x.delta, currency)}</span> : null}
                    </dt>
                    <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">
                      <bdi>« {x.value} »</bdi>
                    </dd>
                  </div>
                ) : (
                  <div key={i} className="flex items-baseline justify-between gap-3">
                    <dt className="min-w-0 text-muted-foreground [overflow-wrap:anywhere]">{x.name}</dt>
                    <dd className="flex shrink-0 items-baseline gap-2 text-end">
                      <bdi className="font-medium">{x.value}</bdi>
                      {x.delta ? <span className="text-xs text-muted-foreground tabular-nums">+{money(x.delta, currency)}</span> : null}
                    </dd>
                  </div>
                ),
              )}
            </dl>
          )}
        </div>
      )}

      {order.warehouseText && (
        <div className="grid gap-1.5 rounded-xl px-3 py-2.5 ring-1 ring-border/60 ring-inset">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
              <SheetIcon className="size-3" /> Variante in Google Sheets
            </span>
            <CopyButton value={order.warehouseText} label="Copy the Variante text" toastMessage="Variante copied" size="icon-xs" className="-my-1 -me-1" />
          </div>
          <bdi className="font-mono text-[0.78rem] leading-relaxed text-foreground/85 [overflow-wrap:anywhere]">{order.warehouseText}</bdi>
        </div>
      )}

      <dl className="grid grid-cols-1 gap-1.5 border-t border-border/60 pt-3 text-sm">
        <MoneyLine label="Pack price" value={money(packPrice, currency)} />
        {items.reasons.map((r, i) => (
          <MoneyLine key={i} label={`+ ${r.label}${r.count > 1 ? ` ×${r.count}` : ""}`} value={money(r.amount, currency)} soft />
        ))}
        {items.bump && <MoneyLine label={`+ ${items.bump.title}`} value={money(items.bump.price, currency)} soft />}
        {items.upsell && <MoneyLine label={`+ ${items.upsell.title} (after order)`} value={money(items.upsell.price, currency)} soft />}
        <MoneyLine label="Delivery" value={order.shipping ? money(order.shipping, currency) : "Free"} />
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border/60 pt-2">
          <dt className="min-w-0 font-medium">Total to collect</dt>
          <dd className="shrink-0 text-lg font-semibold tabular-nums">{money(order.total, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}

const BADGE: Record<Exclude<PartKind, "unit">, { label: string; tone: Tone }> = {
  free: { label: "Free", tone: "emerald" },
  bump: { label: "Add-on", tone: "teal" },
  upsell: { label: "Upsell", tone: "blue" },
};

function PartRow({ part, currency, showSku }: { part: OrderPart; currency: string; showSku: boolean }) {
  const badge = part.kind === "unit" ? null : BADGE[part.kind];
  // single-item pages: the options say what the piece is (no item name)
  const title = part.item || (part.options.length ? null : "Piece");
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 px-3 py-2.5">
      <span
        className={cn(
          "mt-px inline-flex h-6 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
          part.kind === "free" ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300" : "bg-background text-foreground ring-border/70",
        )}
        aria-label={`${part.count} piece${part.count === 1 ? "" : "s"}`}
      >
        {part.count}×
      </span>
      <div className="grid min-w-0 gap-1.5">
        {(title || badge || part.price !== undefined) && (
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
            {title ? <bdi className="min-w-0 font-semibold [overflow-wrap:anywhere]">{title}</bdi> : <span />}
            <span className="flex shrink-0 items-center gap-1.5">
              {part.price !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{money(part.price, currency)}</span>}
              {badge && (
                <StatusChip tone={badge.tone} dot={false} className="h-5 px-2 text-[0.68rem]">
                  {badge.label}
                </StatusChip>
              )}
            </span>
          </div>
        )}
        {part.options.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {part.options.map((o, i) => (
              <span key={i} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-border/70 ring-inset">
                {o.swatch && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/15 ring-inset" style={{ backgroundColor: o.swatch }} />}
                <span className="shrink-0 text-muted-foreground">{o.name}</span>
                <bdi className="min-w-0 font-medium text-foreground [overflow-wrap:anywhere]">{o.value}</bdi>
                {o.code && <span className="shrink-0 font-mono text-[0.65rem] text-muted-foreground/90">{o.code}</span>}
                {o.delta ? <span className="shrink-0 text-[0.68rem] text-muted-foreground tabular-nums">+{money(o.delta, currency)}</span> : null}
              </span>
            ))}
          </div>
        )}
        {part.fields.map((f, i) => (
          <p key={i} className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-xs">
            <span className="text-muted-foreground">{f.name}</span>
            <bdi className="min-w-0 font-medium [overflow-wrap:anywhere]">« {f.value} »</bdi>
            {f.delta ? <span className="text-[0.68rem] text-muted-foreground tabular-nums">+{money(f.delta, currency)}</span> : null}
          </p>
        ))}
        {part.confirm && (
          <p className="flex items-center gap-1.5 text-xs text-warn-ink">
            <PhoneCallIcon className="size-3.5 shrink-0" /> Options to confirm on the call
          </p>
        )}
        {showSku && part.sku && <span className="font-mono text-[0.68rem] text-muted-foreground">SKU {part.sku}</span>}
      </div>
    </li>
  );
}

function MoneyLine({ label, value, soft }: { label: string; value: string; soft?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-muted-foreground" title={label}>
        {label}
      </dt>
      <dd className={cn("shrink-0 text-end tabular-nums", soft && "text-foreground/80")}>{value}</dd>
    </div>
  );
}
