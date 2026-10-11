/**
 * Post-processing of rendered documents for a static export: extra head tags, export-only inline
 * scripts/styles, and the document's own hash CSP — recomputed from the FINAL bytes and embedded as
 * <meta http-equiv="Content-Security-Policy"> so the policy travels with the file to any host.
 */
import { inlineHashes } from "@/lib/render/core";
import { buildLandingCsp, originOf } from "@/lib/render/csp";
import type { PageDoc } from "@/lib/page/schema";

export interface ExportCspInput {
  doc: PageDoc;
  /** the document runs the runtime online (landing / thank-you): pixels + API origins allowed */
  online: boolean;
  /** absolute API endpoints the document calls (connected exports) */
  endpoints?: readonly (string | undefined)[];
  /** extra style hashes to allow (a shared header policy covering several documents) */
  extraStyleHashes?: readonly string[];
}

/** Hash-based CSP for an export document (no frame-ancestors / upgrade-insecure-requests: <meta>-safe). */
export function exportCsp(html: string, input: ExportCspInput): string {
  const { scripts, styles } = inlineHashes(html);
  const t = input.doc.tracking;
  const apiOrigins = input.online
    ? [...new Set((input.endpoints ?? []).map((u) => (u ? originOf(u) : null)).filter((o): o is string => !!o))]
    : [];
  return buildLandingCsp({
    mode: "export",
    scriptHashes: scripts,
    styleHashes: [...styles, ...(input.extraStyleHashes ?? [])],
    pixels: input.online ? { meta: !!t.metaPixelId, tiktok: !!t.tiktokPixelId, snap: !!t.snapPixelId, ga4: !!t.ga4Id } : {},
    apiOrigins,
    turnstile: false,
  });
}

/** Style hashes of a document (to merge several documents into one header policy). */
export function styleHashes(html: string): string[] {
  return inlineHashes(html).styles;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function insertBefore(html: string, marker: RegExp, markup: string): string {
  const m = marker.exec(html);
  if (!m) throw new Error(`export: ${marker} not found in the rendered document`);
  return html.slice(0, m.index) + markup + html.slice(m.index);
}

/** Markup inserted just before </head>. */
export function injectHead(html: string, markup: string): string {
  return markup ? insertBefore(html, /<\/head>/i, markup) : html;
}

/** Markup inserted just before </body> (after the page content and the runtime). */
export function injectBodyEnd(html: string, markup: string): string {
  return markup ? insertBefore(html, /<\/body>/i, markup) : html;
}

/** The CSP as the first thing after <meta charset> (it must precede every governed element). */
export function withMetaCsp(html: string, csp: string): string {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${attr(csp)}"/>`;
  const m = /<meta\s+charset="utf-8"\s*\/?>/i.exec(html) ?? /<head(?:\s[^>]*)?>/i.exec(html);
  if (!m) throw new Error("export: <head> not found in the rendered document");
  const end = m.index + m[0].length;
  return html.slice(0, end) + tag + html.slice(end);
}

/** <link> tags for the favicon set and the web app manifest (`up`: "" at the root, "../" in folders). */
export function iconLinks(up: string): string {
  return (
    `<link rel="apple-touch-icon" sizes="180x180" href="${up}apple-touch-icon.png"/>` +
    `<link rel="manifest" href="${up}site.webmanifest"/>`
  );
}

/** Inline data script (never executed; ignored by the CSP). `json` must come from inlineJson(). */
export function dataScript(id: string, json: string): string {
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) throw new Error("export: bad data script id");
  return `<script type="application/json" id="${id}">${json}</script>`;
}

/** Executable inline script / stylesheet (hashed into the CSP afterwards). */
export function inlineScript(js: string): string {
  if (/<\/script/i.test(js)) throw new Error("export: inline script contains </script");
  return `<script>${js}</script>`;
}

export function inlineStyle(css: string): string {
  if (/<\/style/i.test(css)) throw new Error("export: inline style contains </style");
  return `<style>${css}</style>`;
}
