"use client";
/**
 * Offers panel: packs (x1/x2/x3…) with live per-unit price, real savings and sanity warnings; the
 * pack card style; savings display; delivery fee; order bump; thank-you upsell; real urgency.
 */
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronRight, CircleAlert, Gift, MoreHorizontal, Plus, Trash2, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/markets/money";
import { bundleMath, bundleWarnings } from "@/lib/page/pricing";
import { BUNDLE_CARD_STYLES, type Bundle, type Offers } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi } from "../context";
import { DateTimeField } from "../fields/DateTimeField";
import { ImageField } from "../fields/ImageField";
import { TextField } from "../fields/TextField";
import { EASE, FieldRow, Hint, NumberInput, PanelHeader, PanelSection, Segmented, useCommitted } from "../ui";

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function bundleId(taken: readonly string[]): string {
  for (;;) {
    const b = new Uint8Array(5);
    crypto.getRandomValues(b);
    const id = `b-${[...b].map((x) => ID_ALPHABET[x % ID_ALPHABET.length]).join("")}`;
    if (!taken.includes(id)) return id;
  }
}

export function OffersPanel() {
  const offers = useEditor((s) => s.doc.offers);
  const price = useEditor((s) => s.doc.product.price);
  const currency = useEditor((s) => s.doc.currency);
  const api = useEditorApi();
  const set = (recipe: (o: Offers) => void, group?: string) => api.updateDoc((d) => recipe(d.offers as Offers), group ?? null);
  // the admin reads Latin digits and the currency code, whatever the page language
  const money = (n: number) => formatMoney(n, currency, "en");
  const warnings = useMemo(() => bundleWarnings(offers, price), [offers, price]);

  const addBundle = () =>
    set((o) => {
      if (o.bundles.length >= 5) return;
      const qty = Math.min(20, Math.max(...o.bundles.map((b) => b.qty)) + 1);
      o.bundles.push({ id: bundleId(o.bundles.map((b) => b.id)), qty, price: Math.round(price * qty * 0.85), badge: "none", freeShipping: true, preselected: false });
    });

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Offers" description="Packs, extras and urgency. The server always recomputes the totals." />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        <PanelSection
          title="Packs"
          collapsible
          action={
            <Button variant="ghost" size="xs" onClick={addBundle} disabled={offers.bundles.length >= 5}>
              <Plus />
              Pack
            </Button>
          }
        >
          <AnimatePresence initial={false}>
            {warnings.length ? (
              <motion.div key="warn" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: EASE }}>
                <Hint tone="warn" icon={<CircleAlert />}>
                  <ul className="space-y-0.5">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Hint>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <ul className="space-y-2.5">
            {offers.bundles.map((b, i) => (
              <BundleCard key={b.id} bundle={b} index={i} count={offers.bundles.length} unitPrice={price} currency={currency} money={money} set={set} />
            ))}
          </ul>
        </PanelSection>

        <PanelSection title="Pack cards" collapsible>
          <CardStylePicker value={offers.cardStyle} onChange={(v) => set((o) => void (o.cardStyle = v))} />
          <FieldRow label="Show the price per item" inline>
            <Switch checked={offers.showPerUnit} onCheckedChange={(v) => set((o) => void (o.showPerUnit = v))} />
          </FieldRow>
          <FieldRow label="Show savings as">
            <Segmented
              value={offers.showSavings}
              onChange={(v) => set((o) => void (o.showSavings = v))}
              label="Show savings as"
              size="sm"
              options={[
                { value: "amount", label: "Amount" },
                { value: "percent", label: "%" },
                { value: "both", label: "Both" },
                { value: "none", label: "Hide" },
              ]}
            />
          </FieldRow>
        </PanelSection>

        <PanelSection title="Delivery" collapsible>
          <FieldRow label="Delivery fee" hint="Added to every order. 0 = free delivery.">
            <NumberInput value={offers.shippingFee} min={0} max={10_000_000} suffix={currency} onCommit={(v) => set((o) => void (o.shippingFee = v ?? 0), "offers:shipping")} />
          </FieldRow>
        </PanelSection>

        <PanelSection title="Order bump" collapsible defaultOpen={!!offers.orderBump?.enabled} hint="A small extra the shopper can tick in the form.">
          <ExtraEditor
            kind="bump"
            enabled={!!offers.orderBump?.enabled}
            onToggle={(on) =>
              set((o) => {
                if (o.orderBump) o.orderBump.enabled = on;
                else if (on) o.orderBump = { enabled: true, title: "", price: Math.round(price * 0.3) };
              })
            }
          >
            {offers.orderBump ? (
              <>
                <TextField id="bump-title" label="Title" value={offers.orderBump.title} max={80} emphasis={false} onChange={(v) => set((o) => void (o.orderBump!.title = v), "bump:title")} />
                <TextField id="bump-desc" label="Description" value={offers.orderBump.description} max={160} emphasis={false} multiline rows={2} onChange={(v) => set((o) => void (o.orderBump!.description = v || undefined), "bump:desc")} />
                <FieldRow label="Price">
                  <NumberInput value={offers.orderBump.price} min={0} suffix={currency} onCommit={(v) => set((o) => void (o.orderBump!.price = v ?? 0), "bump:price")} />
                </FieldRow>
                <ImageField compact label="Image" value={offers.orderBump.image} onChange={(v) => set((o) => void (o.orderBump!.image = v), "bump:image")} />
              </>
            ) : null}
          </ExtraEditor>
        </PanelSection>

        <PanelSection title="Thank-you upsell" collapsible defaultOpen={!!offers.upsell?.enabled} hint="One-click add-on on the thank-you page, for a few minutes.">
          <ExtraEditor
            kind="upsell"
            enabled={!!offers.upsell?.enabled}
            onToggle={(on) =>
              set((o) => {
                if (o.upsell) o.upsell.enabled = on;
                else if (on) o.upsell = { enabled: true, title: "", price: Math.round(price * 0.5), windowMinutes: 10 };
              })
            }
          >
            {offers.upsell ? (
              <>
                <TextField id="up-title" label="Title" value={offers.upsell.title} max={80} emphasis={false} onChange={(v) => set((o) => void (o.upsell!.title = v), "upsell:title")} />
                <TextField id="up-desc" label="Description" value={offers.upsell.description} max={240} emphasis={false} multiline rows={2} onChange={(v) => set((o) => void (o.upsell!.description = v || undefined), "upsell:desc")} />
                <div className="grid grid-cols-2 gap-2.5">
                  <FieldRow label="Price">
                    <NumberInput value={offers.upsell.price} min={0} suffix={currency} onCommit={(v) => set((o) => void (o.upsell!.price = v ?? 0), "upsell:price")} />
                  </FieldRow>
                  <FieldRow label="Compare at">
                    <NumberInput value={offers.upsell.compareAt} min={0} suffix={currency} optional placeholder="—" onCommit={(v) => set((o) => void (o.upsell!.compareAt = v), "upsell:compare")} />
                  </FieldRow>
                </div>
                <FieldRow label="Offer window" hint="How long the shopper can accept it.">
                  <NumberInput value={offers.upsell.windowMinutes} min={1} max={120} integer suffix="min" onCommit={(v) => set((o) => void (o.upsell!.windowMinutes = v ?? 10), "upsell:window")} />
                </FieldRow>
                <ImageField compact label="Image" value={offers.upsell.image} onChange={(v) => set((o) => void (o.upsell!.image = v), "upsell:image")} />
              </>
            ) : null}
          </ExtraEditor>
        </PanelSection>

        <PanelSection title="Urgency" collapsible defaultOpen={!!offers.urgency.countdownEnd || offers.urgency.stockLeft !== undefined} hint="Only real deadlines and real stock. Nothing resets by itself.">
          <DateTimeField id="urg-end" label="Offer ends" value={offers.urgency.countdownEnd} onChange={(iso) => set((o) => void (o.urgency.countdownEnd = iso), "urgency:end")} help="The countdown hides after it." />
          <FieldRow label="Stock left" hint="Leave empty to hide the stock bar.">
            <NumberInput value={offers.urgency.stockLeft} min={0} max={100_000} integer optional placeholder="—" onCommit={(v) => set((o) => void (o.urgency.stockLeft = v), "urgency:stock")} />
          </FieldRow>
        </PanelSection>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* packs                                                               */
/* ------------------------------------------------------------------ */

const BADGES: { value: Bundle["badge"]; label: string; title?: string }[] = [
  { value: "none", label: "None" },
  { value: "popular", label: "Popular", title: "Most popular" },
  { value: "best", label: "Best", title: "Best price" },
  { value: "custom", label: "Custom", title: "Your own words" },
];

/**
 * One pack: the numbers merchants change most (quantity, total, reference price) always visible
 * with the computed per-item price and the real saving; everything else behind "Details".
 */
function BundleCard({
  bundle: b,
  index,
  count,
  unitPrice,
  currency,
  money,
  set,
}: {
  bundle: Bundle;
  index: number;
  count: number;
  unitPrice: number;
  currency: string;
  money: (n: number) => string;
  set: (recipe: (o: Offers) => void, group?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const m = bundleMath(b, unitPrice);
  const edit = (recipe: (x: Bundle) => void, group?: string) =>
    set((o) => {
      const x = o.bundles.find((y) => y.id === b.id);
      if (x) recipe(x);
    }, group);
  const badgeText = useCommitted<string | undefined>(
    b.badgeText,
    (v) => v ?? "",
    (raw) => (raw.length <= 28 ? { value: raw || undefined } : { error: "At most 28 characters" }),
    (v) => edit((x) => void (x.badgeText = v), `bundle:${b.id}:badge`),
  );
  const move = (delta: number) => set((o) => void o.bundles.splice(index + delta, 0, o.bundles.splice(index, 1)[0]!));
  const badgeLabel = b.badge === "custom" ? b.badgeText || "Custom badge" : BADGES.find((x) => x.value === b.badge)?.title;
  const facts = [
    b.title ? `“${b.title}”` : null,
    b.badge !== "none" ? badgeLabel : null,
    b.preselected ? "Selected first" : null,
    b.freeShipping ? "Free delivery" : null,
    b.gift ? `Gift: ${b.gift.label}` : null,
  ].filter(Boolean);

  return (
    <motion.li
      layout
      transition={{ duration: 0.3, ease: EASE }}
      className={cn("bld-card overflow-hidden", b.preselected && "shadow-[0_0_0_1.5px_var(--brand),0_8px_20px_-14px_var(--brand)]")}
    >
      <div className="flex items-center gap-3 px-3 pt-3">
        <span
          className="grid h-10 min-w-10 shrink-0 place-items-center rounded-xl bg-foreground/[0.05] px-1.5 font-display text-[17px] leading-none font-semibold tracking-[-0.03em] tabular-nums"
          aria-label={`${b.qty} item${b.qty > 1 ? "s" : ""}`}
        >
          ×{b.qty}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5 truncate">
            <span className="text-[14px] font-semibold tabular-nums">{money(m.total)}</span>
            {m.showReference ? <span className="text-[11.5px] text-muted-foreground tabular-nums line-through">{money(m.reference)}</span> : null}
          </p>
          <p className="truncate text-[11px] text-muted-foreground tabular-nums">
            {money(m.perUnit)} / item{m.showReference ? ` · saves ${money(m.savings)}` : ""}
          </p>
        </div>
        {m.showReference ? (
          <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">−{m.savingsPct}%</span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={`Pack ×${b.qty} actions`} className="-me-1 shrink-0 text-muted-foreground">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={index === 0} onSelect={() => move(-1)}>
              <ArrowUp />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => move(1)}>
              <ArrowDown />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={count <= 1} onSelect={() => set((o) => void o.bundles.splice(index, 1))}>
              <Trash2 />
              Remove pack
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid grid-cols-[4rem_1fr_1fr] gap-2 px-3 pt-3">
        <FieldRow label="Qty">
          <NumberInput value={b.qty} min={1} max={20} integer ariaLabel="Quantity" onCommit={(v) => edit((x) => void (x.qty = v ?? 1), `bundle:${b.id}:qty`)} />
        </FieldRow>
        <FieldRow label="Total price">
          <NumberInput value={b.price} min={0} suffix={currency} ariaLabel="Total price" onCommit={(v) => edit((x) => void (x.price = v ?? 0), `bundle:${b.id}:price`)} />
        </FieldRow>
        <FieldRow label="Compare at">
          <NumberInput
            value={b.compareAt}
            min={0}
            suffix={currency}
            optional
            placeholder={String(Math.round(unitPrice * b.qty))}
            ariaLabel="Compare at"
            onCommit={(v) => edit((x) => void (x.compareAt = v), `bundle:${b.id}:compare`)}
          />
        </FieldRow>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2.5 flex w-full items-center gap-2 border-t border-[var(--bld-hairline)] px-3 py-2 text-left outline-none transition-colors hover:bg-foreground/[0.025] focus-visible:bg-foreground/[0.04]"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-300", open && "rotate-90")} />
        <span className="shrink-0 text-[12px] font-medium text-foreground/85">Details</span>
        <span className="min-w-0 flex-1 truncate text-end text-[11px] text-muted-foreground">{open ? "" : facts.join(" · ")}</span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-3 pb-3.5 pt-1">
              <TextField
                id={`b-${b.id}-title`}
                label="Title"
                value={b.title}
                max={60}
                emphasis={false}
                placeholder={`Pack x${b.qty}`}
                onChange={(v) => edit((x) => void (x.title = v || undefined), `bundle:${b.id}:title`)}
              />
              <TextField id={`b-${b.id}-sub`} label="Subtitle" value={b.subtitle} max={90} emphasis={false} onChange={(v) => edit((x) => void (x.subtitle = v || undefined), `bundle:${b.id}:subtitle`)} />
              <FieldRow label="Badge">
                <Segmented
                  value={b.badge}
                  onChange={(v) =>
                    set((o) => {
                      for (const x of o.bundles) {
                        if (x.id === b.id) x.badge = v;
                        // one "popular" and one "best" per page
                        else if ((v === "popular" || v === "best") && x.badge === v) x.badge = "none";
                      }
                    })
                  }
                  label="Badge"
                  size="sm"
                  options={BADGES}
                />
              </FieldRow>
              {b.badge === "custom" ? (
                <FieldRow label="Badge text" error={badgeText.error} count={badgeText.raw.length} max={28}>
                  <Input dir="auto" value={badgeText.raw} maxLength={28} onChange={(e) => badgeText.onChange(e.target.value)} onFocus={badgeText.onFocus} onBlur={badgeText.onBlur} className="h-8 text-[13px]" />
                </FieldRow>
              ) : null}
              <div>
                <FieldRow label="Selected when the page opens" inline>
                  <Switch size="sm" checked={b.preselected} onCheckedChange={(on) => set((o) => o.bundles.forEach((x) => (x.preselected = on && x.id === b.id)))} />
                </FieldRow>
                <FieldRow
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Truck className="size-3.5 text-muted-foreground" /> Free delivery
                    </span>
                  }
                  inline
                >
                  <Switch size="sm" checked={b.freeShipping} onCheckedChange={(on) => edit((x) => void (x.freeShipping = on))} />
                </FieldRow>
                <FieldRow
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Gift className="size-3.5 text-muted-foreground" /> Free gift
                    </span>
                  }
                  inline
                >
                  <Switch size="sm" checked={!!b.gift} onCheckedChange={(on) => edit((x) => void (x.gift = on ? { label: "Gift" } : undefined))} />
                </FieldRow>
              </div>
              {b.gift ? <GiftEditor bundle={b} edit={edit} /> : null}
              <ImageField compact label="Pack image" value={b.image} onChange={(v) => edit((x) => void (x.image = v), `bundle:${b.id}:image`)} help="Optional — product photos are used when empty." />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.li>
  );
}

function GiftEditor({ bundle: b, edit }: { bundle: Bundle; edit: (recipe: (x: Bundle) => void, group?: string) => void }) {
  const f = useCommitted(
    b.gift?.label ?? "",
    (v) => v,
    (raw) => (raw.trim() ? { value: raw.slice(0, 60) } : { error: "Name the gift" }),
    (v) => edit((x) => void (x.gift ? (x.gift.label = v) : undefined), `bundle:${b.id}:gift`),
  );
  return (
    <div className="space-y-3 rounded-xl bg-foreground/[0.025] p-3 ring-1 ring-inset ring-foreground/[0.04]">
      <FieldRow label="Gift" error={f.error}>
        <Input dir="auto" value={f.raw} maxLength={60} onChange={(e) => f.onChange(e.target.value)} onFocus={f.onFocus} onBlur={f.onBlur} className="h-8 text-[13px]" />
      </FieldRow>
      <ImageField compact label="Gift image" value={b.gift?.image} onChange={(v) => edit((x) => void (x.gift ? (x.gift.image = v) : undefined), `bundle:${b.id}:gift-image`)} />
    </div>
  );
}

function ExtraEditor({ kind, enabled, onToggle, children }: { kind: "bump" | "upsell"; enabled: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <>
      <FieldRow label={kind === "bump" ? "Offer an extra in the form" : "Offer an add-on after ordering"} inline>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </FieldRow>
      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div key="body" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.28, ease: EASE }} className="-mx-1 overflow-hidden px-1">
            <div className="space-y-3 pt-1">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* card style                                                          */
/* ------------------------------------------------------------------ */

const STYLE_LABELS: Record<(typeof BUNDLE_CARD_STYLES)[number], string> = {
  stack: "Stack",
  tiers: "Tiers",
  ticket: "Pass",
  pills: "Pills",
  visual: "Visual",
};

function StyleGlyph({ kind }: { kind: (typeof BUNDLE_CARD_STYLES)[number] }) {
  const a = "var(--brand)";
  const c = "currentColor";
  switch (kind) {
    case "stack":
      return (
        <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true">
          <rect x="6" y="4" width="52" height="10" rx="4" fill={c} opacity=".14" />
          <rect x="6" y="17" width="52" height="11" rx="4" fill="none" stroke={a} strokeWidth="1.6" />
          <circle cx="13" cy="22.5" r="2.4" fill={a} />
          <rect x="6" y="31" width="52" height="10" rx="4" fill={c} opacity=".14" />
        </svg>
      );
    case "tiers":
      return (
        <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true">
          <rect x="4" y="10" width="17" height="28" rx="4" fill={c} opacity=".14" />
          <rect x="23.5" y="5" width="17" height="35" rx="4" fill="none" stroke={a} strokeWidth="1.6" />
          <rect x="27" y="9" width="10" height="3" rx="1.5" fill={a} />
          <rect x="43" y="10" width="17" height="28" rx="4" fill={c} opacity=".14" />
        </svg>
      );
    case "ticket":
      return (
        <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true">
          <rect x="8" y="5" width="48" height="34" rx="6" fill={c} opacity=".12" />
          <path d="M8 11a6 6 0 0 1 6-6h36a6 6 0 0 1 6 6v4H8z" fill={a} />
          <rect x="14" y="21" width="16" height="7" rx="2" fill={c} opacity=".35" />
          <rect x="38" y="21" width="12" height="11" rx="3" fill={c} opacity=".22" />
        </svg>
      );
    case "pills":
      return (
        <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true">
          <rect x="4" y="15" width="56" height="14" rx="7" fill={c} opacity=".12" />
          <rect x="22" y="17" width="20" height="10" rx="5" fill={a} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 64 44" className="h-full w-full" aria-hidden="true">
          <rect x="6" y="8" width="24" height="28" rx="5" fill={c} opacity=".12" />
          <rect x="34" y="8" width="24" height="28" rx="5" fill="none" stroke={a} strokeWidth="1.6" />
          <rect x="15" y="14" width="6" height="12" rx="3" fill={c} opacity=".4" />
          <rect x="39" y="14" width="6" height="12" rx="3" fill={a} />
          <rect x="47" y="14" width="6" height="12" rx="3" fill={a} />
        </svg>
      );
  }
}

function CardStylePicker({ value, onChange }: { value: Offers["cardStyle"]; onChange: (v: Offers["cardStyle"]) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Pack card style">
      {BUNDLE_CARD_STYLES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          data-selected={value === s}
          onClick={() => onChange(s)}
          className="bld-tile flex flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-foreground outline-none"
        >
          <span className="h-7 w-10">
            <StyleGlyph kind={s} />
          </span>
          <span className="text-[10.5px] font-medium">{STYLE_LABELS[s]}</span>
        </button>
      ))}
    </div>
  );
}
