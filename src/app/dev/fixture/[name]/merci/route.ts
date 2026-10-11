/** GET /dev/fixture/<name>/merci — fixture thank-you page (development only, 404 in production). */
import { connection, type NextRequest } from "next/server";
import { renderFixture } from "../../render";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string }> }): Promise<Response> {
  await connection();
  const { name } = await ctx.params;
  return renderFixture(req, name, "thanks");
}
