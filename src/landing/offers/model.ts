/**
 * The shared display model of a page's offers (docs/OFFERS.md §E, §E.7, §B.2 "multi-item pages"):
 * one `OfferView` per offer, computed once from the pricing core (integer cents, src/lib/page/pricing.ts)
 * and read by every surface that shows an offer — the order form picker, the offer section, the
 * split panel, the sticky bar, the hero, the CTA stamp, the header and the guarantee split.
 *
 *   offerViews(ctx)        every offer, page order (memoized per render context)
 *   defaultOfferView(ctx)  the offer selected on first paint (defaultOfferId)
 *   allFree / bestSaving / featuredOf   page-level facts the sections share
 *
 * Money rules (never invented): the card price is `from` (the lowest payable total of the units,
 * "Dès" when choices can cost more), the struck price is `displayReference` and only for a genuine
 * saving, the per-unit price only on same-item packs (rounded to whole units on MAD pages),
 * delivery marks use `effectiveFree`. Pure: no hooks, no randomness.
 */
import { defaultOfferId, isLegacyOffer, itemShort, offerAvailable, offerCustomImage, offerName, offerShort, offerUnits, visualPlan, type VisualPlan } from "@/lib/page/catalog";
import { bundleMath, effectiveFree, fromCents, offersMath, type BundleMath, type OfferMath } from "@/lib/page/pricing";
import { isChoiceGroup, isFixedPick, isMatrixGroup, type Item, type LineRule, type Offer } from "@/lib/page/schema";
import { offerNameT, offerWord } from "../sections/orderForm/copy";
import type { RenderContext, ResolvedAsset } from "../types";

export type BadgeKind = "popular" | "best" | "custom";

/** One part of an offer's contents ("2 × Jour", "Noir", "Jour ou Nuit", "Sérum · Offert"). */
export interface ContentPart {
  /** item short names, or the locked / allowed option labels on single-item pages; "" = the product itself */
  label: string;
  qty: number;
  free: boolean;
  /** a choice line: `label` lists the items the shopper picks from */
  choice: boolean;
  /** the item of a fixed line */
  item?: string;
}

export interface OfferView {
  id: string;
  index: number;
  offer: Offer;
  /** units (Σ line.qty, free units included) */
  qty: number;
  /** pricing core numbers, integer cents */
  math: OfferMath;
  /** the same in currency units (v1 shape: total = the card price `from`) */
  m: BundleMath;
  /** merchant title, else the automatic name ("2 pièces", "Jour + Nuit", "Au choix") */
  name: string;
  /** `name` is the merchant title */
  titled: boolean;
  /** segment / tab label (≤ 14): "×2", "Duo", "Au choix" */
  short: string;
  /** a v1-shaped offer (one paid line of the lead item): the quantity tells everything */
  legacy: boolean;
  /** every unit is the same item: the ×n numeral is an honest visual */
  sameItem: boolean;
  /** "x2" / "×2" */
  x: string;
  /** "2 pièces" */
  qtyLabel: string;
  subtitle?: string;
  perks: string[];
  badge?: { kind: BadgeKind; text: string };
  /** the card price (`from`), formatted */
  total: string;
  /** choices can cost more: the price reads "Dès {price}" */
  variable: boolean;
  /** "Dès" (only when `variable`) */
  fromWord?: string;
  /** struck reference — only for a genuine saving */
  reference?: string;
  /** "soit 134,50 DH / pièce" (same-item packs, offers.showPerUnit) */
  perUnit?: string;
  /** the per-unit amount alone */
  unit?: string;
  /** alias of `unit` (offer section) */
  unitPrice?: string;
  savePct?: string;
  saveAmount?: string;
  /** the saved amount alone */
  saved?: string;
  /** alias of `saved` (offer section) */
  saveMoney?: string;
  /** no delivery fee with this offer (effectiveFree) */
  freeShipping: boolean;
  gift?: { label: string; asset: ResolvedAsset | null };
  /** the owner's first custom visual photo, resolved */
  image: ResolvedAsset | null;
  /** selected on first paint (defaultOfferId) */
  selected: boolean;
  /** cannot be ordered right now (radio disabled, "Épuisé" pill) */
  soldOut: boolean;
  /** composition model of the offer visual (§E.6) */
  plan: VisualPlan;
  /** 2+ distinct items, a choice line or a custom visual: the offer is best told by its picture */
  imageLed: boolean;
  /** contents, lines in order (paid first, then free) */
  contents: ContentPart[];
  /** "Crème jour + Crème nuit + Sérum éclat · Offert" — "" when the name already says it all */
  contentsText: string;
}

const viewsCache = new WeakMap<RenderContext, OfferView[]>();

/**
 * Every unit of the offer is the same item, or every line is a paid choice among the same items: a
 * per-unit price is honest only then (a free piece of another item would make "75 DH / pièce" lie).
 */
export function samePieces(offer: Pick<Offer, "lines">): boolean {
  const ids = new Set(offer.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : "")));
  if (ids.size === 1 && !ids.has("")) return true;
  const first = offer.lines[0]?.pick;
  const set = first && !isFixedPick(first) ? [...first.choice].sort().join("|") : null;
  return set !== null && offer.lines.every((l) => !l.free && !isFixedPick(l.pick) && [...l.pick.choice].sort().join("|") === set);
}

/** Option labels a line rule locks / allows on its item (single-item pages describe a piece by them). */
function ruleLabels(item: Item | undefined, rules: Readonly<Record<string, LineRule>> | undefined, sep: string): string[] {
  if (!item || !rules) return [];
  const out: string[] = [];
  for (const [key, rule] of Object.entries(rules)) {
    const [gid, dimId] = key.split(".");
    const g = item.groups.find((x) => x.id === gid);
    if (!g) continue;
    const values = isChoiceGroup(g) ? g.options : isMatrixGroup(g) ? (g.dims.find((d) => d.id === dimId)?.values ?? []) : [];
    const label = (id: string) => values.find((v) => v.id === id)?.label;
    if ("lock" in rule) {
      const l = label(rule.lock);
      if (l) out.push(l);
    } else if ("allow" in rule) {
      const ls = rule.allow.map(label).filter((x): x is string => !!x);
      if (ls.length) out.push(ls.join(sep));
    }
  }
  return out;
}

/** The contents of an offer, lines in order (paid first, then free). */
export function offerContents(ctx: RenderContext, offer: Offer): ContentPart[] {
  const multi = ctx.items.length > 1;
  const or = ` ${offerWord(ctx.locale, "or")} `;
  const byId = new Map(ctx.items.map((it) => [it.id, it]));
  const short = (id: string) => {
    const it = byId.get(id);
    return it ? itemShort(ctx.doc, it) : id;
  };
  const ordered = [...offer.lines.filter((l) => !l.free), ...offer.lines.filter((l) => l.free)];
  return ordered.map((l) => {
    if (isFixedPick(l.pick)) {
      const it = byId.get(l.pick.item);
      const opts = ruleLabels(it, l.rules, or);
      const base = multi ? short(l.pick.item) : "";
      const label = [base, opts.join(" / ")].filter(Boolean).join(" · ");
      return { label, qty: l.qty, free: l.free, choice: false, item: l.pick.item };
    }
    return { label: l.pick.choice.map(short).join(or), qty: l.qty, free: l.free, choice: true };
  });
}

/** "2 × Jour + Nuit + Sérum · Offert"; "" when there is nothing more to say than the quantity. */
export function contentsLine(ctx: RenderContext, parts: readonly ContentPart[], offer: Offer, legacy: boolean): string {
  if (legacy) return "";
  const free = offerWord(ctx.locale, "free");
  const anyN = (n: number) => offerWord(ctx.locale, n > 1 ? "anyN" : "choice", { n });
  const out: string[] = [];
  for (const p of parts) {
    let s = p.label || (p.free ? "" : ctx.t("bundle.qty", { n: p.qty }));
    if (p.choice) s = `${anyN(p.qty)} : ${p.label}`;
    else if (p.label && p.qty > 1) s = `${ctx.num(p.qty)} × ${p.label}`;
    if (p.free) s = s ? `${s} · ${free}` : `${ctx.t("bundle.qty", { n: p.qty })} · ${free}`;
    if (s) out.push(s);
  }
  const text = out.join(" + ");
  // an automatic name already lists the contents: say it once
  return !offer.title?.trim() && text === offerName({ doc: ctx.doc, t: offerNameT(ctx.locale) }, offer) ? "" : text;
}

/** Display model of every offer, in page order (computed once per render context). */
export function offerViews(ctx: RenderContext): OfferView[] {
  const hit = viewsCache.get(ctx);
  if (hit) return hit;
  const { offers, doc } = ctx;
  const first = defaultOfferId(offers, ctx.items);
  const mode = offers.showSavings;
  const maths = offersMath(doc);
  const nameCtx = { doc, t: offerNameT(ctx.locale) };
  const lead = ctx.items[0]?.id;
  // MAD pages show whole dirhams per unit (§C.3: rounded to the nearest, never down)
  const wholeUnits = doc.currency === "MAD";
  const views = offers.bundles.map((b, index): OfferView => {
    const math = maths[index]!;
    const m = bundleMath(doc, b);
    const qty = offerUnits(b);
    const title = b.title?.trim();
    const legacy = isLegacyOffer(doc, b);
    const items = new Set(b.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : "")));
    const sameItem = items.size === 1 && !items.has("");
    const save = math.showReference && mode !== "none";
    const withPct = save && (mode === "percent" || mode === "both");
    const withAmount = save && (mode === "amount" || mode === "both");
    // per-unit only on same-item packs (§C.3, J.4 #8): a gift of another item is never "75 DH / pièce"
    const same = samePieces(b);
    const per = offers.showPerUnit && qty > 1 && math.perUnit !== null && same ? math.perUnit : null;
    const perAmount = per === null ? null : wholeUnits ? Math.round(per / 100) : fromCents(per);
    const badgeText =
      b.badge === "popular" ? ctx.t("bundle.popular") : b.badge === "best" ? ctx.t("bundle.best") : b.badge === "custom" ? (b.badgeText?.trim() ?? "") : "";
    const giftLabel = b.gift?.label.trim();
    const plan = visualPlan(doc, b);
    const distinct = new Set(plan.tiles.flatMap((t) => (t.kind === "item" ? [t.item] : t.items)));
    const imageLed = b.visual.mode === "custom" || plan.tiles.some((t) => t.kind === "choice") || distinct.size >= 2 || (distinct.size === 1 && !distinct.has(lead ?? ""));
    const contents = offerContents(ctx, b);
    const unit = perAmount === null ? undefined : ctx.money(perAmount);
    const saved = withAmount ? ctx.money(fromCents(math.savings)) : undefined;
    return {
      id: b.id,
      index,
      offer: b,
      qty,
      math,
      m,
      name: title || offerName(nameCtx, b),
      titled: !!title,
      short: offerShort(nameCtx, b),
      legacy,
      sameItem,
      x: ctx.t("bundle.x", { n: qty }),
      qtyLabel: ctx.t("bundle.qty", { n: qty }),
      subtitle: b.subtitle?.trim() || undefined,
      perks: b.perks.map((p) => p.trim()).filter(Boolean),
      badge: badgeText && b.badge !== "none" ? { kind: b.badge, text: badgeText } : undefined,
      total: ctx.money(fromCents(math.from)),
      variable: math.variable,
      fromWord: math.variable ? offerWord(ctx.locale, "fromWord") : undefined,
      reference: math.showReference ? ctx.money(fromCents(math.displayReference)) : undefined,
      perUnit: unit ? ctx.t("bundle.perUnit", { price: unit }) : undefined,
      unit,
      unitPrice: unit,
      savePct: withPct ? ctx.t("bundle.savePct", { pct: math.savingsPct }) : undefined,
      saveAmount: saved ? ctx.t("bundle.save", { amount: saved }) : undefined,
      saved,
      saveMoney: saved,
      freeShipping: effectiveFree(doc, b),
      gift: giftLabel ? { label: giftLabel, asset: ctx.asset(b.gift?.image) } : undefined,
      image: ctx.asset(offerCustomImage(b)),
      selected: b.id === first,
      soldOut: !offerAvailable(b, ctx.items),
      plan,
      imageLed,
      contents,
      contentsText: contentsLine(ctx, contents, b, legacy),
    };
  });
  viewsCache.set(ctx, views);
  return views;
}

/** The offer selected on first paint. */
export function defaultOfferView(ctx: RenderContext): OfferView | undefined {
  const views = offerViews(ctx);
  return views.find((v) => v.selected) ?? views[0];
}

/** No delivery fee whatever the offer → "Livraison gratuite" said once, not on every card. */
export const allFree = (views: readonly OfferView[]): boolean => views.length > 0 && views.every((v) => v.freeShipping);

/** The page's offers are best told by their pictures (§E.5 "image-led"). */
export const imageLedSet = (views: readonly OfferView[]): boolean => views.some((v) => v.imageLed);

/**
 * The best real saving across offers as a short label ("−25%", or "−150 DH" when the page shows
 * amounts only), or null when no offer saves anything (or savings are hidden).
 */
export function bestSaving(views: readonly OfferView[]): { pack: OfferView; label: string } | null {
  let best: OfferView | null = null;
  for (const p of views) {
    if (p.soldOut || (!p.savePct && !p.saved)) continue;
    if (!best || (p.savePct ? p.math.savingsPct > best.math.savingsPct : p.math.savings > best.math.savings)) best = p;
  }
  if (!best) return null;
  return { pack: best, label: best.savePct ?? `−${best.saved}` };
}

/** The offer raised as the favourite: "popular", else the preselected one; none for a lone offer. */
export function featuredOf(views: readonly OfferView[]): string | null {
  if (views.length < 2) return null;
  return views.find((p) => p.badge?.kind === "popular")?.id ?? views.find((p) => p.selected)?.id ?? null;
}

/** "Dès 249 DH" / "249 DH" — the card price as one string (sticky, hero, teasers). */
export const priceLine = (ctx: RenderContext, v: Pick<OfferView, "total" | "variable">): string =>
  v.variable ? offerWord(ctx.locale, "from", { price: v.total }) : v.total;
