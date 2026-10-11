/**
 * Admin-host isolation self-test (ADMIN_HOST):
 *   npx tsx --conditions=react-server src/lib/auth/host-selftest.ts
 *
 * The public pages run third-party pixel scripts. With ADMIN_HOST set, those scripts must not be able
 * to reach the admin with the owner's cookies. Checks the proxy (src/proxy.ts), the in-app gate
 * re-check (hasGateAccess, which hasAdminAccess uses) and the admin API's same-origin check:
 *   - ADMIN_HOST parsing: bare host or origin URL; paths, IPs, single-label names and PUBLIC_URL's
 *     own host are refused;
 *   - the request host comes from `Host`. A script-sent X-Forwarded-Host cannot impersonate the admin
 *     host; only an internal Host (IP or localhost) defers to the proxy's right-most X-Forwarded-Host;
 *   - on the public host: the gate is inert and /admin and /api/admin answer 404, even with a valid gate
 *     cookie or a forged X-Forwarded-Host;
 *   - on the admin host: the gate and admin work, and landing, legal and public API paths answer 404;
 *   - gate cookies issued before ADMIN_HOST was set no longer open anything;
 *   - checkSameOrigin accepts only the admin host's Origin (not PUBLIC_URL's same-site host);
 *   - without ADMIN_HOST everything behaves as before (shared origin).
 * Exits 1 on any failure.
 */
import { NextRequest, type NextResponse } from "next/server";
import { proxy } from "@/proxy";
import { checkSameOrigin } from "@/lib/security/csrf";
import { adminHost, authConfigWarnings } from "./config";
import { hasGateAccess, issueGateToken, requestHost } from "./gate";

const PUBLIC = "mystore.ma";
const ADMIN = "studio.mystore.ma";
const GATE = "gate-selftest-k29fx81q4mz7w2pd";
const COOKIE = "csg"; // non-production name (NODE_ENV is not "production" here)

process.env.APP_SECRET = "selftest-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
process.env.ADMIN_GATE = GATE;
process.env.PUBLIC_URL = `https://${PUBLIC}`;
process.env.ADMIN_IP_ALLOWLIST = "";
delete process.env.ADMIN_HOST;

let failures = 0;
let checks = 0;
const check = (ok: boolean, msg: string) => {
  checks++;
  if (!ok) {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

interface ReqOpts {
  method?: string;
  host: string;
  xfh?: string;
  token?: string;
  origin?: string;
  site?: string;
}

function request(path: string, o: ReqOpts): NextRequest {
  const headers = new Headers({ host: o.host });
  if (o.xfh) headers.set("x-forwarded-host", o.xfh);
  if (o.token) headers.set("cookie", `${COOKIE}=${o.token}`);
  if (o.origin) headers.set("origin", o.origin);
  if (o.site) headers.set("sec-fetch-site", o.site);
  const base = /^(?:\d|localhost)/.test(o.host) ? `http://${o.host}` : `https://${o.host}`;
  return new NextRequest(new URL(path, base), { method: o.method ?? "GET", headers });
}

type Outcome = "pass" | "404" | "gate" | "admin" | "public" | "other";
function outcome(res: NextResponse): Outcome {
  if (res.status === 404) return "404";
  if (res.status === 303 && (res.headers.get("set-cookie") ?? "").startsWith(`${COOKIE}=`)) return "gate";
  if (res.status === 307 && (res.headers.get("location") ?? "").startsWith(`https://${PUBLIC}/`)) return "public";
  if (res.headers.get("x-middleware-next") === "1") {
    return res.headers.get("content-security-policy")?.includes("nonce-") ? "admin" : "pass";
  }
  return "other";
}
const run = (path: string, o: ReqOpts) => outcome(proxy(request(path, o)));
const expect = (path: string, o: ReqOpts, want: Outcome, label: string) => {
  const got = run(path, o);
  check(got === want, `${label}: ${o.method ?? "GET"} ${o.host}${path} → ${got}, expected ${want}`);
};

function withAdminHost<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.ADMIN_HOST;
  if (value === undefined) delete process.env.ADMIN_HOST;
  else process.env.ADMIN_HOST = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.ADMIN_HOST;
    else process.env.ADMIN_HOST = prev;
  }
}

/* ---------------------------------------------------------------- parsing */
console.log("ADMIN_HOST parsing");
const parsed: Array<[string | undefined, string | null]> = [
  [undefined, null],
  ["", null],
  [ADMIN, ADMIN],
  ["  https://Studio.MyStore.MA/ ", ADMIN],
  ["https://studio.mystore.ma:443", ADMIN],
  ["studio.mystore.ma.", ADMIN],
  ["http://studio.localhost:3400", "studio.localhost:3400"],
  ["studio.mystore.ma/admin", null],
  ["https://studio.mystore.ma/admin", null],
  ["https://user@studio.mystore.ma", null],
  ["ftp://studio.mystore.ma", null],
  ["127.0.0.1", null],
  ["[::1]:3400", null],
  ["localhost:3400", null],
  ["studio mystore.ma", null],
  [PUBLIC, null],
  ["https://MyStore.ma.", null],
];
for (const [value, want] of parsed) {
  const got = withAdminHost(value, adminHost);
  check(got === want, `ADMIN_HOST=${JSON.stringify(value)} → ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
}
check(
  withAdminHost(PUBLIC, authConfigWarnings).some((w) => w.startsWith("ADMIN_HOST must be a host of its own")),
  "ADMIN_HOST equal to PUBLIC_URL's host is reported at boot",
);
check(
  withAdminHost("not a host/", authConfigWarnings).some((w) => w.startsWith("ADMIN_HOST is not a valid host name")),
  "an invalid ADMIN_HOST is reported at boot",
);

/* ---------------------------------------------------------------- request host */
console.log("request host");
const h = (init: Record<string, string>) => new Headers(init);
check(requestHost(h({ host: PUBLIC, "x-forwarded-host": ADMIN })) === PUBLIC, "a script-sent X-Forwarded-Host never overrides a real Host");
check(requestHost(h({ host: "127.0.0.1:3000", "x-forwarded-host": `evil.ma, ${ADMIN}` })) === ADMIN, "internal Host → right-most X-Forwarded-Host");
check(requestHost(h({ host: "localhost:3000", "x-forwarded-host": ADMIN })) === ADMIN, "localhost Host → X-Forwarded-Host");
check(requestHost(h({ host: "localhost:3000" })) === "localhost:3000", "internal Host without X-Forwarded-Host stays itself");
check(requestHost(h({ host: "Studio.MyStore.ma:443" })) === ADMIN, "Host is normalized (case, default port)");
check(requestHost(h({ host: "studio.localhost:3400" })) === "studio.localhost:3400", "*.localhost dev hosts are real hosts");

/* ---------------------------------------------------------------- dedicated admin host */
console.log("dedicated admin host");
process.env.ADMIN_HOST = ADMIN;

const legacyToken = withAdminHost(undefined, () => issueGateToken());
const gateRes = proxy(request(`/${GATE}`, { host: ADMIN }));
const token = /^csg=([^;]+)/.exec(gateRes.headers.get("set-cookie") ?? "")?.[1] ?? "";
check(gateRes.status === 303 && token.length > 0, "the gate opens on the admin host");
check(new URL(gateRes.headers.get("location") ?? "", `https://${ADMIN}`).pathname === "/admin", "the gate redirects to /admin");

// public host: the gate is inert, the admin is invisible, landing pages pass
expect(`/${GATE}`, { host: PUBLIC }, "pass", "gate path on the public host is an ordinary slug");
expect(`/${GATE}`, { host: PUBLIC, xfh: ADMIN }, "pass", "forged X-Forwarded-Host cannot open the gate on the public host");
expect("/admin/orders/export", { host: PUBLIC, token }, "404", "orders export on the public host");
expect("/admin/orders/export", { host: PUBLIC, token, xfh: ADMIN }, "404", "orders export with forged X-Forwarded-Host");
expect("/admin/settings/team", { host: PUBLIC, token, method: "POST", origin: `https://${PUBLIC}`, site: "same-origin" }, "404", "server action POST on the public host");
expect("/api/admin/media", { host: PUBLIC, token, method: "POST", site: "same-origin" }, "404", "admin API on the public host");
expect("/%61dmin", { host: PUBLIC, token }, "404", "encoded admin path on the public host");
expect("/", { host: PUBLIC }, "pass", "home page on the public host");
expect("/argan-oil", { host: PUBLIC }, "pass", "landing page on the public host");
expect("/argan-oil/merci", { host: PUBLIC }, "pass", "thank-you page on the public host");
expect("/api/public/order", { host: PUBLIC, method: "POST" }, "pass", "order API on the public host");

// admin host: the admin works, nothing else is served
expect("/admin/orders/export", { host: ADMIN, token }, "admin", "orders export on the admin host");
expect("/api/admin/media", { host: ADMIN, token, method: "POST", site: "same-origin" }, "admin", "admin API on the admin host");
expect("/admin", { host: ADMIN }, "404", "admin host without a gate cookie");
expect("/admin", { host: ADMIN, token: legacyToken }, "404", "gate cookie issued before ADMIN_HOST was set");
expect(`/${GATE}`, { host: ADMIN, method: "POST" }, "404", "gate path with a wrong method on the admin host");
for (const path of ["/", "/argan-oil", "/argan-oil/merci", "/legal/privacy", "/api/cron/tick", "/robots.txt", "/dev/fixture/argan"]) {
  expect(path, { host: ADMIN }, "404", "public route on the admin host, stranger");
  // the owner's own live-page links are sent to the public site, never rendered on the admin origin
  expect(path, { host: ADMIN, token }, "public", "public route on the admin host, owner");
}
const hop = proxy(request("/argan-oil?utm=x", { host: ADMIN, token }));
check(hop.headers.get("location") === `https://${PUBLIC}/argan-oil?utm=x`, `owner redirect keeps path and query (got ${hop.headers.get("location")})`);
check(hop.headers.get("cache-control") === "private, no-store", "owner redirect is never cached");
const twisted = proxy(request("//evil.example/x", { host: ADMIN, token })).headers.get("location") ?? "";
check(new URL(twisted).host === PUBLIC, `a "//host" path cannot redirect off the public site (got ${twisted})`);
expect("/api/public/order", { host: ADMIN, method: "POST" }, "404", "order API on the admin host");
expect("/api/public/order", { host: ADMIN, method: "POST", token }, "404", "order API POST on the admin host, owner");
expect("/_next/webpack-hmr", { host: ADMIN }, "pass", "framework path on the admin host");
expect("/admin", { host: "127.0.0.1:3000", xfh: ADMIN, token }, "admin", "proxy-rewritten Host with X-Forwarded-Host");
expect("/admin", { host: "127.0.0.1:3000", xfh: PUBLIC, token }, "404", "proxy-rewritten Host for the public host");

// the in-app re-check (hasAdminAccess) applies the same rules
check(hasGateAccess(token, h({ host: ADMIN })), "hasGateAccess: admin host + cookie");
check(!hasGateAccess(token, h({ host: PUBLIC })), "hasGateAccess: public host is refused");
check(!hasGateAccess(token, h({ host: PUBLIC, "x-forwarded-host": ADMIN })), "hasGateAccess: forged X-Forwarded-Host is refused");
check(!hasGateAccess(legacyToken, h({ host: ADMIN })), "hasGateAccess: pre-ADMIN_HOST cookie is refused");

// the admin API's same-origin check
const post = (origin: string | null, site: string | null) => {
  const headers = new Headers({ host: ADMIN });
  if (origin) headers.set("origin", origin);
  if (site) headers.set("sec-fetch-site", site);
  return checkSameOrigin(new Request(`https://${ADMIN}/api/admin/media`, { method: "POST", headers }));
};
check(post(`https://${ADMIN}`, "same-origin"), "csrf: admin origin passes");
check(post(`https://${ADMIN}`, null), "csrf: admin origin without Sec-Fetch-Site passes");
check(!post(`https://${PUBLIC}`, null), "csrf: PUBLIC_URL's origin no longer counts as same-origin");
check(!post(`https://${PUBLIC}`, "same-site"), "csrf: same-site public page is refused");
check(!post("https://evil.example", null), "csrf: foreign origin is refused");

/* ---------------------------------------------------------------- shared origin (unchanged) */
console.log("shared origin (ADMIN_HOST unset)");
delete process.env.ADMIN_HOST;
const sharedToken = issueGateToken();
check(hasGateAccess(legacyToken, h({ host: PUBLIC })), "shared: existing gate cookies keep working while ADMIN_HOST stays unset");
check(run(`/${GATE}`, { host: PUBLIC }) === "gate", "shared: the gate opens on the public host");
expect("/admin/orders/export", { host: PUBLIC, token: sharedToken }, "admin", "shared: admin on the public host");
expect("/admin", { host: PUBLIC }, "404", "shared: admin without a gate cookie");
expect("/argan-oil", { host: PUBLIC }, "pass", "shared: landing page");
expect("/admin", { host: PUBLIC, token }, "404", "shared: a cookie bound to ADMIN_HOST does not open the shared admin");
check(hasGateAccess(sharedToken, h({ host: PUBLIC })), "shared: hasGateAccess on the public host");
const sharedPost = new Headers({ host: PUBLIC, origin: `https://${PUBLIC}` });
check(checkSameOrigin(new Request(`https://${PUBLIC}/api/admin/media`, { method: "POST", headers: sharedPost })), "shared: csrf still accepts PUBLIC_URL's origin");

console.log(failures === 0 ? `\n✓ ${checks} checks passed` : `\n✗ ${failures} of ${checks} checks failed`);
process.exit(failures === 0 ? 0 : 1);
