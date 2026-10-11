/**
 * Pieces shared by the FAQ views: the heading, the contact channel (WhatsApp, else phone) and the
 * "still a question?" line. Pure: props in → JSX out.
 */
import type { ReactElement } from "react";
import { Icon, LinkButton, RichText, SectionHeader, cx, reveal, safeHref, type IconName } from "@/landing/primitives";
import { whatsappDigits, whatsappNumber } from "@/lib/render/config";
import type { RenderContext } from "../../types";
import { shortName, ui } from "./copy";
import type { Data } from "./schema";

export interface ViewProps {
  ctx: RenderContext;
  data: Data;
  /** section instance id (anchors, exclusive-accordion name) */
  id: string;
  /** id of the visible title (the section is labelled by it) */
  titleId: string;
}

/** "01", "02"… — editorial index, Latin digits like the rest of the page's numerals. */
export const num2 = (i: number): string => String(i + 1).padStart(2, "0");

export function Head({
  ctx,
  data,
  titleId,
  align = "start",
  size = "l",
}: Pick<ViewProps, "ctx" | "data" | "titleId"> & { align?: "start" | "center" | "split"; size?: "m" | "l" }): ReactElement | null {
  return (
    <SectionHeader
      ctx={ctx}
      kicker={data.kicker}
      title={data.title}
      lead={data.lead}
      align={align}
      size={size}
      editBase=""
      titleId={titleId}
      className="lp-faq__head"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Contact channel                                                     */
/* ------------------------------------------------------------------ */

export interface Channel {
  kind: "whatsapp" | "phone";
  href: string;
  icon: IconName;
  /** the channel's own button label (used when the merchant left helpLabel empty) */
  label: string;
  /** one-line status for the chat header */
  status: string;
}

/** encodeURIComponent leaves ' ( ) * ! as is; safeHref refuses quotes ("j'ai"), so encode them all. */
const encodeStrict = (s: string): string =>
  encodeURIComponent(s).replace(/['()*!]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * The store's question channel: WhatsApp (the page's form number when WhatsApp ordering is on, else
 * the store profile) with a prefilled question about the product, else a tel: link. Numbers are
 * normalized to 8–15 digits before they reach a URL; null when the store has neither.
 */
export function channelOf(ctx: RenderContext): Channel | null {
  const t = ui(ctx.locale);
  const wa = whatsappNumber(ctx.doc, ctx.store.whatsapp);
  if (wa) {
    // links are capped at 500 chars (safeHref): Arabic text triples when encoded, so a long product
    // name falls back to its short form, then to a message without it
    const base = `https://wa.me/${wa}?text=`;
    const href = [ctx.product.name, shortName(ctx.product.name), ""]
      .map((name) => base + encodeStrict(t.message.replace("{name}", name).replace(/[\s:：]+$/, "").replace(/\s+/g, " ").trim()))
      .find((h) => h.length <= 480);
    const safe = safeHref(href);
    if (safe) return { kind: "whatsapp", href: safe, icon: "whatsapp", label: t.wa, status: t.waStatus };
  }
  const tel = whatsappDigits(ctx.store.phone, ctx.doc.form.phoneCountry);
  const href = tel ? safeHref(`tel:+${tel}`) : undefined;
  return href ? { kind: "phone", href, icon: "phone", label: t.call, status: t.care } : null;
}

/* ------------------------------------------------------------------ */
/* "Still a question?"                                                 */
/* ------------------------------------------------------------------ */

/**
 * Closing contact line: an icon disc, the title and one line of text, and the channel button.
 * Hidden when switched off or when the store has no channel to answer on.
 */
export function Help({
  ctx,
  data,
  channel,
  className,
  delay = 0,
  buttonIcon = true,
}: {
  ctx: RenderContext;
  data: Data;
  channel: Channel | null;
  className?: string;
  delay?: number;
  /** false when the button sits right under the icon disc (one channel glyph is enough) */
  buttonIcon?: boolean;
}): ReactElement | null {
  if (!data.help || !channel) return null;
  const title = data.helpTitle.trim();
  const text = data.helpText.trim();
  const custom = data.helpLabel.trim();
  return (
    <div className={cx("lp-faq__help", className)} {...reveal("rise", delay)}>
      <span className="lp-faq__help-ico" aria-hidden="true">
        <Icon name={channel.icon} size="1.35rem" />
      </span>
      {title || text ? (
        <div className="lp-faq__help-copy">
          {title ? <RichText as="p" className="lp-faq__help-title" text={title} ctx={ctx} decorate={false} editPath="helpTitle" /> : null}
          {text ? <RichText as="p" className="lp-faq__help-text" text={text} ctx={ctx} decorate={false} editPath="helpText" /> : null}
        </div>
      ) : null}
      <LinkButton
        ctx={ctx}
        href={channel.href}
        label={custom || channel.label}
        variant="primary"
        size="m"
        icon={buttonIcon ? channel.icon : undefined}
        className="lp-faq__help-btn"
        editPath={custom ? "helpLabel" : undefined}
      />
    </div>
  );
}
