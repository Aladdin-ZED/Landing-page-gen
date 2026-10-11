/**
 * /admin/settings → the first settings tab this user may open: Store for roles that can read the
 * store settings, Security (their own account) for everyone else. A route handler, not a page, so
 * the answer is one 307 (see src/lib/auth/alias-route.ts). Signed-out visitors go to Store, whose
 * guard sends them to the sign-in page.
 */
import type { NextRequest } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { adminAliasRedirect } from "@/lib/auth/alias-route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  const target = user && !can(user.role, "settings.read") ? "/admin/settings/security" : "/admin/settings/store";
  return adminAliasRedirect(target, req.method);
}
