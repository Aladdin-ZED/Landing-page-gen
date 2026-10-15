/**
 * The public "page not found" content, shared by the app's not-found page (src/app/not-found.tsx)
 * and the proxy's answer to un-gated admin requests, so both look the same to a visitor.
 * Deliberately neutral: no product or admin branding.
 */

export const UNKNOWN_PAGE_COPY = {
  code: "404",
  titleFr: "Page introuvable",
  bodyFr: "Le lien est peut-être incorrect, ou la page n'existe plus.",
  titleAr: "الصفحة غير موجودة",
  bodyAr: "ربما الرابط غير صحيح أو أن الصفحة لم تعد موجودة.",
  homeFr: "Retour à l'accueil",
} as const;

/**
 * Shared visual tokens (system fonts — the 404 must not depend on app assets). Warm-neutral paper
 * and ink at very low chroma (no accent, no orange); `dark*` apply under prefers-color-scheme: dark.
 */
export const UNKNOWN_PAGE_STYLE = {
  bg: "#f7f6f2",
  ink: "#1b1a18",
  soft: "#66625b",
  line: "#e2dfd8",
  darkBg: "#141413",
  darkInk: "#ecebe7",
  darkSoft: "#a3a09a",
  darkLine: "#2d2c29",
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Arabic", Tahoma, sans-serif',
} as const;

const c = UNKNOWN_PAGE_COPY;
const s = UNKNOWN_PAGE_STYLE;

/** Complete HTML document (static, no scripts, no user input). */
export const UNKNOWN_PAGE_HTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="light dark"><title>${c.titleFr}</title><style>
:root{--bg:${s.bg};--ink:${s.ink};--soft:${s.soft};--line:${s.line}}@media (prefers-color-scheme:dark){:root{--bg:${s.darkBg};--ink:${s.darkInk};--soft:${s.darkSoft};--line:${s.darkLine}}}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}body{display:grid;place-items:center;min-height:100vh;min-height:100dvh;padding:24px;background:var(--bg);color:var(--ink);font-family:${s.font};line-height:1.5;-webkit-font-smoothing:antialiased}
main{width:100%;max-width:28rem;text-align:center}.code{font-size:4.5rem;font-weight:300;letter-spacing:-.04em;line-height:1;margin:0 0 1.5rem;color:var(--ink);font-variant-numeric:tabular-nums}
h1,h2{font-size:1.25rem;font-weight:600;margin:0;text-wrap:balance}p{margin:.5rem 0 0;color:var(--soft);font-size:.95rem;text-wrap:pretty}hr{border:0;border-top:1px solid var(--line);margin:1.5rem auto;width:4rem}
a{display:inline-flex;align-items:center;min-height:44px;margin-top:1.5rem;color:var(--ink);font-size:.9rem;text-underline-offset:4px;text-decoration-color:var(--soft)}a:hover{text-decoration-color:currentColor}a:focus-visible{outline:2px solid var(--ink);outline-offset:4px;border-radius:2px}
</style></head><body><main><p class="code" aria-hidden="true">${c.code}</p><h1>${c.titleFr}</h1><p>${c.bodyFr}</p><hr><div lang="ar" dir="rtl"><h2>${c.titleAr}</h2><p>${c.bodyAr}</p></div><a href="/">${c.homeFr}</a></main></body></html>`;

/**
 * Headers of every "unknown URL" answer: the proxy's (un-gated admin), the route handlers' (unknown
 * slug, legal page, un-gated media API, cron without its key) and, through the fallback rewrite in
 * next.config.ts, every path no route matches. The Vary list is the one Next.js adds to its own
 * responses. `no-transform` keeps Next's response compression (and any CDN) from re-encoding one of
 * them and not the others: proxy answers would otherwise go out gzip-encoded and route answers not,
 * which told an admin path apart from any other unknown URL.
 */
export const UNKNOWN_PAGE_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate, no-transform",
  Vary: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch",
};

/**
 * The public 404 for a request with this method: the HTML document for GET, an empty body for every
 * other method (HEAD, POST, OPTIONS…), exactly as the proxy answers un-gated admin requests.
 */
export function unknownPageResponse(method: string): Response {
  return new Response(method === "GET" ? UNKNOWN_PAGE_HTML : null, { status: 404, headers: UNKNOWN_PAGE_HEADERS });
}
