/**
 * Same-origin enforcement for admin route handlers that change state.
 * (Server Actions already get Next's built-in Origin/Host check.)
 *
 * A request passes when the browser says it is same-origin:
 *  - `Sec-Fetch-Site`, when present, must be "same-origin", and
 *  - `Origin`, when present, must match the request host (Host / X-Forwarded-Host) or PUBLIC_URL.
 * At least one of the two signals must be present — modern browsers always send them on
 * non-GET fetches, so their absence means a non-browser client, which the admin API rejects.
 * Cross-site pages cannot forge these headers (forms can't set them; fetch would need a CORS preflight).
 *
 * With ADMIN_HOST set, `Origin` must be that host and nothing else. The public pages run third-party
 * scripts, and their host is same-site with an admin subdomain, so it must not count as "us".
 */
import { adminHost } from "@/lib/auth/config";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class CsrfError extends Error {
  readonly status = 403;
  constructor(message = "Cross-site request rejected") {
    super(message);
    this.name = "CsrfError";
  }
}

function allowedHosts(headers: Headers): Set<string> {
  const dedicated = adminHost();
  if (dedicated) return new Set([dedicated]);
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    const first = value?.split(",")[0]?.trim().toLowerCase();
    if (first) hosts.add(first);
  };
  add(headers.get("x-forwarded-host"));
  add(headers.get("host"));
  const publicUrl = process.env.PUBLIC_URL;
  if (publicUrl) {
    try {
      add(new URL(publicUrl).host);
    } catch {
      // ignore malformed PUBLIC_URL — host headers still apply
    }
  }
  return hosts;
}

export function checkSameOrigin(req: Request): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

  const site = req.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin") return false;

  const origin = req.headers.get("origin");
  if (origin === null) return site === "same-origin";
  if (origin === "null") return false;

  let originHost: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    originHost = parsed.host.toLowerCase();
  } catch {
    return false;
  }
  return allowedHosts(req.headers).has(originHost);
}

/** Throws CsrfError (status 403) unless the request is same-origin. Call first in admin POST/PUT/PATCH/DELETE handlers. */
export function assertSameOrigin(req: Request): void {
  if (!checkSameOrigin(req)) throw new CsrfError();
}
