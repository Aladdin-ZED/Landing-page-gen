/**
 * Building blocks of the order form, shared by the four variants. Runtime contract
 * (docs/ARCHITECTURE.md "Order form markup"): [data-field] wrappers with an always-present
 * [data-error], [data-lp-sum=subtotal|bump|shipping|total] (plain text — the runtime rewrites it),
 * button[type=submit][data-lp-submit] + [data-lp-submit-label], [data-lp-status][aria-live].
 */
import type { ReactElement } from "react";
import { orderTotals } from "@/lib/page/pricing";
import {
  Checkbox,
  FieldShell,
  Icon,
  Input,
  Kicker,
  PhoneInput,
  Picture,
  RichText,
  Select,
  TITLE_REVEAL,
  Textarea,
  cx,
  editAttr,
  pictureCrop,
  quietCorner,
  resolveProductVisual,
} from "../../primitives";
import type { RenderContext, ResolvedAsset, SectionBg } from "../../types";
import { orderMessage, whatsappHref, whatsappNumber } from "../whatsappFloat/wa";
import { optionalLabel, uiLabels } from "./copy";
import type { Pack } from "./packs";
import { Plain } from "./text";

export interface HeadData {
  kicker: string;
  lead: string;
}

/** Kicker, the section's only h2, and the lead. */
export function Head({ ctx, data, title, titleId, className }: { ctx: RenderContext; data: HeadData; title: string; titleId: string; className?: string }) {
  return (
    <header className={cx("lp-of__head", className)}>
      <Kicker ctx={ctx} text={data.kicker} className="lp-of__kicker" editPath="kicker" reveal="fade" />
      <RichText
        as="h2"
        id={titleId}
        className="lp-of__title lp-h2"
        text={title}
        ctx={ctx}
        editPath="title"
        reveal={TITLE_REVEAL[ctx.archetype]}
        split
        delay={80}
      />
      {data.lead.trim() ? (
        <RichText as="p" className="lp-of__lead lp-lead" text={data.lead} ctx={ctx} editPath="lead" reveal="blur-in" delay={240} />
      ) : null}
    </header>
  );
}

/**
 * Step legend: a numeral (disc, or a big editorial "01" in minimal) + the step name + a tick that
 * draws in once every required control of the step is valid (CSS :has(:invalid), no script) — the
 * numeral morphs into a check and the step rail fills: progress the shopper can feel.
 */
export function StepTitle({ ctx, n, text, path }: { ctx: RenderContext; n: number; text: string; path: string }) {
  return (
    <legend className="lp-of__legend">
      <span className="lp-of__no" aria-hidden="true">
        <span className="lp-of__no-1">{n}</span>
        <span className="lp-of__no-2">{String(n).padStart(2, "0")}</span>
        <svg className="lp-of__tick" viewBox="0 0 24 24" focusable="false">
          <path d="M6.5 12.5l3.6 3.6 7.4-8.2" pathLength={1} />
        </svg>
      </span>
      <span className="lp-of__legend-txt" {...editAttr(ctx, path)}>
        {text}
      </span>
    </legend>
  );
}

/**
 * The receipt line of the order: thumbnail with a live quantity bubble, "your order", the product,
 * the chosen pack and its live total. Pack-dependent bits are rendered once per pack and tagged
 * [data-bundle-card] — the runtime marks the chosen one ([data-selected]) and CSS cross-fades to it.
 */
export function OrderLine({ ctx, packs, total, className }: { ctx: RenderContext; packs: Pack[]; total: number; className?: string }): ReactElement {
  const visual = resolveProductVisual(ctx);
  return (
    <div className={cx("lp-of__line", className)}>
      <span
        className={cx("lp-of__line-media", !visual.asset && "lp-of__line-media--none")}
        data-q={visual.kind === "photo" ? badgeSpot(ctx, visual.asset, "4.5rem") : undefined}
      >
        {visual.asset ? (
          <Picture
            asset={visual.asset}
            sizes="4.5rem"
            alt=""
            ratio={1}
            fit={visual.kind === "cutout" ? "contain" : "cover"}
            className="lp-of__line-pic"
            imgClassName={visual.kind === "cutout" ? "lp-of__line-cut" : undefined}
          />
        ) : null}
        <span className="lp-of__line-qty" aria-hidden="true">
          {packs.map((p) => (
            <bdi key={p.id} dir="ltr" className="lp-of__swap" data-bundle-card={p.id} data-selected={p.selected ? "" : undefined}>
              ×{ctx.num(p.qty)}
            </bdi>
          ))}
        </span>
      </span>
      <span className="lp-of__line-txt">
        <span className="lp-of__line-k">{uiLabels(ctx.locale).yourOrder}</span>
        {/* bdi: a Latin name on an Arabic page takes its own direction, so the 2-line clamp ends
            it with "…" after its last word, never "…prière avec" (its start looking cut) */}
        <bdi className="lp-of__line-name">{ctx.product.name}</bdi>
        <span className="lp-of__line-pack">
          {packs.map((p) => (
            <bdi key={p.id} className="lp-of__swap" data-bundle-card={p.id} data-selected={p.selected ? "" : undefined}>
              <Plain ctx={ctx} text={p.name} />
            </bdi>
          ))}
        </span>
      </span>
      <bdi className="lp-of__line-price" data-lp-price="current">
        {ctx.money(total)}
      </bdi>
    </div>
  );
}

/**
 * Where a small badge (the live "×2") rides on a square photo thumbnail: the corner of the fitted
 * crop that covers no face and the least of the product — "se" (block start · inline end, the
 * default), "ss", "ee" or "es". CSS reads it as [data-q] on the thumbnail.
 */
export function badgeSpot(ctx: RenderContext, asset: ResolvedAsset | null | undefined, sizes: string): string | undefined {
  if (!asset || asset.alpha) return undefined;
  const crop = pictureCrop(asset, { ratio: 1, sizes });
  const c = quietCorner(asset, 1, { crop, chip: { w: 0.34, h: 0.34 }, dir: ctx.dir, prefer: { block: "start", inline: "end" } });
  const spot = `${c.block[0]}${c.inline[0]}`;
  return spot === "se" ? undefined : spot;
}

/** Delivery details (name, phone, city, address, email, note) per doc.form. */
export function Fields({ ctx, float }: { ctx: RenderContext; float?: boolean }) {
  const f = ctx.form;
  const opt = (label: string) => `${label} (${optionalLabel(ctx.locale)})`;
  const cities = ctx.market.cities;
  const cityMode = f.city === "select" && cities.length === 0 ? "text" : f.city;
  // floating labels need a placeholder to detect "filled"; the hint text then shows on focus
  return (
    <div className="lp-of__fields">
      <FieldShell ctx={ctx} field="name" label={ctx.t("form.name")} float={float} className="lp-of__f">
        <Input name="name" autoComplete="name" required minLength={2} maxLength={80} placeholder={ctx.t("form.namePh")} />
      </FieldShell>
      <FieldShell ctx={ctx} field="phone" label={ctx.t("form.phone")} float={float} className="lp-of__f">
        <PhoneInput ctx={ctx} />
      </FieldShell>
      {cityMode === "select" ? (
        <FieldShell ctx={ctx} field="city" label={ctx.t("form.city")} float={float} className="lp-of__f">
          <Select name="city" options={cities} placeholder={ctx.t("form.cityPh")} required autoComplete="address-level2" />
        </FieldShell>
      ) : cityMode === "text" ? (
        <FieldShell ctx={ctx} field="city" label={ctx.t("form.city")} float={float} className="lp-of__f">
          <Input name="city" autoComplete="address-level2" required maxLength={80} placeholder={ctx.t("form.cityPh")} />
        </FieldShell>
      ) : null}
      {f.address !== "hidden" ? (
        <FieldShell
          ctx={ctx}
          field="address"
          label={f.address === "optional" ? opt(ctx.t("form.address")) : ctx.t("form.address")}
          optional={f.address === "optional"}
          float={float}
          className={cx("lp-of__f", cityMode === "hidden" && "lp-of__f--wide")}
        >
          <Input
            name="address"
            autoComplete="street-address"
            required={f.address === "required"}
            maxLength={240}
            placeholder={ctx.t("form.addressPh")}
          />
        </FieldShell>
      ) : null}
      {f.email !== "hidden" ? (
        <FieldShell
          ctx={ctx}
          field="email"
          label={f.email === "optional" ? opt(ctx.t("form.email")) : ctx.t("form.email")}
          optional={f.email === "optional"}
          float={float}
          className="lp-of__f lp-of__f--wide"
        >
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            required={f.email === "required"}
            maxLength={120}
            placeholder={uiLabels(ctx.locale).email}
          />
        </FieldShell>
      ) : null}
      {f.note !== "hidden" ? (
        <FieldShell ctx={ctx} field="note" label={ctx.t("form.note")} optional float={float} className="lp-of__f lp-of__f--wide">
          <Textarea name="note" rows={2} maxLength={300} placeholder={ctx.t("form.notePh")} />
        </FieldShell>
      ) : null}
    </div>
  );
}

/** Order bump: a soft add-on card with a real checkbox; it lights up with the accent once ticked. */
export function Bump({ ctx, surface }: { ctx: RenderContext; surface?: SectionBg }) {
  const bump = ctx.offers.orderBump;
  if (!bump?.enabled) return null;
  const img = ctx.asset(bump.image);
  return (
    <label className={cx("lp-bump", img && "lp-bump--pic")} data-bg={surface} data-reveal="rise">
      <Checkbox name="bump" value="1" className="lp-bump__check" />
      {img ? <Picture asset={img} sizes="4.5rem" alt="" ratio={1} className="lp-bump__pic" /> : null}
      <span className="lp-bump__body">
        <span className="lp-bump__add">{ctx.t("form.bumpAdd")}</span>
        <Plain ctx={ctx} className="lp-bump__title" text={bump.title} />
        {bump.description ? <Plain ctx={ctx} className="lp-bump__desc" text={bump.description} /> : null}
      </span>
      <span className="lp-bump__price">
        <bdi>+{ctx.money(bump.price)}</bdi>
      </span>
    </label>
  );
}

/**
 * Live order summary (server-rendered values from orderTotals(); the runtime keeps them current).
 * `subtotal={false}` when a receipt line above already carries the pack total.
 */
export function Summary({
  ctx,
  bundleId,
  className,
  surface,
  subtotal = true,
}: {
  ctx: RenderContext;
  bundleId: string;
  className?: string;
  surface?: SectionBg;
  subtotal?: boolean;
}) {
  const totals = orderTotals(ctx.product, ctx.offers, bundleId, false);
  if (!totals) return null;
  const bump = ctx.offers.orderBump?.enabled ? ctx.offers.orderBump : null;
  const free = totals.shipping <= 0;
  return (
    <dl className={cx("lp-sum", className)} data-bg={surface} data-reveal="fade">
      {subtotal ? (
        <div className="lp-sum__row">
          <dt>{ctx.t("form.subtotal")}</dt>
          <dd>
            <bdi data-lp-sum="subtotal">{ctx.money(totals.subtotal)}</bdi>
          </dd>
        </div>
      ) : null}
      {bump ? (
        <div className="lp-sum__row lp-sum__row--bump">
          <dt>
            <Plain ctx={ctx} text={bump.title} />
          </dt>
          <dd>
            <bdi data-lp-sum="bump" data-zero="">
              {ctx.money(0)}
            </bdi>
          </dd>
        </div>
      ) : null}
      <div className="lp-sum__row">
        <dt>{ctx.t("form.shipping")}</dt>
        <dd>
          <bdi data-lp-sum="shipping" data-zero={free ? "" : undefined}>
            {free ? ctx.t("form.free") : ctx.money(totals.shipping)}
          </bdi>
        </dd>
      </div>
      <div className="lp-sum__row lp-sum__row--total">
        <dt>{ctx.t("form.total")}</dt>
        <dd>
          <bdi data-lp-sum="total">{ctx.money(totals.total)}</bdi>
        </dd>
      </div>
    </dl>
  );
}

/** Submit with the live total, the status line (aria-live) and the COD reassurance. */
export function Submit({ ctx, label, reassurance, total }: { ctx: RenderContext; label: string; reassurance: string; total: number }) {
  return (
    <div className="lp-of__go">
      <button
        type="submit"
        className={cx("lp-btn lp-btn--primary lp-btn--xl lp-btn--has-price lp-of__submit", Array.from(label).length > 24 && "lp-of__submit--long")}
        data-lp-submit=""
        data-reveal="scale-in"
      >
        <span className="lp-btn__label" data-lp-submit-label="" {...editAttr(ctx, "submitLabel")}>
          {label}
        </span>
        <span className="lp-btn__price">
          <bdi data-lp-sum="total">{ctx.money(total)}</bdi>
        </span>
      </button>
      <p className="lp-of__status" data-lp-status="" role="status" aria-live="polite" />
      <p className="lp-of__assure">
        <Icon name="shield-check" size="1.2em" />
        <Plain ctx={ctx} text={reassurance} editPath="reassurance" />
      </p>
    </div>
  );
}

/** COD reassurances: icon discs + short lines. */
export function Trust({ ctx, className }: { ctx: RenderContext; className?: string }) {
  const items = [
    { icon: "cash-hand", text: ctx.t("trust.cod") },
    { icon: "truck", text: ctx.t("trust.delivery") },
    { icon: "eye", text: ctx.t("trust.check") },
  ] as const;
  return (
    <ul className={cx("lp-of__trust", className)} role="list" data-stagger="80">
      {items.map((it) => (
        <li key={it.icon} className="lp-of__trust-item" data-reveal="rise">
          <span className="lp-of__trust-ico">
            <Icon name={it.icon} size="1.2em" />
          </span>
          {/* "24–48" held as one run in both directions (a bare span let it wrap as "24–" / "48") */}
          <Plain ctx={ctx} text={it.text} />
        </li>
      ))}
    </ul>
  );
}

/** WhatsApp ordering link: when the form enables it, or (no form setting) the store has a number. */
export function WhatsAppAlt({ ctx }: { ctx: RenderContext }) {
  const wa = ctx.doc.form.whatsapp;
  if (wa && !wa.enabled) return null;
  const number = whatsappNumber(ctx);
  if (!number) return null;
  return (
    <div className="lp-of__alt">
      <span className="lp-of__or">{ctx.t("form.or")}</span>
      <a className="lp-of__wa" href={whatsappHref(number, orderMessage(ctx.locale, ctx.product.name))} target="_blank" rel="noopener noreferrer">
        <Icon name="whatsapp" size="1.35em" />
        <span>{ctx.t("form.whatsapp")}</span>
      </a>
    </div>
  );
}

export function Privacy({ ctx }: { ctx: RenderContext }) {
  return (
    <p className="lp-of__privacy">
      <Icon name="lock" size="1.05em" />
      <span>{ctx.t("form.privacy")}</span>
    </p>
  );
}

/** "Paiement à la livraison" glass chip that sits across the card's top edge. */
export function CodChip({ ctx }: { ctx: RenderContext }) {
  return (
    <span className="lp-of__cod lp-glass" data-reveal="stamp" data-delay="380">
      <Icon name="cash-hand" size="1.2em" />
      <span>{ctx.t("trust.cod")}</span>
    </span>
  );
}
