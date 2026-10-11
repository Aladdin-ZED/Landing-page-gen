"use client";
/**
 * Settings → Local AI: the stored switches (enabled, model size, background removal) plus a
 * per-browser model manager — what this device can run (WebGPU, fp16, memory, storage), which
 * models are already in the browser cache and how big they are, download-ahead and clear cache.
 */
import {
  BrainCircuitIcon,
  CheckIcon,
  CpuIcon,
  DownloadIcon,
  HardDriveIcon,
  Loader2Icon,
  MemoryStickIcon,
  RefreshCwIcon,
  ScanEyeIcon,
  ScissorsIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { detectCapabilities, requestPersistentStorage, type AiCapabilities } from "@/lib/ai/capabilities";
import { AI_MODELS, AiError, getAi, useAi, type AiCacheStats, type AiProgress, type AiStatus } from "@/lib/ai/client";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { StatusChip } from "../common/status-chip";
import { runAction, type ActionResult } from "../lib/action-result";
import { bytes } from "../lib/format";
import type { Tone } from "../lib/status";
import { ReadOnlyNote, SaveBar, SettingsSection, useSettingsForm } from "./form-kit";

const AiForm = z.object({ enabled: z.boolean(), tier: z.enum(["lite", "full"]), bgRemoval: z.boolean() });
export type AiValues = z.infer<typeof AiForm>;

/** Hugging Face repos behind each model row (the worker's catalogue, src/lib/ai/models.ts). */
const REPOS = {
  classifier: [AI_MODELS.siglip],
  matting: [AI_MODELS.matting.webgpu, AI_MODELS.matting.wasm],
  writerLite: [AI_MODELS.vlm.lite],
  writerFull: [AI_MODELS.vlm.full],
} as const;

type ModelId = keyof typeof REPOS;

interface ModelRow {
  id: ModelId;
  name: string;
  purpose: string;
  approx: string;
  icon: typeof CpuIcon;
}

const MODELS: ModelRow[] = [
  { id: "classifier", name: "Photo reader", purpose: "Recognises the product category and visual vibe. Runs on any computer.", approx: "≈ 0.2–0.4 GB", icon: ScanEyeIcon },
  { id: "matting", name: "Background remover", purpose: "Cuts the product out of its photo for clean stages.", approx: "≈ 0.2 GB", icon: ScissorsIcon },
  { id: "writerLite", name: "Copywriter · Lite", purpose: "Qwen3.5 0.8B — first-draft copy in Arabic, French and English.", approx: "≈ 0.9 GB", icon: BrainCircuitIcon },
  { id: "writerFull", name: "Copywriter · Full", purpose: "Qwen3.5 2B — richer copy; needs a GPU with fp16 and 8 GB of memory.", approx: "≈ 2.2 GB", icon: BrainCircuitIcon },
];

type CacheStats = AiCacheStats;

const modelBytes = (stats: CacheStats | null, id: ModelId) => REPOS[id].reduce((sum, repo) => sum + (stats?.byRepo[repo] ?? 0), 0);

/** A small synthetic product shot (a bottle on a light backdrop) used to warm models up. */
function sampleImage(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) return Promise.reject(new Error("canvas unavailable"));
  g.fillStyle = "#eef1ef";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#5e7f70";
  g.beginPath();
  g.roundRect(92, 78, 72, 150, 22);
  g.fill();
  g.fillStyle = "#26302c";
  g.beginPath();
  g.roundRect(110, 40, 36, 42, 8);
  g.fill();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png"));
}

const STAGE_LABEL: Record<string, string> = {
  "load-classifier": "Downloading the photo reader",
  classify: "Reading a sample photo",
  "load-vlm": "Downloading the copywriter",
  analyze: "Warming up",
  write: "Warming up",
  "load-matting": "Downloading the background remover",
  matting: "Cutting out a sample",
};

const STATUS_META: Record<AiStatus, { label: string; tone: Tone }> = {
  off: { label: "Off", tone: "neutral" },
  idle: { label: "Ready to load", tone: "neutral" },
  loading: { label: "Downloading", tone: "warn" },
  ready: { label: "Loaded", tone: "emerald" },
  busy: { label: "Working", tone: "blue" },
  error: { label: "Problem", tone: "red" },
};

export function AiSettingsForm({ initial, canWrite, save }: { initial: AiValues; canWrite: boolean; save: (input: AiValues) => Promise<ActionResult<null>> }) {
  const router = useRouter();
  const form = useSettingsForm(AiForm, initial);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  // the manager follows the switches on screen, so downloads match what is about to be saved
  const ai = useAi({ enabled: v.enabled, maxTier: v.tier });

  const [device, setDevice] = useState<AiCapabilities | null>(null);
  const [checking, setChecking] = useState(true);
  const [cache, setCache] = useState<CacheStats | null | undefined>(undefined);
  const [warming, setWarming] = useState<ModelId | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const checkDevice = useCallback(async () => {
    setChecking(true);
    try {
      // ask for the ceiling ("full") to learn what this device could run at best
      setDevice(await detectCapabilities("full"));
    } finally {
      setChecking(false);
    }
  }, []);

  const refreshCache = useCallback(async () => {
    try {
      setCache(await getAi().cacheStats());
    } catch {
      setCache(null);
    }
  }, []);

  useEffect(() => {
    // browser-only probes: GPU adapter, storage estimate, Cache Storage
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async external probes, set once resolved
    void checkDevice();
    void refreshCache();
  }, [checkDevice, refreshCache]);

  const onSave = async () => {
    const parsed = form.validate();
    if (!parsed) return;
    setSaving(true);
    try {
      const ok = await runAction(save(parsed), { success: parsed.enabled ? "Local AI settings saved" : "Local AI turned off" });
      if (ok !== undefined) {
        form.commit(parsed);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  /** Load a model once (download + compile), then stop before any real work. */
  const warmUp = async (id: ModelId) => {
    const manager = getAi();
    setWarming(id);
    let loaded = false;
    const unsubscribe = manager.subscribe(() => {
      const stage = manager.getState().progress?.stage;
      if (!loaded && stage && !stage.startsWith("load-")) {
        loaded = true;
        manager.cancel();
      }
    });
    try {
      const image = await sampleImage();
      if (id === "classifier") await manager.classify([image]);
      else if (id === "matting") await manager.removeBackground(image);
      else await manager.analyze([image]);
      loaded = true;
    } catch (err) {
      const code = err instanceof AiError ? err.code : "UNKNOWN";
      // the model loaded even if the sample itself gave nothing useful
      if (code === "NO_FOREGROUND" || code === "INVALID_OUTPUT") loaded = true;
      if (!loaded) {
        if (code !== "CANCELLED") toast.error(err instanceof Error ? err.message : "The model could not be downloaded.");
      }
    } finally {
      unsubscribe();
      setWarming(null);
      void refreshCache();
    }
    if (loaded) toast.success(`${MODELS.find((m) => m.id === id)?.name ?? "Model"} is ready on this device`);
  };

  const clearCache = async () => {
    const cleared = await getAi().clearCache();
    void refreshCache();
    if (!cleared) {
      toast.error("The browser refused to clear its cache.");
      return false;
    }
    toast.success("Models removed from this browser");
  };

  const keepModels = async () => {
    const granted = await requestPersistentStorage();
    if (granted) toast.success("This browser will keep the models when storage runs low");
    else toast.message("The browser declined for now — it usually agrees after a few visits.");
    void checkDevice();
  };

  const best = device?.tier ?? "off";
  const writerFor = (id: ModelId) => (id === "writerFull" ? "full" : id === "writerLite" ? "lite" : null);
  const status = STATUS_META[ai.status];

  return (
    <>
      {!canWrite && <ReadOnlyNote />}

      <SettingsSection
        title="Local AI"
        description="Reads your product photos, writes first-draft copy and cuts products out, all inside this browser. Photos never leave your computer and nothing is billed."
        aside={<StatusChip tone={v.enabled ? "emerald" : "neutral"}>{v.enabled ? "On" : "Off"}</StatusChip>}
        style={{ ["--i" as string]: 1 }}
      >
        <div className="grid divide-y divide-foreground/[0.07] rounded-2xl ring-1 ring-foreground/[0.07] ring-inset">
          <ToggleRow
            title="Use local AI in the generator"
            text="Off: the generator still works, with the hand-written copy library and your own category choice."
            checked={v.enabled}
            disabled={!canWrite}
            onChange={(on) => form.set("enabled", on)}
          />
          <ToggleRow
            title="Background removal"
            text="Offer “Remove background” in Media and the generator (works without WebGPU, slower)."
            checked={v.bgRemoval}
            disabled={!canWrite || !v.enabled}
            onChange={(on) => form.set("bgRemoval", on)}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Copywriter size"
        description="The largest model this studio may use. Each browser still picks what its hardware can run."
        style={{ ["--i" as string]: 2 }}
      >
        <div role="radiogroup" aria-label="Copywriter size" className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "lite", title: "Lite", size: "≈ 0.9 GB download", text: "Fast on most laptops with a recent browser. Good, short copy.", icon: ZapIcon },
              { value: "full", title: "Full", size: "≈ 2.2 GB download", text: "Richer, more nuanced copy. Needs a GPU with fp16 and 8 GB of memory.", icon: BrainCircuitIcon },
            ] as const
          ).map((o) => {
            const selected = v.tier === o.value;
            const fits = device ? (o.value === "full" ? best === "full" : best !== "off") : null;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!canWrite || !v.enabled}
                onClick={() => form.set("tier", o.value)}
                className={cn(
                  "relative grid gap-2 rounded-2xl p-4 text-start ring-1 transition-[box-shadow,background-color] duration-300 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                  selected ? "bg-brand/[0.06] ring-brand/45" : "ring-foreground/10 hover:ring-foreground/20",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2.5">
                    <span className={cn("flex size-8 items-center justify-center rounded-xl", selected ? "bg-brand text-brand-foreground" : "bg-foreground/[0.06]")}>
                      <o.icon className="size-4" />
                    </span>
                    <span className="grid">
                      <span className="text-sm font-semibold">{o.title}</span>
                      <span className="text-xs text-muted-foreground">{o.size}</span>
                    </span>
                  </span>
                  <AnimatePresence initial={false}>
                    {selected && (
                      <motion.span
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 26 }}
                        className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground"
                      >
                        <CheckIcon className="size-3" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="text-sm leading-relaxed text-pretty text-muted-foreground">{o.text}</span>
                {fits !== null && (
                  <span className={cn("text-xs font-medium", fits ? "text-emerald-700 dark:text-emerald-400" : "text-warn-ink")}>
                    {fits ? "Runs on this device" : o.value === "full" && best === "lite" ? "This device will use Lite instead" : "Not available on this device"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title="This device"
        description="Measured in this browser just now. Another computer may get a different result."
        aside={
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => void checkDevice()} disabled={checking}>
            <RefreshCwIcon className={cn(checking && "animate-spin")} />
            Check again
          </Button>
        }
        style={{ ["--i" as string]: 3 }}
      >
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Fact icon={CpuIcon} label="WebGPU" value={device ? (device.webgpu ? "Available" : "Not available") : null} good={device?.webgpu} />
          <Fact icon={ZapIcon} label="Half precision (fp16)" value={device ? (device.f16 ? "Supported" : "Not supported") : null} good={device?.f16} />
          <Fact
            icon={MemoryStickIcon}
            label="Memory"
            value={device ? (device.deviceMemory === null ? "Not reported" : `${device.deviceMemory >= 8 ? "8 GB or more" : `${device.deviceMemory} GB`}`) : null}
            good={device ? device.deviceMemory === null || device.deviceMemory >= 8 : undefined}
          />
          <Fact
            icon={HardDriveIcon}
            label="Free storage"
            value={device ? (device.storageFree === null ? "Not reported" : bytes(device.storageFree)) : null}
            good={device ? device.storageFree === null || device.storageFree > 3.2 * 1024 ** 3 : undefined}
          />
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-foreground/[0.025] px-4 py-3 ring-1 ring-foreground/[0.06] ring-inset">
          <p className="text-sm">
            {device ? (
              <>
                Best copywriter here: <strong className="font-semibold">{best === "off" ? "none — copy comes from the built-in library" : best === "full" ? "Full" : "Lite"}</strong>
                {device.note && <span className="text-muted-foreground"> · {device.note}</span>}
              </>
            ) : (
              <span className="text-muted-foreground">Checking the graphics card and storage…</span>
            )}
          </p>
          {device && !device.persisted && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => void keepModels()}>
              <ShieldCheckIcon />
              Keep models when storage is low
            </Button>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Models in this browser"
        description="Downloaded once from Hugging Face, then loaded from the browser cache. Download ahead so the generator starts instantly."
        aside={<StatusChip tone={status.tone} pulse={ai.status === "loading" || ai.status === "busy"}>{status.label}</StatusChip>}
        style={{ ["--i" as string]: 4 }}
      >
        {cache === null ? (
          <p className="rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn-ink ring-1 ring-warn/40 ring-inset">
            This browser doesn&apos;t expose its cache here (private window or an insecure connection), so sizes can&apos;t be shown.
          </p>
        ) : null}
        <ul className="grid gap-2">
          {MODELS.map((m) => {
            const size = modelBytes(cache ?? null, m.id);
            const tier = writerFor(m.id);
            const blocked = !v.enabled
              ? "Turn on local AI first"
              : tier && best === "off"
                ? "Needs WebGPU"
                : tier === "full" && (best !== "full" || v.tier !== "full")
                  ? best !== "full"
                    ? "Too heavy for this device"
                    : "Choose Full above first"
                  : tier === "lite" && best === "full" && v.tier === "full"
                    ? "This device uses Full"
                    : m.id === "matting" && !v.bgRemoval
                      ? "Background removal is off"
                      : null;
            const active = warming === m.id;
            const pct = active ? progressPercent(ai.progress) : null;
            return (
              <li key={m.id} className="grid gap-3 rounded-2xl p-3.5 ring-1 ring-foreground/[0.07] ring-inset sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex min-w-0 gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", size ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-foreground/[0.05] text-muted-foreground")}>
                    <m.icon className="size-[1.1rem]" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                      {m.name}
                      {cache !== undefined && cache !== null && (
                        <StatusChip tone={size ? "emerald" : "neutral"} dot={!!size}>
                          {size ? `Downloaded · ${bytes(size)}` : `Not downloaded · ${m.approx}`}
                        </StatusChip>
                      )}
                    </p>
                    <p className="text-xs leading-relaxed text-pretty text-muted-foreground">{m.purpose}</p>
                    <AnimatePresence initial={false}>
                      {active && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid gap-1.5 pt-2">
                            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                              <motion.div
                                className={cn("h-full rounded-full bg-brand", pct === null && "w-1/3 animate-pulse")}
                                animate={pct === null ? undefined : { width: `${pct}%` }}
                                transition={{ type: "spring", stiffness: 120, damping: 24 }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {STAGE_LABEL[ai.progress?.stage ?? ""] ?? "Starting"}
                              {ai.progress?.total ? ` · ${bytes(ai.progress.loaded ?? 0)} of ${bytes(ai.progress.total)}` : "…"}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="flex justify-end">
                  {active ? (
                    <Button variant="ghost" size="sm" className="rounded-full" onClick={() => getAi().cancel()}>
                      <XIcon />
                      Cancel
                    </Button>
                  ) : size ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckIcon className="size-3.5" />
                      Ready offline
                    </span>
                  ) : blocked ? (
                    <span className="text-xs text-muted-foreground">{blocked}</span>
                  ) : (
                    <Button variant="outline" size="sm" className="rounded-full" disabled={warming !== null} onClick={() => void warmUp(m.id)}>
                      <DownloadIcon />
                      Download
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {ai.error && ai.status === "error" && (
          <p role="alert" className="rounded-2xl bg-destructive/[0.07] px-4 py-3 text-sm text-destructive ring-1 ring-destructive/15 ring-inset">
            {ai.error.message}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/[0.07] pt-4">
          <p className="text-sm text-muted-foreground">
            {cache === undefined ? (
              <span className="inline-flex items-center gap-2">
                <Loader2Icon className="size-3.5 animate-spin" />
                Measuring the cache…
              </span>
            ) : cache ? (
              cache.total ? (
                <>
                  Using <strong className="font-semibold text-foreground tabular-nums">{bytes(cache.total)}</strong> of this browser&apos;s storage
                  {cache.byRepo.runtime ? ` (incl. ${bytes(cache.byRepo.runtime)} of runtime files)` : ""}.
                </>
              ) : (
                "No models stored in this browser yet."
              )
            ) : (
              "Cache size unavailable."
            )}
          </p>
          <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!cache?.total || warming !== null} onClick={() => setConfirmClear(true)}>
            <Trash2Icon />
            Clear models
          </Button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        destructive
        icon={<Trash2Icon />}
        title="Remove the models from this browser?"
        description={`Frees ${bytes(cache?.total ?? 0)} on this computer only. The next AI task downloads what it needs again; your settings and pages are not touched.`}
        confirmLabel="Remove models"
        pendingLabel="Removing…"
        onConfirm={clearCache}
      />

      <SaveBar dirty={form.dirty && canWrite} saving={saving} onSave={onSave} onDiscard={form.discard} />
    </>
  );
}

function progressPercent(p: AiProgress | null): number | null {
  if (!p?.total || !p.stage.startsWith("load-")) return null;
  return Math.max(2, Math.min(100, Math.round(((p.loaded ?? 0) / p.total) * 100)));
}

function ToggleRow({ title, text, checked, disabled, onChange }: { title: string; text: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className={cn("flex items-start justify-between gap-6 p-4", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs leading-relaxed text-pretty text-muted-foreground">{text}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}

function Fact({ icon: Icon, label, value, good }: { icon: typeof CpuIcon; label: string; value: ReactNode | null; good?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-foreground/[0.07] ring-inset">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          good === undefined ? "bg-foreground/[0.05] text-muted-foreground" : good ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-warn/12 text-warn-ink",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value ?? <span className="adm-shimmer inline-block h-3.5 w-20 rounded-full align-middle" />}</dd>
      </div>
    </div>
  );
}
