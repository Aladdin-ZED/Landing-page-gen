import type { ReactNode } from "react";

/** Keyboard key cap (palette footer, shortcut hints). */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-background px-1 font-sans text-[0.68rem] font-medium text-foreground/70 shadow-[0_1px_0_rgb(0_0_0/0.08)] ring-1 ring-border">
      {children}
    </kbd>
  );
}
