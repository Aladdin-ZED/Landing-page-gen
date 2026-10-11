import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "@/components/admin/styles/admin.css";
import { AppSidebar } from "@/components/admin/shell/app-sidebar";
import { CommandPaletteProvider } from "@/components/admin/shell/command-palette";
import { AdminProviders } from "@/components/admin/shell/providers";
import { Topbar } from "@/components/admin/shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { navCounts } from "@/lib/admin-data/dashboard";
import { can, getCspNonce, requireUser } from "@/lib/auth";
import { publicOrigin } from "@/lib/render/publish.server";
import { getSetting } from "@/lib/settings";
import { searchAction } from "./actions";

/*
 * The studio shell: inset sidebar (role-aware), frosted top bar with ⌘K, theme and toasts.
 * Every page below still calls requireUser() itself (a layout does not guard its children).
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [nonce, store, counts, jar] = await Promise.all([
    getCspNonce(),
    getSetting("store"),
    can(user.role, "orders.read") ? navCounts() : Promise.resolve(null),
    cookies(),
  ]);
  const sidebarOpen = jar.get("sidebar_state")?.value !== "false";
  const origin = publicOrigin();

  return (
    <AdminProviders nonce={nonce}>
      <CommandPaletteProvider role={user.role} search={searchAction}>
        <SidebarProvider defaultOpen={sidebarOpen} className="bg-sidebar">
          <AppSidebar
            user={{ name: user.name, email: user.email, role: user.role, totpEnabled: user.totpEnabled }}
            storeName={store.storeName}
            counts={counts}
          />
          <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:shadow-[0_0_0_1px_var(--sidebar-border),0_1px_2px_rgb(0_0_0/0.03),0_24px_48px_-32px_rgb(0_0_0/0.18)]">
            <Topbar storeUrl={can(user.role, "pages.read") ? (origin ?? "/") : null} />
            <div className="flex min-w-0 flex-1 flex-col">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </CommandPaletteProvider>
    </AdminProviders>
  );
}
