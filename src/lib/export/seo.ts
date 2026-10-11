/**
 * robots.txt and sitemap.xml of an export. Paths are absolute on the host (crawlers read robots.txt
 * at the host root only), so the site path from the site URL prefixes them.
 */
import type { SiteUrl } from "./options";

const xml = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function robotsTxt(opts: { site: SiteUrl | null; noindex: boolean }): string {
  const path = opts.site?.path ?? "/";
  const lines = ["User-agent: *"];
  if (opts.noindex) lines.push(`Disallow: ${path}`);
  else lines.push(`Allow: ${path}`, `Disallow: ${path}merci/`);
  if (opts.site && !opts.noindex) lines.push("", `Sitemap: ${opts.site.base}sitemap.xml`);
  return `${lines.join("\n")}\n`;
}

/** Only the product page is indexable (thank-you and legal pages are noindex). */
export function sitemapXml(site: SiteUrl, lastModified: Date): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    `  <url><loc>${xml(site.base)}</loc><lastmod>${lastModified.toISOString().slice(0, 10)}</lastmod></url>`,
    "</urlset>",
    "",
  ].join("\n");
}
