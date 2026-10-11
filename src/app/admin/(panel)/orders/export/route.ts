/**
 * GET /admin/orders/export?<same filters as the Orders screen> — streamed CSV (UTF-8 BOM, Excel
 * friendly, formula-injection safe). Agents and editors with orders.read can download it.
 */
import type { NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { AuthError, getRequestContext, requireUser } from "@/lib/auth";
import { dayKey } from "@/lib/admin-data/time";
import { parseOrderQuery, toOrderFilters } from "@/lib/admin-data/orders";
import { ordersCsv } from "@/lib/orders";
import { apiHeaders } from "@/lib/orders/http";

export async function GET(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    userId = (await requireUser({ permission: "orders.read", throwOnFail: true })).id;
  } catch (err) {
    if (err instanceof AuthError) return new Response(null, { status: err.status, headers: apiHeaders() });
    throw err;
  }
  const query = parseOrderQuery(Object.fromEntries(req.nextUrl.searchParams));
  const filters = toOrderFilters(query);
  const { ip } = await getRequestContext();
  await audit("orders.exported", { userId, meta: { status: query.status, range: query.range, page: query.pageId, q: !!query.q }, ip });

  const headers = apiHeaders({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="orders-${dayKey()}.csv"`,
  });
  return new Response(ordersCsv(filters), { status: 200, headers });
}
