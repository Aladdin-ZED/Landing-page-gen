import { LockKeyholeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AdminProviders } from "@/components/admin/shell/providers";
import { getCspNonce } from "@/lib/auth";
import { ArtPanel, daySeed } from "./_components/art-panel";

/*
 * Split layout for sign-in, 2FA and setup: generative art panel on large screens, a slim art band
 * on small ones, and a calm, centred form column. The same theme provider as the panel, so the
 * form column follows the light/dark choice too (the art panel is always dark).
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const seed = daySeed();
  const nonce = await getCspNonce();
  return (
    <AdminProviders nonce={nonce}>
      <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ArtPanel variant="full" idPrefix="art-full" seed={seed} className="hidden lg:flex" />
        <div className="flex min-h-dvh flex-col bg-background">
          <ArtPanel variant="band" idPrefix="art-band" seed={seed} className="lg:hidden" />
          <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
            <div className="w-full max-w-[22.5rem]">{children}</div>
          </main>
          <footer className="flex items-center justify-center gap-1.5 px-6 pb-6 text-xs text-muted-foreground sm:px-10">
            <LockKeyholeIcon aria-hidden="true" className="size-3.5" />
            <span>Protected workspace. Sign-in activity is recorded.</span>
          </footer>
        </div>
      </div>
    </AdminProviders>
  );
}
