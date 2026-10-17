"use client";
/**
 * Combined options ("Couleur × Taille", docs/OFFERS.md §D.1, §D.5): the card in the options list
 * (summary, state map, display linked / combined, per piece) and the wide combinations dialog —
 * dimensions with their values on one side, the grid on the other (rows = dimension 1, columns =
 * dimension 2, one tab per value of dimension 3), cell states in stock / out of stock / not made,
 * a cell inspector for photo, price difference and SKU, row / column bulk actions.
 *
 * Every combination exists by construction; only exceptions are stored (matrix-model.ts). The
 * dialog also creates a combined option (dimension presets with quick-fill values).
 *
 * Keyboard: the grid is one tab stop (arrow keys move, Home / End, Space cycles the state of the
 * focused cell, which the inspector follows).
 */
import { Ban, Check, Grid3x3, ImageOff, MoreHorizontal, Plus, Trash2, Ungroup, X, ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { feature } from "@/lib/page/features";
import { cellKey, type Combo } from "@/lib/page/options";
import { CHOICE_KINDS, MATRIX_MAX_COMBINATIONS, type AssetRef, type CellState, type ChoiceKind, type Locale, type MatrixDim, type MatrixGroup } from "@/lib/page/schema";
import { cleanLabel, colorPalette, VARIANT_PRESETS, type VariantPreset } from "@/lib/page/variant-presets";
import { cn } from "@/lib/utils";
import { addDim, autoDisplay, cellOf, combinations, comboState, matrixFromDrafts, matrixStats, newDimDraft, patchCombos, removeDim, withDim, type CellPatch, type DimDraft } from "./matrix-model";
import { addOptions, isColorGroup, type VariantGroup } from "./model";
import { Dot, OptionsField, type Density, type VariantPhoto } from "./options-field";
import { OptionExtras } from "./option-extras";
import { DraftInput, IconAction, MoneyInput } from "./parts";

const KINDS: { value: ChoiceKind; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "swatch", label: "Swatches" },
  { value: "image", label: "Photos" },
];

const PRESET_LABEL: Record<VariantPreset, string> = { color: "Color", size: "Size", shoe: "Shoe size", capacity: "Capacity", model: "Model", custom: "Custom" };

const STATE_UI: Record<CellState, { label: string; short: string }> = {
  in: { label: "In stock", short: "In" },
  out: { label: "Out of stock", short: "Out" },
  none: { label: "Not made", short: "—" },
};

const NEXT_STATE: Record<CellState, CellState> = { in: "out", out: "none", none: "in" };

/** A dimension seen as a choice group, so the shared tag field edits its values. */
const asGroup = (d: Pick<MatrixDim, "id" | "name" | "kind" | "values">): VariantGroup => ({ id: d.id, name: d.name, kind: d.kind, perUnit: true, display: "auto", options: d.values });

/* ------------------------------------------------------------------ */
/* card                                                                */
/* ------------------------------------------------------------------ */

export interface MatrixCardProps {
  group: MatrixGroup;
  density: Density;
  locale: Locale;
  dir: "ltr" | "rtl";
  currency?: string;
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  position: number;
  count: number;
  /** ids used anywhere on the item (new value ids avoid them) */
  taken: readonly string[];
  issues: readonly { level: "error" | "warn"; message: string }[];
  onChange: (next: MatrixGroup, coalesce?: string | null) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
  /** split back into separate options (null: allowed; string: why not) */
  splitBlocker: string | null;
  onSplit: () => void;
}

export function MatrixCard(p: MatrixCardProps) {
  const { group: g, density } = p;
  const compact = density === "compact";
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => matrixStats(g), [g]);
  const unitId = useId();
  const auto = autoDisplay(g);
  return (
    <section
      aria-label={g.name}
      className={cn(
        "grid min-w-0 rounded-2xl bg-background ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-18px_rgb(0_0_0/0.18)] dark:bg-foreground/[0.03]",
        compact ? "gap-2.5 p-3" : "gap-3.5 p-4",
      )}
    >
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5")}>
        <span className={cn("grid shrink-0 place-items-center rounded-lg bg-brand-soft text-brand", compact ? "size-7 [&_svg]:size-3.5" : "size-9 [&_svg]:size-[1.05rem]")}>
          <Grid3x3 />
        </span>
        <DraftInput
          dir="auto"
          value={g.name}
          maxLength={40}
          aria-label="Combined option name (shown on the page)"
          clean={(raw) => cleanLabel(raw) || null}
          onCommit={(name) => p.onChange({ ...g, name }, `variant:${g.id}:name`)}
          className={cn(
            "min-w-0 flex-1 border-transparent bg-transparent font-semibold tracking-[-0.01em] shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent",
            compact ? "h-8 px-2 text-[13px]" : "h-9 px-2.5 text-[15px]",
          )}
        />
        <div className="flex shrink-0 items-center">
          <IconAction label={p.splitBlocker ? `Can't split: ${p.splitBlocker}` : "Split into separate options"} onClick={p.onSplit} disabled={!!p.splitBlocker} compact={compact}>
            <Ungroup />
          </IconAction>
          <IconAction label="Move up" disabled={p.position <= 0} onClick={() => p.onMove(-1)} compact={compact}>
            <ArrowUp />
          </IconAction>
          <IconAction label="Move down" disabled={p.position >= p.count - 1} onClick={() => p.onMove(1)} compact={compact}>
            <ArrowDown />
          </IconAction>
          <IconAction label={`Remove ${g.name}`} onClick={p.onRemove} compact={compact} danger>
            <Trash2 />
          </IconAction>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group/sum grid gap-2.5 rounded-xl bg-foreground/[0.025] p-3 text-start ring-1 ring-inset ring-foreground/[0.05] outline-none transition-[background-color,box-shadow] hover:bg-foreground/[0.04] hover:ring-brand/30 focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="grid min-w-0 gap-0.5">
            <span className="text-[12.5px] font-medium text-foreground" dir="auto">
              {g.dims.map((d) => `${d.name} ${d.values.length}`).join(" × ")}
            </span>
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {stats.combos} combinations
              {stats.out ? <span className="text-warn-ink"> · {stats.out} out of stock</span> : null}
              {stats.none ? <span> · {stats.none} not made</span> : null}
              {stats.custom ? <span> · {stats.custom} own photo / price</span> : null}
            </span>
          </span>
          <StateMap group={g} />
        </span>
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand">
          <Grid3x3 className="size-3.5" />
          Edit combinations
        </span>
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-[11.5px] text-muted-foreground">On the order form</span>
        <Segmented<MatrixGroup["display"]>
          size="sm"
          label="Shown as"
          value={g.display}
          onChange={(display) => p.onChange({ ...g, display })}
          options={[
            { value: "auto", label: `Auto · ${auto === "combined" ? "one list" : "linked"}` },
            { value: "linked", label: "One per dimension" },
            { value: "combined", label: "One list" },
          ]}
        />
      </div>

      {p.issues.length ? (
        <ul className="-mt-1 grid gap-1">
          {p.issues.map((x, i) => (
            <li key={i} className={cn("text-[11.5px] leading-snug", x.level === "error" ? "font-medium text-destructive" : "text-warn-ink")}>
              {x.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={cn("flex items-start justify-between gap-3 border-t border-foreground/[0.06]", compact ? "pt-2.5" : "pt-3")}>
        <label htmlFor={unitId} className="flex min-w-0 cursor-pointer items-start gap-2.5">
          <Switch id={unitId} size="sm" checked={g.perUnit} onCheckedChange={(perUnit) => p.onChange({ ...g, perUnit })} className="mt-[3px]" />
          <span className="grid min-w-0 gap-0.5">
            <span className={cn("font-medium", compact ? "text-[12px]" : "text-[12.5px]")}>Choose per piece in packs</span>
            <span className="text-[11.5px] leading-snug text-pretty text-muted-foreground">{g.perUnit ? "A pack of 2 asks for a combination for each piece." : "One combination for the whole order."}</span>
          </span>
        </label>
      </div>

      <CombinationsDialog
        open={open}
        onOpenChange={setOpen}
        mode={{ kind: "edit", group: g, onChange: p.onChange }}
        locale={p.locale}
        dir={p.dir}
        currency={p.currency}
        photos={p.photos}
        photoUrl={p.photoUrl}
        onPickPhoto={p.onPickPhoto}
        taken={p.taken}
      />
    </section>
  );
}

/** A tiny map of the first two dimensions (dim 3 folded: a cell is out when every layer is). */
function StateMap({ group: g }: { group: MatrixGroup }) {
  const [a, b, c] = g.dims;
  if (!a || !b) return null;
  const rows = a.values.slice(0, 8);
  const cols = b.values.slice(0, 10);
  const layers = c ? c.values : [null];
  return (
    <span aria-hidden="true" className="grid shrink-0 gap-[2px]" style={{ gridTemplateColumns: `repeat(${cols.length}, 0.5rem)` }}>
      {rows.flatMap((r) =>
        cols.map((col) => {
          const states = layers.map((l) => comboState(g, { [a.id]: r.id, [b.id]: col.id, ...(l && c ? { [c.id]: l.id } : {}) }));
          const s: CellState = states.every((x) => x === "none") ? "none" : states.every((x) => x !== "in") ? "out" : "in";
          return <span key={`${r.id}:${col.id}`} className={cn("size-2 rounded-[2px]", s === "in" ? "bg-brand/55" : s === "out" ? "bg-warn/70" : "ring-1 ring-inset ring-foreground/20")} />;
        }),
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* dialog                                                              */
/* ------------------------------------------------------------------ */

type Mode = { kind: "edit"; group: MatrixGroup; onChange: (next: MatrixGroup, coalesce?: string | null) => void } | { kind: "create"; onCreate: (group: MatrixGroup) => void };

export interface CombinationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  locale: Locale;
  dir: "ltr" | "rtl";
  currency?: string;
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  taken: readonly string[];
}

export function CombinationsDialog(p: CombinationsDialogProps) {
  const editing = p.mode.kind === "edit" ? p.mode.group : null;
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,68rem)] max-w-none! flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="shrink-0 gap-1 border-b border-border/70 px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2 pe-8 text-[15px]">
            <Grid3x3 className="size-4 text-brand" />
            {editing ? (
              <>
                Combinations <span className="text-muted-foreground">·</span> <bdi dir="auto">{editing.name}</bdi>
              </>
            ) : (
              "New combined option"
            )}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {editing
              ? "Every combination exists and is in stock unless you mark it here. Out of stock is shown struck “épuisé”; not made is never offered."
              : "Combine 2 or 3 dimensions (e.g. color × size) into one choice. Mark the exceptions afterwards."}
          </DialogDescription>
        </DialogHeader>
        {p.open ? editing && p.mode.kind === "edit" ? <EditBody {...p} group={editing} onChange={p.mode.onChange} /> : p.mode.kind === "create" ? <CreateBody {...p} onCreate={p.mode.onCreate} /> : null : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---- create ---- */

function CreateBody(p: CombinationsDialogProps & { onCreate: (g: MatrixGroup) => void }) {
  // ids handed out in this dialog (a mutable pool kept for its lifetime)
  const [taken] = useState<string[]>(() => [...p.taken]);
  const [drafts, setDrafts] = useState<DimDraft[]>(() => [newDimDraft("color", p.locale, taken), newDimDraft("size", p.locale, taken)]);
  const n = combinations(drafts);
  const result = matrixFromDrafts(drafts, { locale: p.locale, taken });
  const why = !drafts.every((d) => cleanLabel(d.name)) ? "Name every dimension." : !drafts.every((d) => d.values.length) ? "Every dimension needs at least one value." : n > MATRIX_MAX_COMBINATIONS ? `${n} combinations: at most ${MATRIX_MAX_COMBINATIONS}.` : null;
  return (
    <>
      <div className="adm-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
        {drafts.map((d, i) => (
          <DimEditor
            key={i}
            index={i}
            dim={{ id: `draft-${i}`, name: d.name, kind: d.kind, values: d.values }}
            preset={d.preset}
            locale={p.locale}
            dir={p.dir}
            photos={p.photos}
            photoUrl={p.photoUrl}
            onPickPhoto={p.onPickPhoto}
            taken={taken}
            currency={p.currency}
            onPreset={(preset) => setDrafts((list) => list.map((x, j) => (j === i ? newDimDraft(preset, p.locale, taken) : x)))}
            onChange={(dim) => setDrafts((list) => list.map((x, j) => (j === i ? { ...x, name: dim.name, kind: dim.kind, values: dim.values } : x)))}
            onRemove={drafts.length > 2 ? () => setDrafts((list) => list.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        {drafts.length < 3 ? (
          <button
            type="button"
            onClick={() => setDrafts((list) => [...list, newDimDraft("custom", p.locale, taken)])}
            className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-foreground/15 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors hover:border-brand/45 hover:bg-brand-soft/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="size-4" />
              Add a third dimension
            </span>
          </button>
        ) : null}
      </div>
      <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-between gap-2 rounded-none border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
        <span className={cn("text-[12px] tabular-nums", why ? "text-destructive" : "text-muted-foreground")}>{why ?? `${n} combinations`}</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => p.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full px-4"
            disabled={!result}
            onClick={() => {
              if (!result) return;
              p.onCreate(result);
              p.onOpenChange(false);
            }}
          >
            Create combined option
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

/* ---- dimension editor (values as a tag field) ---- */

function DimEditor({
  index,
  dim,
  preset,
  locale,
  dir,
  photos,
  photoUrl,
  onPickPhoto,
  taken,
  onPreset,
  onChange,
  onRemove,
  currency,
}: {
  currency?: string;
  index: number;
  dim: Pick<MatrixDim, "id" | "name" | "kind" | "values">;
  preset?: VariantPreset;
  locale: Locale;
  dir: "ltr" | "rtl";
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  taken: string[];
  onPreset?: (p: VariantPreset) => void;
  onChange: (dim: Pick<MatrixDim, "id" | "name" | "kind" | "values">, coalesce?: string | null) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const group = asGroup(dim);
  const color = isColorGroup(group);
  const swatches = useMemo(() => colorPalette(locale), [locale]);
  const [flash, setFlash] = useState<{ ids: string[]; n: number }>({ ids: [], n: 0 });
  return (
    <div className="grid content-start gap-3 rounded-2xl bg-background p-4 ring-1 ring-foreground/[0.08] dark:bg-foreground/[0.03]">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-[11px] font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
        <DraftInput
          dir="auto"
          value={dim.name}
          maxLength={40}
          aria-label={`Dimension ${index + 1} name`}
          placeholder="e.g. Material"
          clean={(raw) => cleanLabel(raw) || null}
          onCommit={(name) => onChange({ ...dim, name }, `dim:${dim.id}:name`)}
          className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 text-[13.5px] font-semibold shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent"
        />
        {onRemove ? (
          <IconAction label="Remove this dimension" onClick={onRemove} compact danger>
            <X />
          </IconAction>
        ) : null}
      </div>
      {onPreset ? (
        <div role="group" aria-label="Dimension preset" className="flex flex-wrap gap-1.5">
          {VARIANT_PRESETS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={preset === v}
              onClick={() => onPreset(v)}
              className={cn(
                "h-7 rounded-full px-2.5 text-[11.5px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                preset === v ? "bg-brand-soft text-brand ring-brand/30" : "text-muted-foreground ring-foreground/10 hover:text-foreground hover:ring-foreground/20",
              )}
            >
              {PRESET_LABEL[v]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted-foreground">Shown as</span>
        <Segmented<ChoiceKind> size="sm" label="Shown as" value={dim.kind} onChange={(kind) => onChange({ ...dim, kind })} options={KINDS.filter((k) => (CHOICE_KINDS as readonly string[]).includes(k.value))} />
      </div>
      <OptionsField
        group={group}
        dir={dir}
        colorGroup={color}
        density="compact"
        placeholder="Type a value and press Enter"
        photos={photos}
        photoUrl={photoUrl}
        onPickPhoto={onPickPhoto}
        swatches={swatches}
        flash={flash}
        inputRef={inputRef}
        onAdd={(labels) => {
          if (dim.values.length + labels.length > 24 && dim.values.length >= 24) return "24 values is the maximum for a dimension.";
          const res = addOptions(group, labels, { locale, preset: preset ?? (color ? "color" : "custom"), taken });
          for (const id of res.added) taken.push(id);
          if (res.repeated.length) setFlash((f) => ({ ids: res.repeated, n: f.n + 1 }));
          if (res.added.length) onChange({ ...dim, values: res.group.options });
          return res.full ? "24 values is the maximum — the rest wasn't added." : null;
        }}
        onUpdate={(i, option, coalesce) => onChange({ ...dim, values: dim.values.map((v, j) => (j === i ? option : v)) }, coalesce)}
        onRemove={(i) => onChange({ ...dim, values: dim.values.filter((_, j) => j !== i) })}
        onMove={(from, to) => {
          const values = [...dim.values];
          const [x] = values.splice(from, 1);
          values.splice(Math.max(0, Math.min(values.length, to)), 0, x!);
          onChange({ ...dim, values });
        }}
      />
      <p className="text-[11px] text-muted-foreground tabular-nums">{dim.values.length}/24 values · a sold-out value closes every combination with it</p>
      {dim.values.length ? <OptionExtras options={dim.values} dir={dir} currency={currency} onChange={(i, o, coalesce) => onChange({ ...dim, values: dim.values.map((v, j) => (j === i ? o : v)) }, coalesce)} /> : null}
    </div>
  );
}

/* ---- edit: dimensions + grid + inspector ---- */

function EditBody(p: CombinationsDialogProps & { group: MatrixGroup; onChange: (next: MatrixGroup, coalesce?: string | null) => void }) {
  const g = p.group;
  const [taken] = useState<string[]>(() => [...p.taken]);
  const [tab, setTab] = useState<"grid" | "dims">("grid");
  const [layer, setLayer] = useState(0);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [error, setError] = useState<string | null>(null);
  const [a, b, c] = g.dims as [MatrixDim, MatrixDim, MatrixDim | undefined];
  const layerValue = c?.values[Math.min(layer, c.values.length - 1)];
  const comboAt = (r: number, col: number): Combo | null => {
    const rv = a.values[r];
    const cv = b.values[col];
    if (!rv || !cv) return null;
    return { [a.id]: rv.id, [b.id]: cv.id, ...(c && layerValue ? { [c.id]: layerValue.id } : {}) };
  };
  const sel = comboAt(Math.min(focus.r, a.values.length - 1), Math.min(focus.c, b.values.length - 1));
  const patch = (where: Combo, x: CellPatch, coalesce?: string) => p.onChange(patchCombos(g, where, x), coalesce ?? null);
  const stats = matrixStats(g);
  const deltas = feature("PRICE_DELTAS");

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-2.5">
        <Segmented<"grid" | "dims">
          size="sm"
          label="View"
          value={tab}
          onChange={setTab}
          options={[
            { value: "grid", label: "Combinations" },
            { value: "dims", label: `Dimensions · ${g.dims.length}` },
          ]}
        />
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {stats.combos} combinations · <span className="text-foreground">{stats.open} on sale</span>
          {stats.out ? <span className="text-warn-ink"> · {stats.out} out</span> : null}
          {stats.none ? <span> · {stats.none} not made</span> : null}
        </span>
      </div>
      {tab === "dims" ? (
        <div className="adm-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
          {g.dims.map((d, i) => (
            <DimEditor
              key={d.id}
              index={i}
              dim={d}
              locale={p.locale}
              dir={p.dir}
              photos={p.photos}
              photoUrl={p.photoUrl}
              onPickPhoto={p.onPickPhoto}
              taken={taken}
              currency={p.currency}
              onChange={(dim, coalesce) => {
                if (!dim.values.length) {
                  setError("A dimension keeps at least one value.");
                  return;
                }
                const next = withDim(g, i, { ...d, ...dim });
                if (!next) setError(`More than ${MATRIX_MAX_COMBINATIONS} combinations.`);
                else {
                  setError(null);
                  p.onChange(next, coalesce ?? null);
                }
              }}
              onRemove={
                g.dims.length > 2
                  ? () => {
                      const next = removeDim(g, d.id);
                      if (next && window.confirm(`Remove “${d.name}”? Its exceptions merge into the other dimensions (the most severe state wins).`)) p.onChange(next);
                    }
                  : undefined
              }
            />
          ))}
          {g.dims.length < 3 ? (
            <button
              type="button"
              onClick={() => {
                const res = addDim(g, newDimDraft("custom", p.locale, taken), taken);
                if ("error" in res) setError(res.error);
                else {
                  setError(null);
                  p.onChange(res);
                }
              }}
              className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-foreground/15 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors hover:border-brand/45 hover:bg-brand-soft/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="size-4" />
                Add a third dimension
              </span>
            </button>
          ) : null}
          {error ? (
            <p role="alert" className="text-[12px] font-medium text-destructive md:col-span-2">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="adm-scroll grid min-h-0 content-start gap-3 overflow-auto px-5 py-4">
            {c ? (
              <div role="tablist" aria-label={c.name} className="flex flex-wrap gap-1.5">
                {c.values.map((v, i) => (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    aria-selected={i === layer}
                    onClick={() => setLayer(i)}
                    className={cn(
                      "h-7 rounded-full px-3 text-[12px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                      i === layer ? "bg-foreground text-background ring-foreground" : "text-muted-foreground ring-foreground/12 hover:text-foreground",
                    )}
                  >
                    <bdi>
                      {c.name}: {v.label}
                    </bdi>
                  </button>
                ))}
              </div>
            ) : null}
            <Grid group={g} rows={a} cols={b} layer={c && layerValue ? { dim: c, valueId: layerValue.id } : null} focus={focus} onFocus={setFocus} onPatch={patch} dir={p.dir} />
            <Legend />
          </div>
          <aside className="adm-scroll min-h-0 overflow-y-auto border-t border-border/60 bg-muted/25 px-4 py-4 md:border-t-0 md:border-s">
            {sel ? <Inspector group={g} combo={sel} onPatch={(x, co) => patch(sel, x, co)} deltas={deltas} currency={p.currency} photos={p.photos} photoUrl={p.photoUrl} onPickPhoto={p.onPickPhoto} /> : null}
          </aside>
        </div>
      )}
      <DialogFooter className="mx-0 mb-0 shrink-0 flex-row items-center justify-between gap-2 rounded-none border-t border-border/70 bg-muted/30 px-5 py-3 sm:justify-between">
        <span className="text-[11.5px] text-muted-foreground">Changes apply to the page as you make them (undo works).</span>
        <Button type="button" size="sm" className="rounded-full px-4" onClick={() => p.onOpenChange(false)}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

function Legend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] bg-brand-soft ring-1 ring-inset ring-brand/30" /> In stock
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] bg-warn/25 ring-1 ring-inset ring-warn/50" /> Out of stock (shown “épuisé”)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[4px] ring-1 ring-inset ring-foreground/20 [background:repeating-linear-gradient(135deg,transparent_0_3px,color-mix(in_oklab,var(--foreground)_10%,transparent)_3px_4px)]" /> Not made (never offered)
      </span>
      <span>Space cycles the state · arrows move</span>
    </p>
  );
}

function Grid({
  group: g,
  rows,
  cols,
  layer,
  focus,
  onFocus,
  onPatch,
  dir,
}: {
  group: MatrixGroup;
  rows: MatrixDim;
  cols: MatrixDim;
  layer: { dim: MatrixDim; valueId: string } | null;
  focus: { r: number; c: number };
  onFocus: (f: { r: number; c: number }) => void;
  onPatch: (where: Combo, patch: CellPatch, coalesce?: string) => void;
  dir: "ltr" | "rtl";
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  /** the focus moved by keyboard: the new cell takes it once rendered */
  const moved = useRef(false);
  const fr = Math.min(focus.r, rows.values.length - 1);
  const fc = Math.min(focus.c, cols.values.length - 1);
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    refs.current.get(`${fr}:${fc}`)?.focus();
  }, [fr, fc]);
  const combo = (r: number, c: number): Combo => ({ [rows.id]: rows.values[r]!.id, [cols.id]: cols.values[c]!.id, ...(layer ? { [layer.dim.id]: layer.valueId } : {}) });
  const layerWhere = layer ? { [layer.dim.id]: layer.valueId } : {};
  const rtl = dir === "rtl";

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    const go = (nr: number, nc: number) => {
      e.preventDefault();
      moved.current = true;
      onFocus({ r: Math.max(0, Math.min(rows.values.length - 1, nr)), c: Math.max(0, Math.min(cols.values.length - 1, nc)) });
    };
    switch (e.key) {
      case "ArrowRight":
        return go(r, c + (rtl ? -1 : 1));
      case "ArrowLeft":
        return go(r, c + (rtl ? 1 : -1));
      case "ArrowDown":
        return go(r + 1, c);
      case "ArrowUp":
        return go(r - 1, c);
      case "Home":
        return go(r, 0);
      case "End":
        return go(r, cols.values.length - 1);
      case " ": {
        e.preventDefault();
        const cur = cellOf(g, combo(r, c)).state;
        onPatch(combo(r, c), { state: NEXT_STATE[cur] });
        return;
      }
    }
  };

  return (
    <div dir={dir} className="adm-scroll overflow-x-auto">
      <table role="grid" aria-label={`${rows.name} × ${cols.name}`} className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky start-0 z-10 bg-background/0 p-0 text-start align-bottom">
              <span className="block px-1 pb-1 text-[10.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase">
                <bdi>{rows.name}</bdi> ↓ · <bdi>{cols.name}</bdi> →
              </span>
            </th>
            {cols.values.map((v) => (
              <th key={v.id} scope="col" className="p-0 align-bottom">
                <AxisMenu label={v.label} swatch={v.swatch} soldOut={v.soldOut} onBulk={(state) => onPatch({ [cols.id]: v.id, ...layerWhere }, { state })} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.values.map((rv, r) => (
            <tr key={rv.id}>
              <th scope="row" className="sticky start-0 z-10 p-0 text-start">
                <AxisMenu label={rv.label} swatch={rv.swatch} soldOut={rv.soldOut} row onBulk={(state) => onPatch({ [rows.id]: rv.id, ...layerWhere }, { state })} />
              </th>
              {cols.values.map((cv, c) => {
                const cb = combo(r, c);
                const shown = comboState(g, cb);
                const own = cellOf(g, cb);
                const custom = !!own.image || own.delta !== undefined || !!own.sku;
                const active = r === fr && c === fc;
                return (
                  <td key={cv.id} className="p-0">
                    <button
                      ref={(el) => {
                        if (el) refs.current.set(`${r}:${c}`, el);
                        else refs.current.delete(`${r}:${c}`);
                      }}
                      type="button"
                      role="gridcell"
                      tabIndex={active ? 0 : -1}
                      aria-selected={active}
                      aria-label={`${rv.label} · ${cv.label}: ${STATE_UI[shown].label}${own.delta !== undefined ? `, +${own.delta}` : ""}`}
                      onFocus={() => onFocus({ r, c })}
                      onClick={() => onFocus({ r, c })}
                      onDoubleClick={() => onPatch(cb, { state: NEXT_STATE[own.state] })}
                      onKeyDown={(e) => onKey(e, r, c)}
                      className={cn(
                        "relative grid h-11 w-[4.25rem] place-items-center rounded-[10px] text-[11px] font-medium tabular-nums ring-1 ring-inset outline-none transition-[background-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-ring",
                        shown === "in" && "bg-brand-soft/70 text-brand ring-brand/25 hover:bg-brand-soft",
                        shown === "out" && "bg-warn/20 text-warn-ink ring-warn/45 hover:bg-warn/30",
                        shown === "none" && "text-muted-foreground ring-foreground/15 [background:repeating-linear-gradient(135deg,transparent_0_5px,color-mix(in_oklab,var(--foreground)_7%,transparent)_5px_6px)]",
                        active && "ring-2 ring-foreground/70",
                      )}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        {shown === "in" ? <Check className="size-3.5" /> : shown === "out" ? <Ban className="size-3.5" /> : "—"}
                        {own.delta !== undefined ? <span className="text-[10px]">+{own.delta}</span> : null}
                      </span>
                      {custom ? <span aria-hidden="true" className="absolute end-1 top-1 size-1.5 rounded-full bg-foreground/50" /> : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AxisMenu({ label, swatch, soldOut, row, onBulk }: { label: string; swatch?: string; soldOut: boolean; row?: boolean; onBulk: (s: CellState) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex max-w-[7.5rem] items-center gap-1.5 rounded-lg px-1.5 text-[12px] font-medium outline-none transition-colors hover:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-ring/60",
            row ? "h-11 w-full min-w-[5.5rem]" : "h-7 w-[4.25rem] justify-center",
            soldOut && "text-muted-foreground line-through",
          )}
        >
          {swatch ? <Dot hex={swatch} size="xs" /> : null}
          <bdi className="truncate">{label}</bdi>
          <MoreHorizontal className="size-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="truncate text-[11.5px]">
          Every <bdi>{label}</bdi> {row ? "combination in this row" : "in this column"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onBulk("in")}>
          <Check />
          In stock
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onBulk("out")}>
          <Ban />
          Out of stock
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onBulk("none")}>
          <X />
          Not made
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Inspector({
  group: g,
  combo,
  onPatch,
  deltas,
  currency,
  photos,
  photoUrl,
  onPickPhoto,
}: {
  group: MatrixGroup;
  combo: Combo;
  onPatch: (x: CellPatch, coalesce?: string) => void;
  deltas: boolean;
  currency?: string;
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
}) {
  const own = cellOf(g, combo);
  const shown = comboState(g, combo);
  const values = g.dims.map((d) => d.values.find((v) => v.id === combo[d.id])!);
  const valueOut = values.filter((v) => v?.soldOut);
  const sum = values.reduce((n, v) => n + (v?.delta ?? 0), 0);
  const key = cellKey(combo);
  const name = values.map((v) => v?.label).join(" · ");
  return (
    <div className="grid content-start gap-4" key={key}>
      <div className="grid gap-0.5">
        <span className="text-[10.5px] font-medium tracking-[0.06em] text-muted-foreground uppercase">Combination</span>
        <bdi dir="auto" className="text-[15px] font-semibold tracking-[-0.01em]">
          {name}
        </bdi>
      </div>
      <Field label="Availability">
        <div role="radiogroup" aria-label="Availability" className="grid gap-1">
          {(["in", "out", "none"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={own.state === s}
              onClick={() => onPatch({ state: s })}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12.5px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                own.state === s ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-foreground/15" : "text-muted-foreground ring-transparent hover:bg-foreground/[0.04]",
              )}
            >
              <span className={cn("size-2.5 rounded-full", s === "in" ? "bg-brand" : s === "out" ? "bg-warn" : "ring-1 ring-foreground/30")} />
              {STATE_UI[s].label}
            </button>
          ))}
        </div>
        {valueOut.length && shown === "out" && own.state === "in" ? (
          <p className="text-[11px] leading-snug text-warn-ink">
            <bdi>{valueOut.map((v) => v!.label).join(", ")}</bdi> is sold out as a whole (Dimensions tab), so this combination is out too.
          </p>
        ) : null}
      </Field>
      <Field label="Photo">
        <div className="flex flex-wrap gap-1.5">
          <PhotoChoice selected={!own.image} onClick={() => onPatch({ image: null })} label="Option photos">
            <ImageOff className="size-3.5" />
          </PhotoChoice>
          {photos.slice(0, 11).map((ph) => (
            <PhotoChoice key={ph.ref.id} selected={own.image?.id === ph.ref.id} onClick={() => onPatch({ image: { ...ph.ref, alt: name.slice(0, 200) } })} label={ph.ref.alt || "Product photo"} url={ph.url} />
          ))}
          {own.image && !photos.some((ph) => ph.ref.id === own.image!.id) ? <PhotoChoice selected onClick={() => undefined} label="Library photo" url={photoUrl(own.image.id)} /> : null}
          {onPickPhoto ? (
            <PhotoChoice
              selected={false}
              label="From the library"
              onClick={async () => {
                const ref = await onPickPhoto(`Photo of ${name}`);
                if (ref) onPatch({ image: { ...ref, alt: name.slice(0, 200) } });
              }}
            >
              <Plus className="size-3.5" />
            </PhotoChoice>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">Shown when the customer picks it (else the values’ photos).</p>
      </Field>
      {deltas ? (
        <Field label="Price difference">
          <MoneyInput
            value={own.delta}
            optional
            max={100_000}
            currency={currency}
            placeholder={sum ? `+${sum} (values)` : "+0"}
            ariaLabel="Price difference of this combination"
            onCommit={(v) => onPatch({ delta: v === undefined ? null : v }, `cell:${key}:delta`)}
          />
          <p className="text-[11px] text-muted-foreground">Replaces the values’ own differences{sum ? ` (+${sum})` : ""} for this combination.</p>
        </Field>
      ) : null}
      <Field label="SKU">
        <DraftInput value={own.sku ?? ""} maxLength={60} dir="ltr" spellCheck={false} placeholder="Product SKU" aria-label="SKU of this combination" onCommit={(v) => onPatch({ sku: v || null }, `cell:${key}:sku`)} className="h-8 font-mono text-[12px]" />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11.5px] font-medium text-foreground/80">{label}</span>
      {children}
    </div>
  );
}

function PhotoChoice({ selected, onClick, label, url, children }: { selected: boolean; onClick: () => void; label: string; url?: string | null; children?: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-background text-muted-foreground ring-1 ring-inset outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring/60",
        selected ? "ring-2 ring-brand" : "ring-foreground/12 hover:ring-foreground/25",
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : (
        children
      )}
    </button>
  );
}
