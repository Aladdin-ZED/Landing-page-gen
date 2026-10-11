/**
 * Client IP for rate limiting & abuse signals (always hashed before storage).
 *
 * Left-most X-Forwarded-For entries and CF-Connecting-IP are client-controlled unless a trusted proxy
 * overwrites them, so we read the hop appended by OUR proxy: the entry at position
 * (length - TRUSTED_PROXY_HOPS) — default 1 = the right-most entry (Hostinger's front proxy).
 *
 * CF-Connecting-IP is honoured only when BEHIND_CLOUDFLARE=1 AND that proxy hop is a Cloudflare edge
 * address: the origin of a managed Node.js app stays reachable directly (shared IP + Host header,
 * hosting sub-domain), so the header alone proves nothing.
 *
 * Limits, the IP blocklist and velocity signals key on rateKeyIp(): an IPv6 client controls its whole
 * /64 (2^64 source addresses), so per-address buckets would be free to rotate.
 */
import { BlockList, isIP } from "node:net";
import { CLOUDFLARE_IPV4, CLOUDFLARE_IPV6 } from "./cloudflare-ips";

function trustedHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 1;
}

/** The 8 hextets of a syntactically valid IPv6 address (embedded dotted IPv4 tail included). */
function ipv6Hextets(v: string): number[] | null {
  let s = v;
  const tail: number[] = [];
  if (s.includes(".")) {
    const colon = s.lastIndexOf(":");
    const quad = s.slice(colon + 1).split(".").map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : -1));
    if (quad.length !== 4 || quad.some((n) => n < 0 || n > 255)) return null;
    tail.push((quad[0]! << 8) | quad[1]!, (quad[2]! << 8) | quad[3]!);
    s = s.slice(0, colon + 1);
    if (!s.endsWith("::")) s = s.slice(0, -1);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const groups = (x: string | undefined) => (x ? x.split(":").map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? Number.parseInt(g, 16) : -1)) : []);
  const head = groups(halves[0]);
  const rest = groups(halves[1]);
  const gap = 8 - tail.length - head.length - rest.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) return null;
  const out = [...head, ...new Array<number>(halves.length === 2 ? gap : 0).fill(0), ...rest, ...tail];
  return out.length === 8 && out.every((n) => n >= 0) ? out : null;
}

/**
 * An address as found in a header → its canonical form: trimmed, lower-case, brackets / port / zone id
 * removed, IPv4-mapped IPv6 ("::ffff:1.2.3.4") unwrapped to IPv4. null when it is not an IP address.
 */
export function canonicalIp(raw: string | null | undefined): string | null {
  let v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("[")) {
    const end = v.indexOf("]");
    if (end === -1) return null;
    v = v.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(v)) {
    v = v.slice(0, v.lastIndexOf(":"));
  }
  const zone = v.indexOf("%");
  if (zone !== -1) v = v.slice(0, zone);
  const kind = isIP(v);
  if (kind === 4) return v;
  if (kind !== 6) return null;
  const h = ipv6Hextets(v);
  if (!h) return null;
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) {
    return [h[6]! >> 8, h[6]! & 255, h[7]! >> 8, h[7]! & 255].join(".");
  }
  return v;
}

/**
 * The network an address stands for, as used by every per-IP limit, the IP blocklist and the
 * same-network velocity signal: IPv4 → the address itself; IPv6 → its /64 ("2001:db8:0:1::/64"),
 * the block a single subscriber, VPS or phone controls. Anything that is not an IP is returned
 * trimmed and lower-cased (one shared bucket, as before).
 */
export function rateKeyIp(ip: string): string {
  const c = canonicalIp(ip);
  if (!c) return ip.trim().toLowerCase();
  if (isIP(c) === 4) return c;
  const h = ipv6Hextets(c);
  return h ? `${h.slice(0, 4).map((x) => x.toString(16)).join(":")}::/64` : c;
}

let cloudflareRanges: BlockList | null = null;

/** Is `ip` inside Cloudflare's published edge ranges? */
export function isCloudflareIp(ip: string): boolean {
  const c = canonicalIp(ip);
  const kind = c ? isIP(c) : 0;
  if (!c || !kind) return false;
  if (!cloudflareRanges) {
    const list = new BlockList();
    for (const [ranges, family] of [
      [CLOUDFLARE_IPV4, "ipv4"],
      [CLOUDFLARE_IPV6, "ipv6"],
    ] as const) {
      for (const range of ranges) {
        const [net, prefix] = range.split("/");
        list.addSubnet(net!, Number(prefix), family);
      }
    }
    cloudflareRanges = list;
  }
  return cloudflareRanges.check(c, kind === 4 ? "ipv4" : "ipv6");
}

/** The address our own front proxy saw connecting (canonical when it is a valid IP). */
function proxyHop(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const pick = hops[Math.max(0, hops.length - trustedHops())];
    if (pick) return canonicalIp(pick) ?? pick;
  }
  const real = headers.get("x-real-ip")?.trim();
  return real ? (canonicalIp(real) ?? real) : null;
}

export function clientIp(headers: Headers): string {
  const hop = proxyHop(headers);
  if (process.env.BEHIND_CLOUDFLARE === "1" && hop && isCloudflareIp(hop)) {
    const cf = canonicalIp(headers.get("cf-connecting-ip"));
    if (cf) return cf;
  }
  return hop ?? "0.0.0.0";
}
