/**
 * numbered — an editorial index. Hairlines draw across the measure; huge numerals fill with the
 * accent from the baseline up as each row reaches the reading line (scroll-driven, progressive);
 * copy sits on a contents-page grid whose columns hold on every row. Alternate rows carry a product
 * photo (the key figure riding on it in a glass chip), the others their key figure.
 */
import { Container, Picture, reveal } from "@/landing/primitives";
import { aspectOf, idx, pageFrame } from "./kit";
import type { ViewProps } from "./model";
import { Action, Fact, Head, Text, Title, photoPicker } from "./parts";

export function Numbered({ ctx, data, titleId }: ViewProps) {
  const pick = photoPicker(ctx, data.items);
  const d = 60;
  return (
    <Container className="lp-cq">
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <ol className="lp-benefits__list" role="list">
        {data.items.map((it, i) => {
          // odd rows take an unseen product photo; an item's own image always shows
          const photo = pick(it, i % 2 === 1);
          const hasFact = !!it.stat.trim();
          // a wide shot keeps a square frame (a 4:5 crop of it would slice the product)
          const wide = !!photo && aspectOf(photo) > 1.2;
          return (
            <li key={i} className="lp-benefits__row" data-aside={photo ? "media" : hasFact ? "fact" : undefined}>
              <span className="lp-benefits__rule" aria-hidden="true" {...reveal("wipe-side")} />
              <span className="lp-benefits__num" aria-hidden="true" {...reveal("wipe-up", d)}>
                <span className="lp-benefits__numin">{idx(i)}</span>
              </span>
              <div className="lp-benefits__copy" {...reveal("rise", d + 90)}>
                <Title ctx={ctx} item={it} i={i} />
                <Text ctx={ctx} item={it} i={i} />
              </div>
              {photo ? (
                <div className="lp-benefits__thumb">
                  <div className="lp-benefits__thumbpic" {...reveal("scale-in", d + 160)}>
                    <Picture
                      asset={photo}
                      sizes="(min-width: 48rem) 11rem, 8.5rem"
                      ratio={wide ? "1/1" : "4/5"}
                      mask="page"
                      frame={photo.alpha ? undefined : pageFrame(ctx, wide ? 1 : 0.8)}
                      alt=""
                      fit={photo.alpha ? "contain" : "cover"}
                    />
                  </div>
                  <Fact ctx={ctx} item={it} i={i} className="lp-benefits__thumbchip lp-glass" enter="blur-in" delay={d + 420} />
                </div>
              ) : (
                <Fact ctx={ctx} item={it} i={i} className="lp-benefits__aside" enter="rise" delay={d + 200} />
              )}
            </li>
          );
        })}
      </ol>
      <Action ctx={ctx} data={data} />
    </Container>
  );
}
