import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Content column of a panel screen: comfortable measure, generous breathing room. */
export function Screen({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 pt-8 pb-16 sm:px-8 sm:pt-10", wide ? "max-w-[1480px]" : "max-w-[1280px]", className)}>{children}</div>;
}
