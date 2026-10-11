/**
 * POST /api/public/order — COD order from a live landing page or a connected export.
 * Body: OrderPayload JSON (application/json or text/plain, ≤ 16 KB) + optional "cf" Turnstile token.
 * Always answers OrderResponse JSON (also on errors); the sheet sync and the server-side Purchase
 * events (Meta Conversions API, TikTok Events API) run after the response.
 */
import type { NextRequest } from "next/server";
import { OrderPayload, type OrderResponse } from "@/lib/orders/contract";
import { sendConversionsAfterResponse } from "@/lib/orders/conversions";
import { createOrder, decoyResponse } from "@/lib/orders/create";
import {
  checkOrigin,
  clientContext,
  corsHeaders,
  exportOriginAllowed,
  json,
  logError,
  preflight,
  readJson,
  syncSheetAfterResponse,
} from "@/lib/orders/http";
import { resolvePageKey } from "@/lib/orders/resolve";
import { hashIp } from "@/lib/security/crypto";
import { rateLimit } from "@/lib/security/rate-limit";

type Failure = Extract<OrderResponse, { ok: false }>;
type FieldKey = keyof NonNullable<Failure["fields"]>;
const FIELD_KEYS = new Set<FieldKey>(["name", "phone", "city", "address", "email", "bundleId"]);

const STATUS: Record<Failure["error"], number> = {
  invalid: 422,
  duplicate: 409,
  rate_limited: 429,
  blocked: 403,
  unavailable: 404,
  server: 500,
};

export function OPTIONS(req: NextRequest): Promise<Response> {
  return preflight(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  const client = clientContext(req);
  // CORS for early answers: any active export's origin may read them
  let earlyCors: string | null = null;
  try {
    if (client.origin && (await exportOriginAllowed(client.origin))) earlyCors = client.origin;

    const coarse = await rateLimit(`api:order:${hashIp(client.ip)}`, 60, 600);
    if (!coarse.ok) {
      return json({ ok: false, error: "rate_limited" } satisfies OrderResponse, 429, {
        ...corsHeaders(earlyCors),
        "Retry-After": String(coarse.retryAfter),
      });
    }

    const body = await readJson(req, 16 * 1024);
    if (!body.ok || !body.value || typeof body.value !== "object" || Array.isArray(body.value)) {
      return json({ ok: false, error: "invalid" } satisfies OrderResponse, body.ok ? 400 : body.status, corsHeaders(earlyCors));
    }
    const raw = body.value as Record<string, unknown>;
    // honeypot & Turnstile token are taken out before schema validation
    const honeypot = typeof raw.website === "string" && raw.website.trim().length > 0;
    const captchaToken = typeof raw.cf === "string" ? raw.cf : null;
    const parsed = OrderPayload.safeParse({ ...raw, website: "" });
    if (!parsed.success && honeypot) {
      const key = typeof raw.pageKey === "string" ? raw.pageKey : "";
      const target = await resolvePageKey(key, "order");
      return json(decoyResponse(target?.doc ?? null, raw.bundleId), 200, corsHeaders(earlyCors));
    }
    if (!parsed.success) {
      const fields: Failure["fields"] = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && FIELD_KEYS.has(k as FieldKey)) fields[k as FieldKey] = "invalid";
      }
      const res: OrderResponse = Object.keys(fields).length ? { ok: false, error: "invalid", fields } : { ok: false, error: "invalid" };
      return json(res, 422, corsHeaders(earlyCors));
    }

    const target = await resolvePageKey(parsed.data.pageKey, "order");
    if (!target) return json({ ok: false, error: "unavailable" } satisfies OrderResponse, 404, corsHeaders(earlyCors));

    const verdict = checkOrigin(req, target.kind === "export" ? target.allowedOrigins : null);
    if (!verdict.ok) return json({ ok: false, error: "unavailable" } satisfies OrderResponse, 403, { Vary: "Origin" });
    const cors = corsHeaders(verdict.cors);

    const result = await createOrder(parsed.data, {
      ip: client.ip,
      ua: client.ua,
      target,
      captchaToken,
      noOrigin: verdict.noOrigin,
      honeypot,
    });
    if (result.sync) syncSheetAfterResponse("api/order:sync");
    sendConversionsAfterResponse(result.conversion);
    const status = result.response.ok ? 200 : STATUS[result.response.error];
    return json(result.response, status, {
      ...cors,
      ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {}),
    });
  } catch (err) {
    logError("api/order", err);
    return json({ ok: false, error: "server" } satisfies OrderResponse, 500, corsHeaders(earlyCors));
  }
}
