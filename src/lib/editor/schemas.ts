/**
 * Input schemas of the builder's server actions (isomorphic so the UI can pre-validate).
 */
import { z } from "zod";

/** ULID-style ids produced by newId() (26 Crockford base32 chars). */
export const RowId = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Invalid id");

export const Timestamp = z.number().int().nonnegative().max(8_640_000_000_000_000);

export const PageName = z
  .string()
  .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1, "Give the page a name").max(160, "At most 160 characters"));

/** Slug as typed: lower-cased, spaces → dashes, accents dropped; validated server-side (reserved, unique). */
export const SlugInput = z
  .string()
  .transform((v) =>
    v
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-"),
  )
  .pipe(
    z
      .string()
      .min(1, "Enter an address")
      .max(80, "At most 80 characters")
      .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/, "Use lowercase letters, digits and dashes (not at the start or end)"),
  );

export const VersionLabel = z
  .string()
  .transform((v) => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim())
  .pipe(z.string().max(160, "At most 160 characters"));

export const SaveDraftInput = z.object({
  pageId: RowId,
  doc: z.unknown(),
  baseUpdatedAt: Timestamp,
  /** overwrite even if the page changed elsewhere (after the user chose "keep mine") */
  force: z.boolean().default(false),
});

export const CreateVersionInput = z.object({
  pageId: RowId,
  kind: z.enum(["save", "generation", "import"]).default("save"),
  label: VersionLabel.optional(),
  /** return the newest version instead when it already holds the current draft */
  reuse: z.boolean().default(false),
});

export const PageRefInput = z.object({ pageId: RowId });

export const VersionRefInput = z.object({ pageId: RowId, versionId: RowId });

export const RestoreVersionInput = VersionRefInput.extend({ baseUpdatedAt: Timestamp });

export const DuplicatePageInput = z.object({
  pageId: RowId,
  /** duplicate this version instead of the current draft */
  versionId: RowId.optional(),
  name: PageName.optional(),
});

export const UpdatePageMetaInput = z.object({
  pageId: RowId,
  name: PageName.optional(),
  slug: SlugInput.optional(),
  /** moving a live page re-publishes the saved draft: only when it is still the one this editor saved */
  baseUpdatedAt: Timestamp.optional(),
});

export const StarVersionInput = VersionRefInput.extend({ starred: z.boolean() });

export const RenameVersionInput = VersionRefInput.extend({ label: VersionLabel });

export const ListVersionsInput = z.object({
  pageId: RowId,
  /** createdAt (ms) of the last version already shown */
  before: Timestamp.optional(),
  limit: z.number().int().min(1).max(100).default(40),
});

export const UnpublishInput = z.object({
  pageId: RowId,
  /** the draft token this editor holds (unpublishing touches the page row) */
  baseUpdatedAt: Timestamp.optional(),
});

export const PublishInput = z.object({
  pageId: RowId,
  /** publish only if the saved draft is still the one this editor saved (not changed in another tab) */
  baseUpdatedAt: Timestamp.optional(),
});
