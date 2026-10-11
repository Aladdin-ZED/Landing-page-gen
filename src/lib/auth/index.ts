/**
 * Auth public API. Every admin page, server action and admin route handler MUST call requireUser().
 *
 *   const user = await requireUser();                                      // page: redirects when signed out
 *   const user = await requireUser({ permission: "pages.write" });          // page: + permission (→ /admin/forbidden)
 *   const user = await requireUser({ permission: "orders.write", throwOnFail: true }); // action / route handler
 *
 * requireUser() also re-verifies the admin gate (signed cookie + IP allowlist) and answers 404
 * like an unknown URL when it is missing, so admin code never runs for un-gated visitors.
 */
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./cookies";
import { AuthError, AuthInputError } from "./errors";
import { limits } from "./attempts";
import { FORBIDDEN_PATH, loginUrl, verifyUrl } from "./paths";
import { can, type Permission, type Role } from "./permissions";
import { assertAdminAccess, getRequestContext, getRequestedAdminPath, hasAdminAccess } from "./request";
import { deleteSessionByToken, revokeUserSessions, rotateSession, validateSessionToken } from "./session";
import { changeUserPassword } from "./users";

export type { Role, Permission } from "./permissions";
export { can, ROLES, PERMISSIONS, ROLE_LABELS, isRole, permissionsFor, homePathFor } from "./permissions";
export { AuthError, AuthInputError, type AuthErrorCode } from "./errors";
export {
  ADMIN_HOME_PATH,
  LOGIN_PATH,
  VERIFY_PATH,
  SETUP_PATH,
  TWO_FACTOR_PATH,
  FORBIDDEN_PATH,
  SECURITY_SETTINGS_PATH,
  TWO_FACTOR_OFF_NOTICE,
  safeAdminPath,
  loginUrl,
} from "./paths";
export { assertAdminAccess, hasAdminAccess, getCspNonce, getRequestContext, type RequestContext } from "./request";
export { revokeUserSessions, purgeExpiredSessions } from "./session";
export {
  createUser,
  listUsers,
  countUsers,
  getUserById,
  normalizeEmail,
  resetUserPassword,
  resetUserTwoFactor,
  setUserRole,
  setUserDisabled,
  type UserSummary,
  type NewUserInput,
} from "./users";
export { checkPasswordPolicy, hashPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password";
export { getTwoFactorStatus, type TwoFactorStatus } from "./mfa";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  totpEnabled: boolean;
  sessionId: string;
}

/** A signed-in user who still owes the second factor. */
export interface PendingMfa {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
}

interface AuthState {
  user: SessionUser | null;
  pending: PendingMfa | null;
}

const resolveAuthState = cache(async (): Promise<AuthState> => {
  if (!(await hasAdminAccess())) return { user: null, pending: null };
  const session = await validateSessionToken(await readSessionToken());
  if (!session) return { user: null, pending: null };
  if (session.user.totpEnabled && !session.mfaPassed) {
    return {
      user: null,
      pending: { sessionId: session.id, userId: session.userId, email: session.user.email, name: session.user.name },
    };
  }
  if (!session.mfaPassed) {
    // 2FA was turned off while this login was half-way: make the user start over.
    return { user: null, pending: null };
  }
  return {
    user: { ...session.user, sessionId: session.id },
    pending: null,
  };
});

/** Returns the current user or null (no redirect). Cached per request. */
export async function getSessionUser(): Promise<SessionUser | null> {
  return (await resolveAuthState()).user;
}

/** The half-finished sign-in waiting for its second factor, if any. Cached per request. */
export async function getPendingMfa(): Promise<PendingMfa | null> {
  return (await resolveAuthState()).pending;
}

/**
 * Pages: redirects to /admin/login (or the 2FA step) when unauthenticated, to /admin/forbidden
 * when the permission is missing. Actions/route handlers: pass { throwOnFail: true } to get an
 * AuthError instead of a redirect.
 */
export async function requireUser(opts: { permission?: Permission; throwOnFail?: boolean } = {}): Promise<SessionUser> {
  await assertAdminAccess();
  const { user, pending } = await resolveAuthState();

  if (!user) {
    if (opts.throwOnFail) throw new AuthError(pending ? "mfa_required" : "unauthenticated");
    const back = await getRequestedAdminPath();
    redirect(pending ? verifyUrl(back) : loginUrl(back));
  }

  if (opts.permission && !can(user.role, opts.permission)) {
    if (opts.throwOnFail) throw new AuthError("forbidden");
    redirect(FORBIDDEN_PATH);
  }
  return user;
}

/** Ends the current session (server action / route handler only). Safe to call when signed out. */
export async function signOut(): Promise<void> {
  const token = await readSessionToken();
  const session = await validateSessionToken(token);
  await deleteSessionByToken(token);
  await clearSessionCookie();
  if (session) {
    const { ip } = await getRequestContext();
    await audit("auth.logout", { userId: session.userId, target: session.userId, ip });
  }
}

/**
 * Issues a fresh session token for the current user after a privilege change (2FA on/off,
 * password change) and sets the cookie. Server actions only.
 */
export async function rotateCurrentSession(user: SessionUser, opts: { revokeOthers?: boolean } = {}): Promise<SessionUser> {
  const ctx = await getRequestContext();
  const fresh = await rotateSession({ id: user.sessionId, userId: user.id }, { mfaPassed: true, ...ctx });
  await setSessionCookie(fresh.token, fresh.cookieExpiresAt);
  if (opts.revokeOthers) {
    const revoked = await revokeUserSessions(user.id, { exceptId: fresh.id });
    if (revoked > 0) await audit("auth.sessions.revoked", { userId: user.id, target: user.id, meta: { count: revoked }, ip: ctx.ip });
  }
  return { ...user, sessionId: fresh.id };
}

/** Signs out every other device of the current user. Returns how many sessions ended. */
export async function revokeOtherSessions(): Promise<number> {
  const user = await requireUser({ throwOnFail: true });
  const revoked = await revokeUserSessions(user.id, { exceptId: user.sessionId });
  const { ip } = await getRequestContext();
  await audit("auth.sessions.revoked", { userId: user.id, target: user.id, meta: { count: revoked }, ip });
  return revoked;
}

/**
 * Self-service password change for the current user (server actions). Ends all other sessions and
 * rotates the current one. Throws AuthInputError with a user-facing message on failure.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = await requireUser({ throwOnFail: true });
  const ctx = await getRequestContext();
  const rl = await limits.passwordChange(user.id);
  if (!rl.ok) throw new AuthInputError("Too many attempts. Wait a few minutes and try again.");
  await changeUserPassword(user.id, currentPassword, newPassword, { keepSessionId: user.sessionId, ip: ctx.ip });
  await rotateCurrentSession(user);
}
