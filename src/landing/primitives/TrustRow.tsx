import type { ReactElement } from "react";
import type { RenderContext } from "../types";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { RichText } from "./RichText";
import { cx, reveal, type RevealKind } from "./util";

export interface TrustItem {
  icon: IconName;
  text: string;
}

/** The four COD reassurances, in the page language. */
export function defaultTrustItems(ctx: RenderContext): TrustItem[] {
  return [
    { icon: "cash-hand", text: ctx.t("trust.cod") },
    { icon: "truck", text: ctx.t("trust.delivery") },
    { icon: "eye", text: ctx.t("trust.check") },
    { icon: "return", text: ctx.t("trust.returns") },
  ];
}

export interface TrustRowProps {
  ctx: RenderContext;
  items?: TrustItem[];
  /** inline (wrapping row, default), grid (2×2 on mobile), stack (vertical list) */
  layout?: "inline" | "grid" | "stack";
  size?: "s" | "m";
  className?: string;
  /** stagger the items in (ms between items); 0 disables */
  stagger?: number;
  itemReveal?: RevealKind;
}

/** Row of COD reassurance points with custom icons (cash in hand, truck, inspect, exchange). */
export function TrustRow({
  ctx,
  items,
  layout = "inline",
  size = "m",
  className,
  stagger = 70,
  itemReveal = "fade",
}: TrustRowProps): ReactElement | null {
  const list = (items ?? defaultTrustItems(ctx)).filter((i) => i.text.trim());
  if (!list.length) return null;
  return (
    <ul
      className={cx("lp-trust", `lp-trust--${layout}`, size === "s" && "lp-trust--s", className)}
      role="list"
      data-stagger={stagger > 0 ? String(stagger) : undefined}
    >
      {list.map((it, i) => (
        <li key={i} className="lp-trust__item" {...reveal(stagger > 0 && itemReveal)}>
          <span className="lp-trust__icon">
            <Icon name={it.icon} size="1em" />
          </span>
          <RichText as="span" className="lp-trust__text" text={it.text} ctx={ctx} decorate={false} />
        </li>
      ))}
    </ul>
  );
}
