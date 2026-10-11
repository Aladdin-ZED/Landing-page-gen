"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { EmptyState } from "../common/empty-state";
import { Segmented } from "../common/segmented";
import { int, money, percent } from "../lib/format";
import type { Metric, Point } from "./orders-chart-plot";

// recharts is code-split: server-rendered as before, hydrated once its chunk is in
const OrdersPlot = dynamic(() => import("./orders-chart-plot").then((m) => m.OrdersPlot), {
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-muted/60 motion-reduce:animate-none" aria-hidden="true" />,
});

/** 30-day area chart with a metric switch; soft brand gradient, hairline grid, glass tooltip. */
export function OrdersChart({ series, currency }: { series: Point[]; currency: string }) {
  const [metric, setMetric] = useState<Metric>("orders");
  const totals = useMemo(
    () => series.reduce((a, p) => ({ orders: a.orders + p.orders, revenue: a.revenue + p.revenue, uniques: a.uniques + p.uniques }), { orders: 0, revenue: 0, uniques: 0 }),
    [series],
  );
  const empty = totals.orders === 0 && totals.uniques === 0;
  const fmt = (n: number) => (metric === "revenue" ? money(n, currency) : int(n));
  const conversion = totals.uniques ? totals.orders / totals.uniques : 0;

  return (
    <section className="adm-surface adm-rise flex flex-col gap-5 p-5 sm:p-6" style={{ ["--i" as string]: 4 }} aria-label="Last 30 days">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-[0.95rem] font-semibold">Last 30 days</h2>
          <p className="text-sm text-muted-foreground">
            {int(totals.orders)} orders · {money(totals.revenue, currency)} · {percent(conversion)} conversion
          </p>
        </div>
        <Segmented
          label="Chart metric"
          size="sm"
          value={metric}
          onChange={setMetric}
          options={[
            { value: "orders", label: "Orders" },
            { value: "revenue", label: "Revenue" },
            { value: "uniques", label: "Visitors" },
          ]}
        />
      </div>
      {empty ? (
        <EmptyState compact illustration="chart" title="No traffic yet" description="Publish a page and share its link. Visits and orders draw here, day by day." className="min-h-64" />
      ) : (
        <OrdersPlot series={series} metric={metric} currency={currency} />
      )}
      <p className="sr-only">Values shown: {fmt(totals[metric])} in total.</p>
    </section>
  );
}
