/**
 * faq/chat — the FAQ as a conversation with the brand. A raised messenger window (store avatar,
 * name, channel status) holds the thread. It opens the way a real WhatsApp chat from a product page
 * does: the shopper's first message carries a link preview of THIS product (photo, name, cash on
 * delivery). Then each question is the shopper's bubble on the inline end (accent fill) and each
 * answer the brand's bubble on the inline start. Signature: on scroll a question pops from its
 * tail, then the answer arrives as a typing indicator that blooms into the message. The composer at
 * the bottom is the real action: it opens WhatsApp (or calls) with the question prefilled.
 * Brand-styled from the theme — never a copy of WhatsApp.
 */
import type { ReactElement } from "react";
import { DotGrid, GlowOrb, ZelligeLines } from "@/landing/illustrations";
import { Container, Icon, Picture, RichText, cx, reveal } from "@/landing/primitives";
import type { RenderContext } from "../../types";
import { hasStoreName } from "../persona";
import { ui } from "./copy";
import { bestShot } from "../story/fit";
import { Head, channelOf, type ViewProps } from "./parts";

/** The link preview's square thumbnail, framed tightly (a bust, a product filling it). */
const THUMB = { shape: "rounded" as const, ratio: 1, tight: true };

/**
 * Store avatar for the window header: the uploaded logo, else a monogram of the store name — or,
 * while the store has no name, a neutral chat glyph (a monogram of the product would be a persona).
 */
function Avatar({ ctx, named }: { ctx: RenderContext; named: boolean }): ReactElement {
  const logo = ctx.store.logo ?? null;
  const initial = Array.from(ctx.store.name.trim())[0]?.toLocaleUpperCase(ctx.locale) ?? "";
  return (
    <span className={cx("lp-faq__ava", logo && "lp-faq__ava--logo")} aria-hidden="true">
      {logo ? <Picture asset={logo} alt="" sizes="48px" fit={logo.alpha ? "contain" : "cover"} /> : named ? initial : <Icon name="chat" size="1.2rem" />}
    </span>
  );
}

/**
 * The shopper's opening message: a link preview of the product (first photo, else the cutout) with
 * the COD promise, above a short greeting. Context, not content — hidden from assistive tech, the
 * product is named everywhere else on the page.
 */
function Opener({ ctx }: { ctx: RenderContext }): ReactElement {
  const t = ui(ctx.locale);
  // the shot that reads best as a small square thumbnail: a single bust, a product filling it
  const photo = bestShot([...ctx.product.images.map((r) => ctx.asset(r)), ctx.asset(ctx.product.cutout)], THUMB);
  return (
    <li className="lp-faq__pair" aria-hidden="true">
      <div className="lp-faq__bub lp-faq__bub--q lp-faq__bub--open" {...reveal("scale-in")}>
        <span className="lp-faq__link">
          {photo ? (
            <Picture
              asset={photo}
              alt=""
              sizes="4.5rem"
              ratio={1}
              fit={photo.alpha ? "contain" : "cover"}
              frame={photo.alpha ? undefined : THUMB}
              className={cx("lp-faq__thumb", photo.alpha && "lp-faq__thumb--cut")}
            />
          ) : null}
          <span className="lp-faq__link-copy">
            {/* a Latin name on an Arabic page keeps its own direction: clamped at its own logical end */}
            <bdi className="lp-faq__link-name">{ctx.product.name}</bdi>
            <span className="lp-faq__link-meta">
              <Icon name="cash" size="1em" />
              {t.cod}
            </span>
          </span>
        </span>
        <span className="lp-faq__cq lp-faq__hello">{t.hello}</span>
      </div>
    </li>
  );
}

/**
 * The archetype's modern motif, felt rather than read: zellige hairlines behind the heading (souk),
 * a fine dot grid around the window (circuit, apothecary). None on sparse-ornament themes.
 */
function Motif({ ctx, id, at }: { ctx: RenderContext; id: string; at: "intro" | "stage" }): ReactElement | null {
  if (ctx.ornament < 0.3) return null;
  if (at === "intro" && ctx.archetype === "souk")
    return <ZelligeLines uid={`${id}-zl`} className="lp-faq__motif" opacity={0.09} fade="radial" />;
  if (at === "stage" && (ctx.archetype === "circuit" || ctx.archetype === "apothecary"))
    return <DotGrid className="lp-faq__motif" opacity={0.5} fade="radial" />;
  return null;
}

export function Chat({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const t = ui(ctx.locale);
  const channel = channelOf(ctx);
  const open = data.help && !!channel;
  const helpTitle = data.helpTitle.trim();
  const helpText = data.helpText.trim();
  const label = data.helpLabel.trim() || channel?.label || "";
  // without a store name the window is the shop's customer care, not the product as a person
  const named = hasStoreName(ctx);
  // status line: the channel's own ("Replies on WhatsApp"); unnamed, the phone's "Customer care"
  // would repeat the header name, so a true fact (cash on delivery) takes its place
  const ownStatus = channel && (named || channel.kind === "whatsapp") ? channel : null;
  return (
    <Container className="lp-faq__chat">
      <div className="lp-faq__intro">
        <Motif ctx={ctx} id={id} at="intro" />
        <Head ctx={ctx} data={data} titleId={titleId} size="m" />
      </div>
      <div className="lp-faq__stage lp-decor-host">
        <GlowOrb className="lp-faq__glow" size="78%" intensity="soft" place="center" />
        <Motif ctx={ctx} id={id} at="stage" />
        <div className="lp-faq__win" {...reveal("rise")}>
          <div className="lp-faq__bar">
            <Avatar ctx={ctx} named={named} />
            <span className="lp-faq__who">
              <bdi className="lp-faq__name">{named ? ctx.store.name.trim() : t.care}</bdi>
              <span className="lp-faq__status">
                {ownStatus ? <Icon name={ownStatus.icon} size="0.95rem" /> : named ? null : <Icon name="cash" size="0.95rem" />}
                {ownStatus?.status ?? (named ? t.care : t.cod)}
              </span>
            </span>
          </div>
          <ol role="list" className="lp-faq__thread" aria-label={t.thread} data-stagger="120">
            <Opener ctx={ctx} />
            {data.items.map((it, i) => (
              <li key={i} className="lp-faq__pair">
                <div className="lp-faq__bub lp-faq__bub--q" {...reveal("scale-in")}>
                  <RichText as="h3" className="lp-faq__cq" text={it.q} ctx={ctx} decorate={false} editPath={`items.${i}.q`} />
                </div>
                <div className="lp-faq__bub lp-faq__bub--a" {...reveal("scale-in", 260)}>
                  <RichText block className="lp-faq__ca" text={it.a} ctx={ctx} decorate={false} editPath={`items.${i}.a`} />
                </div>
              </li>
            ))}
            {open && (helpTitle || helpText) ? (
              <li className="lp-faq__pair">
                <div className="lp-faq__bub lp-faq__bub--a" {...reveal("scale-in", 120)}>
                  <p className="lp-faq__ca">
                    {helpTitle ? <RichText as="strong" className="lp-faq__ctitle" text={helpTitle} ctx={ctx} decorate={false} editPath="helpTitle" /> : null}
                    {helpTitle && helpText ? " " : null}
                    {helpText ? <RichText as="span" text={helpText} ctx={ctx} decorate={false} editPath="helpText" /> : null}
                  </p>
                </div>
              </li>
            ) : null}
          </ol>
          {open && channel ? (
            <a
              className="lp-faq__compose"
              href={channel.href}
              {...(channel.kind === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              <span className="lp-faq__ph" aria-hidden="true">
                <span className="lp-faq__ph-t">{t.compose}</span>
              </span>
              <span className="lp-faq__send">
                <Icon name={channel.icon} size="1.15rem" />
                <span className="lp-faq__send-t">{label}</span>
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
