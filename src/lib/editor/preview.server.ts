import "server-only";
/**
 * Full-page draft preview (GET /admin/preview/<pageId>): renders a stored draft or version with
 * the real publish renderer, made safe to show inside the admin:
 *  - pixels removed and noindex forced; the runtime runs in "preview" mode (no orders, events);
 *  - every <script> carries the admin CSP nonce (the response travels under the admin CSP);
 *  - a fixed "Preview · not live" badge so it is never mistaken for the live page.
 */
import type { AssetResolver, StoreInfo } from "@/landing/context";
import { liveLinks } from "@/landing/context";
import { validateDoc } from "@/lib/page/validate";
import { renderLandingHtml } from "@/lib/render/render.server";
import { liveResolverFor, PUBLIC_ENDPOINTS, storeInfo } from "@/lib/render/publish.server";

const NONCE = /^[A-Za-z0-9+/=_-]{16,128}$/;

/** Static badge (no user content); inline styles are allowed by the admin CSP. */
const BADGE =
  '<div aria-hidden="true" style="position:fixed;z-index:2147483647;inset-block-start:12px;inset-inline-end:12px;padding:6px 12px;border-radius:999px;' +
  "background:rgba(20,18,14,.78);color:#fff;font:600 12px/1.2 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;letter-spacing:.01em;" +
  'pointer-events:none;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 6px 20px rgba(0,0,0,.18)">Preview · not live</div>';

export type DraftPreview = { ok: true; html: string } | { ok: false; reason: "invalid" };

export async function renderDraftPreview(
  source: unknown,
  slug: string,
  opts: { nonce?: string | null; store?: StoreInfo; assets?: AssetResolver } = {},
): Promise<DraftPreview> {
  const { doc } = validateDoc(source);
  if (!doc) return { ok: false, reason: "invalid" };

  // never load pixels from a preview, never let it be indexed
  const previewDoc = { ...doc, tracking: {}, seo: { ...doc.seo, noindex: true } };
  const store = opts.store ?? (await storeInfo());
  const assets = opts.assets ?? (await liveResolverFor(previewDoc, store));
  const rendered = await renderLandingHtml(previewDoc, {
    mode: "live",
    runtimeMode: "preview",
    assets,
    pageKey: "pk_preview_page",
    store,
    urls: { landing: `/${slug}`, thankYou: `/${slug}/merci`, endpoints: PUBLIC_ENDPOINTS },
    links: liveLinks(slug),
    upgradeInsecureRequests: false,
  });

  let html = rendered.html;
  if (opts.nonce && NONCE.test(opts.nonce)) html = html.replace(/<script(?=[\s>])(?![^>]*\snonce=)/g, `<script nonce="${opts.nonce}"`);
  html = html.replace(/<body([^>]*)>/, (m) => `${m}${BADGE}`);
  return { ok: true, html };
}
