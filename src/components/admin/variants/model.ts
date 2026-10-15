/**
 * Pure edit operations of the options editor (no React): every function returns a new list and
 * keeps it schema-valid — ids unique, labels cleaned, at most 3 groups and 24 options. A group with
 * no option is never part of the value (the editor holds it as "pending" until its first option).
 */
import type { AssetRef, Locale } from "@/lib/page/schema";
import {
  MAX_VARIANT_OPTIONS,
  cleanLabel,
  inferPreset,
  normalizeLabel,
  presetKind,
  presetName,
  presetRank,
  swatchFor,
  variantId,
  variantIds,
  type VariantGroup,
  type VariantOption,
  type VariantPreset,
} from "@/lib/page/variant-presets";

export type { VariantGroup, VariantOption, VariantPreset };

/** A group with no option yet (being set up). */
export function newGroup(preset: VariantPreset, locale: Locale, taken: readonly string[]): VariantGroup {
  return { id: variantId("g", taken), name: presetName(preset, locale), kind: presetKind(preset), perUnit: true, options: [] };
}

/** Whether a group's options name colors (swatches follow their names). */
export const isColorGroup = (g: Pick<VariantGroup, "name" | "kind" | "options">) => g.kind === "swatch" || inferPreset(g) === "color";

export interface AddResult {
  group: VariantGroup;
  /** ids of the options added */
  added: string[];
  /** ids of existing options a typed label repeated */
  repeated: string[];
  /** some labels were left out: the group reached 24 options */
  full: boolean;
}

/**
 * Add typed labels to a group: cleaned, repeated labels skipped (reported), color names get their
 * swatch in a color group, quick-fill values (sizes, shoe sizes, volumes) slot into their natural
 * order. `extra` adds fields to each new option (a linked photo, a photo's own swatch).
 */
export function addOptions(
  group: VariantGroup,
  labels: readonly string[],
  ctx: { locale: Locale; preset: VariantPreset; taken: readonly string[] },
  extra?: (label: string) => Partial<Pick<VariantOption, "swatch" | "image">>,
): AddResult {
  const options = [...group.options];
  const taken = [...ctx.taken, ...variantIds([group])];
  const added: string[] = [];
  const repeated: string[] = [];
  let full = false;
  const color = ctx.preset === "color" || group.kind === "swatch";
  for (const raw of labels) {
    const label = cleanLabel(raw);
    if (!label) continue;
    const key = normalizeLabel(label);
    const hit = options.find((o) => normalizeLabel(o.label) === key);
    if (hit) {
      if (!added.includes(hit.id)) repeated.push(hit.id);
      continue;
    }
    if (options.length >= MAX_VARIANT_OPTIONS) {
      full = true;
      break;
    }
    const id = variantId("o", taken);
    taken.push(id);
    const more = extra?.(label) ?? {};
    const swatch = more.swatch ?? (color ? swatchFor(label) : undefined);
    const option: VariantOption = { id, label, soldOut: false, ...(swatch ? { swatch } : {}), ...(more.image ? { image: more.image } : {}) };
    const rank = presetRank(ctx.preset, ctx.locale, label);
    let at = options.length;
    if (rank >= 0) {
      const after = options.findIndex((o) => presetRank(ctx.preset, ctx.locale, o.label) > rank);
      if (after >= 0) at = after;
    }
    options.splice(at, 0, option);
    added.push(id);
  }
  return { group: added.length ? { ...group, options } : group, added, repeated, full };
}

/**
 * A renamed option (its photo's alt text follows). In a color group the swatch follows the name
 * while it is the name's own (or empty): "Noir" → "Beige" turns the dot beige; a hand-picked
 * swatch stays.
 */
export function relabel(o: VariantOption, label: string, colorGroup: boolean): VariantOption {
  const next: VariantOption = { ...o, label, ...(o.image ? { image: { ...o.image, alt: label.slice(0, 200) } } : {}) };
  if (!colorGroup) return next;
  const auto = !o.swatch || o.swatch === swatchFor(o.label);
  if (!auto) return next;
  const swatch = swatchFor(label);
  if (swatch) next.swatch = swatch;
  else delete next.swatch;
  return next;
}

/** The array with one item moved (indexes clamped). */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const t = Math.max(0, Math.min(list.length - 1, to));
  if (from === t || from < 0 || from >= list.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(t, 0, item!);
  return next;
}

export const replaceAt = <T>(list: readonly T[], i: number, item: T): T[] => list.map((x, j) => (j === i ? item : x));
export const removeAt = <T>(list: readonly T[], i: number): T[] => list.filter((_, j) => j !== i);

/** An option linked to a photo (alt = the option's own name) or unlinked. */
export function withImage(o: VariantOption, ref: AssetRef | null): VariantOption {
  const next = { ...o };
  if (ref) next.image = { ...ref, alt: o.label.slice(0, 200) };
  else delete next.image;
  return next;
}

/** An option with a hand-picked swatch, or without (null). */
export function withSwatch(o: VariantOption, hex: string | null): VariantOption {
  const next = { ...o };
  if (hex) next.swatch = hex.toLowerCase();
  else delete next.swatch;
  return next;
}
