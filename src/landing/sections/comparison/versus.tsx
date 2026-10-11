/**
 * versus — a duel of two cards split by a "VS" disc. Ours is the big, vivid card: product photo (or
 * cutout on a lit stage) with a glass name chip, the checks and the order button. Theirs is quiet,
 * flat and smaller, its points marked by hairline crosses. The disc sits on the seam inside thin
 * rings, pops in once both cards have landed and rolls upright as the duel reaches mid-screen.
 * Desktop is asymmetric: the heading and the alternatives' card share the start column, our card
 * runs the full height of the end column (the climax of the read, with the button). Tablet: heading
 * on top, the two cards side by side. Phones: stacked, ours first, the disc bridging the two.
 */
import type { ReactElement } from "react";
import { GlassChip, GlowOrb, Rings } from "@/landing/illustrations";
import { Cta, Icon, Picture, RichText, SectionHeader, cssVars, cx, editAttr, reveal } from "@/landing/primitives";
import { density, nestedBg, shortName } from "../benefits/kit";
import { placeOverlay, type Spot } from "../story/fit";
import type { ComparisonRow, ViewProps } from "./model";

/** Name chip spots on our photo: a bottom corner first, then a top one — never over a face or a hand. */
const CHIP_SPOTS: readonly Spot[] = ["bs", "be", "ts", "te"];
import { Foot, Label, Mark, pickVisual, themKind, type MarkKind } from "./parts";

const ITEM_STEP = 90;

function Item({ ctx, row, i, side, delay }: { ctx: ViewProps["ctx"]; row: ComparisonRow; i: number; side: "us" | "them"; delay: number }): ReactElement {
  const value = (side === "us" ? row.us : row.them).trim();
  const kind: MarkKind = side === "us" ? "yes" : themKind(row);
  return (
    <li className="lp-comparison__item" {...reveal("rise", delay)}>
      <Mark ctx={ctx} kind={kind} delay={delay + 140} quiet={kind !== "partial"} />
      <span className="lp-comparison__itext">
        <RichText as="span" className="lp-comparison__ilabel" text={row.label} ctx={ctx} decorate={false} editPath={`rows.${i}.label`} />
        {value ? <RichText as="span" className="lp-comparison__ivalue" text={value} ctx={ctx} decorate={false} editPath={`rows.${i}.${side}`} /> : null}
      </span>
    </li>
  );
}

export function Versus({ ctx, data, id, bg, titleId }: ViewProps): ReactElement {
  const visual = pickVisual(ctx, data, "cutout");
  const vivid = nestedBg(ctx, bg, ["accent", "dark", "pop"]);
  const vs = data.vs.trim();
  const rich = density(ctx) > 0;
  // our photo: 4:3 on phones, 16:10 side by side — the chip takes the spot that is quiet in both
  const dir = ctx.dir === "rtl" ? "rtl" : "ltr";
  const chipAt =
    visual && !visual.alpha
      ? placeOverlay(visual, { shape: "rounded", ratio: 4 / 3 }, CHIP_SPOTS, { chip: { w: 0.62, h: 0.13 }, dir, inset: { x: 0.035, y: 0.045 } }).spot
      : "bs";
  return (
    // the .lp-container itself (Container takes no style): --n, the row count, lets wide layouts give
    // both cards the same row tracks (subgrid) so every hairline runs across the duel at one height
    <div
      className={cx("lp-container lp-comparison__arena", vs ? "lp-comparison__arena--vs" : "lp-comparison__arena--novs", !data.cta && "lp-comparison__arena--nocta")}
      style={cssVars({ "--n": Math.max(1, data.rows.length) })}
    >
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} size="m" className="lp-comparison__head" />

      <article className="lp-comparison__card lp-comparison__card--us" data-bg={vivid} aria-labelledby={`${id}-us`} {...reveal("rise")}>
        {rich ? <GlowOrb className="lp-comparison__glow" size="120%" place="top-end" intensity="strong" idle="drift" /> : null}
        {visual ? (
          <div className={cx("lp-comparison__media", visual.alpha && "lp-comparison__media--cutout")} {...reveal("scale-in", 120)}>
            <Picture
              asset={visual}
              sizes="(min-width: 62rem) 34rem, (min-width: 48rem) 52vw, 92vw"
              fit={visual.alpha ? "contain" : "cover"}
              frame={visual.alpha ? undefined : { shape: "rounded", ratio: 4 / 3 }}
              frameLg={visual.alpha ? undefined : { shape: "rounded", ratio: 16 / 10 }}
              frameMin="48rem"
              className="lp-comparison__vpic"
            />
            <span className="lp-comparison__mchipat" data-at={chipAt}>
              <GlassChip glass="dark" size="s" className="lp-comparison__mchip">
                <Icon name="check" size="1em" strokeWidth={2.4} />
                {/* a Latin name on an Arabic page keeps its own direction: a long one ends in “…”, never starts with it */}
                <bdi className="lp-comparison__mname">{shortName(ctx.product.name)}</bdi>
              </GlassChip>
            </span>
          </div>
        ) : null}
        <h3 className="lp-comparison__ctitle" id={`${id}-us`}>
          <span className="lp-comparison__cmark" aria-hidden="true">
            <Icon name="check" size="0.9em" strokeWidth={2.6} />
          </span>
          <Label ctx={ctx} text={data.usLabel} path="usLabel" />
        </h3>
        <ul className="lp-comparison__list" role="list">
          {data.rows.map((row, i) => (
            <Item key={i} ctx={ctx} row={row} i={i} side="us" delay={260 + i * ITEM_STEP} />
          ))}
        </ul>
        {data.cta ? <Cta ctx={ctx} label={data.ctaLabel} size="l" wide editPath="ctaLabel" className="lp-comparison__cardcta" /> : null}
      </article>

      {vs ? (
        <div className="lp-comparison__vs" aria-hidden="true">
          {rich ? <Rings className="lp-comparison__rings" count={3} spread={0.62} tone="line" reveal delay={420} /> : null}
          <span className="lp-comparison__disc" {...reveal("stamp", 380)}>
            <span {...editAttr(ctx, "vs")}>{vs}</span>
          </span>
        </div>
      ) : null}

      <article className="lp-comparison__card lp-comparison__card--them" aria-labelledby={`${id}-them`} {...reveal("rise", 160)}>
        <h3 className="lp-comparison__ctitle" id={`${id}-them`}>
          <span className="lp-comparison__cmark" aria-hidden="true">
            <Icon name="x" size="0.85em" strokeWidth={2.2} />
          </span>
          <Label ctx={ctx} text={data.themLabel} path="themLabel" />
        </h3>
        <ul className="lp-comparison__list" role="list">
          {data.rows.map((row, i) => (
            <Item key={i} ctx={ctx} row={row} i={i} side="them" delay={320 + i * ITEM_STEP} />
          ))}
        </ul>
      </article>

      <Foot ctx={ctx} data={data} button={false} delay={200} />
    </div>
  );
}
