import { randomBytes } from "node:crypto";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 26-char time-sortable id (ULID layout: 10 chars time + 16 chars randomness). */
export function newId(): string {
  let t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rnd = randomBytes(16);
  let r = "";
  for (let i = 0; i < 16; i++) r += CROCKFORD[rnd[i]! % 32];
  return time + r;
}

/** Human friendly order number: "CMD-7K3Q9X" (no ambiguous chars). */
export function newOrderId(prefix = "CMD"): string {
  const rnd = randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += CROCKFORD[rnd[i]! % 32];
  return `${prefix}-${s}`;
}

/** URL-safe random token (default 32 bytes → 43 chars). */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Public page key used by order endpoints (no secrets — just an identifier). */
export function newPublicKey(): string {
  return "pk_" + randomBytes(15).toString("base64url");
}
