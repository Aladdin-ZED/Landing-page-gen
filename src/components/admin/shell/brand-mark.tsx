import { cn } from "@/lib/utils";

/**
 * COD Studio mark: a jade tile holding an arch (the landing "stage") with a dot resting in it
 * (the order). One mark everywhere: sidebar, auth screens. Pure SVG with theme tokens.
 */
export function BrandMark({ className, tone = "brand" }: { className?: string; /** "ink": a quiet tile for dark art panels */ tone?: "brand" | "ink" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
        tone === "brand"
          ? [
              "text-brand-foreground",
              "bg-[linear-gradient(160deg,color-mix(in_oklab,var(--brand)_82%,white),var(--brand)_60%)]",
              "shadow-[inset_0_1px_0_rgb(255_255_255/0.32),inset_0_-1px_0_rgb(0_0_0/0.12),0_0_0_1px_color-mix(in_oklab,var(--brand)_75%,black_18%),0_6px_14px_-6px_color-mix(in_oklab,var(--brand)_80%,transparent)]",
            ]
          : "bg-white/[0.06] text-(--auth-accent) shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_0_0_1px_rgb(255_255_255/0.1)]",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-[68%]" fill="none">
        <path d="M9.5 24.5V15a6.5 6.5 0 0 1 13 0v9.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="19.75" r="2.5" fill="currentColor" />
      </svg>
    </span>
  );
}

/** "COD Studio" set in the UI sans: the product name in ink, the descriptor a step quieter. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-[0.28em] text-[0.95rem] leading-none tracking-[-0.025em]", className)}>
      <span className="font-semibold">COD</span>
      <span className="font-medium opacity-55">Studio</span>
    </span>
  );
}
