import type { ReactElement } from "react";
import { defaultBundleId } from "@/lib/page/pricing";
import type { RenderContext } from "../types";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { Money } from "./Price";
import { RichText } from "./RichText";
import { cx, editAttr } from "./util";

/**
 * primary — the page's action color (style per html[data-btn]); secondary — quiet outline;
 * ghost — text link with an underline; glass — frosted, for buttons laid over photos and color fields.
 */
export type CtaVariant = "primary" | "secondary" | "ghost" | "glass";

export interface CtaProps {
  ctx: RenderContext;
  /** button text (default: t("cta.orderNow")) */
  label?: string;
  variant?: CtaVariant;
  size?: "m" | "l" | "xl";
  /** preselect this bundle in the order form */
  bundleId?: string;
  /** append the price pill: the bundle's price, or the live current total when no bundleId */
  withPrice?: boolean;
  /** reference CTA for the sticky bar (data-hero-cta) */
  hero?: boolean;
  /** trailing icon (default arrow-right), false for none */
  icon?: IconName | false;
  /** full width below 40rem */
  wide?: boolean;
  /** small reassurance line under the label, e.g. "Paiement à la livraison" */
  sub?: string;
  className?: string;
  /** data path of the label for click-to-edit */
  editPath?: string;
  /** data path of the sub line for click-to-edit */
  subEditPath?: string;
}

/**
 * Order CTA — always an <a href="#order" data-action="order"> so it works without JS (plain anchor
 * jump); the runtime upgrades it (smooth scroll, bundle preselect, focus). Modern and tactile per
 * html[data-btn] (solid · pill · glow · soft · outline · underline): confident fill, tinted soft
 * shadow, 1px inner highlight; hover lifts and glows, press settles to .98 on a spring, the arrow
 * nudges forward. The price rides in its own pill with tabular numerals; a live price (no bundleId)
 * follows the selected bundle through data-lp-price="current".
 */
export function Cta({
  ctx,
  label,
  variant = "primary",
  size = "l",
  bundleId,
  withPrice = false,
  hero = false,
  icon = "arrow-right",
  wide = false,
  sub,
  className,
  editPath,
  subEditPath,
}: CtaProps): ReactElement {
  const bundles = ctx.offers.bundles;
  const bundle = bundleId ? bundles.find((b) => b.id === bundleId) : undefined;
  const liveBundle = bundle ? undefined : bundles.find((b) => b.id === defaultBundleId(ctx.offers));
  const price = withPrice ? (bundle?.price ?? liveBundle?.price) : undefined;
  const custom = !!label?.trim();
  const labelNode = (
    <RichText
      as="span"
      className="lp-btn__label"
      text={custom ? label : ctx.t("cta.orderNow")}
      ctx={ctx}
      decorate={false}
      editPath={custom ? editPath : undefined}
    />
  );
  const subText = sub?.trim();
  return (
    <a
      href="#order"
      className={cx(
        "lp-btn",
        `lp-btn--${variant}`,
        `lp-btn--${size}`,
        wide && "lp-btn--wide",
        icon && "lp-btn--has-icon",
        price !== undefined && "lp-btn--has-price",
        subText && "lp-btn--has-sub",
        className,
      )}
      data-action="order"
      data-bundle={bundle?.id}
      data-hero-cta={hero ? "" : undefined}
    >
      {subText ? (
        <span className="lp-btn__text">
          {labelNode}
          <RichText as="span" className="lp-btn__sub" text={subText} ctx={ctx} decorate={false} editPath={subEditPath} />
        </span>
      ) : (
        labelNode
      )}
      {price !== undefined ? (
        bundle ? (
          <span className="lp-btn__price">
            <Money ctx={ctx} amount={price} />
          </span>
        ) : (
          // the runtime rewrites this text on bundle change: keep it a single text node
          <bdi className="lp-btn__price" data-lp-price="current">
            {ctx.money(price)}
          </bdi>
        )
      ) : null}
      {icon ? (
        <span className="lp-btn__icon" aria-hidden="true">
          <Icon name={icon} size="1.1em" strokeWidth={2} />
        </span>
      ) : null}
    </a>
  );
}

/** Same look as Cta for non-order links (e.g. "#offers", WhatsApp). External links open safely. */
export function LinkButton({
  ctx,
  href,
  label,
  variant = "secondary",
  size = "m",
  icon,
  className,
  editPath,
}: {
  ctx: RenderContext;
  href: string;
  label: string;
  variant?: CtaVariant;
  size?: CtaProps["size"];
  icon?: IconName;
  className?: string;
  editPath?: string;
}): ReactElement | null {
  const safe = safeHref(href);
  if (!safe) return null;
  const external = /^https:\/\//i.test(safe);
  return (
    <a
      href={safe}
      className={cx("lp-btn", `lp-btn--${variant}`, `lp-btn--${size}`, icon && "lp-btn--has-lead", className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {icon ? (
        <span className="lp-btn__icon lp-btn__icon--lead" aria-hidden="true">
          <Icon name={icon} size="1.2em" strokeWidth={2} />
        </span>
      ) : null}
      <span className="lp-btn__label" {...editAttr(ctx, editPath)}>
        {label}
      </span>
    </a>
  );
}

/** Allow in-page anchors, https URLs, wa.me / tel: / mailto: — nothing else (no javascript:). */
export function safeHref(href: string | undefined | null): string | undefined {
  if (!href) return undefined;
  const h = href.trim();
  if (/^#[a-zA-Z][\w-]{0,60}$/.test(h)) return h;
  if (/^tel:\+?[0-9 ]{6,20}$/.test(h)) return h.replace(/ /g, "");
  if (/^mailto:[^\s"'<>]{3,120}$/.test(h)) return h;
  if (/^https:\/\/[^\s"'<>]{3,500}$/i.test(h)) {
    try {
      const u = new URL(h);
      return u.protocol === "https:" ? u.toString() : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
