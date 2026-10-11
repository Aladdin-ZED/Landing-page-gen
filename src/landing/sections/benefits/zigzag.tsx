/**
 * zigzag — alternating media / text rows. Large photos in the page's mask open on reveal over a soft
 * pool of product light; a frosted glass chip floats across each photo's edge carrying the key figure
 * (or the benefit's icon), drifting on scroll on desktop. Photos are never repeated: once they run
 * out, the remaining benefits gather into an editorial strip of ruled cells (figure or icon, title,
 * text) where they stand — no filler frames. A page without a single photo keeps the zigzag with
 * lit plates (figure, or the index as a supergraphic).
 */
import type { ReactNode } from "react";
import { Container, Icon, Picture, reveal } from "@/landing/primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { aspectOf, idx, pageFrame, pageShape, quietEdge } from "./kit";
import type { BenefitItem, ViewProps } from "./model";
import { Action, Fact, Head, Plate, Text, Title, photoPicker } from "./parts";

type Row = { kind: "row"; i: number; photo: ResolvedAsset | null } | { kind: "more"; at: number[] };

/** Photo rows in order; consecutive photo-less items (when at least one photo exists) form one strip. */
function plan(items: readonly BenefitItem[], photos: readonly (ResolvedAsset | null)[]): Row[] {
  const cluster = photos.some(Boolean);
  const out: Row[] = [];
  items.forEach((_, i) => {
    const photo = photos[i] ?? null;
    const last = out[out.length - 1];
    if (photo || !cluster) out.push({ kind: "row", i, photo });
    else if (last?.kind === "more") last.at.push(i);
    else out.push({ kind: "more", at: [i] });
  });
  return out;
}

export function Zigzag({ ctx, data, titleId }: ViewProps) {
  const pick = photoPicker(ctx, data.items);
  const photos = data.items.map((it) => pick(it));
  let side = 0;
  return (
    <Container className="lp-cq">
      <Head ctx={ctx} data={data} titleId={titleId} align="center" />
      <ol className="lp-benefits__zz" role="list">
        {plan(data.items, photos).map((r) =>
          r.kind === "more" ? (
            <li key={`m${r.at[0]}`} className="lp-benefits__zmore">
              <ul className="lp-benefits__more" role="list" data-count={r.at.length}>
                {r.at.map((i, k) => (
                  <MoreCell key={i} ctx={ctx} item={data.items[i]!} i={i} delay={80 + k * 90} />
                ))}
              </ul>
            </li>
          ) : (
            <ZRow key={r.i} ctx={ctx} item={data.items[r.i]!} i={r.i} photo={r.photo} side={side++ % 2 ? "end" : "start"} />
          ),
        )}
      </ol>
      <Action ctx={ctx} data={data} center />
    </Container>
  );
}

/** The row's index ("03") on its drawn hairline: a plain editorial mark, no "of n" pagination. */
function Index({ i }: { i: number }) {
  return (
    <span className="lp-benefits__idx" aria-hidden="true">
      <bdi dir="ltr">{idx(i)}</bdi>
    </span>
  );
}

function ZRow({ ctx, item, i, photo, side }: { ctx: RenderContext; item: BenefitItem; i: number; photo: ResolvedAsset | null; side: "start" | "end" }) {
  const hasStat = !!item.stat.trim();
  // a figure plate shows the figure (chip = icon); an index plate carries its own icon (no chip)
  const chipFact = hasStat && !!photo;
  // a wide shot keeps a landscape frame (a 4:5 crop of it would slice the product)
  const wide = !!photo && aspectOf(photo) > 1.2;
  // the chip crosses the photo's edge toward the copy, at the end of that edge where it covers no
  // face, hand or product (a figure chip prefers the foot, an icon disc the head of the edge)
  const shape = pageShape(ctx);
  const at = quietEdge(photo, { shape, ratio: shape === "circle" ? 1 : wide ? 1.2 : 0.8 }, {
    inline: side === "end" ? "start" : "end",
    dir: ctx.dir,
    chip: chipFact ? { w: 0.4, h: 0.22 } : { w: 0.16, h: 0.16 },
    prefer: chipFact ? "end" : "start",
  });
  const chip: ReactNode = chipFact ? (
    <Fact ctx={ctx} item={item} i={i} className="lp-benefits__chip lp-glass" enter="blur-in" delay={420} />
  ) : photo || hasStat ? (
    <span className="lp-benefits__disc lp-glass" aria-hidden="true" {...reveal("stamp", 420)}>
      <Icon name={item.icon} size="100%" strokeWidth={1.6} />
    </span>
  ) : null;
  return (
    <li className="lp-benefits__zrow" data-side={side}>
      <div className="lp-benefits__zmedia">
        <div className="lp-benefits__zframe" {...reveal("mask-arch", 40)}>
          {photo ? (
            <Picture
              asset={photo}
              sizes="(min-width: 56rem) 29rem, 84vw"
              ratio={wide ? "6/5" : "4/5"}
              mask="page"
              frame={photo.alpha ? undefined : pageFrame(ctx, wide ? 1.2 : 0.8)}
              alt=""
              fit={photo.alpha ? "contain" : "cover"}
            />
          ) : (
            <Plate ctx={ctx} item={item} i={i} className="lp-mask" />
          )}
        </div>
        {chip ? (
          <div className="lp-benefits__float" data-at={photo ? at : chipFact ? "end" : "start"} data-parallax={side === "end" ? "-0.05" : "0.05"}>
            {chip}
          </div>
        ) : null}
      </div>
      <div className="lp-benefits__zbody" {...reveal("rise", 160)}>
        <Index i={i} />
        <Title ctx={ctx} item={item} i={i} className="lp-benefits__t--l" />
        <Text ctx={ctx} item={item} i={i} className="lp-benefits__p--l" />
      </div>
    </li>
  );
}

/** One benefit of the closing strip: its figure (or icon) over a drawn hairline, then the copy. */
function MoreCell({ ctx, item, i, delay }: { ctx: RenderContext; item: BenefitItem; i: number; delay: number }) {
  const hasStat = !!item.stat.trim();
  return (
    <li className="lp-benefits__mcell" {...reveal("rise", delay)}>
      <span className="lp-benefits__mrule" aria-hidden="true" {...reveal("wipe-side", delay)} />
      <div className="lp-benefits__mhead">
        {hasStat ? (
          <Fact ctx={ctx} item={item} i={i} className="lp-benefits__mfact" delay={delay + 160} />
        ) : (
          <span className="lp-benefits__ico" aria-hidden="true">
            <Icon name={item.icon} size="100%" strokeWidth={1.6} />
          </span>
        )}
        <Index i={i} />
      </div>
      <Title ctx={ctx} item={item} i={i} />
      <Text ctx={ctx} item={item} i={i} />
    </li>
  );
}
