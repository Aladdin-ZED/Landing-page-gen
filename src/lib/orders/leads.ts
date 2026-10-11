import "server-only";
/**
 * Abandoned-lead capture: the runtime posts the form state once the phone looks valid. One row per
 * idempotency key (= the order's idem), updated while the visitor keeps typing, marked converted
 * when the order arrives. Invalid phones and throttled clients are ignored silently.
 */
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import { leads, orders } from "@/lib/db/schema";
import { findCity, getMarket } from "@/lib/markets";
import { normalizePhone } from "@/lib/markets/phone";
import { hashIp } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";
import type { LeadPayload } from "./contract";
import { resolvePageKey, type PageTarget } from "./resolve";
import { cleanInput, validName } from "./validate";

type Lead = z.output<typeof LeadPayload>;

export async function upsertLead(payload: Lead, ctx: { ip: string; target?: PageTarget }): Promise<{ stored: boolean }> {
  const target = ctx.target ?? (await resolvePageKey(payload.pageKey, "order"));
  if (!target) return { stored: false };
  const gate = await rateLimit(`lead:ip:${hashIp(ctx.ip)}`, 30, 600);
  if (!gate.ok) return { stored: false };

  const { doc } = target;
  const phone = normalizePhone(payload.phone, doc.form.phoneCountry);
  if (!phone) return { stored: false };

  const [converted] = await db.select({ id: orders.id }).from(orders).where(eq(orders.idem, payload.idem)).limit(1);
  if (converted) return { stored: false };

  const name = payload.name ? validName(payload.name) : null;
  const cityInput = cleanInput(payload.city, 80);
  const market = getMarket(doc.market);
  const city = cityInput ? (market.cities ? (findCity(market.code, cityInput)?.value ?? null) : cityInput) : null;
  const bundleId = payload.bundleId && doc.offers.bundles.some((b) => b.id === payload.bundleId) ? payload.bundleId : null;
  const utm = Object.fromEntries(Object.entries(payload.utm).filter(([, v]) => typeof v === "string" && v));

  // only the original page's unconverted lead may be updated through its idem
  const own = sql`\`page_id\` = ${target.pageId} AND \`converted_order_id\` IS NULL`;
  await db
    .insert(leads)
    .values({
      id: newId(),
      pageId: target.pageId,
      idem: payload.idem,
      phone: phone.e164,
      name,
      city,
      bundleId,
      utm: Object.keys(utm).length ? utm : null,
      createdAt: new Date(),
    })
    .onDuplicateKeyUpdate({
      set: {
        phone: sql`IF(${own}, VALUES(\`phone\`), \`phone\`)`,
        name: sql`IF(${own}, COALESCE(VALUES(\`name\`), \`name\`), \`name\`)`,
        city: sql`IF(${own}, COALESCE(VALUES(\`city\`), \`city\`), \`city\`)`,
        bundleId: sql`IF(${own}, COALESCE(VALUES(\`bundle_id\`), \`bundle_id\`), \`bundle_id\`)`,
      },
    });
  return { stored: true };
}
