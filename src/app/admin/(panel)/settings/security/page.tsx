import type { Metadata } from "next";
import { SecurityPanel } from "@/components/admin/settings/security-panel";
import { listDeviceSessions } from "@/lib/admin-data/security";
import { getTwoFactorStatus, PASSWORD_MIN_LENGTH, requireUser, TWO_FACTOR_OFF_NOTICE } from "@/lib/auth";
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from "../actions";

export const metadata: Metadata = { title: "Security" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Every role manages its own password, two-step verification and devices here. */
export default async function SecuritySettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  // whitelisted notice from /admin/two-factor?from=settings (never echo query text)
  const { notice } = await searchParams;
  const [twoFactor, sessions] = await Promise.all([getTwoFactorStatus(user.id), listDeviceSessions(user.id, user.sessionId)]);
  return (
    <SecurityPanel
      email={user.email}
      minLength={PASSWORD_MIN_LENGTH}
      twoFactor={twoFactor}
      twoFactorTurnedOff={notice === TWO_FACTOR_OFF_NOTICE}
      sessions={sessions}
      actions={{ changePassword: changePasswordAction, revokeSession: revokeSessionAction, revokeOthers: revokeOtherSessionsAction }}
    />
  );
}
