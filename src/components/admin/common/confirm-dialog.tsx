"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Controlled confirmation for consequential actions. The dialog stays open (and blocks dismissal)
 * while `onConfirm` runs; it closes itself when the promise resolves to anything but `false`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  icon,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  destructive?: boolean;
  icon?: ReactNode;
  /** extra content between the description and the buttons */
  children?: ReactNode;
  onConfirm: () => Promise<boolean | void> | boolean | void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent className="gap-5 rounded-2xl p-6 duration-200 data-[size=default]:sm:max-w-md">
        <AlertDialogHeader className="gap-2">
          {icon && (
            <AlertDialogMedia className={cn("size-11 rounded-xl", destructive ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand")}>
              {icon}
            </AlertDialogMedia>
          )}
          <AlertDialogTitle className="text-[1.05rem] font-semibold tracking-[-0.01em]">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="leading-relaxed text-pretty">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="-mx-6 -mb-6 rounded-b-2xl px-6 py-4">
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            className={cn(destructive && "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive dark:hover:bg-destructive/85")}
            onClick={async () => {
              setPending(true);
              try {
                const result = await onConfirm();
                if (result !== false) onOpenChange(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
