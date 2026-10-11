import type { Metadata } from "next";
import { MarketForm } from "@/components/admin/settings/market-form";
import { can, requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { saveDefaultsAction } from "../actions";

export const metadata: Metadata = { title: "Market defaults" };

export default async function MarketSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  const d = await getSetting("defaults", { fresh: true });
  return <MarketForm initial={d} canWrite={can(user.role, "settings.write")} save={saveDefaultsAction} />;
}
