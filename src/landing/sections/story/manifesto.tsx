/**
 * manifesto — one big statement in giant display type. A small product photo pill leads the first
 * line; as the page scrolls, the words light up one after another in reading order while a precise
 * accent hairline fills along the footer rule in step with them (CSS scroll-driven animation; engines
 * without it get a blur-to-sharp word cascade on reveal and a plain rule). The kicker and the h2 sit
 * quietly above; the signature and the supporting story close the section on that rule.
 * Light: on dark and color fields a single accent glow rises behind the statement's opening; light
 * fields stay clean — the type is the picture.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Kicker, Picture, RichText, cssVars, cx, plainText } from "@/landing/primitives";
import { bgFamily, density, productShots } from "../benefits/kit";
import { bestShot } from "./fit";
import type { ViewProps } from "./model";
import { Backdrop, Signature, StoryCta, pickMedia } from "./parts";

/** The photo pill on the statement's first line (base CSS: 1.8em × 0.86em, a capsule). */
const PILL = { shape: "pill" as const, ratio: 2.09, tight: true };

/** Split a block text into its first paragraph and the rest. */
function splitFirst(text: string): [string, string] {
  const parts = text.trim().split(/\n\s*\n/);
  return [parts[0]?.trim() ?? "", parts.slice(1).join("\n\n").trim()];
}

export function Manifesto({ ctx, data, id, bg, titleId }: ViewProps): ReactElement {
  const own = data.statement.trim();
  // without a statement, the story's first paragraph becomes the statement (and is not repeated below)
  const [first, rest] = splitFirst(data.text);
  const statement = own || first || data.title;
  const body = own ? data.text.trim() : rest;
  const words = Math.max(1, plainText(statement).split(/\s+/).filter(Boolean).length);
  const deco = density(ctx);
  // the shot that reads best in a small wide capsule: a single bust or a product, framed tightly
  // (the story's own photo first; a mother-and-daughter portrait gives way to the single bust)
  const ownShot = ctx.asset(data.image);
  const pill = deco > 0 ? (ownShot ?? bestShot([pickMedia(ctx, data), ...productShots(ctx)], PILL)) : null;
  const field = bgFamily(ctx, bg) !== "light";
  const length = plainText(statement).length;
  return (
    <>
      <Backdrop ctx={ctx} id={id} />
      <Container className="lp-story__mani">
        {deco > 0 && field ? (
          <>
            <GlowOrb className="lp-story__glow lp-story__glow--lead" size="78%" shape="wide" place="top-start" tone="accent" intensity="soft" />
            <GlowOrb className="lp-story__glow" size="54%" place="bottom-end" intensity="subtle" />
          </>
        ) : null}

        <header className="lp-story__mhead">
          <Kicker ctx={ctx} text={data.kicker} look="label" as="span" editPath="kicker" reveal="fade" />
          <span className="lp-story__mrule" aria-hidden="true" />
          <RichText
            as="h2"
            id={titleId}
            className="lp-story__mtitle lp-h4"
            text={data.title}
            ctx={ctx}
            decorate={false}
            editPath="title"
            reveal="fade"
            delay={80}
          />
        </header>

        <p
          className={cx("lp-story__say lp-display-3", length <= 110 && "lp-story__say--short", length > 170 && "lp-story__say--long")}
          style={cssVars({ "--wn": words })}
        >
          {pill ? (
            <span className={pill.alpha ? "lp-story__pill lp-story__pill--cutout" : "lp-story__pill"} aria-hidden="true">
              <Picture asset={pill} sizes="9rem" fit={pill.alpha ? "contain" : "cover"} frame={PILL} alt="" className="lp-story__pillpic" />
            </span>
          ) : null}
          <RichText
            as="span"
            className="lp-story__words"
            text={statement}
            ctx={ctx}
            editPath={own ? "statement" : "text"}
            reveal="blur-in"
            delay={120}
            decorate={false}
            split
          />
        </p>

        <div className="lp-story__mfoot">
          <span className="lp-story__mprog" aria-hidden="true" />
          <Signature ctx={ctx} data={data} look="row" />
          {body ? <RichText block className="lp-story__mtext" text={body} ctx={ctx} editPath="text" reveal="fade" delay={140} /> : null}
          <StoryCta ctx={ctx} data={data} delay={220} />
        </div>
      </Container>
    </>
  );
}
