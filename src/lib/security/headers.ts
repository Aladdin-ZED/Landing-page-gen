/**
 * Security response headers.
 *  - baseSecurityHeaders(): for every public/route-handler response (landing pages add their own hash CSP).
 *  - adminSecurityHeaders(): base + the nonce-based admin CSP (set by src/proxy.ts on gated admin requests).
 * Framework-free and runtime-agnostic (no Node APIs) so it can run in the proxy and route handlers alike.
 */

const isProd = () => process.env.NODE_ENV === "production";
/**
 * The site is served over HTTPS (PUBLIC_URL starts with https:). Production on Hostinger always is;
 * `npm run start` on http://localhost is not — upgrading its requests to https would break navigation.
 */
const servedOverHttps = () => /^https:\/\//i.test(process.env.PUBLIC_URL ?? "https://");

export interface SecurityHeaderOptions {
  /**
   * X-Frame-Options fallback (CSP frame-ancestors is the primary control where a CSP exists).
   * "deny" (default) · "sameorigin" for documents the admin previews in an iframe · false to omit.
   */
  frame?: "deny" | "sameorigin" | false;
  /** Strict-Transport-Security; defaults to on in production only. */
  hsts?: boolean;
}

export const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

export function baseSecurityHeaders(opts: SecurityHeaderOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": PERMISSIONS_POLICY,
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  const frame = opts.frame ?? "deny";
  if (frame) headers["X-Frame-Options"] = frame === "deny" ? "DENY" : "SAMEORIGIN";
  // No includeSubDomains: the app runs on merchants' own domains, whose other subdomains (mail,
  // tracking CNAMEs, legacy sites…) are outside our control and may not serve HTTPS.
  if (opts.hsts ?? isProd()) headers["Strict-Transport-Security"] = "max-age=63072000";
  return headers;
}

/** Copies the given headers onto `target` (does not overwrite values a handler already set). */
export function applySecurityHeaders(target: Headers, headers: Record<string, string>): Headers {
  for (const [name, value] of Object.entries(headers)) {
    if (!target.has(name)) target.set(name, value);
  }
  return target;
}

/** External origins the admin may fetch from (in-browser AI models + onnxruntime wasm). */
export const ADMIN_CONNECT_SOURCES = [
  "https://huggingface.co",
  "https://*.huggingface.co",
  "https://*.hf.co",
  "https://cdn.jsdelivr.net",
] as const;

const NONCE_RE = /^[A-Za-z0-9+/]{16,64}={0,2}$/;

/** 128-bit random nonce, base64 (Web Crypto — works in every runtime). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** Nonce-based strict CSP for admin HTML (Next.js applies the nonce to its own scripts). */
export function adminCsp(nonce: string, opts: { dev?: boolean } = {}): string {
  if (!NONCE_RE.test(nonce)) throw new Error("invalid CSP nonce");
  const dev = opts.dev ?? !isProd();
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    [
      "script-src",
      ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", ...(dev ? ["'unsafe-eval'"] : [])],
    ],
    ["worker-src", ["'self'", "blob:"]],
    ["connect-src", ["'self'", ...ADMIN_CONNECT_SOURCES]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["media-src", ["'self'", "blob:"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["font-src", ["'self'", "data:"]],
    ["frame-src", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
    ["manifest-src", ["'self'"]],
  ];
  const parts = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev && servedOverHttps()) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** Everything the proxy sets on a gated admin response. */
export function adminSecurityHeaders(nonce: string, opts: { dev?: boolean } = {}): Record<string, string> {
  return {
    ...baseSecurityHeaders({ frame: "deny" }),
    "Content-Security-Policy": adminCsp(nonce, opts),
    // "same-origin", not "no-referrer": under no-referrer browsers serialize the Origin of a
    // same-origin form POST as "null" (Fetch spec), and Next's Server Actions check then rejects a
    // form sent before hydration with a 500. Other sites still receive no referrer at all.
    "Referrer-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, no-store",
  };
}
