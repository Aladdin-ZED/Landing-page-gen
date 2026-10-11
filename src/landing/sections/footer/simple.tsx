/**
 * `simple` — a calm, precise footer. The brand (monogram + name, short line, COD capsule) faces a
 * small bento of contact: the lead channel (WhatsApp first — how this market reaches a shop) as an
 * accent tile with the number set large, and the other channels in one grouped card with hairline
 * rows. Under a hairline that draws across: legal links, socials, back-to-top, the identity line.
 */
import type { ReactElement } from "react";
import { cssVars, Icon, reveal, RichText } from "../../primitives";
import type { RenderContext } from "../../types";
import type { Chrome } from "./copy";
import { figureFit } from "./giant";
import type { FooterData } from "./model";
import {
  Brand,
  type Channel,
  ChannelIcon,
  ChannelLink,
  channels,
  ChannelValue,
  chromeOf,
  CodPill,
  Identity,
  LegalNav,
  Socials,
  ToTop,
} from "./parts";

/** The lead tile speaks as an action ("Message on WhatsApp", "Call us"), the number under it. */
const actionOf = (ch: Channel, c: Chrome): string =>
  ch.key === "whatsapp" ? c.askWhatsapp : ch.key === "phone" ? c.call : c.write;

/**
 * The lead tile: the channel as an action with its number set large in the display face. The
 * number is fitted to the tile width from the face's measured figure widths (`--ft-em` = its
 * advance in em, `--ft-ws` = extra space between digit groups), so it reads big in a condensed
 * face and never overflows in a wide one. An e-mail lead wraps instead.
 */
function LeadTile({
  ch,
  c,
  ctx,
}: {
  ch: Channel;
  c: Chrome;
  ctx: RenderContext;
}): ReactElement {
  const action = actionOf(ch, c);
  const fit = ch.key === "email" ? null : figureFit(ctx, ch.value);
  return (
    <ChannelLink
      ch={ch}
      c={c}
      className="lp-footer__prime"
      name={`${action} ${ch.value}`}
      revealKind="rise"
    >
      <span className="lp-footer__prime-icon" aria-hidden="true">
        <ChannelIcon k={ch.key} size="1.4em" />
      </span>
      <span className="lp-footer__prime-go" aria-hidden="true">
        <Icon
          name="arrow-up-right"
          size="1.15em"
          className="lp-footer__prime-arrow"
        />
      </span>
      <span className="lp-footer__prime-body">
        <span className="lp-footer__prime-label">{action}</span>
        <ChannelValue
          ch={ch}
          className="lp-footer__prime-fit"
          style={
            fit
              ? cssVars({
                  "--ft-em": String(Math.round(fit.em * 100) / 100),
                  "--ft-ws": `${Math.round(fit.space * 1000) / 1000}em`,
                })
              : undefined
          }
        />
      </span>
    </ChannelLink>
  );
}

function Rows({ list, c }: { list: Channel[]; c: Chrome }): ReactElement {
  return (
    <ul className="lp-footer__rows" role="list" {...reveal("rise")}>
      {list.map((ch) => (
        <li key={ch.key} className="lp-footer__rows-item">
          <ChannelLink ch={ch} c={c} className="lp-footer__row">
            <span className="lp-footer__row-icon" aria-hidden="true">
              <ChannelIcon k={ch.key} size="1.1em" />
            </span>
            <span className="lp-footer__row-body">
              <span className="lp-footer__row-label">{ch.label}</span>
              <ChannelValue ch={ch} className="lp-footer__row-value" />
            </span>
            {ch.href ? (
              <Icon
                name="arrow-up-right"
                size="1em"
                className="lp-footer__row-go"
              />
            ) : null}
          </ChannelLink>
        </li>
      ))}
    </ul>
  );
}

export function Simple({
  ctx,
  data,
}: {
  ctx: RenderContext;
  data: FooterData;
}): ReactElement {
  const c = chromeOf(ctx);
  const reach = data.showContact ? channels(ctx, c, data.showAddress) : [];
  const leadAt = reach.findIndex((ch) => ch.href);
  const lead = leadAt >= 0 ? reach[leadAt] : undefined;
  const rest = reach.filter((_, i) => i !== leadAt);
  const socials = data.showSocials ? <Socials ctx={ctx} c={c} /> : null;
  return (
    <div
      className="lp-container lp-footer__grid"
      data-reach={
        reach.length ? (lead && rest.length ? "duo" : "solo") : undefined
      }
    >
      <div className="lp-footer__intro">
        <div className="lp-footer__mark" {...reveal("blur-in")}>
          <Brand ctx={ctx} />
        </div>
        <RichText
          as="p"
          className="lp-footer__tagline"
          text={data.tagline}
          ctx={ctx}
          decorate={false}
          reveal="fade"
          delay={120}
          editPath="tagline"
        />
        <CodPill ctx={ctx} text={data.cod} delay={220} />
      </div>

      {reach.length ? (
        <div className="lp-footer__reach" data-stagger="110">
          {lead ? <LeadTile ch={lead} c={c} ctx={ctx} /> : null}
          {rest.length ? <Rows list={rest} c={c} /> : null}
        </div>
      ) : null}

      <span
        className="lp-footer__rule"
        aria-hidden="true"
        {...reveal("wipe-side", 120)}
      />

      <LegalNav ctx={ctx} c={c} stagger={60} />

      {socials || data.backToTop ? (
        <div className="lp-footer__meta" {...reveal("fade", 200)}>
          {socials}
          {data.backToTop ? <ToTop c={c} /> : null}
        </div>
      ) : null}

      <div className="lp-footer__fine" {...reveal("fade", 260)}>
        <Identity ctx={ctx} />
      </div>
    </div>
  );
}
