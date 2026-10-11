/**
 * Device frames and the asset map shape of the admin preview. Kept apart from frame.ts (theme
 * engine, landing CSS) so importing these constants never pulls the landing renderer into a route's
 * first-load bundle.
 */
import type { AssetRowLike } from "@/landing/context";

export type PreviewDevice = "mobile" | "tablet" | "desktop";

/** CSS viewport of each device frame. Desktop height follows the available space. */
export const DEVICES: Record<PreviewDevice, { width: number; height: number | null; label: string }> = {
  mobile: { width: 390, height: 844, label: "Mobile" },
  tablet: { width: 820, height: 1180, label: "Tablet" },
  desktop: { width: 1280, height: null, label: "Desktop" },
};

/** Asset rows keyed by id (object or Map), as handed over by the builder. */
export type PreviewAssets = Readonly<Record<string, AssetRowLike>> | ReadonlyMap<string, AssetRowLike>;
