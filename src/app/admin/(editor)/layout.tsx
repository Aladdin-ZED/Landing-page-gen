import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/shell/providers";
import { getCspNonce, requireUser } from "@/lib/auth";

/*
 * Full-screen builder shell (no sidebar): theme, tooltips and toasts shared with the panel.
 * Every page below still calls requireUser() with its own permission.
 */
export default async function EditorLayout({ children }: { children: ReactNode }) {
  await requireUser({ permission: "pages.read" });
  const nonce = await getCspNonce();
  return <AdminProviders nonce={nonce}>{children}</AdminProviders>;
}
