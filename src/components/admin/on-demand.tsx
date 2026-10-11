"use client";
/**
 * Admin dialogs used from several screens, code-split out of their first-load bundles: they load
 * when first opened (see useOpenedOnce) or when a screen prefetches them on idle.
 * Same props as the real components.
 */
import dynamic from "next/dynamic";

export const loadExportDialog = () => import("./export/ExportDialog");
export const ExportDialog = dynamic(() => import("./export/ExportDialog").then((m) => m.ExportDialog), { ssr: false });

export const loadMediaPicker = () => import("./media/MediaPicker");
export const MediaPicker = dynamic(() => import("./media/MediaPicker").then((m) => m.MediaPicker), { ssr: false });

export const loadPagePreviewDialog = () => import("./pages/page-preview-dialog");
export const PagePreviewDialog = dynamic(() => import("./pages/page-preview-dialog").then((m) => m.PagePreviewDialog), { ssr: false });
