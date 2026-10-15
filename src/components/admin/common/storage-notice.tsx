import { DatabaseIcon } from "lucide-react";
import Link from "next/link";
import type { DbUsage } from "@/lib/db/usage";
import { cn } from "@/lib/utils";
import { bytes } from "../lib/format";
import { StatusChip } from "./status-chip";

/**
 * Database size against the hosting plan's limit (lib/db/usage). Media, pages and orders share one
 * database, and the host suspends every write once it is full, orders included.
 */
const percent = (u: DbUsage) => `${Math.min(100, Math.round(u.ratio * 100))}%`;

/** Compact figure for a screen header (Media). */
export function StorageChip({ usage }: { usage: DbUsage }) {
  return (
    <StatusChip
      tone={usage.level === "full" ? "red" : usage.level === "warn" ? "warn" : "neutral"}
      dot={usage.level !== "ok"}
      title="Media, pages and orders share one database. The host stops all writes, orders included, once it reaches its limit."
    >
      Database {bytes(usage.bytes)} of {bytes(usage.quotaBytes)}
    </StatusChip>
  );
}

/** Warning line from 70 % of the limit on (nothing below). */
export function StorageNotice({ usage, showLink = false, className }: { usage: DbUsage | null; showLink?: boolean; className?: string }) {
  if (!usage || usage.level === "ok") return null;
  const full = usage.level === "full";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-relaxed ring-1 ring-inset",
        full ? "bg-destructive/10 text-destructive ring-destructive/20" : "bg-warn/10 text-warn-ink ring-warn/40",
        className,
      )}
    >
      <DatabaseIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-pretty">
        <span className="font-medium">
          The database is {percent(usage)} full ({bytes(usage.bytes)} of {bytes(usage.quotaBytes)}).
        </span>{" "}
        {full
          ? "New uploads are paused so orders keep the remaining space. Delete videos and photos you no longer use."
          : "Once it is full, the host stops every write, orders included. Delete videos and photos you no longer use, and prefer short clips."}
        {showLink && (
          <>
            {" "}
            <Link href="/admin/media" className="font-medium underline underline-offset-4">
              Open Media
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
