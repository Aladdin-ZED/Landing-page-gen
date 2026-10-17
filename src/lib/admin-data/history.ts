import "server-only";
/**
 * Version history across all pages — the "last generated landing pages" store: generations, saves,
 * publishes, restores and imports, newest first. Restore makes a version the page's draft again
 * (recorded as a new "restore" version, the replaced draft kept as a "Before restore" autosave, so
 * nothing is ever lost).
 */
import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { pages, pageVersions, users } from "@/lib/db/schema";
import { EditorError, restoreVersion as restoreDraft } from "@/lib/editor/pages.server";
import type { PageDoc } from "@/lib/page/schema";
import { validateDoc } from "@/lib/page/validate";
import { createPageFromDoc, type Actor } from "./pages";

export { EditorError };

export const VERSION_KINDS = ["generation", "save", "publish", "restore", "import", "autosave"] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];

export interface VersionItem {
  id: string;
  pageId: string;
  pageName: string;
  pageSlug: string;
  pageStatus: "draft" | "published" | "archived";
  kind: VersionKind;
  label: string | null;
  starred: boolean;
  createdAt: string;
  createdBy: string | null;
  /** this version is what visitors currently get */
  live: boolean;
  doc: PageDoc | null;
  productName: string;
  archetype: string | null;
  sections: number;
}

export interface VersionFilters {
  pageId?: string;
  kind?: VersionKind;
  starred?: boolean;
  /** autosaves are hidden unless asked for */
  includeAutosave?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listVersions(filters: VersionFilters = {}): Promise<{ items: VersionItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.min(60, Math.max(1, Math.floor(filters.pageSize ?? 24)));
  const where: SQL[] = [];
  if (filters.pageId) where.push(eq(pageVersions.pageId, filters.pageId));
  if (filters.kind) where.push(eq(pageVersions.kind, filters.kind));
  else if (!filters.includeAutosave) where.push(ne(pageVersions.kind, "autosave"));
  if (filters.starred) where.push(eq(pageVersions.starred, true));
  const cond = where.length ? and(...where) : undefined;

  const [rows, [total]] = await Promise.all([
    db
      .select({
        id: pageVersions.id,
        pageId: pageVersions.pageId,
        kind: pageVersions.kind,
        label: pageVersions.label,
        starred: pageVersions.starred,
        createdAt: pageVersions.createdAt,
        doc: pageVersions.doc,
        createdBy: users.name,
        pageName: pages.name,
        pageSlug: pages.slug,
        pageStatus: pages.status,
        publishedVersionId: pages.publishedVersionId,
      })
      .from(pageVersions)
      .innerJoin(pages, eq(pages.id, pageVersions.pageId))
      .leftJoin(users, eq(users.id, pageVersions.createdBy))
      .where(cond)
      .orderBy(desc(pageVersions.createdAt), desc(pageVersions.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(pageVersions).innerJoin(pages, eq(pages.id, pageVersions.pageId)).where(cond),
  ]);

  const items = rows.map((r): VersionItem => {
    const { doc } = validateDoc(r.doc);
    return {
      id: r.id,
      pageId: r.pageId,
      pageName: r.pageName,
      pageSlug: r.pageSlug,
      pageStatus: r.pageStatus,
      kind: r.kind,
      label: r.label,
      starred: r.starred,
      createdAt: r.createdAt.toISOString(),
      createdBy: r.createdBy ?? null,
      live: r.pageStatus === "published" && r.publishedVersionId === r.id,
      doc,
      productName: doc?.product.name ?? r.pageName,
      archetype: doc?.theme.archetype ?? null,
      sections: doc?.sections.filter((s) => !s.hidden).length ?? 0,
    };
  });
  return { items, total: Number(total?.n ?? 0), page, pageSize };
}

/** Version counts per kind (filter chips). */
export async function versionKindCounts(pageId?: string): Promise<Record<VersionKind, number> & { starred: number }> {
  const where = pageId ? eq(pageVersions.pageId, pageId) : undefined;
  const [rows, [starred]] = await Promise.all([
    db.select({ kind: pageVersions.kind, n: count() }).from(pageVersions).where(where).groupBy(pageVersions.kind),
    db.select({ n: count() }).from(pageVersions).where(and(where, eq(pageVersions.starred, true))),
  ]);
  const out = { generation: 0, save: 0, publish: 0, restore: 0, import: 0, autosave: 0, starred: Number(starred?.n ?? 0) };
  for (const r of rows) out[r.kind] = Number(r.n);
  return out;
}

export async function setVersionStarred(id: string, starred: boolean): Promise<boolean> {
  const res = await db.update(pageVersions).set({ starred }).where(eq(pageVersions.id, id));
  const head = Array.isArray(res) ? res[0] : res;
  return ((head as { affectedRows?: number }).affectedRows ?? 0) === 1;
}

async function getVersion(id: string) {
  const [row] = await db
    .select({ id: pageVersions.id, pageId: pageVersions.pageId, kind: pageVersions.kind, doc: pageVersions.doc, createdAt: pageVersions.createdAt, pageName: pages.name })
    .from(pageVersions)
    .innerJoin(pages, eq(pages.id, pageVersions.pageId))
    .where(eq(pageVersions.id, id))
    .limit(1);
  return row ?? null;
}

const KIND_LABEL: Record<VersionKind, string> = {
  generation: "generation",
  save: "save",
  publish: "published version",
  restore: "restore",
  import: "import",
  autosave: "autosave",
};

const shortDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

/**
 * Make a version the page's draft again, through the builder's own restore: the current draft is
 * first kept as a "Before restore" autosave (so the restore can be undone), and the write is a
 * compare-and-swap on updatedAt (a builder tab with the page open sees a conflict, never a silent
 * overwrite). Throws EditorError ("not_found" | "invalid" | "conflict") with a readable message.
 */
export async function restoreVersion(id: string, user: SessionUser, actor: Actor): Promise<{ pageId: string }> {
  const [v] = await db
    .select({ pageId: pageVersions.pageId, updatedAt: pages.updatedAt })
    .from(pageVersions)
    .innerJoin(pages, eq(pages.id, pageVersions.pageId))
    .where(eq(pageVersions.id, id))
    .limit(1);
  if (!v) throw new EditorError("not_found", "This version no longer exists.");
  await restoreDraft(user, { pageId: v.pageId, versionId: id, baseUpdatedAt: v.updatedAt.getTime() });
  await audit("page.version_restored", { userId: actor.id, target: v.pageId, meta: { versionId: id }, ip: actor.ip });
  return { pageId: v.pageId };
}

/** Start a brand-new draft page from any version. */
export async function duplicateVersionAsPage(id: string, actor: Actor): Promise<{ id: string; slug: string } | null> {
  const v = await getVersion(id);
  if (!v) return null;
  const { doc } = validateDoc(v.doc);
  if (!doc) return null;
  const created = await createPageFromDoc(
    { name: `${v.pageName} (${KIND_LABEL[v.kind]} copy)`, doc, versionLabel: `Copied from “${v.pageName}” · ${KIND_LABEL[v.kind]} of ${shortDate(v.createdAt)}`, copiedFrom: v.pageName },
    actor,
  );
  await audit("page.version_duplicated", { userId: actor.id, target: created.id, meta: { versionId: id, from: v.pageId }, ip: actor.ip });
  return created;
}
