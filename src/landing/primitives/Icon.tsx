import type { ReactElement } from "react";
import { ICONS, isIconName, type IconName, type IconPart } from "./icons";
import { cx } from "./util";

export interface IconProps {
  name: IconName;
  /** px number or CSS length ("1.25em"). Default 24. */
  size?: number | string;
  className?: string;
  /** accessible name; omit for decorative icons (aria-hidden) */
  label?: string;
  strokeWidth?: number;
}

/**
 * Custom landing icon (24px grid, 1.75 stroke). Inherits color via currentColor.
 * Directional icons get .lp-flip-rtl so they mirror in RTL.
 */
export function Icon({ name, size = 24, className, label, strokeWidth = 1.75 }: IconProps): ReactElement | null {
  // names often come from page data (icon pickers): only own keys of the set, never prototype keys
  if (!isIconName(name)) return null;
  const def = ICONS[name];
  const flip = "flip" in def && def.flip;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg
      className={cx("lp-icon", flip && "lp-flip-rtl", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {(def.p as readonly IconPart[]).map((part, i) => {
        if (typeof part === "string") return <path key={i} d={part} />;
        return part.fill ? (
          <path key={i} d={part.d} fill="currentColor" stroke="none" />
        ) : (
          <path key={i} d={part.d} strokeWidth={part.w} />
        );
      })}
    </svg>
  );
}
