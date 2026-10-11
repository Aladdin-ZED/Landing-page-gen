/**
 * GET/HEAD / — the home landing page: settings "home".pageId, else the page flagged as home, else the
 * most recently published page. Same headers as /<slug>; 404 when nothing is published.
 */
import { connection, type NextRequest } from "next/server";
import { getHomePublished } from "@/lib/render/publish.server";
import { documentResponse, notFoundResponse, unavailableResponse } from "@/lib/render/serve.server";

async function serve(req: NextRequest): Promise<Response> {
  await connection();
  let page;
  try {
    page = await getHomePublished();
  } catch (err) {
    console.error("[landing] home lookup failed:", err instanceof Error ? err.message : "unknown error");
    return unavailableResponse(req);
  }
  if (!page) return notFoundResponse(req);
  return documentResponse(req, { html: page.html, csp: page.csp, etag: page.etag }, { kind: "landing", noindex: page.noindex });
}

export function GET(req: NextRequest): Promise<Response> {
  return serve(req);
}

export function HEAD(req: NextRequest): Promise<Response> {
  return serve(req);
}
