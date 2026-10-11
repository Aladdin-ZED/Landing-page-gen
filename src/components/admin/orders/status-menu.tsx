"use client";

import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { StatusChip, TONE_CLASSES } from "../common/status-chip";
import { ORDER_STATUS_META, ORDER_STATUS_ORDER, orderStatusMeta } from "../lib/status";

/**
 * Order status as a chip that opens a status menu (English label + the French label agents see in
 * the sheet). Read-only chip when the user can't change statuses.
 */
export function StatusMenu({
  status,
  onChange,
  disabled,
  pending,
  size = "default",
}: {
  status: string;
  onChange?: (status: string) => void;
  disabled?: boolean;
  pending?: boolean;
  size?: "default" | "sm";
}) {
  const meta = orderStatusMeta(status);
  const chip = (
    <StatusChip tone={meta.tone} className={cn(size === "sm" && "h-6 text-[0.72rem]")}>
      {meta.label}
      {onChange && !disabled && (pending ? <Loader2Icon className="-me-0.5 size-3 animate-spin" /> : <ChevronDownIcon className="-me-1 size-3 opacity-60" />)}
    </StatusChip>
  );
  if (!onChange || disabled) return chip;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-60"
        disabled={pending}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Status: ${meta.label}. Change status`}
      >
        {chip}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60 rounded-xl p-1.5" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Change status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={status} onValueChange={(v) => v !== status && onChange(v)}>
          {ORDER_STATUS_ORDER.map((id) => {
            const m = ORDER_STATUS_META[id];
            return (
              <DropdownMenuRadioItem key={id} value={id} className="gap-2.5 rounded-lg py-1.5">
                <span className={cn("size-2 shrink-0 rounded-full", TONE_CLASSES[m.tone].dot)} />
                <span className="flex-1">{m.label}</span>
                <span className="text-[0.7rem] text-muted-foreground">{m.fr}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
