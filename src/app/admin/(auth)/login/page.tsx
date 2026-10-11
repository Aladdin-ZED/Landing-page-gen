import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  assertAdminAccess,
  countUsers,
  getPendingMfa,
  getSessionUser,
  homePathFor,
  safeAdminPath,
  SETUP_PATH,
} from "@/lib/auth";
import { setupTokenSecret } from "@/lib/auth/config";
import { verifyUrl } from "@/lib/auth/paths";
import { AuthHeading } from "../_components/auth-heading";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Whitelisted notices (never echo arbitrary query text into the page). */
const NOTICES = {
  "mfa-locked": "Too many incorrect codes. Sign in again in a few minutes.",
  "mfa-expired": "Your sign-in timed out before the code was entered. Please sign in again.",
  "signed-out": "You have been signed out.",
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  await assertAdminAccess();
  const params = await searchParams;
  const next = safeAdminPath(typeof params.next === "string" ? params.next : null);

  const user = await getSessionUser();
  if (user) redirect(next ?? homePathFor(user.role));
  if (await getPendingMfa()) redirect(verifyUrl(next));

  const noticeKey = typeof params.notice === "string" ? params.notice : "";
  const notice = Object.hasOwn(NOTICES, noticeKey) ? NOTICES[noticeKey as keyof typeof NOTICES] : null;
  const canSetup = setupTokenSecret() !== null && (await countUsers()) === 0;

  return (
    <>
      <AuthHeading title="Welcome back">
        Sign in to build pages and follow your orders.
      </AuthHeading>
      {notice && (
        <Alert className="mb-5" role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <LoginForm next={next} />
      {canSetup && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          First time here?{" "}
          <Link href={SETUP_PATH} className="font-medium text-foreground underline underline-offset-4">
            Create the owner account
          </Link>
        </p>
      )}
    </>
  );
}
