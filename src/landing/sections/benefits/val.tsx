/**
 * Short value text shared by the story sections (a size, a share, a duration, a figure caption, a
 * source line) that keeps its reading order in both directions:
 *  - without Arabic letters it is one left-to-right unit, even on an Arabic page
 *    ("2 × 1 200 mAh", "24–48 h", "SPF 50+");
 *  - with Arabic letters it goes through RichText, which isolates its numeric expressions
 *    ("24–48 ساعة" never turns into "48–24").
 * A bare `<bdi>` is not enough: a dir=auto isolate takes the direction of its first strong letter, so
 * an Arabic value reverses its ranges all the same.
 */
import type { ReactElement } from "react";
import { RichText } from "@/landing/primitives";
import type { RenderContext } from "../../types";

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function Val({ ctx, text, className, editPath }: { ctx: RenderContext; text: string; className?: string; editPath?: string }): ReactElement | null {
  const v = text.trim();
  if (!v) return null;
  const body = <RichText as="span" className={ARABIC.test(v) ? className : undefined} text={v} ctx={ctx} editPath={editPath} decorate={false} />;
  return ARABIC.test(v) ? (
    body
  ) : (
    <bdi dir="ltr" className={className}>
      {body}
    </bdi>
  );
}
