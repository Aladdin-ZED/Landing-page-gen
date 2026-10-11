/**
 * One-time recovery codes for 2FA.
 * Format "XXXX-XXXX-XXXX" over Crockford base32 (no I/L/O/U) → 60 bits each.
 * Only keyed SHA-256 digests (HMAC, purpose-bound key from APP_SECRET) are stored; codes are shown once.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { hmac, safeEqual } from "@/lib/security/crypto";

export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LEN = 12;

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  while (codes.length < count) {
    const bytes = randomBytes(CODE_LEN);
    let raw = "";
    for (const b of bytes) raw += ALPHABET[b & 31];
    const formatted = raw.replace(/(.{4})(?=.)/g, "$1-");
    if (!codes.includes(formatted)) codes.push(formatted);
  }
  return { codes, hashes: codes.map((c) => hashRecoveryCode(normalizeRecoveryCode(c)!)) };
}

/** Upper-cases, drops separators and maps look-alikes (O→0, I/L→1) per Crockford. Null if not a code. */
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return cleaned.length === CODE_LEN && [...cleaned].every((ch) => ALPHABET.includes(ch)) ? cleaned : null;
}

export function hashRecoveryCode(normalized: string): string {
  return hmac(normalized, "recovery-code");
}

/** Index of the matching stored digest (scans all entries in constant time per entry), or -1. */
export function findRecoveryCode(hashes: readonly string[], normalized: string): number {
  const candidate = hashRecoveryCode(normalized);
  let found = -1;
  hashes.forEach((h, i) => {
    if (safeEqual(h, candidate) && found === -1) found = i;
  });
  return found;
}
