"use client";
/**
 * Step 2 — analysis. What the on-device AI reads from the photos: SigLIP category + vibe (instant,
 * automatic), an optional deep look with the vision-language model, and an optional background
 * removal of the best photo for the hero stage. Nothing here blocks: every result is a suggestion.
 */
import { CheckIcon, Loader2Icon, MicroscopeIcon, RotateCcwIcon, ScanEyeIcon, ScissorsIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { AiTier, ClassifyResult, UseAi } from "@/lib/ai/client";
import type { Analysis } from "@/lib/ai/copy-schema";
import type { ProductCategory } from "@/lib/page/schema";
import { noOrange, type ExtractedPalette } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, VIBE_LABELS } from "./labels";
import { AiProgress, Panel, PanelHead, Swatches } from "./parts";
import { swatches } from "./photos";
import type { Cutout, Photo } from "./state";

export type JobState = { status: "idle" | "running" | "done" | "error"; error?: string };

export interface StepAnalysisProps {
  ai: UseAi;
  /** Settings → AI → enabled */
  aiEnabled: boolean;
  /** Settings → AI → background removal */
  bgRemoval: boolean;
  /** what this device can run (null while detecting) */
  tier: AiTier | null;
  main: Photo | null;
  palette: ExtractedPalette | null;
  category: ProductCategory;
  onCategory(category: ProductCategory): void;

  classify: ClassifyResult | null;
  classifyJob: JobState;
  onClassify(): void;

  analysis: Analysis | null;
  analysisJob: JobState;
  onAnalyze(): void;
  /** the AI writes the copy: the deep look starts on its own when the admin continues */
  autoLook: boolean;

  cutout: Cutout | null;
  /** the photo the background removal would use */
  cutoutSource: Photo | null;
  /** the main photo already has transparency */
  mainIsCutout: boolean;
  cutoutJob: JobState;
  onCutout(): void;
  onUseCutout(use: boolean): void;
}

const MODEL_SIZE = { full: "Qwen3.5 2B · about 2.2 GB", lite: "Qwen3.5 0.8B · about 0.9 GB" } as const;

/** Top entries of a "prefix:key" score map, as shares of the listed total. */
function top(scores: Record<string, number>, prefix: string, n: number): { key: string; share: number }[] {
  const list = Object.entries(scores)
    .filter(([k]) => k.startsWith(prefix))
    .map(([k, v]) => ({ key: k.slice(prefix.length), score: v }))
    .sort((a, b) => b.score - a.score);
  const total = list.reduce((s, x) => s + x.score, 0) || 1;
  return list.slice(0, n).map((x) => ({ key: x.key, share: x.score / total }));
}

export function StepAnalysis(props: StepAnalysisProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <ReadingPanel {...props} />
      <CutoutPanel {...props} />
      <DeepPanel {...props} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo reading (SigLIP)                                              */
/* ------------------------------------------------------------------ */

function ReadingPanel({ ai, aiEnabled, classify, classifyJob, onClassify, category, onCategory, palette }: StepAnalysisProps) {
  const cats = classify ? top(classify.scores, "category:", 4) : [];
  const vibes = classify ? top(classify.scores, "vibe:", 3) : [];
  const lead = cats[0];
  const running = classifyJob.status === "running";
  return (
    <Panel className="lg:col-span-7">
      <PanelHead
        icon={<ScanEyeIcon />}
        title="What the AI sees"
        description="A first read of your photos, done on this computer. Tap another category if it guessed wrong."
        aside={
          classify && !running ? (
            <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={onClassify}>
              <RotateCcwIcon />
              Read again
            </Button>
          ) : null
        }
      />
      <div className="grid gap-6 p-5 sm:p-6">
        {!aiEnabled ? (
          <Note>Local AI is switched off in Settings → AI. Pick the category in the next step — the page is designed the same way.</Note>
        ) : running && !classify ? (
          <div className="grid gap-5">
            <AiProgress ai={ai} stages={["load-classifier", "classify"]} />
            <div className="grid gap-3">
              <div className="adm-shimmer h-10 w-48 rounded-lg" />
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="adm-shimmer h-8 w-24 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        ) : classifyJob.status === "error" && !classify ? (
          <Note tone="warn" action={<Button size="sm" variant="outline" className="rounded-full" onClick={onClassify}><RotateCcwIcon />Try again</Button>}>
            {classifyJob.error ?? "The photo reader couldn't run."} You can still pick the category yourself.
          </Note>
        ) : classify && lead ? (
          <>
            <div className="grid gap-1">
              <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Looks like</p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={category}
                  className="font-display text-[2.4rem] leading-none font-semibold tracking-[-0.04em]"
                  initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  {CATEGORY_LABELS[category]}
                </motion.p>
              </AnimatePresence>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Category suggestions">
              {cats.map((c, i) => {
                const key = c.key as ProductCategory;
                const active = key === category;
                return (
                  <motion.li key={c.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <button
                      type="button"
                      onClick={() => onCategory(key)}
                      aria-pressed={active}
                      className={cn(
                        "relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-full px-3.5 text-[0.8rem] font-medium ring-1 ring-inset outline-none transition-[background-color,color,box-shadow,transform] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
                        active ? "bg-foreground text-background ring-foreground" : "bg-background ring-border hover:ring-foreground/25",
                      )}
                    >
                      {CATEGORY_LABELS[key] ?? c.key}
                      <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{Math.round(c.share * 100)}%</span>
                    </button>
                  </motion.li>
                );
              })}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid content-start gap-2.5">
                <p className="text-[0.8rem] font-medium">Vibe</p>
                <ul className="grid gap-2">
                  {vibes.map((v, i) => (
                    <li key={v.key} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-[0.8rem]">
                      <span className={cn(i === 0 ? "font-medium" : "text-muted-foreground")}>{VIBE_LABELS[v.key] ?? v.key}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                        <motion.span
                          className={cn("block h-full rounded-full", i === 0 ? "bg-brand" : "bg-foreground/25")}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(4, v.share * 100)}%` }}
                          transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.1 + i * 0.06 }}
                        />
                      </span>
                      <span className="text-end text-muted-foreground tabular-nums">{Math.round(v.share * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid content-start gap-2.5">
                <p className="text-[0.8rem] font-medium">Palette</p>
                <Swatches colors={swatches(palette)} />
                {palette && <p className="text-[0.75rem] text-muted-foreground">{describePalette(palette)}</p>}
              </div>
            </div>
            {running && <AiProgress ai={ai} stages={["load-classifier", "classify"]} />}
          </>
        ) : (
          <Note action={<Button size="sm" variant="outline" className="rounded-full" onClick={onClassify}><ScanEyeIcon />Read the photos</Button>}>
            Let the AI read your photos to suggest a category and a mood.
          </Note>
        )}
      </div>
    </Panel>
  );
}

function describePalette(p: ExtractedPalette): string {
  const temp = p.warmth > 0.2 ? "warm" : p.warmth < -0.2 ? "cool" : "neutral";
  const light = p.brightness > 0.66 ? "light" : p.brightness < 0.33 ? "deep" : "mid-tone";
  const color = p.colorfulness > 0.45 ? "vivid" : p.colorfulness < 0.15 ? "muted" : "soft";
  return `${temp} · ${light} · ${color}${p.transparent ? " · transparent" : ""}`;
}

/* ------------------------------------------------------------------ */
/* Cutout (BiRefNet / ISNet)                                           */
/* ------------------------------------------------------------------ */

function CutoutPanel({ ai, aiEnabled, bgRemoval, cutout, cutoutSource, mainIsCutout, cutoutJob, onCutout, onUseCutout, palette, main }: StepAnalysisProps) {
  const running = cutoutJob.status === "running";
  // the product's own hue lights the stage, kept out of the orange band like every UI color we emit
  const lead = swatches(palette, 1)[0];
  const glow = lead ? noOrange(lead) : "var(--muted-foreground)";
  const shown = cutout?.asset.thumbUrl ?? cutout?.asset.url ?? null;
  const source = mainIsCutout ? main : cutoutSource;
  const allowed = aiEnabled && bgRemoval;
  return (
    <Panel className="flex flex-col lg:col-span-5 lg:row-span-2">
      <PanelHead
        icon={<ScissorsIcon />}
        title="Hero cutout"
        description="The product without its background, lit on a stage in the hero."
        aside={
          cutout ? (
            <label className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
              Use
              <Switch checked={cutout.use} onCheckedChange={onUseCutout} aria-label="Use the cutout in the hero" />
            </label>
          ) : null
        }
      />
      <div className="grid flex-1 grid-rows-[1fr_auto] gap-4 p-5 sm:p-6">
        <div
          className="relative min-h-72 overflow-hidden rounded-xl ring-1 ring-border"
          style={{ background: `radial-gradient(60% 58% at 50% 46%, color-mix(in oklab, ${glow} 34%, transparent), transparent 72%), var(--muted)` }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {shown || mainIsCutout ? (
              <motion.div
                key={shown ?? "main"}
                className="absolute inset-0 grid place-items-center p-6"
                initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
                animate={{ opacity: cutout && !cutout.use ? 0.45 : 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
              >
                <span aria-hidden="true" className="absolute bottom-[12%] h-5 w-1/2 rounded-[50%] bg-black/25 blur-md" />
                {/* eslint-disable-next-line @next/next/no-img-element -- media-library rendition */}
                <img src={(shown ?? main?.preview) || ""} alt="Product cutout" className="relative max-h-full max-w-full object-contain drop-shadow-[0_18px_28px_rgb(0_0_0/0.22)]" />
              </motion.div>
            ) : source?.preview ? (
              <motion.div key={`src-${source.key}`} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={source.preview} alt="" className={cn("size-full object-cover transition-[transform,filter] duration-700 ease-out", running && "scale-[1.02] blur-[2px] saturate-50")} />
                {running && (
                  // a soft scan band: a full-height layer moved with transform only (no layout per frame)
                  <motion.span
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_36%,rgb(255_255_255/0.45)_50%,transparent_64%)] mix-blend-overlay"
                    initial={{ y: "-64%" }}
                    animate={{ y: "64%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: [0.45, 0, 0.25, 1] }}
                  />
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
          {(cutout || mainIsCutout) && (
            <span className="adm-glass absolute start-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold">
              <CheckIcon className="size-3 text-success-ink" />
              {mainIsCutout && !cutout ? "Already transparent" : "Cutout ready"}
            </span>
          )}
        </div>

        {mainIsCutout && !cutout ? (
          <p className="text-[0.8rem] text-muted-foreground">Your main photo already has a transparent background — it goes straight onto the hero stage.</p>
        ) : !allowed ? (
          <p className="text-[0.8rem] text-muted-foreground">Background removal is turned off in Settings → AI. Pages still look great with regular photos.</p>
        ) : running ? (
          <AiProgress ai={ai} stages={["load-matting", "matting"]} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="min-w-0 flex-1 text-[0.8rem] text-muted-foreground">
              {cutoutJob.status === "error"
                ? (cutoutJob.error ?? "The background couldn't be removed.")
                : cutout
                  ? "Saved to your media library next to the original."
                  : source
                    ? source.key === main?.key
                      ? "Uses your main photo."
                      : "Uses the photo with the plainest background."
                    : "Add a photo first."}
            </p>
            <Button variant={cutout ? "outline" : "default"} size="sm" className="rounded-full" disabled={!source} onClick={onCutout}>
              {cutout ? <RotateCcwIcon /> : <ScissorsIcon />}
              {cutout ? "Redo" : "Remove background"}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Deep look (Qwen3.5 VLM)                                             */
/* ------------------------------------------------------------------ */

function DeepPanel({ ai, aiEnabled, tier, analysis, analysisJob, onAnalyze, autoLook }: StepAnalysisProps) {
  const running = analysisJob.status === "running";
  const can = aiEnabled && tier !== null && tier !== "off";
  return (
    <Panel className="lg:col-span-7">
      <PanelHead
        icon={<MicroscopeIcon />}
        title="Deep look"
        description="A vision-language model studies the product (materials, colors, who it's for) and briefs the copywriter. Optional."
      />
      <div className="grid gap-4 p-5 sm:p-6">
        {!aiEnabled ? (
          <p className="text-[0.8rem] text-muted-foreground">Local AI is switched off in Settings → AI.</p>
        ) : tier === null ? (
          <p className="flex items-center gap-2 text-[0.8rem] text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            Checking what this device can run…
          </p>
        ) : tier === "off" ? (
          <p className="text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">
            {ai.capabilities?.note ?? "This browser can't run the language model."} Use a recent Chrome or Edge with WebGPU for the deep look and AI copy — the hand-written copy library is used meanwhile.
          </p>
        ) : running ? (
          <AiProgress ai={ai} stages={["load-vlm", "analyze"]} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={analysis ? "outline" : "default"} size="sm" className="rounded-full" disabled={!can} onClick={onAnalyze}>
              {analysis ? <RotateCcwIcon /> : <SparklesIcon />}
              {analysis ? "Look again" : "Run the deep look"}
            </Button>
            <span className="text-[0.75rem] text-muted-foreground">{MODEL_SIZE[tier]}, downloaded once</span>
            {autoLook && !analysis && analysisJob.status !== "error" && (
              <span className="basis-full text-[0.75rem] leading-relaxed text-pretty text-muted-foreground">
                Starts on its own when you continue — the copywriter uses the same model, so it downloads while you fill in the details.
              </span>
            )}
          </div>
        )}
        {analysisJob.status === "error" && !running && <p className="text-[0.8rem] text-destructive">{analysisJob.error}</p>}
        <AnimatePresence initial={false}>
          {analysis && (
            <motion.div
              key="result"
              className="grid gap-4 border-t border-border/70 pt-5"
              initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0 }}
            >
              <p className="font-display text-[1.2rem] leading-snug font-medium tracking-[-0.02em] text-pretty">“{analysis.summary}”</p>
              <dl className="grid gap-3 text-[0.8rem] sm:grid-cols-2">
                <Fact label="Mood" values={[VIBE_LABELS[analysis.vibe] ?? analysis.vibe, ...(analysis.secondaryVibe ? [VIBE_LABELS[analysis.secondaryVibe] ?? analysis.secondaryVibe] : [])]} />
                <Fact label="For" values={analysis.audience ? [analysis.audience] : []} />
                <Fact label="Materials" values={analysis.materials} />
                <Fact label="Colors" values={analysis.colorsDescribed} />
              </dl>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Panel>
  );
}

function Fact({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div className="grid gap-1.5">
      <dt className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.length ? values.map((v) => <span key={v} className="rounded-full bg-foreground/[0.05] px-2.5 py-1 ring-1 ring-foreground/[0.06] ring-inset">{v}</span>) : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function Note({ children, action, tone = "info" }: { children: ReactNode; action?: ReactNode; tone?: "info" | "warn" }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-[0.82rem] leading-relaxed ring-1 ring-inset", tone === "warn" ? "bg-warn/[0.06] ring-warn/40" : "bg-foreground/[0.03] ring-foreground/[0.06]")}>
      <p className="min-w-0 flex-1 text-pretty text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
