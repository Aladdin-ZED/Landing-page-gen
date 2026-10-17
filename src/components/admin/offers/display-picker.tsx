"use client";
/**
 * Offer design (docs/OFFERS.md §E, §H.4 Display): the one-tap combos (Classique / Boutique / Compact
 * / Auto) above the three axes — Offer layout (5 glyph tiles drawn with this page's offer count, the
 * archetype's recommendation marked), Personalization layout (values the layout can't host are
 * disabled with the reason) and Selected style — then media, density, per-piece price and savings.
 * The notes `resolveDisplay` returns (fallbacks the page applies) are shown inline.
 *
 * Shared by the builder's Offers panel and the wizard's Offers step ("Look": combos only).
 */
import { Check, Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { Switch } from "@/components/ui/switch";
import { DISPLAY_RULES, resolveDisplay } from "@/lib/page/display";
import { feature } from "@/lib/page/features";
import { isChoicePick, isFixedPick, OFFER_FILLS, OFFER_MEDIA, OFFER_PICKERS, OFFER_SELECTIONS, type Archetype, type Offer, type OfferDisplay, type OfferFill, type OfferPicker, type OfferSelection, type Offers, type PageDoc } from "@/lib/page/schema";
import { cn } from "@/lib/utils";

export const PICKER_UI: Record<OfferPicker, string> = { stack: "Rows", tiers: "Columns", ticket: "Passes", pills: "Segments", visual: "Cards" };
const FILL_UI: Record<OfferFill, string> = { auto: "Auto", inline: "Inline", rows: "Rows", steps: "Steps", box: "Box" };
const FILL_HINT: Record<OfferFill, string> = {
  auto: "Chosen once for the page from how many pieces need a choice.",
  inline: "Choices sit inside the selected offer card.",
  rows: "One row per piece under the offers.",
  steps: "One piece at a time with Next / Previous.",
  box: "A box per piece, for “choose 2” packs.",
};
const SELECTION_UI: Record<OfferSelection, string> = { soft: "Soft", solid: "Solid", outline: "Outline" };
const MEDIA_UI: Record<(typeof OFFER_MEDIA)[number], string> = { auto: "Auto", none: "None", thumb: "Thumbnail", large: "Large" };

/* ------------------------------------------------------------------ */
/* archetype pick (§E.5)                                               */
/* ------------------------------------------------------------------ */

const ARCHETYPE: Record<Archetype, { single: [OfferPicker, OfferPicker]; imageLed: OfferPicker; selection: OfferSelection; density: "comfortable" | "compact" }> = {
  maison: { single: ["tiers", "pills"], imageLed: "visual", selection: "outline", density: "comfortable" },
  apothecary: { single: ["stack", "tiers"], imageLed: "stack", selection: "soft", density: "comfortable" },
  souk: { single: ["ticket", "visual"], imageLed: "visual", selection: "solid", density: "comfortable" },
  playground: { single: ["visual", "ticket"], imageLed: "visual", selection: "soft", density: "comfortable" },
  kinetic: { single: ["tiers", "stack"], imageLed: "visual", selection: "outline", density: "compact" },
  circuit: { single: ["tiers", "pills"], imageLed: "stack", selection: "outline", density: "compact" },
  hearth: { single: ["stack", "visual"], imageLed: "visual", selection: "soft", density: "comfortable" },
  bloom: { single: ["visual", "stack"], imageLed: "visual", selection: "soft", density: "comfortable" },
  field: { single: ["stack", "visual"], imageLed: "stack", selection: "soft", density: "comfortable" },
  editorial: { single: ["pills", "tiers"], imageLed: "visual", selection: "outline", density: "comfortable" },
  garage: { single: ["ticket", "tiers"], imageLed: "stack", selection: "outline", density: "compact" },
};

/** Some offer has 2+ distinct items, a choice line or a custom visual. */
export function imageLed(bundles: readonly Offer[]): boolean {
  return bundles.some((o) => o.visual.mode === "custom" || o.lines.some((l) => isChoicePick(l.pick)) || new Set(o.lines.map((l) => (isFixedPick(l.pick) ? l.pick.item : ""))).size >= 2);
}

/** What "Auto (the design decides)" resolves to for this archetype and these offers. */
export function archetypeDisplay(archetype: Archetype, bundles: readonly Offer[]): OfferDisplay {
  const a = ARCHETYPE[archetype] ?? ARCHETYPE.field;
  const led = imageLed(bundles);
  const n = bundles.length;
  let picker: OfferPicker = led ? a.imageLed : a.single[0];
  let density = a.density;
  let media: OfferDisplay["media"] = "auto";
  if (led && picker === "stack") media = "thumb";
  if (n >= 5) {
    if (led && n <= 6) picker = "visual";
    else {
      picker = "stack";
      density = "compact";
    }
  }
  if (picker === "pills" && n > 4) picker = "stack";
  return { picker, fill: "auto", selection: a.selection, media, density };
}

/* ------------------------------------------------------------------ */
/* combos                                                              */
/* ------------------------------------------------------------------ */

export type ComboId = "classic" | "boutique" | "compact" | "auto";

export const COMBOS: { id: ComboId; label: string; hint: string }[] = [
  { id: "classic", label: "Classique", hint: "Rows, solid selection" },
  { id: "boutique", label: "Boutique", hint: "Image cards, a box per piece" },
  { id: "compact", label: "Compact", hint: "Slim rows, steps" },
  { id: "auto", label: "Auto", hint: "The design decides" },
];

/** The axes a combo sets (nothing else is stored). Without NEW_FILLS the fill stays automatic. */
export function comboDisplay(id: ComboId, archetype: Archetype, bundles: readonly Offer[]): OfferDisplay {
  const fills = feature("NEW_FILLS");
  switch (id) {
    case "classic":
      return { picker: "stack", fill: "auto", selection: "solid", media: "auto", density: "comfortable" };
    case "boutique":
      return { picker: "visual", fill: fills ? "box" : "auto", selection: "soft", media: "large", density: "comfortable" };
    case "compact":
      return { picker: "stack", fill: fills ? "steps" : "auto", selection: "outline", media: "auto", density: "compact" };
    case "auto":
      return archetypeDisplay(archetype, bundles);
  }
}

/** The combo the display currently equals (null = custom axes). */
export function comboOf(d: OfferDisplay, archetype: Archetype, bundles: readonly Offer[]): ComboId | null {
  for (const c of COMBOS) {
    const x = comboDisplay(c.id, archetype, bundles);
    if (x.picker === d.picker && x.fill === d.fill && x.selection === d.selection && x.density === d.density && (c.id !== "auto" || x.media === d.media)) return c.id;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* glyphs                                                              */
/* ------------------------------------------------------------------ */

function Glyph({ kind, n }: { kind: OfferPicker; n: number }) {
  const a = "var(--brand)";
  const c = "currentColor";
  const k = Math.max(1, Math.min(4, n));
  switch (kind) {
    case "stack": {
      const h = 34 / k;
      return (
        <svg viewBox="0 0 64 44" className="size-full" aria-hidden="true">
          {Array.from({ length: k }, (_, i) => (
            <g key={i}>
              <rect x="6" y={5 + i * h} width="52" height={h - 3} rx="3.5" fill={i === Math.min(1, k - 1) ? "none" : c} opacity={i === Math.min(1, k - 1) ? 1 : 0.14} stroke={i === Math.min(1, k - 1) ? a : "none"} strokeWidth="1.6" />
              {i === Math.min(1, k - 1) ? <circle cx="12.5" cy={5 + i * h + (h - 3) / 2} r="2.2" fill={a} /> : null}
            </g>
          ))}
        </svg>
      );
    }
    case "tiers": {
      const cols = Math.max(2, Math.min(3, k));
      const w = 52 / cols;
      return (
        <svg viewBox="0 0 64 44" className="size-full" aria-hidden="true">
          {Array.from({ length: cols }, (_, i) => {
            const mid = i === Math.floor(cols / 2);
            return <rect key={i} x={6 + i * w + 1} y={mid ? 5 : 10} width={w - 2} height={mid ? 34 : 28} rx="4" fill={mid ? "none" : c} opacity={mid ? 1 : 0.14} stroke={mid ? a : "none"} strokeWidth="1.6" />;
          })}
        </svg>
      );
    }
    case "ticket":
      return (
        <svg viewBox="0 0 64 44" className="size-full" aria-hidden="true">
          <rect x="8" y="5" width="48" height="34" rx="6" fill={c} opacity=".12" />
          <path d="M8 11a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v4H8z" fill={a} />
          <rect x="14" y="21" width="16" height="7" rx="2" fill={c} opacity=".35" />
          <rect x="38" y="21" width="12" height="11" rx="3" fill={c} opacity=".22" />
        </svg>
      );
    case "pills": {
      const seg = Math.max(2, Math.min(4, k));
      const w = 52 / seg;
      return (
        <svg viewBox="0 0 64 44" className="size-full" aria-hidden="true">
          <rect x="6" y="6" width="52" height="11" rx="5.5" fill={c} opacity=".12" />
          <rect x={6 + w * Math.min(1, seg - 1) + 1} y="7.5" width={w - 2} height="8" rx="4" fill={a} />
          <rect x="6" y="21" width="52" height="18" rx="4" fill={c} opacity=".08" />
          <rect x="10" y="25" width="10" height="10" rx="2.5" fill={c} opacity=".25" />
          <rect x="24" y="26" width="22" height="3" rx="1.5" fill={c} opacity=".3" />
          <rect x="24" y="31" width="14" height="3" rx="1.5" fill={c} opacity=".2" />
        </svg>
      );
    }
    default: {
      const cols = Math.max(2, Math.min(3, k));
      const w = 52 / cols;
      return (
        <svg viewBox="0 0 64 44" className="size-full" aria-hidden="true">
          {Array.from({ length: cols }, (_, i) => (
            <g key={i}>
              <rect x={6 + i * w + 1} y="5" width={w - 2} height="34" rx="5" fill={i === 1 ? "none" : c} opacity={i === 1 ? 1 : 0.12} stroke={i === 1 ? a : "none"} strokeWidth="1.6" />
              <rect x={6 + i * w + 4} y="9" width={w - 8} height="17" rx="3" fill={i === 1 ? a : c} opacity={i === 1 ? 0.85 : 0.3} />
              <rect x={6 + i * w + 4} y="30" width={w - 12} height="3" rx="1.5" fill={c} opacity=".3" />
            </g>
          ))}
        </svg>
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* picker                                                              */
/* ------------------------------------------------------------------ */

export interface DisplayPickerProps {
  doc: Pick<PageDoc, "items" | "offers">;
  archetype: Archetype;
  /** order form variant (bold slab renders "solid" as ink) */
  formVariant?: string;
  onChange: (offers: Offers) => void;
  /** wizard: combos only */
  combosOnly?: boolean;
}

export function DisplayPicker({ doc, archetype, formVariant = "card", onChange, combosOnly }: DisplayPickerProps) {
  const offers = doc.offers;
  const d = offers.display;
  const n = offers.bundles.length;
  const combo = comboOf(d, archetype, offers.bundles);
  const recommended = archetypeDisplay(archetype, offers.bundles).picker;
  const resolved = resolveDisplay(doc, { archetype, formVariant });
  const rule = DISPLAY_RULES[d.picker];
  const fills = feature("NEW_FILLS");
  const set = (patch: Partial<OfferDisplay>) => onChange({ ...offers, display: { ...d, ...patch } });

  return (
    <div className="@container/disp grid min-w-0 grid-cols-1 gap-4">
      <div role="radiogroup" aria-label="Offer design" className="grid grid-cols-2 gap-1.5 @min-[30rem]/disp:grid-cols-4">
        {COMBOS.map((c) => {
          const on = combo === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ ...offers, display: comboDisplay(c.id, archetype, offers.bundles) })}
              className={cn(
                "grid gap-0.5 rounded-xl px-2.5 py-2 text-start ring-1 ring-inset outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
                on ? "bg-brand-soft ring-brand/35" : "ring-foreground/[0.08] hover:bg-foreground/[0.03] hover:ring-foreground/15",
              )}
            >
              <span className="flex items-center gap-1 text-[12.5px] font-semibold">
                {c.id === "auto" ? <Sparkles className="size-3.5 text-brand" /> : null}
                {c.label}
                {on ? <Check className="ms-auto size-3.5 text-brand" /> : null}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{c.hint}</span>
            </button>
          );
        })}
      </div>

      {combosOnly ? null : (
        <>
          <Axis label="Offer layout">
            <div role="radiogroup" aria-label="Offer layout" className="grid grid-cols-5 gap-1.5">
              {OFFER_PICKERS.map((k) => {
                const on = d.picker === k;
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set({ picker: k, ...(!DISPLAY_RULES[k].media.includes(d.media) ? { media: DISPLAY_RULES[k].media[0]! } : {}) })}
                    className={cn(
                      "relative grid justify-items-center gap-1 rounded-xl px-1 pt-2 pb-1.5 text-foreground ring-1 ring-inset outline-none transition-[background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
                      on ? "bg-background ring-2 ring-brand/70 shadow-[0_4px_14px_-8px_var(--brand)]" : "ring-foreground/[0.08] hover:bg-foreground/[0.03]",
                    )}
                  >
                    <span className="h-7 w-10">
                      <Glyph kind={k} n={n} />
                    </span>
                    <span className="text-[10.5px] font-medium">{PICKER_UI[k]}</span>
                    {recommended === k ? <span className="absolute -top-1.5 end-1 rounded-full bg-brand px-1 text-[8.5px] font-semibold tracking-[0.04em] text-brand-foreground uppercase" title="Recommended for this design">Rec</span> : null}
                  </button>
                );
              })}
            </div>
          </Axis>

          <Axis label="Personalization layout" hint={FILL_HINT[d.fill]}>
            <div role="radiogroup" aria-label="Personalization layout" className="flex flex-wrap gap-1">
              {OFFER_FILLS.map((f) => {
                const gated = !fills && (f === "inline" || f === "steps" || f === "box");
                const hosted = rule.fills.includes(f);
                const why = gated ? "Coming with the new order form" : !hosted ? `${PICKER_UI[d.picker]} can't hold the pieces inside the card` : undefined;
                const on = d.fill === f;
                return (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-disabled={!!why || undefined}
                    title={why}
                    onClick={() => !why && set({ fill: f })}
                    className={cn(
                      "h-7 rounded-full px-2.5 text-[11.5px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                      on ? "bg-foreground text-background ring-foreground" : why ? "cursor-not-allowed text-muted-foreground/50 ring-foreground/[0.06]" : "text-muted-foreground ring-foreground/12 hover:text-foreground",
                    )}
                  >
                    {FILL_UI[f]}
                  </button>
                );
              })}
            </div>
          </Axis>

          <Axis label="Selected style">
            <Segmented<OfferSelection> size="sm" label="Selected style" value={d.selection} onChange={(selection) => set({ selection })} options={OFFER_SELECTIONS.map((s) => ({ value: s, label: SELECTION_UI[s] }))} />
            {formVariant === "bold" && d.selection === "solid" ? <p className="text-[11px] text-muted-foreground">On the bold order form a solid selection is drawn in ink, never accent on accent.</p> : null}
          </Axis>

          <div className="grid grid-cols-2 gap-3">
            <Axis label="Media">
              {rule.media.length > 1 ? (
                <Segmented<(typeof OFFER_MEDIA)[number]> size="sm" label="Media" value={rule.media.includes(d.media) ? d.media : rule.media[0]!} onChange={(media) => set({ media })} options={rule.media.map((m) => ({ value: m, label: MEDIA_UI[m] }))} />
              ) : (
                <span className="inline-flex h-7 items-center gap-1 text-[11.5px] text-muted-foreground">
                  <span className="font-medium text-foreground">{MEDIA_UI[rule.media[0]!]}</span>· set by {PICKER_UI[d.picker]}
                </span>
              )}
            </Axis>
            <Axis label="Density">
              {rule.density ? (
                <Segmented<"comfortable" | "compact">
                  size="sm"
                  label="Density"
                  value={d.density}
                  onChange={(density) => set({ density })}
                  options={[
                    { value: "comfortable", label: "Roomy" },
                    { value: "compact", label: "Compact" },
                  ]}
                />
              ) : (
                <span className="text-[11.5px] text-muted-foreground">Segments have one size.</span>
              )}
            </Axis>
          </div>

          <div className="grid gap-2">
            <label className="flex items-center justify-between gap-3 text-[12.5px] font-medium">
              Show the price per piece
              <Switch size="sm" checked={offers.showPerUnit} onCheckedChange={(showPerUnit) => onChange({ ...offers, showPerUnit })} />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12.5px] font-medium">Show savings as</span>
              <Segmented<Offers["showSavings"]>
                size="sm"
                label="Show savings as"
                value={offers.showSavings}
                onChange={(showSavings) => onChange({ ...offers, showSavings })}
                options={[
                  { value: "amount", label: "Amount" },
                  { value: "percent", label: "%" },
                  { value: "both", label: "Both" },
                  { value: "none", label: "Hide" },
                ]}
              />
            </div>
          </div>
        </>
      )}

      {resolved.notes.length ? (
        <ul className="grid gap-1 rounded-xl bg-foreground/[0.03] p-2.5 ring-1 ring-inset ring-foreground/[0.05]">
          {resolved.notes.map((x, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0 text-brand" />
              {x.message}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        On this page: <span className="font-medium text-foreground">{PICKER_UI[resolved.picker]}</span>, personalization{" "}
        <span className="font-medium text-foreground">{resolved.fill === "none" ? "none needed" : FILL_UI[resolved.fill]}</span>, {SELECTION_UI[resolved.selection].toLowerCase()} selection.
      </p>
    </div>
  );
}

function Axis({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <span className="text-[11.5px] font-medium text-foreground/80">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span> : null}
    </div>
  );
}
