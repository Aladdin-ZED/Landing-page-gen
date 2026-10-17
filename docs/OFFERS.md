# Offers v2: items, line-based offers, flexible options, offer layouts, per-page pixels

Status: **design spec, revision 2, ready to build** (2026-10-16). Revision 2 resolves the three reviews
(cod-ops, engineering, ux); every point is decided in §K. Owner request: per-page pixels; free, well-structured
offer/pack creation inside the landing page (multi-item, "choose one", combos, gifts, packs generated from the
page's items); merged option groups (color × size), custom inputs and per-offer option rules; a design choice
for how offers are picked and filled. This document is the contract between the engineers who build it in
parallel (§I.6 has the phases, tracks and file ownership). Where this spec and older docs disagree, this spec
wins; ARCHITECTURE.md / SECTIONS.md / DESIGN.md / DEPLOY-HOSTINGER.md are updated in Phase 2.

Reading order: §0 (decisions) → the track you own (§I.6) → §J (appendix tables) → §K (why).

---

## 0. Decisions at a glance

| # | Decision | Why |
|---|---|---|
| D1 | A page sells **items** (`doc.items`, 1–8). `items[0]` is the **lead item** (shown first; single-item pages take hero price and visuals from it). The upgraded v1 product becomes the item with id **`main`**; content ids key off the id, never the position. With 2+ items every item has a name. `doc.product` keeps only the story. | One model for 1 or 8 items; reordering never changes ad content ids; the compiler finds every old read site. |
| D2 | An **offer** = 1–6 **lines**; a line = `qty × (fixed item \| customer's choice among items)`, optionally **free**, optionally with **option rules** (lock / allow / preset) on fixed lines. Price = one number; options may add surcharges; the card always shows a **payable** price ("Dès" when it can rise). | ×N packs, "choose one", "any 2 of 3", combos, BOGO, gifts, "1 Noir + 1 Blanc", "Noir/Gris only" with one rule set, no fake items. |
| D3 | The array keeps its v1 key **`offers.bundles`**; DOM keeps v1 offer names (`name="bundle"`, `data-bundle-card`, `data-bundle`, `bundleId`). | Ids, leads, events, stored orders, CTAs and CSS keep working. |
| D4 | Option groups: **choice** (≤ 40 options), **matrix** (2–3 merged dimensions, exceptions keyed by value ids with wildcards, states in / out / not made, linked or combined picker), **field** (typed text/number). Deltas ≥ 0. `Choice.code` = Latin warehouse code. | "Merge color and size", "name to print", "XL +20", Arabic labels to Latin-only warehouses. |
| D5 | Offer design = `offers.display`: **picker** ("Offer layout": stack, tiers, ticket, pills, visual), **fill** ("Personalization layout": auto, inline, rows, steps, box; resolved once per page), **selection** ("Selected style": soft, solid, outline) + media, density, and three one-tap combos. | Answers "a structure for the bundle selection or fill" with a set that can be designed and tested. |
| D6 | **Pixels belong to pages.** Settings → Pixels = **library** (ids, labels, tokens, health, usage). Every page answers explicitly (pixels or "No pixel"). Pixels-only live update, per-page time-boxed test mode, only owners add new ids. | Owner rule (1), without untracked ad spend or cross-page test leaks. |
| D7 | `PageDoc.v` = **2**. `PageDoc = z.preprocess(upgradeDoc, PageDocObject)`; `upgradeDoc` = v1→v2 + deterministic **repairs** for every rule existing data can break. A read-only **dry run over production data** gates the deploy. `versionDoc` never refuses orders over a repairable doc. | Published HTML is immutable; live pages must keep taking orders. |
| D8 | Order API dispatches on `v`: payload **v1 forever**, payload **v2** carries `ver` (version shown) and `st` (total shown). The server prices against the version the shopper saw (≤ 72 h after it was replaced), else answers **`stale`** and the runtime reloads. | Open in-app tabs survive republishes; the price charged is the price shown. |
| D9 | **Money in integer cents** in TS server, runtime and PHP; `Money` ≤ 2 decimals. | Four implementations, one result. |
| D10 | Delivery: **effective free = `shippingFee === 0 \|\| offer.freeShipping`**; the upgrade, presets and generator set `freeShipping: false`. | Truthful marks; raising the fee later charges every offer. |
| D11 | Runtime split into hashed chunks (core, thanks, pixels, turnstile, **per-page feature chunks**); budgets set by a Phase 0 spike; page size caps checked at publish. | Today 19.0 KB gz for one bundle; the unit builder must not make visitors pay for features the page doesn't use. |
| D12 | **Photo crop is in scope** (`AssetRef.box`, CSS only). Items get **photo wells**; a photo picked by 2+ items is a **group photo** (derived, no tagging). | The owner's case: one photo shows two products. |
| D13 | Order text grammar v2 (call-center safe: markers, quotes, codes, order segment, 1000-char cap). Gifts, bump items and SKUs reach the Sheet. | The warehouse packs what the Sheet says. |

Glossary: **item** = a sellable thing. **offer** (UI: "Offre"/"Pack") = what the customer picks. **line** = part
of an offer. **unit** = one physical piece of an offer (`Σ line.qty`), index `k` (0-based, lines in order).
**group** = an item's option group. **rule** = a line's lock/allow/preset on one group or matrix dim. **fill** =
choosing items/options/fields for each unit. **group photo** = a photo assigned uncropped to 2+ items.

---

## A. Per-page pixels

### A.1 Today (read before changing)
- `PageDoc.tracking` = id lists per platform (`metaPixelId`, `tiktokPixelId`, `snapPixelId`, `ga4Id`; limits
  meta 3 / tiktok 3 / snap 1 / ga4 1). The page already owns its ids; they are baked into the published HTML
  (`buildRuntimeConfig → runtimePixels`, empty in preview).
- Store setting `pixels` (same shape) = defaults: `createFromDirectionsAction` merges them into new pages
  (`mergeStorePixels(…, "fill")`) unless the wizard sends `pixels: "chosen"`; Settings → Pixels "Apply to pages"
  replaces page lists (`applyStorePixelsToDrafts`); the builder shows "differs from store / Use store pixels";
  the wizard pre-ticks every store pixel (`pixelsOff` = opt-out).
- `tracking_secrets` (encrypted): `metaTokens/tiktokTokens/metaTestCodes/tiktokTestCodes` keyed by pixel id, plus
  legacy single `metaCapiToken/tiktokToken/…TestEventCode` used for any id without its own token.
  `serverCredentials` (conversions-core.ts:178) attaches a test code to **every** real Purchase of that pixel.
- Server Purchase sends one event per pixel of the published doc that has credentials.
  `src/lib/admin-data/pages.ts applyPixelsToDrafts` is dead code. `restoreVersion` (editor/pages.server.ts:334)
  replaces the whole draft, pixels included.

### A.2 Target model
1. **Page**: `doc.tracking` = the page's ids (shape and limits unchanged) + `none?: true` (the owner answered
   "No pixel on this page") + `copiedFrom?: string` (set by Duplicate). A page renders, and the server sends
   events to, **only its own ids**. Live ids change at publish, or through the **pixels-only live update**
   (§A.3), which republishes the live version with only `tracking` replaced.
2. **Library**: non-secret setting `pixel_library`. Every pixel the store knows, a label, and its active **test
   windows** (per page, time-boxed).
3. **Credentials**: `tracking_secrets` per-id maps. A test code is a stored value; it is attached to an event
   only inside an active window for that event's page. Legacy single fields stay stored (rollback only) and
   are never read by the new build; deleted in the cleanup release (§I.7).
4. **Health**: non-secret setting `pixel_health`: last server outcome per pixel, no personal data.
5. **Usage**: computed, not stored. `pixelUsage()` (src/lib/pixels/usage.server.ts) scans ≤ 1000 non-archived
   drafts + published versions + non-revoked exports' versions, prefiltered with `LIKE '%"<id>"%'` (as
   `admin-data/assets.ts` does), confirmed with `pixelIdList(raw.tracking)`; cached 30 s, invalidated in-worker
   by saves and publishes.

```ts
// src/lib/settings/schemas.ts
export const PixelTestWindow = z.object({ pageId: z.string().length(26), until: z.iso.datetime({ offset: true }) });
export const PixelLibraryEntry = z
  .object({
    platform: z.enum(PIXEL_PLATFORMS),
    id: z.string(),                                     // canonical (normalizePixelId); immutable once saved
    label: z.string().trim().max(40).default(""),       // "Compte principal", "BM backup 2"
    addedAt: z.iso.datetime({ offset: true }),
    tests: z.array(PixelTestWindow).max(5).default([]), // expired windows pruned on every write
  })
  .superRefine((e, c) => { if (!PIXEL_ID_RE[e.platform].test(e.id)) c.addIssue({ code: "custom", message: ID_HELP[e.platform], path: ["id"] }); });
export const PixelLibrarySettings = z
  .object({ v: z.literal(1).default(1), pixels: z.array(PixelLibraryEntry).max(200).default([]) }) // UI adds up to 100; headroom so the migration never drops an id
  .refine((l) => new Set(l.pixels.map((p) => `${p.platform}:${p.id}`)).size === l.pixels.length, { error: "Duplicate pixel." });
export const PixelHealthEntry = z.object({
  at: z.iso.datetime({ offset: true }),
  state: z.enum(["ok", "refused", "unverified"]),
  code: z.enum(["token", "permission", "pixel", "rate", "network", "other"]).optional(),
  testMode: z.boolean(),
});
export const PixelHealth = z.record(z.string().max(80), PixelHealthEntry);   // key "platform:id"
// SETTINGS.pixel_library, SETTINGS.pixel_health: secret false. perPixel(...) cap 12 → 200.
```
```ts
// src/lib/page/schema.ts: Tracking keeps its id fields and gains
none: z.literal(true).optional(),          // "No pixel on this page" (organic / test). Repair drops it when any id is set.
copiedFrom: z.string().max(120).optional(),// "Pixels copied from {page}" until the owner keeps or edits them
```

Example state:
```json
// settings.pixel_library
{ "v": 1, "pixels": [
  { "platform": "meta",   "id": "1234567890123456", "label": "Compte principal", "addedAt": "2026-10-16T10:00:00Z", "tests": [] },
  { "platform": "meta",   "id": "6543210987654321", "label": "BM backup",        "addedAt": "2026-10-16T10:00:00Z", "tests": [] },
  { "platform": "tiktok", "id": "C4ABCDEF12345678", "label": "TikTok Maroc",     "addedAt": "2026-10-16T10:00:00Z",
    "tests": [{ "pageId": "01JA…duo", "until": "2026-10-16T11:00:00Z" }] } ] }
// settings.tracking_secrets (encrypted)
{ "metaTokens": { "1234567890123456": "EAAG…" }, "tiktokTokens": { "C4ABCDEF12345678": "a1b2…" }, "tiktokTestCodes": { "C4ABCDEF12345678": "TEST12345" } }
// settings.pixel_health
{ "tiktok:C4ABCDEF12345678": { "at": "2026-10-16T10:12:00Z", "state": "ok", "testMode": true } }
// page "duo-eclat" draft
{ "tracking": { "metaPixelId": ["6543210987654321"], "tiktokPixelId": ["C4ABCDEF12345678"] } }
```
→ duo-eclat fires Meta backup (browser only: no token) and TikTok (browser + server, test-coded until 11:00 for
this page only). Another page firing the same TikTok pixel sends normal production events.

### A.3 Server API (all through `adminAction`; src/app/admin/(panel)/settings/pixels/actions.ts unless noted)
| Action | Permission | Does |
|---|---|---|
| `pixelLibraryAction()` | pages.read | entries + `{ server: hasOwnToken, testCode: saved, activeTests }` + health + usage `{ pages, live, exports }`. Never a token. Replaces `storePixelSummaryAction`. |
| `savePixelEntryAction({ platform, id, label, token, testCode })` | settings.write | add (≤ 100 in the UI) or edit. The id is immutable (to move pages to another id use Replace). Token `""` = remove, mask `••••3f9a` = keep (existing `isMask` rule), new value = replace; a changed token sets health `unverified`. |
| `replacePixelAction({ platform, from, to, pageIds, live })` | pages.write; + pages.publish when `live`; + settings.write when `to` is not in the library | `to: string` = replace, `to: null` = detach. For each selected page: draft tracking patched (compare-and-swap on `updatedAt`, skip on conflict); when `live` and the live version uses `from`: `publishTrackingOnly`. Result per page: draft ok / conflict, live ok / not live / error; exports using `from` listed as "re-export needed". |
| `applyLiveTrackingAction({ pageId, baseVersionId })` (builder) | pages.publish | publishes the draft's current `tracking` alone onto the live version. `live_changed` when `publishedVersionId ≠ baseVersionId`. |
| `startPixelTestAction({ pageId, platform, id, minutes: 30 \| 60 \| 120 })` / `stopPixelTestAction` | pages.publish | adds / removes the window. Refuses `no_test_code` (owner saves the code first) and `not_live` (id not on the page's live version). |
| `removePixelEntryAction({ platform, id })` | settings.write | refuses `pixel_in_use` while usage > 0 (drafts, live, exports). Detached entries show "Detached, still live on 2 pages" until usage reaches 0; entry and secrets are deleted only then. |
| `pixelUsageAction({ platform, id })` | settings.read | `[{ pageId, name, slug, inDraft, inLive, exports }]`. |
| `sendPixelTestAction` | settings.write | unchanged; also writes health. |

Removed: `applyStorePixelsAction`, `storePixelSummaryAction`, `applyStorePixelsToDrafts`, `mergeStorePixels`,
`trackingForNewPage`, `applyPixelsToDrafts` (dead), `registerPixelAction` (editors no longer add ids), the
`pixels: "chosen"` flag (accepted and ignored for one release). Error codes: `invalid_id`, `duplicate`,
`pixel_limit`, `page_limit`, `token_invalid`, `pixel_in_use`, `pixel_not_in_library`, `no_test_code`,
`not_live`, `live_changed`, `forbidden`.

**Publish rules** (src/lib/render/publish.server.ts, PX on top of C0's `renderAndCommit` refactor):
- `publishPage`, `publishTrackingOnly` and `replacePixelAction` refuse `pixel_not_in_library` for any id not in the
  library unless the user has settings.write (owners' unknown ids are added to the library with label "").
  Customer hashes (advanced matching) can then only reach pixels an owner registered.
- `audit("page.pixels_changed", { added, removed, mode: "publish" | "pixels_only" })` (masked ids) whenever the
  live ids change.
- `publishTrackingOnly(pageId, userId, tracking, baseVersionId)`: loads the live version doc, replaces only
  `tracking`, `validateDoc`, renders landing + thank-you with the current renderer, inserts a `page_versions` row
  (kind "publish", label "Pixels only", `runtime_v` 2), moves `publishedVersionId` (row `FOR UPDATE`, checks the
  base version, never the draft stamp), then patches the draft's `tracking` (compare-and-swap, 3 attempts; the
  result says "draft not updated" on conflict). A v1-runtime page moves to the v2 runtime; open tabs keep
  ordering against the previous version through the 72 h rule (§G.2).

### A.4 UX
**Settings → Pixels = "Pixel library"** (pixels-form.tsx → src/components/admin/pixels/pixel-library.tsx).
Grouped by platform. Row: platform mark · label (inline edit) · masked id (copy) · status chip *Browser only /
Browser + server / Test mode · 42 min · {page}* · health *Server OK · 14:02 / Refused (permission) · 13:40 /
Unverified: send a test event* · "Used on 3 pages · 2 live · 1 export" (popover: page names → builder) · menu:
Edit token & test code, Send test event, Replace on pages…, Remove from pages…, Delete (disabled while used,
reason shown). "Add pixel" (owners): platform, id (validated as you type, `ID_HELP`), label, token + test code for
Meta/TikTok. Copy at the top: "Pixels are set per page. Saved pixels appear here so you can pick them quickly in
the wizard and the builder." Status and health chips use only brand, emerald, neutral or yellow `--warn`
(hue ≈ 95) tokens, never amber or orange.

**Replace on pages… / Remove from pages…** (pixels/replace-dialog.tsx): new id (library pick; owners can type a
new one), the pages using the old id (checkboxes, all ticked), "Also update live pages now (pixels only)" (on by
default), exports using it listed as "re-export needed". Each swap is the owner's explicit choice per page.

**Builder → SEO & tracking → "Pixels on this page"** (SeoPanel.tsx PixelsSection): per platform, the page's
pixels as rows (label, masked id, status chip, health), remove (×). "Add a pixel" = combobox over the library;
owners also get **New pixel…** inline (id, label, token, test code → `savePixelEntryAction`); editors see "Ask an
owner to add new pixels in Settings → Pixels". Ids not in the library show "Not in library" (owners: Save).
Platform limits enforced (button disabled with "TikTok takes up to 3 pixels"). Empty state: an explicit
**No pixel on this page (organic / test)** option (`tracking.none`). After Duplicate: "Pixels copied from
{page}" with **Keep** (clears `copiedFrom`). On a live page whose draft ids differ from the live ids: **Update
live page now (pixels only)**. Per Meta/TikTok pixel with a saved test code on a live page: **Test this page**
(30 / 60 / 120 min, countdown, Stop). Footer: "They fire on the live page only, never in the builder or
previews."

**Wizard → last step (Directions, next to "Create page") → "Ad tracking for this page"**
(src/components/admin/pixels/page-tracking-choice.tsx, mounted by step-directions.tsx): library chips (none
ticked) **or** "No pixel on this page"; **Create page stays disabled until one is chosen** ("Choose this page's
pixels, or No pixel"). "Same as…" ticks exactly the set of one of the 8 most recent pages with pixels (labels +
masked ids). Owners: New pixel inline; empty library → inline add form. Editors with an empty library: only "No
pixel" + hint. The doc is created with that `tracking`; `createFromDirectionsAction` never adds pixels.

**Publish dialog** (pixels/publish-block.tsx mounted by PublishDialog.tsx): "Pixels that will fire" with the diff
against the live version (+ added / − removed). No pixel and no `tracking.none` → warning row "This page sends no
ad events; ads can't optimize" with inline **Add pixel** (opens PixelsSection), and the publish button reads
**Publish without pixels**. Browser-only Meta/TikTok → info "No server events: in-app and iOS purchases are
under-counted".

**Pages list** (src/components/admin/pages/**): live pixel chips per page (labels) and a **No pixel** filter
(live pages with no ids and no `none`).

**Checklist** (src/lib/pixels/checklist.ts `pixelChecks`, spread by src/lib/editor/checklist.ts): warning "No ad
pixel on this page" (hidden with `none`); info per browser-only Meta/TikTok pixel; info "Pixels copied from
{page}"; warning "{label}: server refused events (permission) since 13:40". Pixels never block a publish except
the library rule for non-owners.

**Restore and duplicate**: `restoreVersion` keeps the current draft's `tracking`; the restore confirm in
VersionsDrawer.tsx has "Also restore its pixels" (off). Duplicate copies the ids and sets `copiedFrom`.

Seams (PX implements, AD/C0 mount):
```ts
export type TrackingChoice = { kind: "ids"; tracking: Tracking } | { kind: "none" };
export function PageTrackingChoice(p: { value?: TrackingChoice; onChange(v: TrackingChoice): void; canCreate: boolean }): JSX.Element;
export function PublishPixelsBlock(p: { pageId: string; draft: Tracking; live: Tracking | null; onNeedsConfirm(b: boolean): void; onAddPixel(): void }): JSX.Element;
export function pixelChecks(doc: PageDoc, ctx: { library: PixelLibraryView; health: PixelHealth; live: boolean }): ChecklistItem[];
```

### A.5 Server events per page
`purchaseConversion` reads the tracking of the **version the order was validated against** (§G.2): the same ids
the shopper's browser fired. `dispatchPurchase` sends to ids whose own token exists (no legacy fallback).
`serverCredentials(secrets, library, platform, pixelId, pageId, now)` attaches the test code only when that
pixel has an active window for that page. After each send, `pixel_health["platform:id"]` is written when the
state or code changes, or 10 min after the last write for that pixel in this worker; failures are mapped to
`token | permission | pixel | rate | network | other`. Contents per item (§G.7). Connected exports use their
version's ids. PHP and WhatsApp exports stay browser-only.

**Preview never loads pixels** (keep and test all three): `buildRuntimeConfig` gives `pixels: {}` in
`mode: "preview"`; the runtime refuses in preview; the pixels chunk is not emitted for preview, thumbnail and
builder renders. `scripts/qa/pixels-e2e.ts` asserts it.

### A.6 Migration (one-time, idempotent): src/lib/pixels/migrate.server.ts
Runs from `instrumentation.ts` after `runMigrations()` inside `withBootLock()` (src/lib/db/boot-lock.ts:
`GET_LOCK('cod_boot', 10)`, `RELEASE_LOCK` in `finally`; no lock → skip, another worker runs it). Marker: the
`pixel_library` row, written **last**.
1. Collect ids from raw JSON with `pixelIdList(raw.tracking)`, no `PageDoc` parse: store setting `pixels` first,
   then every page draft (archived included), every `page_versions` doc of kind publish, and every non-revoked
   export's version; ordered by usage count. **No cap.**
2. Labels: store ids "Pixel principal", "Pixel 2"…; others "{first page name} · ••••4321".
3. Secrets: each Meta/TikTok id without its own token gets the legacy token. Legacy test codes are copied into
   the per-id code maps **with no active window**: production events stop being test-coded. Legacy fields are
   kept. Health for every copied token = `unverified` (rows prompt "Send test event").
4. Write `tracking_secrets`, `pixel_health`, then `pixel_library`;
   `audit("pixels.library_migrated", { entries, tokensCopied, testCodesDeactivated })`.
Pages are not modified. The setting `pixels` is ignored afterwards and deleted in the cleanup release.

---

## B. Item catalog

### B.1 Schema (src/lib/page/schema.ts)
```ts
/** Item ids: short, lowercase, no "." or ":" (separators in keys). The upgraded v1 product is "main". */
export const ItemId = z.string().regex(/^[a-z0-9][a-z0-9-]{1,23}$/);
export const MAIN_ITEM_ID = "main";
export const Money = z.number().nonnegative().max(10_000_000).refine((m) => Math.abs(m * 100 - Math.round(m * 100)) < 1e-6, { error: "2 decimals max" });

export const AssetRef = z.object({ id, alt, fx, fy,                       // unchanged
  /** crop of the photo, 0..1 of its width/height (an item cut out of a group photo); CSS only */
  box: z.object({ x: z.number().min(0).max(0.95), y: z.number().min(0).max(0.95), w: z.number().min(0.05).max(1), h: z.number().min(0.05).max(1) })
    .refine((b) => b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001).optional(),
});

export const Item = z.object({
  id: ItemId,
  /** shown on cards, unit heads, summaries. Required (non-empty) when the page has 2+ items; on a single-item page "" = product name */
  name: z.string().max(120).default(""),
  /** Sheets / WhatsApp / receipts name; default = name. Editors preview "Dans Google Sheets : …" */
  short: z.string().max(40).optional(),
  /** the item's photos: own photos, crops of a group photo (box), and the uncropped group photos it appears in */
  images: z.array(AssetRef).max(8).default([]),
  cutout: AssetRef.optional(),
  sku: z.string().max(60).optional(),
  /** reference unit price: one unit bought alone. Base of the automatic reference and of savings. */
  price: Money,
  /** genuine previous unit price, struck where a single unit price is shown */
  compareAt: Money.optional(),
  groups: z.array(OptionGroup).max(4).default([]),   // §D
  /** whole item unavailable: choice lines skip it, offers with a fixed line on it are unavailable */
  soldOut: z.boolean().default(false),
});

export const Product = z.object({ name, tagline, description, category, images, cutout, rating });   // v1 minus price/compareAt/sku/variants
// PageDocObject: { v: z.literal(2), locale, market, currency, product, items: z.array(Item).min(1).max(8), offers, form, theme, sections, seo, tracking, thankYou }
```
Rules (hard `superRefine` errors only for v2-only constructs; everything v1 data can break is repaired, §I.1):
- item ids unique; with 2+ items every item has a non-empty `name`.
- groups: ids unique per item; ≤ 2 field groups and ≤ 1 matrix group per item.
- page caps (§J.1): Σ choice options + matrix dim values ≤ 200; Σ matrix cells ≤ 300; option/value/cell photos ≤ 48.
- An item referenced by no offer is allowed: checklist warning "Not sold in any offer".

### B.2 Helpers (new, pure: src/lib/page/catalog.ts)
```ts
export function leadItem(doc): Item;                                     // items[0]
export function itemById(doc, id: string): Item | undefined;
export function itemName(doc, item): string;                             // item.name || product.name (single-item pages only)
export function itemShort(doc, item): string;                            // short || itemName, ≤ 40
export function groupPhotos(doc): { asset: AssetRef; items: string[] }[];// asset ids present WITHOUT box in 2+ items' images
export function itemVisual(doc, item, ctx): { asset: ResolvedAsset | null; box?: Box; kind: VisualKind };
//   cutout → first image that is not a group photo (crops count as own) → single-item pages only: product.cutout → product.images[0]
//   → null (monogram tile, §E.6). A group photo is never an item's own visual.
export function contentIdOf(doc, item, pageKey: string): string;         // sku || (item.id === "main" ? pageKey : `${pageKey}.${item.id}`)
```
`RenderContext` (src/landing/types.ts, context.ts) gains `items: Item[]` and `lead: Item & { name: string }`.
Mechanical replacements by the core PR: `ctx.product.price → ctx.lead.price`, `.compareAt`, `.sku`,
`ctx.product.variants → ctx.lead.groups` (hero, gallery bento, problem chat, specs, trustBar, document.tsx,
ThankYou, checklist, AI prompts, generator). Single-item pages: no visual change.

**Multi-item pages** (`items.length > 1`): hero, sticky CTA and CTA stamps show the **default offer**: its `from`
price ("Dès" when variable), struck `displayReference` when shown, and its name. Teasers (`packSavings`) use
offer short names ("Duo −16%"), never "×2" for a duo.

JSON-LD (document.tsx): one item → `Offer { price: lead.price }` (as today); 2+ items → `AggregateOffer {
lowPrice: min offer from, highPrice: max offer from, offerCount }`.

### B.3 Limits
8 items per page, 8 photos per item, 4 groups per item (≤ 2 fields, ≤ 1 matrix). More than 8 distinct products
stops being a landing page. Total page weight is bounded by the page caps (§F.9, §J.1), not by item count.

### B.4 Photos: item photo wells, group photos, crops
- Each item card (wizard and builder) has a **photo well**: multi-select among the uploaded product photos, or
  the media library. A photo picked uncropped by 2+ items is a **group photo**: offered as a combo visual
  (§E.6) and to `suggestOffers`. No separate tagging step; `Details.photoItems` is derived.
- **Crop {item} from this photo**: on a group photo in an item's well, opens FocalDialog in box mode (drag a
  rectangle, free aspect, ≥ 5%); stores a copy of the ref with `box` in that item's `images`. The wizard offers
  it automatically when an item has no own photo.
- Rendering: `Picture` turns `box` into `object-position` + `--pic-zoom` for its frame (the existing
  `pictureCrop` / `scaleSizes` path). Intrinsic ratio of a crop = `(w × width) / (h × height)`. No new image
  files, no server-side crop, no automatic product detection.
- Checklist **error**: an item used in a choice line without a photo of its own (`itemVisual(...).asset === null`),
  quick fix "Crop it from the group photo".

---

## C. Line-based offers

### C.1 Schema
```ts
/** a choice group id, or "<matrixGroupId>.<dimId>" */
const RuleKey = z.string().regex(/^[A-Za-z0-9_-]{2,40}(\.[A-Za-z0-9_-]{2,40})?$/);
export const LineRule = z.union([
  z.object({ lock: Id }).strict(),                                               // fixed: static chip, filled by the server
  z.object({ allow: z.array(Id).min(1).max(40), preset: Id.optional() }).strict(),// subset; preset ∈ allow = initial value
  z.object({ preset: Id }).strict(),                                             // initial value only
]);

export const OfferLine = z.object({
  id: Id,                                            // "l1", stable for memory keys
  qty: z.number().int().min(1).max(20),
  pick: z.union([                                    // both members .strict()
    z.object({ item: ItemId }).strict(),             // fixed item
    z.object({
      choice: z.array(ItemId).min(2).max(8),         // the customer chooses, per unit
      distinct: z.boolean().default(false),          // "2 différents au choix"
      surcharge: z.enum(["none", "difference"]).default("none"),   // "difference": pricier items cost their difference (§C.3)
    }).strict(),
  ]),
  /** a catalog item given for free (BOGO, "+ a free mini"); never carries surcharges */
  free: z.boolean().default(false),
  /** unit head override ("Votre 2e parfum", "Votre cadeau") */
  label: z.string().max(40).optional(),
  /** fixed-item lines only: lock / restrict / preset the item's options on this line ("1 Noir + 1 Blanc", "Noir/Gris only") */
  rules: z.record(RuleKey, LineRule).optional(),     // ≤ 3 keys; never on perUnit:false groups or fields
});

export const OfferVisual = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("auto") }),             // composed from the lines' item photos (§E.6)
  z.object({
    mode: z.literal("custom"),
    images: z.array(AssetRef).min(1).max(4),         // the owner's photos: a group shot, group shot + 3rd item…
    arrange: z.enum(["auto", "row", "overlap", "grid"]).default("auto"),
  }),
]);

export const Offer = z.object({
  id: Id,
  /** segment / tab label (pills, teasers): ≤ 14; default automatic (§C.4) */
  short: z.string().max(14).optional(),
  lines: z.array(OfferLine).min(1).max(6),
  title: z.string().max(60).optional(),             // else an automatic name (§C.4)
  subtitle: z.string().max(90).optional(),
  /** card bullets (stack, visual, pills panel) */
  perks: z.array(z.string().min(1).max(40)).max(3).default([]),
  /** total price of the offer's units (before surcharges, bump, extras and delivery) */
  price: Money,
  /** genuine reference total; absent = automatic reference (§C.3); never invented */
  compareAt: Money.optional(),
  badge: z.enum(["none", "popular", "best", "custom"]).default("none"),
  badgeText: z.string().max(28).optional(),
  /** no delivery fee for this offer (real; only meaningful when shippingFee > 0) */
  freeShipping: z.boolean().default(false),
  /** non-catalog gift (text + optional photo): card, summary, AND the order (§G.3) */
  gift: z.object({ label: z.string().min(1).max(60), image: AssetRef.optional() }).optional(),
  visual: OfferVisual.default({ mode: "auto" }),
  preselected: z.boolean().default(false),
  soldOut: z.boolean().default(false),
});
export type Bundle = Offer;                          // deprecated alias for one release

const Scope = z.union([z.literal("all"), z.array(Id).min(1).max(8)]).default("all");
export const ExtraGroup = z.discriminatedUnion("kind", [ChoiceGroup.extend({ scope: Scope }), FieldGroup.extend({ scope: Scope })]);

export const Offers = z.object({
  bundles: z.array(Offer).min(1).max(8),             // key kept (D3)
  display: OfferDisplay.default({}),                 // §E (replaces cardStyle)
  /** order-level choices (gift wrap, card message), once per order; perUnit ignored */
  extras: z.array(ExtraGroup).max(4).default([]),
  showPerUnit, showSavings, shippingFee, urgency,    // unchanged
  orderBump: z.object({ enabled, title, description, price, image,   // v1 fields unchanged
    /** the bump is a catalog item (qty 1): title/image default from it, its options are collected, SKU/contents include it */
    item: ItemId.optional(),
    /** shown only with these offers (absent = all) */
    offers: z.array(Id).min(1).max(8).optional() }).optional(),
  upsell: z.object({ enabled, title, description, price, compareAt, image, windowMinutes,
    item: ItemId.optional() }).optional(),
});
```
Rules (`superRefine` for v2-only constructs; `repairDoc` for the rest, §I.1): referenced items exist; choice ids
distinct within a line; `distinct: true` requires `qty ≤ choice.length`; `Σ qty ≤ 20`; at least one paid line;
`rules` only on fixed lines, ≤ 3 keys, each key resolves to a `perUnit: true` choice group or a matrix dim of
that item, option ids exist, `preset ∈ allow`; ids unique (offers; lines per offer); at most one `preselected`;
bump/upsell items exist; extras scopes and bump `offers` reference existing offers.

### C.2 Units
```ts
// src/lib/page/catalog.ts
export interface UnitSlot {
  k: number;                 // 0-based unit index (lines in order, then qty)
  line: number; lineId: string;
  item: string | null;       // fixed item id
  choices: string[] | null;  // choice line: DECLARED item ids (pricing base)
  available: string[] | null;// choice line: declared minus sold-out items (what the shopper can pick)
  distinct: boolean; surcharge: "none" | "difference"; free: boolean; label?: string;
  rules?: Record<string, LineRule>;
}
export function expandUnits(offer: Offer, items: readonly Item[]): UnitSlot[];
/** "main×2" | "main×1+nuit×1" | "[main|nuit]×1" | "main{g-fit.d-col=o-noir}×1": sorted canonical shape incl. rules */
export function offerSignature(offer: Offer): string;
/** unavailable: soldOut; a fixed line on a sold-out item; a locked option out; no allowed option (or combination) available;
    a choice line with fewer available items than `distinct` needs */
export function offerAvailable(offer: Offer, items: readonly Item[]): boolean;
```
`defaultOfferId(offers, items)` (= `defaultBundleId`, kept as alias): preselected → popular → first, each available.

### C.3 Pricing (src/lib/page/pricing.ts): integer cents; server, renderer, runtime and PHP share these numbers
```ts
export type Cents = number;                                    // integer
export const toCents = (m: number): Cents => Math.round(m * 100);   // Money has ≤ 2 decimals
export const fromCents = (c: Cents): number => c / 100;        // once, for display and storage

export interface OfferMath {
  id: string;
  units: number;             // Σ qty (free included)
  price: Cents;              // offer.price
  from: Cents;               // price + minUnitDeltas: the lowest payable total of the units → the card price
  variable: boolean;         // maxUnitDeltas > minUnitDeltas → "Dès"
  reference: Cents;          // compareAt ?? automatic reference (declared list, stable)
  displayReference: Cents;   // reference + minUnitDeltas: struck next to `from`
  savings: Cents;            // max(0, reference − price)  (= displayReference − from)
  savingsPct: number;        // round(savings / displayReference × 100), 0..99
  perUnit: Cents | null;     // round(from / units) when units > 1 and every paid unit is the same item or the same choice set
  showReference: boolean;    // savings ≥ 1
}
```
**Reference** (never invented):
- fixed line: `qty × item.price`.
- choice line: non-distinct `qty × min(declared prices)`; distinct `Σ of the qty cheapest declared prices`.
  Declared, not available: the base never moves when an item sells out.
- free line: counts at that formula **only if** the item (or, for a free choice line, each declared choice) is
  sold in a paid line of an **available** offer on this page; otherwise 0 and the card shows "Offert" without a
  value (warning "Gift item X isn't sold on this page; its price is not counted in the savings").
- `reference = compareAt ?? Σ`. An explicit `compareAt < price` is ignored for display and warned.

**Surcharges** (deltas never enter `reference` or `savings`; free units add 0):
- choice line with `surcharge: "difference"`: `lineSurcharge = Σ chosen prices − lineBase`, `lineBase` = the
  reference formula above (declared list). Per-unit share (for receipts): chosen prices sorted ascending, paired
  with the sorted base prices; each share ≥ 0.
- choice / matrix option delta: per paid unit of that item; a shared (`perUnit: false`) group's delta × paid units
  of that item in the order.
- field delta: when filled; per unit for per-unit fields, once per order for shared fields. **A required field
  cannot carry a delta** (schema error: put it in the price).
- extras: once per order. Bump: `orderBump.price` (bump unit options never add deltas).

**Payable card price** (`minUnitDeltas`, exact, computed on availability + rules): fixed lines: per paid unit,
Σ over required choice/matrix groups of the minimum delta among available allowed options (locks fixed);
choice lines: per candidate item `c_i = price_i + minGroupDeltas_i`; non-distinct `qty × min c_i − lineBase`
("difference") or `qty × min minGroupDeltas_i` ("none"); distinct: the `qty` smallest values instead. Fields,
extras and bump are opt-in add-ons labelled with their price and stay out of `from`. Property test (§I.5): for
every offer, the minimum `orderTotals(...).subtotal` over all valid selections without opt-ins equals `from`.

```ts
export interface UnitChoice { item: string; options: Record<string, string>; fields: Record<string, string> }
export interface Selection { offerId: string; units: UnitChoice[]; extras: Record<string, string>; bump: boolean; bumpUnit?: UnitChoice }
export interface DeltaReason { key: string; label: string; count: number; cents: Cents }   // "XL", "Gravure" ×2, "Sérum"
export function selectionDeltas(doc, sel: Selection): { total: Cents; reasons: DeltaReason[] };
export interface OrderTotals { offer: OfferMath; deltas: Cents; reasons: DeltaReason[]; bump: Cents; shipping: Cents; subtotal: Cents; total: Cents }
/** computes the deltas itself: no caller-supplied deltas */
export function orderTotals(doc, sel: Selection): OrderTotals | null;
//   subtotal = price + deltas + bump; shipping = effectiveFree(doc, offer) ? 0 : toCents(shippingFee); total = subtotal + shipping
export const effectiveFree = (doc, offer) => doc.offers.shippingFee === 0 || offer.freeShipping;
/** per unit (pixels, admin): largest-remainder split of price by unit references (equal split when Σ = 0) + the unit's own deltas; free 0 */
export function allocate(doc, offer, sel: Selection): Cents[];
```

**Display rules**:
- Card: `from` ("Dès 279 DH" / "من 279 درهم" when `variable`), struck `displayReference` when `showReference`,
  savings chip per `showSavings`, per-unit when non-null and `showPerUnit`, rounded to the currency's display
  decimals (MAD: nearest whole dirham; EUR: 2).
- Item chips in a choice unit: "+50 DH" (price − cheapest declared price) when `surcharge: "difference"`. Option
  chips: "+20 DH". Field labels: "(optionnel · +30 DH)".
- Summary: base row, up to 3 surcharge reason rows ("XL +20 DH", "Gravure ×2 +60 DH", "Sérum +50 DH"), then
  "Autres options +n DH"; bump; delivery; total. Submit button and `[data-lp-price="current"]` show the live total.
- Delivery: the "Livraison offerte" mark shows iff `effectiveFree`; when every offer is effective-free it is said
  once under the picker. The builder hides the per-offer toggle when the fee is 0; changing the fee from 0 to
  more shows "3 offers are marked free delivery".

`offerWarnings(doc)` (replaces `bundleWarnings`): per-unit price higher than a smaller offer with the same items ·
compareAt < price · more than one popular / best · two offers with the same `offerSignature` · price ≥ reference
with 2+ units (info) · choice line whose items differ in price with `surcharge: "none"` (info: "the cheapest sets
the struck price") · deltas on an item only sold in free lines (info) · a free item not sold on the page (above)
· every option of a required group adds a price (info: "the card shows Dès 169") · the cheapest choice is sold
out (info: "the card now shows Dès 199") · fee > 0 and every offer has free delivery (warning, quick fix "Set
delivery to 0").

### C.4 Names and labels (src/lib/page/catalog.ts; sentence in src/lib/page/offer-text.ts)
`offerName(ctx, offer)`: `title` → automatic: one fixed item ×n → `bundle.qty` ("2 pièces", legacy identical);
one choice line → `offer.choice` ("Au choix") / `offer.anyN` ("2 au choix"); several items → short names joined
with " + " (max 3, then "+ n"); a free line adds " + {label | offer.free}" ("1 + 1 offert").
`offerShort(ctx, offer)`: `short` → automatic: single fixed item ×n → "×n" (v1 identical); choice line → "Au
choix" / "{n} au choix"; 2 distinct items → `offer.duo` ("Duo"); 3 → `offer.trio` ("Trio"); else "{units}
pièces". ≤ 14 chars.
`offerSheetLabel(doc, offer)` (Sheets "Produit", PHP `sheetLabel`, admin): `title ? "${title} (x${units})" :
"x${units}"` for a single fixed lead-item line (byte-identical to v1), else `"${title || autoName} (x${units})"`.
`offerSentence(doc, offer)` (admin only, page language): "Le client reçoit 1 Crème jour + 1 Crème nuit + 1 Sérum,
paie 349 DH au lieu de 497 (−148), livraison offerte".

### C.5 The owner's example, exactly
"One photo shows two products at the same price; an offer to take only one of them with its own photo; next to
it an offer of three with the third item's photo next to the photo of both."
```json
{
  "v": 2,
  "product": { "name": "Duo Éclat", "category": "skincare",
    "images": [{ "id": "9f2c41d07ab35e68", "alt": "Crème jour et crème nuit" }, { "id": "c3d4e5f60718293a", "alt": "Sérum éclat" }] },
  "items": [
    { "id": "main", "name": "Crème jour", "short": "Jour", "price": 149,
      "images": [{ "id": "9f2c41d07ab35e68", "box": { "x": 0.04, "y": 0.08, "w": 0.46, "h": 0.86 } }, { "id": "9f2c41d07ab35e68" }] },
    { "id": "nuit", "name": "Crème nuit", "short": "Nuit", "price": 149,
      "images": [{ "id": "9f2c41d07ab35e68", "box": { "x": 0.5, "y": 0.08, "w": 0.46, "h": 0.86 } }, { "id": "9f2c41d07ab35e68" }] },
    { "id": "serum", "name": "Sérum éclat", "short": "Sérum", "price": 199, "images": [{ "id": "c3d4e5f60718293a" }] }
  ],
  "offers": {
    "bundles": [
      { "id": "one", "title": "Une crème au choix", "price": 149,
        "lines": [{ "id": "l1", "qty": 1, "pick": { "choice": ["main", "nuit"] } }] },
      { "id": "duo", "title": "Le duo jour + nuit", "price": 249, "badge": "popular", "preselected": true,
        "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } }, { "id": "l2", "qty": 1, "pick": { "item": "nuit" } }],
        "visual": { "mode": "custom", "images": [{ "id": "9f2c41d07ab35e68" }] } },
      { "id": "trio", "title": "Le rituel complet", "price": 349, "badge": "best", "perks": ["Routine matin + soir", "Livraison offerte"],
        "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } }, { "id": "l2", "qty": 1, "pick": { "item": "nuit" } },
                  { "id": "l3", "qty": 1, "pick": { "item": "serum" } }],
        "visual": { "mode": "custom", "images": [{ "id": "9f2c41d07ab35e68" }, { "id": "c3d4e5f60718293a" }] } }
    ],
    "display": { "picker": "visual", "fill": "auto", "selection": "soft", "media": "auto", "density": "comfortable" },
    "showPerUnit": true, "showSavings": "both", "shippingFee": 0
  }
}
```
`9f2c…` is uncropped in two items → a group photo. Each cream's own visual is its crop. Math: `one` from 149, ref
149 → no struck price; card = choice tile (two crops, "ou" chip), cross-fades to the chosen cream. `duo` ref 298 →
−49 DH (−16%), the group photo, contained, never cover-cropped. `trio` ref 497 → −148 DH (−30%); per-unit
hidden (three different items); visual = lead + side: group photo ≈ 2/3, sérum ≈ 1/3, "+" join. Fill `auto` →
the most units to fill is 1 (`one`) and `visual` can't host `inline` → **rows**: "Personnalisez" shows "Choisissez
votre crème" for `one`, and "Contenu du pack: Jour + Nuit" (thumbnails) for `duo`. Fee 0 → "Livraison gratuite"
once under the picker. Two separate single-cream cards instead: `{ "lines": [{ "pick": { "item": "main" } }] }`
and `{ "lines": [{ "pick": { "item": "nuit" } }] }`; auto visual = each crop.

### C.6 Other cases
```jsonc
// BOGO, "Achetez 1, le 2e offert": ref 298 → −149 (−50%), 75 DH/pièce (MAD display), both units get option pickers
{ "id": "bogo", "price": 149, "badge": "custom", "badgeText": "1 + 1 offert",
  "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } }, { "id": "l2", "qty": 1, "pick": { "item": "main" }, "free": true }] }

// Any 2 of 3, all different, pricier ones cost their difference: base = 149 + 149 = 298 → −19; card "Dès 279"; Jour + Sérum = 329
{ "id": "any2", "title": "2 au choix", "price": 279,
  "lines": [{ "id": "l1", "qty": 2, "pick": { "choice": ["main", "nuit", "serum"], "distinct": true, "surcharge": "difference" } }] }

// ×2 same item, color/size per piece (matrix, §D.2): ref 258 → −29; XL +20 → card "Dès 229"
{ "id": "x2", "price": 229, "badge": "popular", "lines": [{ "id": "l1", "qty": 2, "pick": { "item": "main" } }] }

// Pack 3 couleurs: 1 Noir + 1 Blanc + 1 Gris, the customer picks each size
{ "id": "colors", "title": "Pack 3 couleurs", "price": 329, "lines": [
  { "id": "l1", "qty": 1, "pick": { "item": "main" }, "rules": { "g-fit.d-col": { "lock": "o-noir" } } },
  { "id": "l2", "qty": 1, "pick": { "item": "main" }, "rules": { "g-fit.d-col": { "lock": "o-blanc" } } },
  { "id": "l3", "qty": 1, "pick": { "item": "main" }, "rules": { "g-fit.d-col": { "lock": "o-gris" } } } ] }

// Pack ×3 promo, Noir/Gris only (end of stock), Noir preselected
{ "id": "x3-promo", "price": 299, "lines": [{ "id": "l1", "qty": 3, "pick": { "item": "main" },
  "rules": { "g-fit.d-col": { "allow": ["o-noir", "o-gris"], "preset": "o-noir" } } }] }

// A + B with (a) a non-catalog gift (reaches the order as CADEAU), (b) a catalog trousse never sold paid → counts 0, "Offert"
{ "id": "combo", "price": 249, "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } }, { "id": "l2", "qty": 1, "pick": { "item": "nuit" } }],
  "gift": { "label": "Trousse de voyage offerte", "image": { "id": "d4e5f60718293a4b" } } }
{ "id": "combo2", "price": 249, "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } }, { "id": "l2", "qty": 1, "pick": { "item": "nuit" } },
  { "id": "l3", "qty": 1, "pick": { "item": "trousse" }, "free": true }] }

// Choose your free gift: a free choice line
{ "id": "gift-pick", "price": 199, "lines": [{ "id": "l1", "qty": 1, "pick": { "item": "main" } },
  { "id": "l2", "qty": 1, "pick": { "choice": ["mini-rose", "mini-oud"] }, "free": true, "label": "Votre cadeau" }] }

// Page level: gift wrap on two offers, and the sérum as a bump on the smaller offers
"extras": [{ "id": "g-wrap", "kind": "text", "name": "Emballage cadeau", "scope": ["duo", "trio"],
  "options": [{ "id": "o-no", "label": "Non" }, { "id": "o-yes", "label": "Oui", "delta": 15 }] }],
"orderBump": { "enabled": true, "title": "Ajoutez le sérum", "price": 99, "item": "serum", "offers": ["one", "duo"] }
```

### C.7 Lossless upgrade of v1 bundles (in `upgradeDoc`, §I.1)
`{ id, qty, title, subtitle, price, compareAt, badge, badgeText, freeShipping, gift, image, preselected }` →
`{ id, lines: [{ id: "l1", qty, pick: { item: "main" } }], title, subtitle, price, compareAt, badge, badgeText,
gift, preselected, perks: [], visual: image ? { mode: "custom", images: [image] } : { mode: "auto" },
freeShipping: false }`. Same reference (`compareAt ?? price × qty`), same totals (v1 always charged the fee),
same ids, same labels. Money is normalized to cents (the dry run lists any value that changed).

### C.8 Limits
8 offers (v1: 5), 6 lines, qty 1–20 per line, 20 units per offer, 2–8 choices per line, ≤ 3 rules per line, 4
page extras, 3 perks, 1–4 custom visual photos.

---

## D. Flexible options

### D.1 Group kinds
```ts
export const Choice = z.object({
  id: Id,
  label: z.string().min(1).max(40),
  swatch: Hex.optional(),
  image: AssetRef.optional(),
  soldOut: z.boolean().default(false),
  /** warehouse code (Latin): Sheets, CSV and order.php print it instead of the label ("NR" for "نوار") */
  code: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,19}$/).optional(),
  /** surcharge per unit when chosen ("XL +20"). Never negative: discounts belong to offers. */
  delta: Money.max(100_000).optional(),
});
const GroupBase = {
  id: Id,
  name: z.string().min(1).max(40),
  /** true: one value per unit of this item · false: one value shared by every unit of this item in the order */
  perUnit: z.boolean().default(true),
};
export const ChoiceGroup = z.object({ ...GroupBase,
  kind: z.enum(["swatch", "text", "image"]),
  options: z.array(Choice).min(1).max(40),
  /** "select": a native dropdown (long lists, e.g. 30 shoe sizes); "auto": dots / tiles / chips by kind */
  display: z.enum(["auto", "select"]).default("auto"),
});
export const MatrixDim = z.object({ id: Id, name: z.string().min(1).max(40), kind: z.enum(["swatch", "text", "image"]).default("text"),
  values: z.array(Choice).min(1).max(24) });          // value.soldOut = every combination with it is out
export const MatrixCell = z.object({
  /** the combination(s) this exception applies to; a dim missing from v is a wildcard */
  v: z.record(Id, Id),                               // 1..dims.length entries
  state: z.enum(["in", "out", "none"]).default("in"),// out = épuisé · none = not made (never shown as épuisé)
  image: AssetRef.optional(),
  delta: Money.max(100_000).optional(),              // replaces Σ value deltas
  sku: z.string().max(60).optional(),                // replaces item.sku
});
export const MatrixGroup = z.object({ ...GroupBase, kind: z.literal("matrix"),
  dims: z.array(MatrixDim).min(2).max(3),
  cells: z.array(MatrixCell).max(240).default([]),   // only exceptions; every other combination exists, in stock
  /** "combined": one picker of the valid combinations ("Noir · M"); "linked": one selector per dim; "auto": combined when ≤ 8 valid */
  display: z.enum(["auto", "linked", "combined"]).default("auto"),
});
export const FieldGroup = z.object({ ...GroupBase, kind: z.literal("field"),
  input: z.enum(["text", "number"]).default("text"),
  required: z.boolean().default(true),
  maxLength: z.number().int().min(1).max(60).default(24),     // code points
  min: z.number().int().min(0).max(1_000_000).optional(),
  max: z.number().int().min(0).max(1_000_000).optional(),
  charset: z.enum(["any", "letters", "latin", "digits"]).default("any"),
  placeholder: z.string().max(40).optional(),
  help: z.string().max(90).optional(),
  delta: Money.max(100_000).optional(),              // only when required = false ("gravure +30")
});
export const OptionGroup = z.discriminatedUnion("kind", [ChoiceGroup, MatrixGroup, FieldGroup]);
// Zod v4 accepts ChoiceGroup's enum discriminator; if a version refuses it, use z.union (kinds are disjoint).
```
Matrix rules: `Π values ≤ 240`; dim ids unique; value ids unique per dim; every cell's `v` keys are dims of the
group and its values exist; canonical keys unique. **Canonical key** `cellKey(v)` = entries sorted by dim id,
`dimId=valueId` joined by `|` (`d-col=o-noir|d-size=o-xl`): used in payloads, memory, swap keys and storage.
**Resolution** of a combination `c` (one value per dim), src/lib/page/options.ts `resolveCombo`:
- matching cells = cells whose `v` ⊆ `c`.
- state = the most severe of the matching cells' states and of the values' `soldOut` (→ out); none > out > in.
- image / delta / sku = from the most specific matching cell that defines it (more dims wins; tie → first in the
  array); delta fallback `Σ value.delta`; sku fallback `item.sku`.
Wildcards make adding a dim safe (existing exceptions keep applying). Removing a dim: the editor drops that key
from every cell and merges duplicates (most severe state wins) after a confirm. No positional keys anywhere.

### D.2 Example: T-shirt color × size + name to print
```json
{ "id": "main", "price": 129, "sku": "TS", "groups": [
  { "id": "g-fit", "kind": "matrix", "name": "Couleur & taille", "perUnit": true, "display": "linked", "dims": [
      { "id": "d-col", "name": "Couleur", "kind": "swatch", "values": [
          { "id": "o-noir", "label": "Noir", "code": "NR", "swatch": "#141414", "image": { "id": "e5f60718293a4b5c" } },
          { "id": "o-blanc", "label": "Blanc", "code": "BL", "swatch": "#f3f1ec", "image": { "id": "f60718293a4b5c6d" } },
          { "id": "o-gris", "label": "Gris", "code": "GR", "swatch": "#8a8d91" } ] },
      { "id": "d-size", "name": "Taille", "kind": "text", "values": [
          { "id": "o-s", "label": "S" }, { "id": "o-m", "label": "M" }, { "id": "o-l", "label": "L" }, { "id": "o-xl", "label": "XL", "delta": 20 } ] } ],
    "cells": [
      { "v": { "d-col": "o-noir", "d-size": "o-xl" }, "state": "out" },
      { "v": { "d-col": "o-blanc", "d-size": "o-s" }, "state": "none" },
      { "v": { "d-col": "o-blanc", "d-size": "o-m" }, "sku": "TS-BL-M" } ] },
  { "id": "g-name", "kind": "field", "name": "Prénom à imprimer", "input": "text", "maxLength": 12, "charset": "letters", "required": false, "delta": 30 } ] }
```
Noir → XL is struck "épuisé"; Blanc → S is struck without "épuisé" (not made); Blanc + XL shows "+20 DH"; typing
a name adds +30 DH. 12 combinations > 8 → linked by default; set `combined` to show one list.

### D.3 Semantics across multi-line offers
- Groups belong to items. A unit of item X shows X's groups; units of different items never share groups.
- `perUnit: false` = one value for all units of that item in the order (rendered once, "Pour vos 2 Crème jour"),
  even across lines; its deltas count per paid unit (§C.3). Shared fields are typed once, charged once.
- Line `rules` apply to every unit of that line: `lock` shows a static chip ("Couleur : Noir") and the server
  fills it; `allow` hides other values; `preset` is the initial value. Rules never target shared groups.
- Page `extras` = once per order, shown when their `scope` contains the selected offer.
- Units after the first of the same item and same rules **prefill** from the first (§F.4); fields never prefill.
- Free units show their item's groups (a free mini still needs its color) but never pay deltas.

### D.4 Security of typed values (fields)
Server = truth (same rules mirrored client-side for instant errors, and in order.php):
1. `cleanInput` (NFC, controls / bidi overrides / zero-width removed, whitespace collapsed, trimmed).
2. Digits: Eastern Arabic `٠-٩` / Persian `۰-۹` → `0-9` for `digits` and `number`.
3. `<` `>` refused in every charset (`invalid`); length by code points ≤ `maxLength` (`too_long`, never silently
   truncated); charset: `letters` = `^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$`u, `latin` = `^[A-Za-zÀ-ÖØ-öø-ÿ0-9 '’.\-&]+$`,
   `digits` = `^[0-9]+$`, `any` = no extra rule; number within min/max.
4. Stored as plain text in `orders.items` JSON; output only as text: React text / `textContent`, Sheets RAW +
   `cleanText` (leading `= + - @` stripped), CSV `csvField`, WhatsApp/Telegram plain text, PHP `htmlspecialchars`.
   In order texts, values are wrapped in « » (inner « » become `"`). Never in URLs, **except** the WhatsApp
   handoff, whose message body the shopper sends themselves (§G.5). Kept in sessionStorage only for the tab
   (cleared after a successful order).

### D.5 Option editor (src/components/admin/variants, shared by wizard and builder)
- Kind picker gains **Combined (e.g. color × size)** and **Custom field**.
- Combined: 2–3 dimensions from presets (color, size, shoe, capacity, model, custom) with quick-fill values. The
  324 px panel shows a summary ("Couleur 3 × Taille 4 · 1 épuisée · 2 non fabriquées", display linked/combined)
  and **Edit combinations**, which opens a wide dialog: grid (rows = dim 1, columns = dim 2, a tab per value of
  dim 3), cell states in stock / out / not made, cell popover for photo, surcharge, SKU, and row/column bulk
  actions. All combinations exist by construction; only exceptions are stored.
- **Merge into one combined option** (menu on a choice group when the item has another): builds the matrix from
  both (photos, swatches, deltas, codes and sold-out values kept). Disabled with the reason shown when it can't be
  lossless: a group has > 24 options, Π > 240, the two groups differ in `perUnit`, or the item already has a
  matrix. **Split into separate options** (inverse) when the matrix has no combination-level exceptions.
- Advanced (collapsed): price differences (inline "+ price" per option), warehouse codes.
- Field: label, input type, required, max length, allowed characters, placeholder, help, surcharge (disabled
  while required: "A required field can't add a price; include it in the offer price or make it optional"),
  per piece / once.
- `variant-presets.ts`: `MAX_VARIANT_GROUPS = 4`; `cleanVariants`, `relocalizeVariants` (dim names too, codes
  kept), `variantIssues` learn the new kinds.

---

## E. Offer layouts ("design structure for the bundle selection or fill")

### E.1 Display axes
```ts
export const OFFER_PICKERS = ["stack", "tiers", "ticket", "pills", "visual"] as const;   // = v1 BUNDLE_CARD_STYLES
export const OFFER_FILLS = ["auto", "inline", "rows", "steps", "box"] as const;
export const OfferDisplay = z.object({
  picker: z.enum(OFFER_PICKERS).default("stack"),                  // UI: "Offer layout"
  fill: z.enum(OFFER_FILLS).default("auto"),                       // UI: "Personalization layout"
  selection: z.enum(["soft", "solid", "outline"]).default("soft"), // UI: "Selected style"
  media: z.enum(["auto", "none", "thumb", "large"]).default("auto"),
  density: z.enum(["comfortable", "compact"]).default("comfortable"),
});
/** src/lib/page/display.ts (pure; renderer, runtime config and the admin panel all call it) */
export function resolveDisplay(doc, ctx: { archetype: Archetype; formVariant: OrderFormVariant }):
  { picker; fill: "none" | "inline" | "rows" | "steps" | "box"; selection; media; density; notes: DisplayNote[] };
```
`upgradeDoc`: `display = { picker: cardStyle ?? "stack" }`, `cardStyle` deleted (all five v1 styles survive).

Allowed values (the panel disables the others and says why; `resolveDisplay` applies the fallbacks and returns
them as notes, e.g. "Shown as Rows: Columns fit 2–4 offers"):
| picker | fill | media | density | fallback |
|---|---|---|---|---|
| stack | all | auto, none, thumb | both | none |
| tiers | auto, rows, steps, box (inline → rows) | auto, none, large | both | n = 1 → stack; n ≥ 5 → stack compact |
| ticket | all (inline = inside the pass) | auto, none, large | both | n ≥ 5 → stack compact |
| pills | all (inline = in the detail panel) | auto, large (panel) | ignored | n = 1 → stack; n ≥ 5 → stack compact |
| visual | auto, rows, steps, box (inline → rows) | large | both | n = 1 → stack with thumb |

**Fill `auto`**, resolved **once per page** (never per offer, so the layout and step numbering never jump):
`U` = the most units to fill in any available offer (units with something to choose that isn't locked); `M` = some
offer has a choice line with qty ≥ 2.
1. `U = 0` → `none` (no personalize step).
2. `M` and `U ≤ 6` → `box`.
3. `U ≤ 4` → `inline` when the picker hosts it, else `rows`.
4. else → `steps`.

**Combos** (one tap in the panel; they set the axes, nothing extra is stored):
| Combo | picker | fill | selection | density |
|---|---|---|---|---|
| Classique | stack | auto | solid | comfortable |
| Boutique | visual | box | soft | comfortable |
| Compact | stack | steps | outline | compact |
| Auto (the design decides) | archetype pick (§E.5) | auto | archetype | archetype |

### E.2 Pickers (UI name → anatomy)
| id | UI name | Anatomy | Best for |
|---|---|---|---|
| `stack` | Rows | full-width radio rows: check · media (×qty numeral, or composed thumb when the offer has a distinct visual or several items) · name / contents line / perks · price ("Dès"), struck, chip. Compact density = 56 px one-line rows (40 px thumb, one-line summary, ellipsis) | 1–8 offers, any content |
| `tiers` | Columns | 2–4 equal columns, popular (else best) raised; composed thumbnail on multi-item offers; n = 4 → 2 × 2 | ×1/×2/×3 |
| `ticket` | Passes | wallet passes (band, labelled fields; no perforations, DESIGN §1.1); single-item offers keep the big ×n numeral, multi-item offers show a contents line instead | bold archetypes, 2–4 offers |
| `pills` | Segments | segmented control labelled with `offerShort` + detail panel (composed visual, contents, perks) | 2–4 offers |
| `visual` | Cards | image-led cards: large composed visual (§E.6), name (2 lines), contents chips ("Jour + Nuit"), floating badge pill, check disc, savings chip, per-unit; ≤ 3 in a row, 2 columns from 4 | multi-item offers, custom group photos, ×N packs with photos |

### E.3 Selection fills (`selection`): tokens only, no hard-coded hue (owner: no orange)
- `soft` (default): selected card `color-mix(in oklab, var(--sec-accent) 8%, var(--sec-card))`, 1.5 px
  `--sec-accent` ring, soft accent glow, check disc pops (current look).
- `solid`: card fills `--sec-accent`, text `--sec-accent-ink`; chips invert
  (`color-mix(in oklab, var(--sec-accent-ink) 16%, transparent)`); the savings chip uses that accent-ink tint with
  accent-ink text (never `--sec-success` on accent). AA checked by `scripts/check-theme.ts`.
- `outline`: no fill, 2 px `--sec-accent` ring + check; editorial/minimal archetypes.
- **Bold order form** (cards are light sheets on an accent slab): `solid` renders as an ink fill (`--sec-ink`
  background, `--sec-card` text) so it is never accent on accent; the generator never pairs bold with solid.
- Every new mix (soft 8% selection, solid chip 16%, badge over photo, gift chip, "+" and "ou" chips, contents
  chips) is registered in `orangeMixesInTokens` (src/lib/theme/blend.ts); render-check **fails** on any orange
  blend. States hover / focus-visible / selected / disabled (sold out: 45% opacity + "Épuisé" pill, radio
  disabled) exist for every picker.

### E.4 Responsive (container `of` = the form column; same technique as packs.css today)
| picker | ≤ 22 rem (360 px phone in a card) | 22–34 rem (390–768) | ≥ 34 rem (form beside a panel) |
|---|---|---|---|
| stack | price under the name when it would wrap; compact: one line, ellipsis | one row | one row; compact: 2 columns when n ≥ 6 |
| tiers | 3 narrow columns with compact labels | 3 columns | featured raised 6 px |
| ticket | 1 column | 1 column | 2 columns |
| pills | segments ≤ 4, panel below | same | same |
| visual | n ≤ 3 one row (compact labels), else 2 columns | same | n ≥ 4: 3 columns, 4 at ≥ 56 rem |
Hit targets ≥ 44 px; no horizontal page scroll at 320 px; long Arabic names wrap to 2 lines then ellipsis with
the full name in the accessible label. RTL: logical properties only, media on the inline-start side, "×2" always
`<bdi dir="ltr">`, "+" / "ou" chips direction-neutral, grid order follows `dir`.

### E.5 Archetype defaults and how the generator picks (src/lib/generator/directions.ts, replaces `CARD_STYLE`)
| archetype | single-item pickers (70/30) | image-led picker | selection | density |
|---|---|---|---|---|
| maison | tiers, pills | visual | outline | comfortable |
| apothecary | stack, tiers | stack (thumb) | soft | comfortable |
| souk | ticket, visual | visual | solid | comfortable |
| playground | visual, ticket | visual | soft | comfortable |
| kinetic | tiers, stack | visual | outline | compact |
| circuit | tiers, pills | stack (thumb) | outline | compact |
| hearth | stack, visual | visual | soft | comfortable |
| bloom | visual, stack | visual | soft | comfortable |
| field | stack, visual | stack (thumb) | soft | comfortable |
| editorial | pills, tiers | visual | outline | comfortable |
| garage | ticket, tiers | stack (thumb) | outline | compact |
An offer set is **image-led** when some offer has 2+ distinct items, a choice line, or a custom visual → the
image-led picker; else the weighted single-item pair. Then n ≥ 5 → stack compact (or visual when image-led and
n ≤ 6); pills only when n ≤ 4; bold form + solid → soft; `fill: "auto"`, `media: "auto"`. A wizard choice (§H.2)
overrides the archetype pick for every direction.

`media: "auto"`: visual → large; stack → thumb when the offer's visual differs from the lead item photo or has
several items, else the ×qty numeral; tiers/ticket → large when image-led, else numeral; pills → large in the panel.

### E.6 Offer visual composition (order form, offer section, split panel): src/landing/offers/visual.tsx
```ts
type Tile = { kind: "item"; item: string; qty: number; free: boolean; lock?: Record<string, string> } | { kind: "choice"; items: string[]; qty: number; free: boolean };
export function visualPlan(doc, offer): { mode: "copies" | "choice" | "duo" | "trio" | "grid" | "custom"; tiles: Tile[]; images?: AssetRef[]; arrange?: string };
```
- The media box has a fixed height per picker and density (`--of-media-h`); widths follow the photos.
- **Fit**: a photo is cover-fitted only when its ratio is within 15% of its cell, it has no alpha, and it is not
  a group photo; otherwise `contain` on a `--sec-chip` backdrop. **Group photos are never cover-cropped.** Crops
  (`box`) render through `Picture`.
- **custom**: 1 photo → fitted; 2 photos, `arrange: "auto"` → **lead + side**: the photo showing more items (a
  group photo) leads at ≈ 2/3 of the width, the other ≈ 1/3, joined by a "+" chip; `row` → cells sized by aspect
  ratio (`flex-grow` = width/height, same height); `overlap` → 12% overlap; 3 → lead + two stacked; 4 → 2 × 2.
  **Custom visuals never swap** with the shopper's choices.
- **auto**: tiles = lines in order (paid first, then free), consecutive tiles of the same item and same locks
  merged (qty summed). One item tile → **copies** (depth stack for photos, lineup for cutouts, max 3 + "+n"; a
  lock shows that option's photo). One choice tile → **choice**: 2 choices = first in front, second peeking at 70%,
  "ou" / "أو" chip; ≥ 3 choices = a fan of up to 4 thumbnails + "+n"; "n au choix" when qty > 1; the runtime
  cross-fades to the chosen item. 2 tiles → **duo**, 3 → **trio**, 4+ → **grid** (first four, "+k"). "×n" when
  qty > 1; gift chip on free tiles. Auto visuals swap with choices (item and option photos).
- Photo per tile: `itemVisual()`. Cutout mode (shared floor + one contact shadow) only when every tile has a
  cutout; else rounded photo windows. No photo → monogram tile (item initial on `--sec-chip`), never empty.
- Swap layers: every auto tile holds `[data-lp-vslot="pv"][data-unit][data-item]` (§F.6).
- render-check fixture `duo` has a 16:9 group photo and a 4:5 single photo and is rendered in every picker.

### E.7 Offer section (mid-page showcase)
`stacked`, `tickets`, `shelf` keep their art direction and use the shared display model
(src/landing/offers/model.ts, `OfferView`) and composition: shelf podium height follows `units`; tickets' strip
image is the composed visual; prices are `from` with "Dès"; the CTA stays `a[data-action="order"][data-bundle]`.

---

## F. Customer flow on the landing page

### F.1 Steps of the order form
1. **Choose your offer**: the picker (§E). With fill `inline`, the selected card holds the units.
2. **Personalize** (present when the page's resolved fill is rows / steps / box): the selected offer's units,
   shared groups and in-scope extras. An offer with nothing to fill shows **"Contenu du pack"** (thumbnails +
   names) so numbering and height stay stable.
3. **Your details** (unchanged). Checkout: bump (with its item's options when it has an item), live summary,
   submit (total inside), trust.

### F.2 What a unit shows
- **Head**: single-item pages "Pièce {n}"; multi-item pages "{item short} · {j}" (j = ordinal among the offer's
  units of that item, omitted when there is only one: "Rose · 2", "Crème nuit"); choice units "{line label} ·
  {j}" or "Au choix · {j}" until chosen. Free units get an "Offert" chip. `aria-label` = visible head +
  ", pièce {k+1} sur {units}".
- **Body**: item chooser (choice units: 56 px photo chips + short name, "+50 DH" when it costs more, sold-out
  struck), then the item's groups (locked rules as static chips; allowed subset only; choice → dots/tiles/chips/
  select; matrix → linked selectors or one combined list; fields → inputs with a live counter `0/12`).
- A unit with nothing to choose (fixed item without groups, or all locked) is not rendered as a unit; it appears
  in the contents line and the summary.

### F.3 Fill layouts
- `inline`: inside the selected card (stack and ticket rows expand; pills detail panel): one compact row per unit
  ("Pièce 1  ● ● ●  S M L"), height animated (instant under reduced motion).
- `rows`: one row card per unit, all visible.
- In `inline` and `rows`, a complete unit collapses to "Pièce 2 · Noir / M" + **Modifier** once focus leaves it.
- `steps`: a strip of unit chips (number, chosen item thumb, tick when complete, error dot) + one unit panel;
  Suivant / Précédent; never auto-advances; chips are buttons with `aria-controls` and `aria-current="step"`.
- `box` ("build your box"): a tray of N tiles (empty: soft tile with a "+" glyph and "Pièce n"; no dashed
  borders); tapping a tile opens its panel below (one at a time); filled tiles show the item photo + color dot.

### F.4 Behaviour
- **Memory**: values remembered per unit signature `"<itemId>#<ordinal>"` and choice-unit items per
  `"<offerId>.<k>"`; switching ×1 → ×2 keeps piece 1's color. Values not allowed on the new line are dropped.
- **Initial values**: `preset` → that value; swatch/image groups and matrix swatch dims → first available
  allowed value; text groups, text dims and item choosers → empty and required, unless only one value is
  available (then chosen).
- **Prefill** (replaces "Même choix pour toutes"): once the first unit of an item is complete, the following units
  of the same item and same rules that the shopper hasn't touched take its choice/matrix values, tagged "= pièce
  1" and shown collapsed. Never fields, never item choosers, never a value not allowed on that line. Editing a
  unit removes its tag.
- **Matrix** (linked): a value with no available combination (within the line's rules) is disabled ("épuisé"
  when out, "indisponible" when not made). Cross-dimension conflicts are **struck but selectable**: picking one
  switches the other dim when exactly one of its values completes an available combination ("Couleur changée :
  Blanc", `aria-live`); otherwise the other dim is cleared ("Noir n'existe pas en XL, choisissez une couleur").
  Focus stays on the tapped control. Combined: one list of combinations (`state ≠ none`), out ones disabled.
- **Shared groups**: one block "Pour vos {n} {item}" above the units, shown while the offer contains that item.
- **Summary** (`[data-lp-vsum]`): identical units counted, item names on multi-item pages ("2 × Crème jour ·
  Noir / M + 1 × Sérum · Offert"), surcharge reason rows (§C.3), bump, delivery, total; submit button updates.
- **Image swap**: auto visuals and the receipt thumbnail follow each unit's item and option photo.
- **Bump with an item**: checking it reveals the item's unit body under the checkbox (prefilled from an offer
  unit of the same item when present); unchecking disables those controls.
- **Errors**: client checks mirror the server (required, charset, length, distinct, allowed); submit opens and
  scrolls to the first unit in error and focuses its first control; messages from server-rendered `data-msg*`.
- **Stale** (`error: "stale"`, §G.2): the runtime saves the form and selection, reloads once (guard
  `sessionStorage lp-stale:<pageKey>`), restores, and shows "L'offre a été mise à jour, vérifiez votre choix"
  above the summary.
- **Refresh**: sessionStorage `lp-u:<pageKey>` = `{ ver, o: offerId, u: { sig: { gid: value } }, c: { "<offerId>.<k>": itemId }, x: { gid: value }, b }`,
  ≤ 4 KB, validated on read against the current config (unknown keys dropped), not used in preview, removed after
  a successful order.

### F.5 Accessibility
Offers: radios in a fieldset (unchanged). Each unit: `role="group"` + `aria-label` (§F.2). Each group:
`<fieldset>` + `<legend>`, `aria-describedby` → its error line (`aria-live="polite"`); matrix dims are nested
fieldsets; fields have `<label>`, `maxlength`, `inputmode` (`numeric` for digits/number), `dir="auto"`,
`autocomplete="off"`. Locked chips are text, not controls. Summary and matrix notices `aria-live="polite"`.
Sold-out options are disabled with ", épuisé" for screen readers. Visible focus rings; reduced motion = no height
or cross-fade animation.

### F.6 Markup contract (renderer ↔ runtime): replaces "Order form markup" in ARCHITECTURE.md
| Selector | Where | Meaning |
|---|---|---|
| `[data-lp-bundles]` + `input[type=radio][name=bundle][value=<offerId>]` in `[data-bundle-card=<id>]` | picker | unchanged names (D3); `data-soldout` on unavailable cards |
| `.lp-packs` `data-picker` `data-sel=soft\|solid\|outline` `data-density` `data-media` | picker root | CSS switches |
| `[data-lp-contents=<offerId>]` | card / personalize step | contents line ("Contenu du pack") |
| `[data-lp-units]` `data-fill=inline\|rows\|steps\|box` `data-units=<n>` | personalize step or selected card | container (replaces `[data-lp-variants]`) |
| `[data-lp-unit=<k>]` `data-item` `data-line` `data-free` `data-prefilled` | unit | one unit (rendered for the default offer; others cloned) |
| `[data-lp-unit-head]` | unit | head text, tokens `{n}` `{item}` `{j}` |
| `[data-lp-item-pick]` with `input[type=radio][name="u.<k>.@item"][value=<itemId>]` | choice unit | item chooser (`@` never occurs in an id: no reserved group id) |
| `[data-lp-item-body=<itemId>]` | unit | the chosen item's groups for this unit |
| `[data-lp-lock=<ruleKey>]` | unit body | static chip of a locked value |
| `template[data-lp-unit-tpl]`, `template[data-lp-item-tpl=<itemId>]`, `template[data-lp-pick-tpl=<offerId>.<line>]` | container | unit shell, item body (`u.{k}.<gid>`), item chooser |
| `[data-lp-shared=<itemId>]` | container | the item's shared groups, names `s.<itemId>.<gid>` |
| `[data-lp-extra=<gid>]` `data-scope="all"\|"id id"` | personalize step / checkout | page extras, names `x.<gid>`; enabled when in scope |
| `[data-lp-bump-body]` | bump | bump item groups, names `b.<gid>` |
| `[data-lp-steps]` > `button[data-lp-step=<k>]`, `[data-lp-slot=<k>]`, `[data-lp-next]`, `[data-lp-prev]` | steps / box | navigation |
| controls `u.<k>.<gid>` (choice, field, combined matrix: value = cell key), `u.<k>.<gid>.<dimId>` (linked matrix dim) | groups | `data-delta=<cents>`, `data-sw`, `data-vimg` |
| `[data-field=<key>]` + `[data-error]`, `data-msg` / `-gone` / `-long` / `-dup` / `-bad` / `-switched` / `-conflict` | every group, item chooser | error placement + localized messages |
| `[data-lp-sum=subtotal\|bump\|shipping\|total]`, `[data-lp-sum-reasons]` | summary | reasons list replaces the single `options` row |
| `[data-lp-price="current"]` | anywhere | live total |
| `[data-lp-stale]` | summary | stale notice slot |
| `[data-lp-vslot="thumb\|pv"]` `data-unit` `data-item` `data-base` + `template[data-lp-vimg=<key>]` | auto visuals | swap; key = `<itemId>` · `<itemId>:<gid>:<optionId>` · `<itemId>:<gid>:<cellKey>` |
Control-name regex (runtime + server), with `ID = [A-Za-z0-9_-]{2,40}`, `ITEM = [a-z0-9][a-z0-9-]{1,23}`:
`^(?:u\.\d{1,2}\.(?:@item|ID(?:\.ID)?)|s\.ITEM\.ID(?:\.ID)?|x\.ID|b\.ID(?:\.ID)?)$`.

### F.7 Runtime config v2 (type in src/landing/runtime/config.ts, built by src/lib/render/config.ts)
```ts
export interface LandingRuntimeConfig {
  v: 2;                                      // v1 pages keep their own embedded runtime + config
  ver: string;                               // publish version id ("" in preview and exports)
  /* …v1 fields unchanged: page, pageKey, mode, locale, dir, currency, endpoints, thankYouUrl, landingUrl, upsell,
     phone, fields, pixels, strings, whatsapp, turnstileSiteKey … ; money: { …v1, minor: 100 } */
  shippingFee: number;                       // cents (every amount in this config is integer cents)
  product: { name: string; contentId: string };
  items: { id: string; name: string; short: string; price: number; contentId: string; groups: RuntimeGroup[] }[];
  bundles: {
    id: string; label: string; short: string; price: number; from: number; variable?: true; reference: number;   // reference = displayReference
    perUnit?: number; savings: number; savingsPct: number; free: boolean /* effectiveFree */; soldOut?: true;
    units: { line: number; item?: string; choices?: string[]; available?: string[]; distinct?: true; surcharge?: true; base?: number[]; free?: true;
             rules?: Record<string, { lock?: string; allow?: string[]; preset?: string }> }[];
  }[];
  extras: (RuntimeGroup & { scope: "all" | string[] })[];
  bump?: { price: number; item?: string; offers?: string[] };
  defaultBundleId: string;
  fill: "none" | "inline" | "rows" | "steps" | "box";   // resolved (§E.1)
  features: ("matrix" | "fields" | "steps-box")[];        // optional chunks embedded in this page
}
type RuntimeOption = { id: string; label: string; soldOut: boolean; delta?: number };
export type RuntimeGroup =
  | { id: string; name: string; kind: "swatch" | "text" | "image"; perUnit: boolean; options: RuntimeOption[] }
  | { id: string; name: string; kind: "matrix"; perUnit: boolean; display: "linked" | "combined";
      dims: { id: string; name: string; values: RuntimeOption[] }[]; cells: { v: string /* cell key, wildcards allowed */; s?: "o" | "n"; d?: number }[] }
  | { id: string; name: string; kind: "field"; perUnit: boolean; input: "text" | "number"; required: boolean; maxLength: number; min?: number; max?: number; charset: "any" | "letters" | "latin" | "digits"; delta?: number };
```
`computeTotals(cfg, sel)` mirrors `orderTotals`; `unitsDeltas(cfg, sel)` mirrors `selectionDeltas`;
`unitsText(cfg, sel, "customer")` mirrors src/lib/orders/text.ts (summary, WhatsApp). Parity tested (§I.5).
Publish check: the serialized `#lp-config` ≤ 24 KB.

### F.8 Runtime modules
- `units.ts` (replaces variants.ts; one code path, single-item pages included): unit expansion from config,
  templates, choice units, inline/rows, rules (locks, allow, preset), prefill, memory, summary groups and reasons,
  photo swap, bump body, `readSelection(form)` → `{ units: { item?, o, f }[], extras, b? }`, `missingUnits(form)`,
  stale restore. Hidden or disabled controls are never read.
- Feature chunks (registered through `__lpx`, §F.9): `units-matrix.ts` (linked/combined matrix, conflict
  switch/clear), `units-fields.ts` (field inputs, cleaning, counters), `fill-steps-box.ts` (steps and box navigation).
- `bundles.ts`: offer selection, sums, `[data-lp-price="current"]`. `money.ts`: cents. `form.ts`: payload v2 (`ver`,
  `st`, `b`), error mapping for `u.` / `s.` / `x.` / `b.` keys, `stale`. `order-store.ts`: `OrderRecord.groups:
  { n, item?, parts, fields?, free?, cid }[]` (≤ 22 groups × 4 parts × 40 chars). `thankyou.ts` draws them.
- WhatsApp bridge (`WA_BRIDGE_JS`): no own totals; it formats the runtime's `{ total, unitsText }` (§G.5).

### F.9 Size discipline (build-landing-assets.mjs, document.tsx, render/core.ts, csp.ts)
Measured today: one IIFE, 49.3 KB raw / 19.0 KB gzip (variants 6.6 KB raw, pixels + ids 7.3, turnstile 2.4,
thank-you 2.5). Split into independent hashed inline scripts (CSP `scriptHashes` already takes a list):
| chunk | contents | emitted when | budget (gzip) |
|---|---|---|---|
| `landing` | core + form + offers + units core + sticky, reveal… | product pages | 24,200 B (provisional was ≤ 16 KB) |
| `units-matrix` | matrix pickers | an available offer's unit or bump item has a matrix | 2,200 B |
| `units-fields` | field inputs | a field in units, extras or bump | 1,000 B |
| `fill-steps-box` | steps + box navigation | resolved fill is steps or box | 1,750 B |
| `thanks` | core + thank-you + upsell + countdown | thank-you pages | 6,650 B |
| `pixels` | pixels.ts | page has pixels, mode ≠ preview | 3,900 B |
| `turnstile` | turnstile.ts | a site key is embedded | 1,300 B |
| `whatsapp` | the WhatsApp bridge | WhatsApp exports | 5,800 B |
**Recorded 2026-10-17** (gzip -9, src/landing/runtime/budgets.json): render-check (`npm run test:render`) fails a
chunk above its number + 5%, and the **page cap** above 32,000 B + 5%: the heaviest product page's scripts in one
document (pixels + turnstile + all three feature chunks + landing, measured 31,931 B). This page cap replaces the
DESIGN §10 20 KB figure, which v2's unit builder cannot meet: a page without pixels, Turnstile or optional
features ships the landing chunk alone (24.2 KB). Trimming the core back toward 20 KB is a follow-up, not a gate. Optional chunks sit before the core script and register
`(window.__lpx = window.__lpx || []).push([name, fn])`; the core's `ONCE` modules run them at init. The admin
preview imports `initLanding` and all features directly. Picker CSS: packs.css splits into `packs.css` (shared) +
`packs.<picker>.css`; the renderer inlines the page's picker chunk (plus its fallback picker). No new runtime
dependencies.

**Page caps** (blocking render issue `page_too_large` at publish, and checklist errors in the builder): HTML ≤
400 KB, `#lp-config` ≤ 24 KB, ≤ 48 option/value/cell photos (each becomes a `<picture>` template), plus the
schema caps of §J.1.

---

## G. Order contract v2

### G.1 Payload (src/lib/orders/contract.ts)
```ts
const ID = /^[A-Za-z0-9_-]{2,40}$/;
const UnitIn = z.object({
  item: ItemId.optional(),                                               // required for choice units; ignored for fixed ones
  o: z.record(z.string().regex(ID), z.string().max(250)).default({}),   // choice option id | matrix "dim=value|dim=value" (any order; locked dims may be omitted)
  f: z.record(z.string().regex(ID), z.string().max(240)).default({}),   // field values (server re-cleans, re-caps)
}).refine((u) => Object.keys(u.o).length <= 8 && Object.keys(u.f).length <= 4);
const Base = z.object({ pageKey, idem, eventId, bundleId, bump, name, phone, city, address, note, email, website, t, utm, fbp, fbc, ttp, ref, locale, cf }); // = v1 fields
export const OrderPayloadV2 = Base.extend({
  v: z.literal(2),
  ver: z.string().regex(/^[A-Za-z0-9]{26}$/).optional(),     // publish version the page was rendered from (absent in exports)
  st: z.number().int().min(0).max(1_000_000_000),            // total shown on the submit button, cents
  units: z.array(UnitIn).max(20).default([]),
  extras: z.record(z.string().regex(ID), z.string().max(240)).default({}).refine((x) => Object.keys(x).length <= 4),
  b: UnitIn.optional(),                                       // bump item's options
});
export const OrderPayloadV1 = Base.extend({
  variants: z.array(z.record(z.string().max(40), z.string().max(40))).max(20).default([]),
  units: z.undefined(), extras: z.undefined(),               // a v2-shaped body without v never parses as v1
});
/** Dispatch BEFORE parsing: raw.v === 2 → V2; raw.v absent → V1; anything else → invalid. No z.union. */
export function parseOrderPayload(raw: unknown): { ok: true; v: 1 | 2; data: OrderPayloadV1 | OrderPayloadV2 } | { ok: false; fields: OrderFieldErrors };
//   Zod paths → keys: units.k.item → u.k.@item; units.k.o.gid / units.k.f.gid → u.k.gid; extras.gid → x.gid; b.o.gid / b.f.gid → b.gid;
//   name / phone / city / address / email → as today (a 90-character name still says fields.name: too_long)
/** v1 → v2 view: units[u] = { o: variants[u] ?? variants[0] ?? {}, f: {} } */
export function toSelectionInput(p): { offerId: string; units: UnitIn[]; extras: Record<string, string>; bump: boolean; b?: UnitIn };

export const LeadPayload = z.object({ pageKey, idem, phone, name, city, bundleId, utm,     // v1 fields unchanged
  v: z.literal(2).optional(), ver: z.string().regex(/^[A-Za-z0-9]{26}$/).optional(),
  units: z.array(z.unknown()).max(20).optional(),            // tolerant: each parsed with UnitIn.safeParse, bad entries dropped
  extras: z.record(z.string(), z.unknown()).optional(),      // tolerant; never an error
});
```
The runtime copies shared-group values into every unit of that item; the server reads them from the first unit
of the item. Order route body limit 16 KB → **24 KB**. `cod_parse_payload` in order.php mirrors the dispatch.

Example (the §C.5 trio, with a "Prénom" field `g-name` on the sérum and the gift-wrap extra):
```json
{ "v": 2, "ver": "01JA7Q2M9X4T6V8B0C2D4F6H8K", "st": 36400, "pageKey": "pk_7Kq2…", "idem": "…", "eventId": "…", "bundleId": "trio", "bump": false,
  "units": [ { "o": {} }, { "o": {} }, { "o": {}, "f": { "g-name": "سارة" } } ],
  "extras": { "g-wrap": "o-yes" }, "name": "سارة بناني", "phone": "+212612345678", "city": "Casablanca", "t": 41200 }
```

### G.2 Validation (src/lib/orders/validate.ts `resolveSelection`; shared rules in src/lib/page/options.ts)
**Which version** (src/lib/orders/resolve.ts `orderVersion(target, payload)`):
- export target → its pinned version (`ver` ignored).
- page target, v2: `ver === publishedVersionId` → current; `ver` is a `kind="publish"` version of this page whose
  next publish was created < 72 h ago → **that version**; otherwise current with `fallback: true`.
- page target, v1 (no `ver`): the newest publish version with `runtime_v = 1`; current, or superseded < 72 h →
  it; otherwise current with `fallback: true`.
- `versionDoc(id)`: `PageDoc.safeParse` (upgrade + repairs); on failure, `validateDoc` repair with a loud log
  `[orders] version <id> needed repair: …`; null only when unrecoverable. Never "unavailable" over a repairable doc.

```
offer = doc.offers.bundles.find(id) → else bundleId: invalid;  !offerAvailable → bundleId: unavailable
slots = expandUnits(offer, doc.items)
for slot k:
  item = slot.item ?? units[k]?.item
  choice slot: missing → u.k.@item required (auto-filled when one is available) · not in slot.choices → invalid
               · not in slot.available → unavailable · distinct line with a repeated item → u.k.@item duplicate (later unit)
  for group g of item:
    value = g.perUnit ? units[k] : units[first unit k0 of this item]       key = g.perUnit ? u.k.<gid> : s.<itemId>.<gid>
    rules: locked → the server's value (payload ignored); allow → outside → invalid
    choice: required (single available allowed option auto-filled) | invalid | unavailable
    matrix: parse dim=value pairs + locks; every dim present (required); unknown value (invalid); resolveCombo: out → unavailable, none → invalid
    field : clean → empty & required (required) | too long (too_long) | charset / "<>" / number range (invalid)
  record OrderUnit (labels + codes snapshot, sku = resolveCombo sku ?? item.sku, free)
extras: groups whose scope contains the offer (others ignored), keys x.<gid>
bump: bump && orderBump.item && (no offers list || offer in it) → validate b as a unit of that item (perUnit ignored, no rules), keys b.<gid>
totals = orderTotals(doc, selection)
fallback && (any error on bundleId / u. / s. / x. / b. keys || totals.total ≠ st) → 409 { ok: false, error: "stale" }
!fallback && st ≠ totals.total → log "[orders] parity mismatch" (server total wins: stored and shown on thank-you)
unknown group ids / extra units in the payload are ignored
```
Error codes: `required`, `invalid`, `unavailable`, `too_long`, `duplicate`; top-level `stale`. `OrderFieldErrors`
keys: v1 delivery fields + `bundleId` + `u.<k>.@item` + `u.<k>.<gid>` + `s.<itemId>.<gid>` + `x.<gid>` +
`b.<gid>` (v1 payloads still get v1 `v.*` keys).
```json
{ "ok": false, "error": "invalid", "fields": { "u.0.@item": "required", "u.1.g-fit": "unavailable", "u.1.g-name": "too_long" } }
```
`decoyResponse` uses `offer.from`. `create.ts`: `versionId` = the version used, `qty = units`, `productName =
product.name`, `gift`, bump unit. Server Purchase uses that version's tracking (§A.5).

### G.3 Storage (src/lib/db/schema.ts: JSON in `orders.items`; columns §I.2)
```ts
export interface OrderUnit {
  item: string;                                        // item id at order time
  label: string;                                       // item name snapshot ("" on single-item pages)
  short?: string;                                      // item short (warehouse name)
  sku?: string;
  free?: true;
  options: { name: string; value: string; code?: string; delta?: number }[];   // matrix: one entry, value "Noir/M"
  fields?: { name: string; value: string; delta?: number }[];
}
export interface OrderItems {
  v?: 2;                                               // absent = v1 row
  bundleId: string; bundleLabel: string;               // offerSheetLabel (v1 format for legacy-shaped offers)
  qty: number;                                         // units incl. free (bump not included)
  unitPrice: number;                                   // fromCents(round((price + deltas) / qty)): v1 meaning kept
  variants: Record<string, string>[];                  // v1 compat: per unit { groupName: value, …, fieldName: value } (+ "Article": label on multi-item pages)
  units?: OrderUnit[];
  extras?: { name: string; value: string; delta?: number }[];
  gift?: { label: string };                            // offer.gift snapshot (non-catalog)
  price?: number; deltas?: number;                     // offer base price, Σ surcharges
  reasons?: { label: string; count: number; amount: number }[];
  bump?: { title: string; price: number; unit?: OrderUnit };
  upsell?: { title: string; price: number; item?: string; confirmOptions?: true };
}
```
`orderUnits(items, productName): OrderUnit[]` (src/lib/orders/text.ts) gives every reader one view: v2 rows →
`units`; v1 rows → rebuilt from `variants` (item `"main"`, label `""`).

### G.4 Text formats (src/lib/orders/text.ts: one implementation, mirrored by order.php and the runtime)
```
text    := part (" + " part)* [" || Commande : " extra ("; " extra)*]
part    := [marker " "] [count] [label] [" (" values ")"] [" · " field (", " field)*]  |  "CADEAU : " giftLabel
marker  := "[OFFERT]" | "[AJOUT]" (bump item) | "[UPSELL]"
count   := n " × "             // always on multi-item pages; on single-item pages only when n > 1 (v1 identical)
label   := item short name     // omitted on single-item pages (values then not parenthesized)
values  := value ("/" value)*   // groups in order, locked values included; matrix = dims in order "Noir/M"
value   := code ?? label; a value matching ^\d+([.,]\d+)?$ prints "<group or dim name> <value>" ("Pointure 42")
field   := name " « " value " »"
extra   := name " = " value [" (+" delta ")"]
```
- Identical units are counted (first-seen order); free units never merge with paid ones.
- A paid part with no label, values or fields is dropped; a free one prints `[OFFERT] 1 pièce` / `[OFFERT] n
  pièces`. All parts dropped → `""`.
- Owner labels are sanitized: " + " → " & ", "/" → "-", "||" → "|", " · " → " - ", « » → `"`. Typed values
  are wrapped in « » (inner « » → `"`).
- Cap **1000** characters: whole unit parts are dropped from the end and replaced by ` … (+n, voir CMD-7K3Q9X)`;
  gift, bump and the order segment are always kept.
- Two renderings: `"warehouse"` (codes, short names; Sheets, CSV, Telegram, order.php) and `"customer"` (labels;
  WhatsApp, thank-you, admin drawer).

Examples:
- Single-item, options only: `2 × Noir/M + Beige/L` (v1 identical; numeric values now `2 × Pointure 42 + Pointure 43`).
- Multi-item + extra: `1 × Jour + 1 × Nuit + 1 × Sérum · Prénom « سارة » || Commande : Emballage cadeau = Oui (+15)`.
- Matrix + field, single-item: `Noir/M · Prénom à imprimer « Sara » + Blanc/XL`.
- BOGO: multi-item `1 × Rose (50 ml) + [OFFERT] 1 × Rose (50 ml)`; single-item `50 ml + [OFFERT] 50 ml`; single-item
  without options `[OFFERT] 1 pièce`.
- Gift and bump: `1 × Jour + 1 × Nuit + CADEAU : Trousse de voyage + [AJOUT] 1 × Sérum`.
- Upsell accepted later: `… + [UPSELL] 1 × Sérum (options à confirmer)`.

**Sheets** (src/lib/sheets/sync.ts; the 13-column order is a contract and stays): Produit = `${product.name} —
${bundleLabel}` (+ bump + upsell, as today); Variante = warehouse text; Qté = units. **Optional columns by
header**: when row 1 has, after column M, a header named exactly (trimmed, case-insensitive) "SKU", "Articles",
"Livraison" or "Prix pack", sync fills it: SKU = `JOUR×1 NUIT×1 SER-50×1` (`cell sku ?? item.sku ?? item short`,
counted, unit order, free/bump/upsell units included); Articles = physical pieces incl. free and bump; Livraison =
delivery charged; Prix pack = offer price. Headers are read once per sheet per 10 min (and after a failed write);
the append sends `null` for every other column after M (the Sheets API skips nulls, so call-center columns are
untouched). Missing header = nothing written. Upsell updates Variante / SKU / Articles like Produit / Total.
order.php mirrors all of this in its own Sheets append.

**Admin**: CSV = Variante (warehouse) + appended "Options (+)" and "SKU". Drawer: one row per part (item name
bold, option chips with swatch dots and the code in small type, field values in « », badges Offert / Cadeau /
Ajout), money block with the reason rows. Leads panel and lead export show `leads.selection`. Editors see
`sheetPreview(doc, offer)` (Variante for the first available values) as "Dans Google Sheets : …" under each offer
and item.

### G.5 WhatsApp export (src/lib/export/whatsapp.ts `compose`)
The runtime passes its computed `{ total, unitsText("customer") }`; the bridge only formats (no own pricing;
it is in the parity corpus). Localized labels (existing `L` table + `free`, `gift`, `options`), one bullet per part:
```
*Commande* · Réf CMD-7K3Q9X
Produit : Duo Éclat
Pack : Le rituel complet (x3)
• 1 × Jour
• 1 × Nuit
• 1 × Sérum · Prénom « سارة »
• Cadeau : Trousse de voyage
Commande : Emballage cadeau = Oui (+15 DH)
*Total : 364 DH* (paiement à la livraison)
```
URL cap: parts are dropped from the end until `encodeURIComponent(message).length ≤ 3800`, replaced by
` … (+n articles)`.

### G.6 PHP export (src/lib/export/php.ts + templates/order.php)
`PhpSpec` v2 = `{ …v1 base, money in cents, items: [{ id, name, short, sku?, price, groups }], offers: [{ id,
sheetLabel, price, from, free, units: [{ line, item?, choices?, available?, distinct?, surcharge?, base?, free?,
rules? }], soldOut? }], extras (with scope), bump { price, item?, offers? }, gift per offer, multi }`.
`cod_parse_payload` dispatches on `v`; `cod_validate` implements §G.2 (same keys, codes, cleaning: PCRE `/u`,
`mb_strlen`, digit folding; rules; bump unit; extras scope; no `ver`: self-contained); totals are integer
additions of cents (no float `round()`); `cod_units_text` = §G.4; the Telegram line "Variante : …" and the
Sheets append (incl. optional header columns) use it. New exports send v2 payloads; old order.php files are
self-contained and untouched.

### G.7 Pixels contents and analytics
- `contentIdOf(item)` = sku || (`item.id === "main"` ? pageKey : `${pageKey}.${itemId}`).
- Server Purchase (Meta CAPI, TikTok Events API): `value` = order total; `num_items` = units + bump; `content_ids`
  = distinct ids incl. the bump item; `contents` = per id `{ id, quantity, item_price }` from `allocate()` (free
  units 0; bump item at the bump price); `content_name` = product.name (single item) or the offer label.
- Browser AddToCart / InitiateCheckout / Lead: same shape from the config and the current selection; a choice
  unit not chosen yet counts as the **first available choice of its line**. Purchase on the thank-you page from
  `OrderRecord.groups[].cid`. Deduplication unchanged (event name + order id).
- Analytics beacons unchanged (`bundle_change` carries the offer id); leads keep `bundleId` and add `selection`.

### G.8 Thank-you page
Server render: the default offer label and total as fallback (today). The runtime fills `[data-ty="items"]`
(offer label + bump item) and draws `[data-ty="options"]` from the stored groups (item names, dots, fields in « »,
"Offert", "Cadeau : …", then the page extras chosen with their surcharge: "Emballage · Emballage cadeau +15 DH").
The offer row is labelled with a noun ("Votre offre" / "العرض ديالك" / "Your offer"), not the form's prompt. The summary photo stays the product visual.

---

## H. Generator and editing UX

### H.1 Shared presets (new, pure: src/lib/page/offer-presets.ts; charm pricing moved to src/lib/page/charm.ts)
```ts
export type OfferPreset = "single" | "multi" | "choose-one" | "any-n" | "combo" | "combo-gift" | "bogo" | "everything" | "pack-colors";
export function presetOffer(p: OfferPreset, doc: Pick<PageDoc, "items" | "currency" | "offers">, opts?: { items?: string[]; qty?: number; free?: number; dim?: string; values?: string[] }): Offer;
export function suggestOffers(doc: Pick<PageDoc, "items" | "currency" | "offers" | "product">, texts: OfferTexts): Offer[];   // group photos from groupPhotos(doc)
```
`pack-colors` = one fixed line per chosen value of a matrix dim (or choice group), each locked to that value. Every
preset and suggestion sets `freeShipping: false` and is honest (price < reference for 2+ units, per-unit falling
with size, ≤ 8 offers, unique ids). `suggestOffers` (wizard, generator, and the builder's "Suggest offers"):
- 1 item: ×1 / ×2 popular / ×3 best (today's `suggestBundles` numbers).
- 2 items: prices within 10% → "Au choix" (1 of 2) + "Duo" (popular, `charm(0.85 × Σ)`, visual = a group photo of
  both, else auto); prices apart → two single offers + "Duo".
- 3 items: "Au choix" (similar prices) · "Duo" only when a group photo of two items exists · "Trio" (best,
  `charm(0.78 × Σ)`, visual = [group photo, third item photo] when available).
- 4–8 items: "Au choix" · "2 au choix" · "3 au choix" · "Coffret complet" (all, ≤ 6 items).
- An item with a color dim/group of 3+ values: also offers "Pack 3 couleurs" (`pack-colors`).
Texts: copy-library (ar / fr / en; other locales fall back to en) gains names for choose-one, any-n, duo, trio,
set, BOGO, pack-colors, and `offerShort` / `offerSentence` texts. `remix.ts` rewrites titles only for single-item
×N offers.

### H.2 Wizard (src/components/generate): Photos → Analysis → Details → **Offers** → Directions
- **Details**: name, price, options of the lead item, category, facts, language/market, copy.
- **Offers** (new `step-offers.tsx`; `STEPS` gets 5 entries, `Step` 0–4):
  1. *What does this page sell?* "One product" / "Several products". Several: item cards with **photo wells**
     (§B.4); adding the second item asks for the first item's name, prefilled with the product name; "Crop
     {item} from this photo" appears when an item has no own photo; "Add a product": name, price, photos, options.
  2. *Offers*: `suggestOffers` cards (on/off, price, title, visual thumb, `offerSentence`); "+ Offer" opens
     preset tiles first, "Blank" last.
  3. *Look*: the combos (§E.1) + "Auto (each design chooses)"; real previews are the Directions step.
- **Directions**: art directions + **"Ad tracking for this page"** (§A.4, required answer) + Create page.
- State: `Details.items`, `Details.offers`, `Details.display`, `Details.tracking?: TrackingChoice`; group photos
  derived from the wells; sessionStorage schema bumped (old state: those fields default, `pixelsOff` dropped).
  `GenerateInput` gains `items`, `offers`, `display`, `tracking`: given → used verbatim (validated), absent →
  `suggestOffers`, and `tracking` is required.

### H.3 Builder: Product panel → "Product & items"
Story sections unchanged (basics, photos, cutout, rating). New **What you sell**: item cards (photo well with crop,
name, short name with "Dans Google Sheets : …" preview, price, compare-at, SKU, sold out, options editor). On a
single-item page the one card sits where price/options are today. "+ Add item" (≤ 8; going from 1 to 2 asks for
the first item's name). Free dnd-kit reorder (content ids follow the id, so order is free); menu: **Show first**
(moves to index 0: lead visuals on single-item pages, first in choosers and the shelf), **Duplicate** (with its
groups), **Copy options from…**, Delete. Deleting an item used by offers, bump or upsell: confirm dialog listing
them; confirming removes their lines (offers left empty are removed) and clears the bump/upsell item.

### H.4 Builder: Offers panel (rewrite; shared pieces in src/components/admin/offers/)
- **Top**: `offerWarnings` list; **Suggest offers** (runs `suggestOffers` on the current items and group photos;
  diff dialog: "New" / "Same contents, price differs" / "Already there", matched by `offerSignature`; accept each
  offer individually, ≤ 8 enforced).
- **Products on this page** shelf: item tiles (photo, short name, price) + inline **New product** (name, price,
  photo pick or upload) → creates an item.
- **Offer cards** (dnd-kit sortable, handle + keyboard). Collapsed: 64 px mini composition, name, `from`
  ("Dès"), struck reference, −%, badges, "Épuisé", `offerSentence` (one line). Menu: Duplicate · Move up / down ·
  Sold out · Delete. Clicking a card selects that offer in the preview (`selectOffer(id)`); clicking an offer on the
  canvas opens its editor (preview bridge `offerClicked` message).
- **Expanded**:
  - **Contents** composer: tapping a shelf tile adds one unit (merges into that item's fixed line); content chips
    (photo, ×n, −/+); chip menu: Make it a gift (free) · Label · Let the customer choose (tap tiles to pick the
    allowed items; toggles "all different" and "price follows the choice") · **Fix an option…** / **Limit
    options…** (rules, fixed lines only; option chips per group or dim, preset dot) · Remove. Under it the
    read-only sentence ("2 × Crème jour + 1 au choix (Nuit ou Sérum) + Trousse offerte · 4 pièces") and "Dans
    Google Sheets : …".
  - **Price**: Total | Discount % toggle (% off the automatic reference, charm-rounded with charm.ts); compare-at
    (placeholder = automatic reference); live from / per-unit / saving; "Dès" note when variable.
  - **Visual**: Auto (preview) | Custom photos (1–4, MediaPicker; arrange Auto (lead + side) / Row / Overlap / Grid).
  - **Details**: title, short (≤ 14), subtitle, perks (≤ 3), badge, selected first, free delivery (only when fee >
    0), gift (text + photo), sold out.
- **Page level**: Order extras (shared options editor, "Applies to" chips: All offers / specific offers), bump
  (title, price, optional item, "Show with" offer chips), upsell (+ optional item), delivery fee (0 → more shows
  how many offers are marked free), urgency.
- **Display** (bottom): combos row (Classique / Boutique / Compact / Auto) above the three axes, named **Offer
  layout** (5 glyph tiles, the archetype-recommended one marked), **Personalization layout** (Auto / Inline / Rows
  / Steps / Box; invalid ones disabled with the reason), **Selected style** (Soft / Solid / Outline); then media,
  density, per-unit, savings display; `resolveDisplay` notes shown inline.
- `src/lib/editor/checklist.ts`: per item price > 0; names with 2+ items; offer price > 0; compare-at ≤ price;
  choice-line item without own photo (**error**, §B.4); a matrix with every combination out; a required field
  with a delta (error); `page_too_large` (error); fee > 0 with every offer free (warning); pixel checks (§A.4).

### H.5 Feature switches (src/lib/page/features.ts)
`MULTI_ITEM`, `MATRIX`, `FIELDS`, `PRICE_DELTAS`, `RULES`, `BUMP_ITEM`, `NEW_FILLS` gate **only the editors**
(wizard and builder), so tracks can merge before the renderer/runtime parts land. The schema, server and renderer
accept everything from Phase 0.

---

## I. Migration, compatibility, tests, rollout

### I.1 Documents (src/lib/page/upgrade.ts, new)
```ts
export function upgradeDoc(raw: unknown): unknown {
  if (!isPlainObject(raw) || (raw.v !== 1 && raw.v !== 2)) return raw;   // fails PageDoc → validateDoc reports it
  const d = structuredClone(raw);                                          // never mutate the caller's object
  if (d.v === 1) v1ToV2(d);                     // §C.7: items[main], product story, bundles → offers, display, freeShipping false
  return repairDoc(d);                          // deterministic + idempotent, on v1 AND v2 input
}
// schema.ts: export const PageDoc = z.preprocess(upgradeDoc, PageDocObject); types from PageDocObject.
```
`repairDoc` (each repair logged for `validateDoc` warnings; ids stored orders, leads and payloads can reference
are only ever renamed by the documented rule):
1. Money → 2 decimals (half-up on cents).
2. Duplicate offer ids → `<id>-2`, `<id>-3`… (first keeps its id, same rule as today's `validateDoc`); same for
   line ids per offer, group ids per item, option and value ids per group.
3. More than one `preselected` → keep the first.
4. Dangling references (v2 data): lines on missing items dropped, offers left empty dropped; rules on missing
   groups/options dropped; extras scopes / bump `offers` on missing offers dropped (an extra left with no offer is
   dropped); bump/upsell `item` missing → cleared.
5. `tracking.none` with ids set → dropped.
6. Matrix cells with unknown dims/values → dropped **only when** that cell's state is `in` (an `out`/`none` exception
   is kept by removing the unknown key, so a sold-out combination never becomes sellable).
Hard `superRefine` errors exist only for v2-only constructs (names with 2+ items, distinct qty > choices, required
field with a delta, caps). There is no reserved group id (the item chooser is `@item`), so no v1 group is renamed.
- Reads: every `PageDoc.safeParse` / `validateDoc` (drafts, versions, `versionDoc`, exports, history, preview,
  builder persistence, `parseDraft`) upgrades and repairs. Writes are always v2. Version rows stay v1 JSON forever.
- **Published checksums**: one-time boot task (under `withBootLock`, marker setting `doc_schema = 2`): each page's
  published version gets `checksum = checksumOf(validateDoc(doc).doc)`, so live pages don't show "unpublished
  changes".
- Published HTML is static: **no re-render**. Old live pages keep their v1 runtime and validate through §G.2. A page
  moves to the v2 runtime at its next publish (or a pixels-only update). PHP / WhatsApp exports are self-contained.

### I.2 Database (drizzle/0003_offers_v2.sql, MariaDB 10.4: no JSON type, LONGTEXT stays)
- `page_versions.runtime_v TINYINT NOT NULL DEFAULT 1` (existing rows = 1; publishes by this build write 2).
- `leads.selection VARCHAR(400) NULL` (warehouse units text of the resolvable part of the lead's selection).
- `orders.version_id` exists: now the version validated against. No `page_pixels` table.

### I.3 Deploy gate: scripts/qa/upgrade-dry-run.ts (read-only)
`npm run qa:upgrade-dry-run -- --db <mysql url>` over every `pages.draft`, every `page_versions.doc` and every
export's version. Asserts: 0 parse failures; ids preserved (offers, groups, options; renamed duplicates listed);
`offerMath` (cents) == v1 `bundleMath` per bundle; `orderTotals` equal for each bundle × bump on/off; prints repair
counts by kind and every money value changed by rounding. Run on the XAMPP database **and on a fresh dump of
production imported into XAMPP before every deploy of this feature** (DEPLOY-HOSTINGER.md gains the step). The new
build also runs it once at boot, read-only and non-blocking, logging `[upgrade-check]`.

### I.4 Orders and leads
v1 rows are never rewritten; `orderUnits()` reads both. New rows are v2 with the v1 compat fields filled (fields
included in `variants`). `upsell.ts` (reads `order.versionId`), stats: unchanged. Leads store `selection`.

### I.5 Tests to add (`npm test` runs all except php / e2e / dry-run)
| Test | Checks |
|---|---|
| `scripts/qa/offers-check.ts` (new, `test:offers`) | `upgradeDoc` on every fixture and v1 samples (ids kept, `offerMath` == v1 `bundleMath`, totals for fee 0 and > 0, labels identical, idempotence, every repair incl. two preselected / duplicate ids / dangling refs); every §C.5–C.6 case in cents (reference, from, variable, savings, per-unit, deltas, free lines, gift-not-sold = 0, choice base stable when the cheapest sells out, distinct difference); **property test**: for 500 random docs, min subtotal over enumerated valid selections == `from`; `allocate` sums exactly (incl. 100/3 and Σref = 0); limits/refinements; `offerWarnings`; `resolveCombo` (wildcards, specificity, severity); `unitsText` (v1 byte-identical cases, numeric prefix, markers, quotes, sanitizing, empty parts, 1000 cap) |
| `src/lib/orders/selftest.ts` (extend) | `parseOrderPayload` dispatch (v2 body failing V2 never parses as V1; path → key mapping; 90-char name) · `validateOrder` with v1 payloads on upgraded docs and v2 payloads on duo / tshirt / colors: every code and key, auto-fill, shared groups from the first unit, distinct, rules (lock ignores payload, allow → invalid), bump unit, extras scope, field cleaning · version choice: current, superseded < 72 h, > 72 h → stale on mismatch, v1 → newest `runtime_v = 1` · `versionDoc` repair fallback |
| `scripts/qa/money-parity.ts` (extend) | runtime `computeTotals` + `unitsDeltas` + `unitsText`, the WhatsApp bridge, and the server, over 500 seeded random selections per fixture, all in cents |
| `src/landing/runtime/selftest-units.ts` (replaces selftest-variants.ts) | unit rows on offer switch, choice → body swap, memory, prefill + tag, locks/allow/preset, matrix conflict switch/clear, combined matrix, field errors, steps/box navigation, collapse, bump body, stale reload restore, summary text == `unitsText` |
| `scripts/qa/render-check.ts` (extend) | fixtures `duo` (fr + ar; 16:9 group photo + 4:5 single; crops), `tshirt` (matrix + field), `colors` (locks) × 5 pickers × 3 selections × resolved fills; bold form + solid; no section throws; orange-blend audit **fails**; feature chunks present only when needed; page caps; chunk budgets from RT-0 (fail in CI) |
| `scripts/qa/php-parity.ts` (new, XAMPP `php.exe`) | the payload corpus through order.php CLI and `validateOrder`: same field errors, totals (cents), Variante text, optional Sheets columns |
| `scripts/qa/conversions-check.ts` (extend) | migration (raw scan incl. exports, no cap, legacy kept, test codes deactivated, idempotent, lock), dispatch only to the validated version's ids with own tokens, test code only inside the page's window, health writes and throttle, contents incl. bump |
| `scripts/qa/pixels-publish-check.ts` (new) | library rule for editors/owners, `page.pixels_changed` audit, `publishTrackingOnly` (only tracking differs, version row, draft CAS), restore keeps tracking, duplicate sets `copiedFrom` |
| `scripts/qa/pixels-e2e.ts` (extend) | preview: no pixels chunk, no pixel host; live: only the page's ids |
| `src/lib/generator/selftest.ts` (extend) | `suggestOffers` invariants (honest, monotonic per-unit, ≤ 8, valid doc, `freeShipping: false`), picker per archetype rule, never bold + solid |
| `scripts/qa/upgrade-dry-run.ts` (new, §I.3) | deploy gate |
| Visual QA (scripts/qa/render.ts + shoot.mjs) | duo / tshirt / colors at 360, 390, 768, 1280, ar + fr, every picker and fill; reduced motion; 3 existing pages unchanged after Phase 0 |

### I.6 Rollout and file ownership
**Phase 0: Core (C0, one engineer, merges first; ~5 days).** After it the app behaves exactly as today on
existing pages; the editors still show v1 controls (switches off).
| File | Change |
|---|---|
| src/lib/page/schema.ts | Item, AssetRef.box, Money 2 decimals, OptionGroup kinds, Offer / OfferLine / LineRule / OfferVisual / OfferDisplay / ExtraGroup, Offers (extras, bump/upsell item), Tracking (`none`, `copiedFrom`), Product (story), PageDocObject v2, `PageDoc` preprocess, refinements |
| src/lib/page/upgrade.ts (new) | `upgradeDoc`, `v1ToV2`, `repairDoc` |
| src/lib/page/catalog.ts (new) | §B.2, §C.2, §C.4 (names, short, sheet label), `groupPhotos`, `visualPlan` model (pure) |
| src/lib/page/options.ts (new) | `cellKey`, `resolveCombo`, rules application, availability, field cleaning + charsets (shared by validate, render config, php spec) |
| src/lib/page/pricing.ts | §C.3 in cents (+ `bundleMath` / `defaultBundleId` aliases for one release) |
| src/lib/page/display.ts (new) | `resolveDisplay`, allowed-values table, fill auto rule (§E.1) |
| src/lib/page/validate.ts, variant-presets.ts, fixtures.ts | upgrade + repairs; new kinds; fixtures v2 + `duo`, `tshirt`, `colors` |
| src/lib/orders/{contract.ts, text.ts (new), validate.ts, resolve.ts, create.ts} | §G.1–G.4, `orderVersion`, `versionDoc` fallback, stale, `sheetPreview` |
| src/app/api/public/order/route.ts, lead route | 24 KB, dispatch, 409 stale, tolerant lead units |
| src/lib/db/schema.ts + drizzle/0003_offers_v2.sql | `OrderItems` / `OrderUnit` types, `runtime_v`, `leads.selection` |
| src/lib/db/boot-lock.ts (new), src/instrumentation.ts | `withBootLock`; checksum boot task; dry-run at boot |
| src/lib/render/publish.server.ts | refactor into `renderAndCommit(pageId, doc, { kind, label, baseVersionId? })`; writes `runtime_v`; refuses blocking render issues (`page_too_large`) |
| src/landing/runtime/config.ts | `LandingRuntimeConfig` v2 **type only** (§F.7): the LR ↔ RT contract |
| src/landing/types.ts, context.ts + mechanical compile fixes | `ctx.items`, `ctx.lead`; reads of moved fields (§B.2), no visual change |
| seams (stubs) | src/lib/pixels/checklist.ts `pixelChecks` → `[]`, spread in checklist.ts; src/components/admin/pixels/{publish-block.tsx, page-tracking-choice.tsx} stubs mounted in PublishDialog.tsx and step-directions.tsx |
| scripts/qa/{offers-check.ts, upgrade-dry-run.ts}, package.json | new tests |

**RT-0 spike (RT engineer, parallel to Phase 0, 1 day)**: prototype `units.ts` core + the three feature chunks
against the Phase 0 config type and fixtures, measure gzip, report; the lead records the budgets in §F.9.

**Phase 0 exit contract**: all types and signatures of §B.2, §C.1–C.4, §D.1, §E.1, §F.7, §G.1–G.4 exported and
frozen (changes go through C0's reviewer); `offers-check`, existing QA and the dry run on XAMPP green; visual QA
of 3 existing pages unchanged; stubs in place.

**Phase 1: parallel tracks** (each owns its files; contracts = this spec):
| Track | Owner scope (files) | Depends on |
|---|---|---|
| **PX: Pixels** (can start on day 1 for library/migration) | src/lib/settings/schemas.ts (library, health, caps); src/lib/pixels/** (library, usage.server.ts, migrate.server.ts, health.server.ts, tests.server.ts, checklist.ts, settings.ts, form.ts, summary.ts, tracking.ts); migration call in src/instrumentation.ts; settings/pixels page + actions; src/components/admin/pixels/** (pixel-library, replace-dialog, page-tracking-choice, publish-block); components/generate/tracking.tsx (removed → page-tracking-choice); SeoPanel PixelsSection; Pages list chips + "No pixel" filter (src/components/admin/pages/**); `restoreVersion` in editor/pages.server.ts + the restore checkbox in VersionsDrawer.tsx; duplicate in admin-data/pages.ts; render/publish.server.ts (library rule, audit, `publishTrackingOnly`) on top of C0's refactor; orders/conversions-core.ts + conversions.ts (windows, health, contents via `allocate`); QA conversions-check, pixels-publish-check, pixels-e2e | Phase 0 for publish refactor and contents |
| **LR: Landing render** | src/landing/offers/{model.ts, visual.tsx, labels.ts} (new); sections/orderForm/{index.tsx, packs.tsx → picker.tsx, units.tsx (replaces variants.tsx), bump, parts.tsx, copy.ts, fit.ts}; packs.css split + `packs.<picker>.css`, units.css; sections/offer/**; stickyCta, hero parts/split, cta stamp, header, guarantee split (default-offer display via the shared model); landing primitives `Picture` (box); landing/thankyou/ThankYou.tsx; landing/document.tsx (JSON-LD, chunk tags); src/lib/render/{config.ts (config v2), core.ts (feature-chunk emission, `page_too_large`), csp.ts}; src/lib/theme/blend.ts registrations | Phase 0; §F.6 / §F.7 with RT |
| **RT: Runtime** | src/landing/runtime/{units.ts (new), units-matrix.ts, units-fields.ts, fill-steps-box.ts, variants.ts (delete), bundles.ts, money.ts, form.ts, fields.ts, order-store.ts, thankyou.ts, pixels.ts, turnstile.ts, index.ts, entry*.ts, strings.ts, selftest*.ts}; scripts/build-landing-assets.mjs (entries, chunk hashes, picker CSS chunks); the WhatsApp bridge script string | Phase 0, RT-0; §F.6 / §F.7 |
| **AD: Admin editing** | src/components/admin/variants/** (matrix summary + combinations dialog, field, deltas, codes, merge/split); src/components/admin/items/** (ItemsEditor, photo wells, crop via FocalDialog box mode, duplicate, copy options); src/components/admin/offers/** (shelf, OfferEditor, contents composer, rules UI, price mode, OfferVisualField, PresetMenu, Suggest diff, DisplayPicker with combos, mini composition); builder panels OffersPanel.tsx + ProductPanel.tsx; FocalDialog; PublishDialog.tsx (gate wiring around PX's block); components/preview/editor.ts (`selectOffer`, `offerClicked`); src/lib/editor/checklist.ts; src/lib/page/features.ts; wizard {state.ts, wizard.tsx, step-details.tsx, step-offers.tsx (new), step-directions.tsx (tracking gate), parts.tsx} | Phase 0; GN presets; PX seams |
| **GN: Generator** | src/lib/page/{offer-presets.ts, charm.ts, offer-text.ts} (new); src/lib/generator/{offers.ts (new; bundles.ts deleted), directions.ts (§E.5 rule, items/offers/tracking input), remix.ts, selftest.ts}; generate/actions.ts (`GenerateInput` items/offers/display/tracking); src/lib/ai/copy-library/{types.ts, ar.ts, fr.ts, en.ts} | Phase 0 |
| **OO: Order outputs** | src/lib/sheets/{sync.ts, client.ts} (optional header columns); src/lib/orders/{admin.ts (CSV), leads.ts (selection), upsell.ts (Variante update)}; src/lib/admin-data/orders.ts; components/admin/orders/** (drawer, view, leads panel + export); src/lib/export/{php.ts, templates/order.php, whatsapp.ts}; scripts/qa/php-parity.ts | Phase 0 (`text.ts`) |
Shared-file rule: `src/lib/db/schema.ts`, `schema.ts` (page), `text.ts` and `contract.ts` belong to C0; any
Phase 1 edit there goes through C0's reviewer. `publish.server.ts` belongs to PX in Phase 1 (LR reports blocking
render issues through `core.ts`, never edits publish). `checklist.ts` belongs to AD (PX ships `pixelChecks`).
Merge order inside Phase 1: PX any time; RT + LR land together (shared markup contract and fixtures); OO before
AD flips `MULTI_ITEM` / `RULES` / `BUMP_ITEM`; AD + GN last.

**Phase 2: Integration (~3 days)**: all of §I.5; manual COD run on XAMPP (live page, a republish with an open old
tab, pixels-only update, connected export, PHP export, WhatsApp export) for duo, tshirt and colors; Sheets row
check incl. optional columns; dry run on a production dump; Hostinger staging deploy; docs (ARCHITECTURE,
SECTIONS, DESIGN, DEPLOY-HOSTINGER). Flip the feature switches.

**Phase 3: later, opt-in** (PX + OO, after one production cycle): per-page `tracking.purchaseOn: "order" |
"confirmed"` (default "order"). With "confirmed", the thank-you page fires no browser Purchase and the server sends
Purchase (event id = order id) when the order reaches `confirmed` (admin or Sheets status pull) within 7 days.
Needs `orders.match` (encrypted fbp, fbc, ttp, IP, UA; purged after 8 days), which orders do not store today.

### I.7 Cleanup release (after one production cycle)
Remove: the legacy secret fields, setting `pixels`, `pixels: "chosen"`, `bundleMath` / `defaultBundleId` /
`Bundle` aliases, `generator/bundles.ts`. Keep forever: `upgradeDoc` + `repairDoc` (versions are v1 JSON), payload
v1 (exports, old tabs), `orderUnits` v1 path.

---

## J. Appendix

### J.1 Limits
| Thing | Limit |
|---|---|
| items per page | 1–8 (items[0] = lead) |
| photos per item | 8 |
| groups per item | 4, of which ≤ 2 fields and ≤ 1 matrix |
| options per choice group | 1–40 |
| matrix | 2–3 dims, ≤ 24 values per dim, ≤ 240 combinations, ≤ 240 exception cells |
| per page | Σ options + dim values ≤ 200 · Σ matrix cells ≤ 300 · option/value/cell photos ≤ 48 |
| field | 1–60 characters (default 24); number 0–1 000 000 |
| price delta | 0–100 000 (no negatives); none on required fields |
| offers per page | 1–8 |
| lines per offer | 1–6; qty 1–20; units ≤ 20; choices 2–8; rules ≤ 3 |
| offer texts | short ≤ 14 · title ≤ 60 · subtitle ≤ 90 · perks 3 × 40 |
| page extras | 0–4 groups |
| custom visual photos | 1–4 |
| pixels per page | Meta 3, TikTok 3, Snap 1, GA4 1 (unchanged) |
| pixel library | 100 added in the UI (schema 200) · 5 test windows per pixel · ≤ 120 min |
| order body | 24 KB |
| order text | 1000 characters (Sheets / CSV); WhatsApp URL ≤ 3800 encoded; leads.selection 400 |
| page | HTML ≤ 400 KB · `#lp-config` ≤ 24 KB |
| stale window | 72 h after a version is replaced |

### J.2 Field error codes (server → runtime)
| Key | Codes | Runtime message (server-rendered `data-msg*`) |
|---|---|---|
| (top level) | `stale` | reload + "L'offre a été mise à jour, vérifiez votre choix" |
| `bundleId` | invalid, unavailable | generic / "Cette offre n'est plus disponible" |
| `u.<k>.@item` | required, invalid, unavailable, duplicate | "Choisissez l'article" / gone / "Choisissez un article différent" |
| `u.<k>.<gid>`, `s.<itemId>.<gid>`, `x.<gid>`, `b.<gid>` | required, invalid, unavailable, too_long | "Choisissez votre taille" / "Lettres uniquement" / "Épuisé depuis l'ouverture de la page" / "12 caractères maximum" |
| `v.<k>.<gid>`, `v.<gid>` | v1 payloads only | as today |
| name, phone, city, address, email | as today | as today |

### J.3 New landing microcopy (orderForm/copy.ts `inLocale`, all 8 locales; the runtime reads them from markup)
`offer.choice` Au choix · `offer.anyN` {n} au choix · `offer.duo` Duo · `offer.trio` Trio · `offer.or` ou ·
`offer.free` Offert · `offer.from` Dès {price} · `offer.soldOut` Épuisé · `offer.contents` Contenu du pack ·
`unit.head` Pièce {n} · `unit.itemHead` {item} · {j} · `unit.choiceHead` Au choix · {j} · `unit.chooseItem`
Choisissez l'article · `unit.forAll` Pour vos {n} {item} · `unit.prefilled` = pièce 1 · `unit.edit` Modifier ·
`unit.next` Suivant · `unit.prev` Précédent · `field.optionalPrice` (optionnel · +{price}) · `err.tooLong` {max}
caractères maximum · `err.duplicate` Choisissez un article différent · `err.letters` Lettres uniquement ·
`err.digits` Chiffres uniquement · `err.range` Entre {min} et {max} · `sum.otherOptions` Autres options ·
`matrix.none` indisponible · `matrix.switched` {dim} changée : {value} · `matrix.conflict` {value} n'existe pas en
{other}, choisissez {dim} · `stale` L'offre a été mise à jour, vérifiez votre choix · `delivery.allFree` Livraison
gratuite. Arabic forms follow the existing Darija-friendly register (e.g. `unit.chooseItem` اختار المنتج,
`offer.free` هدية, `offer.or` أو, `offer.from` من {price}).

### J.4 Owner-visible behaviour changes (veto list)
1. Every new page needs an explicit pixel answer (pixels or "No pixel"); "Apply to pages" disappears; publishing a
   page without pixels asks "Publish without pixels".
2. A pixel gets server events only with its own token (current ones are migrated and shown "unverified" until a
   test event or order succeeds).
3. Test codes no longer apply by themselves: test mode is per page, ≤ 2 h. Saved test codes are deactivated at
   migration (production events stop being test-coded).
4. Only owners add new pixel ids; editors pick from the library.
5. Restoring a version keeps the page's current pixels (opt-in to restore them).
6. `freeShipping` on an offer really removes the fee; pages with fee 0 show "Livraison gratuite" for every offer.
7. Cards show "Dès" when choices can cost more; multi-item pages show the default offer in the hero and sticky bar.
8. Per-unit price only on same-item packs, rounded to whole dirhams on MAD pages.
9. Item choosers and text options start empty and required; later pieces prefill from piece 1 ("= pièce 1").
10. Sheets Variante text changes (markers, « », codes, numeric prefix, "|| Commande"); the 13 columns stay;
    "SKU / Articles / Livraison / Prix pack" columns fill only if the owner adds those headers.
11. Gift items not sold on the page no longer count in savings.
12. An item in a choice line without its own photo blocks publishing (crop it from the group photo).
13. Up to 8 offers (was 5) and 4 option groups per item (was 3).

---

## K. Review decisions

Every review point, in review order. "Accepted" = in the spec as asked (section given). "Changed" = accepted
with a different mechanism (one-line reason). "Rejected" = not done (one-line reason).

### K.1 cod-ops (COD operator view)
| # | Point | Decision |
|---|---|---|
| 1 | Page can go live with no pixel | Accepted: required wizard answer, `tracking.none`, checklist item, "Publish without pixels", browser-only info (§A.2, §A.4). |
| 2 | Swapping a pixel forces a full publish | Accepted: `publishTrackingOnly`, `applyLiveTrackingAction`, "Replace on pages…" with live update on by default (§A.3, §A.4). Changed: permission pages.publish (it publishes), and a new id needs settings.write (engineering #8). |
| 3 | Test mode leaks across pages | Accepted: per-page, time-boxed windows, expired ignored, chips with time left, codes deactivated at migration. Changed: windows live in the library entry (no new table), and `pageId` is required; a store-wide window would recreate the leak, and "Send test event" covers pixel-level tests (§A.2, §A.5). |
| 4 | Non-catalog gift never reaches the order | Accepted: `OrderItems.gift`, `CADEAU :` part, WhatsApp bullet, drawer badge, order.php (§G.3–G.6). |
| 5 | Sheets / WhatsApp text ambiguous | Accepted: « » for fields, `\|\| Commande :` segment, `[OFFERT]` before the part, numeric prefix, empty parts dropped, separator sanitizing, `Choice.code`, `short` defaults to the name with a live Sheets preview. Changed: a free part with nothing else prints `[OFFERT] n pièce(s)` rather than vanishing, because a custom offer title would hide the free piece (engineering #13) (§G.4, §D.1, §B.1). |
| 6 | Choice base moves when an item sells out | Accepted: base and reference on the declared list; availability only for what can be picked; tests added (§C.3, §I.5). |
| 7 | Card / hero prices don't match what is paid | Accepted: "Dès", per-unit only for same-item packs, hero/sticky show the default offer (§C.3, §B.2). Changed: per-unit rounds to the nearest whole dirham, not down; rounding a price indication down understates it (EU price-indication risk later). |
| 8 | Offers can't lock or restrict options | Accepted as `rules` (lock / allow + preset / preset), keyed by group or matrix dim, ≤ 3, server-filled locks, in config and PHP. Changed: fixed-item lines only, because on a choice line the item varies and a group key would be ambiguous (§C.1). |
| 9 | One photo shows both products | Accepted: crop promoted to Phase 1 (LR + AD), wizard "Crop {item} from this photo", group photos skipped as an item's own visual, publish error for choice items without own photo. Changed: no `product.images[i].shows`; group photos are derived from item photo wells (ux #10), one source of truth (§B.4). |
| 10 | Multi-unit fill too slow on mobile | Accepted: prefill from piece 1 with "= pièce 1" (default, replaces "Même choix"), collapse of complete units, steps only from 5 units. Changed: on a matrix conflict the other dim switches only when exactly one value completes a combination, otherwise it is cleared; guessing a color risks a refused parcel (§F.4, §E.1). |
| 11 | Abandoned leads lose the selection | Accepted: tolerant `units` / `extras` in `LeadPayload`, `leads.selection` (400), leads panel and export (§G.1, §I.2). |
| 12 | Bump and upsell are plain text | Accepted: `orderBump.item`, `upsell.item`, bump unit body, contents/SKU include it, upsell "options à confirmer". Changed: marker `[AJOUT]` / `[UPSELL]` instead of "(bump)" (call-center wording, same style as `[OFFERT]`), and bump options add no deltas because the bump price is the price shown on the checkbox (§C.1, §G). |
| 13 | Restore and duplicate change pixels | Accepted: restore keeps tracking with opt-in, duplicate sets `copiedFrom` with note + checklist info (§A.4). |
| 14 | Status chip doesn't show delivery | Accepted: `pixel_health`, throttled writes, "unverified" after migration (§A.2, §A.5, §A.6). |
| 15 | Free delivery inconsistent at fee 0 | Accepted: `effectiveFree`, toggle hidden at fee 0 (§C.3). |
| 16 | Never-sold free item inflates savings | Accepted: counts only when sold in a paid line of an available offer, warning (§C.3). |
| 17 | SKUs for warehouses | Accepted: header-driven optional columns, null cells in the append so call-center columns stay untouched, mirrored in order.php (the project has no gsheets.php; Sheets lives in order.php) (§G.4). |
| 18 | Editor and display hard to read | Accepted: `offerSentence`, preset tiles first, combos, UI names Offer layout / Personalization layout / Selected style. Changed: combos use the final names (Boutique = visual / box / soft, Compact = stack compact / steps / outline) (§E.1, §H.4). |
| 19 | Per-page Purchase on order vs confirmed | Accepted as Phase 3, opt-in: it needs encrypted match keys (fbp, fbc, IP, UA) kept ≤ 8 days, which orders don't store today (§I.6). The review text was cut after the default; the rest is decided there. |

### K.2 engineering
| # | Point | Decision |
|---|---|---|
| 1 | Open tabs validated against the new version | Accepted: `ver` + `st`, 72 h window, `runtime_v`, `stale` + reload with form kept, `orders.versionId` = version used, server events use that version's ids (§G.1, §G.2, §I.2). |
| 2 | New schema rule stops live pages | Accepted: deterministic repairs in `upgradeDoc` for every v1-breakable rule, dry-run deploy gate, `versionDoc` repair fallback. Also: no reserved group id at all (`@item` control name), so no v1 group rename is needed (§I.1, §I.3, §F.6). |
| 3 | `z.union` misroutes payloads | Accepted: dispatch on `v`, `units/extras: z.undefined()` on V1, path → key mapping, PHP mirror (§G.1). |
| 4 | Advertised price impossible to pay | Accepted: `from` = cheapest payable selection on availability; required fields can't carry a delta; shared deltas per paid unit, shared field once; free gift rule; property test. Changed: the surcharge base uses the declared list (cod-ops #6, margin), while `from` uses availability, so both hold; a group where every option has a delta is allowed and shown as "Dès + min" instead of forbidden (§C.3). |
| 5 | Delivery-fee trap | Accepted: effective free mark, `freeShipping: false` from upgrade/presets/generator, fee-change notice. Changed: "fee > 0 and every offer free" is a checklist warning, not an error; after the upgrade it can only be an explicit owner choice (§C.3, §H.4). |
| 6 | Float money in four places | Accepted: `Money` ≤ 2 decimals, cents in TS / runtime / PHP, `orderTotals(doc, selection)`, largest-remainder allocation with equal split, rounded unit price, WhatsApp bridge formats runtime totals and joins the parity corpus (§C.3, §G.5, §G.6). |
| 7 | Pixel migration drops server events | Accepted: raw scan incl. exports, no cap, legacy kept until cleanup, `GET_LOCK`, marker last (§A.6). |
| 8 | Per-page pixels widen a PII path | Accepted: owners-only new ids, publish refusal, `page.pixels_changed` audit, no id rename, detached entries and secrets kept while any draft, live page or export still uses the id (§A.3). |
| 9 | `page_pixels` unreliable | Accepted: table and its hooks dropped; scan + 30 s cache (§A.2). |
| 10 | Nothing bounds page size | Accepted: page caps, publish checks (24 KB config, 400 KB HTML, 48 photos), per-page feature chunks, budgets from the RT-0 spike (§F.9, §J.1, §I.6). |
| 11 | Matrix design gaps | Accepted: cells keyed by value ids with wildcards and specificity, limits 40 / 24 / 240, merge disabled with reason; repair never turns a sold-out exception back into sellable (§D.1, §D.5, §I.1). |
| 12 | Options that depend on the offer | Accepted, merged with cod-ops #8 / ux #11 as `rules` incl. `preset` (§C.1). |
| 13 | Order storage and text gaps | Accepted: fields in compat `variants`, empty separators dropped, free count, « », 1000 cap on whole parts, WhatsApp URL cap, §D.4 wording fixed (§G.3–G.5, §D.4). |

### K.3 ux (premium builder design)
| # | Point | Decision |
|---|---|---|
| 1 | Fill separated from the offer; auto jumps | Accepted: fills auto / inline / rows / steps / box, page-level auto, "Contenu du pack" line, unit heads with item ordinals (§E.1, §F.1–F.3). |
| 2 | Offer editor follows the data model | Accepted: products shelf + New product, contents composer, sentence, Total / Discount %, Duplicate, Suggest offers with per-offer accept, two-way selection (§H.4). |
| 3 | Owner's example breaks visually | Accepted: aspect-ratio cells, contain rule, group photos never cover-cropped, lead + side, custom visuals never swap, fan of 4, render-check fixture (§E.6). |
| 4 | Pixels without a safety net | Accepted: tracking on the last wizard step, publish dialog diff and warning, Pages chips + filter, per-page time-boxed test, migration labels, purchaseOn later. Changed: test windows stored in the library entry, not a `page_pixel_tests` table (engineering #9: no extra index to keep in sync) (§A). |
| 5 | Matrix states, stranding, editor fit | Accepted: in / out / none, struck-but-selectable, linked / combined (combined by default ≤ 8), summary + wide dialog, split (§D, §F.4). Conflict handling merged with cod-ops #10. |
| 6 | Too many layout knobs | Accepted: 5 pickers, visual takes the gallery anatomy, list = stack compact, allowed-values table, disabled invalid values, fallback notes, recommended tile, multi-item anatomy, `Offer.short` (§E.1, §E.2). |
| 7 | Solid on the bold slab; orange blends | Accepted: ink fill on the bold slab, generator never pairs them, accent-ink savings chip, blend registrations with a failing check, admin chip tokens (§E.3, §E.5, §A.4). |
| 8 | Price honesty on cards, summary, hero | Accepted: "Dès", "+50 DH" chips, "(optionnel · +30 DH)", reason rows, default offer in hero/sticky, short names in teasers (§C.3, §B.2). |
| 9 | Item naming and content ids | Accepted: names with 2+ items, `contentIdOf` by `item.id === "main"` (frees reordering: "Make main" becomes plain reorder + "Show first"), unchosen = first available, Duplicate item, Copy options (§B, §G.7, §H.3). |
| 10 | Photo-first tagging | Accepted: item photo wells, derived group photos (§B.4, §H.2). |
| 11 | Lines can't fix or restrict options | Accepted as `rules`. Changed: a locked value shows as a static chip in the unit (not hidden) so each piece says what it is, and in the contents line (§C.1, §F.2). |
| 12 | Extras copied per offer; no perks | Accepted: page-level `extras` with scope (per-offer extras removed), `orderBump.offers`, `perks` (§C.1). |
| 13 | Free delivery at fee 0 | Accepted (same as cod-ops #15); the cut-off text is read as "toggle only when the fee is > 0" (§C.3, §H.4). |
