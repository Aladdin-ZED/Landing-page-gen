/**
 * hero/stage — the product lit like a studio shot: an archetype stage (arch, halo, blob, podium,
 * glass frame, slab) with its glow, rim light and contact shadow, a giant low-contrast display word
 * sliding behind the product, and up to three frosted glass callouts whose leader lines land on
 * the product. Copy column: meta, h1, lead · buy box: price + pack teaser, CTA, trust.
 *
 * A regular photo is framed whole: a wide product gets a landscape stage (never a portrait window
 * that would cut it), people only get a set whose curve keeps every head inside, and the callouts
 * slide to heights where neither the chip nor its leader lands on a face or a hand (framing.ts).
 */
import type { ReactElement } from "react";
import { cssVars, cx, editAttr, ProductStage, reveal, SectionShell } from "../../primitives";
import { frameAspect, stageCalloutTops, visualFacts } from "./framing";
import {
  Callout,
  HeroCta,
  HeroLead,
  HeroMeta,
  HeroPrice,
  HeroTitle,
  HeroTrust,
  heroNotes,
  heroStage,
  heroWord,
  mainAsset,
  PackTeaser,
  titleId,
  wordAdvance,
  type HeroProps,
} from "./parts";

/** Callout slots around the product: alternate sides so leaders never cross. */
const SIDES = ["end", "start", "end"] as const;
/** Their default heights (fractions of the stage) — mirrored in hero.stage.css. */
const TOPS = [0.13, 0.45, 0.75] as const;

export function StageHero({ id, variant, bg, data, ctx }: HeroProps): ReactElement {
  const asset = mainAsset(ctx, data);
  const facts = visualFacts(asset);
  const kind = facts.kind;
  // a photo whose subject is wider than the 4:5 set gets a landscape stage (up to 13:10)
  const R = frameAspect(facts, 0.8, 1.3);
  const stage = heroStage(ctx, `${id}:stage`, asset, R);
  const word = heroWord(ctx, data);
  const notes = heroNotes(data, 3);
  const tops = stageCalloutTops(
    ctx,
    asset,
    stage,
    R,
    notes.map(({ note }) => note),
    SIDES,
    TOPS,
  );

  return (
    <SectionShell id={id} ctx={ctx} type="hero" variant={variant} bg={bg} labelledBy={titleId(id)}>
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__head">
          <HeroMeta ctx={ctx} data={data} />
          <HeroTitle ctx={ctx} data={data} id={id} />
          <HeroLead ctx={ctx} data={data} />
        </div>

        <div
          className={cx("lp-hero__visual", word && "lp-hero__visual--word")}
          data-kind={kind}
          data-stage={stage}
          data-wide={R > 1 ? "" : undefined}
          style={cssVars({ "--wl": Math.max(3, [...word].length), "--wadv": word ? wordAdvance(ctx, word) : undefined })}
        >
          <ProductStage
            ctx={ctx}
            stage={stage}
            asset={asset}
            priority
            size="l"
            ratio={R === 0.8 ? undefined : String(R)}
            seedKey={id}
            className="lp-hero__stage"
          >
            {word ? (
              <span className="lp-hero__word" aria-hidden="true" {...editAttr(ctx, "bigWord")}>
                <span className="lp-hero__word-in" {...reveal("wipe-up", 80)}>
                  {word}
                </span>
              </span>
            ) : null}
            {notes.length ? (
              <ul className="lp-hero__callouts" role="list">
                {notes.map(({ note, i }, k) => (
                  <Callout key={i} ctx={ctx} note={note} i={i} slot={k} side={SIDES[k]!} delay={380 + k * 160} top={tops?.[k]} />
                ))}
              </ul>
            ) : null}
          </ProductStage>
        </div>

        <div className="lp-hero__buy" {...reveal("rise", 180)}>
          <div className="lp-hero__deal">
            <HeroPrice ctx={ctx} />
            <PackTeaser ctx={ctx} data={data} delay={420} />
          </div>
          <HeroCta ctx={ctx} data={data} />
          <HeroTrust ctx={ctx} data={data} id={id} />
        </div>
      </div>
    </SectionShell>
  );
}
