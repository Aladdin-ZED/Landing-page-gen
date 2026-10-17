"use client";
/**
 * One offer, expanded (docs/OFFERS.md §H.4): the contents composer (tap a product to add a piece;
 * content chips with ×n; a chip opens its panel: quantity, gift, label, "let the customer choose",
 * option rules fix / limit / preset, remove), the price (Total | Discount %, compare-at with the
 * automatic reference as placeholder, live "Dès" / per-unit / saving), the visual (automatic
 * composition | 1–4 custom photos with an arrangement) and the details (title, short, subtitle,
 * perks, badge, selected first, free delivery when the fee is > 0, gift, sold out).
 *
 * Shared by the builder's Offers panel and the generate wizard's Offers step. Controlled: every
 * change calls `onChange(next, coalesce)` with a schema-valid offer.
 */
import { Check, ChevronDown, Gift, ImagePlus, Lock, Minus, Plus, Shuffle, SlidersHorizontal, Split, Tag, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { CroppedImg } from "@/components/admin/items/crop-dialog";
import type { PhotoSource } from "@/components/admin/items/photo-well";
import { Dot } from "@/components/admin/variants";
import { DraftInput, EASE, MoneyInput } from "@/components/admin/variants/parts";
import { NumberInput } from "@/components/builder/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { autoOfferName, itemName, itemShort, itemVisual, offerShort, offerUnits } from "@/lib/page/catalog";
import { feature } from "@/lib/page/features";
import { formatMoney } from "@/lib/markets/money";
import { fromCents, offerMath } from "@/lib/page/pricing";
import { BADGES, isChoicePick, isFixedPick, LIMITS, VISUAL_ARRANGES, type AssetRef, type Item, type LineRule, type Offer, type OfferLine, type PageDoc } from "@/lib/page/schema";
import { sheetPreview } from "@/lib/orders/text";
import { cn } from "@/lib/utils";
import { MiniVisual } from "./mini-visual";
import { addUnit, patchLine, priceForDiscount, removeLine, roomFor, ruleTargets, setChoice, setChoiceFlags, setFree, setQty, setRule, splitUnit } from "./model";
import { contentsLine } from "./text";

export type OffersDoc = Pick<PageDoc, "items" | "offers" | "product" | "locale" | "currency">;

export interface OfferEditorProps {
  offer: Offer;
  doc: OffersDoc;
  photos: PhotoSource;
  onChange: (next: Offer, coalesce?: string | null) => void;
  compact?: boolean;
}

const BADGE_UI: Record<(typeof BADGES)[number], string> = { none: "None", popular: "Popular", best: "Best price", custom: "Custom" };
const ARRANGE_UI: Record<(typeof VISUAL_ARRANGES)[number], string> = { auto: "Lead + side", row: "Row", overlap: "Overlap", grid: "Grid" };

export function OfferEditor({ offer, doc, photos, onChange, compact = true }: OfferEditorProps) {
  const [section, setSection] = useState<string>("contents");
  const multi = feature("MULTI_ITEM");
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1">
      <Section id="contents" title="Contents" open={section === "contents"} onToggle={setSection} summary={contentsLine(doc, offer)}>
        <Contents offer={offer} doc={doc} photos={photos} onChange={onChange} multi={multi} compact={compact} />
      </Section>
      <Section id="price" title="Price" open={section === "price"} onToggle={setSection} summary={<PriceSummary offer={offer} doc={doc} />}>
        <PriceEditor offer={offer} doc={doc} onChange={onChange} />
      </Section>
      <Section id="visual" title="Visual" open={section === "visual"} onToggle={setSection} summary={offer.visual.mode === "auto" ? "Automatic" : `${offer.visual.images.length} photo${offer.visual.images.length === 1 ? "" : "s"}`}>
        <VisualEditor offer={offer} doc={doc} photos={photos} onChange={onChange} />
      </Section>
      <Section id="details" title="Details" open={section === "details"} onToggle={setSection} summary={[offer.title ? `“${offer.title}”` : null, offer.badge !== "none" ? BADGE_UI[offer.badge] : null, offer.preselected ? "Selected first" : null, offer.gift ? "Gift" : null, offer.soldOut ? "Sold out" : null].filter(Boolean).join(" · ") || "Automatic name"}>
        <DetailsEditor offer={offer} doc={doc} photos={photos} onChange={onChange} />
      </Section>
    </div>
  );
}

function Section({ id, title, open, onToggle, summary, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; summary: ReactNode; children: ReactNode }) {
  const bodyId = useId();
  return (
    <div className="grid border-t border-foreground/[0.06] first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => onToggle(open ? "" : id)}
        className="flex min-h-10 w-full items-center gap-2 px-3 text-start outline-none transition-colors hover:bg-foreground/[0.025] focus-visible:bg-foreground/[0.04]"
      >
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-300", !open && "-rotate-90 rtl:rotate-90")} />
        <span className="shrink-0 text-[12.5px] font-semibold">{title}</span>
        {!open ? <span className="min-w-0 flex-1 truncate text-end text-[11.5px] text-muted-foreground">{summary}</span> : null}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div id={bodyId} key="b" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.26, ease: EASE }} className="overflow-hidden">
            <div className="grid min-w-0 grid-cols-1 gap-3 px-3 pt-1 pb-3.5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* contents                                                            */
/* ------------------------------------------------------------------ */

function Thumb({ item, doc, photos, className }: { item: Item | undefined; doc: OffersDoc; photos: PhotoSource; className?: string }) {
  if (!item) return <span className={cn("block rounded-lg bg-muted", className)} />;
  const v = itemVisual(doc, item, { asset: (r) => (r && photos.info(r.id)?.url ? ({ id: r.id } as never) : null) });
  const info = v.ref ? photos.info(v.ref.id) : null;
  if (!info?.url) return <span className={cn("grid place-items-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground", className)}>{itemName(doc, item).slice(0, 1).toUpperCase()}</span>;
  return <CroppedImg src={info.url} box={v.box} ratio={info.width / Math.max(1, info.height)} className={cn("rounded-lg", className)} />;
}

function Contents({ offer, doc, photos, onChange, multi, compact }: { offer: Offer; doc: OffersDoc; photos: PhotoSource; onChange: OfferEditorProps["onChange"]; multi: boolean; compact: boolean }) {
  const [openLine, setOpenLine] = useState<string | null>(null);
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const units = offerUnits(offer);
  const name = (id: string) => {
    const it = byId.get(id);
    return it ? itemShort(doc, it) : id;
  };
  const shelf = doc.items;
  const sheet = useMemo(() => sheetPreview(doc, offer), [doc, offer]);
  const active = offer.lines.find((l) => l.id === openLine);

  return (
    <>
      {multi && shelf.length > 1 ? (
        <div className="grid gap-1.5">
          <span className="text-[11.5px] text-muted-foreground">Tap a product to add a piece</span>
          <div className="flex flex-wrap gap-1.5">
            {shelf.map((it) => (
              <button
                key={it.id}
                type="button"
                disabled={!roomFor(offer) || it.soldOut}
                onClick={() => onChange(addUnit(offer, it.id))}
                className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-background ps-0.5 pe-2 text-[11.5px] font-medium ring-1 ring-foreground/10 outline-none transition-[box-shadow,background-color] hover:bg-brand-soft/50 hover:ring-brand/35 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45"
              >
                <Thumb item={it} doc={doc} photos={photos} className="size-6 rounded-full" />
                <bdi className="max-w-[6.5rem] truncate">{itemShort(doc, it)}</bdi>
                <Plus className="size-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <ul className="flex flex-wrap gap-1.5" aria-label="Contents of this offer">
        {offer.lines.map((l) => {
          const fp = isFixedPick(l.pick) ? l.pick : null;
          const cp = isChoicePick(l.pick) ? l.pick : null;
          const fixed = !!fp;
          const label = fp ? name(fp.item) : l.qty > 1 ? `${l.qty} to choose` : "Customer's choice";
          const lockText = fp && l.rules ? ruleText(byId.get(fp.item), l.rules) : "";
          const on = openLine === l.id;
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpenLine(on ? null : l.id)}
                className={cn(
                  "inline-flex h-9 max-w-full items-center gap-1.5 rounded-xl bg-background ps-1 pe-2 text-[12.5px] font-medium ring-1 outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-ring/60",
                  on ? "ring-2 ring-foreground/70" : "ring-foreground/12 hover:ring-foreground/25",
                  l.free && "bg-brand-soft/40",
                )}
              >
                {fixed ? (
                  <Thumb item={byId.get(fp!.item)} doc={doc} photos={photos} className="size-7" />
                ) : (
                  <span className="relative flex size-7 shrink-0">
                    {(cp?.choice ?? []).slice(0, 2).map((id, i) => (
                      <Thumb key={id} item={byId.get(id)} doc={doc} photos={photos} className={cn("absolute size-5 ring-2 ring-background", i === 0 ? "start-0 top-0" : "end-0 bottom-0")} />
                    ))}
                  </span>
                )}
                <bdi className="max-w-[9rem] truncate">{l.label?.trim() || label}</bdi>
                {fixed && l.qty > 1 ? (
                  <span className="rounded-md bg-foreground/[0.06] px-1 text-[11px] tabular-nums">
                    <bdi dir="ltr">×{l.qty}</bdi>
                  </span>
                ) : null}
                {lockText ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                    <Lock className="size-3" />
                    <bdi className="max-w-[6rem] truncate">{lockText}</bdi>
                  </span>
                ) : null}
                {l.free ? <Gift className="size-3.5 text-brand" aria-label="Gift" /> : null}
                {!fixed ? <Shuffle className="size-3.5 text-muted-foreground" aria-label="Customer's choice" /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence initial={false} mode="wait">
        {active ? (
          <motion.div key={active.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
            <LinePanel
              offer={offer}
              line={active}
              doc={doc}
              photos={photos}
              multi={multi}
              compact={compact}
              onChange={onChange}
              onClose={() => setOpenLine(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid gap-1 rounded-xl bg-foreground/[0.025] px-3 py-2.5 ring-1 ring-inset ring-foreground/[0.05]">
        <p className="text-[12px] leading-snug" dir="auto">
          {contentsLine(doc, offer)}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="shrink-0">In Google Sheets:</span>
          <bdi dir="auto" className="min-w-0 truncate font-mono text-[10.5px] text-foreground/80">
            {sheet || `x${units}`}
          </bdi>
        </p>
      </div>
    </>
  );
}

function ruleText(item: Item | undefined, rules: NonNullable<OfferLine["rules"]>): string {
  if (!item) return "";
  const parts: string[] = [];
  for (const t of ruleTargets(item)) {
    const r = rules[t.key];
    if (!r) continue;
    const label = (id: string) => t.values.find((v) => v.id === id)?.label ?? id;
    if ("lock" in r) parts.push(label(r.lock));
    else if ("allow" in r) parts.push(r.allow.map(label).join("/"));
  }
  return parts.join(", ");
}

function LinePanel({ offer, line: l, doc, photos, multi, compact, onChange, onClose }: { offer: Offer; line: OfferLine; doc: OffersDoc; photos: PhotoSource; multi: boolean; compact: boolean; onChange: OfferEditorProps["onChange"]; onClose: () => void }) {
  const byId = new Map(doc.items.map((it) => [it.id, it]));
  const fp = isFixedPick(l.pick) ? l.pick : null;
  const cp = isChoicePick(l.pick) ? l.pick : null;
  const fixed = !!fp;
  const item = fp ? byId.get(fp.item) : undefined;
  const targets = item && feature("RULES") ? ruleTargets(item) : [];
  const paidLeft = offer.lines.filter((x) => !x.free && x.id !== l.id).length;
  const labelId = useId();
  const max = Math.min(20, LIMITS.unitsPerOffer - (offerUnits(offer) - l.qty), cp?.distinct ? cp.choice.length : 20);
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl bg-background p-3 ring-1 ring-foreground/12 shadow-[0_8px_24px_-16px_rgb(0_0_0/0.3)]">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[12.5px] font-semibold">
          <bdi>{fp ? itemName(doc, item ?? { name: fp.item }) : "Customer's choice"}</bdi>
        </span>
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center rounded-full bg-foreground/[0.05] ring-1 ring-inset ring-foreground/[0.06]">
            <Button type="button" variant="ghost" size="icon-xs" aria-label="One piece less" disabled={l.qty <= 1} onClick={() => onChange(setQty(offer, l.id, l.qty - 1))} className="rounded-full">
              <Minus />
            </Button>
            <span className="min-w-6 text-center text-[12.5px] font-semibold tabular-nums" aria-live="polite">
              {l.qty}
            </span>
            <Button type="button" variant="ghost" size="icon-xs" aria-label="One piece more" disabled={l.qty >= max} onClick={() => onChange(setQty(offer, l.id, l.qty + 1))} className="rounded-full">
              <Plus />
            </Button>
          </span>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Close" onClick={onClose} className="text-muted-foreground">
            <X />
          </Button>
        </div>
      </div>

      {multi ? (
        <div className="flex flex-wrap gap-1.5">
          <Toggle
            on={l.free}
            disabled={!l.free && paidLeft === 0}
            hint={!l.free && paidLeft === 0 ? "An offer keeps one paid line" : undefined}
            onClick={() => {
              const next = setFree(offer, l.id, !l.free);
              if (next) onChange(next);
            }}
            icon={<Gift />}
          >
            {l.free ? "Gift (free)" : "Make it a gift"}
          </Toggle>
          {doc.items.length > 1 ? (
            <Toggle
              on={!fixed}
              onClick={() => {
                if (fp) onChange(setChoice(offer, l.id, [fp.item, ...doc.items.filter((x) => x.id !== fp.item && !x.soldOut).slice(0, 1).map((x) => x.id)]));
                else if (cp) onChange(setChoice(offer, l.id, [cp.choice[0]!]));
              }}
              icon={<Shuffle />}
            >
              {fixed ? "Let the customer choose" : "Customer chooses"}
            </Toggle>
          ) : null}
          {fixed && l.qty > 1 && offer.lines.length < LIMITS.linesPerOffer ? (
            <Toggle on={false} onClick={() => onChange(splitUnit(offer, l.id))} icon={<Split />}>
              Split one piece off
            </Toggle>
          ) : null}
        </div>
      ) : null}

      {cp ? (
        <div className="grid gap-2">
          <span className="text-[11.5px] text-muted-foreground">Products to choose from (2–8)</span>
          <div className="flex flex-wrap gap-1.5">
            {doc.items.map((it) => {
              const on = cp.choice.includes(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && cp.choice.length >= 8}
                  onClick={() => onChange(setChoice(offer, l.id, on ? cp.choice.filter((x) => x !== it.id) : [...cp.choice, it.id]))}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full ps-1 pe-2.5 text-[12px] font-medium ring-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                    on ? "bg-foreground text-background ring-foreground" : "bg-background text-muted-foreground ring-foreground/12 hover:text-foreground",
                  )}
                >
                  <Thumb item={it} doc={doc} photos={photos} className="size-6 rounded-full" />
                  <bdi className="max-w-[8rem] truncate">{itemShort(doc, it)}</bdi>
                  {on ? <Check className="size-3.5" /> : null}
                </button>
              );
            })}
          </div>
          <label className="flex items-center justify-between gap-3 text-[12px]">
            <span className="grid">
              <span className="font-medium">All different</span>
              <span className="text-[11px] text-muted-foreground">No piece twice (e.g. 2 different creams)</span>
            </span>
            <Switch size="sm" checked={cp.distinct} disabled={l.qty > cp.choice.length} onCheckedChange={(distinct) => onChange(setChoiceFlags(offer, l.id, { distinct }))} />
          </label>
          <label className="flex items-center justify-between gap-3 text-[12px]">
            <span className="grid">
              <span className="font-medium">Price follows the choice</span>
              <span className="text-[11px] text-muted-foreground">Pricier products cost their difference (“+50”)</span>
            </span>
            <Switch size="sm" checked={cp.surcharge === "difference"} onCheckedChange={(on) => onChange(setChoiceFlags(offer, l.id, { surcharge: on ? "difference" : "none" }))} />
          </label>
        </div>
      ) : null}

      {targets.length ? <RulesEditor line={l} targets={targets} onRule={(key, rule) => onChange(setRule(offer, l.id, key, rule))} /> : null}

      <div className="grid gap-1">
        <label htmlFor={labelId} className="text-[11.5px] text-muted-foreground">
          Heading on the order form (optional)
        </label>
        <DraftInput
          id={labelId}
          dir="auto"
          value={l.label ?? ""}
          maxLength={40}
          placeholder={l.free ? "e.g. Votre cadeau" : "e.g. Votre 2e parfum"}
          onCommit={(v) => onChange(patchLine(offer, l.id, { label: v }), `line:${offer.id}:${l.id}:label`)}
          className={cn("text-[12.5px]", compact ? "h-8" : "h-9")}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!removeLine(offer, l.id)}
          onClick={() => {
            const next = removeLine(offer, l.id);
            if (next) {
              onChange(next);
              onClose();
            }
          }}
          className="rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 />
          Remove from the offer
        </Button>
      </div>
    </div>
  );
}

function Toggle({ on, onClick, icon, children, disabled, hint }: { on: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; disabled?: boolean; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      title={hint}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45 [&_svg]:size-3.5",
        on ? "bg-brand-soft text-brand ring-brand/30" : "text-muted-foreground ring-foreground/12 hover:text-foreground hover:ring-foreground/25",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

type Target = ReturnType<typeof ruleTargets>[number];

/** Fix an option (lock) or limit them (allow + preset) for every piece of this line. */
function RulesEditor({ line: l, targets, onRule }: { line: OfferLine; targets: Target[]; onRule: (key: string, rule: LineRule | null) => void }) {
  const count = Object.keys(l.rules ?? {}).length;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-2.5 rounded-xl bg-foreground/[0.025] p-2.5 ring-1 ring-inset ring-foreground/[0.05]">
      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground/80">
        <SlidersHorizontal className="size-3.5 text-brand" />
        Options for {l.qty > 1 ? `these ${l.qty} pieces` : "this piece"}
      </span>
      {targets.map((t) => {
        const r = l.rules?.[t.key];
        const mode: "any" | "lock" | "allow" = !r ? "any" : "lock" in r ? "lock" : "allow" in r ? "allow" : "any";
        const preset = r && "preset" in r ? r.preset : undefined;
        const full = !r && count >= LIMITS.rulesPerLine;
        return (
          <div key={t.key} className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <bdi className="text-[12px] font-medium">{t.name}</bdi>
              <Segmented<"any" | "lock" | "allow">
                size="sm"
                label={`${t.name}: rule`}
                value={mode}
                onChange={(m) => {
                  if (full && m !== "any") return;
                  const first = t.values.find((v) => !v.soldOut)?.id ?? t.values[0]!.id;
                  if (m === "any") onRule(t.key, preset && mode === "any" ? { preset } : null);
                  else if (m === "lock") onRule(t.key, { lock: (r && "lock" in r ? r.lock : undefined) ?? first });
                  else onRule(t.key, { allow: t.values.filter((v) => !v.soldOut).map((v) => v.id).slice(0, 40) });
                }}
                options={[
                  { value: "any", label: "Customer picks" },
                  { value: "lock", label: "Fixed" },
                  { value: "allow", label: "Limited" },
                ]}
              />
            </div>
            {mode !== "any" || preset ? (
              <div className="flex flex-wrap gap-1">
                {t.values.map((v) => {
                  const on = mode === "lock" ? r && "lock" in r && r.lock === v.id : mode === "allow" ? r && "allow" in r && r.allow.includes(v.id) : preset === v.id;
                  const isPreset = preset === v.id;
                  return (
                    <span key={v.id} className="inline-flex">
                      <button
                        type="button"
                        aria-pressed={!!on}
                        onClick={() => {
                          if (mode === "lock") onRule(t.key, { lock: v.id });
                          else if (mode === "allow" && r && "allow" in r) {
                            const allow = on ? r.allow.filter((x) => x !== v.id) : [...r.allow, v.id];
                            if (!allow.length) return;
                            const p = r.preset && allow.includes(r.preset) ? r.preset : undefined;
                            onRule(t.key, p ? { allow, preset: p } : { allow });
                          } else onRule(t.key, isPreset ? null : { preset: v.id });
                        }}
                        className={cn(
                          "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium ring-1 ring-inset outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                          on ? "bg-foreground text-background ring-foreground" : "bg-background text-muted-foreground ring-foreground/12 hover:text-foreground",
                          v.soldOut && "line-through opacity-60",
                        )}
                      >
                        {v.swatch ? <Dot hex={v.swatch} size="xs" /> : null}
                        <bdi>{v.label}</bdi>
                      </button>
                      {mode === "allow" && on && r && "allow" in r ? (
                        <button
                          type="button"
                          aria-pressed={isPreset}
                          aria-label={`Start on ${v.label}`}
                          title="Selected first"
                          onClick={() => onRule(t.key, isPreset ? { allow: r.allow } : { allow: r.allow, preset: v.id })}
                          className={cn("ms-0.5 grid size-7 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60", isPreset ? "text-brand" : "text-muted-foreground/50 hover:text-foreground")}
                        >
                          <span className={cn("size-2 rounded-full", isPreset ? "bg-brand" : "ring-1 ring-current")} />
                        </button>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            ) : (
              <button type="button" disabled={full} onClick={() => onRule(t.key, { preset: t.values.find((v) => !v.soldOut)?.id ?? t.values[0]!.id })} className="justify-self-start text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50">
                Choose what it starts on
              </button>
            )}
            <p className="text-[11px] leading-snug text-muted-foreground">
              {mode === "lock" ? "Shown as a fixed chip (“Couleur : Noir”); the server fills it." : mode === "allow" ? "Other values are hidden for these pieces; the dot marks the one selected first." : preset ? "Starts on this value; the customer can change it." : "Every available value is offered."}
            </p>
          </div>
        );
      })}
      {count >= LIMITS.rulesPerLine ? <p className="text-[11px] text-muted-foreground">3 rules per line at most.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* price                                                               */
/* ------------------------------------------------------------------ */

function PriceSummary({ offer, doc }: { offer: Offer; doc: OffersDoc }) {
  const m = offerMath(doc, offer);
  const money = (c: number) => formatMoney(fromCents(c), doc.currency, "en");
  return (
    <span className="tabular-nums">
      {m.variable ? "from " : ""}
      {money(m.from)}
      {m.showReference ? ` · −${m.savingsPct}%` : ""}
    </span>
  );
}

function PriceEditor({ offer, doc, onChange }: { offer: Offer; doc: OffersDoc; onChange: OfferEditorProps["onChange"] }) {
  const [mode, setMode] = useState<"total" | "pct">("total");
  const m = offerMath(doc, offer);
  const auto = offerMath(doc, { ...offer, compareAt: undefined });
  const money = (c: number) => formatMoney(fromCents(c), doc.currency, "en");
  const ref = fromCents(auto.reference);
  const pct = ref > 0 ? Math.round((1 - offer.price / ref) * 100) : 0;
  const ids = { price: useId(), compare: useId(), pct: useId() };
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted-foreground">Set the price as</span>
        <Segmented<"total" | "pct">
          size="sm"
          label="Price mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: "total", label: "Total" },
            { value: "pct", label: "Discount %" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {mode === "total" ? (
          <div className="grid gap-1">
            <label htmlFor={ids.price} className="text-[11.5px] font-medium text-foreground/80">
              Price of the offer
            </label>
            <MoneyInput id={ids.price} value={offer.price} currency={doc.currency} ariaLabel="Offer price" onCommit={(v) => onChange({ ...offer, price: v ?? 0 }, `offer:${offer.id}:price`)} />
          </div>
        ) : (
          <div className="grid gap-1">
            <label htmlFor={ids.pct} className="text-[11.5px] font-medium text-foreground/80">
              Off {money(auto.reference)}
            </label>
            <NumberInput
              id={ids.pct}
              value={Math.max(0, pct)}
              min={1}
              max={90}
              integer
              suffix="%"
              ariaLabel="Discount in percent"
              onCommit={(v) => v !== undefined && onChange({ ...offer, price: priceForDiscount(ref, v, doc.currency) }, `offer:${offer.id}:pct`)}
            />
            <span className="text-[11px] text-muted-foreground tabular-nums">= {formatMoney(offer.price, doc.currency, "en")} (rounded)</span>
          </div>
        )}
        <div className="grid gap-1">
          <label htmlFor={ids.compare} className="text-[11.5px] font-medium text-foreground/80">
            Compare at
          </label>
          <MoneyInput
            id={ids.compare}
            value={offer.compareAt}
            optional
            placeholder={String(fromCents(auto.reference))}
            currency={doc.currency}
            ariaLabel="Compare-at total"
            onCommit={(v) => {
              const next = { ...offer };
              if (v !== undefined && v > 0) next.compareAt = v;
              else delete next.compareAt;
              onChange(next, `offer:${offer.id}:compare`);
            }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 rounded-xl bg-foreground/[0.025] p-2.5 text-center ring-1 ring-inset ring-foreground/[0.05]">
        <Stat label={m.variable ? "Card shows from" : "Card shows"} value={money(m.from)} />
        <Stat label={m.showReference ? `Saving · −${m.savingsPct}%` : "Saving"} value={m.showReference ? `−${money(m.savings)}` : "—"} tone={m.showReference ? "good" : undefined} />
        <Stat label="Per piece" value={m.perUnit !== null ? money(m.perUnit) : "—"} />
      </dl>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {offer.compareAt === undefined
          ? `The struck price is the pieces bought alone (${money(auto.reference)}). Only enter a compare-at you really sold at.`
          : offer.compareAt < offer.price
            ? "“Compare at” is lower than the price: no saving is shown."
            : "A compare-at replaces the automatic reference; it must be a real previous price."}
        {m.variable ? " Options or choices can cost more, so the card says “Dès”." : ""}
      </p>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="truncate text-[10.5px] text-muted-foreground">{label}</dt>
      <dd className={cn("truncate text-[12.5px] font-semibold tabular-nums", tone === "good" && "text-success-ink")}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* visual                                                              */
/* ------------------------------------------------------------------ */

function VisualEditor({ offer, doc, photos, onChange }: { offer: Offer; doc: OffersDoc; photos: PhotoSource; onChange: OfferEditorProps["onChange"] }) {
  const v = offer.visual;
  const custom = v.mode === "custom" ? v : null;
  const toggle = (ref: AssetRef) => {
    const list = custom?.images ?? [];
    const has = list.some((r) => r.id === ref.id);
    const images = has ? list.filter((r) => r.id !== ref.id) : [...list, { id: ref.id, alt: ref.alt }].slice(0, LIMITS.customVisualPhotos);
    onChange({ ...offer, visual: images.length ? { mode: "custom", images, arrange: custom?.arrange ?? "auto" } : { mode: "auto" } });
  };
  const extra = (custom?.images ?? []).filter((r) => !photos.photos.some((p) => p.ref.id === r.id));
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Segmented<"auto" | "custom">
          size="sm"
          label="Visual"
          value={v.mode}
          onChange={(mode) => onChange({ ...offer, visual: mode === "auto" ? { mode: "auto" } : { mode: "custom", images: custom?.images ?? (photos.photos[0] ? [{ id: photos.photos[0].ref.id, alt: photos.photos[0].ref.alt }] : []), arrange: custom?.arrange ?? "auto" } })}
          options={[
            { value: "auto", label: "Automatic" },
            { value: "custom", label: "Your photos" },
          ]}
        />
        <MiniVisual doc={doc} offer={offer} source={photos} size="md" className="h-16 w-24" />
      </div>
      {v.mode === "auto" ? (
        <p className="text-[11.5px] leading-snug text-muted-foreground">Composed from the products’ own photos (crops included); it follows the customer’s choices.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {[...photos.photos.map((p) => p.ref), ...extra].map((ref) => {
              const at = custom?.images.findIndex((r) => r.id === ref.id) ?? -1;
              const info = photos.info(ref.id);
              return (
                <button
                  key={ref.id}
                  type="button"
                  aria-pressed={at >= 0}
                  aria-label={at >= 0 ? `Photo ${at + 1} of the visual` : "Add this photo"}
                  disabled={at < 0 && (custom?.images.length ?? 0) >= LIMITS.customVisualPhotos}
                  onClick={() => toggle(ref)}
                  className={cn("relative size-12 overflow-hidden rounded-lg bg-muted outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40", at >= 0 ? "ring-2 ring-foreground/70" : "opacity-60 ring-1 ring-foreground/10 hover:opacity-100")}
                >
                  {info?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                    <img src={info.url} alt="" className="size-full object-cover" draggable={false} />
                  ) : null}
                  {at >= 0 ? <span className="absolute end-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-foreground text-[9px] font-semibold text-background">{at + 1}</span> : null}
                </button>
              );
            })}
            {photos.pick ? (
              <button
                type="button"
                aria-label="Add a photo from the library"
                disabled={(custom?.images.length ?? 0) >= LIMITS.customVisualPhotos}
                onClick={async () => {
                  const ref = await photos.pick!("Photo for this offer");
                  if (ref) toggle(ref);
                }}
                className="grid size-12 place-items-center rounded-lg border border-dashed border-foreground/20 text-muted-foreground outline-none hover:border-brand/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
              >
                <ImagePlus className="size-4" />
              </button>
            ) : null}
          </div>
          {custom && custom.images.length > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11.5px] text-muted-foreground">Arrangement</span>
              <Segmented<(typeof VISUAL_ARRANGES)[number]>
                size="sm"
                label="Arrangement"
                value={custom.arrange}
                onChange={(arrange) => onChange({ ...offer, visual: { ...custom, arrange } })}
                options={VISUAL_ARRANGES.map((a) => ({ value: a, label: ARRANGE_UI[a] }))}
              />
            </div>
          ) : null}
          <p className="text-[11.5px] leading-snug text-muted-foreground">1–4 photos (e.g. the photo of both creams + the sérum). Group photos are shown whole, never cropped; your photos never swap with the customer’s choices.</p>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* details                                                             */
/* ------------------------------------------------------------------ */

function DetailsEditor({ offer, doc, photos, onChange }: { offer: Offer; doc: OffersDoc; photos: PhotoSource; onChange: OfferEditorProps["onChange"] }) {
  const ids = { title: useId(), short: useId(), sub: useId(), badge: useId(), gift: useId(), pre: useId(), ship: useId(), sold: useId() };
  const auto = autoOfferName({ doc }, offer);
  const autoShort = offerShort({ doc }, { lines: offer.lines });
  const set = (patch: Partial<Offer>, coalesce?: string) => {
    const next = { ...offer, ...patch } as Offer;
    for (const k of Object.keys(patch) as (keyof Offer)[]) if (patch[k] === undefined) delete next[k];
    onChange(next, coalesce ?? null);
  };
  return (
    <>
      <Row label="Title" htmlFor={ids.title} count={offer.title?.length ?? 0} max={60}>
        <DraftInput id={ids.title} dir="auto" value={offer.title ?? ""} maxLength={60} placeholder={auto} onCommit={(v) => set({ title: v.trim() ? v : undefined }, `offer:${offer.id}:title`)} className="h-8 text-[13px]" />
      </Row>
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2.5">
        <Row label="Short label" htmlFor={ids.short} count={offer.short?.length ?? 0} max={14}>
          <DraftInput id={ids.short} dir="auto" value={offer.short ?? ""} maxLength={14} placeholder={autoShort} onCommit={(v) => set({ short: v.trim() ? v : undefined }, `offer:${offer.id}:short`)} className="h-8 text-[13px]" />
        </Row>
        <Row label="Subtitle" htmlFor={ids.sub}>
          <DraftInput id={ids.sub} dir="auto" value={offer.subtitle ?? ""} maxLength={90} placeholder="Optional" onCommit={(v) => set({ subtitle: v.trim() ? v : undefined }, `offer:${offer.id}:subtitle`)} className="h-8 text-[13px]" />
        </Row>
      </div>
      <Perks offer={offer} onChange={(perks) => onChange({ ...offer, perks }, `offer:${offer.id}:perks`)} />
      <div className="grid gap-1.5">
        <span className="text-[11.5px] font-medium text-foreground/80">Badge</span>
        <Segmented<(typeof BADGES)[number]> size="sm" label="Badge" value={offer.badge} onChange={(badge) => set({ badge, ...(badge !== "custom" ? { badgeText: undefined } : {}) })} options={BADGES.map((b) => ({ value: b, label: BADGE_UI[b] }))} />
        {offer.badge === "custom" ? <DraftInput dir="auto" value={offer.badgeText ?? ""} maxLength={28} placeholder="e.g. 1 + 1 offert" aria-label="Badge text" onCommit={(v) => set({ badgeText: v.trim() ? v : undefined }, `offer:${offer.id}:badge`)} className="h-8 text-[13px]" /> : null}
      </div>
      <div className="grid gap-2">
        <SwitchRow id={ids.pre} checked={offer.preselected} onChange={(preselected) => set({ preselected })} title="Selected when the page opens" />
        {doc.offers.shippingFee > 0 ? <SwitchRow id={ids.ship} checked={offer.freeShipping} onChange={(freeShipping) => set({ freeShipping })} title="Free delivery" hint={`No ${formatMoney(doc.offers.shippingFee, doc.currency, "en")} delivery fee on this offer.`} /> : null}
        <SwitchRow id={ids.gift} checked={!!offer.gift} onChange={(on) => set({ gift: on ? { label: doc.locale === "ar" ? "هدية" : doc.locale === "fr" ? "Cadeau offert" : "Free gift" } : undefined })} title="Gift (not a product of the page)" hint="Shown on the card and the summary, and written in the order (CADEAU)." />
        {offer.gift ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl bg-foreground/[0.025] p-2.5 ring-1 ring-inset ring-foreground/[0.05]">
            <Row label="Gift" htmlFor={`${ids.gift}-l`}>
              <DraftInput id={`${ids.gift}-l`} dir="auto" value={offer.gift.label} maxLength={60} clean={(raw) => (raw.trim() ? raw.slice(0, 60) : null)} onCommit={(label) => set({ gift: { ...offer.gift!, label } }, `offer:${offer.id}:gift`)} className="h-8 text-[13px]" />
            </Row>
            <GiftPhoto value={offer.gift.image} photos={photos} onChange={(image) => set({ gift: image ? { ...offer.gift!, image } : { label: offer.gift!.label } })} />
          </div>
        ) : null}
        <SwitchRow id={ids.sold} checked={offer.soldOut} onChange={(soldOut) => set({ soldOut })} title="Sold out" hint="Shown “Épuisé”; it can't be ordered." />
      </div>
    </>
  );
}

function GiftPhoto({ value, photos, onChange }: { value: AssetRef | undefined; photos: PhotoSource; onChange: (v: AssetRef | undefined) => void }) {
  const info = value ? photos.info(value.id) : null;
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label={value ? "Change the gift photo" : "Add a gift photo"}
        disabled={!photos.pick}
        onClick={async () => {
          const ref = await photos.pick?.("Photo of the gift");
          if (ref) onChange(ref);
        }}
        className="grid size-8 place-items-center overflow-hidden rounded-lg bg-background text-muted-foreground ring-1 ring-foreground/12 outline-none hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-45"
      >
        {info?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
          <img src={info.url} alt="" className="size-full object-cover" />
        ) : (
          <Tag className="size-3.5" />
        )}
      </button>
      {value ? (
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove the gift photo" onClick={() => onChange(undefined)} className="text-muted-foreground">
          <X />
        </Button>
      ) : null}
    </span>
  );
}

function Perks({ offer, onChange }: { offer: Offer; onChange: (perks: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim().slice(0, 40);
    if (!v || offer.perks.length >= LIMITS.perks) return;
    onChange([...offer.perks, v]);
    setDraft("");
  };
  return (
    <div className="grid gap-1.5">
      <span className="text-[11.5px] font-medium text-foreground/80">
        Perks <span className="font-normal text-muted-foreground">(up to 3 short bullets)</span>
      </span>
      {offer.perks.length ? (
        <ul className="grid gap-1">
          {offer.perks.map((p, i) => (
            <li key={`${p}:${i}`} className="flex items-center gap-1.5">
              <Check className="size-3.5 shrink-0 text-brand" />
              <DraftInput dir="auto" value={p} maxLength={40} clean={(raw) => (raw.trim() ? raw.slice(0, 40) : null)} aria-label={`Perk ${i + 1}`} onCommit={(v) => onChange(offer.perks.map((x, j) => (j === i ? v : x)))} className="h-7 flex-1 text-[12.5px]" />
              <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove perk ${i + 1}`} onClick={() => onChange(offer.perks.filter((_, j) => j !== i))} className="text-muted-foreground">
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {offer.perks.length < LIMITS.perks ? (
        <div className="flex gap-1.5">
          <input
            dir="auto"
            value={draft}
            maxLength={40}
            placeholder="e.g. Routine matin + soir"
            aria-label="New perk"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <Button type="button" variant="outline" size="sm" disabled={!draft.trim()} onClick={add}>
            <Plus />
            Add
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, htmlFor, count, max, children }: { label: string; htmlFor?: string; count?: number; max?: number; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[11.5px] font-medium text-foreground/80">
          {label}
        </label>
        {max !== undefined && count ? <span className={cn("font-mono text-[10px] tabular-nums text-muted-foreground", count >= max && "text-warn-ink")}>{`${count}/${max}`}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SwitchRow({ id, checked, onChange, title, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; title: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start justify-between gap-3">
      <span className="grid min-w-0 gap-0.5">
        <span className="text-[12.5px] font-medium">{title}</span>
        {hint ? <span className="text-[11px] leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}
