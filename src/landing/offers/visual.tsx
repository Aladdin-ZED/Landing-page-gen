/**
 * Offer visual composition (docs/OFFERS.md §E.6) — the picture of an offer in the order form
 * picker, the split panel and the offer section. Pure markup; styled by src/landing/offers/visual.css
 * (imported by the order form and the offer section stylesheets).
 *
 *   copies   one item ×n: photos stacked in depth, cutouts standing side by side (max 3 + "+n");
 *            a locked option shows that option's photo
 *   choice   one "choose one" line: 2 choices = the first in front, the second peeking behind with an
 *            "ou" chip; 3+ = a fan of up to 4 + "+n"; "n au choix" when qty > 1
 *   duo/trio cells side by side joined by "+" chips, widths following each photo's ratio
 *   grid     the first four in a 2 × 2, "+k"
 *   custom   the owner's photos: 1 fitted · 2 = lead + side (the group photo leads) · row · overlap ·
 *            3 = lead + two stacked · 4 = 2 × 2. Custom visuals never swap with the shopper's choices.
 *
 * Fit: a photo is cover-fitted only when its ratio is within 15% of its cell, it has no alpha and it
 * is not a group photo; otherwise it is shown whole (contain) on a --sec-chip backdrop. Group photos
 * are never cover-cropped. Crops (AssetRef.box) render through Picture's box path. No photo → a
 * monogram tile (the item's initial on --sec-chip), never an empty box.
 *
 * Swap layers (§F.6): every auto tile holds [data-lp-vslot="pv"][data-unit][data-item][data-base];
 * the runtime cross-fades the chosen item / option photo in from template[data-lp-vimg=<key>].
 * Decorative (aria-hidden): the card's text carries the meaning.
 */
import type { ReactElement, ReactNode } from "react";
import { groupPhotos, itemShort, itemVisual, type VisualTile } from "@/lib/page/catalog";
import { itemAvailable, ruleAllows } from "@/lib/page/options";
import { isChoiceGroup, isFixedPick, isMatrixGroup, type AssetRef, type CropBox, type Item, type LineRule, type Offer } from "@/lib/page/schema";
import { Icon, Picture, cssVars, cx } from "../primitives";
import { boxRatio } from "../primitives/Picture";
import { offerWord } from "../sections/orderForm/copy";
import { fitsCover } from "../sections/orderForm/fit";
import type { RenderContext, ResolvedAsset } from "../types";
import type { OfferView } from "./model";

/* ------------------------------------------------------------------ */
/* Visual model                                                        */
/* ------------------------------------------------------------------ */

export interface UnitVisual {
  asset: ResolvedAsset | null;
  box?: CropBox;
  kind: "cutout" | "photo" | "crop" | "monogram";
  /** the swap key of what is shown: "<itemId>" or "<itemId>:<gid>:<optionId>" */
  key: string;
  /** a photo shown by 2+ items (never cover-cropped) */
  group: boolean;
}

/** The first per-unit choice group (or matrix dim) of an item whose options carry photos. */
export function photoGroupOf(item: Item): { gid: string; dim?: string; options: { id: string; image?: AssetRef; soldOut: boolean }[]; kind: string } | null {
  for (const g of item.groups) {
    if (!g.perUnit) continue;
    if (isChoiceGroup(g) && g.options.some((o) => o.image)) return { gid: g.id, options: g.options, kind: g.kind };
    if (isMatrixGroup(g)) {
      const d = g.dims.find((x) => x.values.some((v) => v.image));
      if (d) return { gid: g.id, dim: d.id, options: d.values, kind: d.kind };
    }
  }
  return null;
}

/** The option a unit starts on in the photo group: lock → preset → first available (swatch / image kinds only). */
function startOption(pg: NonNullable<ReturnType<typeof photoGroupOf>>, rules: Readonly<Record<string, LineRule>> | undefined) {
  const rule = rules?.[pg.dim ? `${pg.gid}.${pg.dim}` : pg.gid];
  if (rule && "lock" in rule) return pg.options.find((o) => o.id === rule.lock);
  const allowed = pg.options.filter((o) => ruleAllows(rule, o.id) && !o.soldOut);
  if (rule && "preset" in rule && rule.preset) {
    const p = allowed.find((o) => o.id === rule.preset);
    if (p) return p;
  }
  return pg.kind !== "text" || allowed.length === 1 ? allowed[0] : undefined;
}

/**
 * What one unit of `item` shows on first paint: the photo of the option it starts on (lock, preset,
 * or the first available swatch / image option) when that option has one, else the item's own visual.
 */
export function unitVisual(ctx: RenderContext, item: Item, rules?: Readonly<Record<string, LineRule>>): UnitVisual {
  const groups = new Set(groupPhotos(ctx.doc).map((g) => g.asset.id));
  const pg = photoGroupOf(item);
  const start = pg ? startOption(pg, rules) : undefined;
  const opt = start?.image ? ctx.asset(start.image) : null;
  if (pg && start && opt) return { asset: opt, kind: opt.alpha ? "cutout" : "photo", key: `${item.id}:${pg.gid}:${start.id}`, group: false };
  const v = itemVisual(ctx.doc, item, ctx);
  return { asset: v.asset, ...(v.box ? { box: v.box } : {}), kind: v.kind, key: item.id, group: !!v.ref && !v.box && groups.has(v.ref.id) };
}

/** The first unit index (k) of every line of an offer. */
function lineStarts(offer: Pick<Offer, "lines">): number[] {
  const out: number[] = [];
  let k = 0;
  for (const l of offer.lines) {
    out.push(k);
    k += l.qty;
  }
  return out;
}

/** The first unit (k) of the line(s) a tile was built from. */
function tileUnit(offer: Offer, tile: VisualTile): number {
  const starts = lineStarts(offer);
  const i = offer.lines.findIndex((l) =>
    tile.kind === "item"
      ? isFixedPick(l.pick) && l.pick.item === tile.item && l.free === tile.free
      : !isFixedPick(l.pick) && l.free === tile.free && l.pick.choice.join("|") === tile.items.join("|"),
  );
  return i >= 0 ? starts[i]! : 0;
}

/** Rules of the first line a tile was built from (locks show that option's photo). */
function tileRules(offer: Offer, tile: VisualTile): Readonly<Record<string, LineRule>> | undefined {
  if (tile.kind !== "item") return undefined;
  return offer.lines.find((l) => isFixedPick(l.pick) && l.pick.item === tile.item && l.free === tile.free)?.rules;
}

/* ------------------------------------------------------------------ */
/* Cells                                                               */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Width / height of what a cell shows. */
function shownRatio(v: Pick<UnitVisual, "asset" | "box">): number {
  if (!v.asset) return 4 / 5;
  if (v.box) return boxRatio(v.asset, v.box);
  return v.asset.aspect > 0 ? v.asset.aspect : v.asset.width > 0 && v.asset.height > 0 ? v.asset.width / v.asset.height : 1;
}

/** Cover only within 15% of the cell, no alpha, not a group photo (and the product fits a cover crop). */
function coverFits(v: UnitVisual, cell: number): boolean {
  if (!v.asset || v.asset.alpha) return false;
  const r = shownRatio(v);
  // a group photo is never cropped: only a window of its own ratio (nothing cut) takes it whole
  if (v.group) return Math.abs(r / cell - 1) <= 0.02;
  if (Math.abs(r / cell - 1) > 0.15) return false;
  return v.box ? true : fitsCover(v.asset, cell);
}

function initialOf(ctx: RenderContext, name: string): string {
  return Array.from(name.trim())[0]?.toLocaleUpperCase(ctx.locale) ?? "·";
}

/** The photo (or monogram) inside a cell of ratio `cell`. */
function CellPicture({ ctx, v, cell, sizes, name }: { ctx: RenderContext; v: UnitVisual; cell: number; sizes: string; name: string }): ReactElement {
  if (!v.asset)
    return (
      <span className="lp-ov__mono" aria-hidden="true">
        <span>{initialOf(ctx, name)}</span>
      </span>
    );
  if (coverFits(v, cell)) {
    return v.box ? (
      <Picture asset={v.asset} box={v.box} ratio={cell} sizes={sizes} alt="" className="lp-ov__pic" />
    ) : (
      <Picture asset={v.asset} sizes={sizes} alt="" frame={{ shape: "rounded", ratio: cell }} className="lp-ov__pic" />
    );
  }
  // shown whole on the chip backdrop: a crop keeps its own ratio, centred in the cell
  if (v.box)
    return (
      <span className="lp-ov__inset" style={cssVars({ "--ir": r3(shownRatio(v)), "--iw": `${r3(Math.min(1, shownRatio(v) / cell) * 92)}%` })}>
        <Picture asset={v.asset} box={v.box} sizes={sizes} alt="" className="lp-ov__pic" />
      </span>
    );
  return <Picture asset={v.asset} sizes={sizes} alt="" fit="contain" className={cx("lp-ov__pic", v.asset.alpha ? "lp-ov__pic--cut" : "lp-ov__pic--whole")} />;
}

function Slot({ unit, item, base }: { unit?: number; item?: string; base?: string }) {
  return <span className="lp-vslot" data-lp-vslot="pv" data-unit={unit} data-item={item} data-base={base} aria-hidden="true" />;
}

function Qty({ ctx, n }: { ctx: RenderContext; n: number }) {
  return n > 1 ? (
    <span className="lp-ov__x">
      <bdi dir="ltr">×{ctx.num(n)}</bdi>
    </span>
  ) : null;
}

/** "Offert" on a free tile; a tile too narrow for the word shows the gift glyph alone (visual.css). */
function FreeChip({ ctx }: { ctx: RenderContext }) {
  return (
    <span className="lp-ov__free">
      <Icon name="gift" size="1em" strokeWidth={2} className="lp-ov__free-ico" />
      <span className="lp-ov__free-t">{offerWord(ctx.locale, "free")}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Copies (one item ×n): the depth stack / cutout lineup (pv.css)      */
/* ------------------------------------------------------------------ */

function Copies({ ctx, v, qty, unit, item, free, sizes, max, className }: { ctx: RenderContext; v: UnitVisual; qty: number; unit: number; item: string; free: boolean; sizes: string; max: number; className?: string }) {
  const name = itemShort(ctx.doc, ctx.items.find((x) => x.id === item) ?? ctx.items[0]!);
  if (!v.asset)
    return (
      <span className={cx("lp-pv", className)} data-kind="empty" aria-hidden="true">
        <bdi className="lp-pv__n" dir="ltr">
          ×{ctx.num(qty)}
        </bdi>
      </span>
    );
  const copies = Math.max(1, Math.min(qty, max));
  const cutout = v.kind === "cutout";
  const cell = cutout ? 4 / 5 : shownRatio(v) > 1.05 ? 5 / 4 : 4 / 5;
  const wide = !cutout && cell > 1;
  const mid = (copies - 1) / 2;
  return (
    <span
      className={cx("lp-pv", className)}
      data-kind={cutout ? "cutout" : "photo"}
      data-n={copies}
      data-wide={wide ? "" : undefined}
      style={cssVars({ "--pv-n": copies })}
      aria-hidden="true"
    >
      {Array.from({ length: copies }, (_, k) => (
        <span key={k} className="lp-pv__item" style={cssVars({ "--pv-c": k - mid, "--pv-a": Math.abs(k - mid), "--pv-d": copies - 1 - k })}>
          {cutout ? <Picture asset={v.asset} sizes={sizes} alt="" fit="contain" /> : <CellPicture ctx={ctx} v={v} cell={cell} sizes={sizes} name={name} />}
          <Slot unit={unit + (copies - 1 - k)} item={item} base={v.key} />
        </span>
      ))}
      {qty - copies > 0 ? (
        <span className="lp-pv__more">
          <bdi dir="ltr">+{ctx.num(qty - copies)}</bdi>
        </span>
      ) : null}
      {free ? <FreeChip ctx={ctx} /> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Rows of cells (duo, trio, custom)                                   */
/* ------------------------------------------------------------------ */

interface RowCell {
  v: UnitVisual;
  name: string;
  qty: number;
  free: boolean;
  /** swap slot (auto tiles only) */
  slot?: { unit: number; item: string };
  /** flex share (≈ the cell's width / height) */
  grow?: number;
}

/** gap between cells, % of the composition width */
const GAP = 3;

function Row({
  ctx,
  cells,
  mode,
  sizes,
  joiner,
  maxRatio,
  className,
}: {
  ctx: RenderContext;
  cells: RowCell[];
  mode: string;
  sizes: string;
  /** "+" between the cells, or none */
  joiner: boolean;
  maxRatio: number;
  className?: string;
}): ReactElement {
  const want = cells.map((c) => c.grow ?? clamp(shownRatio(c.v), 0.62, 1.9));
  const sum = want.reduce((n, r) => n + r, 0);
  const share = 1 - (GAP / 100) * (cells.length - 1);
  let R = sum / share;
  const scale = R > maxRatio ? maxRatio / R : 1;
  R = Math.min(R, maxRatio);
  // each cell's real ratio once the row is scaled to the composition
  const real = want.map((r) => r * scale);
  const widths = want.map((r) => (r / sum) * share * 100);
  const cellSizes = cells.length > 1 ? sizes.replace(/(\d+(?:\.\d+)?)(vw|rem|px)/g, (_m, n: string, u: string) => `${r3(Number(n) / Math.min(cells.length, 2))}${u}`) : sizes;
  let at = 0;
  const joins: number[] = [];
  widths.forEach((w, i) => {
    at += w;
    if (i < widths.length - 1) {
      joins.push(at + GAP / 2);
      at += GAP;
    }
  });
  const cutouts = cells.every((c) => c.v.kind === "cutout");
  return (
    <span className={cx("lp-ov", className)} data-mode={mode} data-n={cells.length} data-kind={cutouts ? "cutout" : "photo"} style={cssVars({ "--ov-r": r3(R) })} aria-hidden="true">
      {cells.map((c, i) => (
        <span key={i} className="lp-ov__cell" data-free={c.free ? "" : undefined} style={cssVars({ "--g": r3(want[i]!) })}>
          <CellPicture ctx={ctx} v={c.v} cell={real[i]!} sizes={cellSizes} name={c.name} />
          {c.slot ? <Slot unit={c.slot.unit} item={c.slot.item} base={c.v.key} /> : null}
          <Qty ctx={ctx} n={c.qty} />
          {c.free ? <FreeChip ctx={ctx} /> : null}
        </span>
      ))}
      {joiner
        ? joins.map((x, i) => (
            <span key={`j${i}`} className="lp-ov__plus" style={cssVars({ "--at": `${r3(x)}%` })}>
              <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                <path d="M8 3.5v9M3.5 8h9" />
              </svg>
            </span>
          ))
        : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Choice ("one of")                                                   */
/* ------------------------------------------------------------------ */

function Choice({ ctx, offer, tile, sizes, className }: { ctx: RenderContext; offer: Offer; tile: Extract<VisualTile, { kind: "choice" }>; sizes: string; className?: string }) {
  const unit = tileUnit(offer, tile);
  const items = tile.items.map((id) => ctx.items.find((x) => x.id === id)).filter((x): x is Item => !!x);
  const shown = items.slice(0, items.length === 2 ? 2 : 4);
  const more = items.length - shown.length;
  const label = tile.qty > 1 ? offerWord(ctx.locale, "anyN", { n: tile.qty }) : null;
  // each card takes its photo's ratio (within a portrait-to-square band): widths follow the photos
  const visuals = shown.map((it) => unitVisual(ctx, it));
  const crs = visuals.map((v) => r3(clamp(shownRatio(v), 0.72, 1.1)));
  // two: the front card (92% tall) + the second peeking 40% of its width (66% tall) + air
  const R = shown.length === 2 ? r3(0.92 * crs[0]! + 0.36 * crs[1]! + 0.14) : 1.35;
  const seam = shown.length === 2 ? `${r3(6 + ((0.92 * crs[0]!) / R) * 100)}%` : undefined;
  return (
    <span className={cx("lp-ov lp-ov--choice", className)} data-mode="choice" data-n={shown.length} style={cssVars({ "--ov-r": R, "--at": seam })} aria-hidden="true">
      {shown.map((it, i) => {
        const v = visuals[i]!;
        const cr = crs[i]!;
        return (
          <span key={it.id} className="lp-ov__card" data-i={i} style={cssVars({ "--i": i, "--cr": cr })}>
            <CellPicture ctx={ctx} v={v} cell={cr} sizes={sizes} name={itemShort(ctx.doc, it)} />
            {/* the front card follows the shopper's pick (unit k of the line) */}
            {i === 0 ? <Slot unit={unit} item="" base={v.key} /> : null}
          </span>
        );
      })}
      {shown.length === 2 ? <span className="lp-ov__or">{offerWord(ctx.locale, "or")}</span> : null}
      {more > 0 ? (
        <span className="lp-ov__more">
          <bdi dir="ltr">+{ctx.num(more)}</bdi>
        </span>
      ) : null}
      {label ? <span className="lp-ov__any">{label}</span> : null}
      {tile.free ? <FreeChip ctx={ctx} /> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The composition                                                     */
/* ------------------------------------------------------------------ */

export interface OfferVisualProps {
  ctx: RenderContext;
  view: Pick<OfferView, "offer" | "plan" | "qty" | "image">;
  /** the largest window it is shown in */
  sizes: string;
  /** most copies drawn in a copies stack */
  max?: number;
  /** widest composition (width / height) before the cells shrink */
  maxRatio?: number;
  className?: string;
}

/** The offer's picture (§E.6). */
export function OfferVisual({ ctx, view, sizes, max = 3, maxRatio = 2.2, className }: OfferVisualProps): ReactElement {
  const { offer, plan } = view;
  const groups = new Set(groupPhotos(ctx.doc).map((g) => g.asset.id));
  const byId = new Map(ctx.items.map((it) => [it.id, it]));
  const nameOf = (id: string) => {
    const it = byId.get(id);
    return it ? itemShort(ctx.doc, it) : ctx.product.name;
  };

  if (plan.mode === "custom" && plan.images?.length) {
    const vs: RowCell[] = plan.images
      .map((ref): RowCell | null => {
        const asset = ctx.asset(ref);
        if (!asset) return null;
        const v: UnitVisual = { asset, ...(ref.box ? { box: ref.box } : {}), kind: ref.box ? "crop" : asset.alpha ? "cutout" : "photo", key: "", group: !ref.box && groups.has(ref.id) };
        return { v, name: ctx.product.name, qty: 1, free: false };
      })
      .filter((c): c is RowCell => !!c);
    if (vs.length === 1) return <Row ctx={ctx} cells={vs} mode="custom-1" sizes={sizes} joiner={false} maxRatio={maxRatio} className={className} />;
    if (vs.length) {
      const arrange = plan.arrange ?? "auto";
      if (vs.length === 2 && arrange === "auto") {
        // lead + side: the photo showing more items (a group photo) leads at ≈ 2/3 of the width
        const lead = vs.findIndex((c) => c.v.group);
        const order = lead === 1 ? [vs[1]!, vs[0]!] : vs;
        const a = clamp(shownRatio(order[0]!.v), 0.62, 1.9);
        const b = clamp(shownRatio(order[1]!.v), 0.62, 1.9);
        const cells = [{ ...order[0]!, grow: Math.max(a, 2 * b) }, { ...order[1]!, grow: b }];
        return <Row ctx={ctx} cells={cells} mode="lead" sizes={sizes} joiner maxRatio={maxRatio} className={className} />;
      }
      if (arrange === "overlap" || (arrange === "auto" && vs.length >= 3)) {
        // overlap · 3 = lead + two stacked · 4 = 2 × 2 (CSS lays them out by data-mode / data-n)
        const mode = arrange === "overlap" ? "overlap" : vs.length === 3 ? "lead3" : "grid";
        return (
          <span className={cx("lp-ov", className)} data-mode={mode} data-n={vs.length} style={cssVars({ "--ov-r": mode === "overlap" ? 1.5 : 1.25 })} aria-hidden="true">
            {vs.slice(0, 4).map((c, i) => (
              <span key={i} className="lp-ov__cell" data-i={i}>
                <CellPicture ctx={ctx} v={c.v} cell={mode === "lead3" && i === 0 ? 0.9 : 1} sizes={sizes} name={c.name} />
              </span>
            ))}
          </span>
        );
      }
      return <Row ctx={ctx} cells={vs.slice(0, 4)} mode={arrange === "grid" ? "row" : "row"} sizes={sizes} joiner={arrange !== "row" ? true : false} maxRatio={maxRatio} className={className} />;
    }
  }

  const tiles = plan.tiles;
  if (tiles.length === 1 && tiles[0]!.kind === "item") {
    const t = tiles[0]!;
    const item = byId.get(t.item) ?? ctx.items[0]!;
    const v = unitVisual(ctx, item, tileRules(offer, t));
    return <Copies ctx={ctx} v={v} qty={t.qty} unit={tileUnit(offer, t)} item={item.id} free={t.free} sizes={sizes} max={max} className={className} />;
  }
  if (tiles.length === 1 && tiles[0]!.kind === "choice") return <Choice ctx={ctx} offer={offer} tile={tiles[0]!} sizes={sizes} className={className} />;

  const cells: RowCell[] = tiles.slice(0, 4).map((t): RowCell => {
    if (t.kind === "item") {
      const item = byId.get(t.item);
      const v: UnitVisual = item ? unitVisual(ctx, item, tileRules(offer, t)) : { asset: null, kind: "monogram", key: t.item, group: false };
      return { v, name: nameOf(t.item), qty: t.qty, free: t.free, slot: { unit: tileUnit(offer, t), item: t.item } };
    }
    const first = byId.get(t.items[0] ?? "");
    const v: UnitVisual = first ? unitVisual(ctx, first) : { asset: null, kind: "monogram", key: "", group: false };
    return { v, name: offerWord(ctx.locale, "choice"), qty: t.qty, free: t.free, slot: { unit: tileUnit(offer, t), item: "" } };
  });
  if (tiles.length >= 4) {
    const more = tiles.length - 4;
    return (
      <span className={cx("lp-ov", className)} data-mode="grid" data-n={cells.length} style={cssVars({ "--ov-r": 1 })} aria-hidden="true">
        {cells.map((c, i) => (
          <span key={i} className="lp-ov__cell" data-i={i} data-free={c.free ? "" : undefined}>
            <CellPicture ctx={ctx} v={c.v} cell={1} sizes={sizes} name={c.name} />
            {c.slot ? <Slot unit={c.slot.unit} item={c.slot.item} base={c.v.key} /> : null}
            <Qty ctx={ctx} n={c.qty} />
            {c.free ? <FreeChip ctx={ctx} /> : null}
          </span>
        ))}
        {more > 0 ? (
          <span className="lp-ov__more">
            <bdi dir="ltr">+{ctx.num(more)}</bdi>
          </span>
        ) : null}
      </span>
    );
  }
  return <Row ctx={ctx} cells={cells} mode={tiles.length === 2 ? "duo" : "trio"} sizes={sizes} joiner maxRatio={maxRatio} className={className} />;
}

/**
 * The offer as a 56 px thumbnail (stack rows): one item ×n keeps its depth stack; anything else
 * shows its lead picture (the first tile, or the first custom photo) in the square window with a
 * "+n" chip for the rest — a composition of several cells is illegible at that size.
 */
export function OfferThumb({ ctx, view, sizes }: { ctx: RenderContext; view: Pick<OfferView, "offer" | "plan" | "qty" | "image">; sizes: string }): ReactElement {
  const { offer, plan } = view;
  const groups = new Set(groupPhotos(ctx.doc).map((g) => g.asset.id));
  const byId = new Map(ctx.items.map((it) => [it.id, it]));
  if (plan.mode !== "custom" && plan.tiles.length === 1 && plan.tiles[0]!.kind === "item") return <OfferVisual ctx={ctx} view={view} sizes={sizes} max={2} />;
  let v: UnitVisual | null = null;
  let name = ctx.product.name;
  let more = 0;
  let slot: { unit: number; item: string } | null = null;
  if (plan.mode === "custom" && plan.images?.length) {
    const ref = plan.images[0]!;
    const asset = ctx.asset(ref);
    if (asset) v = { asset, ...(ref.box ? { box: ref.box } : {}), kind: ref.box ? "crop" : asset.alpha ? "cutout" : "photo", key: "", group: !ref.box && groups.has(ref.id) };
    more = plan.images.length - 1;
  } else {
    const t = plan.tiles[0];
    if (t) {
      const it = byId.get(t.kind === "item" ? t.item : (t.items[0] ?? ""));
      if (it) {
        v = unitVisual(ctx, it, tileRules(offer, t));
        name = itemShort(ctx.doc, it);
      }
      slot = { unit: tileUnit(offer, t), item: t.kind === "item" ? t.item : "" };
      more = plan.tiles.length - 1 + (t.kind === "choice" ? t.items.length - 1 : 0);
    }
  }
  const shown: UnitVisual = v ?? { asset: null, kind: "monogram", key: "", group: false };
  return (
    <span className="lp-othumb" aria-hidden="true">
      <CellPicture ctx={ctx} v={shown} cell={1} sizes={sizes} name={name} />
      {slot ? <Slot unit={slot.unit} item={slot.item} base={shown.key} /> : null}
      {more > 0 ? (
        <span className="lp-othumb__more">
          <bdi dir="ltr">+{ctx.num(more)}</bdi>
        </span>
      ) : null}
    </span>
  );
}

/** A small square visual of one item (item chooser chips, contents line, box tiles, receipt). */
export function ItemThumb({ ctx, item, rules, sizes = "3.5rem", className, slot }: { ctx: RenderContext; item: Item; rules?: Readonly<Record<string, LineRule>>; sizes?: string; className?: string; slot?: ReactNode }): ReactElement {
  const v = unitVisual(ctx, item, rules);
  return (
    <span className={cx("lp-ithumb", !v.asset && "lp-ithumb--mono", className)} aria-hidden="true">
      <CellPicture ctx={ctx} v={v} cell={1} sizes={sizes} name={itemShort(ctx.doc, item)} />
      {slot}
    </span>
  );
}

/** Items an offer's choice lines let the shopper pick (available only), for the item chooser. */
export function choiceItems(ctx: RenderContext, choice: readonly string[]): Item[] {
  return choice.map((id) => ctx.items.find((x) => x.id === id)).filter((x): x is Item => !!x && itemAvailable(x));
}
