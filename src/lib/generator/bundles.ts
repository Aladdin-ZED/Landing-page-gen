/**
 * @deprecated one release (docs/OFFERS.md §I.7): the generator's offers live in ./offers.ts and the
 * shared suggestions in src/lib/page/offer-presets.ts (`suggestOffers`). This alias keeps the v1
 * import path (`suggestBundles`, `BundleText`) working until the cleanup release deletes it.
 */
export { suggestBundles, type BundleText } from "./offers";
