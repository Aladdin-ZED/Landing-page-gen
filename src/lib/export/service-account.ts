import "server-only";
/**
 * The Google key a PHP export may carry in cod-private/config.php.
 *
 * Only a dedicated export key (env GOOGLE_EXPORT_SA_JSON_B64) is ever embedded, never the app's own
 * (GOOGLE_SA_JSON_B64). Whoever holds an export ZIP or the hosting's files can read and rewrite the whole
 * orders sheet with the key inside; with the app's own key, the only way to stop that would be deleting
 * the key COD Studio itself syncs with. A key of a second service account can be deleted in Google Cloud
 * the moment an export leaks, and the app keeps working.
 */
import { z } from "zod";
import { loadServiceAccount } from "@/lib/sheets/client";

const ServiceAccountKey = z.object({
  client_email: z.string().email().max(254),
  private_key: z.string().min(100).max(20_000).includes("PRIVATE KEY"),
  private_key_id: z.string().max(200).optional(),
});

export interface ExportKey {
  /** minimal service-account JSON (type, client_email, private_key, private_key_id), base64 */
  b64: string;
  email: string;
  /** Google's key id (private_key_id) — what to delete in Google Cloud; null when the JSON has none */
  keyId: string | null;
}

export type ExportKeyState = { key: ExportKey; problem: null } | { key: null; problem: string };

export const NO_EXPORT_KEY =
  "To include a key, give PHP exports a Google service account of their own (GOOGLE_EXPORT_SA_JSON_B64 on the server, shared as Editor with your sheet). COD Studio never puts its own key in a ZIP: a leaked copy could then only be stopped by breaking the app's own sync.";

export const SAME_AS_APP_KEY =
  "GOOGLE_EXPORT_SA_JSON_B64 must belong to a second service account, not the one COD Studio syncs with (GOOGLE_SA_JSON_B64): that key could not be revoked without stopping the app's own sync.";

export const INVALID_EXPORT_KEY = "GOOGLE_EXPORT_SA_JSON_B64 is not a valid service-account key (the downloaded JSON, base64-encoded on one line).";

function parseKey(raw: string): z.infer<typeof ServiceAccountKey> | null {
  try {
    // the documented base64 form, or a pasted raw JSON key
    const r = ServiceAccountKey.safeParse(JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

const sameKey = (a: string, b: string) => a.replace(/\s+/g, "") === b.replace(/\s+/g, "");

/** The dedicated export key, or why there is none (unset, invalid, or the app's own account / key). */
export function exportServiceAccount(): ExportKeyState {
  const raw = process.env.GOOGLE_EXPORT_SA_JSON_B64?.trim();
  if (!raw) return { key: null, problem: NO_EXPORT_KEY };
  if (raw === process.env.GOOGLE_SA_JSON_B64?.trim()) return { key: null, problem: SAME_AS_APP_KEY };
  const sa = parseKey(raw);
  if (!sa) return { key: null, problem: INVALID_EXPORT_KEY };

  let app: { client_email: string; private_key: string; private_key_id?: string } | null = null;
  try {
    app = loadServiceAccount();
  } catch {
    app = null; // the app has no (valid) key of its own: nothing to collide with
  }
  if (
    app &&
    (app.client_email.toLowerCase() === sa.client_email.toLowerCase() ||
      sameKey(app.private_key, sa.private_key) ||
      (!!app.private_key_id && app.private_key_id === sa.private_key_id))
  ) {
    return { key: null, problem: SAME_AS_APP_KEY };
  }

  const json = JSON.stringify({
    type: "service_account",
    client_email: sa.client_email,
    private_key: sa.private_key,
    ...(sa.private_key_id ? { private_key_id: sa.private_key_id } : {}),
  });
  return { key: { b64: Buffer.from(json, "utf8").toString("base64"), email: sa.client_email, keyId: sa.private_key_id ?? null }, problem: null };
}
