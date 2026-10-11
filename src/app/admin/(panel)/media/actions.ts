"use server";
/**
 * Media library actions that aren't uploads (those go through /api/admin/media): alt text, and the
 * usage lookup shown before a file is deleted.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { adminAction, fail, type ActionResult } from "@/lib/admin-data/action";
import { ALT_MAX, assetUsage, cleanAlt, setAssetAlt, type AssetUsage } from "@/lib/admin-data/assets";

const AssetId = z.string().regex(/^[a-f0-9]{16,64}$/, { error: "Unknown file." });
const Alt = z.string().max(ALT_MAX * 2, { error: `Keep the alt text under ${ALT_MAX} characters.` });

/** Pages (and the store logo) that use a file — shown before deleting it. */
export async function getAssetUsageAction(id: string): Promise<ActionResult<AssetUsage>> {
  return adminAction("pages.read", async () => assetUsage(AssetId.parse(id)));
}

export async function setAssetAltAction(id: string, alt: string): Promise<ActionResult<{ alt: string }>> {
  return adminAction("media.write", async ({ actor }) => {
    const assetId = AssetId.parse(id);
    const value = cleanAlt(Alt.parse(alt));
    if (!(await setAssetAlt(assetId, value))) fail("This file no longer exists.");
    await audit("media.alt_updated", { userId: actor.id, target: assetId, ip: actor.ip });
    revalidatePath("/admin/media");
    return { alt: value };
  });
}
