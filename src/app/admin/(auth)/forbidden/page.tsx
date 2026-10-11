import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { homePathFor, requireUser, ROLE_LABELS } from "@/lib/auth";
import { logout } from "@/lib/auth/actions";
import { AuthHeading } from "../_components/auth-heading";

export const metadata: Metadata = { title: "No access" };

/** Where requireUser({ permission }) sends signed-in users who lack the permission. */
export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <>
      <AuthHeading title="This area isn't part of your role">
        You&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span> (
        {ROLE_LABELS[user.role]}). Ask an owner if you need access.
      </AuthHeading>
      <div className="grid gap-3">
        <Button asChild size="lg" className="h-10 w-full">
          <Link href={homePathFor(user.role)}>Go to your workspace</Link>
        </Button>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="lg" className="h-10 w-full text-muted-foreground">
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
