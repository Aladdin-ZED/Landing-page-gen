"use client";
/**
 * Date & time (countdowns): native datetime-local input in the admin's time zone, stored as an ISO
 * instant. Shows how far away the moment is, and warns when it is already past.
 */
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNow } from "../env";
import { FieldRow } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant → value for <input type="datetime-local"> in the local time zone. */
export function toLocalInput(iso: unknown): string {
  if (typeof iso !== "string") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function distance(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const d = Math.floor(h / 24);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const span = d >= 2 ? `${d} days` : h >= 1 ? `${h} h ${m} min` : `${m} min`;
  return ms >= 0 ? `Ends in ${span}` : `Ended ${span} ago`;
}

export function DateTimeField({
  id,
  label,
  value,
  onChange,
  help,
  error,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (iso: string | undefined) => void;
  help?: string;
  error?: string | null;
}) {
  const now = useNow(30_000);
  const local = toLocalInput(value);
  const at = typeof value === "string" ? Date.parse(value) : NaN;
  const zone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "local time";
  const past = Number.isFinite(at) && at <= now;

  return (
    <FieldRow
      label={label}
      htmlFor={id}
      error={error}
      hint={
        <>
          {Number.isFinite(at) ? <span className={cn("font-medium", past ? "text-warn-ink" : "text-foreground/70")}>{distance(at - now)} · </span> : null}
          Your time zone ({zone}). {help}
        </>
      }
    >
      <div className="flex gap-1.5">
        <Input
          id={id}
          type="datetime-local"
          value={local}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return onChange(undefined);
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
          }}
          className="h-8 flex-1 text-[13px] tabular-nums"
        />
        {local ? (
          <Button type="button" variant="ghost" size="icon" aria-label={`Clear ${label}`} onClick={() => onChange(undefined)} className="text-muted-foreground">
            <X />
          </Button>
        ) : null}
      </div>
    </FieldRow>
  );
}
