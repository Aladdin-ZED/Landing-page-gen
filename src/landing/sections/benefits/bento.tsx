/**
 * bento — a curated, asymmetric composition (never a uniform grid): photo tiles (copy above, the
 * photo inset below with nested corners and the key figure in a frosted chip — the subject is never
 * covered: it rides the photo's top corner, products stand on the floor of their shot), a color tile
 * whose figure rolls up in its own product light, a statement tile set in display type, and calm
 * icon tiles. Tiles lift on a spring; photos breathe on hover.
 */
import { GlowOrb } from "@/landing/illustrations";
import { Container, Icon, Picture, cssVars, pictureCrop, quietCorner, reveal, round, safeHex, type Corner } from "@/landing/primitives";
import type { Crop } from "@/lib/media/focus";
import { luminance } from "@/lib/theme/color";
import type { SectionBg } from "@/lib/page/schema";
import type { RenderContext, ResolvedAsset } from "../../types";
import { aspectOf, bgFamily, fitProps, idx, nestedBg, rangePosition, type FitProps } from "./kit";
import type { BenefitItem, ViewProps } from "./model";
import { Action, Fact, FigLabel, Figure, Head, Text, Title, photoPicker } from "./parts";

type TileKind = "media" | "figure" | "statement" | "icon";

/** Desktop placement on a 12-column grid: [column span, row span] per item count. */
const LAYOUT: Record<number, readonly (readonly [number, number])[]> = {
  2: [[7, 2], [5, 2]],
  3: [[7, 2], [5, 1], [5, 1]],
  4: [[7, 2], [5, 1], [5, 1], [12, 1]],
  5: [[7, 2], [5, 1], [5, 1], [5, 1], [7, 1]],
  6: [[7, 2], [5, 1], [5, 1], [4, 1], [4, 1], [4, 1]],
};

/**
 * Which item plays which part: photo lead (else a statement lead), one figure tile, one statement
 * on the wide/odd slot, icons for the rest. Items with their own photo always become photo tiles.
 */
function casting(items: readonly BenefitItem[], photos: readonly (ResolvedAsset | null)[]): TileKind[] {
  const n = items.length;
  const kinds: TileKind[] = photos.map((p) => (p ? "media" : "icon"));
  const fig = items.findIndex((it, i) => i > 0 && kinds[i] === "icon" && !!it.stat.trim());
  if (fig > 0) kinds[fig] = "figure";
  if (kinds[0] !== "media") {
    kinds[0] = "statement";
    return kinds;
  }
  const wanted = n >= 4 ? 3 : n === 3 ? 2 : 1;
  const st = [wanted, ...items.map((_, i) => i)].find((i) => i > 0 && i < n && kinds[i] === "icon");
  if (st !== undefined) kinds[st] = "statement";
  return kinds;
}

/* Desktop tile geometry (64rem+), in px at the 72.5rem container: 12 columns, 1.25rem gaps, rows of
   at least 14.5rem; a photo tile's media sits inside a ~0.6rem inset. */
const COL_W = (1160 - 11 * 20) / 12;
const spanW = (span: number) => span * COL_W + (span - 1) * 20;
const INSET = 10;
const ROW_H = 232;

interface MediaPlan {
  /** desktop composition of the photo tile */
  shape: "wide" | "tall" | "stack";
  /** phones / tablets: the photo's exact aspect */
  base: number;
  /** crop props (phones exact; desktop fitted to the range its box can take) */
  fit: FitProps;
  /** the desktop frame's typical aspect */
  lg: number;
}

/**
 * How a photo tile lays out and crops. Phones and tablets: copy above the photo at an exact aspect
 * chosen from the shot (portrait 4:5 — a standing figure keeps head and hands, a bottle its cap —,
 * squarish 1:1, landscape 4:3). Desktop: a one-row tile sets copy and photo side by side; a two-row
 * tile does too when the shot is upright (a tall portrait column, never a wide strip across a
 * standing figure), else stacks the copy over a 16:10 photo.
 */
function mediaPlan(photo: ResolvedAsset, span: number, rows: number): MediaPlan {
  const A = aspectOf(photo);
  const base = A < 0.9 ? 0.8 : A <= 1.2 ? 1 : 4 / 3;
  const inner = spanW(span) - 2 * INSET;
  // side by side, the photo runs the tile's height, which its row neighbours decide (a statement
  // set large makes the row taller): one position that holds over every height the row can take
  const range = (w: number, h: number): FitProps => {
    const lo = Math.min(base, w / (h * 1.45));
    const hi = Math.max(base, w / h);
    const position = rangePosition(photo, "rounded", lo, hi, [base]);
    return position ? { position } : fitProps(photo, "rounded", base);
  };
  if (rows === 1) {
    const [w, h] = [inner * 0.52, ROW_H - 2 * INSET];
    return { shape: "wide", base, fit: range(w, h), lg: w / (h * 1.15) };
  }
  if (A < 0.9) {
    const [w, h] = [inner * 0.56, rows * ROW_H + (rows - 1) * 20 - 2 * INSET];
    return { shape: "tall", base, fit: range(w, h), lg: w / (h * 1.1) };
  }
  return { shape: "stack", base, fit: fitProps(photo, "rounded", base, [1.6, 1.6]), lg: 1.6 };
}

/** The crop a fitted Picture shows in a frame of aspect `ratio` (`lg`: its desktop frame). */
function cropIn(photo: ResolvedAsset, fit: FitProps, ratio: number, lg: boolean): Crop | null {
  const m = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(fit.position ?? "");
  if (m) return { x: Number(m[1]) / 100, y: Number(m[2]) / 100, zoom: 1 };
  const frame = lg ? (fit.frameLg ?? fit.frame) : fit.frame;
  return frame ? pictureCrop(photo, { frame: typeof frame === "string" ? frame : { ...frame, ratio, maxZoom: 1 } }) : null;
}

/**
 * Corners of the photo the key-figure chip takes on phones and on desktop ("ss" … "ee": block,
 * inline): the one where it covers no face, hand or cap in each frame.
 */
function chipCorners(ctx: RenderContext, photo: ResolvedAsset, plan: MediaPlan): [string, string] {
  const at = (ratio: number, lg: boolean, chip: { w: number; h: number }) => {
    const c: Corner = quietCorner(photo, ratio, { crop: cropIn(photo, plan.fit, ratio, lg), chip, dir: ctx.dir, prefer: { block: "start", inline: "start" } });
    return `${c.block[0]}${c.inline[0]}`;
  };
  // the chip is ~12rem × 5rem: half a phone frame's width, a smaller share of a wide desktop one
  return [at(plan.base, false, { w: 0.5, h: 0.24 }), at(plan.lg, true, { w: Math.min(0.5, 0.5 / plan.lg), h: 0.24 })];
}

/** How a color block reads: an accent or pop this deep reads as the ink block itself. */
function tone(ctx: RenderContext, b: SectionBg): string {
  if (b !== "accent" && b !== "pop") return bgFamily(ctx, b);
  const hex = safeHex(ctx.doc.theme.palette[b]);
  return hex && luminance(hex) < 0.07 ? "dark" : b;
}

/**
 * Color blocks of the two feature tiles, never the same block twice. The figure tile takes the ink
 * block — on a dark section it stays on the card, its number glowing in the accent inside its own
 * product light. The statement takes the accent block, or the pop when the accent would read as
 * the figure tile's block (a near-black accent beside the ink tile, an accent next to the card).
 */
function tileBgs(ctx: RenderContext, bg: SectionBg): Record<"figure" | "statement", SectionBg | undefined> {
  const own = bgFamily(ctx, bg);
  const figure: SectionBg | undefined = own === "dark" ? undefined : "dark";
  const beside = figure ? tone(ctx, figure) : own;
  const statement =
    (["accent", "pop", "dark"] as const).find((b) => bgFamily(ctx, b) !== own && tone(ctx, b) !== own && tone(ctx, b) !== beside) ??
    nestedBg(ctx, bg, ["accent", "pop", "dark"]);
  return { figure, statement };
}

export function Bento({ ctx, data, titleId, bg }: ViewProps) {
  const n = data.items.length;
  const pick = photoPicker(ctx, data.items);
  // the lead takes the first product photo; with five tiles the closing wide tile takes the next one
  const photos = data.items.map((it, i) => pick(it, i === 0 || (n === 5 && i === 4)));
  const layout = LAYOUT[n] ?? LAYOUT[5]!;
  const kinds = casting(data.items, photos);
  const blocks = tileBgs(ctx, bg);
  // tablet (2 columns): the lead spans both, and so does the last tile when it would sit alone
  const tabletWide = (i: number) => i === 0 || (i === n - 1 && (n - 1) % 2 === 1);
  return (
    <Container className="lp-cq">
      <Head ctx={ctx} data={data} titleId={titleId} />
      <ul className="lp-benefits__bento" role="list" data-count={n}>
        {data.items.map((it, i) => {
          const [span, rows] = layout[i] ?? [6, 1];
          const kind = kinds[i]!;
          const style = cssVars({ "--span": span, "--rows": rows, "--t": tabletWide(i) ? 2 : 1 });
          const delay = 80 + i * 90;
          const photo = photos[i];
          if (kind === "media" && photo) {
            const plan = mediaPlan(photo, span, rows);
            return (
              <li
                key={i}
                className="lp-benefits__tile"
                data-kind="media"
                data-lead={i === 0 ? "" : undefined}
                data-shape={plan.shape}
                style={cssVars({ "--span": span, "--rows": rows, "--t": tabletWide(i) ? 2 : 1, "--mr": round(plan.base, 4) })}
                {...reveal("rise", delay)}
              >
                <div className="lp-benefits__foot">
                  <span className="lp-benefits__idx" aria-hidden="true">
                    {idx(i)}
                  </span>
                  <Title ctx={ctx} item={it} i={i} />
                  <Text ctx={ctx} item={it} i={i} />
                </div>
                <div className="lp-benefits__tilemedia" {...reveal("scale-in", delay + 120)}>
                  <Picture
                    asset={photo}
                    sizes={plan.shape === "stack" ? "(min-width: 64rem) 40rem, (min-width: 36rem) 88vw, 92vw" : "(min-width: 64rem) 22rem, (min-width: 36rem) 88vw, 92vw"}
                    className="lp-benefits__tilepic"
                    alt=""
                    fit={photo.alpha ? "contain" : "cover"}
                    {...plan.fit}
                  />
                  <Fact
                    ctx={ctx}
                    item={it}
                    i={i}
                    className="lp-benefits__tchip lp-glass"
                    enter="blur-in"
                    delay={delay + 380}
                    corner={photo.alpha ? undefined : chipCorners(ctx, photo, plan)}
                  />
                </div>
              </li>
            );
          }
          if (kind === "figure") {
            return (
              <li key={i} className="lp-benefits__tile" data-kind="figure" data-bg={blocks.figure} style={style} {...reveal("rise", delay)}>
                <GlowOrb place="top-end" size="85%" intensity="medium" className="lp-benefits__glow" />
                <p className="lp-benefits__big">
                  <Figure ctx={ctx} value={it.stat} i={i} className="lp-benefits__bigfig" delay={delay + 160} />
                  <FigLabel ctx={ctx} item={it} i={i} className="lp-benefits__biglabel" />
                </p>
                <div className="lp-benefits__foot">
                  <Title ctx={ctx} item={it} i={i} />
                  <Text ctx={ctx} item={it} i={i} />
                </div>
              </li>
            );
          }
          return (
            <li
              key={i}
              className="lp-benefits__tile"
              data-kind={kind}
              data-lead={i === 0 ? "" : undefined}
              data-wide={span === 12 ? "" : undefined}
              data-bg={kind === "statement" ? blocks.statement : undefined}
              style={style}
              {...reveal(kind === "statement" ? "wipe-up" : "rise", delay)}
            >
              <div className="lp-benefits__tilehead">
                <span className="lp-benefits__ico" aria-hidden="true">
                  <Icon name={it.icon} size="100%" strokeWidth={1.6} />
                </span>
                <span className="lp-benefits__idx" aria-hidden="true">
                  {idx(i)}
                </span>
              </div>
              <div className="lp-benefits__foot">
                <Title ctx={ctx} item={it} i={i} />
                <Text ctx={ctx} item={it} i={i} />
              </div>
            </li>
          );
        })}
      </ul>
      <Action ctx={ctx} data={data} />
    </Container>
  );
}
