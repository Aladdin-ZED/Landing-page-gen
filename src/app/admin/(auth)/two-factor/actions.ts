"use server";

import { redirect } from "next/navigation";
import {
  AuthError,
  AuthInputError,
  getRequestContext,
  requireUser,
  rotateCurrentSession,
  SECURITY_SETTINGS_PATH,
  TWO_FACTOR_OFF_NOTICE,
  TWO_FACTOR_PATH,
} from "@/lib/auth";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTwoFactor,
  regenerateRecoveryCodes,
  type EnrollmentChallenge,
} from "@/lib/auth/mfa";
import { normalizeTotpInput } from "@/lib/auth/totp";
import { field } from "../_lib/form-state";

export type ChallengeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | ({ status: "challenge" } & EnrollmentChallenge);

export type CodesState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: "code" | "password" }
  | { status: "codes"; recoveryCodes: string[] };

export type DisableState = { status: "idle" } | { status: "error"; message: string; field?: "code" | "password" };

const SIGNED_OUT = "Your session has ended. Reload the page and sign in again.";

function failure(err: unknown): { message: string; field?: "code" | "password" } {
  if (err instanceof AuthInputError) {
    const f = err.field === "code" || err.field === "password" ? err.field : undefined;
    return { message: err.message, field: f };
  }
  if (err instanceof AuthError) return { message: SIGNED_OUT };
  throw err;
}

/** Used with useActionState; the previous state and form data are not needed. */
export async function beginEnrollmentAction(): Promise<ChallengeState> {
  try {
    const user = await requireUser({ throwOnFail: true });
    const { ip } = await getRequestContext();
    return { status: "challenge", ...(await beginTotpEnrollment(user.id, { ip })) };
  } catch (err) {
    return { status: "error", message: failure(err).message };
  }
}

export async function confirmEnrollmentAction(_prev: CodesState, data: FormData): Promise<CodesState> {
  const code = field(data, "code", 32);
  const password = field(data, "password", 1024);
  if (!normalizeTotpInput(code)) {
    return { status: "error", message: "Enter the 6-digit code from your authenticator app.", field: "code" };
  }
  if (!password) return { status: "error", message: "Enter your password to confirm it's you.", field: "password" };
  try {
    const user = await requireUser({ throwOnFail: true });
    const { ip } = await getRequestContext();
    // Step-up: the password is checked before 2FA turns on (a session alone is not enough).
    const { recoveryCodes } = await confirmTotpEnrollment(user.id, { code, password }, { ip });
    // Privilege change: fresh token here, and every other session (which never passed 2FA) ends.
    await rotateCurrentSession(user, { revokeOthers: true });
    return { status: "codes", recoveryCodes };
  } catch (err) {
    return { status: "error", ...failure(err) };
  }
}

export async function regenerateCodesAction(_prev: CodesState, data: FormData): Promise<CodesState> {
  const code = field(data, "code", 32);
  if (!normalizeTotpInput(code)) {
    return { status: "error", message: "Enter the 6-digit code from your authenticator app.", field: "code" };
  }
  try {
    const user = await requireUser({ throwOnFail: true });
    const { ip } = await getRequestContext();
    const { recoveryCodes } = await regenerateRecoveryCodes(user.id, code, { ip });
    return { status: "codes", recoveryCodes };
  } catch (err) {
    return { status: "error", ...failure(err) };
  }
}

export async function disableAction(_prev: DisableState, data: FormData): Promise<DisableState> {
  const password = field(data, "password", 1024);
  const code = field(data, "code", 64);
  // whitelisted return target (never a free-form URL)
  const fromSettings = field(data, "from", 16) === "settings";
  if (!password) return { status: "error", message: "Enter your password.", field: "password" };
  if (!code.trim()) return { status: "error", message: "Enter a code from your authenticator app or a recovery code.", field: "code" };
  try {
    const user = await requireUser({ throwOnFail: true });
    const { ip } = await getRequestContext();
    const method = normalizeTotpInput(code) ? "totp" : "recovery";
    await disableTwoFactor(user.id, password, { method, code }, { ip });
    await rotateCurrentSession(user);
  } catch (err) {
    return { status: "error", ...failure(err) };
  }
  redirect(fromSettings ? `${SECURITY_SETTINGS_PATH}?notice=${TWO_FACTOR_OFF_NOTICE}` : `${TWO_FACTOR_PATH}?notice=disabled`);
}
