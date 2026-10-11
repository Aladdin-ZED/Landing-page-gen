import "server-only";
/**
 * Wrapper for admin server actions: requireUser(permission) first, then the work; every failure
 * becomes a short user-facing message (auth problems, validation, unexpected errors — the latter
 * logged without request data).
 */
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AuthError, AuthInputError, getRequestContext, requireUser, type Permission, type SessionUser } from "@/lib/auth";
import type { ActionResult } from "@/components/admin/lib/action-result";
import { errorSummary } from "@/lib/orders/log";

export type { ActionResult };

export interface ActionContext {
  user: SessionUser;
  actor: { id: string; ip: string | null };
}

/** Thrown inside an action to answer with a message (no logging). */
export class ActionError extends Error {}

export const fail = (message: string): never => {
  throw new ActionError(message);
};

export async function adminAction<T>(permission: Permission | null, fn: (ctx: ActionContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const user = await requireUser({ throwOnFail: true, ...(permission ? { permission } : {}) });
    const { ip } = await getRequestContext();
    const data = await fn({ user, actor: { id: user.id, ip: ip ?? null } });
    return { ok: true, data };
  } catch (err) {
    // notFound() (admin gate), redirect() and other Next control-flow errors must propagate
    unstable_rethrow(err);
    if (err instanceof ActionError) return { ok: false, error: err.message };
    if (err instanceof AuthInputError) return { ok: false, error: err.message };
    if (err instanceof AuthError) {
      return {
        ok: false,
        error: err.code === "forbidden" ? "Your role doesn't allow this action." : "Your session has ended — reload the page and sign in again.",
      };
    }
    if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Some fields are invalid." };
    // never the raw message: a failed query's message lists every bound value (e-mails, password hashes, phones)
    console.error("[admin-action]", errorSummary(err));
    return { ok: false, error: "Something went wrong on the server. Please try again." };
  }
}
