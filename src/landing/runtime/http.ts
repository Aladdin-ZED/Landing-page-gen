/**
 * Network helpers: JSON POST with timeout + retry on network failure (same idempotency key, so a
 * retry can never create a second order), fire-and-forget keepalive POST, analytics beacon.
 */
import type { W } from "./core";

export interface HttpResult<T> {
  status: number;
  /** parsed JSON body, or null when the body is empty / not JSON */
  data: T | null;
}

function once<T>(win: W, url: string, body: string, timeout: number): Promise<HttpResult<T>> {
  const ctl = typeof win.AbortController === "function" ? new win.AbortController() : null;
  return new Promise<HttpResult<T>>((resolve, reject) => {
    const timer = win.setTimeout(() => {
      if (ctl) ctl.abort();
      reject(new Error("timeout"));
    }, timeout);
    win
      .fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        credentials: "same-origin",
        cache: "no-store",
        signal: ctl ? ctl.signal : undefined,
      })
      .then((r) =>
        r.text().then((t) => {
          let data: T | null = null;
          try {
            data = t ? (JSON.parse(t) as T) : null;
          } catch {
            data = null;
          }
          resolve({ status: r.status, data });
        }),
      )
      .catch(reject)
      .then(() => win.clearTimeout(timer));
  });
}

/** Rejects only on network failure/timeout (after `retries` extra attempts); HTTP errors resolve. */
export function postJson<T>(win: W, url: string, payload: unknown, timeout: number, retries: number): Promise<HttpResult<T>> {
  const body = JSON.stringify(payload);
  const attempt = (n: number): Promise<HttpResult<T>> =>
    once<T>(win, url, body, timeout).catch((e: unknown) =>
      n < retries ? new Promise<void>((r) => win.setTimeout(r, 700)).then(() => attempt(n + 1)) : Promise.reject(e),
    );
  return attempt(0);
}

/** Fire-and-forget JSON POST that survives page unload. */
export function keepalivePost(win: W, url: string, payload: unknown): void {
  try {
    win
      .fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
        keepalive: true,
      })
      .catch(() => undefined);
  } catch {
    /* fetch unavailable */
  }
}

/** navigator.sendBeacon with a text/plain JSON body (no CORS preflight); fetch keepalive fallback. */
export function beacon(win: W, url: string, payload: unknown): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof win.navigator.sendBeacon === "function" && win.navigator.sendBeacon(url, body)) return;
  } catch {
    /* fall through */
  }
  try {
    win
      .fetch(url, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=UTF-8" },
        body,
        credentials: "same-origin",
        keepalive: true,
      })
      .catch(() => undefined);
  } catch {
    /* fetch unavailable */
  }
}
