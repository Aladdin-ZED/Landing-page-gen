import type { Metadata } from "next";
import { PixelsForm } from "@/components/admin/settings/pixels-form";
import { pageCounts } from "@/lib/admin-data/pages";
import { can, requireUser } from "@/lib/auth";
import { getSetting, redactSetting } from "@/lib/settings";
import { applyPixelsToPagesAction, savePixelsAction } from "../actions";

export const metadata: Metadata = { title: "Pixels" };

export default async function PixelsSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  const [pixels, trackingSecrets, counts] = await Promise.all([getSetting("pixels", { fresh: true }), getSetting("tracking_secrets", { fresh: true }), pageCounts()]);
  // tokens leave the server only as masks (••••3f9a)
  const secrets = redactSetting("tracking_secrets", trackingSecrets);
  return (
    <PixelsForm
      initial={{
        metaPixelId: pixels.metaPixelId ?? "",
        tiktokPixelId: pixels.tiktokPixelId ?? "",
        snapPixelId: pixels.snapPixelId ?? "",
        ga4Id: pixels.ga4Id ?? "",
        metaCapiToken: secrets.metaCapiToken ?? "",
        metaTestEventCode: secrets.metaTestEventCode ?? "",
        tiktokToken: secrets.tiktokToken ?? "",
        tiktokTestEventCode: secrets.tiktokTestEventCode ?? "",
        snapToken: secrets.snapToken ?? "",
        ga4ApiSecret: secrets.ga4ApiSecret ?? "",
      }}
      canWrite={can(user.role, "settings.write")}
      save={savePixelsAction}
      pages={{ total: counts.draft + counts.published, live: counts.published }}
      apply={can(user.role, "settings.write") && can(user.role, "pages.write") ? applyPixelsToPagesAction : null}
    />
  );
}
