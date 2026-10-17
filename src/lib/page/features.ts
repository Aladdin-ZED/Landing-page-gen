/**
 * Feature switches of Offers v2 (docs/OFFERS.md §H.5). They gate ONLY the editors (generate wizard
 * and builder), so tracks can merge before the renderer / runtime parts land: the schema, the server
 * and the renderer accept everything from Phase 0. All ON since Phase 2 (integration verified); the override can still only switch features on.
 *
 * QA / staging override (build time, no code change): `NEXT_PUBLIC_OFFERS_FEATURES=all` switches
 * every editor feature on, `NEXT_PUBLIC_OFFERS_FEATURES=MULTI_ITEM,MATRIX` only those. Next inlines
 * NEXT_PUBLIC_ variables in client bundles, so the wizard and the builder agree with the server.
 */
const DEFAULTS = {
  /** several items per page, choice lines, combos, gifts from the catalog */
  MULTI_ITEM: true,
  /** combined options (color × size) */
  MATRIX: true,
  /** custom typed fields ("name to print") */
  FIELDS: true,
  /** surcharges on options, combinations and fields */
  PRICE_DELTAS: true,
  /** per-line option rules (lock / allow / preset) */
  RULES: true,
  /** order bump as a catalog item */
  BUMP_ITEM: true,
  /** personalization layouts beyond the v1 rows (inline, steps, box) */
  NEW_FILLS: true,
  /**
   * per-page pixels in the editors (§A.4): the wizard's required "Ad tracking for this page" answer
   * (PX's PageTrackingChoice) gates "Create page". Off: the Details step keeps the store-pixel ticks.
   */
  PAGE_PIXELS: true,
} as const;

export type Feature = keyof typeof DEFAULTS;

function overrides(): ReadonlySet<string> {
  // a literal `process.env.NEXT_PUBLIC_…` read: Next inlines it in client bundles
  const raw = (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OFFERS_FEATURES : undefined) ?? "";
  const list = raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  return new Set(list.includes("ALL") ? Object.keys(DEFAULTS) : list);
}

const ON = overrides();

/** The switches as this build sees them (defaults + the NEXT_PUBLIC_OFFERS_FEATURES override). */
export const FEATURES: Readonly<Record<Feature, boolean>> = Object.fromEntries(
  (Object.keys(DEFAULTS) as Feature[]).map((k) => [k, DEFAULTS[k] || ON.has(k)]),
) as Record<Feature, boolean>;

/** Is an editor feature switched on? */
export function feature(name: Feature): boolean {
  return FEATURES[name];
}
