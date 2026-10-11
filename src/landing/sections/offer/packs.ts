/**
 * Display model of the bundles for the offer showcase. All math goes through bundleMath(): the
 * struck reference and the savings exist only for a genuine saving, and their labels follow
 * offers.showSavings / showPerUnit. Kept local to this section so the showcase never depends on
 * another section's internals.
 */
import { bundleMath, defaultBundleId, type BundleMath } from "@/lib/page/pricing";
import type { RenderContext, ResolvedAsset } from "../../types";

export type BadgeKind = "popular" | "best" | "custom";

export interface Pack {
  id: string;
  index: number;
  qty: number;
  m: BundleMath;
  /** merchant title, else the localized quantity ("2 pièces") */
  name: string;
  /** `name` is the merchant title (the quantity then shows as a meta line) */
  titled: boolean;
  /** "2 pièces" / "قطعتين" */
  qtyLabel: string;
  subtitle?: string;
  badge?: { kind: BadgeKind; text: string };
  /** formatted genuine reference — only when there is a real saving */
  reference?: string;
  /** "soit 134,50 DH / pièce" (packs of 2+ when offers.showPerUnit) */
  perUnit?: string;
  /** "134,50 DH" — the bare per-unit amount, for field layouts */
  unitPrice?: string;
  /** "−20%" per offers.showSavings */
  savePct?: string;
  /** "Économisez 88 DH" per offers.showSavings */
  saveAmount?: string;
  /** "88 DH" — the bare amount saved, for field layouts (same visibility as saveAmount) */
  saveMoney?: string;
  freeShipping: boolean;
  gift?: { label: string; asset: ResolvedAsset | null };
  /** merchant photo of the pack itself */
  image: ResolvedAsset | null;
  /**
   * the form's preselected pack (defaultBundleId). Not rendered as [data-selected]: the runtime sets
   * that itself (base.css reads a selected card as a sign of runtime life for its reveal failsafe).
   */
  selected: boolean;
}

export function packsOf(ctx: RenderContext): Pack[] {
  const { offers, product } = ctx;
  const first = defaultBundleId(offers);
  const mode = offers.showSavings;
  return offers.bundles.map((b, index) => {
    const m = bundleMath(b, product.price);
    const title = b.title?.trim();
    const save = m.showReference && mode !== "none";
    const withPct = save && (mode === "percent" || mode === "both");
    const withAmount = save && (mode === "amount" || mode === "both");
    const badgeText =
      b.badge === "popular"
        ? ctx.t("bundle.popular")
        : b.badge === "best"
          ? ctx.t("bundle.best")
          : b.badge === "custom"
            ? (b.badgeText?.trim() ?? "")
            : "";
    const giftLabel = b.gift?.label.trim();
    const unit = offers.showPerUnit && b.qty > 1;
    return {
      id: b.id,
      index,
      qty: b.qty,
      m,
      name: title || ctx.t("bundle.qty", { n: b.qty }),
      titled: !!title,
      qtyLabel: ctx.t("bundle.qty", { n: b.qty }),
      subtitle: b.subtitle?.trim() || undefined,
      badge: badgeText && b.badge !== "none" ? { kind: b.badge, text: badgeText } : undefined,
      reference: m.showReference ? ctx.money(m.reference) : undefined,
      perUnit: unit ? ctx.t("bundle.perUnit", { price: ctx.money(m.perUnit) }) : undefined,
      unitPrice: unit ? ctx.money(m.perUnit) : undefined,
      savePct: withPct ? ctx.t("bundle.savePct", { pct: m.savingsPct }) : undefined,
      saveAmount: withAmount ? ctx.t("bundle.save", { amount: ctx.money(m.savings) }) : undefined,
      saveMoney: withAmount ? ctx.money(m.savings) : undefined,
      // pricing charges offers.shippingFee on every order: "free delivery" is only true when it is 0
      freeShipping: b.freeShipping && offers.shippingFee <= 0,
      gift: giftLabel ? { label: giftLabel, asset: ctx.asset(b.gift?.image) } : undefined,
      image: ctx.asset(b.image),
      selected: b.id === first,
    };
  });
}

/** Every pack ships free → say it once under the packs instead of on every card. */
export const allFree = (packs: readonly Pack[]) => packs.length > 0 && packs.every((p) => p.freeShipping);

/**
 * The pack raised as the favourite: the "popular" one, else the pack preselected in the form.
 * None for a lone pack (nothing to compare it with).
 */
export function featuredOf(packs: readonly Pack[]): string | null {
  if (packs.length < 2) return null;
  return packs.find((p) => p.badge?.kind === "popular")?.id ?? packs.find((p) => p.selected)?.id ?? null;
}
