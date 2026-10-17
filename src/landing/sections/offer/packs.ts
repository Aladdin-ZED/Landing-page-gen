/**
 * Display model of the offers for the offer showcase: the shared model (src/landing/offers/model.ts,
 * docs/OFFERS.md §E.7) — the same numbers, names and contents as the order form picker. All money
 * goes through the pricing core: the card price is `from` ("Dès" when the choices can cost more),
 * the struck reference and the savings exist only for a genuine saving, and their labels follow
 * offers.showSavings / showPerUnit.
 */
import { allFree, featuredOf, offerViews, type BadgeKind, type OfferView } from "../../offers/model";
import type { RenderContext } from "../../types";

export type { BadgeKind };
export type Pack = OfferView;
export { allFree, featuredOf };

/**
 * The offers the showcase presents, in page order: offers that cannot be ordered right now are left
 * out (a tap would preselect a sold-out pack), unless every offer is sold out.
 */
export function packsOf(ctx: RenderContext): Pack[] {
  const views = offerViews(ctx);
  const open = views.filter((v) => !v.soldOut);
  return open.length ? open : views;
}
