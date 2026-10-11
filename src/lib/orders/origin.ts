/**
 * Origin policy for the public API (pure — no I/O, no framework imports).
 *  - live pages: same-origin only (Origin, when sent, must be one of our hosts)
 *  - exports: Origin must be in that export's allow-list → reflected in Access-Control-Allow-Origin
 *    (never "*", never credentials)
 */

interface ParsedOrigin {
  scheme: string;
  host: string; // hostname[:port], default ports dropped
}

function parseOrigin(value: string): ParsedOrigin | null {
  const v = value.trim();
  if (!v || v === "null") return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { scheme: u.protocol, host: u.host.toLowerCase() };
  } catch {
    return null;
  }
}

/** Second-level labels used as registry suffixes under country TLDs ("co.ma", "com.es", "org.uk"…). */
const REGISTRY_SLD = new Set(["co", "com", "net", "org", "gov", "gouv", "ac", "edu", "or", "ne", "press"]);

/**
 * Shared hosting namespaces (the private section of the Public Suffix List, trimmed to the hosts a
 * seller is likely to use): every subdomain is a different customer's site, so "*.netlify.app" would
 * let any Netlify site post orders from its visitors' browsers. Exact origins still work.
 */
const SHARED_HOSTING_SUFFIXES = new Set([
  // static & app hosting
  "netlify.app", "github.io", "gitlab.io", "codeberg.page", "bitbucket.io",
  "pages.dev", "workers.dev", "r2.dev", "trycloudflare.com",
  "vercel.app", "vercel.dev", "now.sh",
  "web.app", "firebaseapp.com", "appspot.com", "run.app",
  "herokuapp.com", "onrender.com", "fly.dev", "railway.app", "up.railway.app",
  "glitch.me", "repl.co", "replit.app", "replit.dev", "surge.sh", "deno.dev",
  "azurewebsites.net", "azurestaticapps.net", "cloudfront.net", "amplifyapp.com",
  "ngrok.io", "ngrok.app", "ngrok-free.app", "loca.lt", "duckdns.org", "ddns.net",
  // site builders & shop platforms
  "myshopify.com", "youcan.shop", "wixsite.com", "squarespace.com", "webflow.io",
  "framer.app", "framer.website", "carrd.co", "blogspot.com", "wordpress.com", "weebly.com",
  "godaddysites.com", "zyrosite.com",
  // shared PHP hosting & temporary domains
  "hostingersite.com", "000webhostapp.com", "infinityfreeapp.com", "epizy.com",
]);

/** Cloud zones where every level below is shared between customers (bucket / region endpoints). */
const SHARED_HOSTING_ZONES = ["amazonaws.com", "windows.net", "azure.com", "googleusercontent.com"];

/** Is `name` a namespace shared by unrelated sites (public suffix, shared hosting, IP literal)? */
export function sharedSuffix(name: string): boolean {
  const n = name.toLowerCase().replace(/:\d+$/, "");
  if (n.startsWith("[") || /^[\d.]+$/.test(n)) return true;
  const labels = n.split(".");
  if (labels.length < 2 || labels.some((l) => !l)) return true;
  if (labels.length === 2 && labels[1]!.length === 2 && REGISTRY_SLD.has(labels[0]!)) return true;
  if (SHARED_HOSTING_SUFFIXES.has(n)) return true;
  return SHARED_HOSTING_ZONES.some((z) => n === z || n.endsWith(`.${z}`));
}

/**
 * A wildcard must cover one registrable domain: "*.shop.ma" is fine, while "*.com", "*.ma",
 * "*.co.ma", "*.netlify.app" or an IP literal would let unrelated sites call the API with CORS.
 */
function wildcardBaseOk(host: string): boolean {
  return !sharedSuffix(host);
}

/**
 * Does `origin` match an allow-list entry? Entries are origins ("https://shop.ma"), bare hosts
 * ("shop.ma" → any scheme) or wildcard subdomains ("https://*.shop.ma", "*.shop.ma").
 */
export function originAllowed(origin: string, allowed: readonly string[]): boolean {
  const o = parseOrigin(origin);
  if (!o) return false;
  for (const raw of allowed) {
    const entry = raw.trim().toLowerCase();
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(entry);
    const wildcard = entry.replace(/^[a-z][a-z0-9+.-]*:\/\//, "").startsWith("*.");
    const e = parseOrigin(entry.replace("*.", ""));
    if (!e) continue;
    if (wildcard && !wildcardBaseOk(e.host)) continue;
    if (hasScheme && e.scheme !== o.scheme) continue;
    if (wildcard ? o.host.endsWith(`.${e.host}`) : o.host === e.host) return true;
  }
  return false;
}

/** Hosts this app answers on (Host / X-Forwarded-Host / PUBLIC_URL). */
function selfHosts(headers: Headers): Set<string> {
  const hosts = new Set<string>();
  const add = (v: string | null | undefined) => {
    const first = v?.split(",")[0]?.trim().toLowerCase();
    if (first) hosts.add(first);
  };
  add(headers.get("x-forwarded-host"));
  add(headers.get("host"));
  if (process.env.PUBLIC_URL) {
    try {
      add(new URL(process.env.PUBLIC_URL).host);
    } catch {
      // malformed PUBLIC_URL: host headers still apply
    }
  }
  return hosts;
}

export type OriginVerdict =
  | { ok: true; cors: string | null; noOrigin: boolean }
  | { ok: false };

/**
 * Origin policy for public POSTs.
 *  - live pages: same-origin only (Origin, when sent, must be one of our hosts)
 *  - exports: Origin must be in that export's allow-list → reflected in Access-Control-Allow-Origin
 * Requests without Origin (non-browser clients) pass, flagged `noOrigin` for the risk score.
 */
export function checkOrigin(req: Request, allowedOrigins: readonly string[] | null): OriginVerdict {
  const origin = req.headers.get("origin");
  const site = req.headers.get("sec-fetch-site");
  if (!origin) {
    if (site && site !== "same-origin" && site !== "none") return { ok: false };
    return { ok: true, cors: null, noOrigin: true };
  }
  const o = parseOrigin(origin);
  if (!o) return { ok: false };
  if (selfHosts(req.headers).has(o.host)) return { ok: true, cors: null, noOrigin: false };
  if (allowedOrigins && originAllowed(origin, allowedOrigins)) return { ok: true, cors: origin, noOrigin: false };
  return { ok: false };
}

/** CORS response headers for an allowed cross-origin caller (never "*", never credentials). */
export function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}
