import "server-only";
/**
 * HTTP responses for rendered landing documents (route handlers: /, /<slug>, /<slug>/merci,
 * /legal/<kind>, dev fixtures).
 *  - landing:   hash CSP of the version · ETag + 304 · short shared cache, always revalidated
 *  - legal:     same caching as landing · noindex (boilerplate shared by every page)
 *  - thank-you: hash CSP · no-store · noindex
 * Plus the base security headers (nosniff, referrer policy, permissions policy, X-Frame-Options).
 *
 * Isolation from the admin (same origin unless ADMIN_HOST splits it; the pixel loaders' scripts run
 * with this origin): the stored CSP's same-origin connect-src / form-action is narrowed per request
 * to the public API of the serving origin(s) (./csp scopeToPublicApi), and COOP is
 * DOCUMENT_COOP — never the admin's "same-origin", so a window this document opens on /admin, or
 * one the admin opens on this document, lands in another browsing context group.
 *
 * Content-coding (./compress): brotli, else gzip, from Accept-Encoding; `Vary: Accept-Encoding` on
 * every document response; Content-Length always exact. Each representation has its own validator:
 *   identity "<sha256>" (strong) · brotli W/"<sha256>-br" · gzip W/"<sha256>-gz"
 * (weak: the compressed bytes are upgraded once in the background, the document is the same), and
 * If-None-Match is compared against the representation being selected, so a cache never gets a 304
 * for bytes in an encoding it does not hold. Encoded bodies are cached per version in memory; a zlib
 * failure falls back to identity, never to an error page.
 */
import { createHash } from "node:crypto";
import { UNKNOWN_PAGE_HEADERS, UNKNOWN_PAGE_HTML } from "@/lib/auth/unknown-page";
import { baseSecurityHeaders } from "@/lib/security/headers";
import { encodeCached, encodeOnce, MIN_COMPRESS_BYTES, negotiateEncoding, type Coding } from "./compress";
import { originOf, scopeToPublicApi } from "./csp";

export interface ServeDocument {
  html: string;
  csp: string;
  /** sha256 hex of html (landing pages, legal documents): the base of the representation ETags */
  etag?: string;
}

export interface ServeOptions {
  kind: "landing" | "thanks" | "legal";
  /** seo.noindex of the page (thank-you pages are always noindex) */
  noindex?: boolean;
  /** extra cache policy override (dev fixtures: no-store) */
  cacheControl?: string;
  /**
   * "cache" (default): encoded once per document and kept (stored versions, legal documents).
   * "once": encoded at the fast level and not kept — for documents rendered anew on every request.
   * Defaults to "once" when `cacheControl` overrides the policy with no-store (dev fixtures).
   */
  encoding?: "cache" | "once";
}

const LANDING_CACHE = "public, max-age=0, must-revalidate, s-maxage=60";

/**
 * COOP of every rendered document. The admin keeps "same-origin" (security/headers): two different
 * values force a browsing-context-group switch between them in both directions (a popup a vendor
 * script opens on /admin/** is cut off from its opener, and so is a live page the admin opens).
 * Same value as exports, where the WhatsApp hand-off opens a new tab.
 */
export const DOCUMENT_COOP = "same-origin-allow-popups";

const HOST_RE = /^[a-z0-9.-]+(?::\d{1,5})?$/;
const firstValue = (v: string | null) => v?.split(",")[0]?.trim().toLowerCase() || null;

/**
 * The origins a browser may be showing this document under: PUBLIC_URL's, plus the request's own
 * host (Host, and X-Forwarded-Host behind a proxy), so a page reached on an alias (www.…) still
 * reaches its API. Hosts are validated (no CSP syntax can get through) and only ever widen the
 * public-API sources; the scheme comes from X-Forwarded-Proto, else the request URL — an "http"
 * source also matches https (CSP3), so a TLS-terminating proxy that sends no proto still works.
 */
export function documentOrigins(req: Request): string[] {
  const out = new Set<string>();
  const pub = originOf(process.env.PUBLIC_URL ?? "");
  if (pub) out.add(pub);
  let scheme = firstValue(req.headers.get("x-forwarded-proto"));
  if (scheme !== "https" && scheme !== "http") {
    try {
      scheme = new URL(req.url).protocol.replace(/:$/, "");
    } catch {
      scheme = null;
    }
  }
  if (scheme !== "https" && scheme !== "http") return [...out];
  for (const host of [firstValue(req.headers.get("host")), firstValue(req.headers.get("x-forwarded-host"))]) {
    if (!host || !HOST_RE.test(host)) continue;
    const o = originOf(`${scheme}://${host}`);
    if (o) out.add(o);
  }
  return [...out];
}

/** The ETag of one representation of a document whose identity bytes hash to `sha`. */
export function representationTag(sha: string, coding: Coding): string {
  if (coding === "identity") return `"${sha}"`;
  return `W/"${sha}-${coding === "br" ? "br" : "gz"}"`;
}

const ENTITY_TAG_RE = /\*|(?:W\/)?"[^"]*"/g;

/** If-None-Match (weak comparison, RFC 9110 §13.1.2): "*" or one of the listed tags equals `tag`. */
export function etagMatches(header: string | null, tag: string): boolean {
  if (!header) return false;
  const opaque = tag.replace(/^W\//, "");
  for (const m of header.matchAll(ENTITY_TAG_RE)) {
    const candidate = m[0];
    if (candidate === "*" || candidate.replace(/^W\//, "") === opaque) return true;
  }
  return false;
}

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

export async function documentResponse(req: Request, docu: ServeDocument, opts: ServeOptions): Promise<Response> {
  const headers = new Headers(baseSecurityHeaders({ frame: "deny" }));
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Content-Security-Policy", scopeToPublicApi(docu.csp, documentOrigins(req)));
  headers.set("Cross-Origin-Opener-Policy", DOCUMENT_COOP);
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Vary", "Accept-Encoding");
  if (opts.kind === "thanks") {
    headers.set("Cache-Control", opts.cacheControl ?? "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow");
    headers.set("Referrer-Policy", "no-referrer");
  } else {
    headers.set("Cache-Control", opts.cacheControl ?? LANDING_CACHE);
    if (opts.kind === "legal") headers.set("X-Robots-Tag", "noindex, follow");
    else if (opts.noindex) headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // UTF-16 length ≤ UTF-8 byte length: no full scan of the document just to apply the threshold
  let coding: Coding = docu.html.length >= MIN_COMPRESS_BYTES ? negotiateEncoding(req.headers.get("accept-encoding")) : "identity";
  const validated = docu.etag !== undefined && opts.kind !== "thanks";

  if (validated) {
    const tag = representationTag(docu.etag!, coding);
    headers.set("ETag", tag);
    if (etagMatches(req.headers.get("if-none-match"), tag)) {
      // 304: validators and cache policy only, no representation metadata
      headers.delete("Content-Type");
      return new Response(null, { status: 304, headers });
    }
  }

  let body: string | Uint8Array<ArrayBuffer> = docu.html;
  let length = -1;
  if (coding !== "identity") {
    const once = opts.encoding ? opts.encoding === "once" : /\bno-store\b/i.test(opts.cacheControl ?? "");
    try {
      const encoded = once ? await encodeOnce(docu.html, coding) : await encodeCached(docu.etag ?? sha256hex(docu.html), docu.html, coding);
      body = encoded;
      length = encoded.byteLength;
      headers.set("Content-Encoding", coding);
    } catch {
      // already logged by ./compress — the document still goes out, uncompressed and correctly tagged
      coding = "identity";
      if (validated) headers.set("ETag", representationTag(docu.etag!, coding));
    }
  }
  // a string body goes out as UTF-8 (lone surrogates → U+FFFD, 3 bytes — Buffer.byteLength counts the same)
  headers.set("Content-Length", String(length >= 0 ? length : Buffer.byteLength(docu.html, "utf8")));
  return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
}

/**
 * Permanent redirect to a canonical same-origin path (e.g. /Argan → /argan), with the base security
 * headers. The Location stays relative (path + query): behind Hostinger's proxy the request host seen
 * by Node is not necessarily the public one.
 */
export function canonicalRedirect(location: URL): Response {
  const headers = new Headers(baseSecurityHeaders({ frame: "deny" }));
  headers.set("Location", location.pathname + location.search);
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(null, { status: 308, headers });
}

/** The neutral public 404 (identical to the proxy's answer for unknown URLs). */
export function notFoundResponse(req: Request): Response {
  return new Response(req.method === "HEAD" ? null : UNKNOWN_PAGE_HTML, { status: 404, headers: UNKNOWN_PAGE_HEADERS });
}

/** 503 when the store backend (database) is unreachable — never cached, never indexed. */
export function unavailableResponse(req: Request): Response {
  const headers = new Headers(baseSecurityHeaders({ frame: "deny" }));
  headers.set("Content-Type", "text/plain; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("Retry-After", "30");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(req.method === "HEAD" ? null : "Temporarily unavailable. Please try again in a moment.", { status: 503, headers });
}
