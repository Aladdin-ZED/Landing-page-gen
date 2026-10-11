import type { ReactElement } from "react";
import type { RenderContext } from "../types";
import { ORNAMENTS, ORNAMENT_BY_ARCHETYPE, type OrnamentKind } from "./shapes";
import { cx } from "./util";

export interface OrnamentProps {
  ctx: Pick<RenderContext, "archetype">;
  /** override the archetype's glyph (dot · spark · diamond, or an extra clean glyph) */
  kind?: OrnamentKind;
  /** px or CSS length (default "0.75em") */
  size?: number | string;
  className?: string;
}

/**
 * The archetype's glyph (html[data-glyph]: dot, spark or diamond) as a crisp inline vector —
 * decorative, inherits currentColor. Without an explicit `kind` it carries `data-auto`, which lets
 * base.css drop decorative glyphs on html[data-glyph="none"] pages.
 */
export function Ornament({ ctx, kind, size = "0.75em", className }: OrnamentProps): ReactElement {
  const explicit = !!kind && Object.prototype.hasOwnProperty.call(ORNAMENTS, kind);
  const k: OrnamentKind = explicit ? kind! : (ORNAMENT_BY_ARCHETYPE[ctx.archetype] ?? "dot");
  const g = ORNAMENTS[k];
  return (
    <svg
      className={cx("lp-ornament", className)}
      data-ornament={k}
      data-auto={explicit ? undefined : ""}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {g.fill ? <path d={g.fill} fill="currentColor" /> : null}
      {g.stroke ? (
        <path
          d={g.stroke}
          fill="none"
          stroke="currentColor"
          strokeWidth={g.sw ?? 1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}
