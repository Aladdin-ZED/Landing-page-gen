/**
 * specs/tabs — a frosted segmented control (Description · Utilisation · Composition · Livraison)
 * whose accent pill glides to the chosen tab on a spring, set against the heading; below, one large
 * raised stage: the panel's copy (its first line set as a statement) beside a product photo that
 * changes with the tab and cross-fades on wide screens. ARIA tabs (runtime: [data-tabs]); without
 * JS the control hides and every panel reads in sequence under its own title. Chips and the buy
 * row close the section.
 */
import type { ReactElement } from "react";
import { Container, Icon, RichText, plainText, reveal } from "@/landing/primitives";
import { fitProps } from "../benefits/kit";
import { Buy, GroupBody, Head, Highlights, Media, cardBg, num2, visuals, type ViewProps } from "./parts";

export function Tabs({ ctx, data, id, titleId, bg }: ViewProps): ReactElement {
  const pics = visuals(ctx, data);
  const groups = data.groups;
  const n = groups.length;
  return (
    <Container>
      <div className="lp-specs__tabs" data-tabs="">
        <div className="lp-specs__top">
          <Head ctx={ctx} data={data} titleId={titleId} />
          <div className="lp-specs__bar" {...reveal("fade", 160)}>
            <div className="lp-specs__tablist lp-glass" role="tablist" aria-label={plainText(data.title)}>
              <span className="lp-specs__ind" aria-hidden="true" />
              {groups.map((g, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${i}`}
                  aria-controls={`${id}-panel-${i}`}
                  aria-selected={i === 0 ? "true" : "false"}
                  tabIndex={i === 0 ? 0 : -1}
                  className="lp-specs__tab"
                >
                  <Icon name={g.icon} size="1.15em" />
                  <RichText as="span" text={g.title} ctx={ctx} decorate={false} editPath={`groups.${i}.title`} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lp-specs__stage" data-bg={cardBg(bg)} {...reveal("rise", 200)}>
          {groups.map((g, i) => {
            const pic = pics.length ? pics[i % pics.length]! : null;
            return (
              <div
                key={i}
                id={`${id}-panel-${i}`}
                className="lp-specs__panel"
                role="tabpanel"
                aria-labelledby={`${id}-tab-${i}`}
                tabIndex={0}
                data-kind={g.kind}
                data-media={pic ? "" : undefined}
              >
                <div className="lp-specs__pcopy">
                  <div className="lp-specs__phead">
                    <h3 className="lp-specs__ptitle">
                      <span className="lp-specs__pico" aria-hidden="true">
                        <Icon name={g.icon} size="1.05rem" />
                      </span>
                      <RichText as="span" text={g.title} ctx={ctx} decorate={false} />
                    </h3>
                    <p className="lp-specs__pmeta" dir="ltr" aria-hidden="true">
                      <span>{num2(i)}</span>
                      <span className="lp-specs__pmax">/ {num2(n - 1)}</span>
                    </p>
                  </div>
                  <GroupBody ctx={ctx} data={data} g={g} gi={i} />
                </div>
                {/* phones: a 4:3 band over the copy; side by side a 6:5 photo beside it — each fitted */}
                {pic ? (
                  <Media
                    ctx={ctx}
                    asset={pic}
                    className="lp-specs__pmedia"
                    sizes="(min-width: 52rem) 34rem, 88vw"
                    crop={fitProps(pic, "rounded", 4 / 3, [1.2, 1.2], "52rem")}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="lp-specs__foot">
          <Highlights ctx={ctx} data={data} delay={260} />
          <Buy ctx={ctx} data={data} delay={300} />
        </div>
      </div>
    </Container>
  );
}
