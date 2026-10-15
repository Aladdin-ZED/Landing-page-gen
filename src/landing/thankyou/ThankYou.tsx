/**
 * Thank-you page body — the confirmation moment, in the page's own theme (v2 · modern):
 *
 *   glass top bar (wordmark · COD chip)
 *   hero: a color-block panel lit by a soft aurora; an animated check drawing inside a glowing ring
 *         (two soft pulses, then still), the order number on a glass chip, a big display title with
 *         the shopper's name, the call-back message
 *   cards that float over the hero's lower edge: the glass order summary + a clean "what happens
 *         next" timeline (progress line filled up to the confirmation call)
 *   optional one-click upsell card (product on a lit stage, price, countdown tiles, CTA)
 *   WhatsApp help · back to the product · legal links
 *
 * Runtime hooks (src/landing/runtime/thankyou.ts): [data-ty="name|orderId|total|items|options"] are
 * filled from sessionStorage (options: the chosen colors / sizes, drawn like the form's summary); <html data-ty-state="filled|partial|empty"> drives what is shown;
 * [data-ty-upsell] (+ accept/decline/status, [data-countdown]) is the upsell block.
 * Without JS the page still reads correctly (name & order rows stay hidden, upsell stays hidden).
 * Pure markup; every animation is CSS (collapsed by prefers-reduced-motion and data-motion="off").
 */
import type { ReactElement, ReactNode } from "react";
import { legalChrome, legalLang, legalNav } from "../legal";
import { brandName, cx, Icon, pad2, Picture, Price, RichText, SkipLink, type IconName } from "../primitives";
import type { RenderContext } from "../types";
import { bundleLabel, whatsappNumber } from "@/lib/render/config";
import { defaultBundleId, orderTotals } from "@/lib/page/pricing";
import type { PageDoc, SectionBg } from "@/lib/page/schema";
import { getArchetype } from "@/lib/theme";

export interface ThankYouProps {
  doc: PageDoc;
  ctx: RenderContext;
  /** product page URL ("back" link) */
  landingUrl: string;
}

/** Copy specific to this page that the shared microcopy (i18n.ts) does not carry. */
interface TyCopy {
  next: string;
  yourOrder: string;
  options: string;
  hints: [string, string, string, string];
}

const COPY: Record<"ar" | "fr" | "en", TyCopy> = {
  fr: {
    next: "Et maintenant ?",
    yourOrder: "Votre commande",
    options: "Vos choix",
    hints: ["C'est enregistré.", "Nous vous appelons pour confirmer l'adresse.", "Votre colis part avec le livreur.", "Vérifiez, puis payez en espèces."],
  },
  ar: {
    next: "شنو غادي يوقع دابا؟",
    yourOrder: "الطلب ديالك",
    options: "اختياراتك",
    hints: ["الطلب تسجل.", "كنعيطو ليك باش نأكدو العنوان.", "الكولي كيخرج مع شركة التوصيل.", "عاين المنتوج، من بعد خلص كاش."],
  },
  en: {
    next: "What happens next",
    yourOrder: "Your order",
    options: "Your choices",
    hints: ["It's registered.", "We call you to confirm the address.", "Your parcel leaves with the courier.", "Check it, then pay in cash."],
  },
};

const copyFor = (locale: string): TyCopy => COPY[locale as keyof typeof COPY] ?? COPY.en;

const NAME_SLOT = /^(.*?)(\s*)\{name\}([,،]?)([\s\S]*)$/;

/** Split "Merci {name}, c'est noté !" → before / (space + name + comma) / after, so the name group can hide. */
function splitTitle(template: string): { before: string; gap: string; comma: string; after: string } | null {
  const m = NAME_SLOT.exec(template);
  if (!m) return null;
  return { before: m[1] ?? "", gap: m[2] ?? "", comma: m[3] ?? "", after: m[4] ?? "" };
}

/** Hero color block: the archetype's first characteristic color moment. */
function heroBg(doc: PageDoc): SectionBg {
  return getArchetype(doc.theme.archetype).colorMoments.find((b) => b !== "base") ?? "accent";
}

/** Check drawing inside a glowing ring (sizes in the 96 × 96 viewBox; dash lengths = path lengths). */
function SuccessMark(): ReactElement {
  return (
    <div className="lp-ty__mark" aria-hidden="true">
      <span className="lp-ty__mark-glow" />
      <span className="lp-ty__mark-pulse" />
      <span className="lp-ty__mark-pulse lp-ty__mark-pulse--late" />
      <svg className="lp-ty__mark-svg" viewBox="0 0 96 96" focusable="false">
        <circle className="lp-ty__mark-track" cx="48" cy="48" r="45" />
        <circle className="lp-ty__mark-arc" cx="48" cy="48" r="45" transform="rotate(-90 48 48)" />
        <circle className="lp-ty__mark-disc" cx="48" cy="48" r="37" />
        <path className="lp-ty__mark-check" d="M32.5 49.5l10.5 10.5 21-22.5" />
      </svg>
    </div>
  );
}

const STEPS: { key: "thanks.step1" | "thanks.step2" | "thanks.step3" | "thanks.step4"; icon: IconName; state: "done" | "now" | "next" }[] = [
  { key: "thanks.step1", icon: "check", state: "done" },
  { key: "thanks.step2", icon: "phone", state: "now" },
  { key: "thanks.step3", icon: "truck", state: "next" },
  { key: "thanks.step4", icon: "cash-hand", state: "next" },
];

function Timeline({ ctx, copy }: { ctx: RenderContext; copy: TyCopy }): ReactElement {
  return (
    <section className="lp-ty__card lp-ty__next" aria-labelledby="lp-ty-next" data-reveal="rise" data-delay="160">
      <h2 id="lp-ty-next" className="lp-ty__card-title">
        {copy.next}
      </h2>
      <ol className="lp-ty__steps" role="list" data-stagger="90">
        {STEPS.map((s, i) => (
          <li key={s.key} className="lp-ty__step" data-state={s.state} data-reveal="rise" aria-current={s.state === "now" ? "step" : undefined}>
            <span className="lp-ty__step-node" aria-hidden="true">
              <Icon name={s.icon} size={18} strokeWidth={2} />
            </span>
            <span className="lp-ty__step-text">
              <span className="lp-ty__step-label">
                <span className="lp-ty__step-num" aria-hidden="true">
                  {pad2(i + 1)}
                </span>
                {ctx.t(s.key)}
              </span>
              <span className="lp-ty__step-hint">{copy.hints[i]}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Summary({ doc, ctx, copy }: { doc: PageDoc; ctx: RenderContext; copy: TyCopy }): ReactElement {
  const { product, offers } = doc;
  const id = defaultBundleId(offers);
  const bundle = offers.bundles.find((b) => b.id === id) ?? offers.bundles[0]!;
  const totals = orderTotals(product, offers, bundle.id, false);
  const image = ctx.asset(bundle.image ?? product.cutout ?? product.images[0]);
  return (
    <aside className="lp-ty__card lp-ty__summary" aria-labelledby="lp-ty-summary" data-reveal="rise" data-delay="80">
      <p className="lp-ty__card-kicker">{copy.yourOrder}</p>
      <div className="lp-ty__summary-head">
        <div className={cx("lp-ty__summary-media", image?.alpha && "lp-ty__summary-media--cutout")}>
          <Picture asset={image} sizes="6rem" ratio={1} fit={image?.alpha ? "contain" : "cover"} alt="" />
        </div>
        <h2 id="lp-ty-summary" className="lp-ty__summary-title">
          {product.name}
        </h2>
      </div>
      <dl className="lp-ty__rows">
        <div className="lp-ty__row" data-need-order="">
          <dt>{ctx.t("form.choosePack")}</dt>
          <dd data-ty="items">{bundleLabel(ctx, bundle)}</dd>
        </div>
        {product.variants.some((g) => g.options.length > 0) ? (
          // filled by the runtime from the order just placed; hidden while empty (no JS, or no record)
          <div className="lp-ty__row lp-ty__row--opts" data-need-order="">
            <dt>{copy.options}</dt>
            <dd className="lp-vsum" data-ty="options" />
          </div>
        ) : null}
        <div className="lp-ty__row lp-ty__row--total" data-need-order="">
          <dt>{ctx.t("form.total")}</dt>
          <dd data-ty="total">{totals ? ctx.money(totals.total) : ctx.money(bundle.price)}</dd>
        </div>
      </dl>
      <p className="lp-ty__pay">
        <Icon name="cash-hand" size={18} />
        <span>{ctx.t("trust.cod")}</span>
      </p>
    </aside>
  );
}

function UpsellCountdown({ ctx, minutes }: { ctx: RenderContext; minutes: number }): ReactElement {
  const end = new Date(Date.parse(ctx.now) + minutes * 60_000).toISOString();
  const withHours = minutes >= 60;
  const unit = (k: "h" | "m" | "s", v: number, label: string) => (
    <span className="lp-ty__cd-unit">
      <span className="lp-ty__cd-num" data-cd={k}>
        {pad2(v)}
      </span>
      <span className="lp-visually-hidden">{label}</span>
    </span>
  );
  const sep = (
    <span className="lp-ty__cd-sep" aria-hidden="true">
      :
    </span>
  );
  return (
    <p className="lp-ty__cd" data-countdown={end} role="timer" aria-label={ctx.t("thanks.upsellEnds")}>
      <span className="lp-ty__cd-label">
        <Icon name="clock" size={16} />
        {ctx.t("thanks.upsellEnds")}
      </span>
      {/* digits read left to right in every locale */}
      <span className="lp-ty__cd-digits" dir="ltr">
        {withHours ? (
          <>
            {unit("h", Math.floor(minutes / 60), ctx.t("urgency.hours"))}
            {sep}
          </>
        ) : null}
        {unit("m", withHours ? minutes % 60 : minutes, ctx.t("urgency.minutes"))}
        {sep}
        {unit("s", 0, ctx.t("urgency.seconds"))}
      </span>
    </p>
  );
}

function Upsell({ doc, ctx }: { doc: PageDoc; ctx: RenderContext }): ReactElement | null {
  const up = doc.offers.upsell;
  if (!up?.enabled) return null;
  const image = ctx.asset(up.image ?? doc.product.cutout ?? doc.product.images[0]);
  return (
    <section className="lp-ty__upsell" data-ty-upsell="" data-state="idle" data-bg="surface" aria-labelledby="lp-ty-upsell" hidden>
      <div className={cx("lp-ty__upsell-stage", image?.alpha && "lp-ty__upsell-stage--cutout")}>
        <Picture asset={image} sizes="(min-width: 48rem) 20rem, 80vw" ratio={1} fit={image?.alpha ? "contain" : "cover"} alt="" />
      </div>
      <div className="lp-ty__upsell-body">
        <p className="lp-ty__upsell-kicker">
          <Icon name="gift" size={16} />
          <span>{ctx.t("thanks.upsellKicker")}</span>
        </p>
        <h2 id="lp-ty-upsell" className="lp-ty__upsell-title">
          <RichText text={up.title} ctx={ctx} />
        </h2>
        {up.description ? <RichText text={up.description} ctx={ctx} as="p" className="lp-ty__upsell-text" decorate={false} /> : null}
        <Price ctx={ctx} amount={up.price} compareAt={up.compareAt} size="l" showSavings />
        <UpsellCountdown ctx={ctx} minutes={up.windowMinutes} />
        <div className="lp-ty__upsell-actions">
          <button type="button" className="lp-btn lp-btn--primary lp-btn--l" data-ty-upsell-accept="">
            <span className="lp-btn__icon lp-btn__icon--lead" aria-hidden="true">
              <Icon name="plus" size="1.1em" strokeWidth={2} />
            </span>
            <span className="lp-btn__label">{ctx.t("thanks.upsellAdd")}</span>
          </button>
          <button type="button" className="lp-ty__decline" data-ty-upsell-decline="">
            {ctx.t("thanks.upsellNo")}
          </button>
        </div>
        <p className="lp-ty__upsell-status" data-ty-upsell-status="" role="status" aria-live="polite" />
      </div>
    </section>
  );
}

function Help({ ctx, whatsapp, landingUrl, productName }: { ctx: RenderContext; whatsapp: string | null; landingUrl: string; productName: string }): ReactElement {
  return (
    <div className="lp-ty__help" data-reveal="fade">
      {whatsapp ? (
        <a
          className="lp-btn lp-btn--secondary lp-btn--m lp-ty__wa"
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(productName)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="lp-btn__icon lp-btn__icon--lead" aria-hidden="true">
            <Icon name="whatsapp" size="1.2em" strokeWidth={2} />
          </span>
          <span className="lp-btn__label">{ctx.t("trust.support")}</span>
        </a>
      ) : null}
      <a className="lp-ty__back" href={landingUrl}>
        <Icon name="arrow-right" size="1em" className="lp-ty__back-icon" />
        <span>{ctx.t("thanks.back")}</span>
      </a>
    </div>
  );
}

/** Privacy · terms · shipping & returns · contact, in the delivery mode's URLs. */
function LegalLinks({ ctx }: { ctx: RenderContext }): ReactElement {
  return (
    <nav className="lp-ty__legal" aria-label={legalChrome(legalLang(ctx.locale)).documents}>
      <ul className="lp-ty__legal-list" role="list">
        {legalNav(ctx).map((l) => (
          <li key={l.kind}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ThankYouBody({ doc, ctx, landingUrl }: ThankYouProps): ReactElement {
  const whatsapp = whatsappNumber(doc, ctx.store.whatsapp);
  const copy = copyFor(ctx.locale);
  const template = doc.thankYou.title?.trim() || ctx.t("thanks.title");
  const parts = splitTitle(template);
  const message = doc.thankYou.message?.trim() || ctx.t("thanks.message");
  const logo = ctx.store.logo;
  const brand = brandName(ctx);
  const title: ReactNode = parts ? (
    <>
      <RichText text={parts.before} ctx={ctx} />
      <span className="lp-ty__who">
        {parts.gap}
        <span className="lp-ty__name" data-ty="name" />
        {parts.comma}
      </span>
      {/^\s/.test(parts.after) ? " " : null}
      <RichText text={parts.after} ctx={ctx} />
    </>
  ) : (
    <RichText text={template} ctx={ctx} />
  );

  return (
    <>
      <SkipLink ctx={ctx} />
      <header className="lp-ty__bar" data-bg="base">
        <div className="lp-container lp-ty__bar-inner">
          {logo ? (
            <Picture asset={logo} sizes="9rem" fit="contain" alt={brand} className="lp-ty__logo" />
          ) : (
            <span className="lp-ty__brand">{brand}</span>
          )}
          <span className="lp-ty__cod">
            <Icon name="cash-hand" size={16} />
            <span>{ctx.t("trust.cod")}</span>
          </span>
        </div>
      </header>

      <main id="main" className="lp-ty" tabIndex={-1}>
        <section className="lp-section lp-ty__hero" data-bg={heroBg(doc)} data-space="normal" aria-labelledby="lp-ty-title">
          <span className="lp-ty__aurora" aria-hidden="true" />
          <div className="lp-container lp-ty__hero-inner">
            <SuccessMark />
            <p className="lp-ty__order">
              <span>{ctx.t("thanks.orderNo")}</span> <strong className="lp-ty__order-id" data-ty="orderId" />
            </p>
            <h1 id="lp-ty-title" className="lp-ty__title" data-reveal="blur-in" data-delay="120">
              {title}
            </h1>
            <RichText text={message} ctx={ctx} block as="div" className="lp-ty__lead" reveal="fade" delay={260} decorate={false} />
          </div>
        </section>

        <div className="lp-ty__content" data-bg="base">
          <div className={cx("lp-container lp-ty__grid", !doc.thankYou.showTimeline && "lp-ty__grid--single")}>
            <Summary doc={doc} ctx={ctx} copy={copy} />
            {doc.thankYou.showTimeline ? <Timeline ctx={ctx} copy={copy} /> : null}
          </div>
          <div className="lp-container lp-ty__after">
            <Upsell doc={doc} ctx={ctx} />
            <Help ctx={ctx} whatsapp={whatsapp} landingUrl={landingUrl} productName={doc.product.name} />
            <LegalLinks ctx={ctx} />
          </div>
        </div>
      </main>
    </>
  );
}
