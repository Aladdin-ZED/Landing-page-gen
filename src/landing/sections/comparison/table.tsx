/**
 * table — the "us vs them" grid, made modern (think of a product compare page): criteria · ours ·
 * theirs. Our column is one raised, lit card standing over the grid; the product sits in a framed
 * tile at its head that breaks out above the card's top edge, a check badge pinned to its corner
 * (a cutout stands free on a lit floor instead, half of it above the card).
 * On reveal the card rises on a spring, a single sheen of light sweeps across it, the rows land in
 * a stagger and the checks draw on down the column. Theirs stays flat and quiet: hairline rings,
 * muted ink. Real ARIA table semantics on a CSS grid; three columns down to 320px (cells stack mark
 * over text on phones). Desktop: the heading and the order button hold the start column, the board
 * the end column.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Icon, Picture, RichText, SectionHeader, cx, reveal } from "@/landing/primitives";
import { density, productShots } from "../benefits/kit";
import { bestShot } from "../story/fit";
import type { ViewProps } from "./model";
import { Foot, Label, Mark, pickVisual, themKind, words } from "./parts";

/** The product tile's frame on narrow boards (wider boards: 1 : 0.7). */
const TILE = { shape: "rounded" as const, ratio: 1 / 0.82 };

/** Pace: the card rises, the names and the tile land on it, then rows every 80ms and checks every 120ms. */
const HEAD_AT = 160;
const TILE_AT = 240;
const ROW_START = 200;
const ROW_STEP = 80;
const CHECK_START = 560;
const CHECK_STEP = 120;

export function Table({ ctx, data, titleId }: ViewProps): ReactElement {
  // the column's tile is small: the shot that reads best in its landscape frame (a single bust over a
  // group portrait, a product filling it) unless the merchant chose one
  const visual = data.image ? pickVisual(ctx, data, "cutout") : (ctx.asset(ctx.product.cutout) ?? bestShot(productShots(ctx), TILE) ?? pickVisual(ctx, data, "cutout"));
  const w = words(ctx);
  const n = data.rows.length;
  return (
    <Container className="lp-comparison__layout">
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} size="m" className="lp-comparison__head" />

      <div className="lp-comparison__stage lp-cq">
        <div className={cx("lp-comparison__board", !visual && "lp-comparison__board--bare", visual?.alpha && "lp-comparison__board--cutout")} role="table" aria-labelledby={titleId}>
          {density(ctx) > 0 ? (
            <span className="lp-comparison__halo" aria-hidden="true">
              <GlowOrb className="lp-comparison__glow" size="150%" shape="tall" place="center" intensity="medium" />
            </span>
          ) : null}
          <span className="lp-comparison__col" aria-hidden="true" {...reveal("fade", 60)} />

          <div role="rowgroup" className="lp-comparison__thead">
            <div role="row" className="lp-comparison__row lp-comparison__row--head" {...reveal("fade", HEAD_AT)}>
              <div role="columnheader" className="lp-comparison__corner">
                <span className="lp-visually-hidden">{w.criterion}</span>
              </div>
              <div role="columnheader" className="lp-comparison__us">
                {visual ? (
                  <span className={cx("lp-comparison__tile", visual.alpha && "lp-comparison__tile--cutout")} {...reveal("scale-in", TILE_AT)}>
                    {/* fitted to the tile's own frame: 1 : 0.82 on narrow boards, 1 : 0.7 once the board is roomy */}
                    <Picture
                      asset={visual}
                      sizes="(min-width: 62rem) 16rem, 36vw"
                      fit={visual.alpha ? "contain" : "cover"}
                      frame={TILE}
                      frameLg={{ shape: "rounded", ratio: 1 / 0.7 }}
                      frameMin="40rem"
                      alt=""
                      className="lp-comparison__tilepic"
                    />
                    {visual.alpha ? null : (
                      <span className="lp-comparison__badge" aria-hidden="true" {...reveal("stamp", TILE_AT + 380)}>
                        <Icon name="check" size="1em" strokeWidth={2.6} />
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="lp-comparison__seal" aria-hidden="true" {...reveal("stamp", TILE_AT)}>
                    <Icon name="check" size="1em" strokeWidth={2.4} />
                  </span>
                )}
                <Label ctx={ctx} text={data.usLabel} path="usLabel" className="lp-comparison__colname" />
              </div>
              <div role="columnheader" className="lp-comparison__them">
                <Label ctx={ctx} text={data.themLabel} path="themLabel" className="lp-comparison__colname" />
              </div>
            </div>
          </div>

          <div role="rowgroup" className="lp-comparison__tbody">
            {data.rows.map((row, i) => (
              <div role="row" key={i} className="lp-comparison__row" {...reveal("rise", ROW_START + i * ROW_STEP)}>
                <div role="rowheader" className="lp-comparison__label">
                  <RichText as="span" text={row.label} ctx={ctx} decorate={false} editPath={`rows.${i}.label`} />
                </div>
                <div role="cell" className="lp-comparison__cell lp-comparison__cell--us">
                  <Mark ctx={ctx} kind="yes" delay={CHECK_START + i * CHECK_STEP} quiet={!!row.us.trim()} />
                  {row.us.trim() ? <RichText as="span" className="lp-comparison__val" text={row.us} ctx={ctx} decorate={false} editPath={`rows.${i}.us`} /> : null}
                </div>
                <div role="cell" className="lp-comparison__cell lp-comparison__cell--them">
                  <Mark ctx={ctx} kind={themKind(row)} delay={CHECK_START + 60 + i * CHECK_STEP} quiet={!row.partial && !!row.them.trim()} />
                  {row.them.trim() ? <RichText as="span" className="lp-comparison__val" text={row.them} ctx={ctx} decorate={false} editPath={`rows.${i}.them`} /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Foot ctx={ctx} data={data} delay={ROW_START + n * ROW_STEP} />
    </Container>
  );
}
