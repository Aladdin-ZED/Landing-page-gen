"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client providers for every admin screen: light/dark theme (class on <html>, system by default;
 * the inline theme script carries the CSP nonce), tooltips and toasts.
 */
/**
 * The theme script only matters in the server HTML (it runs before paint). When these providers
 * mount on the client — a client-side navigation from the sign-in screens into the panel or the
 * builder — React would create an inert <script> and log "Encountered a script tag…". Rendering it
 * as a data block there keeps it inert without the error; next-themes applies the theme itself
 * after mount. (The element has suppressHydrationWarning, so hydration is unaffected.)
 */
const THEME_SCRIPT_PROPS = typeof window === "undefined" ? undefined : ({ type: "application/json" } as const);

export function AdminProviders({ nonce, children }: { nonce?: string; children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
      scriptProps={THEME_SCRIPT_PROPS}
    >
      <TooltipProvider delayDuration={250} skipDelayDuration={150}>
        {children}
        <Toaster position="bottom-right" closeButton toastOptions={{ classNames: { toast: "cn-toast rounded-xl!" } }} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
