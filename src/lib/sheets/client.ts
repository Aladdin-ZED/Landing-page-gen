import "server-only";
/**
 * Zero-dependency Google Sheets client: service account (env GOOGLE_SA_JSON_B64, the downloaded JSON key
 * base64-encoded on one line) → RS256 JWT signed with node:crypto → OAuth access token (cached, refreshed
 * 5 min early, concurrent callers share one in-flight request) → JSON API calls with timeout, 401 refresh,
 * and truncated exponential backoff (+ Retry-After) on 429/5xx/network errors.
 */
import { createSign } from "node:crypto";
import { z } from "zod";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

const ServiceAccountJson = z.object({
  client_email: z.string().email().max(254),
  private_key: z.string().min(100).max(20_000).includes("PRIVATE KEY"),
  private_key_id: z.string().max(200).optional(),
});
export type ServiceAccount = z.infer<typeof ServiceAccountJson>;

/** HTTP-level failure from Google (status 0 = network / timeout). */
export class SheetsError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(`${status} ${reason}: ${message}`);
    this.name = "SheetsError";
  }
}

/** Local misconfiguration (missing / unreadable service-account key). */
export class SheetsConfigError extends Error {
  constructor(readonly code: "not_configured" | "invalid_key") {
    super(code === "not_configured" ? "GOOGLE_SA_JSON_B64 is not set" : "GOOGLE_SA_JSON_B64 is not a valid service-account key");
    this.name = "SheetsConfigError";
  }
}

let saCache: { raw: string; sa: ServiceAccount } | null = null;

export function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SA_JSON_B64?.trim();
  if (!raw) throw new SheetsConfigError("not_configured");
  if (saCache?.raw === raw) return saCache.sa;
  let parsed: unknown;
  try {
    // tolerate a pasted raw JSON key as well as the documented base64 form
    const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    parsed = JSON.parse(text);
  } catch {
    throw new SheetsConfigError("invalid_key");
  }
  const r = ServiceAccountJson.safeParse(parsed);
  if (!r.success) throw new SheetsConfigError("invalid_key");
  saCache = { raw, sa: r.data };
  return r.data;
}

/** Why the service account is unusable, or null when it is configured correctly. */
export function sheetsConfigProblem(): SheetsConfigError | null {
  try {
    loadServiceAccount();
    return null;
  } catch (err) {
    return err instanceof SheetsConfigError ? err : new SheetsConfigError("invalid_key");
  }
}

/** true when a usable service-account key is configured in the environment. */
export function isSheetsConfigured(): boolean {
  return sheetsConfigProblem() === null;
}

/** Service-account e-mail to share sheets with, or null when not configured. */
export function serviceAccountEmail(): string | null {
  try {
    return loadServiceAccount().client_email;
  } catch {
    return null;
  }
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

export function signJwt(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = { alg: "RS256", typ: "JWT", ...(sa.private_key_id ? { kid: sa.private_key_id } : {}) };
  const claims = { iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = createSign("RSA-SHA256").update(input).sign(sa.private_key); // RSASSA-PKCS1-v1_5 + SHA-256
  return `${input}.${b64url(sig)}`;
}

// process-wide (route bundles may each load their own copy of this module)
declare global {
  var __codSheetsToken: { cached: { token: string; exp: number; email: string } | null; inflight: Promise<string> | null } | undefined;
}
const tokenState = () => (globalThis.__codSheetsToken ??= { cached: null, inflight: null });

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text().catch(() => "");
  if (!text) return {};
  try {
    const j: unknown = JSON.parse(text);
    return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function getAccessToken(force = false): Promise<string> {
  const sa = loadServiceAccount();
  const st = tokenState();
  const { cached } = st;
  if (!force && cached && cached.email === sa.client_email && cached.exp - 300_000 > Date.now()) return cached.token;
  if (st.inflight) return st.inflight;
  st.inflight = (async () => {
    let res: Response;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signJwt(sa) }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
    } catch (err) {
      throw new SheetsError(0, "network", err instanceof Error ? err.message : "token request failed");
    }
    const j = await readJson(res);
    const token = typeof j.access_token === "string" ? j.access_token : "";
    if (!res.ok || !token) {
      throw new SheetsError(res.status, String(j.error ?? "token_error"), String(j.error_description ?? res.statusText));
    }
    const ttl = typeof j.expires_in === "number" ? j.expires_in : 3600;
    st.cached = { token, exp: Date.now() + ttl * 1000, email: sa.client_email };
    return token;
  })().finally(() => {
    st.inflight = null;
  });
  return st.inflight;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 1 s, 2 s, 4 s… (+ up to 1 s jitter), capped at 32 s. */
const backoff = (attempt: number) => Math.min(2 ** attempt * 1000 + Math.random() * 1000, 32_000);
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export interface GapiOptions {
  /** retries for 429/5xx/network (default 4) */
  maxRetries?: number;
  /** per-attempt timeout (default 15 s) */
  timeoutMs?: number;
}

/** Call the Sheets API (`path` is appended to /v4/spreadsheets). Returns parsed JSON. */
export async function gapi<T = Record<string, unknown>>(path: string, init: RequestInit = {}, opts: GapiOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? 4;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  let authRetried = false;
  let forceToken = false;
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken(forceToken);
    forceToken = false;
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(backoff(attempt));
        continue;
      }
      throw new SheetsError(0, "network", err instanceof Error ? err.message : "request failed");
    }
    if (res.ok) return (await readJson(res)) as T;
    const body = await readJson(res);
    const e = (body.error && typeof body.error === "object" ? body.error : {}) as { status?: string; message?: string };
    if (res.status === 401 && !authRetried) {
      authRetried = true;
      forceToken = true;
      continue;
    }
    if (RETRYABLE.has(res.status) && attempt < maxRetries) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 32_000) : backoff(attempt));
      continue;
    }
    throw new SheetsError(res.status, e.status ?? "UNKNOWN", e.message ?? res.statusText);
  }
}
