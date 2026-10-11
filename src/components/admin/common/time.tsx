"use client";

import { useEffect, useState } from "react";
import { fullDate, relativeTime } from "../lib/format";

/**
 * "5 min ago" that stays fresh (re-renders every 30 s), with the full date on hover. The server
 * renders its own "now"; the client corrects it after hydration without a warning.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={fullDate(iso)} className={className} suppressHydrationWarning>
      {relativeTime(iso, now)}
    </time>
  );
}
