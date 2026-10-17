import type { Metadata } from "next";
import { PixelLibrary } from "@/components/admin/pixels/pixel-library";
import { can, requireUser } from "@/lib/auth";
import { pixelLibraryView } from "@/lib/pixels/library.server";

export const metadata: Metadata = { title: "Pixels" };

/** Settings → Pixels: the pixel library (pages own their pixels; docs/OFFERS.md §A.4). */
export default async function PixelsSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  // tokens leave the server only as masks (••••3f9a), and only for owners
  const view = await pixelLibraryView({ canCreate: can(user.role, "settings.write"), fresh: true });
  return <PixelLibrary initial={view} canPages={can(user.role, "pages.write")} canPublish={can(user.role, "pages.publish")} />;
}
