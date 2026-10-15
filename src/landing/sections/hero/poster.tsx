/**
 * hero/poster — a full-bleed color field: the giant word set edge to edge as the graphic, the
 * product rising in front of it (a cutout stands free, a photo becomes a tilted rounded print), a
 * slowly turning vector badge (COD · delivery) around the genuine saving, and a bold price block
 * on a contrasting surface crossing the print's edge. A slow aurora in the product's own hues and
 * one soft slanting beam light the field like a studio backdrop.
 */
import type { ReactElement } from "react";
import type { Archetype, SectionBg } from "@/lib/page/schema";
import { Aurora, Badge, Beam, type GlyphKind } from "../../illustrations";
import { cssVars, cx, editAttr, Picture, Price, reveal, savingsOf, SectionShell, seededRotation } from "../../primitives";
import { frameAspect, posterFlip, visualFacts } from "./framing";
import {
  freeShipping,
  HeroCta,
  HeroLead,
  HeroMeta,
  HeroTitle,
  HeroTrust,
  heroWord,
  mainAsset,
  PackTeaser,
  titleId,
  wordAdvance,
  type HeroProps,
} from "./parts";

const COLOR_FIELDS: readonly SectionBg[] = ["accent", "dark", "pop"];

/** Arabic letter bodies sit low in the em box: the print overlaps an Arabic word less. */
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufefc]/;

const GLYPH: Partial<Record<Archetype, GlyphKind>> = {
  kinetic: "bolt",
  garage: "bolt",
  souk: "star8",
  field: "leaf",
  bloom: "spark",
  playground: "spark",
};

/** The badge and the price block each take the color that pops on the field. */
const BADGE_TONE = { accent: "pop", pop: "dark", dark: "accent" } as const;
const TAG_BG: Record<"accent" | "pop" | "dark", SectionBg> = { accent: "dark", pop: "dark", dark: "accent" };

export function PosterHero({ id, variant, bg, data, ctx }: HeroProps): ReactElement {
  // a poster is a color field: neutral backgrounds are promoted to the accent block
  const field = (COLOR_FIELDS.includes(bg) ? bg : "accent") as "accent" | "pop" | "dark";
  const word = heroWord(ctx, data);
  const asset = mainAsset(ctx, data);
  const cutout = !!asset?.alpha;
  // a photo print is 4:5, widened (up to 13:10) for a product lying on its side; the badge and the
  // price tag swap corners when theirs would sit on a face, a hand or the product itself
  const ratio = frameAspect(visualFacts(asset), 0.8, 1.3);
  const flip = !cutout && posterFlip(ctx, asset, ratio);
  const saving = savingsOf(ctx.product.price, ctx.product.compareAt);
  const pct = saving && ctx.offers.showSavings !== "none" ? ctx.t("bundle.savePct", { pct: saving.pct }) : null;
  const ring = [ctx.t("trust.cod"), freeShipping(ctx) ? ctx.t("bundle.freeShipping") : ctx.t("trust.check")];
  const tilt = cutout ? 0 : seededRotation(ctx, `${id}-print`, 0.8);

  return (
    <SectionShell id={id} ctx={ctx} type="hero" variant={variant} bg={field} labelledBy={titleId(id)}>
      {ctx.ornament > 0 ? (
        <>
          <Aurora seed={`${ctx.seed}:${id}:aurora`} intensity="soft" drift />
          <Beam seed={`${ctx.seed}:${id}:beam`} origin="top-end" intensity="soft" className="lp-hero__beams" />
        </>
      ) : null}
      <div
        className="lp-container lp-hero__grid"
        data-script={ARABIC.test(word) ? "ar" : undefined}
        style={cssVars({ "--wl": word ? Math.max(3, [...word].length) : undefined, "--wadv": word ? wordAdvance(ctx, word) : undefined })}
      >
        {word ? (
          // a graphic, not a paragraph: Arabic paragraph leading must not open up the giant word
          <div className="lp-hero__mega" aria-hidden="true" {...editAttr(ctx, "bigWord")}>
            <span className="lp-hero__mega-w" {...reveal("wipe-up")}>
              {word}
            </span>
          </div>
        ) : null}

        <div
          className={cx("lp-hero__art", !word && "lp-hero__art--solo")}
          data-flip={flip ? "" : undefined}
          data-wide={!cutout && ratio > 1 ? "" : undefined}
        >
          <div className="lp-hero__print" data-kind={cutout ? "cutout" : "photo"} style={cssVars({ "--rot": tilt ? `${tilt}deg` : undefined })}>
            <Picture
              asset={asset}
              sizes={!cutout && ratio > 1 ? "(min-width: 64rem) 34rem, 92vw" : "(min-width: 64rem) 27rem, 76vw"}
              priority
              fit={cutout ? "contain" : "cover"}
              ratio={cutout ? undefined : String(ratio)}
              frame={cutout ? undefined : { shape: "rounded", ratio }}
              className="lp-hero__pic"
              alt={asset?.alt || ctx.product.name}
            />
          </div>
          <span className="lp-hero__badge">
            <Badge
              uid={`${id}-badge`}
              text={ring}
              label={pct ? `⁦${pct}⁩` : undefined}
              glyph={pct ? "none" : (GLYPH[ctx.archetype] ?? "spark")}
              sep={GLYPH[ctx.archetype] ?? "dot"}
              variant="solid"
              tone={BADGE_TONE[field]}
              spin
              reveal
              delay={420}
              minPx={92}
            />
          </span>
          <div className="lp-hero__tag" data-bg={TAG_BG[field]} {...reveal("rise", 520)}>
            <Price ctx={ctx} amount={ctx.product.price} compareAt={ctx.product.compareAt} size="xl" showSavings={!pct} className="lp-hero__price" />
          </div>
        </div>

        <div className="lp-hero__head">
          <HeroMeta ctx={ctx} data={data} />
          <HeroTitle ctx={ctx} data={data} id={id} />
          <HeroLead ctx={ctx} data={data} />
        </div>

        <div className="lp-hero__buy" {...reveal("rise", 200)}>
          <PackTeaser ctx={ctx} data={data} delay={360} />
          <HeroCta ctx={ctx} data={data} />
          <HeroTrust ctx={ctx} data={data} id={id} />
        </div>
      </div>
    </SectionShell>
  );
}
