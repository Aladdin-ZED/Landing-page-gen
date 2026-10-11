import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { assertAdminAccess, getPendingMfa, getSessionUser, homePathFor, LOGIN_PATH, safeAdminPath } from "@/lib/auth";
import { logout } from "@/lib/auth/actions";
import { AuthHeading } from "../../_components/auth-heading";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Two-step verification" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** "s•••@example.com" — enough to recognise the account without spelling it out. */
function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}${"•".repeat(Math.min(Math.max(local.length - 1, 2), 6))}@${domain}`;
}

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  await assertAdminAccess();
  const params = await searchParams;
  const next = safeAdminPath(typeof params.next === "string" ? params.next : null);

  const pending = await getPendingMfa();
  if (!pending) {
    const user = await getSessionUser();
    redirect(user ? (next ?? homePathFor(user.role)) : LOGIN_PATH);
  }

  return (
    <>
      <AuthHeading eyebrow="Step 2 of 2" title="Confirm it's you">
        Open your authenticator app and enter the code for{" "}
        <span className="font-medium text-foreground">{maskEmail(pending.email)}</span>.
      </AuthHeading>
      <VerifyForm next={next} />
      <form action={logout} className="mt-8 border-t pt-6 text-center">
        <button
          type="submit"
          className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Cancel and sign in with another account
        </button>
      </form>
    </>
  );
}
