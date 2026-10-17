"use client";
/**
 * Shared pieces of the pixel UIs (library, builder section, wizard choice, publish block): platform
 * marks and names, the status chip (Browser only · Browser + server · Test mode · 42 min) and the
 * health line. Chips use only the brand, emerald, neutral and yellow warn tones (never amber/orange).
 */
import { ActivityIcon, CircleAlertIcon, CircleCheckIcon, FlaskConicalIcon, MonitorSmartphoneIcon, ServerIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PIXEL_NAMES, isServerPlatform, type PixelPlatform } from "@/lib/pixels/ids";
import { healthText, maskPixelId, pixelStatus, type LibraryPixel } from "@/lib/pixels/library";
import { cn } from "@/lib/utils";
import { StatusChip } from "../common/status-chip";
import { useMounted } from "./use-page-pixels";

export interface PlatformMeta {
  name: string;
  /** shorter, for chips */
  short: string;
  tagline: string;
  mark: string;
  markClass: string;
  placeholder: string;
  idLabel: string;
  tokenLabel?: string;
  where: { id: ReactNode; token?: ReactNode; test?: ReactNode };
}

export const PLATFORM_META: Record<PixelPlatform, PlatformMeta> = {
  meta: {
    name: "Meta",
    short: "Meta",
    tagline: "Facebook & Instagram ads",
    mark: "M",
    markClass: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    placeholder: "1234567890123456",
    idLabel: "Pixel ID",
    tokenLabel: "Conversions API token",
    where: {
      id: "Events Manager → Data sources → your pixel: the ID is under its name.",
      token: "Same pixel → Settings → Conversions API → Generate access token.",
      test: "Same pixel → Test events → copy the code (TEST…).",
    },
  },
  tiktok: {
    name: "TikTok",
    short: "TikTok",
    tagline: "TikTok ads",
    mark: "T",
    markClass: "bg-foreground/[0.07] text-foreground",
    placeholder: "C4ABCDEF12345678",
    idLabel: "Pixel ID",
    tokenLabel: "Events API access token",
    where: {
      id: "TikTok Events Manager → Web → your pixel: copy its ID.",
      token: "Same pixel → Settings → Events API → Generate access token.",
      test: "Same pixel → Test events → copy the test event code.",
    },
  },
  snap: {
    name: "Snapchat",
    short: "Snap",
    tagline: "Snap ads",
    mark: "S",
    markClass: "bg-warn/30 text-warn-ink",
    placeholder: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    idLabel: "Pixel ID",
    where: { id: "Snap Ads Manager → Events Manager → your Pixel: copy the Pixel ID." },
  },
  ga4: {
    name: "Google Analytics 4",
    short: "GA4",
    tagline: "Traffic & conversions",
    mark: "G",
    markClass: "bg-foreground/[0.07] text-foreground",
    placeholder: "G-AB12CD34EF",
    idLabel: "Measurement ID",
    where: { id: "Google Analytics → Admin → Data streams → Web: copy the Measurement ID (G-…)." },
  },
};

export function PlatformMark({ platform, size = "md", className }: { platform: PixelPlatform; size?: "sm" | "md"; className?: string }) {
  const m = PLATFORM_META[platform];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold",
        size === "sm" ? "size-6 rounded-lg text-[0.7rem]" : "size-8 rounded-xl text-sm",
        m.markClass,
        className,
      )}
    >
      {m.mark}
    </span>
  );
}

/** "Browser only" · "Browser + server" · "Test mode · 42 min" (· page when not scoped to one). */
export function PixelStatusChip({ pixel, pageId, now, className }: { pixel: Pick<LibraryPixel, "platform" | "server" | "activeTests">; pageId?: string; now: number; className?: string }) {
  // now = 0 while hydrating: the windows the server listed count as active, minutes shown once mounted
  const s = pixelStatus(pixel, now || 1, pageId);
  if (s.kind === "test") {
    return (
      <StatusChip tone="warn" dot={false} className={className} title="Server events of this page go to Test events only until the window ends">
        <FlaskConicalIcon className="size-3" />
        Test mode{now ? ` · ${s.minutesLeft} min` : ""}
        {!pageId && s.pageName ? ` · ${s.pageName}` : ""}
      </StatusChip>
    );
  }
  if (s.kind === "server") {
    return (
      <StatusChip tone="emerald" dot={false} className={className} title="Orders are also sent from the server for this pixel">
        <ServerIcon className="size-3" />
        Browser + server
      </StatusChip>
    );
  }
  return (
    <StatusChip tone="neutral" dot={false} className={className} title={isServerPlatform(pixel.platform) ? "No server token: in-app and iOS purchases are under-counted" : undefined}>
      <MonitorSmartphoneIcon className="size-3" />
      Browser only
    </StatusChip>
  );
}

/** "Server OK · 14:02" / "Refused (permission) · 13:40" / "Unverified: send a test event". */
export function PixelHealthLine({ pixel, className }: { pixel: Pick<LibraryPixel, "health" | "server">; className?: string }) {
  // local clock times only once mounted (the server's time zone is not the viewer's)
  const mounted = useMounted();
  if (!pixel.server) return null;
  const h = healthText(pixel.health, mounted);
  if (!h) return null;
  const Icon = h.tone === "ok" ? CircleCheckIcon : h.tone === "refused" ? CircleAlertIcon : ActivityIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[0.72rem] leading-none font-medium",
        h.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : h.tone === "refused" ? "text-warn-ink" : "text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-3" />
      {h.text}
    </span>
  );
}

/** The masked id in mono, LTR (Arabic UI safe). */
export function MaskedId({ id, className }: { id: string; className?: string }) {
  return (
    <span dir="ltr" className={cn("font-mono text-[0.75rem] text-muted-foreground tabular-nums", className)}>
      {maskPixelId(id)}
    </span>
  );
}

export const platformName = (p: PixelPlatform) => PIXEL_NAMES[p];
