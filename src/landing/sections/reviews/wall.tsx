/**
 * wall — a bento of voices. Top row: the lead review as a large display quote (accent quote mark,
 * bottom-anchored signature) beside a color score tile (big counting numeral + the product in a lit
 * window with a glass name chip). Below, a bento of review cards: wide tinted cards with a larger
 * quote alternate with narrow ones. On phones it turns into a swipe rail, the next card peeking in.
 */
import type { ReactElement } from "react";
import type { SectionBg } from "@/lib/page/schema";
import { Container, Counter, Picture, SectionShell, Stars, cssVars, cx, pictureCrop, reveal, round } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { coverAt } from "./frames";
import { UI, type Data, type Item, type Props } from "./model";
import { countLabel, say, type Score } from "./parts";
import { Byline, CtaRow, Detail, Header, Photo, Quote, QuoteMark, ReviewTitle, Verified, productVisual, sectionScore, titleId } from "./shared";

/** The score tile is a color block that always contrasts with the section. */
const TILE_BG: Record<SectionBg, SectionBg> = {
  base: "accent",
  soft: "accent",
  surface: "accent",
  accent: "dark",
  dark: "accent",
  pop: "dark",
};

/**
 * Bento rows on the 3-column desktop grid: wide+narrow, three narrow, narrow+wide, three narrow…
 * With several customer photos every row gets a wide slot (wide+narrow / narrow+wide), so photos
 * never stretch a row of narrow cards. The last row always closes the rectangle.
 */
const ROWS: readonly (readonly number[])[] = [[2, 1], [1, 1, 1], [1, 2], [1, 1, 1]];
const PHOTO_ROWS: readonly (readonly number[])[] = [[2, 1], [1, 2]];

function bentoSpans(n: number, photos: number): number[] {
  const rows = photos > 1 ? PHOTO_ROWS : ROWS;
  const out: number[] = [];
  let wideFirst = false;
  for (let k = 0, left = n; left > 0; k++) {
    let row = rows[k % rows.length]!;
    if (left === 1) row = [3];
    else if (left === 2 && row.length !== 2) row = wideFirst ? [1, 2] : [2, 1];
    else if (left === 3 && rows === ROWS) row = [1, 1, 1];
    if (row.length === 2) wideFirst = row[0] === 2;
    out.push(...row);
    left -= row.length;
  }
  return out;
}

interface Slot {
  item: Item;
  /** index in data.items (edit paths) */
  i: number;
  span: number;
}

/**
 * Cards in their bento slots. Reviews with a customer photo take the wide slots first — the photo
 * sits beside the words there instead of stretching a narrow row; everything else keeps its order.
 */
function arrange(ctx: RenderContext, rest: readonly Item[]): Slot[] {
  const queue = rest.map((item, k) => ({ item, i: k + 1 }));
  const spans = bentoSpans(rest.length, queue.filter((x) => ctx.asset(x.item.photo)).length);
  const wide = spans.flatMap((s, k) => (s > 1 ? [k] : []));
  const pics = queue.filter((x) => ctx.asset(x.item.photo)).slice(0, wide.length);
  const placed = new Map(pics.map((x, j) => [wide[j]!, x]));
  const others = queue.filter((x) => !pics.includes(x));
  return spans.map((span, k) => ({ ...(placed.get(k) ?? others.shift()!), span }));
}

function Card({ ctx, data, slot: { item, i, span } }: { ctx: RenderContext; data: Data; slot: Slot }): ReactElement {
  const hasPhoto = !!ctx.asset(item.photo);
  return (
    <li className="lp-rv__cell" data-span={span > 1 ? span : undefined}>
      <figure className={cx("lp-card lp-rv__card", hasPhoto && "lp-rv__card--photo")} data-tone={span > 1 ? "tint" : undefined} {...reveal("rise")}>
        {/* a wide card sets its photo as a portrait column beside the words (desktop) */}
        <Photo
          ctx={ctx}
          item={item}
          ratio="16/10"
          ratioLg={span > 1 ? "4/5" : undefined}
          sizes="(min-width: 64rem) 22rem, (min-width: 40rem) 45vw, 80vw"
          className="lp-rv__card-photo"
        />
        <div className="lp-rv__body">
          <div className="lp-rv__top">
            <Stars ctx={ctx} value={item.rating} size="s" />
            <Verified ctx={ctx} item={item} data={data} />
          </div>
          <ReviewTitle ctx={ctx} item={item} i={i} />
          <Quote ctx={ctx} item={item} i={i} />
          {/* with the words, not under the signature: every signature in a row stays on one line */}
          <Detail ctx={ctx} item={item} i={i} />
        </div>
        <figcaption className="lp-rv__foot">
          <Byline ctx={ctx} item={item} i={i} />
        </figcaption>
      </figure>
    </li>
  );
}

function LeadCard({ ctx, data, item }: { ctx: RenderContext; data: Data; item: Item }): ReactElement {
  const hasPhoto = !!ctx.asset(item.photo);
  return (
    <figure className={cx("lp-card lp-rv__card lp-rv__lead", hasPhoto && "lp-rv__lead--photo")} {...reveal("blur-in")}>
      <div className="lp-rv__lead-head">
        <span className="lp-rv__lead-qm" {...reveal("stamp", 260)}>
          <QuoteMark />
        </span>
        <span className="lp-rv__lead-rate">
          <Stars ctx={ctx} value={item.rating} size="m" />
          <Verified ctx={ctx} item={item} data={data} />
        </span>
      </div>
      <Quote ctx={ctx} item={item} i={0} className="lp-rv__quote--lead" />
      {/* under the words on phones, a portrait column beside them on desktop */}
      <Photo ctx={ctx} item={item} ratio="16/10" ratioLg="4/5" sizes="(min-width: 64rem) 16rem, 88vw" className="lp-rv__lead-photo" />
      <figcaption className="lp-rv__foot">
        <Byline ctx={ctx} item={item} i={0} size="l" />
        <Detail ctx={ctx} item={item} i={0} />
      </figcaption>
    </figure>
  );
}

/**
 * Window ratios of the tile's photo on desktop (it fills the tile's free height): a landscape under
 * the score, a portrait filling the whole tile when there is no honest score to show.
 */
const TILE_LG = { score: 4 / 3, alone: 0.7 } as const;

/**
 * The edge of the tile's window where the name chip (a band `h` of the frame tall) covers no face,
 * hand or product — checked with the crop fitted for `lg` (no zoom) seen in every shape the window
 * really takes: it fills the tile's free height, so it stretches from `lg` up to ≈ 1.35 × wider.
 */
function tileChipBand(prod: ResolvedAsset, lg: number, h: number): "top" | "bottom" | null {
  const crop = pictureCrop(prod, { frame: { shape: "rounded", ratio: lg, maxZoom: 1 } });
  const shapes = [1, 1.12, 1.24, 1.36].map((k) => lg * k);
  const clear = (y: number) => shapes.every((r) => coverAt(prod, r, crop, { y, h }) < 0.04);
  return clear(1 - h) ? "bottom" : clear(0) ? "top" : null;
}

function ScoreTile({ ctx, score, prod, bg }: { ctx: RenderContext; score: Score | null; prod: ResolvedAsset | null; bg: SectionBg }) {
  const label = score ? say(ctx, score.fromProduct ? UI.average : UI.shown) : undefined;
  // alone, a landscape photo keeps its own proportions (a portrait window would clip the product)
  // with the name set under it; a portrait photo fills the tile
  const wide = !score && !!prod && !prod.alpha && prod.width > prod.height * 1.05;
  const lg = score ? TILE_LG.score : wide ? Math.min(1.45, prod!.width / prod!.height) : TILE_LG.alone;
  // the name chip sits on the photo's edge that holds no face and no hands; beside it otherwise
  const at = prod ? (prod.alpha ? "bottom" : wide ? "below" : (tileChipBand(prod, lg, 0.17) ?? "below")) : undefined;
  return (
    <aside
      className={cx("lp-rv__tile", score && prod && "lp-rv__tile--both", !score && "lp-rv__tile--prod", wide && "lp-rv__tile--wide", prod?.alpha && "lp-rv__tile--cutout")}
      data-bg={TILE_BG[bg]}
      style={wide ? cssVars({ "--tile-ar": round(lg, 3) }) : undefined}
      aria-label={label}
      aria-hidden={score ? undefined : true}
      {...reveal("scale-in", 120)}
    >
      {score ? (
        <div className="lp-rv__tile-score">
          <p className="lp-rv__tile-lab lp-label">{label}</p>
          <p className="lp-rv__tile-num lp-num" dir="ltr">
            <Counter ctx={ctx} to={score.value} decimals={1} delay={160} />
            <span className="lp-rv__tile-of" aria-hidden="true">
              /{ctx.num(5)}
            </span>
          </p>
          <span className="lp-rv__tile-meta">
            <Stars ctx={ctx} value={score.value} size="m" />
            <span className="lp-rv__tile-count">{countLabel(ctx, score.count)}</span>
          </span>
        </div>
      ) : null}
      {prod ? (
        <div className="lp-rv__tile-media" data-at={at}>
          <Picture
            asset={prod}
            sizes="(min-width: 64rem) 24rem, (min-width: 40rem) 36vw, 40vw"
            ratio={prod.alpha ? "1" : "4/3"}
            fit={prod.alpha ? "contain" : "cover"}
            frame={prod.alpha ? undefined : { shape: "rounded", ratio: "4/3" }}
            // no zoom: the name chip is placed from this exact crop
            frameLg={prod.alpha ? undefined : { shape: "rounded", ratio: lg, maxZoom: 1 }}
            className="lp-rv__tile-pic"
            alt=""
          />
          {/* Latin product names keep their own direction on Arabic pages (an ellipsis cuts their end, never their start) */}
          <span className={at === "below" ? "lp-rv__tile-name" : "lp-rv__tile-chip lp-glass"}>
            <bdi className="lp-rv__ell">{ctx.product.name}</bdi>
          </span>
        </div>
      ) : null}
    </aside>
  );
}

export function Wall({ id, ctx, data, bg }: Props): ReactElement {
  const score = sectionScore(ctx, data);
  const prod = productVisual(ctx);
  const tile = !!score || !!prod;
  const [lead, ...rest] = data.items;
  return (
    <SectionShell id={id} ctx={ctx} type="reviews" variant="wall" bg={bg} labelledBy={titleId(id)}>
      <Container>
        <Header ctx={ctx} data={data} id={id} align="split" />
        <div className={cx("lp-rv__bento", tile && "lp-rv__bento--tile")}>
          {lead ? <LeadCard ctx={ctx} data={data} item={lead} /> : null}
          {tile ? <ScoreTile ctx={ctx} score={score} prod={prod} bg={bg} /> : null}
        </div>
        {rest.length ? (
          <ul className="lp-rv__wall" role="list" data-n={rest.length} data-stagger="80">
            {arrange(ctx, rest).map((slot) => (
              <Card key={slot.i} ctx={ctx} data={data} slot={slot} />
            ))}
          </ul>
        ) : null}
        <CtaRow ctx={ctx} data={data} />
      </Container>
    </SectionShell>
  );
}
