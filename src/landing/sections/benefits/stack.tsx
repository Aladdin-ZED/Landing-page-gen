/**
 * stack — sticky stacking cards. Each benefit is a large rounded card (own color block, photo, big
 * type) that pins under the previous one as you scroll; the cards behind recede into a deck (scale
 * + dim, CSS scroll-driven where supported — plain sticky stacking elsewhere). Cards past the
 * product photos carry a lit plate: their figure set large, or their index as a supergraphic.
 */
import { Container, Icon, Picture, cssVars, reveal, round } from "@/landing/primitives";
import type { SectionBg } from "@/lib/page/schema";
import type { RenderContext } from "../../types";
import { aspectOf, bgFamily, fitProps, idx, nestedBg } from "./kit";
import type { ViewProps } from "./model";
import { Action, Fact, Head, Plate, Text, Title, photoPicker } from "./parts";

/**
 * Color blocks cycle card → accent → ink, each contrasting with the section itself. On a dark
 * section the ink block would melt in, so the deck alternates card / accent instead of reaching for
 * the pop color (often a complementary hue that fights the product's own).
 */
function cardBg(ctx: RenderContext, i: number, bg: SectionBg): SectionBg | undefined {
  const k = i % (bgFamily(ctx, bg) === "dark" ? 2 : 3);
  if (k === 0) return undefined;
  return k === 1 ? nestedBg(ctx, bg, ["accent", "pop", "dark"]) : nestedBg(ctx, bg, ["dark", "pop", "accent"]);
}

export function Stack({ ctx, data, titleId, bg }: ViewProps) {
  const pick = photoPicker(ctx, data.items);
  const n = data.items.length;
  return (
    <Container className="lp-cq">
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <ol className="lp-benefits__stack" role="list" style={cssVars({ "--n": n })}>
        {data.items.map((it, i) => {
          const photo = pick(it);
          // without a photo the plate shows the figure (or, lacking one, the icon) — never twice
          const plateFigure = !photo && !!it.stat.trim();
          const plateIcon = !photo && !plateFigure;
          // phones: the photo row takes the frame the shot suits (4:5 upright, 1:1 squarish, 4:3 wide)
          // while the screen has room for the whole card, giving way first on short screens; desktop:
          // the photo column runs the card's height (≈ 1:1 to 6:5)
          const A = aspectOf(photo);
          const base = A < 0.9 ? 0.8 : A <= 1.2 ? 1 : 4 / 3;
          const fit = photo ? fitProps(photo, "rounded", base, [0.95, 1.2], "56rem") : {};
          return (
            <li key={i} className="lp-benefits__card" style={cssVars({ "--i": i })}>
              <article className="lp-benefits__cardin" data-bg={cardBg(ctx, i, bg)} style={cssVars({ "--mr": photo ? round(base, 4) : undefined })}>
                <div className="lp-benefits__cardcopy">
                  <div className="lp-benefits__cardtop" {...reveal("fade", 80)}>
                    <span className="lp-benefits__idx" aria-hidden="true">
                      <bdi dir="ltr">{idx(i)}</bdi>
                    </span>
                    {plateIcon ? null : (
                      <span className="lp-benefits__ico" aria-hidden="true">
                        <Icon name={it.icon} size="100%" strokeWidth={1.6} />
                      </span>
                    )}
                  </div>
                  <div className="lp-benefits__cardmain" {...reveal("rise", 140)}>
                    <Title ctx={ctx} item={it} i={i} className="lp-benefits__t--xl" />
                    <Text ctx={ctx} item={it} i={i} className="lp-benefits__p--l" />
                    {plateFigure ? null : <Fact ctx={ctx} item={it} i={i} delay={320} />}
                  </div>
                </div>
                <div className="lp-benefits__cardmedia" {...reveal("scale-in", 60)}>
                  {photo ? (
                    <Picture
                      asset={photo}
                      sizes="(min-width: 56rem) 34rem, 92vw"
                      className="lp-benefits__cardpic"
                      alt=""
                      fit={photo.alpha ? "contain" : "cover"}
                      {...fit}
                    />
                  ) : (
                    <Plate ctx={ctx} item={it} i={i} className="lp-benefits__cardpic" />
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      <Action ctx={ctx} data={data} />
    </Container>
  );
}
