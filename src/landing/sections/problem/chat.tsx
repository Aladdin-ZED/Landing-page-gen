/**
 * chat — the pains arrive as the shopper's own messages in a frosted conversation card; the shop
 * types (three soft dots), then answers: a short line (the turn label), then a product card — photo
 * with a glass price tag, the solution line and a real order button inside the bubble. Bubbles pop
 * from their corner on a spring and group like a modern messenger.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Cta, Icon, Money, Picture, RichText, SectionHeader, cx, pad2, reveal } from "@/landing/primitives";
import { copyLang, density, isPerson } from "../benefits/kit";
import { Val } from "../benefits/val";
import { hasStoreName } from "../persona";
import { CHAT_UI } from "./copy";
import type { ViewProps } from "./model";
import { chipCorner, isLandscape, pickVisual } from "./parts";

/** Reading pace of the thread (ms between messages) and the typing pause before the answer. */
const MSG_STEP = 420;
const TYPING_MS = 1000;
/** the shop's second bubble follows its first after this beat */
const REPLY_STEP = 360;

/** Read receipt: two clean ticks. */
function Ticks(): ReactElement {
  return (
    <svg className="lp-problem__ticks" viewBox="0 0 18 11" aria-hidden="true" focusable="false">
      <path d="M1 6.2 4.2 9.4 10.6 1.6M7.4 8.6l.8.8 6.4-7.8" />
    </svg>
  );
}

/** Position of a bubble inside a run of consecutive messages (drives the grouped corner radii). */
const groupPos = (i: number, n: number) => (n === 1 ? "solo" : i === 0 ? "first" : i === n - 1 ? "last" : "mid");

export function Chat({ ctx, data, id, titleId }: ViewProps): ReactElement {
  const ui = CHAT_UI[copyLang(ctx.locale)];
  const photo = pickVisual(ctx, data, "second");
  // the attached photo: a wide shot or a cutout 16:10, a person a portrait 4:5 (head to hands), a
  // product 4:3 — fitted to that frame; the price tag takes the corner where it covers no face
  const attachRatio = !photo ? 4 / 3 : photo.alpha || isLandscape(photo) ? 1.6 : isPerson(photo) ? 0.8 : 4 / 3;
  const tagCorner = photo ? chipCorner(ctx, photo, attachRatio, { w: 0.4, h: 0.16 }, { block: "start", inline: "end" }) : undefined;
  // without a store name the shop answers as its customer care, never as the product in person
  const named = hasStoreName(ctx);
  const store = named ? ctx.store.name.trim() : ui.care;
  const initial = named ? ([...store][0]?.toUpperCase() ?? "") : "";
  const solution = data.solution.trim();
  const note = data.note.trim();
  const n = data.pains.length;
  // the shop's run: an optional short line, then the product card (when there is anything to show)
  const card = !!(solution || data.cta);
  const replies = (note ? 1 : 0) + (card ? 1 : 0);

  // deterministic evening clock: the thread starts between 20:30 and 22:00, a minute or two apart
  const r = ctx.rng(`problem-chat:${id}`);
  const start = 20 * 60 + 30 + Math.floor(r() * 90);
  const clock = (m: number) => `${pad2(Math.floor(m / 60) % 24)}:${pad2(m % 60)}`;
  // cumulative minute stamps (same rng draw order as before: one gap per message after the first)
  const stamps: number[] = [];
  for (let i = 0; i < n; i++) stamps.push(i === 0 ? start : stamps[i - 1] + Math.floor(r() * 2));
  const times = stamps.map(clock);
  const replyTime = clock((n ? stamps[n - 1] : start) + 2 + Math.floor(r() * 3));

  const typingAt = 260 + n * MSG_STEP;
  const replyAt = typingAt + TYPING_MS;

  return (
    <Container className="lp-problem__chatgrid">
      <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} lead={data.lead} editBase="" titleId={titleId} size="l" className="lp-problem__head" />

      <div className="lp-problem__stage">
        {density(ctx) > 0 ? <GlowOrb className="lp-problem__glow" size="125%" place="center" intensity="strong" /> : null}
        <div className="lp-problem__chat lp-glass" role="group" aria-label={ui.label} {...reveal("tilt-in")}>
          <div className="lp-problem__bar">
            <span className="lp-problem__avatar" aria-hidden="true">
              {ctx.store.logo ? (
                <Picture asset={ctx.store.logo} sizes="2.75rem" ratio={1} fit="contain" alt="" />
              ) : named ? (
                initial
              ) : (
                <Icon name="chat" size="1.2rem" />
              )}
            </span>
            <span className="lp-problem__who">
              <span className="lp-problem__store">{store}</span>
              {/* the green "online" dot only beside a real store's "online" line, never beside the COD line */}
              <span className="lp-problem__status" data-online={named ? "" : undefined}>
                {named ? ui.online : ui.cod}
              </span>
            </span>
          </div>

          <ol className="lp-problem__thread" role="list">
            <li className="lp-problem__day" aria-hidden="true">
              <span>{ui.today}</span>
            </li>
            {data.pains.map((p, i) => (
              <li
                key={i}
                className="lp-problem__msg lp-problem__msg--me"
                data-pos={groupPos(i, n)}
                {...reveal("scale-in", 260 + i * MSG_STEP)}
              >
                <RichText as="span" className="lp-problem__mtext" text={p.text} ctx={ctx} decorate={false} editPath={`pains.${i}.text`} />
                <span className="lp-problem__meta">
                  <time>{times[i]}</time>
                  <Ticks />
                </span>
              </li>
            ))}
            {replies ? (
              <li className="lp-problem__answer">
                {/* the shop is typing: shown only while the thread plays, then the answer takes its place */}
                <span className="lp-problem__typing" aria-hidden="true" {...reveal("fade", typingAt)}>
                  <i />
                  <i />
                  <i />
                </span>
                {note ? (
                  <p className="lp-problem__msg lp-problem__msg--them" data-pos={groupPos(0, replies)} {...reveal("scale-in", replyAt)}>
                    <Val ctx={ctx} text={note} className="lp-problem__mtext lp-problem__mnote" editPath="note" />
                  </p>
                ) : null}
                {card ? (
                  <div
                    className={cx("lp-problem__msg lp-problem__msg--them lp-problem__msg--card", photo && "lp-problem__msg--media")}
                    data-pos={groupPos(replies - 1, replies)}
                    {...reveal("scale-in", replyAt + (note ? REPLY_STEP : 0))}
                  >
                    {photo ? (
                      <div className={cx("lp-problem__attach", photo.alpha && "lp-problem__attach--cutout")}>
                        <Picture
                          asset={photo}
                          sizes="(min-width: 56rem) 19rem, 72vw"
                          ratio={attachRatio === 1.6 ? "16/10" : attachRatio === 0.8 ? "4/5" : "4/3"}
                          fit={photo.alpha ? "contain" : "cover"}
                          frame={photo.alpha ? undefined : { shape: "rounded", ratio: attachRatio, maxZoom: 1 }}
                          alt={photo.alt || ctx.product.name}
                        />
                        <span className="lp-problem__tag lp-glass" data-corner={tagCorner}>
                          <Money ctx={ctx} amount={ctx.product.price} />
                        </span>
                      </div>
                    ) : null}
                    {solution ? <RichText as="p" className="lp-problem__mtext lp-problem__msol" text={solution} ctx={ctx} editPath="solution" /> : null}
                    {data.cta ? (
                      <div className="lp-problem__mcta">
                        <Cta ctx={ctx} label={data.ctaLabel} editPath="ctaLabel" size="m" />
                      </div>
                    ) : null}
                    <span className="lp-problem__meta">
                      <time>{replyTime}</time>
                    </span>
                  </div>
                ) : null}
              </li>
            ) : null}
          </ol>

          <div className="lp-problem__composer" aria-hidden="true">
            <span className="lp-problem__field">{ui.placeholder}</span>
            <span className="lp-problem__send">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 19V5.5M6.5 11 12 5.5 17.5 11" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Container>
  );
}
