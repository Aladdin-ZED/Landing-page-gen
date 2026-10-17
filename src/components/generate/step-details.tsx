"use client";
/**
 * Step 3 — product details: name, price, the product's options right under them (colors, sizes…:
 * the shared options editor, src/components/admin/variants), category (pre-filled by the AI), the
 * 3–5 facts the merchant can stand behind, page language and market, whether the on-device model
 * writes the copy, and — until per-page pixels (PAGE_PIXELS) move the answer to the Directions
 * step — which store ad pixels the page fires. The options editor takes combined options and
 * custom fields when their editor features are on. A live summary card mirrors what the page will
 * promise. More products and the offers come next (Offers step).
 */
import { LanguagesIcon, MinusIcon, PenLineIcon, PlusIcon, RadarIcon, ShoppingBagIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dot, VariantsEditor, type VariantPhoto } from "@/components/admin/variants";
import { formatMoney, marketName } from "@/lib/markets/info";
import { feature } from "@/lib/page/features";
import { MARKETS, dirOf, isChoiceGroup, isMatrixGroup, type Market, type ProductCategory } from "@/lib/page/schema";
import type { VariantPreset } from "@/lib/page/variant-presets";
import { cn } from "@/lib/utils";
import { CATEGORY_GROUPS, CATEGORY_LABELS, PAGE_LOCALES, type PageLocale } from "./labels";
import { Panel } from "./parts";
import type { Details, Photo } from "./state";
import { TrackingBlock, type PixelStore } from "./tracking";

export const MAX_FACTS = 5;

export interface StepDetailsProps {
  details: Details;
  onChange(patch: Partial<Details>): void;
  currency: string;
  main: Photo | null;
  /** cutout used on the hero stage (shown in the summary) */
  cutoutUrl: string | null;
  /** the AI's category guess, if any */
  suggested: ProductCategory | null;
  errors: { name?: string; price?: string };
  /** on-device copywriter availability */
  copywriter: { available: boolean; note: string };
  /** the uploaded photos, linkable to options (main first) */
  variantPhotos: readonly VariantPhoto[];
  /** presets the product probably needs and colors the photo reading described (suggestions only) */
  variantSuggest: { presets: readonly VariantPreset[]; colors: readonly string[] };
  /** the option whose photo leads the page (hero), when options are linked to photos */
  lead: { label: string; url: string | null } | null;
  /** the store's ad pixels (Settings → Pixels) */
  pixels: PixelStore;
}

/** "199", "199,90", "1 299" → 199 / 199.9 / 1299; NaN when not a price. */
export function parsePrice(raw: string): number {
  const s = raw.replace(/[\s  ]/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Number(s);
}

export function StepDetails({ details, onChange, currency, main, cutoutUrl, suggested, errors, copywriter, variantPhotos, variantSuggest, lead, pixels }: StepDetailsProps) {
  const ids = { name: useId(), price: useId(), category: useId(), market: useId(), ai: useId() };
  const facts = details.facts;
  const setFact = (i: number, v: string) => onChange({ facts: facts.map((f, j) => (j === i ? v : f)) });
  const price = parsePrice(details.price);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="min-w-0">
        <div className="grid gap-9 p-5 sm:p-8">
          <Group title="Product" icon={<ShoppingBagIcon />}>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <Field id={ids.name} label="Product name" error={errors.name}>
                <Input
                  id={ids.name}
                  value={details.name}
                  maxLength={120}
                  dir="auto"
                  autoComplete="off"
                  placeholder="e.g. Huile d'argan pure 30 ml"
                  aria-invalid={!!errors.name}
                  onChange={(e) => onChange({ name: e.target.value })}
                  className="h-11 rounded-xl px-3.5 text-[0.95rem]"
                />
              </Field>
              <Field id={ids.price} label="Price" error={errors.price}>
                <div className="relative">
                  <Input
                    id={ids.price}
                    value={details.price}
                    inputMode="decimal"
                    maxLength={12}
                    autoComplete="off"
                    placeholder="199"
                    aria-invalid={!!errors.price}
                    onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.,\s]/g, "") })}
                    className="h-11 rounded-xl ps-3.5 pe-14 text-[0.95rem] tabular-nums"
                  />
                  <span className="pointer-events-none absolute inset-y-0 end-3.5 grid place-items-center text-[0.8rem] font-medium text-muted-foreground">{currency}</span>
                </div>
              </Field>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.8rem] font-medium">Options</span>
                  <span className="text-[0.72rem] text-muted-foreground">{details.variants.length ? optionCount(details.variants) : "Optional"}</span>
                </div>
                <p className="text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">Does it come in colors or sizes? Customers pick on the order form, for each piece of a pack.</p>
              </div>
              <VariantsEditor value={details.variants} onChange={(variants) => onChange({ variants })} locale={details.locale} currency={currency} photos={variantPhotos} suggest={variantSuggest} />
              {lead ? (
                <p className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
                  {lead.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media-library rendition
                    <img src={lead.url} alt="" className="size-5 shrink-0 rounded-full object-cover ring-1 ring-foreground/10" />
                  ) : null}
                  <span className="min-w-0">
                    The page opens on the photo of <bdi className="font-medium text-foreground">{lead.label}</bdi>, the option the order form starts on.
                  </span>
                </p>
              ) : null}
            </div>
            <Field id={ids.category} label="Category" hint={suggested && suggested === details.category ? "Suggested by the photo reading" : undefined}>
              <Select value={details.category} onValueChange={(v) => onChange({ category: v as ProductCategory, categoryTouched: true })}>
                <SelectTrigger id={ids.category} className="w-full rounded-xl px-3.5 text-[0.95rem] data-[size=default]:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {CATEGORY_GROUPS.map((g) => (
                    <SelectGroup key={g.label}>
                      <SelectLabel>{g.label}</SelectLabel>
                      {g.items.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Group>

          <Group
            title="What you know about it"
            icon={<PenLineIcon />}
            description="3–5 short facts you can stand behind: size, material, what's in the box, how it's used. The copy is built on them and never invents numbers or health claims."
          >
            <ol className="grid gap-2.5">
              <AnimatePresence initial={false}>
                {facts.map((f, i) => (
                  <motion.li
                    key={i}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-2.5"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground/[0.05] text-[0.72rem] font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                    <Input
                      value={f}
                      maxLength={200}
                      dir="auto"
                      aria-label={`Fact ${i + 1}`}
                      placeholder={FACT_PLACEHOLDERS[i] ?? "Another fact"}
                      onChange={(e) => setFact(i, e.target.value)}
                      className="h-10 flex-1 rounded-xl px-3.5"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-full text-muted-foreground"
                      aria-label={`Remove fact ${i + 1}`}
                      disabled={facts.length <= 1}
                      onClick={() => onChange({ facts: facts.filter((_, j) => j !== i) })}
                    >
                      <MinusIcon />
                    </Button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
            {facts.length < MAX_FACTS && (
              <Button variant="ghost" size="sm" className="justify-self-start rounded-full text-muted-foreground" onClick={() => onChange({ facts: [...facts, ""] })}>
                <PlusIcon />
                Add a fact
              </Button>
            )}
          </Group>

          <Group title="Page" icon={<LanguagesIcon />}>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label className="text-[0.8rem]">Language</Label>
                <Segmented<PageLocale>
                  label="Page language"
                  value={details.locale}
                  onChange={(v) => onChange({ locale: v })}
                  options={PAGE_LOCALES.map((l) => ({ value: l.value, label: <span lang={l.value}>{l.label}</span> }))}
                  className="justify-self-start"
                />
              </div>
              <Field id={ids.market} label="Market">
                <Select value={details.market} onValueChange={(v) => onChange({ market: v as Market })}>
                  <SelectTrigger id={ids.market} className="w-full rounded-xl px-3.5 data-[size=default]:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MARKETS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {marketName(m, "en")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <label
              htmlFor={ids.ai}
              className={cn(
                "flex items-start justify-between gap-4 rounded-2xl p-4 ring-1 ring-inset transition-colors",
                copywriter.available && details.aiCopy ? "bg-brand-soft/60 ring-brand/25" : "bg-foreground/[0.025] ring-foreground/[0.07]",
                !copywriter.available && "opacity-70",
              )}
            >
              <span className="grid gap-1">
                <span className="text-[0.88rem] font-medium">Write the copy with on-device AI</span>
                <span className="text-[0.78rem] leading-relaxed text-pretty text-muted-foreground">{copywriter.note}</span>
              </span>
              <Switch id={ids.ai} checked={copywriter.available && details.aiCopy} disabled={!copywriter.available} onCheckedChange={(v) => onChange({ aiCopy: v })} />
            </label>
          </Group>

          {feature("PAGE_PIXELS") ? null : (
          <Group
            title="Ad tracking"
            icon={<RadarIcon />}
            description="Your store pixels fire on this page, so Meta and TikTok see the views, add-to-carts and orders of your ads. Untick one to leave it off this page."
          >
            <TrackingBlock store={pixels} off={details.pixelsOff} onChange={(pixelsOff) => onChange({ pixelsOff })} />
          </Group>
          )}
        </div>
      </Panel>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Summary details={details} price={price} currency={currency} main={main} cutoutUrl={cutoutUrl} />
      </aside>
    </div>
  );
}

const FACT_PLACEHOLDERS = ["e.g. 100% cold-pressed argan oil", "e.g. 30 ml glass bottle with dropper", "e.g. For face, hair and nails", "e.g. Made in Agadir", "e.g. Delivered in a gift box"];

function Group({ title, icon, description, children }: { title: string; icon: ReactNode; description?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="contents">
        <span className="flex items-center gap-2.5">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-3.5">{icon}</span>
          <span className="text-[0.95rem] font-semibold tracking-[-0.005em]">{title}</span>
        </span>
      </legend>
      {description && <p className="-mt-1 max-w-2xl text-[0.8rem] leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-[0.8rem]">
          {label}
        </Label>
        {hint && <span className="text-[0.72rem] text-brand">{hint}</span>}
      </div>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[0.75rem] text-destructive" role="alert">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "2 groups · 9 options" */
function optionCount(groups: Details["variants"]): string {
  const n = groups.reduce((sum, g) => sum + (isChoiceGroup(g) ? g.options.length : isMatrixGroup(g) ? g.dims.reduce((x, d) => x * d.values.length, 1) : 1), 0);
  return `${groups.length} group${groups.length === 1 ? "" : "s"} · ${n} choice${n === 1 ? "" : "s"}`;
}

function Summary({ details, price, currency, main, cutoutUrl }: { details: Details; price: number; currency: string; main: Photo | null; cutoutUrl: string | null }) {
  const facts = details.facts.map((f) => f.trim()).filter(Boolean);
  const locale = PAGE_LOCALES.find((l) => l.value === details.locale);
  const dir = dirOf(details.locale);
  return (
    <div className="adm-surface overflow-hidden">
      <div className="adm-aurora relative aspect-[5/4] overflow-hidden bg-muted">
        {cutoutUrl ? (
          <div className="absolute inset-0 grid place-items-center p-8">
            <span aria-hidden="true" className="absolute bottom-[13%] h-4 w-2/5 rounded-[50%] bg-black/25 blur-md" />
            {/* eslint-disable-next-line @next/next/no-img-element -- media-library rendition */}
            <img src={cutoutUrl} alt="" className="relative max-h-full max-w-full object-contain drop-shadow-[0_18px_26px_rgb(0_0_0/0.22)]" />
          </div>
        ) : main?.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={main.preview} alt="" className="absolute inset-0 size-full object-cover" />
        ) : null}
      </div>
      <div className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1.5">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-brand uppercase">{CATEGORY_LABELS[details.category]}</p>
          <p className={cn("font-display text-[1.6rem] leading-[1.1] font-semibold tracking-[-0.035em] text-balance", !details.name.trim() && "text-muted-foreground/60")} dir="auto">
            {details.name.trim() || "Your product"}
          </p>
          <p className="text-lg font-semibold tabular-nums">{Number.isFinite(price) && price > 0 ? formatMoney(price, currency, details.locale) : <span className="text-muted-foreground/60">— {currency}</span>}</p>
        </div>
        {details.variants.length > 0 && (
          <dl className="grid gap-2.5">
            {details.variants.map((g) => (
              <div key={g.id} className="grid gap-1.5">
                <dt className="text-[0.7rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase" dir="auto">
                  {g.name}
                </dt>
                <dd dir={dir} className="flex flex-wrap items-center gap-1">
                  {isMatrixGroup(g) ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-foreground/[0.05] px-2 text-[0.75rem]">
                      <bdi>{g.dims.map((d) => `${d.name} ${d.values.length}`).join(" × ")}</bdi>
                    </span>
                  ) : !isChoiceGroup(g) ? (
                    <span className="inline-flex h-6 items-center rounded-full bg-foreground/[0.05] px-2 text-[0.75rem] text-muted-foreground">Typed by the customer{g.required ? "" : " · optional"}</span>
                  ) : null}
                  {(isChoiceGroup(g) ? g.options : []).slice(0, 8).map((o) => (
                    <span
                      key={o.id}
                      className={cn(
                        "inline-flex h-6 items-center gap-1.5 rounded-full bg-foreground/[0.05] px-2 text-[0.75rem]",
                        g.kind === "swatch" && o.swatch && "ps-1",
                        o.soldOut && "text-muted-foreground line-through",
                      )}
                    >
                      {g.kind === "swatch" && o.swatch ? <Dot hex={o.swatch} size="xs" /> : null}
                      <bdi>{o.label}</bdi>
                    </span>
                  ))}
                  {isChoiceGroup(g) && g.options.length > 8 && <span className="px-1 text-[0.72rem] text-muted-foreground tabular-nums">+{g.options.length - 8}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {facts.length > 0 && (
          <ul className="grid gap-1.5 text-[0.82rem] text-muted-foreground" dir="auto">
            {facts.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="mt-[0.55em] size-1 shrink-0 rounded-full bg-brand" />
                <span className="min-w-0 break-words">{f}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-1.5 text-[0.72rem]">
          <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1">{locale?.hint}</span>
          <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1">{marketName(details.market, "en")}</span>
          <span className="rounded-full bg-foreground/[0.05] px-2.5 py-1">Cash on delivery</span>
        </div>
      </div>
    </div>
  );
}
