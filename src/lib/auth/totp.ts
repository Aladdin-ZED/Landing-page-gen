/**
 * TOTP (RFC 6238 over RFC 4226 HOTP): HMAC-SHA1, 6 digits, 30-second steps, ±1 step drift.
 * Replay protection is the caller's job: verifyTotp() returns the matched time step and refuses
 * steps ≤ `lastStep`, so storing the returned step makes every code single-use.
 */
import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { safeEqual } from "@/lib/security/crypto";

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SEC = 30;
export const TOTP_DRIFT_STEPS = 1;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(clean)) throw new Error("invalid base32");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit random secret (RFC 4226 recommends ≥ 128 bits; 160 matches SHA-1's block output). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000 / TOTP_PERIOD_SEC);
}

export function hotp(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(msg).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpCode(secretBase32: string, step: number = totpStep()): string {
  return hotp(base32Decode(secretBase32), step);
}

/** Digits-only 6-digit code, or null. Accepts "123 456" / "123-456". */
export function normalizeTotpInput(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/**
 * Returns the matched time step, or null. Every candidate step in the window is computed and
 * compared in constant time; steps at or before `lastStep` are never accepted (replay).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { lastStep?: number | null; now?: number } = {},
): number | null {
  const normalized = normalizeTotpInput(code);
  if (!normalized) return null;
  const key = base32Decode(secretBase32);
  const current = totpStep(opts.now);
  const floor = opts.lastStep ?? -1;
  let matched: number | null = null;
  for (let step = current - TOTP_DRIFT_STEPS; step <= current + TOTP_DRIFT_STEPS; step++) {
    const ok = safeEqual(hotp(key, step), normalized);
    if (ok && step > floor && matched === null) matched = step;
  }
  return matched;
}

/** otpauth:// URI understood by Google Authenticator, 1Password, Aegis, Authy… */
export function otpauthUri(opts: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.account)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SEC),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** QR code for the otpauth URI as an SVG data URL (allowed by the admin CSP img-src data:). */
export async function totpQrDataUrl(uri: string): Promise<string> {
  const svg = await QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#1c1917", light: "#ffffff" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

/** "JBSW Y3DP EHPK 3PXP…" — easier to type into an authenticator by hand. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}
