import type { Metadata } from "next";
import { PixelsForm } from "@/components/admin/settings/pixels-form";
import { pageCounts } from "@/lib/admin-data/pages";
import { can, requireUser } from "@/lib/auth";
import { pixelFormValues } from "@/lib/pixels/store.server";
import { getSetting } from "@/lib/settings";
import { applyStorePixelsAction, savePixelSettingsAction, sendPixelTestAction } from "./actions";

export const metadata: Metadata = { title: "Pixels" };

export default async function PixelsSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  const [pixels, secrets, counts] = await Promise.all([getSetting("pixels", { fresh: true }), getSetting("tracking_secrets", { fresh: true }), pageCounts()]);
  const canWrite = can(user.role, "settings.write");
  return (
    <PixelsForm
      // tokens leave the server only as masks (••••3f9a)
      initial={pixelFormValues(pixels, secrets)}
      canWrite={canWrite}
      save={savePixelSettingsAction}
      test={canWrite ? sendPixelTestAction : null}
      pages={{ total: counts.draft + counts.published, live: counts.published }}
      apply={canWrite && can(user.role, "pages.write") ? applyStorePixelsAction : null}
    />
  );
}
