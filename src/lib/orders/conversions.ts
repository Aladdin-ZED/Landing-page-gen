import "server-only";
/**
 * Server-side Purchase events for new orders: Meta Conversions API and TikTok Events API.
 *
 *   createOrder() → purchaseConversion(...)  (only fresh, non-honeypot, plausible orders)
 *   route handler → sendConversionsAfterResponse(conversion)   (after the response, never blocks)
 *
 * Every pixel of the PUBLISHED page (up to 3 Meta, 3 TikTok) that has a server token in Settings →
 * Pixels (tracking_secrets, AES-GCM at rest; a token per pixel id) gets one event, carrying the order
 * id as event id — the id the thank-you page's browser pixel sends with the same event name — so each
 * platform counts the order once. Pixels without a token stay browser-only. Failures are logged (no
 * PII, no token) and never touch the order. The pure parts (event, hashing, request bodies,
 * transport, test sends) live in ./conversions-core.
 */
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/lib/db/client";
import { pages } from "@/lib/db/schema";
import { getSetting, type SettingValue } from "@/lib/settings";
import { dispatchPurchase, type PurchaseConversion } from "./conversions-core";

export {
  CONVERSION_MAX_RISK,
  META_GRAPH_API_VERSION,
  META_PURCHASE_EVENT,
  TIKTOK_EVENTS_URL,
  TIKTOK_PURCHASE_EVENT,
  purchaseConversion,
  serverCredentials,
  type PurchaseConversion,
} from "./conversions-core";

const LOG = "[conversions]";

/** PUBLIC_URL origin (same rule as the renderer's publicOrigin()). */
export function siteOrigin(): string | null {
  const raw = process.env.PUBLIC_URL;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** The landing URL when the order did not report one (live pages only; exports live elsewhere). */
async function fallbackUrl(c: PurchaseConversion): Promise<string | null> {
  if (c.source !== "live") return null;
  const origin = siteOrigin();
  if (!origin) return null;
  const [row] = await db.select({ slug: pages.slug }).from(pages).where(eq(pages.id, c.pageId)).limit(1);
  return row ? `${origin}/${row.slug}` : null;
}

/**
 * Send the order's Purchase to every configured pixel. Never throws. `secrets` defaults to
 * Settings → Pixels (pass them when already loaded).
 */
export async function sendPurchaseConversions(c: PurchaseConversion, opts: { secrets?: SettingValue<"tracking_secrets"> } = {}): Promise<void> {
  try {
    const secrets = opts.secrets ?? (await getSetting("tracking_secrets"));
    const event: PurchaseConversion = c.sourceUrl ? c : { ...c, sourceUrl: await fallbackUrl(c).catch(() => null) };
    const results = await dispatchPurchase(event, secrets);
    for (const r of results) {
      if (!r.ok) console.error(`${LOG} ${r.platform} purchase for order ${c.orderId} (pixel …${r.pixelId.slice(-4)}) failed: ${r.detail ?? "unknown error"}`);
    }
  } catch (err) {
    console.error(`${LOG} order ${c.orderId}:`, err instanceof Error ? `${err.name}: ${err.message}` : "unknown error");
  }
}

/**
 * Queue the Purchase events to run once the response is sent (Next after()). Never throws and
 * never delays the shopper's confirmation.
 */
export function sendConversionsAfterResponse(c: PurchaseConversion | null | undefined): void {
  if (!c) return;
  try {
    after(() => sendPurchaseConversions(c));
  } catch (err) {
    console.error(`${LOG} could not schedule order ${c.orderId}:`, err instanceof Error ? err.message : "unknown error");
  }
}
