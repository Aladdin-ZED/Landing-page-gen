/**
 * Attempt budgets for auth flows, on top of the shared DB rate limiter.
 * Pattern: every attempt consumes budget (atomic upsert in rateLimit()), a fully successful
 * sign-in clears the account budget. This makes lockouts race-free under concurrent guesses.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";
import { hashIp, hmac } from "@/lib/security/crypto";
import { rateLimit, type RateResult } from "@/lib/security/rate-limit";
import {
  LOGIN_ACCOUNT_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_WINDOW_SEC,
  MFA_IP_LIMIT,
  MFA_USER_LIMIT,
  MFA_WINDOW_SEC,
  SETUP_IP_LIMIT,
  SETUP_WINDOW_SEC,
} from "./config";

/** Bucket names never contain raw identifiers (emails/IPs are keyed-hashed). */
export const buckets = {
  loginIp: (ip: string) => `auth:login:ip:${hashIp(ip)}`,
  loginAccount: (email: string) => `auth:login:acct:${hmac(email, "login-account")}`,
  mfaIp: (ip: string) => `auth:mfa:ip:${hashIp(ip)}`,
  mfaUser: (userId: string) => `auth:mfa:user:${userId}`,
  mfaManage: (userId: string) => `auth:mfa:manage:${userId}`,
  passwordChange: (userId: string) => `auth:password:${userId}`,
  setupIp: (ip: string) => `auth:setup:ip:${hashIp(ip)}`,
};

export const limits = {
  loginIp: (ip: string) => rateLimit(buckets.loginIp(ip), LOGIN_IP_LIMIT, LOGIN_WINDOW_SEC),
  loginAccount: (email: string) => rateLimit(buckets.loginAccount(email), LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_SEC),
  mfaIp: (ip: string) => rateLimit(buckets.mfaIp(ip), MFA_IP_LIMIT, MFA_WINDOW_SEC),
  mfaUser: (userId: string) => rateLimit(buckets.mfaUser(userId), MFA_USER_LIMIT, MFA_WINDOW_SEC),
  /** 2FA enrollment / disable / regenerate — generous but bounded */
  mfaManage: (userId: string) => rateLimit(buckets.mfaManage(userId), 10, MFA_WINDOW_SEC),
  passwordChange: (userId: string) => rateLimit(buckets.passwordChange(userId), 5, LOGIN_WINDOW_SEC),
  setupIp: (ip: string) => rateLimit(buckets.setupIp(ip), SETUP_IP_LIMIT, SETUP_WINDOW_SEC),
} satisfies Record<string, (key: string) => Promise<RateResult>>;

export async function clearBucket(bucket: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.bucket, bucket.slice(0, 191)));
}
