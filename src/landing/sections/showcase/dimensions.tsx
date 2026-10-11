/**
 * showcase/dimensions — the product's real size as a clean technical drawing: the object on a lit
 * panel with a fading grid, hairline dimension lines with chip labels, a precise tick scale
 * (technical archetypes), a frosted "scale reference" chip centred on the panel's lower edge, and
 * the spec figures set large beside it. Without a product shot the measured volume is drawn as a
 * clean outline with registration corners, carrying the product's name.
 */
import type { ReactElement } from "react";
import { Dimension, DotGrid, GlowOrb, GridLines } from "@/landing/illustrations";
import { Container, Icon, Picture, clamp, cssVars, frameRegions, pictureCrop, reveal, round } from "@/landing/primitives";
import type { ResolvedAsset } from "../../types";
import type { Archetype } from "@/lib/page/schema";
import { copyLang, density, shortName } from "../benefits/kit";
import { Val } from "../benefits/val";
import { COMMON } from "./copy";
import { Action, Head, productVisual, type ViewProps } from "./shared";

/** Archetypes whose drawing gets a hairline grid and a tick scale (the others: a soft dot field). */
const TECHNICAL: readonly Archetype[] = ["circuit", "garage", "kinetic", "editorial"];

/**
 * "12 cm", "24 سم", "110 mm", '7"' → the scale to draw: whole units spanning the size, and how many
 * finer ticks each unit gets (mm on short objects, halves on medium ones). null when the text is not
 * a measurable size.
 */
export function scaleOf(s: string): { units: number; sub: number; unit: "cm" | "in" } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(cm|سم|mm|مم|in|inch|"|″)?/i.exec(s);
  if (!m) return null;
  const v = Number(m[1]!.replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = (m[2] ?? "cm").toLowerCase();
  const inch = u === "in" || u === "inch" || u === '"' || u === "″";
  const cm = u === "mm" || u === "مم" ? v / 10 : v;
  const units = clamp(Math.round(inch ? v : cm), 2, 40);
  const sub = inch ? (units <= 6 ? 8 : units <= 12 ? 4 : 2) : units <= 6 ? 10 : units <= 16 ? 2 : 1;
  return { units, sub, unit: inch ? "in" : "cm" };
}

/**
 * The product's own box inside the photo frame (fractions), when the upload analysis found a product:
 * the dimension lines then hug the product — its height beside it, its width under it — instead of
 * measuring the backdrop. Null for people, scenes, cutouts and unanalysed shots (lines run the frame).
 */
function productBox(img: ResolvedAsset, ratio: number): { x: number; y: number; w: number; h: number } | null {
  if (img.alpha || img.subjectKind !== "product") return null;
  const crop = pictureCrop(img, { frame: { shape: "rounded", ratio, maxZoom: 1 } });
  const b = frameRegions(img, ratio, crop).subject;
  const x0 = clamp(b.x, 0, 1);
  const y0 = clamp(b.y, 0, 1);
  const x1 = clamp(b.x + b.w, 0, 1);
  const y1 = clamp(b.y + b.h, 0, 1);
  // a product that fills the frame anyway (or a box too small to be the product): measure the frame
  if (x1 - x0 < 0.12 || y1 - y0 < 0.12 || (x1 - x0 > 0.9 && y1 - y0 > 0.9)) return null;
  return { x: round(x0, 4), y: round(y0, 4), w: round(x1 - x0, 4), h: round(y1 - y0, 4) };
}

export function Dimensions({ ctx, data, titleId }: ViewProps): ReactElement {
  const img = productVisual(ctx, data);
  const c = COMMON[copyLang(ctx.locale)];
  const technical = TECHNICAL.includes(ctx.archetype);
  const height = data.height.trim();
  const width = data.width.trim();
  const note = data.scaleNote.trim();
  const scale = technical && height ? scaleOf(height) : null;
  // the drawing follows the photo's own shape (no letterbox bands around a framed shot)
  const ratio = img ? round(clamp(img.width / img.height, 0.62, 1.6), 3) : 0.8;
  const decor = density(ctx) > 0;
  const box = img && (height || width) ? productBox(img, ratio) : null;
  return (
    <Container className="lp-showcase__dm">
      <div className="lp-showcase__dmcopy">
        <Head ctx={ctx} data={data} titleId={titleId} />
        {data.specs.length ? (
          <dl className="lp-showcase__specs" data-n={data.specs.length}>
            {data.specs.map((s, i) => (
              // values sit on one line, scaled to their column; very long ones take a full row
              <div key={i} className="lp-showcase__spec" data-long={s.value.length > 14 ? "" : undefined} {...reveal("rise", 180 + i * 90)}>
                <dt>
                  <Val ctx={ctx} text={s.label} editPath={`specs.${i}.label`} />
                </dt>
                <dd style={cssVars({ "--chars": Math.max(5, s.value.length) })}>
                  <Val ctx={ctx} text={s.value} editPath={`specs.${i}.value`} />
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Action ctx={ctx} data={data} />
      </div>
      <figure className="lp-showcase__drawing" data-kind={img?.alpha ? "cutout" : "photo"} {...reveal("scale-in")}>
        <span className="lp-showcase__field" aria-hidden="true">
          {decor ? technical ? <GridLines cell={28} major={4} fade="radial" /> : <DotGrid cell={20} fade="radial" /> : null}
          <GlowOrb place="center" size="88%" intensity="medium" />
        </span>
        {/* a technical drawing is physical: ticks start, height line end, in every language */}
        <div
          className="lp-showcase__dwg"
          dir="ltr"
          data-tight={box ? "" : undefined}
          style={cssVars({ "--obj": ratio, "--bx": box?.x, "--by": box?.y, "--bw": box?.w, "--bh": box?.h })}
        >
          {scale ? (
            <span className="lp-showcase__ticks" style={cssVars({ "--n": scale.units, "--sub": scale.sub })} aria-hidden="true" {...reveal("wipe-up", 420)}>
              <span className="lp-showcase__unit">{scale.unit}</span>
            </span>
          ) : null}
          <div className="lp-showcase__object" {...reveal("scale-in", 140)}>
            {img ? (
              <Picture
                asset={img}
                sizes="(min-width: 56rem) 26rem, 70vw"
                ratio={ratio}
                fit={img.alpha ? "contain" : "cover"}
                frame={img.alpha ? undefined : { shape: "rounded", ratio, maxZoom: 1 }}
                className="lp-showcase__objpic"
                alt={img.alt || ctx.product.name}
              />
            ) : (
              // no shot yet: the measured volume as a clean outline with registration corners, named
              <span className="lp-showcase__ghost" style={cssVars({ "--ratio": ratio })}>
                <span className="lp-showcase__ghostname">{shortName(ctx.product.name)}</span>
              </span>
            )}
          </div>
          {height ? (
            <div className="lp-showcase__dimv" {...reveal("wipe-up", 480)}>
              <Dimension orientation="v" ends="tick">
                <span dir={ctx.dir}>
                  <span className="lp-visually-hidden">{c.heightLabel} </span>
                  <Val ctx={ctx} text={height} editPath="height" />
                </span>
              </Dimension>
            </div>
          ) : null}
          {width ? (
            <div className="lp-showcase__dimh" {...reveal("wipe-side", 620)}>
              <Dimension orientation="h" ends="tick">
                <span dir={ctx.dir}>
                  <span className="lp-visually-hidden">{c.widthLabel} </span>
                  <Val ctx={ctx} text={width} editPath="width" />
                </span>
              </Dimension>
            </div>
          ) : null}
        </div>
        {note ? (
          <figcaption className="lp-showcase__scale" {...reveal("rise", 760)}>
            <span className="lp-glass">
              <span className="lp-showcase__scaleicon" aria-hidden="true">
                <Icon name="ruler" size="1rem" />
              </span>
              <Val ctx={ctx} text={note} editPath="scaleNote" />
            </span>
          </figcaption>
        ) : null}
      </figure>
    </Container>
  );
}
