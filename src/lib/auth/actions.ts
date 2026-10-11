"use server";
/**
 * Shared auth server actions. Usage in any admin component:
 *   <form action={logout}><button type="submit">Sign out</button></form>
 */
import { redirect } from "next/navigation";
import { assertAdminAccess, signOut } from "./index";
import { LOGIN_PATH } from "./paths";

export async function logout(): Promise<void> {
  // Server Functions are reachable by their id from any route: re-check the gate here too.
  await assertAdminAccess();
  await signOut();
  redirect(`${LOGIN_PATH}?notice=signed-out`);
}
