/**
 * whatsapp — recreated WhatsApp threads in modern phones. The screens are illustrations of the real
 * app (light mode: warm wallpaper, white/green bubbles with smooth tails, blue read ticks, a photo
 * message), so their chrome keeps the app's own palette; everything around them follows the theme.
 * Phones: brushed band tinted from the product's neutral, near-black bezel, cover-glass light.
 * Desktop: a concave triptych — the photo thread forward in the middle, the side phones turned toward
 * it in 3D and tucked behind its edges (they swing out from behind it on reveal, turn toward the
 * pointer on hover and drift on scroll). Mobile: a snap strip whose neighbours recede as they scroll.
 * Signature: bubbles pop in from their tails one after the other, then the ticks turn blue; the
 * merchant's note is a glass label on a leader drawn from the customer's photo, stepping out of the frame.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "../../illustrations";
import { Container, Icon, Picture, RichText, SectionShell, editAttr, reveal } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { say } from "../reviews/parts";
import { hasStoreName } from "../persona";
import { UI, fillIn } from "./copy";
import { Avatar, CtaRow, Header, titleId } from "./parts";
import type { ChatData, Props } from "./schema";

/** WhatsApp's double tick (read receipt). */
function Ticks(): ReactElement {
  return (
    <svg className="lp-sp__ticks" viewBox="0 0 18 11" aria-hidden="true" focusable="false">
      <path d="M1 6.2l2.6 2.6L9.4 2.4M6.6 8.8l.9.9L13.8 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Video-call camera of the chat header. */
function Video(): ReactElement {
  return (
    <svg className="lp-sp__vid" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.75" y="6.25" width="13" height="11.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.75 10.4l4.1-2.5c.6-.36 1.4.07 1.4.78v6.64c0 .71-.8 1.14-1.4.78l-4.1-2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

/** Composer microphone. */
function Mic(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5a2.6 2.6 0 0 0-2.6 2.6v5.6a2.6 2.6 0 0 0 5.2 0V6.1A2.6 2.6 0 0 0 12 3.5zM6.8 11.3a5.2 5.2 0 0 0 10.4 0M12 16.6v3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Signal, wifi and battery of the status bar. */
function StatusIcons(): ReactElement {
  return (
    <svg className="lp-sp__sys" viewBox="0 0 46 12" aria-hidden="true" focusable="false">
      <path d="M1 10.5h2v-2H1zM5 10.5h2v-4H5zM9 10.5h2V4.5H9zM13 10.5h2v-8h-2z" fill="currentColor" />
      <path d="M19.5 5.2a6.6 6.6 0 0 1 9 0M21.4 7.3a3.8 3.8 0 0 1 5.2 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M24 10.6l1.3-1.4a1.9 1.9 0 0 0-2.6 0z" fill="currentColor" />
      <rect x="32" y="2" width="11.5" height="8.5" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".45" />
      <rect x="33.6" y="3.6" width="7.4" height="5.3" rx="1.3" fill="currentColor" />
      <path d="M44.6 4.8v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".45" />
    </svg>
  );
}

const TIME = /^\d{1,2}[:.h]\d{2}$/;

/**
 * A photo message keeps the photo's own shape, like the app (3:4 to 4:3): a landscape shot of a
 * product is never squeezed into a portrait slot that would clip it.
 */
const chatRatio = (a: ResolvedAsset): string => {
  const r = a.width > 0 && a.height > 0 ? a.width / a.height : 0.8;
  return String(Math.round(Math.min(4 / 3, Math.max(3 / 4, r)) * 1000) / 1000);
};

/** Messages that have something to show (text or a resolvable photo), with their data index. */
function visibleMessages(ctx: RenderContext, chat: ChatData) {
  return chat.messages
    .map((m, mi) => ({ m, mi, photo: ctx.asset(m.photo) }))
    .filter((x) => x.m.text.trim() || x.photo);
}

function Thread({ ctx, chat, ci, note, delay }: { ctx: RenderContext; chat: ChatData; ci: number; note: string; delay: number }) {
  const msgs = visibleMessages(ctx, chat);
  const base = `chats.${ci}`;
  // a store without a real name (the product stands in for it) is read as "the store", never as the product
  const storeName = hasStoreName(ctx) ? ctx.store.name : say(ctx, UI.store);
  // the status-bar clock shows the last message's time, like a screenshot taken right after it
  const clock = [...msgs].reverse().find((x) => TIME.test(x.m.time.trim()))?.m.time.trim() ?? "";
  const notedAt = note ? msgs.findIndex((x) => x.photo) : -1;
  return (
    <figure className="lp-sp__phone" aria-label={fillIn(say(ctx, UI.chatWith), { name: chat.name })}>
      <div className="lp-sp__screen">
        <div className="lp-sp__top" aria-hidden="true">
          <div className="lp-sp__status">
            <span dir="ltr">
              {clock}
            </span>
            <span className="lp-sp__island" />
            <StatusIcons />
          </div>
          <div className="lp-sp__bar">
            <Icon name="chevron-left" size="1.4em" />
            <Avatar name={chat.name} />
            <span className="lp-sp__contact">
              <span className="lp-sp__cname" {...editAttr(ctx, `${base}.name`)}>
                {chat.name}
              </span>
              {chat.city.trim() ? (
                <span className="lp-sp__csub" {...editAttr(ctx, `${base}.city`)}>
                  {chat.city}
                </span>
              ) : null}
            </span>
            <span className="lp-sp__calls">
              <Video />
              <Icon name="phone" size="1.2em" />
            </span>
          </div>
        </div>
        <ol className="lp-sp__msgs" role="list" data-stagger="120">
          {chat.day.trim() ? (
            <li className="lp-sp__day" {...editAttr(ctx, `${base}.day`)} {...reveal("fade", delay)}>
              {chat.day}
            </li>
          ) : null}
          {msgs.map(({ m, mi, photo }, k) => {
            const mine = m.from === "store";
            const head = k === 0 || msgs[k - 1]!.m.from !== m.from;
            const tail = k === msgs.length - 1 || msgs[k + 1]!.m.from !== m.from;
            const text = m.text.trim();
            const time = m.time.trim();
            return (
              <li
                key={mi}
                className="lp-sp__msg"
                data-from={mine ? "store" : "customer"}
                data-head={head ? "" : undefined}
                data-tail={tail ? "" : undefined}
                {...reveal("scale-in", delay + 140)}
              >
                <span className="lp-visually-hidden">{mine ? storeName : chat.name}: </span>
                <div className="lp-sp__bubble" data-photo={photo ? "" : undefined} data-over={photo && !text ? "" : undefined}>
                  {photo ? (
                    <Picture
                      asset={photo}
                      sizes="(min-width: 62rem) 13rem, 52vw"
                      ratio={chatRatio(photo)}
                      frame={{ shape: "rounded", ratio: chatRatio(photo) }}
                      className="lp-sp__pic"
                      alt={photo.alt || `${chat.name}, ${ctx.product.name}`}
                    />
                  ) : null}
                  {text ? (
                    // RichText: WhatsApp's own *bold*, and numbers ("24–48") keep their order in Arabic
                    <span className="lp-sp__text" dir="auto" {...editAttr(ctx, `${base}.messages.${mi}.text`)}>
                      <RichText text={m.text} ctx={ctx} decorate={false} />
                    </span>
                  ) : null}
                  {time || mine ? (
                    <span className="lp-sp__meta" aria-hidden="true">
                      {time ? <span dir="ltr">{time}</span> : null}
                      {mine ? <Ticks /> : null}
                    </span>
                  ) : null}
                  {k === notedAt ? (
                    // anchored to the photo's outer edge: a precise leader, then a glass label that
                    // steps out of the phone frame onto the stage
                    <span className="lp-sp__note" {...editAttr(ctx, "note")}>
                      <span className="lp-sp__pin" aria-hidden="true" />
                      <RichText className="lp-sp__note-t" text={note} ctx={ctx} decorate={false} />
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="lp-sp__composer" aria-hidden="true">
          <Icon name="plus" size="1.35em" className="lp-sp__plus" />
          <span className="lp-sp__field">{say(ctx, UI.typing)}</span>
          <span className="lp-sp__mic">
            <Mic />
          </span>
        </div>
      </div>
    </figure>
  );
}

/** Desktop roles: the photo thread forward in the middle, the others turned toward it at its sides. */
const POS = ["hero", "start", "end"] as const;
/** Side phones drift against the scroll a little (runtime parallax, desktop only). */
const DRIFT = { hero: undefined, start: "0.05", end: "-0.04" } as const;

export function WhatsAppView({ id, ctx, data, bg }: Props): ReactElement {
  const note = data.note.trim();
  const shown = data.chats.map((chat, ci) => ({ chat, ci })).filter((x) => visibleMessages(ctx, x.chat).length > 0);
  // the thread with the customer's photo leads (first in the mobile strip, centre stage on desktop) and carries the note
  const photoAt = shown.findIndex((x) => x.chat.messages.some((m) => ctx.asset(m.photo)));
  const lead = Math.max(0, photoAt);
  const ordered = shown.length ? [shown[lead]!, ...shown.filter((_, k) => k !== lead)] : [];
  return (
    <SectionShell id={id} ctx={ctx} type="socialProof" variant="whatsapp" bg={bg} labelledBy={titleId(id)}>
      <Container>
        <Header ctx={ctx} data={data} id={id} align="split" />
      </Container>
      <div className="lp-sp__stage lp-decor-host">
        <GlowOrb place="center" shape="wide" size="min(64rem, 92%)" intensity="soft" className="lp-sp__glow" />
        <ul className="lp-sp__phones" role="list" data-count={ordered.length}>
          {ordered.map(({ chat, ci }, k) => {
            const pos = k === 0 ? "hero" : POS[ordered.length === 3 ? k : 2]!;
            return (
              <li
                key={ci}
                className="lp-sp__slot"
                data-pos={pos}
                // the forward phone rises; the side phones fade while they swing out from behind it
                {...reveal(k === 0 ? "rise" : "fade", k * 140)}
              >
                <div className="lp-sp__float" data-parallax={DRIFT[pos]}>
                  <Thread ctx={ctx} chat={chat} ci={ci} note={k === 0 && photoAt >= 0 ? note : ""} delay={220 + k * 160} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <Container>
        <CtaRow ctx={ctx} data={data} />
      </Container>
    </SectionShell>
  );
}
