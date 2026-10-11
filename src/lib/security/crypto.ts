import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { isPlaceholderSecret } from "@/lib/auth/config";
import { rateKeyIp } from "./ip";

function secret(): Buffer {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 32) throw new Error("APP_SECRET must be set (32+ chars)");
  // a template value is public: nothing may be encrypted or signed with it (same rule as auth/config)
  if (isPlaceholderSecret(s)) throw new Error("APP_SECRET is still a template value — generate a random one");
  return Buffer.from(s, "utf8");
}

const keyCache = new Map<string, Buffer>();
/** Derive a purpose-bound 32-byte key from APP_SECRET (HKDF-SHA256). */
export function deriveKey(purpose: string): Buffer {
  let k = keyCache.get(purpose);
  if (!k) {
    k = Buffer.from(hkdfSync("sha256", secret(), Buffer.from("cod-studio"), Buffer.from(purpose), 32));
    keyCache.set(purpose, k);
  }
  return k;
}

/** AES-256-GCM envelope: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function encrypt(plain: string, purpose = "settings"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", deriveKey(purpose), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(envelope: string, purpose = "settings"): string {
  const [v, iv, tag, ct] = envelope.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("bad envelope");
  const tagBuf = Buffer.from(tag, "base64url");
  if (tagBuf.length !== 16) throw new Error("bad envelope");
  const d = createDecipheriv("aes-256-gcm", deriveKey(purpose), Buffer.from(iv, "base64url"), { authTagLength: 16 });
  d.setAuthTag(tagBuf);
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** HMAC-SHA256 hex with a purpose-bound key. */
export function hmac(data: string, purpose: string): string {
  return createHmac("sha256", deriveKey(purpose)).update(data).digest("hex");
}

/** Short url-safe signature (for cookies / tokens). */
export function sign(data: string, purpose: string): string {
  return createHmac("sha256", deriveKey(purpose)).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Stable pseudonymous hash of a client's network (never store raw IPs): the IPv4 address, or the /64
 * of an IPv6 address (see rateKeyIp) — so rate limits, the IP blocklist and velocity signals cannot
 * be dodged by rotating addresses inside one IPv6 allocation.
 */
export function hashIp(ip: string): string {
  return hmac(rateKeyIp(ip), "ip");
}
