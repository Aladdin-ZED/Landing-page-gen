"use server";
/**
 * Pages screen mutations. Each one: requireUser(permission) → validate the id → mutate → audit
 * (inside the data helpers) → revalidate the screens that show pages.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { archivePage, deletePage, duplicatePage, restoreArchivedPage, setHomePage, unpublishPage } from "@/lib/admin-data/pages";
import { publishPage, PublishError } from "@/lib/render/publish.server";

const PageId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, { error: "Unknown page." });

function refresh() {
  revalidatePath("/admin/pages");
  revalidatePath("/admin");
  revalidatePath("/admin/history");
}

export async function duplicatePageAction(id: string): Promise<ActionResult<{ id: string; slug: string }>> {
  return adminAction("pages.write", async ({ actor }) => {
    const created = (await duplicatePage(PageId.parse(id), actor)) ?? fail("This page no longer exists.");
    refresh();
    return created;
  });
}

export async function publishPageAction(id: string): Promise<ActionResult<{ slug: string; warnings: number; skippedSections: number }>> {
  return adminAction("pages.publish", async ({ user }) => {
    try {
      const res = await publishPage(PageId.parse(id), user.id);
      refresh();
      return { slug: res.slug, warnings: res.issues.length, skippedSections: res.renderIssues.length };
    } catch (err) {
      if (err instanceof PublishError) {
        const first = err.issues.find((i) => i.level === "error");
        return fail(first ? `${err.message} (${first.path}: ${first.message})` : err.message);
      }
      throw err;
    }
  });
}

export async function unpublishPageAction(id: string): Promise<ActionResult<null>> {
  return adminAction("pages.publish", async ({ actor }) => {
    if (!(await unpublishPage(PageId.parse(id), actor))) fail("This page isn't live.");
    refresh();
    return null;
  });
}

export async function setHomePageAction(id: string | null): Promise<ActionResult<null>> {
  return adminAction("pages.publish", async ({ actor }) => {
    if (!(await setHomePage(id === null ? null : PageId.parse(id), actor))) fail("Archived pages can't be the home page.");
    refresh();
    return null;
  });
}

export async function archivePageAction(id: string): Promise<ActionResult<null>> {
  return adminAction("pages.write", async ({ actor }) => {
    if (!(await archivePage(PageId.parse(id), actor))) fail("This page is already archived.");
    refresh();
    return null;
  });
}

export async function restorePageAction(id: string): Promise<ActionResult<null>> {
  return adminAction("pages.write", async ({ actor }) => {
    if (!(await restoreArchivedPage(PageId.parse(id), actor))) fail("This page isn't archived.");
    refresh();
    return null;
  });
}

export async function deletePageAction(id: string): Promise<ActionResult<null>> {
  return adminAction("pages.write", async ({ actor }) => {
    if (!(await deletePage(PageId.parse(id), actor))) fail("This page no longer exists.");
    refresh();
    return null;
  });
}
