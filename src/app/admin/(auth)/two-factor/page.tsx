import type { Metadata } from "next";
import { getTwoFactorStatus, homePathFor, requireUser, SECURITY_SETTINGS_PATH } from "@/lib/auth";
import { AuthHeading } from "../_components/auth-heading";
import { TwoFactorManager } from "./two-factor-manager";

export const metadata: Metadata = { title: "Two-step verification" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TwoFactorPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const status = await getTwoFactorStatus(user.id);
  const params = await searchParams;
  // opened from Settings → Security: every exit (done, new codes, turned off) leads back there
  const fromSettings = params.from === "settings";

  // Whitelisted notices only (never echo query text).
  let notice: string | null = null;
  if (params.notice === "disabled" && !status.enabled) notice = "Two-step verification is off.";
  if (params.notice === "recovery-used" && status.enabled) {
    notice = `You signed in with a recovery code — ${status.recoveryCodesRemaining} left. Generate new ones if you are running low.`;
  }

  return (
    <>
      <AuthHeading title="Two-step verification">
        {status.enabled
          ? "A code from your phone is required at every sign-in."
          : "Add a code from your phone to every sign-in, so a leaked password alone can't open the studio."}
      </AuthHeading>
      <TwoFactorManager
        enabled={status.enabled}
        remaining={status.recoveryCodesRemaining}
        continueHref={fromSettings ? SECURITY_SETTINGS_PATH : homePathFor(user.role)}
        fromSetup={params.from === "setup"}
        fromSettings={fromSettings}
        notice={notice}
      />
    </>
  );
}
