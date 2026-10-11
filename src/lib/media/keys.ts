/**
 * Media key & URL conventions (shared by upload pipeline, renderer, exporter).
 * Variant key: "<assetId>-<width>.<fmt>"  e.g. "9f2c…e1-960.webp"
 */
export type ImageFormat = "webp" | "avif" | "png" | "jpeg";
export type VideoFormat = "mp4" | "webm";
export type MediaFormat = ImageFormat | VideoFormat;

/** widths generated for every image (never upscaled; the master width is always added) */
export const MEDIA_WIDTHS = [360, 640, 960, 1440, 2048] as const;

export const variantKey = (assetId: string, width: number, fmt: MediaFormat) => `${assetId}-${width}.${fmt}`;

export const KEY_RE = /^[a-f0-9]{16,64}-\d{2,5}\.(webp|avif|png|jpeg|mp4|webm)$/;

export const MIME: Record<MediaFormat, string> = {
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  webm: "video/webm",
};

/** Live site URL for a media key. */
export const liveMediaUrl = (key: string) => `/media/${key}`;
/** Path inside an exported zip. */
export const exportMediaPath = (key: string) => (/\.(mp4|webm)$/.test(key) ? `assets/video/${key}` : `assets/img/${key}`);
