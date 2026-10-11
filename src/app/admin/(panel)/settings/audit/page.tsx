import type { Metadata } from "next";
import { AuditLog } from "@/components/admin/settings/audit-log";
import { auditPage } from "@/lib/admin-data/security";
import { STATS_TZ } from "@/lib/admin-data/time";
import { requireUser } from "@/lib/auth";
import { loadAuditAction } from "../actions";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditSettingsPage() {
  await requireUser({ permission: "users.manage" });
  const initial = await auditPage({ limit: 50 });
  return <AuditLog initial={initial} timeZone={STATS_TZ} load={loadAuditAction} />;
}
