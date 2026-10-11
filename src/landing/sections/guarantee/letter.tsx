/**
 * letter → promise card — the promise written and signed. One wide raised card floating on a pool of
 * product light: the store's mark rides the card's top edge and lights the corner it sits in, the
 * promise is set large in display type, the sentence under it, then a quiet signature row (a
 * hairline that draws out, the signer in the emphasis face, the role as a small label). The checked
 * promises and the order button sit in a tinted tray inset in the card's end side (a hairline column
 * on the quiet-luxury and editorial archetypes); the button settles level with the signature. On
 * phones everything stacks and the tray closes the card.
 */
import type { ReactElement } from "react";
import { CheckMark, GlowOrb } from "@/landing/illustrations";
import { Icon, Kicker, Picture, RichText, TITLE_REVEAL, cx, reveal } from "@/landing/primitives";
import { hasStoreName } from "../persona";
import { COMMON, langOf } from "./copy";
import { initialOf, promiseLines, typo, type ViewProps } from "./model";
import { Foot, Text } from "./parts";

export function Letter({ ctx, data, titleId }: ViewProps): ReactElement {
  const lines = promiseLines(data);
  const lang = langOf(ctx.locale);
  // a typed signer, else the store — never the product standing in for a store without a name: the
  // promise is then signed by the role alone ("Le service client") under a promise glyph
  const name = data.signName.trim() || (hasStoreName(ctx) ? ctx.store.name.trim() : "");
  const role = data.signRole.trim() || COMMON[lang].signRole;
  const logo = ctx.store.logo ?? null;
  return (
    <div className="lp-container lp-guarantee__wrap lp-cq">
      <GlowOrb shape="wide" size="92%" intensity="soft" place="center" className="lp-guarantee__pool" />
      <article className="lp-guarantee__letter" {...reveal("tilt-in")}>
        <span className="lp-guarantee__mark" data-logo={logo ? "" : undefined} aria-hidden="true" {...reveal("stamp", 260)}>
          {logo ? (
            <Picture asset={logo} sizes="4.5rem" fit="contain" className="lp-guarantee__logo" alt="" />
          ) : name ? (
            <span className="lp-guarantee__initial">{initialOf(name)}</span>
          ) : (
            <Icon name="check-hand" size="46%" strokeWidth={1.6} className="lp-guarantee__glyph" />
          )}
        </span>
        <div className="lp-guarantee__main">
          <Kicker ctx={ctx} text={data.kicker} editPath="kicker" reveal="fade" delay={120} className="lp-guarantee__kicker" />
          <RichText
            as="h2"
            id={titleId}
            className="lp-guarantee__statement lp-h1"
            text={typo(ctx.locale, data.title)}
            ctx={ctx}
            editPath="title"
            reveal={TITLE_REVEAL[ctx.archetype]}
            delay={180}
            split
          />
          {data.lead.trim() ? (
            <RichText as="div" block className="lp-guarantee__body lp-lead" text={typo(ctx.locale, data.lead)} ctx={ctx} editPath="lead" reveal="fade" delay={380} />
          ) : null}
          <footer className="lp-guarantee__sign">
            <svg className="lp-guarantee__sign-rule" viewBox="0 0 100 2" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-reveal="draw" data-delay="520">
              <path d="M0 1H100" pathLength={1} className="lp-draw" />
            </svg>
            {/* the name writes itself on along the rule, the role settles after it */}
            <span className="lp-guarantee__signer">
              <span className="lp-guarantee__pen" {...reveal("wipe-side", 700)}>
                <Text ctx={ctx} text={name || role} path={name ? "signName" : "signRole"} className="lp-guarantee__name lp-hand" />
              </span>
              {name ? (
                <span {...reveal("fade", 1020)}>
                  <Text ctx={ctx} text={role} path="signRole" className="lp-guarantee__role lp-label" />
                </span>
              ) : null}
            </span>
          </footer>
        </div>
        <div className="lp-guarantee__side" {...reveal("fade", 220)}>
          {lines.length ? (
            <ul className="lp-guarantee__checks" role="list">
              {lines.map((l, i) => (
                <li key={i} className="lp-guarantee__check" {...reveal("rise", 320 + i * 90)}>
                  <CheckMark frame="disc" tone="accent" weight={4.2} className="lp-guarantee__tick" />
                  <span className="lp-guarantee__check-txt">
                    <RichText
                      as="span"
                      className={cx("lp-guarantee__ph", !l.titled && "lp-guarantee__ph--plain")}
                      text={typo(ctx.locale, l.head)}
                      ctx={ctx}
                      decorate={false}
                      editPath={l.headPath}
                    />
                    {l.body ? (
                      <RichText as="span" className="lp-guarantee__pb" text={typo(ctx.locale, l.body)} ctx={ctx} decorate={false} editPath={l.bodyPath} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Foot ctx={ctx} data={data} delay={580} />
        </div>
      </article>
    </div>
  );
}
