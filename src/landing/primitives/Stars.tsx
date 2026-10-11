import type { ReactElement } from "react";
import type { RenderContext } from "../types";
import { STAR_BY_ARCHETYPE, STAR_ROW_W, STAR_ROWS, type StarKind } from "./shapes";
import { clamp, cssVars, cx, round } from "./util";

export interface StarsProps {
  ctx: RenderContext;
  /** 0..5 (real rating only — never invented) */
  value: number;
  /** number of reviews behind the rating */
  count?: number;
  size?: "s" | "m" | "l";
  /** show the numeric value next to the stars ("4,7") */
  showValue?: boolean;
  /** show "(128)" after the stars */
  showCount?: boolean;
  kind?: StarKind;
  className?: string;
}

/**
 * Rating stars in the archetype's clean star shape (8-point for souk, slanted for kinetic, fine for
 * maison, chunky for playground…). Fractional ratings are shown by clipping the filled row.
 * Exposed to assistive tech as one image with a full sentence label.
 */
export function Stars({
  ctx,
  value,
  count,
  size = "m",
  showValue = false,
  showCount = false,
  kind,
  className,
}: StarsProps): ReactElement | null {
  if (!Number.isFinite(value)) return null;
  const v = clamp(round(value, 1), 0, 5);
  const k: StarKind =
    kind && Object.prototype.hasOwnProperty.call(STAR_ROWS, kind) ? kind : (STAR_BY_ARCHETYPE[ctx.archetype] ?? "classic");
  const row = STAR_ROWS[k];
  const n = count && count > 0 ? Math.round(count) : undefined;
  const countText = n ? ctx.t("reviews.basedOn", { n }).replace(String(n), ctx.num(n)) : "";
  const label = `${ctx.num(v)} ${ctx.t("reviews.outOf")}${countText ? ` — ${countText}` : ""}`;
  const viewBox = `0 0 ${STAR_ROW_W} 24`;
  return (
    <span className={cx("lp-stars", `lp-stars--${size}`, className)} role="img" aria-label={label} data-star={k}>
      <span className="lp-stars__row">
        <svg className="lp-stars__base" viewBox={viewBox} focusable="false" aria-hidden="true">
          <path d={row} />
        </svg>
        <svg
          className="lp-stars__fill"
          viewBox={viewBox}
          focusable="false"
          aria-hidden="true"
          style={cssVars({ "--v": round(v / 5, 3) })}
        >
          <path d={row} />
        </svg>
      </span>
      {showValue ? <span className="lp-stars__value">{ctx.num(v)}</span> : null}
      {showCount && n ? <span className="lp-stars__count">({ctx.num(n)})</span> : null}
    </span>
  );
}
