/**
 * /admin/pages/new → the generator: new pages are always born there. A route handler, not a page,
 * so the answer is one 307 (see src/lib/auth/alias-route.ts); /admin/generate checks the user.
 */
import type { NextRequest } from "next/server";
import { adminAliasRedirect } from "@/lib/auth/alias-route";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest): Promise<Response> {
  return adminAliasRedirect("/admin/generate", req.method);
}
