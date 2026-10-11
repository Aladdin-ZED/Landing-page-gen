import "server-only";
/**
 * Command palette search: pages (name / slug) and, for roles that can read orders, orders
 * (id, customer name or phone in any format). Small, fast LIKE queries — never more than 6 hits each.
 */
import { desc, eq, like, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, pages } from "@/lib/db/schema";
import { toAsciiDigits } from "@/lib/markets/phone";

export interface SearchHit {
  kind: "page" | "order";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

export async function searchAdmin(q: string, opts: { pages: boolean; orders: boolean }): Promise<SearchHit[]> {
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  const pattern = `%${likeEscape(term)}%`;
  const digits = toAsciiDigits(term).replace(/[^0-9]/g, "").replace(/^0+/, "");

  const [pageRows, orderRows] = await Promise.all([
    opts.pages
      ? db
          .select({ id: pages.id, name: pages.name, slug: pages.slug, status: pages.status })
          .from(pages)
          .where(or(like(pages.name, pattern), like(pages.slug, `%${likeEscape(term.toLowerCase())}%`)))
          .orderBy(desc(pages.updatedAt))
          .limit(6)
      : Promise.resolve([]),
    opts.orders
      ? db
          .select({ id: orders.id, name: orders.name, city: orders.city, productName: orders.productName })
          .from(orders)
          .where(
            or(
              eq(orders.id, term.toUpperCase()),
              like(orders.id, `%${likeEscape(term.toUpperCase())}%`),
              like(orders.name, pattern),
              ...(digits.length >= 4 ? [like(orders.phone, `%${digits}%`)] : []),
            ),
          )
          .orderBy(desc(orders.createdAt))
          .limit(6)
      : Promise.resolve([]),
  ]);

  return [
    ...pageRows.map(
      (p): SearchHit => ({
        kind: "page",
        id: p.id,
        title: p.name,
        subtitle: `/${p.slug} · ${p.status}`,
        // archived pages only show under the Archived filter
        href: `/admin/pages?focus=${p.id}${p.status === "archived" ? "&status=archived" : ""}`,
      }),
    ),
    ...orderRows.map(
      (o): SearchHit => ({
        kind: "order",
        id: o.id,
        title: `${o.id} · ${o.name}`,
        subtitle: [o.productName, o.city].filter(Boolean).join(" · "),
        href: `/admin/orders?order=${encodeURIComponent(o.id)}`,
      }),
    ),
  ];
}
