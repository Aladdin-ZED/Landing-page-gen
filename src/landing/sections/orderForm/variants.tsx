/**
 * Product option pickers of the order form (runtime: src/landing/runtime/variants.ts).
 *
 * Controls (the order contract): per-unit groups are radios named v.{i}.{groupId} (0-based unit) in
 * one row per unit — rows are server-rendered up to the largest pack (those beyond the default pack
 * start hidden; the runtime shows exactly qty rows) plus a one-root <template> fallback; a shared
 * group (perUnit: false) is one radio set named v.{groupId}.
 *
 * Every group is a <fieldset> wrapped as [data-field] with its own [data-error] line and its own
 * messages (data-msg: nothing chosen, data-msg-gone: sold out since the page was opened), so client
 * and server errors land under the right picker. Three looks, one grammar:
 *  - swatch: round color dots (or round photos), the chosen name beside the group name;
 *  - image:  photo tiles, the chosen name beside the group name;
 *  - text:   chips on an even grid (sizes, ages) or flowing (long labels).
 * A sold-out option stays visible with a diagonal strike, is disabled (never focusable or chosen) and
 * says so to screen readers. Swatch and image groups start on their first available option; text
 * groups (sizes) start empty and are required. A lone available option is always preselected.
 *
 * Photo swap: options carrying a photo tag their radio with data-vimg; one inert <template
 * data-lp-vimg> per photo holds it pre-fitted for each order-form window ([data-lp-vslot]: the receipt
 * thumbnail and every pack copy), and the runtime cross-fades the chosen unit's photo in.
 */
import type { ReactElement } from "react";
import type { Product, SectionBg } from "@/lib/page/schema";
import { Picture, cssVars, cx, resolveProductVisual, safeHex, type VisualKind } from "../../primitives";
import type { RenderContext, ResolvedAsset } from "../../types";
import { optionLabels, uiLabels } from "./copy";
import { LETTERBOX, fitsCover, photoPlan } from "./fit";
import { PlannedPhoto } from "./photo";

type Group = Product["variants"][number];
type Option = Group["options"][number];
/** dot = round color (or round photo) · tile = photo tile · chip = text */
type Look = "dot" | "tile" | "chip";

/** Groups that actually offer something. */
export const optionGroups = (ctx: RenderContext): Group[] => ctx.product.variants.filter((g) => g.options.length > 0);

/** The option a group starts on: the first available one for swatch & image groups, else only a lone available option. */
export function preselected(g: Group): Option | undefined {
  const available = g.options.filter((o) => !o.soldOut);
  return g.kind !== "text" || available.length === 1 ? available[0] : undefined;
}

function lookOf(ctx: RenderContext, g: Group): Look {
  const photo = (o: Option) => !!ctx.asset(o.image);
  if (g.kind === "swatch" && g.options.every((o) => safeHex(o.swatch) || photo(o))) return "dot";
  if (g.kind === "image" && g.options.every(photo)) return "tile";
  return "chip";
}

/* ------------------------------------------------------------------ */
/* Photo swap model                                                    */
/* ------------------------------------------------------------------ */

/** Key of the product's own visual among the swap keys (an option without a photo shows it). */
const PRODUCT_KEY = "@";

export interface OptionVisuals {
  /** the group whose choice drives the photos (the first one with photos) */
  group: Group;
  /** swap key per option id: "<groupId>:<optionId>" for its photo, "@" for the product visual */
  keys: Map<string, string>;
  /** what the order form draws on first paint (the preselected option's photo, else the product) */
  base: { key: string; asset: ResolvedAsset | null; kind: VisualKind };
  /** every other key's photo (product visual included when some option has none) */
  alternates: { key: string; asset: ResolvedAsset }[];
}

/** Photo-swap model of the page, or null when no option carries a photo. */
export function optionVisuals(ctx: RenderContext): OptionVisuals | null {
  const group = optionGroups(ctx).find((g) => g.options.some((o) => ctx.asset(o.image)));
  if (!group) return null;
  const product = resolveProductVisual(ctx);
  const keys = new Map<string, string>();
  const photos = new Map<string, ResolvedAsset>();
  for (const o of group.options) {
    const a = ctx.asset(o.image);
    const key = a ? `${group.id}:${o.id}` : PRODUCT_KEY;
    keys.set(o.id, key);
    if (a) photos.set(key, a);
  }
  const first = preselected(group);
  const baseKey = first ? (keys.get(first.id) ?? PRODUCT_KEY) : PRODUCT_KEY;
  const baseAsset = baseKey === PRODUCT_KEY ? product.asset : (photos.get(baseKey) ?? null);
  const base = { key: baseKey, asset: baseAsset, kind: (baseAsset ? (baseAsset.alpha ? "cutout" : "photo") : "empty") as VisualKind };
  const alternates: OptionVisuals["alternates"] = [];
  for (const [key, asset] of photos) if (key !== baseKey) alternates.push({ key, asset });
  if (baseKey !== PRODUCT_KEY && product.asset && [...keys.values()].includes(PRODUCT_KEY)) alternates.push({ key: PRODUCT_KEY, asset: product.asset });
  return { group, keys, base, alternates };
}

/** The product visual the order form shows on first paint (the preselected option's photo when it has one). */
export function formVisual(ctx: RenderContext): { asset: ResolvedAsset | null; kind: VisualKind } {
  const v = optionVisuals(ctx);
  return v && v.base.asset ? { asset: v.base.asset, kind: v.base.kind } : resolveProductVisual(ctx);
}

/**
 * Where the runtime cross-fades an option photo in: an empty layer over a product picture (React
 * never renders children into it, so the runtime owns them — safe in the live preview too).
 * `unit` = which unit's choice it shows (pack copies: 0 = the front copy).
 */
export function VariantSlot({ ctx, kind, unit }: { ctx: RenderContext; kind: "thumb" | "pv"; unit?: number }): ReactElement | null {
  const v = optionVisuals(ctx);
  if (!v) return null;
  return <span className="lp-vslot" data-lp-vslot={kind} data-unit={unit} data-base={v.base.key} aria-hidden="true" />;
}

/** Sizes of a pack copy (the largest window it appears in: split panel, visual cards). */
const PV_SIZES = "(min-width: 64rem) 22rem, 44vw";

/** One inert template per alternate photo, pre-fitted for the receipt thumbnail and the pack copies. */
function PhotoTemplates({ ctx }: { ctx: RenderContext }): ReactElement | null {
  const v = optionVisuals(ctx);
  if (!v || !v.alternates.length) return null;
  const base = v.base;
  const plan = base.kind === "photo" ? photoPlan(base.asset) : null;
  return (
    <>
      {v.alternates.map(({ key, asset }) => {
        let pv: ReactElement | null = null;
        if (plan) {
          // a pack copy keeps the base photo's window (4:5, or 5:4 for a wide product): the option photo is fitted to it
          pv =
            !asset.alpha && fitsCover(asset, plan.ratio) ? (
              <PlannedPhoto asset={asset} sizes={PV_SIZES} plan={{ wide: plan.wide, fit: "cover", ratio: plan.ratio }} />
            ) : (
              <Picture asset={asset} sizes={PV_SIZES} alt="" fit="contain" className={asset.alpha ? undefined : LETTERBOX} />
            );
        } else if (base.kind === "cutout" && asset.alpha) {
          pv = <Picture asset={asset} sizes={PV_SIZES} alt="" fit="contain" />;
        }
        return (
          <template key={key} data-lp-vimg={key}>
            <span data-slot="thumb">
              <Picture
                asset={asset}
                sizes="4.5rem"
                alt=""
                ratio={1}
                fit={asset.alpha ? "contain" : "cover"}
                imgClassName={asset.alpha ? "lp-of__line-cut" : undefined}
              />
            </span>
            {pv ? <span data-slot="pv">{pv}</span> : null}
          </template>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pickers                                                             */
/* ------------------------------------------------------------------ */

/** Relative luminance of a #rrggbb color (0 black … 1 white). */
function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

/** The tick drawn on the chosen dot or tile. */
function Tick(): ReactElement {
  return (
    <svg className="lp-vo__tick" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.6 12.6l3.7 3.6 7.2-8" />
    </svg>
  );
}

interface GroupProps {
  ctx: RenderContext;
  group: Group;
  /** unit index (number), the template token "{i}", or null for a shared group */
  unit: number | "{i}" | null;
  surface?: SectionBg;
}

function GroupField({ ctx, group, unit, surface }: GroupProps): ReactElement {
  const O = optionLabels(ctx.locale);
  const name = unit === null ? `v.${group.id}` : `v.${unit}.${group.id}`;
  const key = unit === null ? `v-${group.id}` : `v-${unit}-${group.id}`;
  const errId = `lp-f-${key}-err`;
  const look = lookOf(ctx, group);
  const start = preselected(group);
  const photos = optionVisuals(ctx);
  const swapKeys = photos && photos.group.id === group.id ? photos.keys : null;
  // short labels (sizes, ages) sit on an even grid sized to the longest one; long labels flow
  const longest = Math.max(...group.options.map((o) => Array.from(o.label).length));
  const grid = look === "chip" && longest <= 9;
  return (
    <fieldset
      className="lp-vg"
      data-field={key}
      data-look={look}
      data-msg={O.choose(group.name)}
      data-msg-gone={O.gone}
      data-bg={unit === null ? surface : undefined}
    >
      <legend className="lp-vg__head">
        <span className="lp-vg__name">{group.name}</span>
        {look !== "chip" ? (
          <span className="lp-vg__val" data-lp-vval="" aria-hidden="true">
            {start?.label ?? ""}
          </span>
        ) : null}
      </legend>
      <span
        className="lp-vg__opts"
        data-layout={look === "chip" ? (grid ? "grid" : "flow") : look}
        style={grid ? cssVars({ "--vo-min": `${Math.max(2.6, 1 + longest * 0.58).toFixed(2)}rem` }) : undefined}
      >
        {group.options.map((o) => {
          const img = ctx.asset(o.image);
          const hex = safeHex(o.swatch);
          const label = (
            <>
              {o.label}
              {o.soldOut ? <span className="lp-visually-hidden">{`, ${O.soldOut}`}</span> : null}
            </>
          );
          return (
            <label key={o.id} className="lp-vo" data-soldout={o.soldOut ? "" : undefined} title={look === "chip" ? undefined : o.label}>
              <input
                className="lp-vo__in"
                type="radio"
                name={name}
                value={o.id}
                required
                disabled={o.soldOut}
                defaultChecked={o.id === start?.id}
                aria-describedby={errId}
                data-sw={hex}
                data-vimg={swapKeys?.get(o.id)}
              />
              {look === "chip" ? (
                <span className="lp-vo__face">
                  {img ? <Picture asset={img} sizes="2rem" alt="" ratio={1} className="lp-vo__mini" /> : null}
                  {hex && !img ? <span className="lp-vo__mini lp-vo__mini--sw" style={cssVars({ "--sw": hex })} /> : null}
                  <span className="lp-vo__txt">{label}</span>
                  {o.soldOut ? <span className="lp-vo__x" aria-hidden="true" /> : null}
                </span>
              ) : (
                <>
                  <span
                    className="lp-vo__face"
                    data-tone={hex ? (luminance(hex) > 0.42 ? "light" : "dark") : "photo"}
                    style={hex && look === "dot" ? cssVars({ "--sw": hex }) : undefined}
                  >
                    {look === "tile" || (look === "dot" && !hex) ? (
                      <Picture asset={img} sizes={look === "tile" ? "3.5rem" : "2.75rem"} alt="" ratio={1} className="lp-vo__pic" />
                    ) : null}
                    <Tick />
                    {o.soldOut ? <span className="lp-vo__x" aria-hidden="true" /> : null}
                  </span>
                  <span className="lp-visually-hidden">{label}</span>
                </>
              )}
            </label>
          );
        })}
      </span>
      <p className="lp-field__error lp-vg__err" id={errId} data-error="" aria-live="polite" />
    </fieldset>
  );
}

function UnitRow({ ctx, groups, unit, hidden, surface }: { ctx: RenderContext; groups: Group[]; unit: number | "{i}"; hidden?: boolean; surface?: SectionBg }) {
  const O = optionLabels(ctx.locale);
  const label = O.unit(unit === "{i}" ? "{n}" : unit + 1);
  return (
    <div className="lp-vrow" role="group" aria-label={label} hidden={hidden} data-bg={surface}>
      <div className="lp-vrow__head">
        <span className="lp-vrow__n" aria-hidden="true">
          {label}
        </span>
        {unit === 0 ? (
          <button type="button" className="lp-vsame" data-lp-vsame="">
            <svg className="lp-vsame__ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path className="lp-vsame__copy" d="M9 9.5h8.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19.5V11A1.5 1.5 0 0 1 9 9.5zM4.5 14.5V5A1.5 1.5 0 0 1 6 3.5h9.5" />
              <path className="lp-vsame__done" d="M6.6 12.6l3.7 3.6 7.2-8" />
            </svg>
            <span>{O.sameForAll}</span>
          </button>
        ) : null}
      </div>
      <div className="lp-vrow__groups">
        {groups.map((g) => (
          <GroupField key={g.id} ctx={ctx} group={g} unit={unit} />
        ))}
      </div>
    </div>
  );
}

/** The whole option block, or null for products without options. */
export function VariantPickers({ ctx, defaultQty, surface }: { ctx: RenderContext; defaultQty: number; surface?: SectionBg }): ReactElement | null {
  const groups = optionGroups(ctx);
  if (!groups.length) return null;
  const perUnit = groups.filter((g) => g.perUnit);
  const shared = groups.filter((g) => !g.perUnit);
  const maxQty = Math.max(1, ...ctx.offers.bundles.map((b) => b.qty));
  return (
    <div className={cx("lp-vars", perUnit.length > 0 && "lp-vars--units")} data-lp-variants="" data-units={perUnit.length ? defaultQty : undefined}>
      {shared.map((g) => (
        <GroupField key={g.id} ctx={ctx} group={g} unit={null} surface={surface} />
      ))}
      {perUnit.length
        ? Array.from({ length: maxQty }, (_, i) => <UnitRow key={i} ctx={ctx} groups={perUnit} unit={i} hidden={i >= defaultQty} surface={surface} />)
        : null}
      {perUnit.length ? (
        <template data-lp-variant-tpl="">
          <UnitRow ctx={ctx} groups={perUnit} unit="{i}" surface={surface} />
        </template>
      ) : null}
      <PhotoTemplates ctx={ctx} />
    </div>
  );
}

/**
 * The live one-line summary of the chosen options ("2 × ● Noir / M + ● Beige / L"), drawn by the
 * runtime into an element React leaves empty. `as="row"` makes it the last row of the order summary
 * (<dl>), right under the total; `as="line"` a standalone line above the button.
 */
export function OptionsSummary({ ctx, as }: { ctx: RenderContext; as: "row" | "line" }): ReactElement | null {
  if (!optionGroups(ctx).length) return null;
  const label = uiLabels(ctx.locale).options;
  if (as === "row")
    return (
      <div className="lp-sum__row lp-sum__row--opts">
        <dt className="lp-visually-hidden">{label}</dt>
        <dd className="lp-vsum" data-lp-vsum="" aria-live="polite" />
      </div>
    );
  return <p className="lp-vsum lp-vsum--line" data-lp-vsum="" aria-live="polite" />;
}
