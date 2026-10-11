/**
 * GET/HEAD /legal/<privacy|terms|shipping|contact>?p=<slug> — a legal document dressed in the theme
 * and language of the published page <slug> (else of the home page), built from the current store
 * settings. Static HTML (no script), hash CSP, brotli/gzip (encoded once per rendered document),
 * ETag per representation + 304, short shared cache, noindex.
 */
import { connection, type NextRequest } from "next/server";
import { isLegalKind } from "@/landing/context";
import { getLegalDocument, getLegalSource } from "@/lib/render/publish.server";
import { documentResponse, notFoundResponse, unavailableResponse } from "@/lib/render/serve.server";

type Params = { params: Promise<{ doc: string }> };

async function serve(req: NextRequest, ctx: Params): Promise<Response> {
  await connection();
  const { doc: kind } = await ctx.params;
  if (!isLegalKind(kind)) return notFoundResponse(req);
  // ?p= is only a theme hint: anything that is not a plain slug falls back to the home page
  const p = req.nextUrl.searchParams.get("p");
  const slug = p && p.length <= 80 ? p.toLowerCase() : null;
  let legal;
  try {
    const page = await getLegalSource(slug);
    if (!page) return notFoundResponse(req);
    legal = await getLegalDocument(page, kind);
  } catch (err) {
    console.error("[legal] render failed:", err instanceof Error ? err.message : "unknown error");
    return unavailableResponse(req);
  }
  if (!legal) return notFoundResponse(req);
  return documentResponse(req, { html: legal.html, csp: legal.csp, etag: legal.etag }, { kind: "legal" });
}

export function GET(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}

export function HEAD(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}
