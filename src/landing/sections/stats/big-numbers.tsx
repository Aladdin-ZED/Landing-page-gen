/**
 * big-numbers — the lead figure is the focal point: set enormous inside a lit panel in a contrasting
 * color block, a light-tipped meter drawing to the claimed share over its own scale ("0 … 24 h").
 * The product rises out over the panel's top edge: a portrait shot or cutout in a tall window at the
 * panel's end (a cutout stands free in the panel's light), a landscape shot in a broad window above
 * the figure. The other figures follow as an editorial index beside it — hairlines that draw
 * across, figures that roll up, no boxes.
 */
import { DotGrid, GlowOrb, GridLines, ZelligeLines } from "@/landing/illustrations";
import { Container, cssVars, editAttr, reveal } from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { density, fitProps, nestedBg, pageShape } from "../benefits/kit";
import { figureLength, fractionOf, statsVisual, type ViewProps } from "./model";
import { Figure, Foot, Head, Label, Meter, Visual, hasSource, idx } from "./parts";

/** Archetypes whose numerals stay in ink (Swiss / tech restraint); the others set the lead figure in the accent. */
const INK_FIGURE = new Set<RenderContext["archetype"]>(["editorial", "circuit"]);

/** The archetype's quiet structure in the panel's corner: a measured grid, zellige line geometry or a dot matrix. */
function PanelTexture({ ctx, id }: { ctx: RenderContext; id: string }) {
  switch (ctx.archetype) {
    case "circuit":
    case "garage":
    case "editorial":
      return <GridLines cell={32} major={4} fade="none" className="lp-stats__tex" />;
    case "souk":
      return <ZelligeLines uid={`${id}-zl`} variant="rosette" tile={96} opacity={0.09} fade="none" className="lp-stats__tex" />;
    case "apothecary":
      return <DotGrid cell={16} fade="none" className="lp-stats__tex" />;
    default:
      return null;
  }
}

export function BigNumbers({ ctx, data, id, bg, titleId }: ViewProps) {
  const [lead, ...rest] = data.items;
  if (!lead) return null;
  const marked = hasSource(data);
  const visual = statsVisual(ctx, data);
  const panelBg = nestedBg(ctx, bg, ["dark", "accent", "pop"]);
  const f = fractionOf(lead);
  const glow = density(ctx) > 0;
  // landscape shots would lose the product in a tall crop
  const wide = !!visual && visual.width > visual.height * 1.08;
  return (
    <Container>
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <ul className="lp-stats__grid" role="list" data-count={data.items.length} style={cssVars({ "--rest": rest.length })}>
        <li
          className="lp-stats__hero"
          data-bg={panelBg}
          data-media={visual ? (visual.alpha ? "cutout" : "photo") : undefined}
          data-shape={visual ? (wide ? "wide" : "tall") : undefined}
          data-tone={INK_FIGURE.has(ctx.archetype) ? "ink" : undefined}
          {...reveal("scale-in", 60)}
        >
          {/* the light is clipped to the panel; the product is free to rise out over its edge */}
          <span className="lp-stats__light" aria-hidden="true">
            {glow ? <PanelTexture ctx={ctx} id={id} /> : null}
            {glow ? <GlowOrb place="top-end" size="90%" intensity="medium" idle="drift" /> : null}
          </span>
          <span className="lp-stats__meta" aria-hidden="true" {...reveal("fade", 260)}>
            <span className="lp-stats__idx">{idx(0)}</span>
            <span className="lp-stats__metaline" />
          </span>
          {visual ? (
            <span className="lp-stats__media" {...editAttr(ctx, "image")} {...reveal(visual.alpha ? "rise" : wide ? "wipe-up" : "mask-arch", 180)}>
              <Visual
                asset={visual}
                mask={wide ? "rounded" : "page"}
                sizes={wide ? "(min-width: 60rem) 22rem, 90vw" : "(min-width: 60rem) 18rem, 42vw"}
                fit={
                  // wide: 16:10 on phones, 4:3 from tablets; tall: 4:5 on phones, the panel's height on
                  // desktop (≈ 1:2) — one crop that holds over that span
                  wide ? fitProps(visual, "rounded", 1.6, [4 / 3, 4 / 3], "36rem") : fitProps(visual, pageShape(ctx), 0.8, [0.48, 0.64], "60rem")
                }
              />
            </span>
          ) : null}
          <p className="lp-stats__fit lp-stats__heronum" style={cssVars({ "--len": figureLength(ctx, lead) })}>
            <Figure ctx={ctx} it={lead} i={0} className="lp-stats__fig--hero" delay={140} />
          </p>
          {f !== null ? <Meter f={f} delay={520} className="lp-stats__meter--hero" scale={{ ctx, it: lead }} /> : null}
          <Label ctx={ctx} it={lead} i={0} marked={marked} className="lp-stats__label--hero" />
        </li>
        {rest.map((it, k) => {
          const i = k + 1;
          const fr = fractionOf(it);
          return (
            <li key={i} className="lp-stats__row" {...reveal("rise", 160 + k * 120)}>
              <span className="lp-stats__rowhead" aria-hidden="true">
                <span className="lp-stats__idx">{idx(i)}</span>
                <span className="lp-stats__rule" {...reveal("wipe-side", 260 + k * 120)} />
              </span>
              <p className="lp-stats__fit lp-stats__rownum" style={cssVars({ "--len": figureLength(ctx, it) })}>
                <Figure ctx={ctx} it={it} i={i} className="lp-stats__fig--row" delay={200 + k * 120} />
              </p>
              {fr !== null ? <Meter f={fr} delay={520 + k * 120} /> : null}
              <Label ctx={ctx} it={it} i={i} marked={marked} />
            </li>
          );
        })}
      </ul>
      <Foot ctx={ctx} data={data} />
    </Container>
  );
}
