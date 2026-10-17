"use client";
/**
 * "Prices & warehouse codes" of an option list (a choice group's options or a matrix dimension's
 * values), collapsed by default (docs/OFFERS.md §D.5 Advanced): an optional "+ price" per option
 * ("XL +20", never negative: discounts belong to offers) and a Latin warehouse code that Sheets,
 * CSV and order.php print instead of the label ("NR" for "نوار").
 */
import { useId } from "react";
import { feature } from "@/lib/page/features";
import { WAREHOUSE_CODE_RE, type Choice } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { DraftInput, Disclosure, MoneyInput } from "./parts";

export function OptionExtras({ options, onChange, currency, dir }: { options: readonly Choice[]; onChange: (index: number, next: Choice, coalesce?: string | null) => void; currency?: string; dir: "ltr" | "rtl"; groupId?: string }) {
  const deltas = feature("PRICE_DELTAS");
  const priced = options.filter((o) => (o.delta ?? 0) > 0).length;
  const coded = options.filter((o) => o.code).length;
  const summary = [priced ? `${priced} with a price` : null, coded ? `${coded} coded` : null].filter(Boolean).join(" · ") || "None";
  const head = useId();
  return (
    <Disclosure title={deltas ? "Prices & warehouse codes" : "Warehouse codes"} summary={summary}>
      <div role="table" aria-labelledby={head} className="grid gap-1 rounded-xl bg-foreground/[0.025] p-2 ring-1 ring-inset ring-foreground/[0.05]">
        <div role="row" id={head} className={cn("grid items-center gap-2 px-1 text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground uppercase", deltas ? "grid-cols-[minmax(0,1fr)_6.5rem_5.5rem]" : "grid-cols-[minmax(0,1fr)_6rem]")}>
          <span role="columnheader">Option</span>
          {deltas ? <span role="columnheader">Adds</span> : null}
          <span role="columnheader">Code</span>
        </div>
        {options.map((o, i) => (
          <div key={o.id} role="row" className={cn("grid items-center gap-2", deltas ? "grid-cols-[minmax(0,1fr)_6.5rem_5.5rem]" : "grid-cols-[minmax(0,1fr)_6rem]")}>
            <bdi role="cell" dir={dir} className={cn("min-w-0 truncate px-1 text-[12.5px]", o.soldOut && "text-muted-foreground line-through")}>
              {o.label}
            </bdi>
            {deltas ? (
              <span role="cell">
                <MoneyInput
                  value={o.delta}
                  optional
                  placeholder="+0"
                  max={100_000}
                  currency={currency}
                  ariaLabel={`${o.label}: price difference`}
                  onCommit={(v) => {
                    const next = { ...o };
                    if (v && v > 0) next.delta = v;
                    else delete next.delta;
                    onChange(i, next, `opt:${o.id}:delta`);
                  }}
                />
              </span>
            ) : null}
            <span role="cell">
              <DraftInput
                value={o.code ?? ""}
                maxLength={20}
                dir="ltr"
                spellCheck={false}
                placeholder="—"
                aria-label={`${o.label}: warehouse code`}
                clean={(raw) => {
                  const v = raw.trim();
                  return v === "" || WAREHOUSE_CODE_RE.test(v) ? v : null;
                }}
                onCommit={(v) => {
                  const next = { ...o };
                  if (v) next.code = v;
                  else delete next.code;
                  onChange(i, next, `opt:${o.id}:code`);
                }}
                className="h-8 font-mono text-[12px] uppercase"
              />
            </span>
          </div>
        ))}
        <p className="px-1 pt-1 text-[11px] leading-snug text-muted-foreground">
          {deltas ? "A price difference is added per piece and shown on the chip (“+20”). " : ""}Codes use Latin letters, digits, spaces, dots and dashes; the warehouse sheet prints them instead of the name.
        </p>
      </div>
    </Disclosure>
  );
}
