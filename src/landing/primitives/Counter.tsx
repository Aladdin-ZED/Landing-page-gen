import type { ReactElement } from "react";
import type { RenderContext } from "../types";
import { clamp, cx, reveal, round } from "./util";

export interface CounterProps {
  ctx: RenderContext;
  /** final value (real numbers only) */
  to: number;
  /** fraction digits, 0–2 (the page number format carries at most two) */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  delay?: number;
}

/**
 * `ctx.num` with exactly `d` fraction digits ("4" → "4,0" in French, "4.0" in English).
 * The runtime roll-up reads the decimal separator from this server-rendered text, so the final
 * value and every animated frame keep the page's number format.
 */
function fixedNum(ctx: RenderContext, v: number, d: number): string {
  const s = ctx.num(v);
  if (d === 0) return s;
  const sep = ctx.num(1.5).replace(/[0-9]/g, "") || ".";
  const at = s.lastIndexOf(sep);
  if (at === -1) return s + sep + "0".repeat(d);
  return s + "0".repeat(Math.max(0, d - (s.length - at - 1)));
}

/** An affix made only of symbols ("+", "%", "×", "/7") travels with the number; words stay outside. */
const symbolic = (s: string | undefined): s is string => !!s && !/\p{L}/u.test(s);

/**
 * Number that rolls up when it enters the viewport (runtime: data-reveal="count").
 * The text content already holds the formatted final value, so it reads right without JS.
 * The number and its symbolic affixes sit in one LTR <bdi> ("+1 200", "98%", "4,8/5" never turn
 * into "1 200+" in Arabic); word affixes ("ساعة", "clients") stay in the reading direction.
 */
export function Counter({ ctx, to, decimals = 0, prefix, suffix, className, delay }: CounterProps): ReactElement | null {
  if (!Number.isFinite(to)) return null;
  const d = Number.isFinite(decimals) ? clamp(Math.round(decimals), 0, 2) : 0;
  const v = round(to, d);
  const pre = prefix?.trim() ? prefix : undefined;
  const post = suffix?.trim() ? suffix : undefined;
  const affix = (text: string, k: string) => (
    <span key={k} className="lp-counter__affix">
      {text}
    </span>
  );
  return (
    <span className={cx("lp-counter", className)}>
      {pre && !symbolic(pre) ? affix(pre, "p") : null}
      <bdi className="lp-counter__fig" dir="ltr">
        {symbolic(pre) ? affix(pre, "p") : null}
        <span
          className="lp-counter__num"
          data-count-to={String(v)}
          data-count-decimals={String(d)}
          {...reveal("count", delay)}
        >
          {fixedNum(ctx, v, d)}
        </span>
        {symbolic(post) ? affix(post, "s") : null}
      </bdi>
      {post && !symbolic(post) ? affix(post, "s") : null}
    </span>
  );
}
