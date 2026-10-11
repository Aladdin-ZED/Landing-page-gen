/**
 * Attribution: UTM + ad click ids captured from the landing URL and persisted for the session
 * (so they survive internal navigation), ad-platform browser ids from cookies, anonymous visitor id.
 */
import type { Ctx, W } from "./core";
import { sget, sset } from "./core";
import { randomId } from "./ids";

/** [url param, payload key, max length (contract)] */
const PARAMS: [string, string, number][] = [
  ["utm_source", "source", 120],
  ["utm_medium", "medium", 120],
  ["utm_campaign", "campaign", 200],
  ["utm_content", "content", 200],
  ["utm_term", "term", 200],
  ["fbclid", "fbclid", 500],
  ["ttclid", "ttclid", 500],
  ["ScCid", "sccid", 500],
  ["gclid", "gclid", 500],
];

const UTM_KEY = "lp-utm";

export function captureUtm(win: W): Record<string, string> {
  const out: Record<string, string> = {};
  let found = false;
  try {
    const q = new URLSearchParams(win.location.search);
    for (const [param, key, max] of PARAMS) {
      const v = (q.get(param) || q.get(param.toLowerCase()) || "").trim();
      if (v) {
        out[key] = v.slice(0, max);
        found = true;
      }
    }
  } catch {
    /* malformed URL */
  }
  if (found) {
    sset(win, "sessionStorage", UTM_KEY, JSON.stringify(out));
    return out;
  }
  try {
    const saved = JSON.parse(sget(win, "sessionStorage", UTM_KEY) || "null") as Record<string, unknown> | null;
    if (saved && typeof saved === "object")
      for (const [, key, max] of PARAMS) {
        const v = saved[key];
        if (typeof v === "string" && v) out[key] = v.slice(0, max);
      }
  } catch {
    /* corrupted storage */
  }
  return out;
}

export function cookie(doc: Document, name: string): string {
  try {
    for (const part of doc.cookie.split(";")) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
  } catch {
    /* cookies blocked / malformed */
  }
  return "";
}

/** Meta _fbp/_fbc and TikTok _ttp for server-side event matching (fbc rebuilt from fbclid if needed). */
export function adIds(c: Ctx): { fbp?: string; fbc?: string; ttp?: string } {
  const o: { fbp?: string; fbc?: string; ttp?: string } = {};
  const fbp = cookie(c.doc, "_fbp");
  const fbc = cookie(c.doc, "_fbc") || (c.st.utm.fbclid ? "fb.1." + Date.now() + "." + c.st.utm.fbclid : "");
  const ttp = cookie(c.doc, "_ttp");
  if (fbp) o.fbp = fbp.slice(0, 200);
  if (fbc) o.fbc = fbc.slice(0, 500);
  if (ttp) o.ttp = ttp.slice(0, 200);
  return o;
}

/** Anonymous random visitor id (no PII) kept in localStorage; per-load id when storage is blocked. */
export function visitorId(c: Ctx): string {
  const saved = sget(c.win, "localStorage", "lp-vid");
  if (saved && /^[a-zA-Z0-9_-]{8,40}$/.test(saved)) return saved;
  const id = randomId(22, c.win.crypto);
  sset(c.win, "localStorage", "lp-vid", id);
  return id;
}
