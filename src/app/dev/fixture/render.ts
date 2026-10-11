/**
 * Dev-only fixture rendering shared by /dev/fixture/<name>, /dev/fixture/<name>/merci and
 * /dev/fixture/<name>/legal/<kind>. Answers the public 404 in production.
 * Query: ?locale=ar|fr|en&arch=<archetype>&seed=<n> (kept on every link between the documents).
 * The runtime runs in preview mode (no orders, events or pixels).
 */
import "server-only";
import type { NextRequest } from "next/server";
import { isLegalKind, type LegalKind } from "@/landing/context";
import type { PageLinks } from "@/landing/types";
import { FIXTURE_LOCALES, fixtureAssets, getFixture, isFixtureName, type FixtureLocale } from "@/lib/page/fixtures";
import { ARCHETYPES, type Archetype } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { renderLandingHtml, renderLegalHtml, renderThankYouHtml } from "@/lib/render/render.server";
import { PUBLIC_ENDPOINTS } from "@/lib/render/publish.server";
import { documentResponse, notFoundResponse } from "@/lib/render/serve.server";

export type FixturePage = "landing" | "thanks" | LegalKind;

/** The fixture's own URLs (query kept so the theme/locale overrides follow the visitor). */
function fixtureLinks(name: string, keep: string): PageLinks {
  const legal = (k: LegalKind) => `/dev/fixture/${name}/legal/${k}${keep}`;
  return { home: `/dev/fixture/${name}${keep}`, privacy: legal("privacy"), terms: legal("terms"), shipping: legal("shipping"), contact: legal("contact") };
}

export async function renderFixture(req: NextRequest, name: string, page: FixturePage): Promise<Response> {
  if (process.env.NODE_ENV === "production" || !isFixtureName(name)) return notFoundResponse(req);
  const q = req.nextUrl.searchParams;
  const locale = q.get("locale");
  const arch = q.get("arch");
  const seedRaw = q.get("seed");
  const seed = seedRaw !== null && /^\d{1,10}$/.test(seedRaw) ? Math.min(Number(seedRaw), 2_147_483_647) : undefined;
  const fx = getFixture(name, {
    locale: locale && (FIXTURE_LOCALES as readonly string[]).includes(locale) ? (locale as FixtureLocale) : undefined,
    archetype: arch && (ARCHETYPES as readonly string[]).includes(arch) ? (arch as Archetype) : undefined,
    seed,
  });
  const { doc } = validateDoc(fx.doc);
  if (!doc) return notFoundResponse(req);
  // only the recognised overrides travel with the links (never arbitrary query text)
  const params = new URLSearchParams();
  if (locale && (FIXTURE_LOCALES as readonly string[]).includes(locale)) params.set("locale", locale);
  if (arch && (ARCHETYPES as readonly string[]).includes(arch)) params.set("arch", arch);
  if (seed !== undefined) params.set("seed", String(seed));
  const qs = params.toString();
  const keep = qs ? `?${qs}` : "";
  const links = fixtureLinks(name, keep);
  const assets = fixtureAssets("/");

  if (isLegalKind(page)) {
    const r = await renderLegalHtml(doc, page, { mode: "live", assets, store: fx.store, links, upgradeInsecureRequests: false });
    return documentResponse(req, r, { kind: "legal", cacheControl: "no-store" });
  }
  const opts = {
    mode: "live" as const,
    assets,
    pageKey: fx.pageKey,
    store: fx.store,
    links,
    urls: { landing: links.home, thankYou: `/dev/fixture/${name}/merci${keep}`, endpoints: PUBLIC_ENDPOINTS },
    origin: req.nextUrl.origin,
    runtimeMode: "preview" as const,
    upgradeInsecureRequests: false,
  };
  const r = page === "landing" ? await renderLandingHtml(doc, opts) : await renderThankYouHtml(doc, opts);
  for (const i of r.issues) console.warn(`[dev fixture] section ${i.sectionId} (${i.type}) failed: ${i.message}`);
  return documentResponse(req, r, { kind: page, noindex: true, cacheControl: "no-store" });
}
