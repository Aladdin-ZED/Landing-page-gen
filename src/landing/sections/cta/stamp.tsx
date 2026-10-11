/**
 * stamp → badge CTA — “the orb”. A centered composition: heading, then the product in a lit disc
 * circled by hairline orbits, and the order button itself as a round accent disc inside a frosted
 * ring of reassurance text, overlapping the product disc's lower edge. A frosted price chip (the
 * live price of the selected pack, paid at the door) balances it on the opposite diagonal.
 *
 * The ring is drawn here rather than with the shared Badge: Latin phrases run clockwise around it
 * and the ring turns slowly (the classic rotating badge); Arabic is set on two upright arcs — the
 * upper one clockwise, the lower one counter-clockwise — and only sways, because Arabic turned
 * upside down stops reading as text at all. The ring is decorative (its phrases are also the points
 * under the stage); the disc is a real order link with a 44px+ target and a visible focus ring.
 */
import type { ReactElement } from "react";
import type { Archetype } from "@/lib/page/schema";
import { GlowOrb, estimateEm, glyph, hasArabic, illId, isolateNumbers, type GlyphKind } from "@/landing/illustrations";
import { Cta, Price, SectionHeader, cx, plainText, reveal } from "@/landing/primitives";
import { defaultBundleId } from "@/lib/page/pricing";
import { stampDisc, tagZone } from "./fit";
import { pickVisual, ringPhrases, titleScale, type ViewProps } from "./model";
import { Ambient, Points, ProductPic } from "./parts";

/** Longest label (characters) that sits well inside the orb's disc. */
export const ORB_LABEL_MAX = 22;

/** Separator glyph between ring phrases, per archetype voice. */
const SEP: Record<Archetype, GlyphKind> = {
  maison: "diamond",
  apothecary: "dot",
  souk: "star8",
  playground: "spark",
  kinetic: "diamond",
  circuit: "dot",
  hearth: "dot",
  bloom: "dot",
  field: "leaf",
  editorial: "dot",
  garage: "diamond",
};

/* ------------------------------------------------------------------ */
/* Orb ring (viewBox 0 0 200 200)                                      */
/* ------------------------------------------------------------------ */

const C = 100;
/** radius the text is centered on */
const R = 79;
/** height of the text band */
const BAND = 21;
const MAX_FS = BAND * 0.64;
/** angular gap around each separator */
const GAP = (15 * Math.PI) / 180;

const f2 = (v: number): string => String(Math.round(v * 100) / 100);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const at = (a: number): [number, number] => [C + R * Math.cos(a), C + R * Math.sin(a)];

/** Arc on the text radius from a0 to a1 (radians, 0 = 3 o'clock, y down); sweep 1 = clockwise. */
function arcD(a0: number, a1: number, sweep: 0 | 1): string {
  const [x0, y0] = at(a0);
  const [x1, y1] = at(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${f2(x0)} ${f2(y0)}A${R} ${R} 0 ${large} ${sweep} ${f2(x1)} ${f2(y1)}`;
}

interface Arc {
  id: string;
  d: string;
  text: string;
  fs: number;
  /** Latin: fitted to the arc (textLength); Arabic is never letter-spaced */
  length?: number;
  squeeze?: boolean;
}

function OrbRing({ uid, phrases, sep }: { uid: string; phrases: readonly string[]; sep: GlyphKind }): ReactElement {
  const arabic = phrases.some(hasArabic);
  const arcs: Arc[] = [];
  const seps: [number, number][] = [];
  if (arabic) {
    // two upright halves: phrase 1 over the top (clockwise), phrase 2 under the bottom (counter-clockwise)
    const [top, bottom = phrases[0]!] = phrases;
    const len = R * (Math.PI - GAP);
    const fit = (s: string) => clamp(len / (Math.max(1, estimateEm(s, false)) * 1.3), 9, MAX_FS);
    arcs.push({ id: illId(uid, "top"), d: arcD(Math.PI + GAP / 2, 2 * Math.PI - GAP / 2, 1), text: top!, fs: fit(top!) });
    arcs.push({ id: illId(uid, "bot"), d: arcD(Math.PI - GAP / 2, GAP / 2, 0), text: bottom, fs: fit(bottom) });
    // one size for both halves: the ring reads as one line of type
    const fs = Math.min(arcs[0]!.fs, arcs[1]!.fs);
    for (const a of arcs) a.fs = fs;
    seps.push(at(Math.PI), at(0));
  } else {
    // clockwise phrases evenly around the ring; a lone short phrase repeats instead of stretching thin
    let items = [...phrases];
    if (items.length === 1 && estimateEm(items[0]!) * MAX_FS < R * Math.PI) items = [items[0]!, items[0]!];
    const slice = (2 * Math.PI) / items.length;
    items.forEach((s, i) => {
      const mid = -Math.PI / 2 + i * slice;
      const a0 = mid - (slice - GAP) / 2;
      const a1 = mid + (slice - GAP) / 2;
      const len = R * (a1 - a0);
      const em = Math.max(1, estimateEm(s));
      const fs = clamp(len / (em * 1.08), 8.5, MAX_FS);
      arcs.push({ id: illId(uid, `a${i}`), d: arcD(a0, a1, 1), text: s, fs, length: len * 0.96, squeeze: em * fs > len * 0.97 });
      seps.push(at(mid + slice / 2));
    });
  }
  return (
    <span className="lp-cta__ring lp-glass" data-turn={arabic ? "sway" : "spin"} aria-hidden="true">
      <svg className="lp-cta__ring-svg" viewBox="0 0 200 200" focusable="false">
        <defs>
          {arcs.map((a) => (
            <path key={a.id} id={a.id} d={a.d} fill="none" />
          ))}
        </defs>
        <circle className="lp-cta__ring-rule" cx={C} cy={C} r={R - BAND / 2 - 2.5} fill="none" vectorEffect="non-scaling-stroke" />
        <g className="lp-cta__ring-sep">{seps.map(([x, y], i) => glyph(sep, x, y, 3.2, `s${i}`))}</g>
        {arcs.map((a) => (
          <text
            key={`t-${a.id}`}
            className="lp-cta__ring-t"
            fill="currentColor"
            fontSize={f2(a.fs)}
            textAnchor="middle"
            dominantBaseline="central"
            textLength={a.length ? f2(a.length) : undefined}
            lengthAdjust={a.length ? (a.squeeze ? "spacingAndGlyphs" : "spacing") : undefined}
            // Arabic keeps its numeric runs ("24–48") whole and left-to-right on the arc
            direction={arabic ? "rtl" : undefined}
            unicodeBidi={arabic ? "isolate" : undefined}
          >
            <textPath href={`#${a.id}`} startOffset="50%">
              {arabic ? isolateNumbers(a.text) : a.text}
            </textPath>
          </text>
        ))}
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

export function Stamp({ ctx, data, id, titleId }: ViewProps): ReactElement {
  // the disc is a circle: the photo that keeps every face whole in it (a cutout rises out of its top)
  const visual = pickVisual(ctx, data, { preferCutout: true, frameOf: () => stampDisc(ctx.dir) });
  const kind = visual.asset ? (visual.cutout ? "cutout" : "photo") : "none";
  const ring = ringPhrases(data, ctx.t("trust.cod"));
  const bundle = ctx.offers.bundles.find((b) => b.id === defaultBundleId(ctx.offers));
  const price = bundle?.price ?? ctx.product.price;
  // the disc holds a short label: the merchant's when it fits, else the built-in “order” verb
  const own = data.ctaLabel.trim();
  const label = own && plainText(own).length <= ORB_LABEL_MAX ? own : ctx.t("cta.order");
  return (
    <div className="lp-container lp-cta__wrap lp-cq">
      <SectionHeader
        ctx={ctx}
        kicker={data.kicker}
        title={data.title}
        lead={data.lead}
        align="center"
        size={titleScale(data.title)}
        titleId={titleId}
        editBase=""
        className="lp-cta__head"
      />
      <div className="lp-cta__stage" data-media={kind}>
        <div className="lp-cta__halo" aria-hidden="true">
          <GlowOrb size="118%" intensity="strong" place="center" idle="pulse" />
          <Ambient ctx={ctx} uid={`${id}-stage`} scope="stage" />
          <span className="lp-cta__orbit" {...reveal("scale-in", 60)}>
            <i />
            <i />
            <i>
              <b />
            </i>
          </span>
        </div>
        <div className="lp-cta__disc" {...reveal("scale-in", 120)}>
          {kind !== "none" ? (
            <ProductPic ctx={ctx} visual={visual} sizes="(min-width: 64rem) 28rem, 76vw" className="lp-cta__disc-pic" />
          ) : (
            // no product visual: the product's name, set in the display face, is the subject
            <span className="lp-cta__disc-name">{ctx.product.name}</span>
          )}
        </div>
        {data.showPrice ? (
          // the free corner of the disc: never over a face, a hand or a cutout's neck
          <div className="lp-cta__tag lp-glass" data-zone={tagZone(visual.asset, ctx.dir)} {...reveal("rise", 460)}>
            <Price ctx={ctx} amount={price} live size="m" />
            <span className="lp-cta__tag-sub">{ctx.t("trust.cod")}</span>
          </div>
        ) : null}
        <div className="lp-cta__orb" {...reveal("stamp", 320)}>
          <OrbRing uid={`${id}-orb`} phrases={ring} sep={SEP[ctx.archetype] ?? "dot"} />
          <Cta ctx={ctx} label={label} size="l" icon="arrow-right" className={cx("lp-cta__btn", "lp-cta__orb-btn")} editPath="ctaLabel" />
        </div>
      </div>
      <Points ctx={ctx} data={data} className="lp-cta__foot" delay={520} />
    </div>
  );
}
