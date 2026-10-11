/**
 * Shape every admin server action returns, and the client helper that turns it into toasts.
 * Isomorphic types; `runAction` is used from client components only.
 */
import { toast } from "sonner";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Await a server action and report it: success toast (optional) or the action's error message.
 * Returns the data on success, undefined on failure.
 */
export async function runAction<T>(
  promise: Promise<ActionResult<T>>,
  messages: { success?: string | ((data: T) => string); error?: string } = {},
): Promise<T | undefined> {
  try {
    const res = await promise;
    if (res.ok) {
      const msg = typeof messages.success === "function" ? messages.success(res.data) : messages.success;
      if (msg) toast.success(msg);
      return res.data;
    }
    toast.error(res.error || messages.error || "That didn't work. Please try again.");
    return undefined;
  } catch {
    toast.error(messages.error ?? "Connection problem — check your network and try again.");
    return undefined;
  }
}
