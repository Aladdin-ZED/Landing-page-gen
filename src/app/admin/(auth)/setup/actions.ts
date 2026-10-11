"use server";

import { createHash } from "node:crypto";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { audit } from "@/lib/audit";
import { assertAdminAccess, AuthInputError, countUsers, getRequestContext, TWO_FACTOR_PATH } from "@/lib/auth";
import { limits } from "@/lib/auth/attempts";
import { setupTokenSecret } from "@/lib/auth/config";
import { setSessionCookie } from "@/lib/auth/cookies";
import { createSession } from "@/lib/auth/session";
import { createFirstOwner } from "@/lib/auth/users";
import { errorSummary } from "@/lib/orders/log";
import { safeEqual } from "@/lib/security/crypto";
import { field, formError, type FieldErrors, type FormState } from "../_lib/form-state";

const digest = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

export async function setupAction(_prev: FormState, data: FormData): Promise<FormState> {
  await assertAdminAccess();
  const expected = setupTokenSecret();
  if (!expected || (await countUsers()) > 0) notFound();

  const ctx = await getRequestContext();
  const values = { name: field(data, "name", 200), email: field(data, "email", 320).trim() };

  const rl = await limits.setupIp(ctx.ip);
  if (!rl.ok) return formError("Too many attempts. Wait a few minutes, then try again.", undefined, values);

  // Digest comparison: constant time regardless of where the strings differ (or their lengths).
  if (!safeEqual(digest(field(data, "token", 256).trim()), digest(expected))) {
    await audit("auth.setup.failure", { meta: { reason: "bad_token" }, ip: ctx.ip });
    return formError(undefined, { token: "This setup token isn't valid." }, values);
  }

  const password = field(data, "password", 1024);
  const confirm = field(data, "confirm", 1024);
  const fieldErrors: FieldErrors = {};
  if (!values.name.trim()) fieldErrors.name = "Enter your name.";
  if (!values.email) fieldErrors.email = "Enter your email address.";
  if (!password) fieldErrors.password = "Choose a password.";
  else if (password !== confirm) fieldErrors.confirm = "The passwords don't match.";
  if (Object.keys(fieldErrors).length) return formError(undefined, fieldErrors, values);

  let ownerId: string;
  try {
    const owner = await createFirstOwner({ name: values.name, email: values.email, password });
    if (!owner) notFound();
    ownerId = owner.id;
  } catch (err) {
    if (err instanceof AuthInputError) {
      return formError(err.field ? undefined : err.message, err.field ? { [err.field]: err.message } : undefined, values);
    }
    unstable_rethrow(err); // notFound() and other Next control flow
    // Logged here by code only: left to Next's default logging, a failed INSERT would print its
    // bound values (the owner's e-mail and password hash) to the server log.
    console.error("[setup] owner creation failed:", errorSummary(err));
    return formError("Something went wrong on the server. Please try again.", undefined, values);
  }

  await audit("auth.setup.owner_created", { userId: ownerId, target: ownerId, ip: ctx.ip });
  const session = await createSession(ownerId, { mfaPassed: true, ...ctx });
  await setSessionCookie(session.token, session.cookieExpiresAt);
  redirect(`${TWO_FACTOR_PATH}?from=setup`);
}
