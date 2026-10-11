/**
 * Random identifiers (pure; crypto is passed in so the preview iframe / tests can supply theirs).
 * crypto.randomUUID only exists in secure contexts — exports opened over http fall back to
 * getRandomValues, and ancient engines to Math.random (ids are dedup keys, not secrets).
 */

export type CryptoLike = { getRandomValues?: Crypto["getRandomValues"]; randomUUID?: () => string } | null | undefined;

export function randomBytes(n: number, c?: CryptoLike): Uint8Array {
  const b = new Uint8Array(n);
  try {
    if (c && typeof c.getRandomValues === "function") {
      c.getRandomValues(b);
      return b;
    }
  } catch {
    /* fall through */
  }
  for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
}

/** RFC 4122 v4, lowercase (matches the order contract /^[a-f0-9-]{36}$/). */
export function uuid(c?: CryptoLike): string {
  try {
    if (c && typeof c.randomUUID === "function") return c.randomUUID().toLowerCase();
  } catch {
    /* insecure context */
  }
  const b = randomBytes(16, c);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  let h = "";
  for (let i = 0; i < 16; i++) {
    h += (b[i]! + 0x100).toString(16).slice(1);
    if (i === 3 || i === 5 || i === 7 || i === 9) h += "-";
  }
  return h;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** URL-safe random id ([A-Za-z0-9_-]), e.g. the anonymous visitor id. */
export function randomId(len: number, c?: CryptoLike): string {
  const b = randomBytes(len, c);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET.charAt(b[i]! & 63);
  return s;
}
