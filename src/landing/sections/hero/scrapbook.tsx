/**
 * hero/scrapbook → modern collage — two or three rounded media cards layered with real depth
 * (soft tinted shadows, 1px inner light, ≤ 3° seeded angles, parallax at different rates), frosted
 * glass chips carrying product notes across the card edges and one crisp vector sticker with the
 * genuine pack saving (a link that preselects that pack). A single photo is backed by two tinted
 * panels, so the composition keeps its depth. No tape, frames or doodles.
 *
 * Every card is fitted to its exact frame (4:5 lead card, square and 3:4 companions — the wider
 * photo takes the square); a lead product lying on its side switches the stack to a landscape lead
 * card so it is never cut; on photos of people the chips move off faces and hands (framing.ts).
 * The glossy 3D form only joins lively pages: a calm product keeps a calm collage.
 */
import type { ReactElement } from "react";
import type { Box } from "@/lib/media/focus";
import type { Archetype } from "@/lib/page/schema";
import { Shape3D, Sticker, type StickerShape } from "../../illustrations";
import { cssVars, cx, Picture, reveal, SectionShell, seededRotation } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { micro } from "./copy";
import { collageChipSpots, visualFacts, type ChipSpot, type CollageCard } from "./framing";
import {
  HeroCta,
  HeroLead,
  HeroMeta,
  HeroPrice,
  HeroTitle,
  HeroTrust,
  heroNotes,
  heroPhotos,
  NoteText,
  packSavings,
  titleId,
  type HeroProps,
} from "./parts";

/** Sticker silhouette: a soft burst for the playful language, a smooth blob for the warm ones, else a disc. */
const STICKER: Partial<Record<Archetype, StickerShape>> = {
  playground: "burst",
  hearth: "blob",
  field: "blob",
  souk: "blob",
  bloom: "blob",
};

/** The playful and the glossy-beauty languages get one 3D form peeking behind the stack. */
const SHAPED: ReadonlySet<Archetype> = new Set<Archetype>(["playground", "bloom"]);

/** Card angle: alternating sides inside the archetype's tilt range (straight archetypes stay at 0). */
function angle(ctx: RenderContext, key: string, i: number): number {
  const r = Math.abs(seededRotation(ctx, key, 1));
  if (r === 0) return 0;
  return (i % 2 === 0 ? -1 : 1) * Math.min(3, Math.max(1, r));
}

/** Parallax rate per card (desktop runtime): the back cards drift against the front one. */
const DRIFT = [undefined, "0.05", "-0.04"] as const;

/** Collage box: width / height (hero.scrapbook.css aspect-ratio 1 / 1.04). */
const COLLAGE = 1 / 1.04;

type Geo = "stack" | "solo" | "wide" | "wide-solo";

interface Slot {
  /** inline start (fraction of the width) */
  x: number;
  /** top, or — with `bottom` — the distance from the bottom edge (fractions of the height) */
  y: number;
  bottom?: boolean;
  w: number;
  /** card aspect, width / height */
  r: number;
}

/** Card boxes per geometry — mirrored by hero.scrapbook.css. */
const SLOTS: Record<Geo, readonly Slot[]> = {
  stack: [
    { x: 0.17, y: 0.03, w: 0.6, r: 0.8 },
    { x: 0.01, y: 0.01, bottom: true, w: 0.41, r: 1 },
    { x: 0.65, y: 0.12, w: 0.35, r: 0.75 },
  ],
  solo: [{ x: 0.19, y: 0.06, w: 0.64, r: 0.8 }],
  wide: [
    { x: 0, y: 0.04, w: 0.82, r: 1.25 },
    { x: 0.56, y: 0, bottom: true, w: 0.42, r: 1 },
    { x: 0.08, y: 0.55, w: 0.34, r: 1 },
  ],
  "wide-solo": [{ x: 0.04, y: 0.14, w: 0.92, r: 1.25 }],
};

/** A card's box in collage fractions. */
function slotBox(geo: Geo, i: number): Box {
  const s = SLOTS[geo][i]!;
  const h = (s.w / s.r) * COLLAGE;
  return { x: s.x, y: s.bottom ? 1 - s.y - h : s.y, w: s.w, h };
}

/** The companions of the lead photo: the wider one takes the square card, the taller the 3:4 one. */
function arrange(photos: readonly ResolvedAsset[]): (ResolvedAsset | null)[] {
  if (photos.length < 3) return photos.length ? [...photos] : [null];
  const [lead, a, b] = photos as [ResolvedAsset, ResolvedAsset, ResolvedAsset];
  return visualFacts(a).need >= visualFacts(b).need ? [lead, a, b] : [lead, b, a];
}

/** Default chip spots (CSS defaults): beside the lead card's lower end edge, over its top start corner. */
const CHIP_DEFAULTS: readonly ChipSpot[] = [
  { side: "end", top: 0.58 },
  { side: "start", top: 0.06 },
];

export function ScrapbookHero({ id, variant, bg, data, ctx }: HeroProps): ReactElement {
  const cards = arrange(heroPhotos(ctx, data, 3));
  const notes = heroNotes(data, 2);
  const packs = data.showTeaser ? packSavings(ctx) : [];
  const best = packs.reduce<(typeof packs)[number] | null>((b, p) => (!b || p.pct > b.pct ? p : b), null);
  const shaped = ctx.ornament > 0 && ctx.motion === "lively" && SHAPED.has(ctx.archetype);
  const lead = visualFacts(cards[0]);
  const wide = lead.kind === "photo" && lead.need > 1;
  const geo: Geo = wide ? (cards.length > 1 ? "wide" : "wide-solo") : cards.length > 1 ? "stack" : "solo";
  const ratios = cards.map((_, i) => SLOTS[geo][i]?.r ?? 1);
  const placed: CollageCard[] = cards.map((asset, i) => ({ asset, box: slotBox(geo, i), ratio: ratios[i]! }));
  // the sticker: a disc ≈ 21% of the collage hanging off its top, 14% from the end edge
  const stickerBox: Box | null = best ? { x: 0.65, y: -0.01, w: 0.21, h: 0.21 * COLLAGE } : null;
  const spots = collageChipSpots(
    ctx,
    placed,
    notes.map(({ note }) => note),
    CHIP_DEFAULTS,
    stickerBox,
    COLLAGE,
  );

  return (
    <SectionShell id={id} ctx={ctx} type="hero" variant={variant} bg={bg} labelledBy={titleId(id)}>
      <div className="lp-container lp-hero__grid">
        <div className="lp-hero__head">
          <HeroMeta ctx={ctx} data={data} />
          <HeroTitle ctx={ctx} data={data} id={id} />
          <HeroLead ctx={ctx} data={data} />
        </div>

        <div className="lp-hero__collage" data-n={cards.length} data-geo={wide ? "wide" : undefined}>
          {cards.length === 1 ? (
            <>
              <span className="lp-hero__ghost" data-i="1" style={cssVars({ "--rot": `${angle(ctx, `${id}-g1`, 1) || 2}deg` })} aria-hidden="true" />
              <span className="lp-hero__ghost" data-i="2" style={cssVars({ "--rot": `${angle(ctx, `${id}-g2`, 2) || -2}deg` })} aria-hidden="true" />
            </>
          ) : null}
          {shaped ? <Shape3D shape="sphere" finish="gloss" tone="pop" seed={`${ctx.seed}:${id}:orb`} className="lp-hero__orb" idle="float" /> : null}
          {cards.map((asset, i) => (
            <div key={asset?.id ?? i} className="lp-hero__slot" data-i={i} data-parallax={DRIFT[i]} style={cssVars({ "--rot": `${angle(ctx, `${id}-card-${i}`, i)}deg` })}>
              <figure className={cx("lp-hero__card", asset?.alpha && "lp-hero__card--cutout")} {...(i > 0 ? reveal("tilt-in", 180 + i * 160) : {})}>
                <Picture
                  asset={asset}
                  sizes={i === 0 ? (wide ? "(min-width: 64rem) 30rem, 82vw" : "(min-width: 64rem) 26rem, 64vw") : "(min-width: 64rem) 15rem, 40vw"}
                  priority={i === 0}
                  fit={asset?.alpha ? "contain" : "cover"}
                  frame={asset?.alpha ? undefined : { shape: "rounded", ratio: ratios[i]! }}
                  className="lp-hero__pic"
                  alt={i === 0 ? asset?.alt || ctx.product.name : (asset?.alt ?? "")}
                />
              </figure>
            </div>
          ))}
          {notes.length ? (
            <ul className="lp-hero__chips" role="list">
              {notes.map(({ note, i }, k) => (
                <li
                  key={i}
                  className="lp-hero__callout lp-hero__chip lp-glass"
                  data-k={k}
                  data-side={spots?.[k]?.side ?? CHIP_DEFAULTS[k]!.side}
                  style={spots?.[k] ? cssVars({ "--c-top": `${spots[k]!.top}%` }) : undefined}
                  {...reveal("blur-in", 520 + k * 180)}
                >
                  <NoteText ctx={ctx} text={note.title} className="lp-hero__callout-t" editPath={`notes.${i}.title`} />
                  {note.detail.trim() ? <NoteText ctx={ctx} text={note.detail} className="lp-hero__callout-d" editPath={`notes.${i}.detail`} /> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {best ? (
            <a href="#order" className="lp-hero__sticker" data-action="order" data-bundle={best.bundleId}>
              <span className="lp-visually-hidden">{micro(ctx.locale, "pack")} </span>
              <Sticker seed={`${ctx.seed}:${id}:sticker`} shape={STICKER[ctx.archetype] ?? "circle"} tone="pop" tilt={3} reveal delay={640}>
                <bdi className="lp-hero__sticker-pct" dir="ltr">
                  {ctx.t("bundle.savePct", { pct: best.pct })}
                </bdi>
                <bdi className="lp-hero__sticker-q" dir={best.sameItem ? "ltr" : undefined}>
                  {best.label}
                </bdi>
              </Sticker>
            </a>
          ) : null}
        </div>

        <div className="lp-hero__buy" {...reveal("rise", 200)}>
          <HeroPrice ctx={ctx} />
          <HeroCta ctx={ctx} data={data} />
          <HeroTrust ctx={ctx} data={data} id={id} />
        </div>
      </div>
    </SectionShell>
  );
}
