import "server-only";
/**
 * Plain HTTP redirects for admin alias URLs (/admin/pages/new, /admin/settings).
 *
 * As pages, those aliases sit inside the panel's loading boundary: Next.js has already streamed
 * the shell when `redirect()` runs, so it answers 200 and redirects on the client with a
 * `<meta http-equiv="refresh">` — a document load (bookmark, refresh, new tab) then loads the
 * target twice. A route handler answers before anything is rendered: one 307, nothing else.
 * Signed-out visitors are sent on as well; the target's own guard takes them to the sign-in page
 * with the right "back" path.
 */
import { hasAdminAccess } from "./request";
import { unknownPageResponse } from "./unknown-page";

/** `target` must be an absolute admin path ("/admin/…"); the Location stays relative to this host. */
export async function adminAliasRedirect(target: string, method = "GET"): Promise<Response> {
  if (!target.startsWith("/admin/") || target.startsWith("//")) throw new Error(`invalid admin alias target: ${target}`);
  // the proxy already refused un-gated requests; this is the same in-process re-check pages do
  if (!(await hasAdminAccess())) return unknownPageResponse(method);
  return new Response(null, { status: 307, headers: { Location: target, "Cache-Control": "private, no-store" } });
}
