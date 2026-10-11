/**
 * hero/split — the premium product page: a rounded swipeable gallery (a thumbnail rail and a sticky
 * position on desktop, dots under the photo on phones, glass arrows, the genuine saving pinned in
 * the photo's quietest corner) beside a buy panel — meta, title, price, lead, checked notes, pill
 * pack chips that preselect the pack in the order form (selection mirrored by the runtime), the main
 * action and a trust list on a soft card.
 *
 * The gallery takes the lead photo's shape: 4:5 for people and tall products (a garment is shown
 * whole), square for the rest on phones, landscape (up to 13:10) for a product lying on its side —
 * every slide and thumbnail fitted subject-first to that exact frame.
 */
import type { ReactElement } from "react";
import { bundleMath, defaultBundleId } from "@/lib/page/pricing";
import { cssVars, cx, Icon, Money, Picture, pictureCrop, quietCorner, reveal, RichText, savingsOf, SectionShell } from "../../primitives";
import type { Bundle, RenderContext, ResolvedAsset } from "../../types";
import { micro } from "./copy";
import { visualFacts } from "./framing";
import { HeroCta, HeroLead, HeroMeta, HeroPrice, HeroTitle, HeroTrust, heroNotes, heroPhotos, NoteText, titleId, type HeroProps } from "./parts";

function badgeOf(ctx: RenderContext, b: Bundle): string {
  if (b.badge === "custom") return b.badgeText?.trim() ?? "";
  if (b.badge === "popular") return ctx.t("bundle.popular");
  if (b.badge === "best") return ctx.t("bundle.best");
  return "";
}

function Packs({ ctx, id }: { ctx: RenderContext; id: string }): ReactElement | null {
  const bundles = ctx.offers.bundles;
  if (bundles.length < 2) return null;
  const selected = defaultBundleId(ctx.offers);
  const labelId = `${id}-packs`;
  return (
    <div className="lp-hero__packs-pick" role="group" aria-labelledby={labelId} {...reveal("rise", 160)}>
      <p className="lp-hero__pick-label" id={labelId}>
        {micro(ctx.locale, "choose")}
      </p>
      <div className="lp-hero__opts" data-n={Math.min(bundles.length, 4)}>
        {bundles.map((b) => {
          const m = bundleMath(b, ctx.product.price);
          const badge = badgeOf(ctx, b);
          return (
            <a
              key={b.id}
              href="#order"
              className={cx("lp-hero__opt", badge && "lp-hero__opt--badged")}
              data-action="order"
              data-bundle={b.id}
              data-bundle-card={b.id}
              data-selected={b.id === selected ? "" : undefined}
            >
              {badge ? <RichText as="span" className="lp-hero__opt-badge" text={badge} ctx={ctx} decorate={false} /> : null}
              <bdi className="lp-hero__opt-q" dir="ltr">
                ×{b.qty}
              </bdi>
              <span className="lp-hero__opt-total">
                <Money ctx={ctx} amount={m.total} />
              </span>
              {m.showReference && m.savingsPct > 0 ? (
                <span className="lp-hero__opt-save">
                  <bdi dir="ltr">{ctx.t("bundle.savePct", { pct: m.savingsPct })}</bdi>
                </span>
              ) : (
                <span className="lp-hero__opt-unit">{micro(ctx.locale, "unit")}</span>
              )}
              <span className="lp-hero__opt-check" aria-hidden="true">
                <Icon name="check" size="0.8rem" strokeWidth={2.6} />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

/** Gallery frame aspects [phones, desktop] from the lead photo. */
function galleryRatios(lead: ResolvedAsset | null): [number, number] {
  const f = visualFacts(lead);
  if (f.kind !== "photo") return [1, 0.8];
  if (f.person) return [0.8, 0.8];
  const wide = Math.round(Math.min(1.3, f.need) * 100) / 100;
  const phone = f.need <= 0.8 ? 0.8 : f.need <= 1.1 ? 1 : wide;
  const desk = f.need <= 0.95 ? 0.8 : f.need <= 1.1 ? 1 : wide;
  return [phone, desk];
}

export function SplitHero({ id, variant, bg, data, ctx }: HeroProps): ReactElement {
  const photos = heroPhotos(ctx, data, 5);
  const slides = photos.length ? photos : [null];
  const many = photos.length > 1;
  const bullets = heroNotes(data, 3);
  const saving = savingsOf(ctx.product.price, ctx.product.compareAt);
  const pct = saving && ctx.offers.showSavings !== "none" ? ctx.t("bundle.savePct", { pct: saving.pct }) : null;
  const lead = slides[0] ?? null;
  const [phoneR, deskR] = galleryRatios(lead);
  // the saving sits in the corner of the lead photo that covers no face, hand or product top (read on
  // the un-zoomed view: the position Picture writes is what every engine shows)
  const crop = lead && !lead.alpha ? pictureCrop(lead, { frame: { shape: "rounded", ratio: phoneR } }) : null;
  const corner =
    pct && lead && !lead.alpha
      ? quietCorner(lead, phoneR, {
          crop: crop ? { ...crop, zoom: 1 } : crop,
          chip: { w: 0.3, h: 0.12 },
          dir: ctx.dir,
          prefer: { block: "start", inline: "start" },
        })
      : { block: "start" as const, inline: "start" as const };

  return (
    <SectionShell id={id} ctx={ctx} type="hero" variant={variant} bg={bg} labelledBy={titleId(id)}>
      <div className="lp-container lp-hero__grid">
        <div
          className="lp-hero__gallery"
          data-gallery=""
          data-many={many ? "" : undefined}
          role="region"
          aria-label={micro(ctx.locale, "gallery")}
          style={cssVars({ "--g-r": phoneR, "--g-lg": deskR })}
        >
          <div className="lp-hero__frame">
            <div className="lp-hero__track" data-gallery-track="">
              {slides.map((a, i) => (
                <div key={a?.id ?? i} className="lp-hero__slide" data-slide="" data-active={i === 0 ? "" : undefined}>
                  <Picture
                    asset={a}
                    sizes="(min-width: 64rem) 36rem, 92vw"
                    priority={i === 0}
                    fit={a?.alpha ? "contain" : "cover"}
                    ratio={String(phoneR)}
                    frame={{ shape: "rounded", ratio: phoneR }}
                    frameLg={deskR === phoneR ? undefined : { shape: "rounded", ratio: deskR }}
                    className={cx("lp-hero__pic", a?.alpha && "lp-hero__pic--cutout")}
                    alt={i === 0 ? a?.alt || ctx.product.name : (a?.alt ?? "")}
                  />
                </div>
              ))}
            </div>
            {pct ? (
              <span className="lp-hero__flag" data-block={corner.block} data-inline={corner.inline} {...reveal("stamp", 300)}>
                <bdi dir="ltr">{pct}</bdi>
              </span>
            ) : null}
            {many ? (
              <>
                <button type="button" className="lp-hero__nav lp-glass" data-gallery-prev="" aria-label={ctx.t("gallery.prev")} disabled>
                  <Icon name="chevron-left" size="1.15rem" />
                </button>
                <button type="button" className="lp-hero__nav lp-hero__nav--next lp-glass" data-gallery-next="" aria-label={ctx.t("gallery.next")}>
                  <Icon name="chevron-right" size="1.15rem" />
                </button>
              </>
            ) : null}
          </div>
          {many ? (
            <div className="lp-hero__dots">
              {photos.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  className="lp-hero__dot"
                  data-dot={i}
                  data-active={i === 0 ? "" : undefined}
                  aria-current={i === 0 ? "true" : undefined}
                  aria-label={micro(ctx.locale, "thumb", { n: i + 1 })}
                />
              ))}
            </div>
          ) : null}
          {many ? (
            <div className="lp-hero__thumbs">
              {photos.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  className="lp-hero__thumb"
                  data-thumb={i}
                  data-active={i === 0 ? "" : undefined}
                  aria-current={i === 0 ? "true" : undefined}
                  aria-label={micro(ctx.locale, "thumb", { n: i + 1 })}
                >
                  <Picture asset={a} sizes="5rem" fit={a.alpha ? "contain" : "cover"} ratio="1" frame={{ shape: "rounded", ratio: 1 }} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="lp-hero__panel">
          <HeroMeta ctx={ctx} data={data} />
          <HeroTitle ctx={ctx} data={data} id={id} />
          <div className="lp-hero__deal" {...reveal("fade", 80)}>
            <HeroPrice ctx={ctx} />
          </div>
          <HeroLead ctx={ctx} data={data} delay={120} />
          {bullets.length ? (
            <ul className="lp-hero__bullets" role="list" data-stagger="90">
              {bullets.map(({ note, i }) => (
                <li key={i} className="lp-hero__bullet" {...reveal("rise")}>
                  <span className="lp-hero__tick" aria-hidden="true">
                    <Icon name="check" size="0.8rem" strokeWidth={2.6} />
                  </span>
                  <span>
                    <NoteText ctx={ctx} text={note.title} className="lp-hero__bullet-t" editPath={`notes.${i}.title`} />
                    {note.detail.trim() ? <NoteText ctx={ctx} text={note.detail} className="lp-hero__bullet-d" editPath={`notes.${i}.detail`} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {data.showBundles ? <Packs ctx={ctx} id={id} /> : null}
          <div className="lp-hero__buy" {...reveal("rise", 240)}>
            <HeroCta ctx={ctx} data={data} />
            <HeroTrust ctx={ctx} data={data} id={id} layout="stack" />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
