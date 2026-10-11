"use client";
/**
 * "Remove background" for a library photo: fetch the original, run the in-browser model
 * (local AI client), upload the result as a cutout linked to its source. Progress is reported in
 * a single toast that updates in place (model download → processing → upload).
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAi } from "@/lib/ai/client";
import { uploadMedia, type MediaAsset } from "./media-client";

export interface StoredAiSettings {
  enabled: boolean;
  tier: "lite" | "full";
  bgRemoval: boolean;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/png": "png", "image/avif": "avif" };

export function useRemoveBackground(settings: StoredAiSettings) {
  // the AI client is a per-tab singleton: always configure it with the SAVED settings here, so
  // unsaved toggles on Settings → Local AI never leak into this screen
  const ai = useAi({ enabled: settings.enabled, maxTier: settings.tier });
  const [working, setWorking] = useState<string | null>(null);

  // the matting model runs on WebGPU when present and falls back to WASM, so the device tier
  // (which is about the language model) does not gate it
  const allowed = settings.enabled && settings.bgRemoval;
  const available = allowed && ai.status !== "off";
  const reason = !settings.enabled
    ? "Turn on local AI in Settings → Local AI."
    : !settings.bgRemoval
      ? "Background removal is turned off in Settings → Local AI."
      : null;

  const run = useCallback(
    async (asset: MediaAsset): Promise<MediaAsset | null> => {
      if (!asset.url || asset.kind !== "image") return null;
      setWorking(asset.id);
      const id = toast.loading("Removing the background…", { description: "Runs on this computer — nothing leaves your browser." });
      try {
        const source = await fetch(asset.url).then((r) => {
          if (!r.ok) throw new Error("Couldn't read the original photo.");
          return r.blob();
        });
        const cut = await ai.removeBackground(source);
        toast.loading("Saving the cutout…", { id, description: undefined });
        const base = (asset.originalName ?? "photo").replace(/\.[a-z0-9]+$/i, "");
        const { asset: created } = await uploadMedia(cut, { name: `${base}-cutout.${EXT[cut.type] ?? "png"}`, cutout: true, sourceAssetId: asset.id });
        toast.success("Cutout ready", { id, description: "Saved next to the original, marked as a cutout." });
        return created;
      } catch (err) {
        toast.error("Background removal failed", { id, description: err instanceof Error ? err.message : undefined });
        return null;
      } finally {
        setWorking(null);
      }
    },
    [ai],
  );

  return { available, reason, run, working, progress: ai.status === "loading" ? ai.progress : null };
}
