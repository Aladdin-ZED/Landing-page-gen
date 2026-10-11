/**
 * timeline — the change as a crescendo: before → in-between stages → after. ≥ 48rem: the photos
 * stand on one progress line like rising bars (each column wider, each frame taller, the result
 * the largest and lit), the times and captions read in one aligned row under the line. Phones: the
 * line runs down the inline-start edge, the early moments are compact rows (thumbnail + words) and
 * the result closes on a full-width frame. Choreography: the line draws node to node, each frame
 * wipes up out of the line as it is reached, the result's node glows.
 */
import {
  Container,
  RichText,
  cssVars,
  editAttr,
  reveal,
  round,
} from "@/landing/primitives";
import { frameOf, resolveShots, type ViewProps } from "./model";
import { Caption, Credit, Foot, Head, Media, Results } from "./parts";

/** How much wider the result column is than the first one (desktop). */
const GROWTH = 0.38;
/** Delay between two moments of the choreography (ms). */
const BEAT = 220;

export function Timeline({ ctx, data, titleId }: ViewProps) {
  const shots = resolveShots(ctx, data);
  const frame = frameOf(ctx, shots, false);
  const n = shots.all.length;
  // column weights 1 → 1 + GROWTH; every frame box is as tall as the result's frame, so the photos
  // (full column width, shared ratio) stand bottom-aligned on the line
  const weight = (i: number) => 1 + GROWTH * (n > 1 ? i / (n - 1) : 1);
  const heightPerWidth = shots.ratio === "4/3" ? 3 / 4 : 5 / 4;
  const cols = shots.all
    .map((_, i) => `minmax(0, ${round(weight(i), 3)}fr)`)
    .join(" ");
  const base = !!data.who.trim() || data.results.some((r) => r.text.trim());
  return (
    <Container className="lp-beforeAfter__wrap">
      <Head ctx={ctx} data={data} titleId={titleId} align="split" />
      <ol
        className="lp-beforeAfter__track"
        role="list"
        data-count={n}
        style={cssVars({
          "--ratio": shots.ratio.replace("/", " / "),
          "--cols": cols,
        })}
      >
        {shots.all.map((s, i) => {
          const last = i === n - 1;
          // progress along the line, 0 → 1 (drives the line color)
          const t = n > 1 ? round(i / (n - 1), 3) : 1;
          const t2 = n > 1 ? round(Math.min(i + 1, n - 1) / (n - 1), 3) : 1;
          const box = round(weight(i) / weight(n - 1) / heightPerWidth, 4);
          const head = s.when || s.label;
          return (
            <li
              key={s.path}
              className="lp-beforeAfter__step"
              data-side={s.side}
              data-photo={s.asset ? undefined : "none"}
              style={cssVars({ "--t": t, "--t2": t2, "--box": box })}
            >
              <div
                className="lp-beforeAfter__shot"
                {...reveal("wipe-up", 260 + i * BEAT)}
              >
                <Media
                  ctx={ctx}
                  shot={s}
                  frame={frame}
                  sizes={
                    last
                      ? "(min-width: 48rem) 34vw, 90vw"
                      : "(min-width: 48rem) 26vw, 36vw"
                  }
                />
              </div>
              <span className="lp-beforeAfter__node" aria-hidden="true">
                <span
                  className="lp-beforeAfter__dot"
                  {...reveal("stamp", 120 + i * BEAT)}
                />
                {!last ? (
                  <span
                    className="lp-beforeAfter__seg"
                    {...reveal("fade", 200 + i * BEAT)}
                  />
                ) : null}
              </span>
              <div
                className="lp-beforeAfter__txt"
                {...reveal("fade", 180 + i * BEAT)}
              >
                <p className="lp-beforeAfter__when">
                  <RichText
                    as="span"
                    text={head}
                    ctx={ctx}
                    decorate={false}
                    editPath={`${s.path}.${s.when ? "when" : "label"}`}
                  />
                  {s.side !== "stage" && s.when && s.label ? (
                    <span
                      className="lp-beforeAfter__pill"
                      data-side={s.side}
                      {...editAttr(ctx, `${s.path}.label`)}
                    >
                      {s.label}
                    </span>
                  ) : null}
                </p>
                {s.asset ? <Caption ctx={ctx} shot={s} /> : null}
              </div>
            </li>
          );
        })}
      </ol>
      {base ? (
        <div className="lp-beforeAfter__base">
          <Credit ctx={ctx} data={data} />
          <Results ctx={ctx} data={data} />
        </div>
      ) : null}
      <Foot ctx={ctx} data={data} />
    </Container>
  );
}
