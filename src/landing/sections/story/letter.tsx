/**
 * letter → founder note. An editorial spread in three layers: the kicker and a big title, a large
 * product photo under them, and the note itself on a luminous raised card that overlaps the photo's
 * edge (desktop: one column over its side; phones: the card rises over the photo's foot, the avatar
 * sitting on the seam like a profile over its cover). The avatar breaks out of the card's top edge
 * inside a precise accent ring that draws on; a solid quote mark hangs in the end corner; the first
 * paragraph reads as a lede; the signature is written in while one clean pen stroke draws under it.
 */
import type { ReactElement } from "react";
import { GlowOrb } from "@/landing/illustrations";
import { Container, Picture, RichText, SectionHeader, cssVars, cx, editAttr, plainText, reveal } from "@/landing/primitives";
import { bgFamily, density } from "../benefits/kit";
import type { ViewProps } from "./model";
import { Avatar, Backdrop, Facts, Postscript, QuoteMark, Signature, StoryCta, frameRatio, pickMedia, ratioNum, storyFrame } from "./parts";

export function Letter({ ctx, data, id, bg, titleId }: ViewProps): ReactElement {
  const deco = density(ctx);
  const media = pickMedia(ctx, data);
  const cutout = !!media?.alpha;
  const ratio = frameRatio(media);
  // phones: a 4:3 band under the title (the note rises over its foot); side by side: the photo's own
  // portrait or landscape frame
  const fr = storyFrame(ctx, media, 4 / 3, ratioNum(ratio));
  // the first paragraph reads as a lede in display type, unless the merchant typed one long block
  const lede = data.text.trim().split(/\n\s*\n/)[0] ?? "";
  return (
    <>
      <Backdrop ctx={ctx} id={id} />
      <Container
        className={cx(
          "lp-story__letter",
          !media && "lp-story__letter--solo",
          ratio === "4/3" && "lp-story__letter--wide",
        )}
      >
        <div className={cx("lp-story__lhead", plainText(data.title).length > 70 && "lp-story__lhead--long")}>
          <SectionHeader ctx={ctx} kicker={data.kicker} title={data.title} titleId={titleId} editBase="" size="m" />
        </div>

        {media ? (
          <div className="lp-story__lmedia" data-parallax={fr.still && !cutout ? "0.03" : undefined}>
            {deco > 0 ? <GlowOrb className="lp-story__glow" size="120%" place="center" intensity="soft" /> : null}
            <div
              className={cx("lp-story__lpic", fr.cls, cutout && "lp-story__frame--cutout", fr.still && "lp-story__frame--still")}
              style={cssVars({ "--ratio": ratio.replace("/", " / "), "--settle-org": fr.org })}
              {...reveal(fr.reveal, 120)}
              {...editAttr(ctx, "image")}
            >
              <div className="lp-story__par" data-parallax={fr.still ? undefined : "0.04"}>
                <Picture
                  asset={media}
                  sizes="(min-width: 60rem) 44vw, (min-width: 40rem) 40rem, 92vw"
                  fit={cutout ? "contain" : "cover"}
                  {...fr.fit}
                  className="lp-story__pic"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="lp-story__lbody">
          <div className="lp-story__note lp-card" data-fam={bgFamily(ctx, bg)} data-lede={lede.length > 240 ? "long" : undefined} {...reveal("rise", 160)}>
            <div className="lp-story__notehead">
              <Avatar ctx={ctx} data={data} size="l" ring delay={260} />
              <QuoteMark delay={360} />
            </div>
            <figure className="lp-story__fig">
              <blockquote className="lp-story__quote">
                <RichText block className="lp-story__body" text={data.text} ctx={ctx} editPath="text" reveal="fade" delay={240} />
                <Postscript ctx={ctx} data={data} delay={340} />
              </blockquote>
              <figcaption className="lp-story__caption">
                <Signature ctx={ctx} data={data} look="note" delay={420} />
              </figcaption>
            </figure>
            <Facts ctx={ctx} data={data} delay={480} />
            <StoryCta ctx={ctx} data={data} delay={560} />
          </div>
        </div>
      </Container>
    </>
  );
}
