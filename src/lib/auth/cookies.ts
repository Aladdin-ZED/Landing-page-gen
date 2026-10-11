/**
 * Session cookie glue (Next.js request APIs). Writes only work in Server Actions / Route Handlers.
 */
import "server-only";
import { cookies } from "next/headers";
import { IS_PROD, SESSION_COOKIE } from "./config";

const base = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax" as const,
  path: "/",
};

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { ...base, expires });
}

/** Expires the cookie with the same attributes it was set with (required for `__Host-` cookies). */
export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, "", { ...base, maxAge: 0, expires: new Date(0) });
}
