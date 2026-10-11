"use server";
/**
 * Exported sites: revoke an export's key (its forms stop sending orders to this store).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { revokeExport } from "@/lib/admin-data/exports";

const ExportId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, { error: "Unknown export." });

export async function revokeExportAction(id: string): Promise<ActionResult<null>> {
  return adminAction("export.create", async ({ actor }) => {
    if (!(await revokeExport(ExportId.parse(id), actor))) fail("This export is already revoked.");
    revalidatePath("/admin/exports");
    return null;
  });
}
