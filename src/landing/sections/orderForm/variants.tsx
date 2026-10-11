/**
 * Product option pickers for the order form (runtime contract, src/landing/runtime/variants.ts):
 *  - per-unit groups: controls named v.{i}.{groupId} (0-based unit) inside [data-lp-variants], one
 *    row per unit. Rows are server-rendered up to the largest pack (those beyond the default pack
 *    start hidden; the runtime shows exactly qty rows), plus the one-root <template> fallback;
 *  - shared groups (perUnit: false): one control named v.{groupId}.
 * Each group is a fieldset wrapped as [data-field] with its own [data-error] line, so the runtime's
 * "choose an option" message lands next to the right group. Options are pill chips (swatch dot or
 * thumbnail when the group has them); long lists become a native select.
 */
import type { ReactElement } from "react";
import type { Product, SectionBg } from "@/lib/page/schema";
import { Icon, Picture, cssVars, safeHex } from "../../primitives";
import type { RenderContext } from "../../types";

type Group = Product["variants"][number];

/** Above this many options a native select is friendlier on a phone than a wall of chips. */
const SELECT_ABOVE = 8;

interface GroupProps {
  ctx: RenderContext;
  group: Group;
  /** unit index (number), the template token "{i}", or null for a shared group */
  unit: number | "{i}" | null;
  surface?: SectionBg;
}

function GroupField({ ctx, group, unit, surface }: GroupProps): ReactElement {
  const name = unit === null ? `v.${group.id}` : `v.${unit}.${group.id}`;
  const key = unit === null ? `v-${group.id}` : `v-${unit}-${group.id}`;
  const errId = `lp-f-${key}-err`;
  const available = group.options.filter((o) => !o.soldOut);
  // a single choice is no choice: preselect it so the shopper is never asked a non-question
  const only = available.length === 1 ? available[0]!.id : undefined;
  // short text labels (sizes, ages) sit on an even grid; long ones, swatches and pictures flow
  const even = group.kind === "text" && group.options.length > 2 && group.options.every((o) => Array.from(o.label).length <= 9);
  return (
    <fieldset className="lp-vg" data-field={key} data-kind={group.kind} data-bg={unit === null ? surface : undefined}>
      <legend className="lp-vg__name">{group.name}</legend>
      {group.options.length > SELECT_ABOVE ? (
        <span className="lp-select lp-vg__select">
          <select className="lp-select__el" name={name} required defaultValue={only ?? ""} aria-describedby={errId}>
            <option value="" disabled>
              {group.name}
            </option>
            {group.options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.soldOut}>
                {o.label}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={20} className="lp-select__chev" />
        </span>
      ) : (
        <span className="lp-vg__opts" data-even={even ? "" : undefined}>
          {group.options.map((o) => {
            const img = group.kind === "image" ? ctx.asset(o.image) : null;
            const sw = group.kind === "swatch" ? safeHex(o.swatch) : undefined;
            return (
              <label key={o.id} className="lp-vo" data-soldout={o.soldOut ? "" : undefined}>
                <input
                  className="lp-vo__in"
                  type="radio"
                  name={name}
                  value={o.id}
                  required
                  disabled={o.soldOut}
                  defaultChecked={o.id === only}
                  aria-describedby={errId}
                />
                <span className="lp-vo__face">
                  {sw ? <span className="lp-vo__sw" style={cssVars({ "--sw": sw })} aria-hidden="true" /> : null}
                  {img ? <Picture asset={img} sizes="2rem" alt="" ratio={1} className="lp-vo__img" /> : null}
                  <span className="lp-vo__txt">{o.label}</span>
                </span>
              </label>
            );
          })}
        </span>
      )}
      <p className="lp-field__error lp-vg__err" id={errId} data-error="" aria-live="polite" />
    </fieldset>
  );
}

function UnitRow({ ctx, groups, unit, hidden, surface }: { ctx: RenderContext; groups: Group[]; unit: number | "{i}"; hidden?: boolean; surface?: SectionBg }) {
  const n = unit === "{i}" ? "{n}" : String(unit + 1);
  return (
    <div className="lp-vrow" hidden={hidden} data-bg={surface}>
      {/* the disc carries the number; the word beside it no longer repeats it ("① Article", not "① Article 1") */}
      <span className="lp-vrow__n" aria-hidden="true">
        <span className="lp-vrow__i">{n}</span>
        <bdi>{ctx.t("form.variantFor", { n: "" }).replace(/\s+/g, " ").trim()}</bdi>
      </span>
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
  const groups = ctx.product.variants.filter((g) => g.options.length > 0);
  if (!groups.length) return null;
  const perUnit = groups.filter((g) => g.perUnit);
  const shared = groups.filter((g) => !g.perUnit);
  const maxQty = Math.max(1, ...ctx.offers.bundles.map((b) => b.qty));
  return (
    <div className="lp-vars" data-lp-variants="" data-units={perUnit.length ? defaultQty : undefined}>
      {shared.map((g) => (
        <GroupField key={g.id} ctx={ctx} group={g} unit={null} surface={surface} />
      ))}
      {perUnit.length
        ? Array.from({ length: maxQty }, (_, i) => (
            <UnitRow key={i} ctx={ctx} groups={perUnit} unit={i} hidden={i >= defaultQty} surface={surface} />
          ))
        : null}
      {perUnit.length ? (
        <template data-lp-variant-tpl="">
          <UnitRow ctx={ctx} groups={perUnit} unit="{i}" surface={surface} />
        </template>
      ) : null}
    </div>
  );
}
