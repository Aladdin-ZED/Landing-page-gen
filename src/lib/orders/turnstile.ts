import "server-only";
/**
 * Optional Cloudflare Turnstile check for public order submissions.
 *
 * Enforcement rule: a missing token is only rejected when the page's published HTML actually embeds
 * the widget (site key present in the stored HTML). Pages published before Turnstile was configured
 * keep taking orders — flagged "captcha_missing" — until they are re-published.
 *
 * Connected exports cannot carry the widget, yet resolve to the same page, prices and pixels: they
 * must not become the way around the captcha. While Turnstile is configured, an export order without
 * a token is refused when it has no Origin header (an export always runs in a browser on another
 * origin, and browsers always send Origin on those POSTs — only scripts omit it), and otherwise comes
 * back "unprotected": stored, held for review and kept out of the server-side Purchase events
 * (risk.ts UNPROTECTED_MIN_SCORE).
 * A Cloudflare outage never blocks sales (token marked "unverified").
 */
import { getSetting } from "@/lib/settings";
import type { CaptchaState } from "./risk";
import { versionEmbedsSiteKey, type PageTarget } from "./resolve";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaOutcome = CaptchaState | "failed";

export async function verifyTurnstile(secret: string, token: string, ip: string): Promise<"ok" | "failed" | "unverified"> {
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip && ip !== "0.0.0.0" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return "unverified";
    const j = (await res.json().catch(() => ({}))) as { success?: boolean; "error-codes"?: string[] };
    if (j.success === true) return "ok";
    return (j["error-codes"] ?? []).includes("internal-error") ? "unverified" : "failed";
  } catch {
    return "unverified";
  }
}

export async function checkCaptcha(
  target: PageTarget,
  token: string | null | undefined,
  ip: string,
  opts: { noOrigin?: boolean } = {},
): Promise<CaptchaOutcome> {
  const cfg = await getSetting("turnstile");
  if (!cfg.secretKey || !cfg.siteKey) return "off";
  const t = typeof token === "string" ? token.trim() : "";
  if (!t || t.length > 2048) {
    if (target.kind === "export") return opts.noOrigin ? "failed" : "unprotected";
    return (await versionEmbedsSiteKey(target.versionId, cfg.siteKey)) ? "failed" : "missing";
  }
  return verifyTurnstile(cfg.secretKey, t, ip);
}
