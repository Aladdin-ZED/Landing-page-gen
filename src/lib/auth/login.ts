/**
 * Sign-in flows: password step and second-factor step.
 *
 * Anti-enumeration: one generic "invalid" error for unknown email / wrong password / disabled
 * account; unknown emails burn a full scrypt verification; the per-account lockout is keyed by the
 * (hashed) email whether or not an account exists, so lockouts reveal nothing either.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { buckets, clearBucket, limits } from "./attempts";
import { verifySecondFactor, type SecondFactorInput } from "./mfa";
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from "./password";
import type { Role } from "./permissions";
import { createSession, deleteSession, rotateSession, type IssuedSession } from "./session";
import { getUserByEmail, getUserById, normalizeEmail } from "./users";

export interface ClientContext {
  ip: string;
  ua: string;
}

export type PasswordLoginResult =
  | { ok: true; session: IssuedSession; role: Role; mfaRequired: boolean }
  | { ok: false; error: "invalid" | "rate_limited"; retryAfter?: number };

export async function loginWithPassword(
  input: { email: string; password: string },
  ctx: ClientContext,
): Promise<PasswordLoginResult> {
  const email = normalizeEmail(input.email).slice(0, 191);

  const ipLimit = await limits.loginIp(ctx.ip);
  if (!ipLimit.ok) {
    // log once per window, not on every blocked request
    if (ipLimit.count === ipLimit.limit + 1) await audit("auth.login.rate_limited", { target: email, ip: ctx.ip });
    return { ok: false, error: "rate_limited", retryAfter: ipLimit.retryAfter };
  }

  const accountLimit = await limits.loginAccount(email);
  if (!accountLimit.ok) {
    if (accountLimit.count === accountLimit.limit + 1) await audit("auth.login.locked", { target: email, ip: ctx.ip });
    return { ok: false, error: "rate_limited", retryAfter: accountLimit.retryAfter };
  }

  const user = await getUserByEmail(email);
  if (!user) {
    await burnPasswordCheck(input.password);
    await audit("auth.login.failure", { target: email, meta: { reason: "unknown_email" }, ip: ctx.ip });
    return { ok: false, error: "invalid" };
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid || user.disabled) {
    const lockedNow = accountLimit.count >= accountLimit.limit;
    await db
      .update(users)
      .set({
        failedLogins: user.failedLogins + 1,
        lockedUntil: lockedNow ? new Date(Date.now() + accountLimit.retryAfter * 1000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    await audit("auth.login.failure", {
      userId: user.id,
      target: email,
      meta: { reason: user.disabled ? "disabled" : "bad_password", attempt: accountLimit.count },
      ip: ctx.ip,
    });
    return { ok: false, error: "invalid" };
  }

  const updates: Partial<typeof users.$inferInsert> = { failedLogins: 0, lockedUntil: null };
  if (needsRehash(user.passwordHash)) updates.passwordHash = await hashPassword(input.password);

  if (user.totpEnabled) {
    // Account budget stays consumed until the second factor succeeds.
    await db.update(users).set(updates).where(eq(users.id, user.id));
    const session = await createSession(user.id, { mfaPassed: false, ip: ctx.ip, ua: ctx.ua });
    await audit("auth.login.mfa_pending", { userId: user.id, target: email, ip: ctx.ip });
    return { ok: true, session, role: user.role, mfaRequired: true };
  }

  await db
    .update(users)
    .set({ ...updates, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  await clearBucket(buckets.loginAccount(email));
  const session = await createSession(user.id, { mfaPassed: true, ip: ctx.ip, ua: ctx.ua });
  await audit("auth.login.success", { userId: user.id, target: email, meta: { mfa: false }, ip: ctx.ip });
  return { ok: true, session, role: user.role, mfaRequired: false };
}

export type SecondFactorLoginResult =
  | { ok: true; session: IssuedSession; role: Role; method: "totp" | "recovery"; recoveryRemaining?: number }
  | { ok: false; error: "invalid" | "locked" | "expired" };

/**
 * Completes a pending sign-in. Too many wrong codes end the pending session (password again).
 * On success the pending session is rotated into a fully authenticated one.
 */
export async function completeSecondFactor(
  pending: { sessionId: string; userId: string },
  input: SecondFactorInput,
  ctx: ClientContext,
): Promise<SecondFactorLoginResult> {
  const user = await getUserById(pending.userId);
  if (!user || user.disabled || !user.totpEnabled) {
    await deleteSession(pending.sessionId);
    return { ok: false, error: "expired" };
  }

  const [ipLimit, userLimit] = await Promise.all([limits.mfaIp(ctx.ip), limits.mfaUser(user.id)]);
  if (!ipLimit.ok || !userLimit.ok) {
    await deleteSession(pending.sessionId);
    await audit("auth.mfa.locked", { userId: user.id, target: user.email, ip: ctx.ip });
    return { ok: false, error: "locked" };
  }

  const result = await verifySecondFactor(user.id, input);
  if (!result.ok) {
    await audit("auth.mfa.failure", { userId: user.id, target: user.email, meta: { method: input.method }, ip: ctx.ip });
    return { ok: false, error: "invalid" };
  }

  await Promise.all([clearBucket(buckets.mfaUser(user.id)), clearBucket(buckets.loginAccount(user.email))]);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const session = await rotateSession({ id: pending.sessionId, userId: user.id }, { mfaPassed: true, ...ctx });

  if (result.method === "recovery") {
    await audit("auth.mfa.recovery_used", { userId: user.id, target: user.email, meta: { remaining: result.remaining }, ip: ctx.ip });
  }
  await audit("auth.login.success", { userId: user.id, target: user.email, meta: { mfa: result.method }, ip: ctx.ip });

  return result.method === "recovery"
    ? { ok: true, session, role: user.role, method: "recovery", recoveryRemaining: result.remaining }
    : { ok: true, session, role: user.role, method: "totp" };
}
