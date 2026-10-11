import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { assertAdminAccess, countUsers, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { setupTokenSecret } from "@/lib/auth/config";
import { AuthHeading } from "../_components/auth-heading";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up" };

/** First-run only: needs SETUP_TOKEN and an empty users table; afterwards it is a plain 404. */
export default async function SetupPage() {
  await assertAdminAccess();
  if (!setupTokenSecret() || (await countUsers()) > 0) notFound();

  return (
    <>
      <AuthHeading eyebrow="First run" title="Create the owner account">
        This account has full control of the studio. You&apos;ll be asked to turn on two-step verification next.
      </AuthHeading>
      <SetupForm minPasswordLength={PASSWORD_MIN_LENGTH} />
    </>
  );
}
