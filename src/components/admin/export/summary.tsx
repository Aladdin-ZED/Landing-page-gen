"use client";
/**
 * Right-hand summary of the export dialog: the estimated ZIP size with its breakdown, what the
 * archive will contain for the current choices, and the things to fix before shipping.
 */
import { CircleAlertIcon, FileCode2Icon, FileTextIcon, FolderLockIcon, ImageIcon, ScaleIcon, ServerCogIcon, ShieldCheckIcon, TriangleAlertIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import type { ExportMode } from "@/lib/export/options";
import type { ExportErrorResponse, ExportEstimateResponse } from "@/lib/export/types";
import { cn } from "@/lib/utils";
import { formatBytes } from "./format";

const EASE = [0.22, 1, 0.36, 1] as const;

const PARTS = [
  { key: "media", label: "Images & video", tone: "bg-brand" },
  { key: "fonts", label: "Fonts", tone: "bg-brand/45" },
  { key: "pages", label: "Pages", tone: "bg-foreground/45" },
  { key: "other", label: "Icons & config", tone: "bg-foreground/15" },
] as const;

export function SizeSummary({
  estimate,
  mode,
  hostConfigs,
  hasSite,
}: {
  estimate: { data?: ExportEstimateResponse; error?: ExportErrorResponse; loading: boolean };
  mode: ExportMode;
  hostConfigs: boolean;
  hasSite: boolean;
}) {
  const uid = useId();
  const ids = { size: `${uid}-size`, inside: `${uid}-inside`, warn: `${uid}-warn` };
  const data = estimate.data;
  const raw = data ? PARTS.map((p) => data.breakdown[p.key]) : [];
  const sum = raw.reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="grid gap-6">
      <section aria-labelledby={ids.size} aria-busy={estimate.loading} className="grid gap-3">
        <p id={ids.size} className="text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Estimated download
        </p>
        <div className="flex items-baseline gap-2">
          {data ? (
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={data.bytes}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ duration: 0.35, ease: EASE }}
                className={cn("font-display text-[2.4rem] leading-none font-semibold tracking-[-0.045em] tabular-nums transition-opacity", estimate.loading && "opacity-50")}
              >
                {formatBytes(data.bytes)}
              </motion.span>
            </AnimatePresence>
          ) : estimate.loading ? (
            <span className="h-10 w-32 animate-pulse rounded-lg bg-foreground/[0.07]" />
          ) : (
            <span className="font-display text-[2.4rem] leading-none font-semibold text-muted-foreground/60" aria-label="Not estimated">
              —
            </span>
          )}
          {data && <span className="text-xs text-muted-foreground tabular-nums">{data.files} files</span>}
        </div>

        <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-foreground/[0.06]" aria-hidden="true">
          {data &&
            PARTS.map((p, i) => (
              <motion.span
                key={p.key}
                className={cn("h-full first:rounded-s-full last:rounded-e-full", p.tone)}
                initial={false}
                animate={{ width: `${(raw[i]! / sum) * 100}%` }}
                transition={{ duration: 0.6, ease: EASE }}
              />
            ))}
        </div>
        {data && (
          <dl className="grid gap-1.5 text-xs">
            {PARTS.map((p, i) => (
              <div key={p.key} className="flex items-center gap-2">
                <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", p.tone)} />
                <dt className="truncate text-muted-foreground">{p.label}</dt>
                <dd className="ms-auto font-medium tabular-nums">{formatBytes(raw[i]!)}</dd>
              </div>
            ))}
          </dl>
        )}
        {estimate.error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-relaxed text-destructive">
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
            {estimate.error.message ?? "The size could not be estimated."}
          </p>
        )}
      </section>

      <section aria-labelledby={ids.inside} className="grid gap-2.5">
        <p id={ids.inside} className="text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Inside the ZIP
        </p>
        <ul className="grid gap-2 text-[0.8rem]">
          <Item icon={<FileTextIcon />}>Product page, thank-you page & 404</Item>
          <Item icon={<ScaleIcon />}>Privacy, terms, shipping & contact pages</Item>
          <Item icon={<ImageIcon />}>Optimized images, fonts, favicon set & manifest</Item>
          <Item icon={<FileCode2Icon />}>robots.txt{hasSite ? " + sitemap.xml" : ""} · README with deploy steps</Item>
          {hostConfigs && <Item icon={<ShieldCheckIcon />}>{mode === "php" ? ".htaccess" : ".htaccess, _headers & vercel.json"} — HTTPS, CSP, caching</Item>}
          {mode === "php" && (
            <>
              <Item icon={<ServerCogIcon />}>order.php with a server-side price table</Item>
              <Item icon={<FolderLockIcon />}>cod-private/ — config.php & Sheets client, outside the web root</Item>
            </>
          )}
        </ul>
      </section>

      <AnimatePresence initial={false}>
        {data && data.warnings.length > 0 && (
          <motion.section
            aria-labelledby={ids.warn}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="grid gap-2 rounded-2xl bg-warn/[0.09] p-3.5 ring-1 ring-warn/40 ring-inset">
              <p id={ids.warn} className="flex items-center gap-1.5 text-xs font-semibold text-warn-ink">
                <TriangleAlertIcon className="size-3.5" />
                Before you ship
              </p>
              <ul className="grid gap-1.5 text-xs leading-relaxed text-warn-ink/85">
                {data.warnings.slice(0, 6).map((w) => (
                  <li key={w} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-warn/70" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-foreground/80">
      <span aria-hidden="true" className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] text-foreground/60 [&_svg]:size-3">
        {icon}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
