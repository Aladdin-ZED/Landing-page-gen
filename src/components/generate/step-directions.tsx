"use client";
/**
 * Step 4 — directions. Three art-directed pages side by side, each a live, scrollable preview in a
 * phone frame with its archetype, palette and type pairing. Pick one to open it in the builder;
 * regenerate for new takes on the same styles, or switch to the next three styles.
 */
import { ArrowRightIcon, Loader2Icon, Maximize2Icon, MonitorIcon, PaletteIcon, RefreshCwIcon, ShuffleIcon, SmartphoneIcon, SparklesIcon, SquareIcon, TriangleAlertIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { LandingPreview, type PreviewAssets } from "@/components/preview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { UseAi } from "@/lib/ai/client";
import type { Direction } from "@/lib/generator";
import { fontData } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { StoreInfo } from "@/landing/context";
import { AiProgress } from "./parts";

export type CopyState =
  /** the copy library writes the page (AI copy off or unavailable) */
  | { state: "library" }
  /** the on-device copywriter could write it but hasn't (stopped, or not started yet) */
  | { state: "idle" }
  /** `previous`: an earlier AI version stays on the pages while the new one is written */
  | { state: "running"; previous: boolean }
  /** `note`: a rewrite failed and this version was kept */
  | { state: "ai"; kept: number; note?: string }
  | { state: "error"; message: string };

export interface StepDirectionsProps {
  directions: Direction[] | null;
  error: string | null;
  assets: PreviewAssets;
  store: StoreInfo;
  /** changes on every regeneration (cards shimmer once) */
  seedBase: number;
  /** index of the direction being saved */
  creating: number | null;
  onUse(index: number): void;
  onRegenerate(): void;
  onOtherStyles(): void;
  /** more fitting styles exist than the three shown (a calm product only cycles the quiet ones) */
  canOtherStyles: boolean;
  ai: UseAi;
  copy: CopyState;
  onStopCopy(): void;
  onRetryCopy(): void;
}

const fontName = (id: string) => fontData(id)?.family ?? id;

/** "Best match · natural + clinical" — why this style was proposed. */
function matchText({ match }: Direction): string {
  const head = match.forced ? "Another style" : match.rank === 0 ? "Best match" : match.rank <= 2 ? "Strong match" : "Fresh take";
  return match.vibes.length ? `${head} · ${match.vibes.join(" + ")}` : head;
}

/** Phones scroll sideways (one card per snap), large screens show the three side by side. */
const ROW = "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 adm-scroll lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0";
const CELL = "w-[min(86vw,22rem)] shrink-0 snap-center lg:w-auto";

export function StepDirections({ directions, error, assets, store, seedBase, creating, onUse, onRegenerate, onOtherStyles, canOtherStyles, ai, copy, onStopCopy, onRetryCopy }: StepDirectionsProps) {
  const [full, setFull] = useState<number | null>(null);
  const busy = creating !== null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Three directions for your product</h2>
          <p className="max-w-2xl text-[0.85rem] text-pretty text-muted-foreground">Same product and offer, three art directions. Scroll inside each phone to see the whole page — everything stays editable in the builder.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* the hint sits on a wrapper: a disabled button takes no pointer events, so no tooltip */}
          <span className="inline-flex" title={canOtherStyles ? "Three more styles that suit this product" : directions ? "These are all the styles that suit this product — Regenerate gives new takes on them" : undefined}>
            <Button variant="outline" className="h-9 rounded-full px-4" disabled={busy || !canOtherStyles} onClick={onOtherStyles}>
              <ShuffleIcon />
              Other styles
            </Button>
          </span>
          <Button variant="outline" className="h-9 rounded-full px-4" disabled={busy} onClick={onRegenerate}>
            <RefreshCwIcon />
            Regenerate
          </Button>
        </div>
      </div>

      <CopyBanner ai={ai} copy={copy} onStop={onStopCopy} onRetry={onRetryCopy} />

      {error ? (
        <div className="adm-surface-flat flex flex-wrap items-start gap-3 p-5 text-sm" role="alert">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="grid min-w-0 flex-1 gap-1">
            <p className="font-medium">The directions couldn&apos;t be built.</p>
            <p className="text-pretty text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" disabled={busy} onClick={onRegenerate}>
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : directions ? (
        <ul className={ROW}>
          {directions.map((d, i) => (
            <motion.li
              key={d.archetype}
              className={CELL}
              initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
              animate={{ opacity: busy && creating !== i ? 0.45 : 1, y: 0, filter: "blur(0px)" }}
              transition={{ type: "spring", stiffness: 200, damping: 26, delay: i * 0.08 }}
            >
              <DirectionCard
                index={i}
                direction={d}
                assets={assets}
                store={store}
                seedBase={seedBase}
                creating={creating === i}
                disabled={busy}
                onUse={() => onUse(i)}
                onFull={() => setFull(i)}
              />
            </motion.li>
          ))}
        </ul>
      ) : (
        // ghosts of the cards in their own row: same header, stage and footer, so nothing jumps
        <ul className={ROW} aria-busy="true" aria-label="Designing three directions">
          {[0, 1, 2].map((i) => (
            <li key={i} className={CELL}>
              <DirectionGhost index={i} />
            </li>
          ))}
        </ul>
      )}

      <FullPreview direction={full === null ? null : (directions?.[full] ?? null)} index={full ?? 0} assets={assets} store={store} onClose={() => setFull(null)} onUse={() => full !== null && onUse(full)} disabled={busy} />
    </div>
  );
}

function CopyBanner({ ai, copy, onStop, onRetry }: { ai: UseAi; copy: CopyState; onStop: () => void; onRetry: () => void }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {copy.state === "running" ? (
        <motion.div key="running" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="adm-glass flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <SparklesIcon className="size-4" />
          </span>
          <div className="grid min-w-0 flex-1 gap-1.5">
            <p className="text-[0.85rem] font-medium">{copy.previous ? "The on-device copywriter is writing a new version" : "The on-device copywriter is writing your page"}</p>
            <AiProgress ai={ai} stages={["load-vlm", "write"]} className="max-w-xl" />
          </div>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onStop}>
            <SquareIcon className="fill-current" />
            {copy.previous ? "Keep the current copy" : "Use library copy"}
          </Button>
        </motion.div>
      ) : copy.state === "ai" ? (
        <motion.div key="ai" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3 text-[0.8rem] text-muted-foreground">
          <SparklesIcon className="size-3.5 text-brand" />
          <span className="min-w-0 flex-1">
            Copy written on this computer and checked for invented numbers and claims{copy.kept > 0 ? ` — ${copy.kept} part${copy.kept === 1 ? "" : "s"} kept from the hand-written library` : ""}.
            {copy.note && <span className="block text-warn-ink">{copy.note}</span>}
          </span>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onRetry}>
            <RefreshCwIcon />
            Write again
          </Button>
        </motion.div>
      ) : copy.state === "idle" ? (
        <motion.div key="idle" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3 text-[0.8rem] text-muted-foreground">
          <SparklesIcon className="size-3.5 text-brand" />
          <span className="min-w-0 flex-1">These pages use the hand-written copy library. The on-device copywriter can write copy for this product instead.</span>
          <Button variant="outline" size="sm" className="rounded-full" onClick={onRetry}>
            <SparklesIcon />
            Write with AI
          </Button>
        </motion.div>
      ) : copy.state === "error" ? (
        <motion.div key="error" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3 text-[0.8rem] text-muted-foreground">
          <TriangleAlertIcon className="size-3.5 text-warn-ink" />
          <span className="min-w-0 flex-1">{copy.message} The pages use the hand-written copy library.</span>
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onRetry}>
            Try again
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Loading card: DirectionCard's exact boxes (header lines, phone stage, footer) in shimmer. */
function DirectionGhost({ index }: { index: number }) {
  return (
    <div className="adm-surface flex h-full flex-col overflow-hidden" aria-hidden="true">
      <div className="grid gap-3 px-5 pt-5">
        <div className="grid gap-1">
          <span className="font-mono text-[0.7rem] text-muted-foreground/60 tabular-nums">0{index + 1}</span>
          <span className="adm-shimmer h-[1.6rem] w-[52%] rounded-lg" />
        </div>
        <span className="grid min-h-[2lh] content-center gap-2 text-[0.8rem] leading-relaxed">
          <span className="adm-shimmer h-2 rounded-full" />
          <span className="adm-shimmer h-2 w-2/3 rounded-full" />
        </span>
        <span className="flex gap-1.5 text-[0.7rem]">
          <span className="adm-shimmer w-[46%] rounded-full py-1">&nbsp;</span>
          <span className="adm-shimmer w-[30%] rounded-full py-1">&nbsp;</span>
        </span>
      </div>
      <div className="adm-stage relative mx-3 mt-4 grid h-[36rem] place-items-center overflow-hidden rounded-[1.4rem] sm:h-[40rem]">
        <span className="adm-shimmer h-[88%] w-[78%] rounded-[1.9rem]" />
      </div>
      <div className="mt-auto flex items-center gap-2 p-4">
        <span className="adm-shimmer h-10 flex-1 rounded-full" />
        <span className="adm-shimmer size-10 rounded-full" />
      </div>
    </div>
  );
}

function DirectionCard({
  index,
  direction,
  assets,
  store,
  seedBase,
  creating,
  disabled,
  onUse,
  onFull,
}: {
  index: number;
  direction: Direction;
  assets: PreviewAssets;
  store: StoreInfo;
  seedBase: number;
  creating: boolean;
  disabled: boolean;
  onUse: () => void;
  onFull: () => void;
}) {
  const { doc } = direction;
  const ar = doc.locale === "ar";
  const fonts = [...new Set([fontName(ar ? doc.theme.fonts.displayAr : doc.theme.fonts.display), fontName(ar ? doc.theme.fonts.bodyAr : doc.theme.fonts.body)])];
  const accent = doc.theme.palette.accent;
  const pop = doc.theme.palette.pop;
  // the strongest match carries the accent; the others stay ink, so the eye lands on the recommendation
  const best = direction.match.rank === 0 && !direction.match.forced;
  return (
    <article className={cn("adm-surface adm-lift flex h-full flex-col overflow-hidden", creating && "ring-2 ring-brand")}>
      <header className="grid gap-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <span className="font-mono text-[0.7rem] text-muted-foreground tabular-nums">0{index + 1}</span>
            <h3 className="font-display text-[1.6rem] leading-none font-semibold tracking-[-0.035em]">{direction.label}</h3>
          </div>
          <div className="flex shrink-0 -space-x-1.5 pt-1" role="img" aria-label={`Accent ${accent}, pop ${pop}`}>
            {(
              [
                ["Accent", accent],
                ["Pop", pop],
              ] as const
            ).map(([role, hex]) => (
              <span key={role} className="size-6 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] ring-2 ring-card" style={{ background: hex }} title={`${role} ${hex}`} />
            ))}
          </div>
        </div>
        {/* always two lines tall, so the three phone stages start on one line */}
        <p className="line-clamp-2 min-h-[2lh] text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">{direction.description}</p>
        {/* one row: both chips truncate when narrow (the type pairing first) */}
        <div className="flex min-w-0 gap-1.5 text-[0.7rem]">
          <span className={cn("inline-flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 font-medium", best ? "bg-brand-soft text-brand" : "bg-foreground/[0.05] text-foreground/75")}>
            <PaletteIcon className="size-3 shrink-0" />
            <span className="truncate">{matchText(direction)}</span>
          </span>
          <span className="min-w-[4.5rem] shrink-[3] truncate rounded-full bg-foreground/[0.05] px-2.5 py-1 text-muted-foreground" title={fonts.join(" · ")}>
            {fonts.join(" · ")}
          </span>
        </div>
      </header>

      {/* a neutral photo-table stage (like the builder canvas): the page's own colors stay inside the
          phone, so no direction tints the studio with a louder color than the others */}
      <div className="adm-stage relative mx-3 mt-4 h-[36rem] overflow-hidden rounded-[1.4rem] sm:h-[40rem]">
        <LandingPreview doc={doc} assets={assets} store={store} device="mobile" interactive className="bg-transparent" />
        {/* one sheen sweep per regeneration */}
        <motion.span
          key={seedBase}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 1.1, ease: [0.45, 0, 0.25, 1], delay: index * 0.08 }}
        />
      </div>

      <footer className="mt-auto flex items-center gap-2 p-4">
        <Button
          variant={best ? "brand" : "default"}
          className="h-10 flex-1 rounded-full"
          disabled={disabled && !creating}
          aria-busy={creating}
          onClick={creating ? undefined : onUse}
        >
          {creating ? <Loader2Icon className="animate-spin" /> : null}
          {creating ? "Creating the page…" : "Use this direction"}
          {!creating && <ArrowRightIcon />}
        </Button>
        <Button variant="outline" size="icon-lg" className="size-10 rounded-full" aria-label={`Open ${direction.label} full screen`} onClick={onFull}>
          <Maximize2Icon />
        </Button>
      </footer>
    </article>
  );
}

function FullPreview({
  direction,
  index,
  assets,
  store,
  onClose,
  onUse,
  disabled,
}: {
  direction: Direction | null;
  index: number;
  assets: PreviewAssets;
  store: StoreInfo;
  onClose: () => void;
  onUse: () => void;
  disabled: boolean;
}) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  return (
    <Dialog open={!!direction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(92dvh,62rem)] w-[min(96vw,84rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        {direction && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3 pe-14">
              <div className="grid min-w-0 flex-1">
                <DialogTitle className="font-display text-[1.35rem] leading-none font-semibold tracking-[-0.03em]">
                  <span className="me-2 font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  {direction.label}
                </DialogTitle>
                <DialogDescription className="truncate text-[0.8rem]">{matchText(direction)} · {direction.description}</DialogDescription>
              </div>
              <Segmented<"mobile" | "desktop">
                label="Preview device"
                size="sm"
                value={device}
                onChange={setDevice}
                options={[
                  { value: "mobile", label: "Mobile", icon: <SmartphoneIcon /> },
                  { value: "desktop", label: "Desktop", icon: <MonitorIcon /> },
                ]}
              />
              <Button variant="brand" className="h-9 rounded-full px-4" disabled={disabled} onClick={onUse}>
                Use this direction
                <ArrowRightIcon />
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <LandingPreview doc={direction.doc} assets={assets} store={store} device={device} interactive />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
