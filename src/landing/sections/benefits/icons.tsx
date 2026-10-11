/**
 * icons — the compact "at a glance" sheet: one raised panel ruled into cells by crisp hairlines,
 * each benefit with a custom icon in a tinted squircle. A product photo takes the panel's leading
 * column — a banner on phones, and on every screen when the shot is landscape (a tall crop of a wide
 * photo loses the product) — with the first key figure riding on it in a glass chip. Cells glow
 * softly under the pointer; icons pop in on a spring.
 */
import { Container, Icon, Picture, cssVars, reveal, round } from "@/landing/primitives";
import { aspectOf, fitProps, isPerson } from "./kit";
import type { ViewProps } from "./model";
import { Action, Fact, Head, Text, Title, photoPool } from "./parts";

export function Icons({ ctx, data, titleId }: ViewProps) {
  const n = data.items.length;
  const pool = photoPool(ctx);
  // the side column wants an upright shot: take the first one, else the first photo as a banner
  const photo = pool.find((p) => p.height >= p.width) ?? pool[0] ?? null;
  const media = photo ? (photo.width > photo.height * 1.08 ? "wide" : "side") : undefined;
  // phones: an upright figure keeps a portrait frame (head to hands), a product a square, a wide shot
  // a 16:10 banner; tablets up: the side column runs the panel's height (≈ 1:2 to 3:4), the banner 21:8
  const base = media === "wide" ? 1.6 : isPerson(photo) || aspectOf(photo) < 0.75 ? 0.8 : 1;
  const fit = photo ? fitProps(photo, "rounded", base, media === "wide" ? [21 / 8, 21 / 8] : [0.5, 0.75], "48rem") : {};
  const factAt = data.items.findIndex((it) => !!it.stat.trim());
  return (
    <Container className="lp-benefits__compact lp-cq">
      <Head ctx={ctx} data={data} titleId={titleId} align="center" />
      <div className="lp-benefits__panel" data-count={n} data-media={media} style={cssVars({ "--mr": round(base, 4) })} {...reveal("rise", 40)}>
        {photo ? (
          <div className="lp-benefits__pmedia">
            <Picture
              asset={photo}
              sizes={media === "wide" ? "(min-width: 66rem) 66rem, 92vw" : "(min-width: 48rem) 22rem, 92vw"}
              className="lp-benefits__pmpic"
              alt=""
              fit={photo.alpha ? "contain" : "cover"}
              {...fit}
            />
            {factAt >= 0 ? <Fact ctx={ctx} item={data.items[factAt]!} i={factAt} className="lp-benefits__pchip lp-glass" enter="blur-in" delay={420} /> : null}
          </div>
        ) : null}
        <ul className="lp-benefits__cells" role="list">
          {data.items.map((it, i) => (
            <li key={i} className="lp-benefits__cell" {...reveal("rise", 120 + i * 70)}>
              <span className="lp-benefits__ico" aria-hidden="true" {...reveal("stamp", 220 + i * 70)}>
                <Icon name={it.icon} size="100%" strokeWidth={1.6} />
              </span>
              <div className="lp-benefits__cellcopy">
                <Title ctx={ctx} item={it} i={i} />
                <Text ctx={ctx} item={it} i={i} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <Action ctx={ctx} data={data} center />
    </Container>
  );
}
