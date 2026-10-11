import type { Metadata } from "next";
import { AntiSpamForm } from "@/components/admin/settings/antispam-form";
import { can, requireUser } from "@/lib/auth";
import { getSetting, redactSetting } from "@/lib/settings";
import { saveTurnstileAction } from "../actions";

export const metadata: Metadata = { title: "Anti-spam" };

export default async function AntiSpamSettingsPage() {
  const user = await requireUser({ permission: "settings.read" });
  const turnstile = await getSetting("turnstile", { fresh: true });
  // until the owner saves keys, TURNSTILE_* environment variables act as the defaults
  const fromEnv =
    !!turnstile.siteKey && turnstile.siteKey === process.env.TURNSTILE_SITE_KEY?.trim() && turnstile.secretKey === process.env.TURNSTILE_SECRET_KEY?.trim();
  const shown = redactSetting("turnstile", turnstile);
  return (
    <AntiSpamForm
      initial={{ siteKey: shown.siteKey ?? "", secretKey: shown.secretKey ?? "" }}
      source={turnstile.siteKey ? (fromEnv ? "environment" : "saved") : "none"}
      canWrite={can(user.role, "settings.write")}
      save={saveTurnstileAction}
    />
  );
}
