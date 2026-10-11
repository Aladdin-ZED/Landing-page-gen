import "server-only";
/**
 * Publishing & serving of landing pages.
 *
 *   const v = await publishPage(pageId, user.id, { expectedUpdatedAt }); // draft → validated → rendered → immutable version
 *   const p = await getPublishedBySlug("argan");       // what GET /argan serves (cached in memory)
 *   const h = await getHomePublished();                // what GET / serves
 *   const l = await getLegalDocument(p, "privacy");    // GET /legal/privacy?p=argan (rendered on demand)
 *
 * Published HTML is rendered once at publish time and stored in page_versions (html, thank-you html,
 * both CSPs, etag, checksum); visitors get those bytes with zero React on the server per request.
 * Legal documents are rendered on request from the published doc + the CURRENT store settings
 * (so completing the store details updates them without a re-publish), then cached briefly.
 *
 * After an unpublish, a slug change, a page deletion, a "home" or Settings → Store change, call
 * invalidatePublished() (re-exported here from ./cache.server).
 */
import { createHash } from "node:crypto";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { isGatePath } from "@/lib/auth/gate";
import { db } from "@/lib/db/client";
import { newId } from "@/lib/db/ids";
import { pages, pageVersions, settings } from "@/lib/db/schema";
import { getAssetsByIds } from "@/lib/media";
import type { PageDoc } from "@/lib/page/schema";
import { validateDoc, type DocIssue } from "@/lib/page/validate";
import { getSetting, getSettings } from "@/lib/settings";
import { collectAssetIds, liveAssetResolver, liveLinks, type AssetResolver, type LegalKind, type StoreInfo } from "@/landing/context";
import type { DocumentUrls } from "@/landing/document";
import { cacheGet, cacheSet, invalidatePublished } from "./cache.server";
import { renderLandingHtml, renderLegalHtml, renderThankYouHtml, type RenderedHtml, type RenderIssue } from "./core";

export { invalidatePublished } from "./cache.server";

/** Slugs that can never be a landing page (app routes, the thank-you suffix, legal documents). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set(["admin", "api", "media", "fonts", "dev", "_next", "merci", "dev-fixtures", "legal"]);
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/**
 * A slug a landing page can live at: the slug pattern, not reserved, and never the secret admin gate
 * path (the proxy answers that path itself — and a page there would print the secret in public links).
 */
export function isServableSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug) && !isGatePath(`/${slug}`);
}

/** Public API endpoints called by the landing runtime (same origin as the page). */
export const PUBLIC_ENDPOINTS = {
  order: "/api/public/order",
  lead: "/api/public/lead",
  event: "/api/public/event",
  upsell: "/api/public/upsell",
} as const;

export const landingPath = (slug: string) => `/${slug}`;
export const thankYouPath = (slug: string) => `/${slug}/merci`;

/** Absolute public origin from PUBLIC_URL ("https://shop.ma"), or undefined when unset/invalid. */
export function publicOrigin(): string | undefined {
  const raw = process.env.PUBLIC_URL;
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

export class PublishError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "conflict",
    message: string,
    readonly issues: DocIssue[] = [],
    /** "conflict": the page's current updatedAt (ms), so an editor can reload or resolve */
    readonly serverUpdatedAt?: number,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface PublishOptions {
  /**
   * The draft stamp (pages.updated_at, ms) the caller is publishing. Checked before rendering and
   * again inside the write transaction (row locked): a draft saved anywhere in between →
   * PublishError("conflict"). Without it, the draft current at call time is published, re-rendered
   * when an autosave lands while it renders.
   */
  expectedUpdatedAt?: number;
}

/** Re-render attempts when the draft keeps changing during an unchecked publish. */
const PUBLISH_ATTEMPTS = 3;

const draftChanged = (serverUpdatedAt: number) =>
  new PublishError("conflict", "This page was changed somewhere else. Load the latest version, then publish again.", [], serverUpdatedAt);

export interface PublishResult {
  versionId: string;
  pageId: string;
  slug: string;
  etag: string;
  publishedAt: Date;
  /** repairs made by validateDoc (warnings) */
  issues: DocIssue[];
  /** sections left out because they failed to render */
  renderIssues: RenderIssue[];
}

/** Store identity for documents: every field of Settings → Store (sanitized again by storeContext()). */
export async function storeInfo(): Promise<StoreInfo> {
  const s = await getSetting("store");
  const socials = Object.fromEntries(Object.entries(s.socials ?? {}).filter((e): e is [string, string] => typeof e[1] === "string" && !!e[1]));
  return {
    name: s.storeName,
    country: s.country,
    ...(s.legalName ? { legalName: s.legalName } : {}),
    ...(s.phone ? { phone: s.phone } : {}),
    ...(s.whatsapp ? { whatsapp: s.whatsapp } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.address ? { address: s.address } : {}),
    ...(s.city ? { city: s.city } : {}),
    ...(s.ice ? { ice: s.ice } : {}),
    ...(s.rc ? { rc: s.rc } : {}),
    ...(s.logo ? { logo: s.logo } : {}),
    ...(Object.keys(socials).length ? { socials } : {}),
  };
}

/** Live asset resolver for every asset the document (and store logo) references. */
export async function liveResolverFor(doc: PageDoc, store: StoreInfo): Promise<AssetResolver> {
  const rows = await getAssetsByIds(collectAssetIds(doc, [store.logo]));
  return liveAssetResolver(rows);
}

/** Turnstile site key to embed: only when a secret is configured too (the order API verifies tokens). */
async function turnstileSiteKey(): Promise<string | undefined> {
  const t = await getSetting("turnstile");
  return t.siteKey && t.secretKey ? t.siteKey : undefined;
}

const sha256hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

/**
 * Validate the page draft, render landing + thank-you pages, store them as an immutable "publish"
 * version and point the page at it. Throws PublishError("not_found" | "invalid" | "conflict").
 *
 * The version always holds exactly the draft whose stamp is checked in the transaction: the row is
 * locked (FOR UPDATE) and its updated_at compared with the one read before rendering.
 */
export async function publishPage(pageId: string, userId: string, opts: PublishOptions = {}): Promise<PublishResult> {
  for (let attempt = 1; ; attempt++) {
    const res = await publishOnce(pageId, userId, opts.expectedUpdatedAt);
    if (res !== "retry") return res;
    // an autosave landed while rendering (unchecked publish): render the newer draft
    if (attempt >= PUBLISH_ATTEMPTS) {
      const [row] = await db.select({ updatedAt: pages.updatedAt }).from(pages).where(eq(pages.id, pageId)).limit(1);
      throw draftChanged(row?.updatedAt.getTime() ?? Date.now());
    }
  }
}

async function publishOnce(pageId: string, userId: string, expectedUpdatedAt: number | undefined): Promise<PublishResult | "retry"> {
  const [page] = await db
    .select({ id: pages.id, slug: pages.slug, draft: pages.draft, publicKey: pages.publicKey, updatedAt: pages.updatedAt })
    .from(pages)
    .where(eq(pages.id, pageId))
    .limit(1);
  if (!page) throw new PublishError("not_found", "Page not found.");
  const readStamp = page.updatedAt.getTime();
  // cheap early answer: no rendering for a draft the caller has not seen
  if (expectedUpdatedAt !== undefined && readStamp !== expectedUpdatedAt) throw draftChanged(readStamp);
  if (!isServableSlug(page.slug)) throw new PublishError("invalid", `The address "/${page.slug}" is reserved — choose another slug.`);

  const { doc, issues } = validateDoc(page.draft);
  if (!doc) throw new PublishError("invalid", "The page has errors that must be fixed before publishing.", issues);

  const [store, siteKey] = await Promise.all([storeInfo(), turnstileSiteKey()]);
  const assets = await liveResolverFor(doc, store);
  const urls: DocumentUrls = { landing: landingPath(page.slug), thankYou: thankYouPath(page.slug), endpoints: PUBLIC_ENDPOINTS };
  const opts = {
    mode: "live" as const,
    assets,
    pageKey: page.publicKey,
    store,
    urls,
    links: liveLinks(page.slug),
    origin: publicOrigin(),
    turnstileSiteKey: siteKey,
  };
  const landing = await renderLandingHtml(doc, opts);
  const thanks = await renderThankYouHtml(doc, opts);

  const versionId = newId();
  let publishedAt = new Date();
  const committed = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ updatedAt: pages.updatedAt, slug: pages.slug })
      .from(pages)
      .where(eq(pages.id, page.id))
      .limit(1)
      .for("update");
    if (!locked) throw new PublishError("not_found", "Page not found.");
    const stamp = locked.updatedAt.getTime();
    if (stamp !== readStamp || locked.slug !== page.slug) {
      if (expectedUpdatedAt !== undefined) throw draftChanged(stamp);
      return false;
    }
    // the stamp always moves forward (editors compare it exactly)
    publishedAt = new Date(Math.max(publishedAt.getTime(), stamp + 1));
    await tx.insert(pageVersions).values({
      id: versionId,
      pageId: page.id,
      kind: "publish",
      label: null,
      doc,
      html: landing.html,
      thankYouHtml: thanks.html,
      csp: landing.csp,
      thankYouCsp: thanks.csp,
      etag: landing.etag,
      checksum: sha256hex(JSON.stringify(doc)),
      createdBy: userId,
      createdAt: publishedAt,
    });
    await tx
      .update(pages)
      .set({ publishedVersionId: versionId, status: "published", locale: doc.locale, updatedAt: publishedAt })
      .where(eq(pages.id, page.id));
    return true;
  });
  if (!committed) return "retry";
  invalidatePublished();
  await audit("page.published", {
    userId,
    target: page.id,
    meta: { versionId, slug: page.slug, warnings: issues.length, failedSections: landing.issues.map((i) => i.sectionId), turnstile: !!siteKey },
  });

  return { versionId, pageId: page.id, slug: page.slug, etag: landing.etag, publishedAt, issues, renderIssues: landing.issues };
}

/* ------------------------------------------------------------------ */
/* Serving                                                             */
/* ------------------------------------------------------------------ */

export interface PublishedPage {
  pageId: string;
  versionId: string;
  slug: string;
  html: string;
  csp: string;
  etag: string;
  thankYouHtml: string;
  thankYouCsp: string;
  noindex: boolean;
  /** the published document (theme, locale, offers… of legal documents) */
  doc: PageDoc;
  /** when this version was published */
  publishedAt: Date;
}

const HOME_KEY = "/"; // never a slug

async function loadBy(where: SQL): Promise<PublishedPage | null> {
  const [row] = await db
    .select({
      pageId: pages.id,
      slug: pages.slug,
      versionId: pageVersions.id,
      html: pageVersions.html,
      csp: pageVersions.csp,
      etag: pageVersions.etag,
      thankYouHtml: pageVersions.thankYouHtml,
      thankYouCsp: pageVersions.thankYouCsp,
      doc: pageVersions.doc,
      createdAt: pageVersions.createdAt,
    })
    .from(pages)
    .innerJoin(pageVersions, eq(pageVersions.id, pages.publishedVersionId))
    .where(and(where, eq(pages.status, "published")))
    .limit(1);
  if (!row || !row.html || !row.csp || !row.etag || !row.thankYouHtml || !row.thankYouCsp) return null;
  return {
    pageId: row.pageId,
    versionId: row.versionId,
    slug: row.slug,
    html: row.html,
    csp: row.csp,
    etag: row.etag,
    thankYouHtml: row.thankYouHtml,
    thankYouCsp: row.thankYouCsp,
    noindex: row.doc?.seo?.noindex === true,
    doc: row.doc,
    publishedAt: row.createdAt,
  };
}

/** The published version served at /<slug> (null when unknown, unpublished or reserved). */
export async function getPublishedBySlug(slug: string): Promise<PublishedPage | null> {
  if (!isServableSlug(slug)) return null;
  const hit = cacheGet<PublishedPage | null>("published", slug);
  if (hit) return hit.value;
  return cacheSet("published", slug, await loadBy(eq(pages.slug, slug)));
}

/** The page served at "/": settings "home".pageId, else the page flagged isHome, else the most recently published page. */
export async function getHomePublished(): Promise<PublishedPage | null> {
  const hit = cacheGet<PublishedPage | null>("published", HOME_KEY);
  if (hit) return hit.value;
  const { home } = await getSettings(["home"]);
  let value: PublishedPage | null = null;
  if (home.pageId) value = await loadBy(eq(pages.id, home.pageId));
  if (!value) value = await loadBy(eq(pages.isHome, true));
  if (!value) {
    const [latest] = await db
      .select({ id: pages.id })
      .from(pages)
      .where(eq(pages.status, "published"))
      .orderBy(desc(pages.updatedAt))
      .limit(1);
    if (latest) value = await loadBy(eq(pages.id, latest.id));
  }
  return cacheSet("published", HOME_KEY, value);
}

/* ------------------------------------------------------------------ */
/* Legal documents                                                     */
/* ------------------------------------------------------------------ */

/** The page a legal document is dressed like: /legal/<kind>?p=<slug>, else the home page. */
export async function getLegalSource(slug: string | null): Promise<PublishedPage | null> {
  if (slug && isServableSlug(slug)) {
    const page = await getPublishedBySlug(slug);
    if (page) return page;
  }
  return getHomePublished();
}

/** When Settings → Store last changed (the legal texts are built from it). */
async function storeUpdatedAt(): Promise<Date | null> {
  const [row] = await db.select({ updatedAt: settings.updatedAt }).from(settings).where(eq(settings.key, "store")).limit(1);
  return row?.updatedAt ?? null;
}

/**
 * A legal document of a published page (theme, locale, market, form fields and pixels of that page;
 * identity from the current store settings), "updated" at the later of the publish and the last
 * store change. Null when the stored document no longer validates.
 */
export async function getLegalDocument(page: PublishedPage, kind: LegalKind): Promise<RenderedHtml | null> {
  const key = `${page.versionId}:${page.slug}:${kind}`;
  const hit = cacheGet<RenderedHtml | null>("legal", key);
  if (hit) return hit.value;
  const { doc } = validateDoc(page.doc);
  if (!doc) return cacheSet("legal", key, null);
  const [store, changed] = await Promise.all([storeInfo(), storeUpdatedAt()]);
  const rows = store.logo ? await getAssetsByIds([store.logo.id]) : [];
  const updatedAt = new Date(Math.max(page.publishedAt.getTime(), changed?.getTime() ?? 0)).toISOString();
  const rendered = await renderLegalHtml(doc, kind, {
    mode: "live",
    assets: liveAssetResolver(rows),
    store,
    links: liveLinks(page.slug),
    updatedAt,
  });
  return cacheSet("legal", key, rendered);
}
