"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertAdminAccess, getRequestContext, homePathFor, normalizeEmail, safeAdminPath } from "@/lib/auth";
import { readSessionToken, setSessionCookie } from "@/lib/auth/cookies";
import { loginWithPassword } from "@/lib/auth/login";
import { verifyUrl } from "@/lib/auth/paths";
import { deleteSessionByToken } from "@/lib/auth/session";
import { field, formError, type FieldErrors, type FormState } from "../_lib/form-state";

const INVALID = "That email and password don't match an account.";
const LIMITED = "Too many sign-in attempts. Wait a few minutes, then try again.";

export async function loginAction(_prev: FormState, data: FormData): Promise<FormState> {
  await assertAdminAccess();

  const email = field(data, "email", 320).trim();
  const password = field(data, "password", 1024);
  const next = safeAdminPath(field(data, "next", 512));

  const fieldErrors: FieldErrors = {};
  if (!email) fieldErrors.email = "Enter your email address.";
  else if (!z.email().safeParse(normalizeEmail(email)).success) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) return formError(undefined, fieldErrors, { email });

  // A new sign-in always starts from a clean slate: drop whatever session this browser carried.
  await deleteSessionByToken(await readSessionToken());

  const result = await loginWithPassword({ email, password }, await getRequestContext());
  if (!result.ok) return formError(result.error === "rate_limited" ? LIMITED : INVALID, undefined, { email });

  await setSessionCookie(result.session.token, result.session.cookieExpiresAt);
  redirect(result.mfaRequired ? verifyUrl(next) : (next ?? homePathFor(result.role)));
}
