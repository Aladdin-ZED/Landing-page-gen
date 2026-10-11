/**
 * split — "Sans" against "Avec": a recessed, muted panel of pains and a raised, vivid panel of fixes
 * joined at one seam. The product photo bridges the seam and stands taller than both: the half
 * facing the pains is drained of color, the half facing the fixes is vivid, and on reveal the color
 * floods in from the vivid edge while a light seam travels with it and a glass knob settles on it;
 * the vivid panel is lit from the seam, as if by the product. Side by side on desktop, stacked on
 * phones (the seam and the photo's split turn horizontal with it).
 */
import type { ReactElement } from "react";
import { CheckMark, CrossMark } from "@/landing/illustrations";
import { Container, Icon, Picture, RichText, SectionHeader, cx, reveal } from "@/landing/primitives";
import { nestedBg, rangePosition, shortName } from "../benefits/kit";
import { Val } from "../benefits/val";
import type { ViewProps } from "./model";
import { Turn, isLandscape, pickVisual } from "./parts";

export function Split({ ctx, data, bg, titleId }: ViewProps): ReactElement {
  const photo = pickVisual(ctx, data, "upright");
  const fixes = data.pains.map((p, i) => ({ text: p.fix.trim(), i })).filter((f) => f.text);
  const vivid = nestedBg(ctx, bg, ["accent", "dark", "pop"]);
  const alt = photo ? photo.alt || ctx.product.name : "";
  // cutouts and landscape shots are shown whole (a tall frame would crop a wide shot down to a detail);
  // a wide photo then sits on a soft blurred fill of itself instead of flat bands
  const whole = !!photo && (photo.alpha || isLandscape(photo));
  const fill = whole && !photo?.alpha;
  const sizes = "(min-width: 60rem) 20rem, 72vw";
  // the bridge is 4:5 on phones and runs the panels' height on desktop (≈ 1:2): one crop for both
  const position = photo && !whole ? rangePosition(photo, "rounded", 0.48, 0.8) : undefined;
  const layer = (cls: string, a: string) =>
    photo ? (
      <span className={cx("lp-problem__layer", cls)}>
        {fill ? <Picture asset={photo} sizes={sizes} className="lp-problem__fill" alt="" /> : null}
        <Picture asset={photo} sizes={sizes} fit={whole ? "contain" : "cover"} position={position} className="lp-problem__shot" alt={a} />
      </span>
    ) : null;
  return (
    <Container>
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} align="center" className="lp-problem__head" />

      <div className={cx("lp-problem__duo", !photo && "lp-problem__duo--bare", fill && "lp-problem__duo--fill", photo?.alpha && "lp-problem__duo--cutout")}>
        <div className="lp-problem__side lp-problem__side--without" {...reveal("fade")}>
          {data.withoutLabel.trim() ? (
            <h3 className="lp-problem__label lp-h1">
              <Val ctx={ctx} text={data.withoutLabel} editPath="withoutLabel" />
            </h3>
          ) : null}
          <ul className="lp-problem__list" role="list">
            {data.pains.map((p, i) => (
              <li key={i} className="lp-problem__item" {...reveal("rise", 140 + i * 80)}>
                <CrossMark className="lp-problem__mark" frame="ring" tone="soft" weight={3.4} />
                <RichText as="span" text={p.text} ctx={ctx} decorate={false} editPath={`pains.${i}.text`} />
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-problem__bridge" {...reveal(photo ? "scale-in" : "stamp", 160)}>
          {layer("lp-problem__layer--before", "")}
          {layer("lp-problem__layer--after", alt)}
          <span className="lp-problem__seam" aria-hidden="true">
            <span className="lp-problem__knob lp-glass">
              <Icon name="arrow-right" size="1.15em" strokeWidth={2.2} />
            </span>
          </span>
        </div>

        <div className="lp-problem__side lp-problem__side--with" data-bg={vivid} {...reveal("wipe-side", 260)}>
          <h3 className="lp-problem__label lp-h1">
            <Val ctx={ctx} text={data.withLabel} editPath="withLabel" />
            <span className="lp-problem__name lp-label">{shortName(ctx.product.name)}</span>
          </h3>
          {fixes.length ? (
            <ul className="lp-problem__list" role="list">
              {fixes.map((f, k) => (
                <li key={f.i} className="lp-problem__item" {...reveal("rise", 420 + k * 80)}>
                  <CheckMark className="lp-problem__mark" frame="disc" tone="accent" weight={3.6} reveal delay={560 + k * 110} />
                  <RichText as="span" text={f.text} ctx={ctx} decorate={false} editPath={`pains.${f.i}.fix`} />
                </li>
              ))}
            </ul>
          ) : data.solution.trim() ? (
            <RichText as="p" className="lp-problem__aside" text={data.solution} ctx={ctx} editPath="solution" />
          ) : null}
        </div>
      </div>

      <Turn ctx={ctx} data={{ ...data, solution: fixes.length ? data.solution : "" }} look="center" delay={200} />
    </Container>
  );
}
