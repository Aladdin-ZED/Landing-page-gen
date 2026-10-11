/**
 * Line-break-safe small text for the conversion sections (order form, offer, sticky CTA, WhatsApp
 * float): number ranges never split or reverse.
 *  - RTL pages: RichText glues "24–48" and isolates it left-to-right (no "48–24", no "24–" / "48");
 *  - LTR pages: RichText leaves "24–48h" as plain text, where a line may break right after the dash,
 *    so the range is held here: no-break spaces around the dash, a WORD JOINER (U+2060, invisible)
 *    right after it.
 */
import type { ReactNode } from "react";
import { RichText, plainText } from "../../primitives";
import type { RenderContext } from "../../types";

const WJ = String.fromCharCode(0x2060);
const NBSP = String.fromCharCode(0xa0);
/** figure · optional space · dash (hyphen, en/em dash, minus) · optional space · figure */
const RANGE = /(\d)([   ]?)([-‐-―−])([   ]?)(?=\d)/g;

/** The text with its number ranges held together on LTR pages (RTL pages: RichText does it). */
export function holdRanges(ctx: Pick<RenderContext, "dir">, text: string): string {
  if (ctx.dir === "rtl") return text;
  return text.replace(RANGE, (_m, d: string, s1: string, dash: string, s2: string) => `${d}${s1 ? NBSP : ""}${dash}${WJ}${s2 ? NBSP : ""}`);
}

/**
 * Merchant or kit text (pack titles, subtitles, gift labels, reassurance lines) as plain words —
 * *markup* is dropped — through RichText, with number ranges held together in both directions.
 */
export function Plain({
  ctx,
  text,
  className,
  id,
  editPath,
}: {
  ctx: RenderContext;
  text: string;
  className?: string;
  id?: string;
  editPath?: string;
}): ReactNode {
  // plainText() also folds no-break spaces: only run it when there is markup to drop
  const plain = /[*\\]/.test(text) ? plainText(text) || text : text;
  return <RichText as="span" className={className} id={id} text={holdRanges(ctx, plain)} ctx={ctx} decorate={false} editPath={editPath} />;
}
