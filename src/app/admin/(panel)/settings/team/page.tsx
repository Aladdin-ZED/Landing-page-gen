import type { Metadata } from "next";
import { TeamPanel } from "@/components/admin/settings/team-panel";
import { listUsers, requireUser } from "@/lib/auth";
import { inviteUserAction, resetUserPasswordAction, setUserDisabledAction, setUserRoleAction } from "../actions";

export const metadata: Metadata = { title: "Team" };

export default async function TeamSettingsPage() {
  const user = await requireUser({ permission: "users.manage" });
  const users = await listUsers();
  return (
    <TeamPanel
      currentUserId={user.id}
      members={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        totpEnabled: u.totpEnabled,
        disabled: u.disabled,
        createdAt: u.createdAt.toISOString(),
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      }))}
      actions={{ invite: inviteUserAction, setRole: setUserRoleAction, setDisabled: setUserDisabledAction, resetPassword: resetUserPasswordAction }}
    />
  );
}
