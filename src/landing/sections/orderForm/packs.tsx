/**
 * Bundle ("pack") presentation, shared by the order-form picker and the offer showcase:
 *  - packsOf(): the display model of every bundle — all math through bundleMath(), savings only
 *    when real, labels per offers.showSavings / showPerUnit;
 *  - PackVisual: the product ×qty (photos stacked in depth, or cutouts standing side by side), or
 *    the merchant's own pack photo;
 *  - PackPicker: the form's radio cards in the five offers.cardStyle layouts — stack (rows), tiers
 *    (columns, featured one raised), ticket (wallet passes), pills (segmented control + detail
 *    panel), visual (product ×qty cards).
 * Pure markup; the runtime toggles [data-selected] on every [data-bundle-card], CSS does the rest
 * (with :checked as the no-JS fallback).
 */
import type { ReactElement } from "react";
import { bundleMath, defaultBundleId, type BundleMath } from "@/lib/page/pricing";
import { Icon, Money, Picture, cssVars, cx, resolveProductVisual } from "../../primitives";
import type { RenderContext, ResolvedAsset, SectionBg } from "../../types";
import { uiLabels } from "./copy";
import { photoPlan } from "./fit";
import { PlannedPhoto } from "./photo";
import { Plain } from "./text";

export type BadgeKind = "popular" | "best" | "custom";
export type CardStyle = "stack" | "tiers" | "ticket" | "pills" | "visual";

export interface Pack {
  id: string;
  index: number;
  qty: number;
  m: BundleMath;
  /** merchant title, else the localized quantity ("2 pièces") */
  name: string;
  /** `name` is the merchant title (the quantity then shows as a meta line) */
  titled: boolean;
  /** "x2" / "×2" */
  x: string;
  qtyLabel: string;
  subtitle?: string;
  badge?: { kind: BadgeKind; text: string };
  total: string;
  /** struck reference — only for a genuine saving */
  reference?: string;
  /** "soit 134,50 DH / pièce" (multi-unit packs, offers.showPerUnit) */
  perUnit?: string;
  /** the per-unit amount alone, when `perUnit` is shown */
  unit?: string;
  savePct?: string;
  saveAmount?: string;
  /** the saved amount alone, when `saveAmount` is shown */
  saved?: string;
  freeShipping: boolean;
  gift?: { label: string; asset: ResolvedAsset | null };
  /** merchant photo of the pack itself */
  image: ResolvedAsset | null;
  /** selected on first paint (defaultBundleId) */
  selected: boolean;
}

/** Display model of every bundle, in page order. */
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
    const withUnit = offers.showPerUnit && b.qty > 1;
    const badgeText =
      b.badge === "popular"
        ? ctx.t("bundle.popular")
        : b.badge === "best"
          ? ctx.t("bundle.best")
          : b.badge === "custom"
            ? (b.badgeText?.trim() ?? "")
            : "";
    const giftLabel = b.gift?.label.trim();
    return {
      id: b.id,
      index,
      qty: b.qty,
      m,
      name: title || ctx.t("bundle.qty", { n: b.qty }),
      titled: !!title,
      x: ctx.t("bundle.x", { n: b.qty }),
      qtyLabel: ctx.t("bundle.qty", { n: b.qty }),
      subtitle: b.subtitle?.trim() || undefined,
      badge: badgeText && b.badge !== "none" ? { kind: b.badge, text: badgeText } : undefined,
      total: ctx.money(m.total),
      reference: m.showReference ? ctx.money(m.reference) : undefined,
      perUnit: withUnit ? ctx.t("bundle.perUnit", { price: ctx.money(m.perUnit) }) : undefined,
      unit: withUnit ? ctx.money(m.perUnit) : undefined,
      savePct: withPct ? ctx.t("bundle.savePct", { pct: m.savingsPct }) : undefined,
      saveAmount: withAmount ? ctx.t("bundle.save", { amount: ctx.money(m.savings) }) : undefined,
      saved: withAmount ? ctx.money(m.savings) : undefined,
      // pricing charges offers.shippingFee on every order: "free delivery" is only true when it is 0
      freeShipping: b.freeShipping && offers.shippingFee <= 0,
      gift: giftLabel ? { label: giftLabel, asset: ctx.asset(b.gift?.image) } : undefined,
      image: ctx.asset(b.image),
      selected: b.id === first,
    };
  });
}

/** Every pack ships free → say it once under the picker instead of on every card. */
export const allFree = (packs: readonly Pack[]) => packs.length > 0 && packs.every((p) => p.freeShipping);

/**
 * The best real saving across packs as a short label for a disc ("−25%", or "−150 DH" when the page
 * shows amounts only), or null when no pack saves anything (or savings are hidden).
 */
export function bestSaving(packs: readonly Pack[]): { pack: Pack; label: string } | null {
  let best: Pack | null = null;
  for (const p of packs) {
    if (!p.savePct && !p.saved) continue;
    if (!best || (p.savePct ? p.m.savingsPct > best.m.savingsPct : p.m.savings > best.m.savings)) best = p;
  }
  if (!best) return null;
  return { pack: best, label: best.savePct ?? `−${best.saved}` };
}

/* ------------------------------------------------------------------ */
/* Product × qty visual                                                */
/* ------------------------------------------------------------------ */

export interface PackVisualProps {
  ctx: RenderContext;
  pack: Pack;
  sizes: string;
  /** most copies drawn; the rest is a "+n" chip */
  max?: number;
  className?: string;
}

/**
 * The product repeated ×qty: photos stack in depth (each copy behind steps back, smaller and in
 * shade, along one clean diagonal — straight, never a tilted pile), cutouts stand shoulder to
 * shoulder on one contact shadow. A merchant pack photo (bundle.image) replaces the composition;
 * without any photo the quantity itself is the visual. Decorative (alt="") — the card's text
 * carries the meaning. Selection opens the stack (CSS, --pv-spread).
 */
export function PackVisual({ ctx, pack, sizes, max = 3, className }: PackVisualProps): ReactElement {
  if (pack.image) {
    return (
      <span className={cx("lp-pv", className)} data-kind="pack" aria-hidden="true">
        <Picture asset={pack.image} sizes={sizes} alt="" fit={pack.image.alpha ? "contain" : "cover"} className="lp-pv__pack" />
      </span>
    );
  }
  const visual = resolveProductVisual(ctx);
  if (!visual.asset) {
    return (
      <span className={cx("lp-pv", className)} data-kind="empty" aria-hidden="true">
        <bdi className="lp-pv__n" dir="ltr">
          ×{ctx.num(pack.qty)}
        </bdi>
      </span>
    );
  }
  const asset = visual.asset;
  const copies = Math.max(1, Math.min(pack.qty, max));
  const plan = photoPlan(visual.kind === "cutout" ? null : asset);
  const extra = pack.qty - copies;
  const mid = (copies - 1) / 2;
  return (
    <span
      className={cx("lp-pv", className)}
      data-kind={visual.kind}
      data-n={copies}
      data-wide={plan.wide ? "" : undefined}
      style={cssVars({ "--pv-n": copies })}
      aria-hidden="true"
    >
      {Array.from({ length: copies }, (_, k) => (
        <span
          key={k}
          className="lp-pv__item"
          style={cssVars({
            // cutouts: position from the center of the row · photos: depth (0 = front, painted last)
            "--pv-c": k - mid,
            "--pv-a": Math.abs(k - mid),
            "--pv-d": copies - 1 - k,
          })}
        >
          {/* each copy is a rounded window (pv.css: 4:5, 5:4 for a wide product), the photo fitted to it */}
          {visual.kind === "cutout" ? (
            <Picture asset={asset} sizes={sizes} alt="" fit="contain" />
          ) : (
            <PlannedPhoto asset={asset} sizes={sizes} plan={plan} />
          )}
        </span>
      ))}
      {extra > 0 ? (
        <span className="lp-pv__more">
          <bdi dir="ltr">+{ctx.num(extra)}</bdi>
        </span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card pieces                                                         */
/* ------------------------------------------------------------------ */

/** Check disc: pops in with a spring and draws its tick when the card is chosen. */
function Check(): ReactElement {
  return (
    <span className="lp-pack__check" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M6.6 12.6l3.7 3.6 7.2-8" pathLength={1} />
      </svg>
    </span>
  );
}

/** "×2" — always written left-to-right, a big numeral with a light multiplication sign. */
function Qty({ ctx, pack }: { ctx: RenderContext; pack: Pack }): ReactElement {
  return (
    <span className={cx("lp-pack__qty", pack.image && "lp-pack__qty--pic")} aria-hidden="true">
      {pack.image ? <Picture asset={pack.image} sizes="5rem" alt="" ratio={1} fit={pack.image.alpha ? "contain" : "cover"} className="lp-pack__qpic" /> : null}
      <bdi className="lp-pack__qn" dir="ltr">
        <span className="lp-pack__times">×</span>
        {ctx.num(pack.qty)}
      </bdi>
    </span>
  );
}

function Badge({ pack }: { pack: Pack }): ReactElement | null {
  if (!pack.badge) return null;
  return (
    <span className="lp-pack__badge" aria-hidden="true">
      {pack.badge.kind === "best" ? <Icon name="star" size="1em" strokeWidth={2} /> : null}
      <span className="lp-pack__badge-t">{pack.badge.text}</span>
    </span>
  );
}

function Main({ ctx, pack, id }: { ctx: RenderContext; pack: Pack; id?: string }): ReactElement {
  return (
    <span className="lp-pack__main">
      <Plain ctx={ctx} className="lp-pack__name" id={id} text={pack.name} />
      {pack.titled ? (
        <span className="lp-pack__meta">
          <bdi>{pack.qtyLabel}</bdi>
        </span>
      ) : null}
      {pack.subtitle ? <Plain ctx={ctx} className="lp-pack__subt" text={pack.subtitle} /> : null}
    </span>
  );
}

function PriceBlock({ ctx, pack, id, label }: { ctx: RenderContext; pack: Pack; id?: string; label?: string }): ReactElement {
  return (
    <span className="lp-pack__price" id={id}>
      {label ? (
        <span className="lp-pack__flabel" aria-hidden="true">
          {label}
        </span>
      ) : null}
      <span className="lp-pack__now">
        <Money ctx={ctx} amount={pack.m.total} />
      </span>
      {pack.reference ? (
        <>
          {" "}
          <s className="lp-pack__was">
            <span className="lp-visually-hidden">{ctx.t("price.was")} </span>
            <bdi>{pack.reference}</bdi>
          </s>
        </>
      ) : null}
    </span>
  );
}

/**
 * Savings chip ("−25%" + "Économisez 50 DH"), per-unit line, free delivery. Narrow columns
 * (`compact`) keep one short saving label: the percentage, else "−50 DH" (the full sentence is
 * then given to screen readers by SrExtras).
 */
function Perks({ ctx, pack, ship, compact }: { ctx: RenderContext; pack: Pack; ship: boolean; compact?: boolean }) {
  const amount = compact ? undefined : pack.saveAmount;
  const short = compact && !pack.savePct && pack.saved ? `−${pack.saved}` : undefined;
  return (
    <>
      {pack.savePct || amount || short ? (
        <span className="lp-pack__save">
          {pack.savePct ? <bdi className="lp-pack__pct">{pack.savePct}</bdi> : null}
          {pack.savePct && amount ? " " : null}
          {amount ? <span className="lp-pack__amt">{amount}</span> : null}
          {short ? (
            <bdi className="lp-pack__pct" aria-hidden="true">
              {short}
            </bdi>
          ) : null}
        </span>
      ) : null}
      {pack.perUnit && compact ? (
        <span className="lp-pack__unit lp-pack__unit--field">
          {" "}
          <span className="lp-pack__flabel">{uiLabels(ctx.locale).perUnit}</span> <bdi>{pack.unit}</bdi>
        </span>
      ) : pack.perUnit ? (
        <span className="lp-pack__unit"> {pack.perUnit}</span>
      ) : null}
      {ship ? (
        <span className="lp-pack__ship">
          {" "}
          <Icon name="truck" size="1.15em" />
          {ctx.t("bundle.freeShipping")}
        </span>
      ) : null}
    </>
  );
}

/** What the visual layout leaves unsaid, for screen readers (badge, gift, a saving moved aside). */
function SrExtras({ ctx, pack, also }: { ctx: RenderContext; pack: Pack; also?: (string | undefined)[] }) {
  const parts = [...(also ?? []), pack.badge?.text, pack.gift ? `${ctx.t("bundle.gift")}: ${pack.gift.label}` : undefined].filter(Boolean);
  return parts.length ? <span className="lp-visually-hidden"> · {parts.join(" · ")}</span> : null;
}

function Gift({ ctx, pack }: { ctx: RenderContext; pack: Pack }): ReactElement | null {
  if (!pack.gift) return null;
  return (
    <span className="lp-pack__gift" aria-hidden="true">
      {pack.gift.asset ? (
        <Picture asset={pack.gift.asset} sizes="3rem" alt="" ratio={1} className="lp-pack__gift-pic" />
      ) : (
        <span className="lp-pack__gift-ico">
          <Icon name="gift" size="1.15em" />
        </span>
      )}
      <span className="lp-pack__gift-txt">
        <b>{ctx.t("bundle.gift")}</b> <Plain ctx={ctx} text={pack.gift.label} />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Form picker                                                         */
/* ------------------------------------------------------------------ */

/** Layout actually used: a lone pack never needs columns or segments, so those fall back to a row. */
export function effectiveStyle(style: CardStyle, n: number): CardStyle {
  return n === 1 && (style === "tiers" || style === "pills") ? "stack" : style;
}

export interface PackPickerProps {
  ctx: RenderContext;
  /** section id (unique ids) */
  sid: string;
  packs: Pack[];
  style: CardStyle;
  /** palette of each card ([data-bg]) when the picker sits on a color slab */
  surface?: SectionBg;
}

/** Radio wiring shared by every layout: the whole card is the <label>, name + total name the radio. */
function Radio({ pack, uid }: { pack: Pack; uid: string }): ReactElement {
  return (
    <input
      className="lp-pack__radio"
      type="radio"
      name="bundle"
      value={pack.id}
      defaultChecked={pack.selected}
      aria-labelledby={`${uid}-n ${uid}-p`}
      aria-describedby={`${uid}-d`}
    />
  );
}

/**
 * Bundle radios (runtime contract: input[type=radio][name=bundle] inside [data-bundle-card], the
 * default pack preselected). Selected = accent ring + soft accent glow + lift + check pop.
 */
export function PackPicker({ ctx, sid, packs, style: wanted, surface }: PackPickerProps): ReactElement {
  const style = effectiveStyle(wanted, packs.length);
  if (style === "pills") return <Segmented ctx={ctx} sid={sid} packs={packs} surface={surface} />;
  const shared = allFree(packs);
  const L = uiLabels(ctx.locale);
  // tiers: the popular pack (else the best price) stands raised in the row
  const featured = (packs.find((p) => p.badge?.kind === "popular") ?? packs.find((p) => p.badge?.kind === "best"))?.id;
  // narrow columns (3+ side by side) keep labels short
  const compact = (style === "tiers" || style === "visual") && packs.length > 2;
  const visualSizes = packs.length > 2 ? "(min-width: 48rem) 10rem, 30vw" : "(min-width: 48rem) 15rem, 44vw";
  return (
    <div className={cx("lp-packs", `lp-packs--${style}`)} data-n={packs.length} data-stagger="70">
      {packs.map((p) => {
        const uid = `${sid}-pk-${p.index}`;
        const ship = p.freeShipping && !shared;
        return (
          <label
            key={p.id}
            className="lp-pack"
            data-bundle-card={p.id}
            data-selected={p.selected ? "" : undefined}
            data-badge={p.badge?.kind}
            data-featured={style === "tiers" && featured === p.id ? "" : undefined}
            data-bg={surface}
            data-reveal="rise"
          >
            <Radio pack={p} uid={uid} />
            {style === "ticket" ? <span className="lp-pack__band" aria-hidden="true" /> : null}
            <Check />
            <Badge pack={p} />
            {style === "visual" ? (
              <PackVisual ctx={ctx} pack={p} sizes={visualSizes} className="lp-pack__media" />
            ) : (
              <Qty ctx={ctx} pack={p} />
            )}
            <Main ctx={ctx} pack={p} id={`${uid}-n`} />
            {style === "ticket" ? (
              <>
                {p.savePct ? (
                  <bdi className="lp-pack__tag" aria-hidden="true">
                    {p.savePct}
                  </bdi>
                ) : null}
                <span className="lp-pack__fields">
                  <PriceBlock ctx={ctx} pack={p} id={`${uid}-p`} label={L.total} />
                  {p.unit ? (
                    <span className="lp-pack__field" aria-hidden="true">
                      <span className="lp-pack__flabel">{L.perUnit}</span>
                      <bdi className="lp-pack__fval">{p.unit}</bdi>
                    </span>
                  ) : null}
                  {p.saved ? (
                    <span className="lp-pack__field lp-pack__field--save" aria-hidden="true">
                      <span className="lp-pack__flabel">{L.youSave}</span>
                      <bdi className="lp-pack__fval">{p.saved}</bdi>
                    </span>
                  ) : null}
                  {ship ? (
                    <span className="lp-pack__field lp-pack__field--ship" aria-hidden="true">
                      <span className="lp-pack__flabel">{ctx.t("form.shipping")}</span>
                      <span className="lp-pack__fval">
                        <Icon name="truck" size="1.1em" />
                        {ctx.t("form.free")}
                      </span>
                    </span>
                  ) : null}
                </span>
                <span className="lp-visually-hidden" id={`${uid}-d`}>
                  {[p.savePct, p.saveAmount, p.perUnit, ship ? ctx.t("bundle.freeShipping") : undefined].filter(Boolean).join(" · ")}
                  <SrExtras ctx={ctx} pack={p} />
                </span>
              </>
            ) : (
              <>
                <PriceBlock ctx={ctx} pack={p} id={`${uid}-p`} />
                <span className="lp-pack__perks" id={`${uid}-d`}>
                  <Perks ctx={ctx} pack={p} ship={ship} compact={compact} />
                  <SrExtras ctx={ctx} pack={p} also={compact ? [p.saveAmount] : undefined} />
                </span>
              </>
            )}
            <Gift ctx={ctx} pack={p} />
          </label>
        );
      })}
    </div>
  );
}

/**
 * pills: a segmented control (quantity + total per segment) whose accent thumb glides to the chosen
 * segment, over a detail panel that cross-fades to the chosen pack (name, prices, perks, gift).
 * The panel repeats what the radios already describe, so it is hidden from assistive tech.
 */
function Segmented({ ctx, sid, packs, surface }: { ctx: RenderContext; sid: string; packs: Pack[]; surface?: SectionBg }): ReactElement {
  const shared = allFree(packs);
  return (
    <div className="lp-packs lp-packs--pills" data-n={packs.length}>
      <div className="lp-seg" data-bg={surface} style={cssVars({ "--n": packs.length })} data-reveal="rise">
        <span className="lp-seg__thumb" aria-hidden="true" />
        {packs.map((p) => {
          const uid = `${sid}-pk-${p.index}`;
          const ship = p.freeShipping && !shared;
          return (
            <label key={p.id} className="lp-pack lp-seg__opt" data-bundle-card={p.id} data-selected={p.selected ? "" : undefined} data-badge={p.badge?.kind}>
              <Radio pack={p} uid={uid} />
              {p.badge ? (
                <span className="lp-seg__badge" aria-hidden="true">
                  {p.badge.text}
                </span>
              ) : null}
              <bdi className="lp-seg__qty" dir="ltr" aria-hidden="true">
                <span className="lp-pack__times">×</span>
                {ctx.num(p.qty)}
              </bdi>
              <span className="lp-seg__price" id={`${uid}-p`}>
                <bdi>{p.total}</bdi>
              </span>
              <span className="lp-visually-hidden" id={`${uid}-n`}>
                {p.name}
              </span>
              <span className="lp-visually-hidden" id={`${uid}-d`}>
                {[
                  p.reference ? `${ctx.t("price.was")} ${p.reference}` : undefined,
                  p.savePct,
                  p.saveAmount,
                  p.perUnit,
                  ship ? ctx.t("bundle.freeShipping") : undefined,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                <SrExtras ctx={ctx} pack={p} />
              </span>
            </label>
          );
        })}
      </div>
      <div className="lp-seg__panel" data-bg={surface} aria-hidden="true" data-reveal="fade" data-delay="120">
        {packs.map((p) => (
          <div key={p.id} className="lp-seg__detail" data-bundle-card={p.id} data-selected={p.selected ? "" : undefined} data-badge={p.badge?.kind}>
            <Badge pack={p} />
            <Main ctx={ctx} pack={p} />
            <PriceBlock ctx={ctx} pack={p} />
            <span className="lp-pack__perks">
              <Perks ctx={ctx} pack={p} ship={p.freeShipping && !shared} />
            </span>
            <Gift ctx={ctx} pack={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
