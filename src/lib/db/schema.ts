/**
 * Database schema (MariaDB 10.4+ / MySQL 8 compatible).
 * - JSON is stored as LONGTEXT via `jsonText` (MariaDB JSON = LONGTEXT alias; parsed on read).
 * - Binary media is chunked (≤ 512 KB per row) because shared hosts often cap max_allowed_packet.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  customType,
  date,
  datetime,
  decimal,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { AssetFocus } from "@/lib/media/focus";
import type { PageDoc } from "@/lib/page/schema";

/* ------------------------------------------------------------------ */
/* custom column types                                                 */
/* ------------------------------------------------------------------ */

export const jsonText = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType() {
      return "longtext";
    },
    toDriver(value: T): string {
      return JSON.stringify(value);
    },
    fromDriver(value: string | unknown): T {
      if (typeof value === "string") return JSON.parse(value) as T;
      if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8")) as T;
      return value as T;
    },
  })(name);

export const mediumBlob = (name: string) =>
  customType<{ data: Buffer; driverData: Buffer }>({
    dataType() {
      return "mediumblob";
    },
  })(name);

const now3 = sql`CURRENT_TIMESTAMP(3)`;
const createdAt = () => datetime("created_at", { mode: "date", fsp: 3 }).notNull().default(now3);
const money = (name: string) => decimal(name, { precision: 12, scale: 2, mode: "number" });

/* ------------------------------------------------------------------ */
/* auth                                                                */
/* ------------------------------------------------------------------ */

export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    email: varchar("email", { length: 191 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["owner", "editor", "agent"]).notNull().default("editor"),
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    /** sha256 hashes of unused one-time recovery codes */
    recoveryCodes: jsonText<string[]>("recovery_codes"),
    failedLogins: int("failed_logins").notNull().default(0),
    lockedUntil: datetime("locked_until", { mode: "date", fsp: 3 }),
    disabled: boolean("disabled").notNull().default(false),
    createdAt: createdAt(),
    lastLoginAt: datetime("last_login_at", { mode: "date", fsp: 3 }),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    /** sha256(token) hex — the raw token only lives in the cookie */
    id: char("id", { length: 64 }).primaryKey(),
    userId: varchar("user_id", { length: 26 }).notNull(),
    /** false until TOTP verified (when 2FA enabled) */
    mfaPassed: boolean("mfa_passed").notNull().default(false),
    createdAt: createdAt(),
    expiresAt: datetime("expires_at", { mode: "date", fsp: 3 }).notNull(),
    lastSeenAt: datetime("last_seen_at", { mode: "date", fsp: 3 }).notNull().default(now3),
    ip: varchar("ip", { length: 64 }),
    ua: varchar("ua", { length: 300 }),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_exp_idx").on(t.expiresAt)],
);

/* ------------------------------------------------------------------ */
/* pages & versions                                                    */
/* ------------------------------------------------------------------ */

export const pages = mysqlTable(
  "pages",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["draft", "published", "archived"]).notNull().default("draft"),
    locale: varchar("locale", { length: 5 }).notNull().default("ar"),
    /** public key used by the order API (pageKey) */
    publicKey: varchar("public_key", { length: 40 }).notNull(),
    draft: jsonText<PageDoc>("draft").notNull(),
    publishedVersionId: varchar("published_version_id", { length: 26 }),
    isHome: boolean("is_home").notNull().default(false),
    createdBy: varchar("created_by", { length: 26 }),
    createdAt: createdAt(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull().default(now3),
  },
  (t) => [uniqueIndex("pages_slug_uq").on(t.slug), uniqueIndex("pages_key_uq").on(t.publicKey)],
);

export const pageVersions = mysqlTable(
  "page_versions",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    pageId: varchar("page_id", { length: 26 }).notNull(),
    kind: mysqlEnum("kind", ["generation", "save", "publish", "restore", "import", "autosave"]).notNull(),
    label: varchar("label", { length: 160 }),
    doc: jsonText<PageDoc>("doc").notNull(),
    /** rendered landing HTML (publish versions) */
    html: longtext("html"),
    thankYouHtml: longtext("thank_you_html"),
    csp: text("csp"),
    thankYouCsp: text("thank_you_csp"),
    etag: varchar("etag", { length: 64 }),
    thumbnailAssetId: varchar("thumbnail_asset_id", { length: 64 }),
    starred: boolean("starred").notNull().default(false),
    checksum: char("checksum", { length: 64 }).notNull(),
    /** runtime contract embedded in the published HTML (1: v1 config + payloads; 2: Offers v2). Rows before 0003 = 1. */
    runtimeV: tinyint("runtime_v").notNull().default(1),
    createdBy: varchar("created_by", { length: 26 }),
    createdAt: createdAt(),
  },
  (t) => [index("pv_page_idx").on(t.pageId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* media                                                               */
/* ------------------------------------------------------------------ */

export interface AssetVariant {
  key: string; // storage key e.g. "a1b2…-960.webp"
  w: number;
  h: number;
  fmt: "webp" | "avif" | "png" | "jpeg";
  bytes: number;
}

export const assets = mysqlTable(
  "assets",
  {
    /** sha256 (hex, first 32) of the processed master */
    id: varchar("id", { length: 64 }).primaryKey(),
    kind: mysqlEnum("kind", ["image", "video"]).notNull().default("image"),
    mime: varchar("mime", { length: 40 }).notNull(),
    width: int("width").notNull(),
    height: int("height").notNull(),
    bytes: int("bytes").notNull(),
    alpha: boolean("alpha").notNull().default(false),
    dominant: char("dominant", { length: 7 }).notNull().default("#cccccc"),
    palette: jsonText<unknown>("palette"),
    variants: jsonText<AssetVariant[]>("variants").notNull(),
    originalName: varchar("original_name", { length: 200 }),
    /** produced by background removal from another asset */
    sourceAssetId: varchar("source_asset_id", { length: 64 }),
    tags: jsonText<string[]>("tags"),
    /** subject analysis (src/lib/media/focus.ts): focal point, subject box, heads/hands to keep in frame */
    focus: jsonText<AssetFocus>("focus"),
    /** FOCUS_VERSION the focus was computed with; null = not analysed (scripts/media-backfill.ts recomputes) */
    focusVersion: int("focus_version"),
    createdBy: varchar("created_by", { length: 26 }),
    createdAt: createdAt(),
  },
  (t) => [index("assets_created_idx").on(t.createdAt)],
);

export const mediaFiles = mysqlTable(
  "media_files",
  {
    key: varchar("key", { length: 120 }).primaryKey(),
    assetId: varchar("asset_id", { length: 64 }).notNull(),
    mime: varchar("mime", { length: 40 }).notNull(),
    bytes: int("bytes").notNull(),
    chunks: int("chunks").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("mf_asset_idx").on(t.assetId)],
);

export const mediaChunks = mysqlTable(
  "media_chunks",
  {
    key: varchar("key", { length: 120 }).notNull(),
    idx: int("idx").notNull(),
    data: mediumBlob("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.idx] })],
);

/* ------------------------------------------------------------------ */
/* commerce                                                            */
/* ------------------------------------------------------------------ */

/**
 * One physical piece of an order (docs/OFFERS.md §G.3). Snapshot at order time: names, labels and
 * codes as the page showed them. `value` / `code` / field names are printable text (owner labels
 * sanitized, a numeric value prefixed by its group name: "Pointure 42"); matrix = one entry,
 * dims in order ("Noir/M").
 */
export interface OrderUnit {
  /** item id at order time */
  item: string;
  /** item name snapshot ("" on single-item pages) */
  label: string;
  /** item short name (warehouse name) */
  short?: string;
  sku?: string;
  free?: true;
  options: { name: string; value: string; code?: string; delta?: number }[];
  fields?: { name: string; value: string; delta?: number }[];
}

/** orders.items JSON. v1 rows have no `v` (read them through orderUnits() in src/lib/orders/text.ts). */
export interface OrderItems {
  /** absent = v1 row */
  v?: 2;
  bundleId: string;
  /** offerSheetLabel (v1 format for v1-shaped offers) */
  bundleLabel: string;
  /** units incl. free (bump not included) */
  qty: number;
  /** fromCents(round((price + deltas) / qty)): v1 meaning kept */
  unitPrice: number;
  /** v1 compat: per unit { groupName: value, …, fieldName: value } (+ "Article": label on multi-item pages) */
  variants: Record<string, string>[];
  units?: OrderUnit[];
  /** order extras; `typed` = a typed value (printed in « »), `code` = warehouse code of a choice */
  extras?: { name: string; value: string; code?: string; typed?: true; delta?: number }[];
  /** offer.gift snapshot (non-catalog) */
  gift?: { label: string };
  /** offer base price, Σ surcharges */
  price?: number;
  deltas?: number;
  reasons?: { label: string; count: number; amount: number }[];
  bump?: { title: string; price: number; unit?: OrderUnit };
  upsell?: { title: string; price: number; item?: string; confirmOptions?: true };
}

export const orders = mysqlTable(
  "orders",
  {
    /** human friendly, e.g. "CMD-7K3Q9X" */
    id: varchar("id", { length: 20 }).primaryKey(),
    pageId: varchar("page_id", { length: 26 }).notNull(),
    versionId: varchar("version_id", { length: 26 }),
    exportId: varchar("export_id", { length: 26 }),
    source: mysqlEnum("source", ["live", "export", "php"]).notNull().default("live"),
    status: varchar("status", { length: 20 }).notNull().default("new"),
    name: varchar("name", { length: 120 }).notNull(),
    /** E.164 */
    phone: varchar("phone", { length: 24 }).notNull(),
    phoneRaw: varchar("phone_raw", { length: 40 }),
    city: varchar("city", { length: 120 }),
    address: varchar("address", { length: 300 }),
    note: varchar("note", { length: 400 }),
    email: varchar("email", { length: 160 }),
    productName: varchar("product_name", { length: 160 }).notNull(),
    items: jsonText<OrderItems>("items").notNull(),
    qty: int("qty").notNull(),
    subtotal: money("subtotal").notNull(),
    shipping: money("shipping").notNull(),
    total: money("total").notNull(),
    currency: char("currency", { length: 3 }).notNull(),
    locale: varchar("locale", { length: 5 }),
    utm: jsonText<Record<string, string>>("utm"),
    ref: varchar("ref", { length: 500 }),
    ipHash: char("ip_hash", { length: 64 }),
    ua: varchar("ua", { length: 300 }),
    eventId: varchar("event_id", { length: 64 }),
    idem: char("idem", { length: 36 }).notNull(),
    riskScore: int("risk_score").notNull().default(0),
    flags: jsonText<string[]>("flags"),
    upsellTokenHash: char("upsell_token_hash", { length: 64 }),
    sheetStatus: mysqlEnum("sheet_status", ["pending", "synced", "failed", "disabled"]).notNull().default("pending"),
    sheetAttempts: int("sheet_attempts").notNull().default(0),
    sheetError: varchar("sheet_error", { length: 500 }),
    createdAt: createdAt(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull().default(now3),
  },
  (t) => [
    uniqueIndex("orders_idem_uq").on(t.idem),
    index("orders_phone_idx").on(t.phone, t.createdAt),
    index("orders_page_idx").on(t.pageId, t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_sheet_idx").on(t.sheetStatus),
    index("orders_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

export const leads = mysqlTable(
  "leads",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    pageId: varchar("page_id", { length: 26 }).notNull(),
    idem: char("idem", { length: 36 }).notNull(),
    phone: varchar("phone", { length: 24 }).notNull(),
    name: varchar("name", { length: 120 }),
    city: varchar("city", { length: 120 }),
    bundleId: varchar("bundle_id", { length: 40 }),
    /** warehouse units text of the resolvable part of the lead's selection (src/lib/orders/text.ts) */
    selection: varchar("selection", { length: 400 }),
    utm: jsonText<Record<string, string>>("utm"),
    convertedOrderId: varchar("converted_order_id", { length: 20 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("leads_idem_uq").on(t.idem), index("leads_page_idx").on(t.pageId, t.createdAt)],
);

export const blocklist = mysqlTable(
  "blocklist",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    kind: mysqlEnum("kind", ["phone", "ip"]).notNull(),
    /** phone E.164, or sha256(ip) */
    value: varchar("value", { length: 64 }).notNull(),
    reason: varchar("reason", { length: 200 }),
    createdBy: varchar("created_by", { length: 26 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("block_uq").on(t.kind, t.value)],
);

export const exportsTable = mysqlTable(
  "exports",
  {
    id: varchar("id", { length: 26 }).primaryKey(),
    pageId: varchar("page_id", { length: 26 }).notNull(),
    versionId: varchar("version_id", { length: 26 }).notNull(),
    mode: mysqlEnum("mode", ["connected", "php", "whatsapp"]).notNull(),
    /** pageKey baked into the exported page */
    publicKey: varchar("public_key", { length: 40 }).notNull(),
    allowedOrigins: jsonText<string[]>("allowed_origins").notNull(),
    fileName: varchar("file_name", { length: 160 }),
    bytes: int("bytes"),
    createdBy: varchar("created_by", { length: 26 }),
    createdAt: createdAt(),
    revokedAt: datetime("revoked_at", { mode: "date", fsp: 3 }),
  },
  (t) => [uniqueIndex("exports_key_uq").on(t.publicKey), index("exports_page_idx").on(t.pageId)],
);

/* ------------------------------------------------------------------ */
/* platform                                                            */
/* ------------------------------------------------------------------ */

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonText<unknown>("value").notNull(),
  /** value is an AES-GCM envelope string (see security/crypto) */
  encrypted: boolean("encrypted").notNull().default(false),
  updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull().default(now3),
});

export const rateLimits = mysqlTable("rate_limits", {
  bucket: varchar("bucket", { length: 191 }).primaryKey(),
  count: int("count").notNull(),
  resetAt: datetime("reset_at", { mode: "date", fsp: 3 }).notNull(),
});

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: varchar("user_id", { length: 26 }),
    action: varchar("action", { length: 64 }).notNull(),
    target: varchar("target", { length: 191 }),
    meta: jsonText<Record<string, unknown>>("meta"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export const statsDaily = mysqlTable(
  "stats_daily",
  {
    pageId: varchar("page_id", { length: 26 }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    views: int("views").notNull().default(0),
    uniques: int("uniques").notNull().default(0),
    formStarts: int("form_starts").notNull().default(0),
    orders: int("orders").notNull().default(0),
    revenue: money("revenue").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.day] })],
);

/** short-lived unique-visitor markers (purged after 2 days) */
export const statsVisitors = mysqlTable(
  "stats_visitors",
  {
    pageId: varchar("page_id", { length: 26 }).notNull(),
    day: date("day", { mode: "string" }).notNull(),
    vidHash: char("vid_hash", { length: 32 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.day, t.vidHash] })],
);
