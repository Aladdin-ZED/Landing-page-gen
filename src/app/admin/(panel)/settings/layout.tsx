import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/common/page-header";
import { Screen } from "@/components/admin/common/screen";
import { SettingsNav } from "@/components/admin/settings/settings-nav";
import { requireUser } from "@/lib/auth";

/** Settings frame: heading + sub-navigation; each tab checks its own permission. */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <Screen>
      <PageHeader title="Settings" description="Your store, integrations, team and security, in one place." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <SettingsNav role={user.role} />
        <div className="grid min-w-0 grid-cols-1 content-start gap-5">{children}</div>
      </div>
    </Screen>
  );
}
