/**
 * The local AI's model catalogue: Hugging Face repos the worker downloads and the Cache Storage
 * bucket transformers.js keeps them in. Shared by the worker (what it loads), the AI client
 * (cache stats / clearing) and Settings → Local AI (what is on this device), so they never drift.
 * Isomorphic and dependency-free.
 */

export const AI_MODELS = {
  /** zero-shot category + vibe (webgpu fp16, else wasm q8) */
  siglip: "Xenova/siglip-base-patch16-224",
  /** copywriter / photo analyst: 2B ("full") or 0.8B ("lite"), WebGPU only */
  vlm: { full: "onnx-community/Qwen3.5-2B-ONNX-OPT", lite: "onnx-community/Qwen3.5-0.8B-ONNX-OPT" },
  /** background removal: BiRefNet_lite on WebGPU, ISNet on wasm */
  matting: { webgpu: "onnx-community/BiRefNet_lite-ONNX", wasm: "imgly/isnet-general-onnx" },
} as const;

/** Cache Storage bucket for model files and ONNX Runtime binaries (the worker sets env.cacheKey to it). */
export const AI_CACHE_NAME = "transformers-cache";

/** Every repo the worker may download. */
export const AI_MODEL_REPOS: readonly string[] = [
  AI_MODELS.siglip,
  AI_MODELS.vlm.lite,
  AI_MODELS.vlm.full,
  AI_MODELS.matting.webgpu,
  AI_MODELS.matting.wasm,
];

/** Cache entries that are not model files (ONNX Runtime wasm, tokenizer helpers…). */
export const AI_RUNTIME_BUCKET = "runtime";

/**
 * Repo ("org/name") of a cached request URL — "https://huggingface.co/<org>/<name>/resolve/…" — or
 * AI_RUNTIME_BUCKET for anything else.
 */
export function repoOfCacheUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "huggingface.co") {
      const [org, name] = u.pathname.split("/").filter(Boolean);
      if (org && name) return `${org}/${name}`;
    }
  } catch {
    // not a URL: count it with the runtime files
  }
  return AI_RUNTIME_BUCKET;
}
