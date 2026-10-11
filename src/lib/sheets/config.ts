import "server-only";
/**
 * The connected sheet (settings key "sheets"). A value missing any coordinate reads as "not connected".
 */
import { getSetting, setSetting, type SettingsActor } from "@/lib/settings";
import { sheetUrl } from "./format";

export interface SheetsConfig {
  url: string;
  spreadsheetId: string;
  sheetId: number;
  sheetTitle: string;
  /** ISO datetime of the last successful connect */
  connectedAt: string | null;
  enabled: boolean;
}

export async function getSheetsConfig(): Promise<SheetsConfig | null> {
  const s = await getSetting("sheets");
  if (!s.spreadsheetId || s.sheetId === undefined || !s.sheetTitle) return null;
  return {
    url: s.url ?? sheetUrl(s.spreadsheetId, s.sheetId),
    spreadsheetId: s.spreadsheetId,
    sheetId: s.sheetId,
    sheetTitle: s.sheetTitle,
    connectedAt: s.connectedAt ?? null,
    enabled: s.enabled,
  };
}

/** Connected and enabled → the target to write to; null otherwise. */
export async function activeSheet(): Promise<SheetsConfig | null> {
  const cfg = await getSheetsConfig();
  return cfg?.enabled ? cfg : null;
}

export async function saveSheetsConfig(
  cfg: { spreadsheetId: string; sheetId: number; sheetTitle: string; enabled: boolean; connectedAt?: string | null },
  actor?: SettingsActor,
): Promise<SheetsConfig> {
  const value = {
    url: sheetUrl(cfg.spreadsheetId, cfg.sheetId),
    spreadsheetId: cfg.spreadsheetId,
    sheetId: cfg.sheetId,
    sheetTitle: cfg.sheetTitle,
    connectedAt: cfg.connectedAt ?? new Date().toISOString(),
    enabled: cfg.enabled,
  };
  await setSetting("sheets", value, actor);
  return value;
}

/**
 * Pause / resume appending orders to (and pulling statuses from) the connected sheet. Orders keep queuing
 * as "pending" while paused; admin status edits are still written to rows already in the sheet.
 */
export async function setSheetsEnabled(enabled: boolean, actor?: SettingsActor): Promise<SheetsConfig | null> {
  const cfg = await getSheetsConfig();
  if (!cfg) return null;
  return saveSheetsConfig({ ...cfg, enabled }, actor);
}

/** Forget the connected sheet. */
export async function disconnectSheet(actor?: SettingsActor): Promise<void> {
  await setSetting("sheets", { enabled: false }, actor);
}
