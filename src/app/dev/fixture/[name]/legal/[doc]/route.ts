/** GET /dev/fixture/<name>/legal/<privacy|terms|shipping|contact> — fixture legal document (development only, 404 in production). */
import { connection, type NextRequest } from "next/server";
import { isLegalKind } from "@/landing/context";
import { notFoundResponse } from "@/lib/render/serve.server";
import { renderFixture } from "../../../render";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; doc: string }> }): Promise<Response> {
  await connection();
  const { name, doc } = await ctx.params;
  if (!isLegalKind(doc)) return notFoundResponse(req);
  return renderFixture(req, name, doc);
}
