/**
 * slider — one photo frame, the before laid over the after and clipped at a divider the shopper
 * drags (runtime: [data-compare] + input[type=range][data-compare-range] → --pos). A hairline of
 * light with a frosted glass knob marks the cut; glass tags ride on each photo and slide away
 * under the divider. Choreography on reveal: the frame scales in, the line of light grows out of
 * the knob, the knob introduces itself as a "‹ Glissez ›" pill and glides once across the photo,
 * then folds into its round grip. Portrait frames take the page's arch mask (souk, maison).
 * Beside it: the two moments as a precise legend, the result points and the honesty note.
 */
import { GlowOrb } from "@/landing/illustrations";
import {
  Container,
  Icon,
  RichText,
  clamp,
  cssVars,
  editAttr,
  frameRegions,
  pictureCrop,
  reveal,
} from "@/landing/primitives";
import { Cards } from "./cards";
import { frameOf, resolveShots, ui, type BaFrame, type Shot, type ViewProps } from "./model";
import { Credit, Foot, Head, Media, Results, Tag } from "./parts";
import type { RenderContext, ResolvedAsset } from "../../types";

const SIZES =
  "(min-width: 76rem) 40rem, (min-width: 48rem) 54vw, (min-width: 36rem) 34rem, 94vw";

/** Before → after as a two-step legend joined by a fine line (the after key lit in the accent). */
function Legend({
  ctx,
  shots,
}: {
  ctx: RenderContext;
  shots: readonly Shot[];
}) {
  return (
    <dl className="lp-beforeAfter__legend" data-stagger="120">
      {shots.map((s) => (
        <div
          key={s.side}
          className="lp-beforeAfter__row"
          data-side={s.side}
          {...reveal("rise")}
        >
          <dt className="lp-beforeAfter__rowhead">
            <span className="lp-beforeAfter__key" aria-hidden="true" />
            <span
              className="lp-beforeAfter__rowl"
              {...editAttr(ctx, `${s.path}.label`)}
            >
              {s.label}
            </span>
            {s.when ? (
              <RichText
                as="span"
                className="lp-beforeAfter__roww"
                text={s.when}
                ctx={ctx}
                decorate={false}
                editPath={`${s.path}.when`}
              />
            ) : null}
          </dt>
          {s.caption ? (
            <RichText
              as="dd"
              className="lp-beforeAfter__rowcap"
              text={s.caption}
              ctx={ctx}
              decorate={false}
              editPath={`${s.path}.caption`}
            />
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/**
 * Where the cut rests: the merchant's value — or, left at the default 50%, through the middle of the
 * photo's subject (its face, the product), so both moments show it (35–65%, from the start side).
 */
function startOf(ctx: RenderContext, value: number, asset: ResolvedAsset, frame: BaFrame): number {
  const v = clamp(Math.round(value), 10, 90);
  if (v !== 50 || asset.alpha || !asset.subjectKind || asset.subjectKind === "none" || asset.subjectKind === "scene") return v;
  const r = frameRegions(asset, frame.ratio, pictureCrop(asset, { frame }));
  const focus = r.heads[0] ?? r.subject;
  const cx = focus.x + focus.w / 2;
  const fromStart = ctx.dir === "rtl" ? 1 - cx : cx;
  return clamp(Math.round(fromStart * 100), 35, 65);
}

export function Slider(props: ViewProps) {
  const { ctx, data, titleId } = props;
  const shots = resolveShots(ctx, data);
  const frame = frameOf(ctx, shots, true);
  const { before, after } = shots;
  // nothing to compare without a single photo: the two moments as cards instead
  if (!after.asset) return <Cards {...props} />;
  const start = startOf(ctx, data.start, after.asset, frame);
  const u = ui(ctx);
  // the knob only spells its word when the pill has room on both sides of the cut
  const intro = start >= 30 && start <= 70;
  return (
    <Container className="lp-beforeAfter__grid">
      <Head ctx={ctx} data={data} titleId={titleId} />
      <figure className="lp-beforeAfter__stage">
        <div className="lp-beforeAfter__lit">
          {ctx.ornament > 0.3 ? (
            <GlowOrb
              size="96%"
              shape={shots.ratio === "4/3" ? "wide" : "tall"}
              intensity="subtle"
              place="center"
              className="lp-beforeAfter__glow"
            />
          ) : null}
          {/* the frame carries the reveal and (arch mask) the drop shadow the mask would clip */}
          <div
            className="lp-beforeAfter__frame"
            data-shape={shots.ratio === "4/5" ? "tall" : "wide"}
            {...reveal("scale-in", 120)}
          >
            <div
              className="lp-beforeAfter__cmp"
              data-compare=""
              style={cssVars({
                "--pos": `${start}%`,
                "--ratio": shots.ratio.replace("/", " / "),
              })}
            >
              {/* full-frame range: drag anywhere (tap to jump on Android), arrow keys when focused */}
              <input
                className="lp-beforeAfter__range"
                type="range"
                min={0}
                max={100}
                step={1}
                defaultValue={start}
                aria-label={u.range}
                data-compare-range=""
              />
              <Media
                ctx={ctx}
                shot={after}
                sizes={SIZES}
                frame={frame}
                className="lp-beforeAfter__pane"
              >
                <Tag ctx={ctx} shot={after} tight />
              </Media>
              <Media
                ctx={ctx}
                shot={before}
                sizes={SIZES}
                frame={frame}
                className="lp-beforeAfter__pane lp-beforeAfter__pane--before"
              >
                <Tag ctx={ctx} shot={before} tight />
              </Media>
              {/* handle: its inline-start edge is the cut; the grip is a zero-width anchor there
                  that centers the knob on the line whatever its width */}
              <span className="lp-beforeAfter__handle" aria-hidden="true">
                <span className="lp-beforeAfter__grip">
                  <span className="lp-beforeAfter__knob">
                    <Icon name="chevron-left" size="1.375rem" strokeWidth={2.2} />
                    {intro ? (
                      <span className="lp-beforeAfter__knobl">{u.knob}</span>
                    ) : null}
                    <Icon name="chevron-right" size="1.375rem" strokeWidth={2.2} />
                  </span>
                </span>
              </span>
            </div>
          </div>
        </div>
        {data.who.trim() ? (
          <figcaption className="lp-beforeAfter__fcap" {...reveal("fade", 360)}>
            <Credit ctx={ctx} data={data} />
          </figcaption>
        ) : null}
      </figure>
      <div className="lp-beforeAfter__body">
        <Legend ctx={ctx} shots={[before, after]} />
        <Results ctx={ctx} data={data} />
        <Foot ctx={ctx} data={data} />
      </div>
    </Container>
  );
}
