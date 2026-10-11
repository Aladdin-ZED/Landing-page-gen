/**
 * summary — an honest review module: one large board with a tinted score column nested inside
 * (gauge ring drawing to the score with a lit knob at its end, numeral counting up, real star
 * distribution filling in, the product in a window filling the rest of the column) next to a clean
 * feed of the best reviews separated by hairlines.
 */
import type { ReactElement } from "react";
import { Container, Counter, Picture, SectionShell, Stars, cssVars, cx, reveal, round } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { chipBand } from "./frames";
import { UI, type Data, type Props } from "./model";
import { StarGlyph, countLabel, say, type Score } from "./parts";
import { Byline, CtaRow, Detail, Header, Photo, Quote, ReviewTitle, Verified, gaugeArc, gaugePoint, productVisual, sectionScore, titleId } from "./shared";

const STAR_KEYS = ["five", "four", "three", "two", "one"] as const;
const FEED_MAX = 4;

/**
 * Star distribution, honest by construction: the admin's real counts when set; otherwise counts of
 * the reviews shown — but only when the headline score is that same average (no product rating),
 * so the bars never pretend to describe a larger total.
 */
function distribution(data: Data, score: Score): number[] | null {
  const real = STAR_KEYS.map((k) => data.breakdown[k]);
  if (real.some((v) => v > 0)) return real;
  if (score.fromProduct) return null;
  return [5, 4, 3, 2, 1].map((s) => data.items.filter((x) => x.rating === s).length);
}

function Gauge({ ctx, score }: { ctx: RenderContext; score: Score }) {
  const f = score.value / 5;
  const end = gaugePoint(f);
  return (
    <div className="lp-rv__gauge">
      <svg className="lp-rv__gauge-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className="lp-rv__gauge-track" cx="60" cy="60" r="52" />
        <path className="lp-rv__gauge-arc lp-draw" d={gaugeArc(f)} pathLength={1} {...reveal("draw", 200)} />
        <circle className="lp-rv__gauge-knob" cx={end.x} cy={end.y} r="5" {...reveal("stamp", 1000)} />
      </svg>
      <p className="lp-rv__gauge-num lp-num" dir="ltr">
        <Counter ctx={ctx} to={score.value} decimals={1} delay={200} />
        <span className="lp-rv__gauge-of" aria-hidden="true">
          /{ctx.num(5)}
        </span>
      </p>
    </div>
  );
}

function Bars({ ctx, dist }: { ctx: RenderContext; dist: number[] }) {
  const total = dist.reduce((a, b) => a + b, 0);
  return (
    <ul className="lp-rv__bars" role="list" aria-label={say(ctx, UI.spread)} data-stagger="90">
      {dist.map((c, k) => {
        const pct = total > 0 ? Math.round((c / total) * 100) : 0;
        const pctText = `${ctx.num(pct)}%`;
        return (
          <li key={k} className="lp-rv__bar" {...reveal("fade")}>
            <span className="lp-visually-hidden">{say(ctx, UI.starsN).replace("{n}", ctx.num(5 - k)).replace("{p}", pctText)}</span>
            <span className="lp-rv__bar-lab" aria-hidden="true">
              {ctx.num(5 - k)}
              <StarGlyph />
            </span>
            <span className="lp-rv__bar-track" aria-hidden="true">
              <span className="lp-rv__bar-fill" style={cssVars({ "--w": `${pct}%` })} {...reveal("wipe-side", 120)} />
            </span>
            <bdi dir="ltr" className="lp-rv__bar-n" aria-hidden="true">
              {pctText}
            </bdi>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The product the reviews are about, closing the side column: a chip on phones, a window that fills
 * the rest of the column beside the feed on wide screens, its name on a glass chip along the photo's
 * edge that holds no face and no hands (under the window when neither edge is clear).
 */
function ProductWindow({ ctx, prod }: { ctx: RenderContext; prod: ResolvedAsset }) {
  // the window may grow a little taller than the photo's own proportions (a fifth more, a light
  // cover crop; never past a 2:3 portrait), so a landscape shot is never stretched into a tall crop;
  // cutouts stand in a square-ish stage
  const ar = prod.alpha || !prod.width || !prod.height ? 1.18 : Math.min(1.5, Math.max(0.75, (prod.height / prod.width) * 1.2));
  const lg = round(1 / ar, 3);
  const at = prod.alpha ? "bottom" : (chipBand(prod, lg, 0.15) ?? "below");
  return (
    <div
      className={cx("lp-rv__prod", prod.alpha && "lp-rv__prod--cutout")}
      data-at={at}
      style={cssVars({ "--prod-ar": round(ar, 3) })}
      {...reveal("rise", 240)}
    >
      <span className="lp-rv__prod-win">
        <Picture
          asset={prod}
          sizes="(min-width: 56rem) 22rem, 3.5rem"
          ratio="1"
          fit={prod.alpha ? "contain" : "cover"}
          frame={prod.alpha ? undefined : { shape: "circle", ratio: 1, tight: true }}
          frameLg={prod.alpha ? undefined : { shape: "rounded", ratio: lg, maxZoom: 1 }}
          frameMin="56rem"
          className="lp-rv__prod-pic"
          alt=""
        />
      </span>
      {/* a Latin name on an Arabic page keeps its own direction: the ellipsis cuts its end, never its start */}
      <span className="lp-rv__prod-name">
        <bdi className="lp-rv__ell">{ctx.product.name}</bdi>
      </span>
    </div>
  );
}

function ScorePanel({ ctx, data, score }: { ctx: RenderContext; data: Data; score: Score }) {
  const dist = distribution(data, score);
  const hasDist = !!dist && dist.some((c) => c > 0);
  const photos = hasDist ? [] : data.items.map((x) => ctx.asset(x.photo)).filter((a) => a !== null).slice(0, 4);
  const prod = productVisual(ctx);
  const label = say(ctx, score.fromProduct ? UI.average : UI.shown);
  return (
    <aside className="lp-rv__score" aria-label={label}>
      <p className="lp-rv__score-lab lp-label" {...reveal("fade")}>
        {label}
      </p>
      <div className="lp-rv__score-main" {...reveal("scale-in", 80)}>
        <Gauge ctx={ctx} score={score} />
        <div className="lp-rv__score-meta">
          <Stars ctx={ctx} value={score.value} size="l" />
          <p className="lp-rv__score-count">{countLabel(ctx, score.count)}</p>
        </div>
      </div>
      {hasDist && dist ? <Bars ctx={ctx} dist={dist} /> : null}
      {photos.length ? (
        <div className="lp-rv__shots" {...reveal("rise", 160)}>
          <p className="lp-rv__score-lab lp-label">{say(ctx, UI.photos)}</p>
          <ul className="lp-rv__shots-row" role="list">
            {photos.map((a, k) => (
              <li key={k}>
                <Picture asset={a} sizes="5rem" ratio="1" className="lp-rv__shot" alt={a.alt} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {prod ? <ProductWindow ctx={ctx} prod={prod} /> : null}
    </aside>
  );
}

/** No honest score yet (sample reviews, no product rating): the column holds the product alone. */
function ProductPanel({ ctx, prod }: { ctx: RenderContext; prod: ResolvedAsset }) {
  return (
    <aside className="lp-rv__score lp-rv__score--prod" aria-hidden="true">
      <ProductWindow ctx={ctx} prod={prod} />
    </aside>
  );
}

export function Summary({ id, ctx, data, bg }: Props): ReactElement {
  const score = sectionScore(ctx, data);
  const prod = score ? null : productVisual(ctx);
  const side = score ? <ScorePanel ctx={ctx} data={data} score={score} /> : prod ? <ProductPanel ctx={ctx} prod={prod} /> : null;
  // best first; the original order is kept within a rating
  const top = data.items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => b.item.rating - a.item.rating || a.i - b.i)
    .slice(0, FEED_MAX);
  return (
    <SectionShell id={id} ctx={ctx} type="reviews" variant="summary" bg={bg} labelledBy={titleId(id)}>
      <Container>
        <Header ctx={ctx} data={data} id={id} align="split" />
        <div className="lp-card lp-rv__board" data-score={side ? "" : undefined} {...reveal("rise", 60)}>
          {side}
          <ol className="lp-rv__feed" role="list" data-stagger="110">
            {top.map(({ item, i }) => (
              <li key={i} className="lp-rv__post" {...reveal("rise")}>
                <figure className="lp-rv__post-fig">
                  <figcaption className="lp-rv__post-head">
                    <Byline ctx={ctx} item={item} i={i} />
                    <Stars ctx={ctx} value={item.rating} size="s" />
                  </figcaption>
                  <ReviewTitle ctx={ctx} item={item} i={i} />
                  <Quote ctx={ctx} item={item} i={i} />
                  <Photo ctx={ctx} item={item} ratio="1" sizes="7rem" className="lp-rv__post-photo" />
                  {(item.verified && !data.sample) || item.detail.trim() ? (
                    <div className="lp-rv__post-foot">
                      <Verified ctx={ctx} item={item} data={data} />
                      <Detail ctx={ctx} item={item} i={i} />
                    </div>
                  ) : null}
                </figure>
              </li>
            ))}
          </ol>
        </div>
        <CtaRow ctx={ctx} data={data} />
      </Container>
    </SectionShell>
  );
}
