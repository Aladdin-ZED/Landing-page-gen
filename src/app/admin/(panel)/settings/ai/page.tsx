import type { Metadata } from "next";
import { AiSettingsForm } from "@/components/admin/settings/ai-settings";
import { can, requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { saveAiAction } from "../actions";

export const metadata: Metadata = { title: "Local AI" };

export default async function AiSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  const ai = await getSetting("ai", { fresh: true });
  return (
    <AiSettingsForm
      initial={{ enabled: ai.enabled, tier: ai.tier, bgRemoval: ai.bgRemoval }}
      canWrite={can(user.role, "settings.write")}
      save={saveAiAction}
    />
  );
}
