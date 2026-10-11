import type { Metadata } from "next";
import type { ReactNode } from "react";
import { assertAdminAccess } from "@/lib/auth";

/*
 * Root of every /admin route (auth screens and the panel). Re-checks the admin gate in-process
 * (the proxy already did) — this also makes every admin route dynamic, which the per-request
 * CSP nonce requires. Pages must still call requireUser() themselves: a layout does not guard
 * the segments below it.
 */
export const metadata: Metadata = {
  title: { template: "%s · COD Studio", default: "COD Studio" },
  robots: { index: false, follow: false, nocache: true },
  // same-origin (see adminSecurityHeaders): a no-referrer page sends `Origin: null` on form POSTs
  referrer: "same-origin",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await assertAdminAccess();
  return children;
}
