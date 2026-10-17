"use client";
/**
 * Product options editor — colors, sizes or any choice the customer makes on the order form (an
 * item's `groups`: up to 4 — choice groups of up to 24 options, one combined option "color × size"
 * and up to 2 custom fields, docs/OFFERS.md §D.5). One component for the generate wizard's Details
 * step (density "comfortable"), the item cards and the builder's Product panel ("compact").
 *
 * Combined options (matrix.tsx) and custom fields (field-card.tsx) are offered by the preset bar
 * when the MATRIX / FIELDS editor features are on; a choice group can be merged with another into
 * one combined option (and split back) without losing photos, swatches, prices, codes or stock.
 * Merging and splitting rename rule keys: `onRekey` lets the caller move the offers' line rules.
 *
 * Controlled: `value` is the page's list and every edit calls `onChange(next, coalesce)` with a
 * schema-valid list. `coalesce` names a typing burst ("variant:<id>:name", "opt:<id>:label",
 * "opt:<id>:swatch") so the builder's undo history keeps one step per burst. A group starts to exist
 * when its first option is added; until then it is held here as "pending" (an empty group is not a
 * valid page value). Removing a group's last option turns it back into a pending group.
 *
 * Presets (color, size, shoe size, capacity, model, custom) name the group in the page's language
 * and offer quick-fill values; color names get their swatch from the dictionary
 * (src/lib/page/variant-presets.ts); "From your photos" proposes colors read from the photos'
 * palettes (and the on-device photo reading) — suggestions only, nothing is added without a click.
 * Option chips flow in the page's reading direction (RTL for Arabic), like on the order form.
 */
import { ArrowDown, ArrowUp, Box, CircleAlert, Combine, Droplet, Footprints, Grid3x3, Images, Palette, Plus, Ruler, SlidersHorizontal, Sparkles, TextCursorInput, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/admin/common/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { feature } from "@/lib/page/features";
import { dirOf, isChoiceGroup, isFieldGroup, isMatrixGroup, LIMITS, type AssetRef, type FieldGroup, type Locale, type MatrixGroup, type OptionGroup } from "@/lib/page/schema";
import {
  MAX_VARIANT_GROUPS,
  MAX_VARIANT_LABEL,
  VARIANT_PRESETS,
  cleanLabel,
  colorPalette,
  describedColorSuggestions,
  inferPreset,
  normalizeLabel,
  photoColorSuggestions,
  presetValues,
  unnamedGroup,
  variantIds,
  variantIssues,
  type ColorSuggestion,
  type VariantKind,
} from "@/lib/page/variant-presets";
import { cn } from "@/lib/utils";
import { FieldCard } from "./field-card";
import { CombinationsDialog, MatrixCard } from "./matrix";
import { mergeBlocker, mergeGroups, newField, splitBlocker, splitGroup, type Rekey } from "./matrix-model";
import { addOptions, isColorGroup, move, newGroup, removeAt, replaceAt, type AddResult, type VariantGroup, type VariantOption, type VariantPreset } from "./model";
import { OptionExtras } from "./option-extras";
import { Dot, OptionsField, type Density, type VariantPhoto } from "./options-field";
import { IconAction } from "./parts";

export type { VariantPhoto };

export interface VariantsEditorProps {
  value: readonly OptionGroup[];
  onChange: (next: OptionGroup[], coalesce?: string | null) => void;
  /** merge / split renamed these rule keys (offers' line rules follow) */
  onRekey?: (rekey: Rekey) => void;
  /** page currency (price differences) */
  currency?: string;
  /** offer "Combined" options (default true; order extras: false) */
  allowMatrix?: boolean;
  /** most groups (default 4) */
  maxGroups?: number;
  /** page language: group names, color names, reading direction */
  locale: Locale;
  /** the product's photos, linkable to options (first = main) */
  photos?: readonly VariantPhoto[];
  /** thumbnail of any other asset an option links to */
  photoUrl?: (id: string) => string | null;
  /** media-library picker (builder) */
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  /** hints from the photo reading: presets the product probably needs, colors it described */
  suggest?: { presets?: readonly VariantPreset[]; colors?: readonly string[] };
  density?: Density;
  className?: string;
}

const PRESET_UI: Readonly<Record<VariantPreset, { label: string; icon: ReactNode; placeholder: string }>> = {
  color: { label: "Color", icon: <Palette />, placeholder: "Type a color and press Enter" },
  size: { label: "Size", icon: <Ruler />, placeholder: "Type a size and press Enter" },
  shoe: { label: "Shoe size", icon: <Footprints />, placeholder: "Type a size, e.g. 38" },
  capacity: { label: "Capacity", icon: <Droplet />, placeholder: "Type a volume, e.g. 50 ml" },
  model: { label: "Model", icon: <Box />, placeholder: "Type a model and press Enter" },
  custom: { label: "Custom", icon: <SlidersHorizontal />, placeholder: "Type an option and press Enter" },
};

const KINDS: { value: VariantKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "swatch", label: "Swatches" },
  { value: "image", label: "Photos" },
];

interface Pending {
  group: VariantGroup;
  /** position in the list once it gets its first option */
  index: number;
  preset: VariantPreset;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function VariantsEditor({ value, onChange, onRekey, currency, allowMatrix = true, maxGroups = MAX_VARIANT_GROUPS, locale, photos = [], photoUrl, onPickPhoto, suggest, density = "comfortable", className }: VariantsEditorProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  /** group whose entry takes the focus when it mounts */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [creatingMatrix, setCreatingMatrix] = useState(false);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const dir = dirOf(locale);
  const compact = density === "compact";

  const urlOf = useCallback((id: string) => photos.find((p) => p.ref.id === id)?.url ?? photoUrl?.(id) ?? null, [photos, photoUrl]);
  const palette = useMemo(() => colorPalette(locale), [locale]);
  const issues = useMemo(() => variantIssues(value), [value]);

  /** colors read from the photos (and described by the photo reading), not yet in `labels` */
  const colorSuggestions = useCallback(
    (labels: readonly string[]): ColorSuggestion[] => {
      const fromPhotos = photoColorSuggestions(
        photos.map((p) => ({ id: p.ref.id, palette: p.palette ?? null })),
        locale,
        labels,
      );
      const seen = new Set(fromPhotos.map((s) => s.key));
      const described = describedColorSuggestions(suggest?.colors ?? [], locale, labels).filter((s) => !seen.has(s.key));
      return [...fromPhotos, ...described].slice(0, 6);
    },
    [photos, locale, suggest?.colors],
  );

  const items = useMemo(() => {
    const list = value.map((group, index) => ({ group, index, pending: false }));
    if (pending) list.splice(Math.min(pending.index, list.length), 0, { group: pending.group, index: -1, pending: true });
    return list;
  }, [value, pending]);

  const used = new Set<VariantPreset>([...value.filter(isChoiceGroup).map((g) => inferPreset(g)), ...(pending ? [pending.preset] : [])]);
  const room = value.length < maxGroups;
  const canMatrix = allowMatrix && feature("MATRIX") && room && !value.some(isMatrixGroup);
  const canField = feature("FIELDS") && room && value.filter(isFieldGroup).length < LIMITS.fieldsPerItem;
  const taken = useMemo(() => variantIds(value), [value]);

  const regroup = (res: { groups: OptionGroup[]; rekey: Rekey } | { error: string }, done: string) => {
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    onChange(res.groups);
    onRekey?.(res.rekey);
    toast.success(done);
  };

  const start = (preset: VariantPreset) => {
    if (!room) return;
    const group = newGroup(preset, locale, variantIds(value));
    setPending({ group, index: value.length, preset });
    setFocusId(group.id);
  };

  /** Add labels to a group (committing a pending one); returns what happened. */
  const add = (target: { index: number; pending: boolean }, labels: string[], extra?: (label: string) => Partial<Pick<VariantOption, "swatch" | "image">>): AddResult | null => {
    const at = target.pending ? pending?.group : value[target.index];
    if (!at || !isChoiceGroup(at)) return null;
    const current: VariantGroup = at;
    const preset = target.pending ? pending!.preset : inferPreset(current);
    const res = addOptions(current, labels, { locale, preset, taken: variantIds(value) }, extra);
    if (!res.added.length) return res;
    if (target.pending) {
      const group = { ...res.group, name: cleanLabel(res.group.name) || unnamedGroup(locale) };
      const next = [...value];
      next.splice(Math.min(pending!.index, next.length), 0, group);
      setPending(null);
      onChange(next);
    } else onChange(replaceAt(value, target.index, res.group));
    return res;
  };

  /** Remove options; a group left empty goes back to being set up (it stays on screen). */
  const removeOptions = (gi: number, keep: (o: VariantOption, i: number) => boolean) => {
    const g = value[gi];
    if (!g || !isChoiceGroup(g)) return;
    const options = g.options.filter(keep);
    if (options.length === g.options.length) return;
    if (options.length) {
      onChange(replaceAt(value, gi, { ...g, options }));
      return;
    }
    setPending({ group: { ...g, options: [] }, index: gi, preset: inferPreset(g) });
    onChange(removeAt(value, gi));
  };

  const removeGroup = (gi: number) => {
    const g = value[gi];
    if (!g) return;
    onChange(removeAt(value, gi));
    const n = isChoiceGroup(g) ? g.options.length : isMatrixGroup(g) ? g.dims.reduce((x, d) => x * d.values.length, 1) : 0;
    toast(`“${g.name}” removed`, {
      description: isFieldGroup(g) ? "Custom field" : `${n} ${isMatrixGroup(g) ? "combination" : "option"}${n === 1 ? "" : "s"}`,
      action: {
        label: "Undo",
        onClick: () => {
          const cur = latest.current;
          if (cur.length >= maxGroups || cur.some((x) => x.id === g.id)) return;
          const next = [...cur];
          next.splice(Math.min(gi, next.length), 0, g);
          onChange(next);
        },
      },
    });
  };

  return (
    <div className={cn("grid", compact ? "gap-2.5" : "gap-3", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((it) => {
          const any = it.group;
          const motionProps = {
            layout: "position" as const,
            initial: { opacity: 0, y: 8, scale: 0.985 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, scale: 0.98, transition: { duration: 0.16 } },
            transition: { duration: 0.32, ease: EASE },
          };
          const groupIssues = it.pending ? [] : issues.filter((x) => x.groupId === any.id);
          if (isMatrixGroup(any)) {
            return (
              <motion.div key={any.id} {...motionProps}>
                <MatrixCard
                  group={any}
                  density={density}
                  locale={locale}
                  dir={dir}
                  currency={currency}
                  photos={photos}
                  photoUrl={urlOf}
                  onPickPhoto={onPickPhoto}
                  position={it.index}
                  count={value.length}
                  taken={taken}
                  issues={groupIssues}
                  onChange={(next, coalesce) => onChange(replaceAt(value, it.index, next), coalesce)}
                  onMove={(by) => onChange(move(value, it.index, it.index + by))}
                  onRemove={() => removeGroup(it.index)}
                  splitBlocker={splitBlocker(any, value)}
                  onSplit={() => regroup(splitGroup(value, any.id), "Split into separate options")}
                />
              </motion.div>
            );
          }
          if (isFieldGroup(any)) {
            return (
              <motion.div key={any.id} {...motionProps}>
                <FieldCard
                  group={any}
                  density={density}
                  currency={currency}
                  position={it.index}
                  count={value.length}
                  issues={groupIssues}
                  onPatch={(patch, coalesce) => onChange(replaceAt(value, it.index, { ...any, ...patch } as FieldGroup), coalesce)}
                  onMove={(by) => onChange(move(value, it.index, it.index + by))}
                  onRemove={() => removeGroup(it.index)}
                />
              </motion.div>
            );
          }
          const g = any as VariantGroup;
          const preset = it.pending ? pending!.preset : inferPreset(g);
          const colorGroup = preset === "color" || isColorGroup(g);
          const partners = it.pending || !feature("MATRIX") || !allowMatrix ? [] : value.filter((x): x is VariantGroup => isChoiceGroup(x) && x.id !== g.id);
          return (
            <motion.div
              key={g.id}
              layout="position"
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.16 } }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <GroupCard
                group={g}
                pending={it.pending}
                preset={preset}
                colorGroup={colorGroup}
                position={it.pending ? -1 : it.index}
                count={value.length}
                locale={locale}
                dir={dir}
                density={density}
                photos={photos}
                photoUrl={urlOf}
                onPickPhoto={onPickPhoto}
                palette={palette}
                suggestions={colorGroup ? colorSuggestions(g.options.map((o) => o.label)) : []}
                issues={groupIssues}
                currency={currency}
                merge={partners.map((x) => ({ group: x, blocker: mergeBlocker(g, x, value) }))}
                onMerge={(otherId) => regroup(mergeGroups(value, g.id, otherId, locale), "Merged into one combined option")}
                autoFocus={focusId === g.id}
                onFocused={() => setFocusId(null)}
                onAdd={(labels, extra) => add(it, labels, extra)}
                onUpdate={(oi, option, coalesce) => {
                  if (!it.pending) onChange(replaceAt(value, it.index, { ...g, options: replaceAt(g.options, oi, option) }), coalesce);
                }}
                onRemoveOption={(oi) => removeOptions(it.index, (_, i) => i !== oi)}
                onClearPreset={() => {
                  const values = new Set(presetValues(preset, locale).map(normalizeLabel));
                  removeOptions(it.index, (o) => !values.has(normalizeLabel(o.label)));
                }}
                onMoveOption={(from, to) => {
                  if (!it.pending) onChange(replaceAt(value, it.index, { ...g, options: move(g.options, from, to) }));
                }}
                onPatch={(patch, coalesce) => {
                  if (it.pending) setPending((p) => (p ? { ...p, group: { ...p.group, ...patch } } : p));
                  else onChange(replaceAt(value, it.index, { ...g, ...patch } as VariantGroup), coalesce);
                }}
                onMoveGroup={(by) => onChange(move(value, it.index, it.index + by))}
                onRemoveGroup={() => (it.pending ? setPending(null) : removeGroup(it.index))}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      <PresetBar
        empty={!value.length && !pending}
        room={room}
        used={used}
        suggested={suggest?.presets ?? []}
        colorDots={used.has("color") ? [] : colorSuggestions([]).slice(0, 3).map((s) => s.hex)}
        density={density}
        onPick={start}
        max={maxGroups}
        onMatrix={canMatrix ? () => setCreatingMatrix(true) : undefined}
        onField={canField ? () => onChange([...value, newField(locale, taken)]) : undefined}
      />
      {canMatrix || creatingMatrix ? (
        <CombinationsDialog
          open={creatingMatrix}
          onOpenChange={setCreatingMatrix}
          mode={{ kind: "create", onCreate: (g: MatrixGroup) => onChange([...latest.current, g].slice(0, maxGroups)) }}
          locale={locale}
          dir={dir}
          currency={currency}
          photos={photos}
          photoUrl={urlOf}
          onPickPhoto={onPickPhoto}
          taken={taken}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* preset bar                                                          */
/* ------------------------------------------------------------------ */

function PresetBar({
  empty,
  room,
  used,
  suggested,
  colorDots,
  density,
  onPick,
  onMatrix,
  onField,
  max,
}: {
  empty: boolean;
  room: boolean;
  used: ReadonlySet<VariantPreset>;
  suggested: readonly VariantPreset[];
  colorDots: readonly string[];
  density: Density;
  onPick: (p: VariantPreset) => void;
  onMatrix?: () => void;
  onField?: () => void;
  max: number;
}) {
  const compact = density === "compact";
  if (!room) {
    return <p className="text-[11.5px] text-muted-foreground">{max} options — the most there can be here.</p>;
  }
  const special = cn(
    "inline-flex items-center rounded-full border border-dashed border-foreground/[0.18] bg-background font-medium text-foreground/85 outline-none transition-[border-color,background-color,color] hover:border-brand/45 hover:bg-brand-soft/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:translate-y-px dark:bg-foreground/[0.04] [&_svg]:text-brand",
    compact ? "h-7 gap-1.5 px-2.5 text-[12px] [&_svg]:size-3.5" : "h-9 gap-2 px-3.5 text-[13px] [&_svg]:size-4",
  );
  // color, sizes and capacity are one group each; models and custom groups can repeat
  const presets = VARIANT_PRESETS.filter((p) => p === "custom" || p === "model" || !used.has(p));
  return (
    <div className="grid gap-2">
      {!empty ? <p className="text-[11.5px] font-medium text-muted-foreground">Add another option</p> : null}
      <div role="group" aria-label="Add an option group" className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
        {presets.map((p) => {
          const ui = PRESET_UI[p];
          const hint = suggested.includes(p);
          const dots = p === "color" ? colorDots : [];
          const chip = (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className={cn(
                "group/preset relative inline-flex items-center rounded-full bg-background font-medium text-foreground/85 shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-foreground/[0.1] outline-none transition-[box-shadow,background-color,color] hover:bg-foreground/[0.025] hover:text-foreground hover:ring-foreground/20 focus-visible:ring-2 focus-visible:ring-ring/60 active:translate-y-px dark:bg-foreground/[0.05]",
                hint && "ring-brand/35",
                compact ? "h-7 gap-1.5 px-2.5 text-[12px] [&_svg]:size-3.5" : "h-9 gap-2 px-3.5 text-[13px] [&_svg]:size-4",
              )}
            >
              <span className={cn("text-muted-foreground transition-colors group-hover/preset:text-brand", hint && "text-brand")}>{p === "custom" ? <Plus /> : PRESET_UI[p].icon}</span>
              {ui.label}
              {dots.length ? (
                <span className="flex items-center -space-x-1 ps-0.5" aria-hidden="true">
                  {dots.map((h, i) => (
                    <Dot key={`${h}-${i}`} hex={h} size="xs" className="ring-[1.5px] ring-background" />
                  ))}
                </span>
              ) : null}
              {hint ? <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" /> : null}
            </button>
          );
          return hint || dots.length ? (
            <Tooltip key={p}>
              <TooltipTrigger asChild>{chip}</TooltipTrigger>
              <TooltipContent className="max-w-[16rem] text-pretty">
                {dots.length ? "Colors read from your photos are offered next — nothing is added until you pick." : "Suggested for this kind of product."}
              </TooltipContent>
            </Tooltip>
          ) : (
            chip
          );
        })}
        {onMatrix ? (
          <button type="button" onClick={onMatrix} className={special}>
            <Grid3x3 />
            Combined (e.g. color × size)
          </button>
        ) : null}
        {onField ? (
          <button type="button" onClick={onField} className={special}>
            <TextCursorInput />
            Custom field
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* group card                                                          */
/* ------------------------------------------------------------------ */

interface GroupCardProps {
  group: VariantGroup;
  pending: boolean;
  preset: VariantPreset;
  colorGroup: boolean;
  /** index in the list (-1 while pending) */
  position: number;
  count: number;
  locale: Locale;
  dir: "ltr" | "rtl";
  density: Density;
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  palette: ReturnType<typeof colorPalette>;
  suggestions: readonly ColorSuggestion[];
  issues: ReturnType<typeof variantIssues>;
  currency?: string;
  /** other choice groups this one can merge with (blocker = why not) */
  merge: { group: VariantGroup; blocker: string | null }[];
  onMerge: (otherId: string) => void;
  autoFocus: boolean;
  onFocused: () => void;
  onAdd: (labels: string[], extra?: (label: string) => Partial<Pick<VariantOption, "swatch" | "image">>) => AddResult | null;
  onUpdate: (index: number, option: VariantOption, coalesce?: string | null) => void;
  onRemoveOption: (index: number) => void;
  onClearPreset: () => void;
  onMoveOption: (from: number, to: number) => void;
  onPatch: (patch: Partial<Pick<VariantGroup, "name" | "kind" | "perUnit">>, coalesce?: string | null) => void;
  onMoveGroup: (by: number) => void;
  onRemoveGroup: () => void;
}

function GroupCard(p: GroupCardProps) {
  const { group: g, pending, preset, dir, density, colorGroup, locale } = p;
  const compact = density === "compact";
  const ids = { name: useId(), unit: useId() };
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ids: string[]; n: number }>({ ids: [], n: 0 });
  const [moreColors, setMoreColors] = useState(false);
  const ui = PRESET_UI[preset];

  const { autoFocus, onFocused } = p;
  useEffect(() => {
    if (!autoFocus) return;
    // a custom group is named first; the others go straight to their options
    if (preset === "custom" && !g.name) nameRef.current?.focus();
    else inputRef.current?.focus();
    onFocused();
  }, [autoFocus, onFocused, preset, g.name]);

  const nameRaw = nameDraft ?? g.name;
  const nameClean = cleanLabel(nameRaw);
  const nameError = nameDraft !== null && !nameClean && !pending ? "Name this group — customers see it above the choices." : null;

  const labels = new Set(g.options.map((o) => normalizeLabel(o.label)));
  const values = presetValues(preset, locale);
  const remaining = values.filter((v) => !labels.has(normalizeLabel(v)));
  const presentValues = values.length - remaining.length;
  const paletteLeft = colorGroup ? p.palette.filter((c) => !labels.has(normalizeLabel(c.label))) : [];
  const photoRef = (id: string | undefined) => (id ? p.photos.find((x) => x.ref.id === id)?.ref : undefined);

  const add = (list: string[], extra?: (label: string) => Partial<Pick<VariantOption, "swatch" | "image">>): string | null => {
    const res = p.onAdd(list, extra);
    if (!res) return null;
    if (res.repeated.length) setFlash((f) => ({ ids: res.repeated, n: f.n + 1 }));
    if (res.full) return "24 options is the maximum — the rest wasn't added.";
    if (res.repeated.length && !res.added.length) {
      const o = g.options.find((x) => x.id === res.repeated[0]);
      return o ? `“${o.label}” is already in the list.` : null;
    }
    return null;
  };

  const allPhotos = g.options.length >= 2 && g.options.every((o) => !!o.image) && g.kind !== "image";

  return (
    <section
      aria-label={g.name || ui.label}
      className={cn(
        "@container/vg grid min-w-0 rounded-2xl bg-background ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-18px_rgb(0_0_0/0.18)] dark:bg-foreground/[0.03]",
        compact ? "gap-2.5 p-3" : "gap-3.5 p-4",
        pending && "ring-brand/30",
      )}
    >
      {/* header: icon, name, display, order, remove */}
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5")}>
        <span className={cn("grid shrink-0 place-items-center rounded-lg bg-brand-soft text-brand", compact ? "size-7 [&_svg]:size-3.5" : "size-9 [&_svg]:size-[1.05rem]")}>{ui.icon}</span>
        <div className="grid min-w-0 flex-1">
          <label htmlFor={ids.name} className="sr-only">
            Group name (shown on the page)
          </label>
          <Input
            ref={nameRef}
            id={ids.name}
            dir="auto"
            value={nameRaw}
            maxLength={MAX_VARIANT_LABEL}
            placeholder={preset === "custom" ? "Name it, e.g. Material" : ui.label}
            aria-invalid={!!nameError || undefined}
            onChange={(e) => {
              const v = e.target.value;
              setNameDraft(v);
              const c = cleanLabel(v);
              if (pending) p.onPatch({ name: c });
              else if (c && c !== g.name) p.onPatch({ name: c }, `variant:${g.id}:name`);
            }}
            onBlur={() => setNameDraft(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                inputRef.current?.focus();
              }
            }}
            className={cn(
              "border-transparent bg-transparent font-semibold tracking-[-0.01em] shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent",
              compact ? "h-8 px-2 text-[13px]" : "h-9 px-2.5 text-[15px]",
            )}
          />
        </div>
        {/* "Shown as" sits in the header when the card is wide enough, else on its own row below */}
        {!compact ? (
          <div className="hidden shrink-0 @min-[34rem]/vg:block">
            <Segmented<VariantKind> size="sm" label="Shown as" value={g.kind} onChange={(kind) => p.onPatch({ kind })} options={KINDS} />
          </div>
        ) : null}
        <div className="flex shrink-0 items-center">
          {!pending ? (
            <>
              <IconAction label="Move up" disabled={p.position <= 0} onClick={() => p.onMoveGroup(-1)} compact={compact}>
                <ArrowUp />
              </IconAction>
              <IconAction label="Move down" disabled={p.position >= p.count - 1} onClick={() => p.onMoveGroup(1)} compact={compact}>
                <ArrowDown />
              </IconAction>
              {p.merge.length ? <MergeMenu group={g} merge={p.merge} onMerge={p.onMerge} compact={compact} /> : null}
              <IconAction label={`Remove ${g.name || "group"}`} onClick={p.onRemoveGroup} compact={compact} danger>
                <Trash2 />
              </IconAction>
            </>
          ) : (
            <IconAction label="Cancel" onClick={p.onRemoveGroup} compact={compact}>
              <X />
            </IconAction>
          )}
        </div>
      </div>
      {nameError ? (
        <p role="alert" className="-mt-1.5 text-[11.5px] font-medium text-destructive">
          {nameError}
        </p>
      ) : null}
      <div className={cn("flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5", !compact && "@min-[34rem]/vg:hidden")}>
        <span className="text-[11.5px] whitespace-nowrap text-muted-foreground">Shown as</span>
        <Segmented<VariantKind> size="sm" label="Shown as" value={g.kind} onChange={(kind) => p.onPatch({ kind })} options={KINDS} />
      </div>

      <OptionsField
        group={g}
        dir={dir}
        colorGroup={colorGroup}
        density={density}
        placeholder={ui.placeholder}
        photos={p.photos}
        photoUrl={p.photoUrl}
        onPickPhoto={p.onPickPhoto}
        swatches={p.palette}
        flash={flash}
        inputRef={inputRef}
        onAdd={(list) => add(list)}
        onUpdate={p.onUpdate}
        onRemove={p.onRemoveOption}
        onMove={p.onMoveOption}
        onEscape={pending ? p.onRemoveGroup : undefined}
      />

      {p.issues.length || allPhotos ? (
        <ul className="-mt-1 grid gap-1">
          {p.issues.map((x, i) => (
            <li key={i} className={cn("flex items-start gap-1.5 text-[11.5px] leading-snug", x.level === "error" ? "font-medium text-destructive" : "text-warn-ink")}>
              <CircleAlert className="mt-px size-3.5 shrink-0" />
              <span className="min-w-0 text-pretty">{x.message}</span>
            </li>
          ))}
          {allPhotos ? (
            <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-snug text-muted-foreground">
              <Images className="size-3.5 shrink-0 text-brand" />
              Every option has a photo.
              <button type="button" onClick={() => p.onPatch({ kind: "image" })} className="rounded-md font-medium text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50">
                Show them as photos
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* suggestions: quick-fill values, colors from the photos, common colors */}
      {remaining.length || presentValues ? (
        <SuggestRow
          label="Quick add"
          dir={dir}
          actions={
            <>
              {remaining.length > 1 ? <RowAction onClick={() => add(remaining)}>Add all</RowAction> : null}
              {presentValues ? <RowAction onClick={p.onClearPreset}>Clear</RowAction> : null}
            </>
          }
        >
          {remaining.length ? (
            remaining.map((v) => (
              <Ghost key={v} onClick={() => add([v])} compact={compact}>
                {v}
              </Ghost>
            ))
          ) : (
            <span className="text-[11.5px] text-muted-foreground" dir="ltr">
              Every standard value is in.
            </span>
          )}
        </SuggestRow>
      ) : null}
      {colorGroup && p.suggestions.length ? (
        <SuggestRow label="From your photos" icon={<Sparkles />} dir={dir}>
          {p.suggestions.map((s) => {
            const ref = photoRef(s.photoId);
            const thumb = s.photoId ? p.photoUrl(s.photoId) : null;
            return (
              <Ghost
                key={s.key}
                compact={compact}
                swatch={s.hex}
                thumb={thumb}
                title={s.source === "ai" ? "Described by the photo reading" : ref ? "Read from this photo — the option links to it" : undefined}
                onClick={() => add([s.label], () => ({ swatch: s.hex, ...(ref ? { image: { ...ref, alt: s.label } } : {}) }))}
              >
                {s.label}
              </Ghost>
            );
          })}
        </SuggestRow>
      ) : null}
      {colorGroup && paletteLeft.length && g.options.length < 24 ? (
        <SuggestRow
          label="Common colors"
          dir={dir}
          actions={paletteLeft.length > 10 ? <RowAction onClick={() => setMoreColors((m) => !m)}>{moreColors ? "Fewer" : `${paletteLeft.length - 10} more`}</RowAction> : null}
        >
          {(moreColors ? paletteLeft : paletteLeft.slice(0, 10)).map((c) => (
            <Ghost key={c.key} compact={compact} swatch={c.hex} onClick={() => add([c.label])}>
              {c.label}
            </Ghost>
          ))}
        </SuggestRow>
      ) : null}

      {!pending && g.options.length ? <OptionExtras options={g.options} groupId={g.id} dir={dir} currency={p.currency} onChange={(i, o, coalesce) => p.onUpdate(i, o, coalesce)} /> : null}

      {/* per unit */}
      <div className={cn("flex items-start justify-between gap-3 border-t border-foreground/[0.06]", compact ? "pt-2.5" : "pt-3")}>
        <label htmlFor={ids.unit} className="flex min-w-0 cursor-pointer items-start gap-2.5">
          <Switch id={ids.unit} size="sm" checked={g.perUnit} onCheckedChange={(v) => p.onPatch({ perUnit: v })} className="mt-[3px]" />
          <span className="grid min-w-0 gap-0.5">
            <span className={cn("font-medium", compact ? "text-[12px]" : "text-[12.5px]")}>Choose per piece in packs</span>
            <span className="text-[11.5px] leading-snug text-pretty text-muted-foreground">
              {g.perUnit ? "A pack of 2 asks for a choice for each piece." : "One choice for the whole order, whatever the pack."}
            </span>
          </span>
        </label>
        <span className="shrink-0 pt-px text-[11px] text-muted-foreground tabular-nums">{g.options.length}/24</span>
      </div>
    </section>
  );
}

function MergeMenu({ group, merge, onMerge, compact }: { group: VariantGroup; merge: { group: VariantGroup; blocker: string | null }[]; onMerge: (id: string) => void; compact: boolean }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size={compact ? "icon-xs" : "icon-sm"} aria-label="Merge into one combined option" className="text-muted-foreground">
              <Combine />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Merge into one combined option</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[11.5px] leading-snug font-normal text-muted-foreground">
          Combine <bdi className="font-medium text-foreground">{group.name}</bdi> with… every pair becomes one choice; photos, prices, codes and stock are kept.
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {merge.map((m) => (
          <DropdownMenuItem key={m.group.id} disabled={!!m.blocker} onSelect={() => onMerge(m.group.id)} className="grid items-start gap-0.5">
            <span className="inline-flex items-center gap-2 font-medium">
              <Grid3x3 />
              <bdi>
                {group.name} × {m.group.name}
              </bdi>
            </span>
            {m.blocker ? <span className="ps-6 text-[11px] leading-snug text-muted-foreground">{m.blocker}</span> : <span className="ps-6 text-[11px] text-muted-foreground tabular-nums">{group.options.length * m.group.options.length} combinations</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SuggestRow({ label, icon, actions, dir, children }: { label: string; icon?: ReactNode; actions?: ReactNode; dir: "ltr" | "rtl"; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-brand">
          {icon}
          {label}
        </span>
        {actions ? <span className="flex items-center gap-1">{actions}</span> : null}
      </div>
      <div dir={dir} className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}

function RowAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
      {children}
    </button>
  );
}

function Ghost({ onClick, swatch, thumb, title, compact, children }: { onClick: () => void; swatch?: string; thumb?: string | null; title?: string; compact: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/[0.2] text-muted-foreground outline-none transition-[border-color,background-color,color] hover:border-brand/50 hover:bg-brand-soft/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:translate-y-px",
        compact ? "h-6.5 ps-1.5 pe-2 text-[11.5px]" : "h-7 ps-2 pe-2.5 text-[12.5px]",
      )}
    >
      <Plus className="size-3 shrink-0" />
      {swatch ? <Dot hex={swatch} size="xs" /> : null}
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
        <img src={thumb} alt="" draggable={false} className="-ms-1 size-4 rounded-full object-cover ring-[1.5px] ring-background" />
      ) : null}
      <bdi className="truncate">{children}</bdi>
    </button>
  );
}
