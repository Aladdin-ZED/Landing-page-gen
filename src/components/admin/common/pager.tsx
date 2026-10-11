"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { int } from "../lib/format";

/** "21–40 of 132" with previous / next; hidden when everything fits on one page. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
  noun = "items",
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  noun?: string;
  className?: string;
}) {
  if (total <= pageSize) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-4 text-sm", className)}>
      <span className="text-muted-foreground tabular-nums">
        {int(from)}–{int(to)} of {int(total)} {noun}
      </span>
      <span className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" className="rounded-full" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeftIcon className="rtl:rotate-180" />
          Previous
        </Button>
        <Button variant="outline" size="sm" className="rounded-full" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRightIcon className="rtl:rotate-180" />
        </Button>
      </span>
    </nav>
  );
}
