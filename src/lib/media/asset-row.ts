/**
 * The one mapping from a stored asset (DB row, media API JSON, picker hand-over) to the slim row the
 * landing renderer resolves (AssetRowLike) — isomorphic, no server or DOM APIs.
 *
 * Every path that feeds a renderer goes through it: the publish resolver reads the raw DB row, the
 * builder bootstrap (src/lib/editor/pages.server.ts), the builder's picker and uploader
 * (src/components/builder/media.tsx), the admin previews (src/lib/admin-data/assets.ts). So the
 * builder canvas and every preview crop, letterbox and play files exactly like the published page:
 * same subject analysis (`focus`), same MIME (a WebM video keeps its .webm key), same renditions.
 */
import type { AssetRowLike } from "@/landing/context";
import { parseFocus } from "./focus";
import type { MediaFormat } from "./keys";

/** What a row can be built from (AssetRecord, AssetJson, the MediaPicker's PickedAsset). */
export interface AssetRowSource {
  id: string;
  kind?: "image" | "video" | null;
  mime?: string | null;
  width: number;
  height: number;
  alpha: boolean;
  dominant: string;
  variants: readonly { key: string; w: number; h: number; fmt: string }[];
  /** AssetFocus JSON (validated here, never trusted) */
  focus?: unknown;
}

const FORMATS: ReadonlySet<string> = new Set<MediaFormat>(["webp", "avif", "png", "jpeg", "mp4", "webm"]);
const HEX6 = /^#[0-9a-fA-F]{6}$/;

/** The renderer row of an asset; `kind` overrides the source's (a picker opened for videos). */
export function assetRowOf(a: AssetRowSource, kind?: "image" | "video"): AssetRowLike {
  return {
    id: a.id,
    kind: kind ?? a.kind ?? "image",
    ...(typeof a.mime === "string" && a.mime ? { mime: a.mime } : {}),
    width: a.width,
    height: a.height,
    alpha: a.alpha,
    dominant: HEX6.test(a.dominant) ? a.dominant : "#cccccc",
    variants: a.variants
      .filter((v): v is { key: string; w: number; h: number; fmt: MediaFormat } => FORMATS.has(v.fmt))
      .map((v) => ({ key: v.key, w: v.w, h: v.h, fmt: v.fmt })),
    // subject analysis: frames fit the subject (heads, hands, product) exactly like the published page
    focus: parseFocus(a.focus),
  };
}
