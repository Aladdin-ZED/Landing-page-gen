/**
 * Deploy-hardening self-test (no database, no Next runtime):
 *   npx tsx --conditions=react-server src/lib/security/selftest.ts
 *
 *  1. clientIp — X-Forwarded-For walked from the right: internal hops (the host's own proxies)
 *     skipped, TRUSTED_PROXY_HOPS public hops counted, client-sent entries never picked; X-Real-IP
 *     fallback; Cloudflare only from a Cloudflare hop.
 *  2. clientIpReport — hop numbering and the "used" entry shown in Settings → Security.
 *  3. burstLimit — per-network windows, reset, bounded memory.
 *  4. unknownPageResponse — one 404 for every method (HTML for GET only), never re-encoded.
 *  5. documentOrigins (production) — the landing CSP only names PUBLIC_URL's host and its www twin;
 *     X-Forwarded-Host / a foreign Host never get in.
 */
import { BURST_LIMITS, burstLimit, resetBurstLimits } from "./burst-limit";
import { clientIp, clientIpReport, isInternalIp } from "./ip";

const env = process.env as Record<string, string | undefined>;
// documentOrigins reads NODE_ENV once, when auth/config is first imported (below, dynamically)
env.NODE_ENV = "production";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) passes++;
  else {
    failures++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
function eq<T>(name: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  check(name, a === e, `got ${a}, expected ${e}`);
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = env[k];
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
}

const xff = (value: string, extra: Record<string, string> = {}) => new Headers({ "x-forwarded-for": value, ...extra });

/* 1. clientIp --------------------------------------------------------------------------------- */
console.log("clientIp");
for (const [ip, internal] of [
  ["10.0.0.7", true],
  ["172.16.0.1", true],
  ["172.31.255.255", true],
  ["172.32.0.1", false],
  ["192.168.1.1", true],
  ["127.0.0.1", true],
  ["169.254.10.1", true],
  ["100.64.0.1", true],
  ["100.127.255.255", true],
  ["100.128.0.1", false],
  ["0.0.0.0", true],
  ["::1", true],
  ["::", true],
  ["fd12:3456::1", true],
  ["fe80::1%eth0", true],
  ["::ffff:10.0.0.1", true],
  ["2001:db8::1", false],
  ["203.0.113.5", false],
  ["not-an-ip", false],
] as const) {
  check(`isInternalIp(${ip}) = ${internal}`, isInternalIp(ip) === internal);
}

withEnv({ TRUSTED_PROXY_HOPS: undefined, BEHIND_CLOUDFLARE: "0" }, () => {
  eq("one hop: the connecting address", clientIp(xff("203.0.113.5")), "203.0.113.5");
  eq("client-sent entries on the left are ignored", clientIp(xff("1.1.1.1, 8.8.8.8, 203.0.113.5")), "203.0.113.5");
  eq("client-sent private entries are ignored", clientIp(xff("10.1.1.1, 203.0.113.5")), "203.0.113.5");
  eq("internal proxy hop on the right is skipped", clientIp(xff("203.0.113.5, 10.0.0.7")), "203.0.113.5");
  eq("several internal hops are skipped", clientIp(xff("6.6.6.6, 203.0.113.5, 10.0.0.7, 127.0.0.1")), "203.0.113.5");
  eq("IPv6 visitor behind an internal IPv6 hop", clientIp(xff("2001:db8::1, fd00::2")), "2001:db8::1");
  eq("IPv4-mapped internal hop is skipped", clientIp(xff("203.0.113.5, ::ffff:10.0.0.1")), "203.0.113.5");
  eq("brackets / ports are canonicalised", clientIp(xff("[2001:db8::1]:443")), "2001:db8::1");
  eq("only internal entries: the nearest one (local / in-network caller)", clientIp(xff("10.0.0.1, 127.0.0.1")), "127.0.0.1");
  eq("a public CDN hop with TRUSTED_PROXY_HOPS=1 is what the app sees", clientIp(xff("203.0.113.5, 198.51.100.9")), "198.51.100.9");
  eq("X-Real-IP when X-Forwarded-For is absent", clientIp(new Headers({ "x-real-ip": "203.0.113.9" })), "203.0.113.9");
  eq("nothing sent", clientIp(new Headers()), "0.0.0.0");
});

withEnv({ TRUSTED_PROXY_HOPS: "2", BEHIND_CLOUDFLARE: "0" }, () => {
  eq("hops=2: visitor in front of a public CDN hop", clientIp(xff("203.0.113.5, 198.51.100.9")), "203.0.113.5");
  eq("hops=2: client-sent entries still ignored", clientIp(xff("6.6.6.6, 203.0.113.5, 198.51.100.9")), "203.0.113.5");
  eq("hops=2: internal hops not counted", clientIp(xff("6.6.6.6, 203.0.113.5, 198.51.100.9, 10.0.0.2")), "203.0.113.5");
  eq("hops=2 but one public entry: that entry", clientIp(xff("203.0.113.5, 10.0.0.2")), "203.0.113.5");
});

withEnv({ TRUSTED_PROXY_HOPS: "0", BEHIND_CLOUDFLARE: "0" }, () => {
  eq("invalid TRUSTED_PROXY_HOPS falls back to 1", clientIp(xff("6.6.6.6, 203.0.113.5")), "203.0.113.5");
});

withEnv({ TRUSTED_PROXY_HOPS: undefined, BEHIND_CLOUDFLARE: "1" }, () => {
  eq("Cloudflare hop → CF-Connecting-IP", clientIp(xff("203.0.113.5, 172.68.1.2", { "cf-connecting-ip": "203.0.113.5" })), "203.0.113.5");
  eq(
    "Cloudflare hop behind an internal proxy → CF-Connecting-IP",
    clientIp(xff("203.0.113.5, 172.68.1.2, 10.0.0.3", { "cf-connecting-ip": "203.0.113.5" })),
    "203.0.113.5",
  );
  eq("forged CF-Connecting-IP straight to the origin is ignored", clientIp(xff("198.51.100.7", { "cf-connecting-ip": "203.0.113.5" })), "198.51.100.7");
});

/* 2. clientIpReport --------------------------------------------------------------------------- */
console.log("clientIpReport");
withEnv({ TRUSTED_PROXY_HOPS: "2", BEHIND_CLOUDFLARE: "0" }, () => {
  const r = clientIpReport(xff("6.6.6.6, 203.0.113.5, 198.51.100.9, 10.0.0.2"));
  eq("report: client ip", r.clientIp, "203.0.113.5");
  eq(
    "report: hops numbered from the right, internal ones unnumbered",
    r.hops.map((h) => [h.value, h.publicHop, h.internal, h.used]),
    [
      ["6.6.6.6", 3, false, false],
      ["203.0.113.5", 2, false, true],
      ["198.51.100.9", 1, false, false],
      ["10.0.0.2", null, true, false],
    ],
  );
  eq("report: trusted hops", r.trustedHops, 2);
  const long = clientIpReport(xff(Array.from({ length: 20 }, (_, i) => `198.51.100.${i + 1}`).join(", ")));
  eq("report: at most 12 entries, the right-most", [long.hops.length, long.hops[0]?.value, long.hops.at(-1)?.publicHop], [12, "198.51.100.9", 1]);
  check("report: the used entry is inside the shown window", long.hops.some((h) => h.used));
});

/* 3. burstLimit -------------------------------------------------------------------------------- */
console.log("burstLimit");
{
  resetBurstLimits();
  const t0 = 1_000_000;
  const { limit, windowSec } = BURST_LIMITS.upsell;
  let last = burstLimit("upsell", "203.0.113.5", t0);
  for (let i = 1; i < limit; i++) last = burstLimit("upsell", "203.0.113.5", t0 + i);
  check("upsell: the limit itself passes", last.ok);
  const over = burstLimit("upsell", "203.0.113.5", t0 + limit);
  check("upsell: one over the limit is refused", !over.ok && over.retryAfter >= 1 && over.retryAfter <= windowSec);
  check("another network is not affected", burstLimit("upsell", "203.0.113.6", t0 + limit).ok);
  check("another scope is not affected", burstLimit("lead", "203.0.113.5", t0 + limit).ok);
  check("a new window starts after windowSec", burstLimit("upsell", "203.0.113.5", t0 + windowSec * 1000 + 1).ok);
  // one IPv6 /64 is one network
  resetBurstLimits();
  for (let i = 0; i < BURST_LIMITS.lead.limit; i++) burstLimit("lead", `2001:db8:1:2::${(i + 1).toString(16)}`, t0);
  check("IPv6 addresses of one /64 share a window", !burstLimit("lead", "2001:db8:1:2::ffff", t0).ok);
  // memory stays bounded under a flood of distinct networks
  resetBurstLimits();
  for (let i = 0; i < 25_000; i++) burstLimit("event", `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, t0);
  const size = globalThis.__codBurst?.size ?? 0;
  check("at most 10 000 windows are kept", size > 0 && size <= 10_000, `size ${size}`);
  resetBurstLimits();
}

/* 4 + 5: modules that read NODE_ENV at import ------------------------------------------------ */
async function moduleChecks(): Promise<void> {
  console.log("unknownPageResponse");
  const { unknownPageResponse, UNKNOWN_PAGE_HTML } = await import("@/lib/auth/unknown-page");
  const get = unknownPageResponse("GET");
  eq("GET: 404", get.status, 404);
  eq("GET: the static page", await get.text(), UNKNOWN_PAGE_HTML);
  check("never re-encoded (no-transform)", /\bno-transform\b/.test(get.headers.get("cache-control") ?? ""));
  check("never cached", /\bno-store\b/.test(get.headers.get("cache-control") ?? ""));
  for (const method of ["HEAD", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"]) {
    const r = unknownPageResponse(method);
    eq(`${method}: 404 with an empty body`, [r.status, await r.text()], [404, ""]);
  }

  console.log("documentOrigins (production)");
  const { documentOrigins } = await import("@/lib/render/serve.server");
  const req = (headers: Record<string, string>, url = "http://127.0.0.1:3000/argan") => new Request(url, { headers });
  const warn = console.warn;
  const warned: string[] = [];
  console.warn = (...args: unknown[]) => void warned.push(args.join(" "));
  try {
    withEnv({ PUBLIC_URL: "https://shop.ma", ADMIN_HOST: undefined }, () => {
      eq("PUBLIC_URL host", documentOrigins(req({ host: "shop.ma" })), ["https://shop.ma"]);
      eq("www twin is the same site", documentOrigins(req({ host: "www.shop.ma" })), ["https://shop.ma", "https://www.shop.ma"]);
      eq("X-Forwarded-Host never widens a real Host", documentOrigins(req({ host: "shop.ma", "x-forwarded-host": "evil.example" })), ["https://shop.ma"]);
      eq("X-Forwarded-Proto never changes PUBLIC_URL's scheme", documentOrigins(req({ host: "www.shop.ma", "x-forwarded-proto": "http" })), [
        "https://shop.ma",
        "https://www.shop.ma",
      ]);
      eq("a foreign Host is not reflected", documentOrigins(req({ host: "evil.example" })), ["https://shop.ma"]);
      check("a foreign Host is reported once in the runtime log", warned.filter((w) => w.includes("evil.example")).length === 1);
      documentOrigins(req({ host: "evil.example" }));
      check("…and only once", warned.filter((w) => w.includes("evil.example")).length === 1);
      eq("internal Host + proxy's X-Forwarded-Host twin", documentOrigins(req({ host: "127.0.0.1:3000", "x-forwarded-host": "www.shop.ma" })), [
        "https://shop.ma",
        "https://www.shop.ma",
      ]);
      eq("internal Host + spoofed X-Forwarded-Host", documentOrigins(req({ host: "127.0.0.1:3000", "x-forwarded-host": "www.shop.ma, evil.example" })), ["https://shop.ma"]);
      check("an internal Host is never reported", !warned.some((w) => w.includes("127.0.0.1")));
    });
    withEnv({ PUBLIC_URL: "http://localhost:3410" }, () => {
      eq("local production run (next start)", documentOrigins(req({ host: "localhost:3410" }, "http://localhost:3410/x")), ["http://localhost:3410"]);
    });
    withEnv({ PUBLIC_URL: undefined }, () => {
      eq("no PUBLIC_URL: the addressed Host", documentOrigins(req({ host: "shop.ma", "x-forwarded-proto": "https" })), ["https://shop.ma"]);
      eq("no PUBLIC_URL: X-Forwarded-Host ignored next to a real Host", documentOrigins(req({ host: "shop.ma", "x-forwarded-host": "evil.example" })).length, 1);
      eq("no PUBLIC_URL: CSP syntax in Host is refused", documentOrigins(req({ host: "shop.ma; script-src *" })), []);
    });
  } finally {
    console.warn = warn;
  }
}

moduleChecks().then(
  () => {
    console.log(`\n${passes} passed, ${failures} failed`);
    if (failures) process.exit(1);
  },
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
