/**
 * GET/HEAD /<slug>/merci — thank-you page of a published landing page (noindex, never cached by HTTP
 * caches; the server keeps its brotli/gzip encoding per version). The order details are filled in the
 * browser from sessionStorage by the runtime.
 */
import { connection, type NextRequest } from "next/server";
import { getPublishedBySlug, isServableSlug } from "@/lib/render/publish.server";
import { documentResponse, notFoundResponse, unavailableResponse } from "@/lib/render/serve.server";

type Params = { params: Promise<{ slug: string }> };

async function serve(req: NextRequest, ctx: Params): Promise<Response> {
  await connection();
  const { slug } = await ctx.params;
  if (!isServableSlug(slug)) return notFoundResponse(req);
  let page;
  try {
    page = await getPublishedBySlug(slug);
  } catch (err) {
    console.error("[landing] lookup failed:", err instanceof Error ? err.message : "unknown error");
    return unavailableResponse(req);
  }
  if (!page) return notFoundResponse(req);
  return documentResponse(req, { html: page.thankYouHtml, csp: page.thankYouCsp }, { kind: "thanks" });
}

export function GET(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}

export function HEAD(req: NextRequest, ctx: Params): Promise<Response> {
  return serve(req, ctx);
}

/*
 * Every other method answers exactly like an unknown URL (left to Next, OPTIONS would answer 204 and
 * POST 405 with an Allow list, which told a page address apart from a hidden admin path).
 */
function unknownMethod(req: NextRequest): Response {
  return notFoundResponse(req);
}
export const OPTIONS = unknownMethod;
export const POST = unknownMethod;
export const PUT = unknownMethod;
export const PATCH = unknownMethod;
export const DELETE = unknownMethod;
