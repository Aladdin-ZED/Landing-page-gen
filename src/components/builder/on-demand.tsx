"use client";
/**
 * Builder UI that is not needed to edit — dialogs, the history drawer and the remix engine — split
 * out of the builder's first-load bundle. The Shell prefetches all of it once the editor is idle
 * (BUILDER_PREFETCH), so opening any of them stays instant. Same props as the real components.
 */
import dynamic from "next/dynamic";
import { loadExportDialog, loadMediaPicker } from "@/components/admin/on-demand";

export const loadPublishDialog = () => import("./PublishDialog");
export const PublishDialog = dynamic(() => import("./PublishDialog").then((m) => m.PublishDialog), { ssr: false });

export const loadVersionsDrawer = () => import("./VersionsDrawer");
export const VersionsDrawer = dynamic(() => import("./VersionsDrawer").then((m) => m.VersionsDrawer), { ssr: false });

export const loadAddSectionDialog = () => import("./AddSectionDialog");
export const AddSectionDialog = dynamic(() => import("./AddSectionDialog").then((m) => m.AddSectionDialog), { ssr: false });

/** remixDoc (plan rules + the copy library of every locale), awaited by the remix actions. */
export const loadRemix = () => import("@/lib/generator").then((m) => m.remixDoc);

/* Left-rail panels other than Sections (the one the builder opens on). Server-rendered when one is
   active on the first render, like before. */
const loadThemePanel = () => import("./panels/ThemePanel");
export const ThemePanel = dynamic(() => import("./panels/ThemePanel").then((m) => m.ThemePanel));
const loadProductPanel = () => import("./panels/ProductPanel");
export const ProductPanel = dynamic(() => import("./panels/ProductPanel").then((m) => m.ProductPanel));
const loadOffersPanel = () => import("./panels/OffersPanel");
export const OffersPanel = dynamic(() => import("./panels/OffersPanel").then((m) => m.OffersPanel));
const loadFormPanel = () => import("./panels/FormPanel");
export const FormPanel = dynamic(() => import("./panels/FormPanel").then((m) => m.FormPanel));
const loadSeoPanel = () => import("./panels/SeoPanel");
export const SeoPanel = dynamic(() => import("./panels/SeoPanel").then((m) => m.SeoPanel));

export const BUILDER_PREFETCH = [
  loadThemePanel,
  loadProductPanel,
  loadOffersPanel,
  loadFormPanel,
  loadSeoPanel,
  loadAddSectionDialog,
  loadPublishDialog,
  loadVersionsDrawer,
  loadExportDialog,
  loadMediaPicker,
  loadRemix,
];
