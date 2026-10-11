/**
 * GET /admin/preview/<pageId>[?v=<versionId>] — authenticated full-page preview of the current
 * draft (or of one version), rendered by the real publish renderer in a new tab.
 *
 * The response travels under the admin CSP set by the proxy (nonce + strict-dynamic), so the
 * landing runtime's inline <script> gets that nonce (see renderDraftPreview). Nothing is cached
 * and the page is never indexed.
 */
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { AuthError, getCspNonce, requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pages, pageVersions } from "@/lib/db/schema";
import { renderDraftPreview } from "@/lib/editor/preview.server";

type Ctx = { params: Promise<{ id: string }> };

const ROW_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function plain(status: number, text: string): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  try {
    await requireUser({ permission: "pages.read", throwOnFail: true });
  } catch (err) {
    if (err instanceof AuthError) return plain(err.status, err.code === "forbidden" ? "Forbidden" : "Sign in to preview this page.");
    throw err;
  }

  const { id } = await ctx.params;
  const versionId = req.nextUrl.searchParams.get("v");
  if (!ROW_ID.test(id) || (versionId !== null && !ROW_ID.test(versionId))) return plain(404, "Not found");

  const [page] = await db.select({ slug: pages.slug, draft: pages.draft }).from(pages).where(eq(pages.id, id)).limit(1);
  if (!page) return plain(404, "Not found");
  let source: unknown = page.draft;
  if (versionId) {
    const [v] = await db
      .select({ doc: pageVersions.doc })
      .from(pageVersions)
      .where(and(eq(pageVersions.id, versionId), eq(pageVersions.pageId, id)))
      .limit(1);
    if (!v) return plain(404, "Not found");
    source = v.doc;
  }

  const preview = await renderDraftPreview(source, page.slug, { nonce: await getCspNonce() });
  if (!preview.ok) return plain(422, "This draft has errors that prevent a preview. Fix them in the builder.");

  return new Response(preview.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
