/**
 * specs/accordion — groups that open smoothly (native <details>, height eased where the engine can
 * animate it). Closed groups are quiet rows that preview their content in one line; the open one
 * lifts into a raised card, its icon disc fills with the accent and the +/− folds. A sticky column
 * holds the heading, the product tile (glass key figure over its edge) and the buy row. One group
 * open at a time ([data-accordion="single"] + the native exclusive `name`); the specifications
 * open first.
 */
import type { ReactElement } from "react";
import { Container, Icon, RichText, cx, reveal } from "@/landing/primitives";
import { Buy, GroupBody, Head, Tile, cardBg, groupPeek, num2, visuals, type ViewProps } from "./parts";

export function Accordion({ ctx, data, id, titleId, bg }: ViewProps): ReactElement {
  const img = visuals(ctx, data)[0] ?? null;
  const card = cardBg(bg);
  // the section is about specs: their group opens first (else the first group)
  const first = Math.max(0, data.groups.findIndex((g) => g.kind === "specs"));
  return (
    <Container className={cx("lp-specs__grid", "lp-specs__acc", !img && "lp-specs--novisual")}>
      <div className="lp-specs__side">
        <div className="lp-specs__lead">
          <Head ctx={ctx} data={data} titleId={titleId} />
        </div>
        {img ? <Tile ctx={ctx} data={data} id={id} asset={img} variant="accordion" sizes="(min-width: 60rem) 30rem, 92vw" /> : null}
        <Buy ctx={ctx} data={data} />
      </div>
      <div className="lp-specs__list" data-accordion="single" data-stagger="80">
        {data.groups.map((g, i) => {
          const peek = groupPeek(data, g);
          return (
            <details key={i} className="lp-specs__item" name={`${id}-groups`} open={i === first} data-bg={card} {...reveal("rise")}>
              <summary className="lp-specs__sum">
                <span className="lp-specs__ico" aria-hidden="true">
                  <Icon name={g.icon} size="1.25rem" />
                </span>
                <span className="lp-specs__stitle">
                  <span className="lp-specs__sline">
                    <span className="lp-specs__snum" aria-hidden="true">
                      {num2(i)}
                    </span>
                    <RichText as="span" text={g.title} ctx={ctx} decorate={false} editPath={`groups.${i}.title`} />
                  </span>
                  {/* a one-line preview while closed — the content itself is one click away */}
                  {peek ? (
                    <span className="lp-specs__peek" aria-hidden="true">
                      {peek}
                    </span>
                  ) : null}
                </span>
                <span className="lp-specs__pm" aria-hidden="true" />
              </summary>
              <div className="lp-specs__content">
                <GroupBody ctx={ctx} data={data} g={g} gi={i} layout="rows" />
              </div>
            </details>
          );
        })}
      </div>
    </Container>
  );
}
