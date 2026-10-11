"use server";
/**
 * Version history mutations: star, restore as the page's draft, duplicate as a new page.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { audit } from "@/lib/audit";
import { duplicateVersionAsPage, EditorError, restoreVersion, setVersionStarred } from "@/lib/admin-data/history";

const VersionId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, { error: "Unknown version." });

export async function starVersionAction(id: string, starred: boolean): Promise<ActionResult<null>> {
  return adminAction("pages.write", async ({ actor }) => {
    const versionId = VersionId.parse(id);
    const value = z.boolean().parse(starred);
    if (!(await setVersionStarred(versionId, value))) fail("This version no longer exists.");
    await audit(value ? "page.version_starred" : "page.version_unstarred", { userId: actor.id, target: versionId, ip: actor.ip });
    revalidatePath("/admin/history");
    return null;
  });
}

export async function restoreVersionAction(id: string): Promise<ActionResult<{ pageId: string }>> {
  return adminAction("pages.write", async ({ user, actor }) => {
    try {
      const res = await restoreVersion(VersionId.parse(id), user, actor);
      revalidatePath("/admin/history");
      revalidatePath("/admin/pages");
      return res;
    } catch (err) {
      if (err instanceof EditorError) {
        return fail(err.code === "conflict" ? "This page changed a moment ago (it may be open in the builder). Try again." : err.message);
      }
      throw err;
    }
  });
}

export async function duplicateVersionAction(id: string): Promise<ActionResult<{ id: string; slug: string }>> {
  return adminAction("pages.write", async ({ actor }) => {
    const res = (await duplicateVersionAsPage(VersionId.parse(id), actor)) ?? fail("This version can't be copied (it no longer exists or can't be rendered).");
    revalidatePath("/admin/history");
    revalidatePath("/admin/pages");
    return res;
  });
}
