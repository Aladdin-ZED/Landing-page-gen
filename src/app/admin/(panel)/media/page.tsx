import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/common/page-header";
import { Screen } from "@/components/admin/common/screen";
import { MediaLibrary } from "@/components/admin/media/media-library";
import { mediaCounts } from "@/lib/admin-data/assets";
import { can, requireUser } from "@/lib/auth";
import { assetToJson, listAssets } from "@/lib/media";
import { getSetting } from "@/lib/settings";
import { getAssetUsageAction, setAssetAltAction } from "./actions";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const user = await requireUser({ permission: "pages.read" });
  const [first, counts, ai] = await Promise.all([listAssets({ page: 1, pageSize: 48 }), mediaCounts(), getSetting("ai")]);

  return (
    <Screen wide>
      <PageHeader
        title="Media"
        description="Product photos, cutouts and clips for your pages. Uploads are re-encoded (metadata stripped) and served in modern formats at every size."
      />
      <MediaLibrary
        initial={{ items: first.items.map(assetToJson), total: first.total }}
        counts={counts}
        canWrite={can(user.role, "media.write")}
        ai={{ enabled: ai.enabled, tier: ai.tier, bgRemoval: ai.bgRemoval }}
        setAlt={setAssetAltAction}
        usage={getAssetUsageAction}
      />
    </Screen>
  );
}
