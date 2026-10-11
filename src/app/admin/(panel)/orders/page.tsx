import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { Screen } from "@/components/admin/common/screen";
import { OrdersView, type OrdersTab } from "@/components/admin/orders/orders-view";
import { parseOrderQuery, rangeBounds, statusCounts, tabCounts, toBlockRow, toLeadRow, toOrderFilters, toOrderRow } from "@/lib/admin-data/orders";
import { pageOptions } from "@/lib/admin-data/pages";
import { redirectPastLastPage } from "@/lib/admin-data/paging";
import { can, requireUser } from "@/lib/auth";
import { listBlocklist, listLeads, listOrders } from "@/lib/orders";
import { getSheetsConfig } from "@/lib/sheets";
import {
  blockFromOrderAction,
  blockPhoneAction,
  getOrderAction,
  resendToSheetAction,
  retryFailedSyncAction,
  unblockAction,
  updateOrderStatusAction,
} from "./actions";

export const metadata: Metadata = { title: "Orders" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE_SIZE = 40;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser({ permission: "orders.read" });
  const sp = await searchParams;
  const tabParam = one(sp.tab);
  const tab: OrdersTab = tabParam === "leads" || tabParam === "blocked" ? tabParam : "orders";
  const query = parseOrderQuery(sp);

  const [counts, byStatus, pages, sheet, orders, leads, blocked] = await Promise.all([
    tabCounts(),
    tab === "orders" ? statusCounts(query) : Promise.resolve({ all: 0 }),
    pageOptions({ includeArchived: true }),
    getSheetsConfig(),
    tab === "orders" ? listOrders(toOrderFilters(query), { page: query.page, pageSize: PAGE_SIZE }) : Promise.resolve(null),
    tab === "leads"
      ? listLeads({ q: query.q || undefined, pageId: query.pageId ?? undefined, ...rangeBounds(query) }, { page: query.page, pageSize: PAGE_SIZE })
      : Promise.resolve(null),
    tab === "blocked" ? listBlocklist({ page: query.page, pageSize: PAGE_SIZE }) : Promise.resolve(null),
  ]);
  const list = orders ?? leads ?? blocked;
  if (list) redirectPastLastPage("/admin/orders", sp, list);

  return (
    <Screen wide>
      <PageHeader
        title="Orders"
        description="Cash-on-delivery orders from every page and exported site. Statuses stay in sync with your Google Sheet."
      />
      <OrdersView
        tab={tab}
        query={query}
        tabCounts={counts}
        statusCounts={byStatus}
        orders={orders && { ...orders, items: orders.items.map(toOrderRow) }}
        leads={leads && { ...leads, items: leads.items.map(toLeadRow) }}
        blocked={blocked && { ...blocked, items: blocked.items.map(toBlockRow) }}
        pages={pages.map((p) => ({ id: p.id, name: p.name }))}
        canWrite={can(user.role, "orders.write")}
        sheetConnected={!!sheet?.enabled}
        actions={{
          get: getOrderAction,
          setStatus: updateOrderStatusAction,
          resend: resendToSheetAction,
          block: blockFromOrderAction,
          blockPhone: blockPhoneAction,
          unblock: unblockAction,
          retryFailed: retryFailedSyncAction,
        }}
      />
    </Screen>
  );
}
