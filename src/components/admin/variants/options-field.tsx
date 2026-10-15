"use client";
/**
 * The options of one group as a tag field: chips (swatch / photo / sold-out state) in the page's
 * reading direction, an entry at the end (Enter or comma adds, a pasted "S, M, L, XL" adds four),
 * and a popover per chip to rename, color, link a photo, mark sold out, move or remove.
 *
 * Keyboard: the chips are one tab stop (arrows move between them in reading order, Home / End,
 * Alt + arrows move the option, Delete removes it, Enter opens its editor); Backspace in the empty
 * entry steps back onto the last chip.
 */
import { ArrowLeft, ArrowRight, Check, ImageIcon, ImagePlus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { AssetRef } from "@/lib/page/schema";
import { MAX_VARIANT_LABEL, cleanLabel, hasSeparator, normalizeLabel, splitOptionText, type ColorChoice } from "@/lib/page/variant-presets";
import { cn } from "@/lib/utils";
import { relabel, withImage, withSwatch, type VariantGroup, type VariantOption } from "./model";

export type Density = "comfortable" | "compact";

/** A photo an option can be linked to. */
export interface VariantPhoto {
  /** the photo as the page references it (the option's own name becomes its alt text) */
  ref: AssetRef;
  /** thumbnail URL (null while unknown) */
  url: string | null;
  /** extracted palette, for "from your photos" color suggestions */
  palette?: { colors: readonly { hex: string; weight: number }[]; background: string | null } | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface OptionsFieldProps {
  group: VariantGroup;
  dir: "ltr" | "rtl";
  colorGroup: boolean;
  density: Density;
  placeholder: string;
  photos: readonly VariantPhoto[];
  photoUrl: (id: string) => string | null;
  onPickPhoto?: (title: string) => Promise<AssetRef | null>;
  /** quick swatches in the chip editor */
  swatches: readonly ColorChoice[];
  /** chips to draw attention to (a repeated label was typed); bumps re-run the pulse */
  flash: { ids: readonly string[]; n: number };
  inputRef: RefObject<HTMLInputElement | null>;
  /** add typed labels; returns a short message when some were not added */
  onAdd: (labels: string[]) => string | null;
  onUpdate: (index: number, option: VariantOption, coalesce?: string | null) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
  /** Escape in the empty entry (cancels a group being set up) */
  onEscape?: () => void;
}

export function OptionsField(props: OptionsFieldProps) {
  const { group, dir, density, placeholder, flash, inputRef, onAdd, onRemove, onMove } = props;
  const chipShared = { group, dir, density, colorGroup: props.colorGroup, photos: props.photos, photoUrl: props.photoUrl, onPickPhoto: props.onPickPhoto, swatches: props.swatches, onUpdate: props.onUpdate };
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const chips = useRef(new Map<string, HTMLButtonElement>());
  /** chip to focus once the list re-renders (after a move or a removal) */
  const focusNext = useRef<string | null>(null);
  const noteId = useId();
  const options = group.options;
  const full = options.length >= 24;
  const compact = density === "compact";
  const roving = Math.min(active, Math.max(0, options.length - 1));

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    if (id === "@input") inputRef.current?.focus();
    else chips.current.get(id)?.focus();
  });

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 3200);
    return () => window.clearTimeout(t);
  }, [note]);

  const add = (labels: string[]) => {
    if (!labels.length) return;
    setNote(onAdd(labels));
  };

  const focusChip = (i: number) => {
    const o = options[i];
    if (!o) {
      inputRef.current?.focus();
      return;
    }
    setActive(i);
    chips.current.get(o.id)?.focus();
  };

  const removeAt = (i: number) => {
    const rest = options.filter((_, j) => j !== i);
    const target = rest[Math.min(i, rest.length - 1)];
    focusNext.current = target ? target.id : "@input";
    setActive(Math.min(i, Math.max(0, rest.length - 1)));
    onRemove(i);
  };

  const onChipKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = (e.key === "ArrowRight" ? 1 : -1) * (dir === "rtl" ? -1 : 1);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      if (e.altKey) {
        const to = i + step;
        if (to < 0 || to >= options.length) return;
        focusNext.current = options[i]!.id;
        setActive(to);
        onMove(i, to);
        return;
      }
      if (i + step >= options.length) inputRef.current?.focus();
      else if (i + step >= 0) focusChip(i + step);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusChip(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusChip(options.length - 1);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeAt(i);
    }
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === "Enter") {
      e.preventDefault();
      const labels = splitOptionText(text);
      if (labels.length) {
        add(labels);
        setText("");
      }
    } else if (e.key === "Escape") {
      if (text) {
        e.preventDefault();
        setText("");
      } else if (props.onEscape) {
        e.preventDefault();
        props.onEscape();
      }
    } else if (!text && options.length && (e.key === "Backspace" || (e.key === (dir === "rtl" ? "ArrowRight" : "ArrowLeft") && el.selectionStart === 0))) {
      e.preventDefault();
      focusChip(options.length - 1);
    }
  };

  const onInputChange = (raw: string) => {
    if (!hasSeparator(raw)) {
      setText(raw);
      return;
    }
    // "S," adds S; "S, M" adds S and keeps typing M
    const parts = raw.split(/[,،;؛\n\r\t]/);
    const rest = /[,،;؛\n\r\t]\s*$/.test(raw) ? "" : (parts.pop() ?? "");
    add(splitOptionText(parts.join(",")));
    setText(rest.trimStart());
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!hasSeparator(pasted)) return;
    e.preventDefault();
    add(splitOptionText(`${text},${pasted}`));
    setText("");
  };

  return (
    <div className="grid gap-1.5">
      <div
        dir={dir}
        onClick={(e) => {
          if (e.target === e.currentTarget) inputRef.current?.focus();
        }}
        className={cn(
          "flex min-w-0 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-input bg-background p-1.5 transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 dark:bg-input/30",
          compact ? "min-h-10" : "min-h-12",
        )}
      >
        {options.length > 0 ? (
          <ul role="list" aria-label={`Options of ${group.name || "this group"}`} className="contents">
            <AnimatePresence initial={false}>
              {options.map((o, i) => (
                <Chip
                  key={o.id}
                  {...chipShared}
                  option={o}
                  index={i}
                  count={options.length}
                  tabbable={i === roving}
                  flashN={flash.ids.includes(o.id) ? flash.n : 0}
                  open={openId === o.id}
                  onOpenChange={(v) => setOpenId(v ? o.id : null)}
                  register={(el) => {
                    if (el) chips.current.set(o.id, el);
                    else chips.current.delete(o.id);
                  }}
                  onFocus={() => setActive(i)}
                  onKeyDown={(e) => onChipKey(e, i)}
                  onRemove={() => removeAt(i)}
                  onMoveBy={(by) => {
                    const to = i + by;
                    if (to < 0 || to >= options.length) return;
                    setActive(to);
                    onMove(i, to);
                  }}
                />
              ))}
            </AnimatePresence>
          </ul>
        ) : null}
        {full ? (
          <span className="px-2 text-[12px] text-muted-foreground" dir="ltr">
            24 options — the maximum
          </span>
        ) : (
          <input
            ref={inputRef}
            value={text}
            dir="auto"
            maxLength={MAX_VARIANT_LABEL * 12}
            autoComplete="off"
            spellCheck={false}
            aria-label={`Add ${group.name ? `${group.name} ` : ""}options`}
            aria-describedby={note ? noteId : undefined}
            placeholder={options.length ? "Add another" : placeholder}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKey}
            onPaste={onPaste}
            onBlur={() => {
              const labels = splitOptionText(text);
              if (labels.length) {
                add(labels);
                setText("");
              }
            }}
            className={cn(
              "h-7 min-w-[9rem] flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground/75",
              compact ? "text-[12.5px]" : "text-[13.5px]",
            )}
          />
        )}
      </div>
      <AnimatePresence initial={false}>
        {note ? (
          <motion.p
            key="note"
            id={noteId}
            role="status"
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="text-[11.5px] text-muted-foreground"
          >
            {note}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* chip                                                                */
/* ------------------------------------------------------------------ */

interface ChipProps extends Omit<OptionsFieldProps, "onRemove" | "onMove" | "inputRef" | "onAdd" | "onEscape" | "placeholder" | "flash"> {
  option: VariantOption;
  index: number;
  count: number;
  tabbable: boolean;
  flashN: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  register: (el: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
  onMoveBy: (by: number) => void;
}

function Chip({ register, ...p }: ChipProps) {
  const { option: o, group, density, open } = p;
  const [scope, animate] = useAnimate<HTMLLIElement>();
  const compact = density === "compact";
  const img = o.image ? p.photoUrl(o.image.id) : null;
  const showSwatch = group.kind === "swatch" || (p.colorGroup && !!o.swatch);
  const showImg = !!img && (group.kind !== "swatch" || !!o.image);

  useEffect(() => {
    if (!p.flashN || !scope.current) return;
    void animate(scope.current, { scale: [1, 1.1, 1] }, { duration: 0.42, ease: [0.22, 1, 0.36, 1] });
  }, [p.flashN, animate, scope]);

  const state = [o.soldOut ? "sold out" : null, o.image ? "photo linked" : null].filter(Boolean).join(", ");
  return (
    <motion.li
      ref={scope}
      layout="position"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.14 } }}
      transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.7 }}
      className={cn(
        "group/chip relative inline-flex max-w-full min-w-0 items-center rounded-full bg-background shadow-[0_1px_1.5px_rgb(0_0_0/0.05)] ring-1 transition-[box-shadow] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/60 dark:bg-foreground/[0.06]",
        open ? "ring-brand/60" : "ring-foreground/[0.11] hover:ring-foreground/25",
        compact ? "h-7" : "h-8",
      )}
    >
      <Popover open={open} onOpenChange={p.onOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={register}
            type="button"
            tabIndex={p.tabbable ? 0 : -1}
            onFocus={p.onFocus}
            onKeyDown={p.onKeyDown}
            aria-label={`${o.label}${state ? ` (${state})` : ""} — edit`}
            className={cn(
              "flex h-full min-w-0 items-center gap-1.5 rounded-full outline-none",
              showSwatch || showImg ? "ps-1" : compact ? "ps-2.5" : "ps-3",
              compact ? "text-[12px]" : "text-[13px]",
            )}
          >
            {showSwatch || showImg ? (
              <span className="flex shrink-0 items-center">
                {showSwatch ? <Dot hex={o.swatch} size={compact ? "sm" : "md"} /> : null}
                {showImg ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                  <img
                    src={img}
                    alt=""
                    draggable={false}
                    className={cn("rounded-full object-cover ring-2 ring-background", compact ? "size-[1.15rem]" : "size-6", showSwatch && "-ms-1.5")}
                  />
                ) : null}
              </span>
            ) : null}
            <bdi className={cn("min-w-0 truncate font-medium", o.soldOut && "text-muted-foreground line-through decoration-foreground/40")}>{o.label}</bdi>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} dir="ltr" className="w-[19rem] gap-0 rounded-2xl p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
          <OptionEditor {...p} />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Remove ${o.label}`}
        onClick={p.onRemove}
        className={cn(
          "grid shrink-0 place-items-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/[0.07] hover:text-foreground",
          compact ? "mx-0.5 size-5" : "mx-1 size-5",
        )}
      >
        <X className="size-3" strokeWidth={2.4} />
      </button>
    </motion.li>
  );
}

/** A swatch dot; dashed when the color is not set yet. */
export function Dot({ hex, size = "md", className }: { hex?: string; size?: "xs" | "sm" | "md"; className?: string }) {
  const s = size === "xs" ? "size-3" : size === "sm" ? "size-[1.05rem]" : "size-5";
  if (!hex || !HEX.test(hex)) return <span aria-hidden="true" className={cn("shrink-0 rounded-full border border-dashed border-foreground/35", s, className)} />;
  return <span aria-hidden="true" className={cn("shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.2)]", s, className)} style={{ background: hex }} />;
}

/* ------------------------------------------------------------------ */
/* chip editor                                                         */
/* ------------------------------------------------------------------ */

function OptionEditor(p: Omit<ChipProps, "register">) {
  const { option: o, group, index, count, dir, colorGroup } = p;
  const ids = { label: useId(), hex: useId(), sold: useId() };
  const [draft, setDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);
  const raw = draft ?? o.label;
  const clean = cleanLabel(raw);
  const repeated = !!clean && group.options.some((x) => x.id !== o.id && normalizeLabel(x.label) === normalizeLabel(clean));
  const error = draft === null ? null : !clean ? "Give it a name." : repeated ? "Already in this group." : null;
  const showColor = colorGroup || group.kind === "swatch";
  const showPhotos = p.photos.length > 0 || !!p.onPickPhoto;
  // the earlier / later arrows point the way the chips flow on the page
  const Earlier = dir === "rtl" ? ArrowRight : ArrowLeft;
  const Later = dir === "rtl" ? ArrowLeft : ArrowRight;
  const hexRaw = hexDraft ?? o.swatch ?? "";
  const hexNorm = hexRaw.trim().startsWith("#") ? hexRaw.trim() : `#${hexRaw.trim()}`;
  const hexError = hexDraft !== null && hexDraft.trim() !== "" && !HEX.test(hexNorm);

  useEffect(() => {
    const t = window.setTimeout(() => labelRef.current?.select(), 30);
    return () => window.clearTimeout(t);
  }, []);

  const update = (next: VariantOption, coalesce?: string | null) => p.onUpdate(index, next, coalesce);
  const linked = o.image?.id ?? null;
  const extra = o.image && !p.photos.some((x) => x.ref.id === o.image!.id) ? o.image : null;

  return (
    <div className="grid">
      <div className="grid gap-1.5 p-3.5 pb-3">
        <label htmlFor={ids.label} className="text-[11.5px] font-medium text-muted-foreground">
          Name on the page
        </label>
        <Input
          ref={labelRef}
          id={ids.label}
          dir="auto"
          value={raw}
          maxLength={MAX_VARIANT_LABEL}
          aria-invalid={!!error || undefined}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const c = cleanLabel(v);
            const dup = group.options.some((x) => x.id !== o.id && normalizeLabel(x.label) === normalizeLabel(c));
            if (c && !dup && c !== o.label) update(relabel(o, c, colorGroup), `opt:${o.id}:label`);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              p.onOpenChange(false);
            }
          }}
          className="h-9 rounded-lg text-[13.5px]"
        />
        {error ? (
          <p role="alert" className="text-[11.5px] font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {showColor ? (
        <div className="grid gap-2 border-t border-foreground/[0.07] p-3.5 pb-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11.5px] font-medium text-muted-foreground">Swatch</span>
            {o.swatch ? (
              <button type="button" onClick={() => update(withSwatch(o, null))} className="rounded-md px-1 text-[11.5px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                No swatch
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.14)]" style={o.swatch ? { background: o.swatch } : undefined}>
              {!o.swatch ? <span aria-hidden="true" className="absolute inset-1 rounded-md border border-dashed border-foreground/30" /> : null}
              <span className="sr-only">Pick the color of {o.label}</span>
              <input
                type="color"
                value={o.swatch && HEX.test(o.swatch) ? o.swatch : "#888888"}
                onChange={(e) => update(withSwatch(o, e.target.value), `opt:${o.id}:swatch`)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <Input
              id={ids.hex}
              value={hexRaw}
              placeholder="#000000"
              spellCheck={false}
              maxLength={7}
              dir="ltr"
              aria-label={`Hex color of ${o.label}`}
              aria-invalid={hexError || undefined}
              onChange={(e) => {
                const v = e.target.value;
                setHexDraft(v);
                const h = v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`;
                if (HEX.test(h) && h.toLowerCase() !== o.swatch) update(withSwatch(o, h), `opt:${o.id}:swatch`);
              }}
              onBlur={() => setHexDraft(null)}
              className="h-9 rounded-lg font-mono text-[12.5px] uppercase"
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick colors">
            {p.swatches.slice(0, 14).map((c) => {
              const on = o.swatch?.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={on}
                  title={c.label}
                  onClick={() => update(withSwatch(o, c.hex))}
                  className={cn("grid size-6 place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/60", on && "ring-2 ring-brand ring-offset-2 ring-offset-popover")}
                >
                  <Dot hex={c.hex} size="md" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {showPhotos ? (
        <div className="grid gap-2 border-t border-foreground/[0.07] p-3.5 pb-3">
          <span className="text-[11.5px] font-medium text-muted-foreground">Photo</span>
          <div role="radiogroup" aria-label={`Photo of ${o.label}`} className="flex flex-wrap gap-1.5">
            <PhotoTile on={!linked} label="No photo" onClick={() => update(withImage(o, null))}>
              <X className="size-3.5 text-muted-foreground" />
            </PhotoTile>
            {[...p.photos, ...(extra ? [{ ref: extra, url: p.photoUrl(extra.id) }] : [])].slice(0, 13).map((ph, n) => (
              <PhotoTile key={ph.ref.id} on={linked === ph.ref.id} label={`Photo ${n + 1}`} onClick={() => update(withImage(o, ph.ref))}>
                {ph.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                  <img src={ph.url} alt="" draggable={false} className="size-full object-cover" />
                ) : (
                  <ImageIcon className="size-3.5 text-muted-foreground" />
                )}
              </PhotoTile>
            ))}
            {p.onPickPhoto ? (
              <button
                type="button"
                disabled={picking}
                onClick={async () => {
                  setPicking(true);
                  try {
                    const ref = await p.onPickPhoto!(`Photo for ${o.label}`);
                    if (ref) update(withImage(o, ref));
                  } finally {
                    setPicking(false);
                  }
                }}
                aria-label="Choose from the media library"
                title="Choose from the media library"
                className="grid size-10 place-items-center rounded-lg border border-dashed border-foreground/20 text-muted-foreground outline-none transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <ImagePlus className="size-4" />
              </button>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-pretty text-muted-foreground">
            {group.kind === "image" ? "Shown as this option's tile; the order form shows the photo when it is picked." : "When the customer picks it, the order form shows this photo."}
          </p>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 border-t border-foreground/[0.07] p-3.5 pb-3">
        <label htmlFor={ids.sold} className="grid gap-0.5">
          <span className="text-[12.5px] font-medium">Sold out</span>
          <span className="text-[11px] leading-snug text-muted-foreground">Crossed out on the page; it can&apos;t be ordered.</span>
        </label>
        <Switch id={ids.sold} checked={o.soldOut} onCheckedChange={(v) => update({ ...o, soldOut: v })} className="mt-0.5" />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-foreground/[0.07] bg-foreground/[0.02] px-2.5 py-2">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="Move earlier" title="Move earlier" disabled={index === 0} onClick={() => p.onMoveBy(-1)} className="text-muted-foreground">
            <Earlier />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Move later" title="Move later" disabled={index >= count - 1} onClick={() => p.onMoveBy(1)} className="text-muted-foreground">
            <Later />
          </Button>
          <span className="ms-1 text-[11px] text-muted-foreground tabular-nums">
            {index + 1} of {count}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              p.onOpenChange(false);
              p.onRemove();
            }}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 />
            Remove
          </Button>
          <Button variant="secondary" size="sm" onClick={() => p.onOpenChange(false)}>
            <Check />
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhotoTile({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid size-10 place-items-center overflow-hidden rounded-lg bg-muted outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring/60",
        on ? "ring-2 ring-brand ring-offset-1 ring-offset-popover" : "opacity-80 ring-1 ring-foreground/10 hover:opacity-100",
      )}
    >
      {children}
    </button>
  );
}
