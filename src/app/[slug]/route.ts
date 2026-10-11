/**
 * GET/HEAD /<slug> — a published landing page: the stored HTML of its published version with the
 * version's hash CSP, brotli/gzip negotiated from Accept-Encoding (encoded once per version and kept
 * in memory), an ETag per representation (304 on revalidation) and a short shared cache.
 */
import { connection, type NextRequest } from "next/server";
import { getPublishedBySlug, isServableSlug } from "@/lib/render/publish.server";
import { canonicalRedirect, documentResponse, notFoundResponse, unavailableResponse } from "@/lib/render/serve.server";

type Params = { params: Promise<{ slug: string }> };

async function serve(req: NextRequest, ctx: Params): Promise<Response> {
  await connection();
  const { slug } = await ctx.params;
  const lower = slug.toLowerCase();
  if (lower !== slug && isServableSlug(lower)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${lower}`;
    return canonicalRedirect(url);
  }
  if (!isServableSlug(slug)) return notFoundResponse(req);
  let page;
  try {
    page = await getPublishedBySlug(slug);
  } catch (err) {
    console.error("[landing] lookup failed:", err instanceof Error ? err.message : "unknown error");
    return unavailableResponse(req);
  }
  if (!page) return notFoundResponse(req);
  return documentResponse(req, { html: page.html, csp: page.csp, etag: page.etag }, { kind: "landing", noindex: page.noindex });
}

export function GET(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}

export function HEAD(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}
