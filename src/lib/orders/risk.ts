/**
 * Fake-order risk score (0–100) with explainable flags. Scores never block an order on their own
 * (except the honeypot, handled by the caller); they help the call center prioritise and are shown
 * in the admin and as "[À vérifier]" in the sheet from 50 upwards.
 */

/**
 * "unprotected": Turnstile is configured, but the order came through a channel that cannot carry a
 * token (a connected export) — the captcha the seller turned on did not run for it.
 */
export type CaptchaState = "off" | "ok" | "missing" | "unverified" | "unprotected";

/**
 * Minimum score of an "unprotected" order: at least CONVERSION_MAX_RISK (./conversions), so it shows
 * as "[À vérifier]" and sends no server-side Purchase event — bots cannot skip the captcha through an
 * export and still poison the ad platforms.
 */
export const UNPROTECTED_MIN_SCORE = 70;

export interface RiskInput {
  honeypot: boolean;
  /** ms between first form interaction and submit */
  t: number;
  ua: string | null;
  captcha: CaptchaState;
  /** request carried no Origin header (non-browser client) */
  noOrigin: boolean;
  /** orders from the same IP hash on the same page in the last 24 h */
  ipOrders24h: number;
  /** previous orders of this phone that ended fake / returned / cancelled */
  badHistory: number;
  /** previous delivered orders of this phone */
  delivered: number;
  /** the page took an unusual burst of orders (see createOrder) — a signal, never a reason to refuse */
  pageBurst?: boolean;
  /** same phone, same page, within the duplicate window, from another network */
  duplicate?: boolean;
}

const BOT_UA = /bot|crawl|spider|curl|wget|python|httpclient|okhttp|java\/|go-http|axios|node-fetch|headless|phantom|selenium|puppeteer|playwright/i;

export function scoreRisk(i: RiskInput): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 0;
  const add = (flag: string, pts: number) => {
    flags.push(flag);
    score += pts;
  };
  if (i.honeypot) add("honeypot", 100);
  if (i.t < 2500) add("too_fast", 35);
  else if (i.t < 6000) add("fast", 10);
  if (!i.ua) add("no_ua", 20);
  else if (BOT_UA.test(i.ua)) add("bot_ua", 40);
  if (i.captcha === "missing" || i.captcha === "unprotected") add("captcha_missing", 20);
  if (i.captcha === "unverified") add("captcha_unverified", 10);
  if (i.noOrigin) add("no_origin", 15);
  if (i.ipOrders24h >= 3) add("ip_repeat", Math.min(30, 10 * (i.ipOrders24h - 2)));
  if (i.badHistory > 0) add("history_bad", Math.min(45, 15 * i.badHistory));
  if (i.pageBurst) add("page_burst", 30);
  if (i.duplicate) add("duplicate", 40);
  if (i.delivered > 0) {
    flags.push("returning_customer");
    score -= Math.min(30, 15 * i.delivered);
  }
  if (i.captcha === "unprotected") score = Math.max(score, UNPROTECTED_MIN_SCORE);
  return { score: Math.max(0, Math.min(100, Math.round(score))), flags };
}
