/**
 * What this browser can run locally. Browser-only (call from effects / event handlers).
 *
 *   off   no usable WebGPU (or not enough disk): photo classification and background removal still
 *         run (WASM), copy comes from the hand-written library
 *   lite  Qwen3.5-0.8B (~0.9 GB download) — integrated GPUs, little memory
 *   full  Qwen3.5-2B (~2.2 GB download) — needs shader-f16, 8 GB+ RAM and room in storage
 */
import type { AiTier } from "./protocol";

export interface AiCapabilities {
  webgpu: boolean;
  f16: boolean;
  tier: AiTier;
  /** navigator.deviceMemory (GB, capped at 8 by browsers) */
  deviceMemory: number | null;
  /** bytes still available to this origin's storage */
  storageFree: number | null;
  /** storage was granted "persistent" (models will not be evicted) */
  persisted: boolean;
  /** human reason when the tier was lowered */
  note: string | null;
}

interface GpuAdapterLike {
  features: { has(name: string): boolean };
  limits?: { maxBufferSize?: number };
  isFallbackAdapter?: boolean;
  info?: { isFallbackAdapter?: boolean };
}
interface NavigatorGpu {
  gpu?: { requestAdapter(opts?: { powerPreference?: string }): Promise<GpuAdapterLike | null> };
  deviceMemory?: number;
}

const GB = 1024 ** 3;

export async function detectCapabilities(maxTier: Exclude<AiTier, "off"> = "full"): Promise<AiCapabilities> {
  const nav = (typeof navigator === "undefined" ? {} : navigator) as Navigator & NavigatorGpu;
  let adapter: GpuAdapterLike | null = null;
  try {
    adapter = (await nav.gpu?.requestAdapter({ powerPreference: "high-performance" })) ?? null;
  } catch {
    adapter = null;
  }
  // a software (fallback) adapter would take minutes per answer: treat as no WebGPU
  const software = !!(adapter?.isFallbackAdapter || adapter?.info?.isFallbackAdapter);
  const webgpu = !!adapter && !software;
  const f16 = webgpu && !!adapter?.features.has("shader-f16");
  const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;

  let storageFree: number | null = null;
  let persisted = false;
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota !== undefined) storageFree = Math.max(0, est.quota - (est.usage ?? 0));
    persisted = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    // storage APIs unavailable (private window): keep nulls
  }

  let tier: AiTier = "off";
  let note: string | null = null;
  if (!webgpu) {
    note = software ? "Only a software GPU is available." : "WebGPU is not available in this browser.";
  } else if (storageFree !== null && storageFree < 1.2 * GB) {
    note = "Not enough free storage to keep a language model.";
  } else {
    const strong =
      f16 &&
      (deviceMemory === null || deviceMemory >= 8) &&
      (storageFree === null || storageFree >= 3.2 * GB) &&
      (adapter?.limits?.maxBufferSize ?? 2 * GB) >= GB;
    tier = strong && maxTier === "full" ? "full" : "lite";
    if (tier === "lite" && maxTier === "full") note = f16 ? "Limited memory or storage: using the lite model." : "This GPU has no fp16 support: using the lite model.";
  }
  return { webgpu, f16, tier, deviceMemory, storageFree, persisted, note };
}

/** Ask the browser to keep cached models (best effort; Chrome grants it to engaged origins). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (await navigator.storage?.persisted?.()) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
