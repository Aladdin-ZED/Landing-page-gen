"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, getMarket } from "@/lib/markets/info";
import { MARKETS, type Locale, type Market } from "@/lib/page/schema";
import { DefaultsSettings, type SettingInput } from "@/lib/settings/schemas";
import { cn } from "@/lib/utils";
import { runAction, type ActionResult } from "../lib/action-result";
import { Field, ReadOnlyNote, SaveBar, SettingsSection, TextInput, useSettingsForm } from "./form-kit";

type DefaultsInput = SettingInput<"defaults">;

const LOCALE_LABEL: Record<string, string> = {
  ar: "العربية · Arabic",
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pt: "Português",
};

const CURRENCIES = ["MAD", "EUR", "USD", "GBP", "XOF", "DZD", "TND", "SAR", "AED"];
const PHONE_COUNTRIES = [
  { code: "MA", label: "Morocco (+212)" },
  { code: "FR", label: "France (+33)" },
  { code: "BE", label: "Belgium (+32)" },
  { code: "ES", label: "Spain (+34)" },
  { code: "DE", label: "Germany (+49)" },
  { code: "IT", label: "Italy (+39)" },
  { code: "NL", label: "Netherlands (+31)" },
  { code: "PT", label: "Portugal (+351)" },
];

const DELIVERY_SUGGESTIONS: Record<string, string[]> = {
  ar: ["التوصيل مجاني خلال 24–48 ساعة", "الدفع عند الاستلام · توصيل لجميع المدن"],
  fr: ["Livraison gratuite 24–48h", "Paiement à la livraison · partout au Maroc"],
  en: ["Free delivery in 24–48h", "Pay on delivery · nationwide shipping"],
};

export function MarketForm({ initial, canWrite, save }: { initial: DefaultsInput; canWrite: boolean; save: (input: DefaultsInput) => Promise<ActionResult<null>> }) {
  const router = useRouter();
  const form = useSettingsForm(DefaultsSettings, initial);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const market = getMarket(v.market ?? "MA");
  const locale = (v.locale ?? market.defaultLocale) as Locale;

  const pickMarket = (code: Market) => {
    const m = getMarket(code);
    form.setValues((cur) => ({
      ...cur,
      market: code,
      currency: m.currency,
      locale: m.locales.includes(cur.locale as Locale) ? cur.locale : m.defaultLocale,
      phoneCountry: m.phone.country || cur.phoneCountry,
    }));
  };

  const onSave = async () => {
    if (!form.validate()) return;
    setSaving(true);
    try {
      const ok = await runAction(save(form.values), { success: "Market defaults saved" });
      if (ok !== undefined) {
        form.commit(form.values);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const fee = Number(v.shippingFee ?? 0);
  const samplePrice = (v.currency ?? "MAD") === "MAD" ? 249 : 29.9;

  return (
    <>
      {!canWrite && <ReadOnlyNote />}
      <SettingsSection title="Market" description="New pages start with these values. Each page can still be changed in the builder." style={{ ["--i" as string]: 1 }}>
        <div role="radiogroup" aria-label="Market" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {MARKETS.map((code) => {
            const m = getMarket(code);
            const active = (v.market ?? "MA") === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!canWrite}
                onClick={() => pickMarket(code)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm ring-1 transition-all duration-200 ring-inset disabled:cursor-default",
                  active ? "bg-brand/[0.07] font-medium ring-brand/40 shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_12%,transparent)]" : "ring-foreground/10 hover:bg-foreground/[0.03]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-[0.68rem] font-semibold tracking-wide transition-colors",
                    active ? "bg-brand text-brand-foreground" : "bg-foreground/[0.06] text-foreground/70",
                  )}
                >
                  {code === "INTL" ? "WW" : code}
                </span>
                <span className="grid">
                  <span>{m.name.en}</span>
                  <span className="text-[0.7rem] text-muted-foreground">{m.currency}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Page language" error={form.errors.locale}>
            {(p) => (
              <Select value={locale} onValueChange={(l) => form.set("locale", l as Locale)} disabled={!canWrite}>
                <SelectTrigger id={p.id} className="h-10 w-full rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="rounded-xl">
                  {market.locales.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LOCALE_LABEL[l] ?? l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Currency" error={form.errors.currency}>
            {(p) => (
              <Select value={v.currency ?? "MAD"} onValueChange={(c) => form.set("currency", c)} disabled={!canWrite}>
                <SelectTrigger id={p.id} className="h-10 w-full rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="rounded-xl">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Phone numbers from" error={form.errors.phoneCountry} hint="Order forms validate numbers for this country.">
            {(p) => (
              <Select value={v.phoneCountry ?? "MA"} onValueChange={(c) => form.set("phoneCountry", c)} disabled={!canWrite}>
                <SelectTrigger id={p.id} className="h-10 w-full rounded-xl bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="rounded-xl">
                  {PHONE_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Delivery" description="Default shipping fee and the promise shown next to prices and order buttons." style={{ ["--i" as string]: 2 }}>
        <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <Field label="Shipping fee" error={form.errors.shippingFee} hint="0 = free delivery.">
            {(p) => (
              <div className="relative">
                <TextInput
                  {...p}
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={Number.isFinite(fee) ? String(v.shippingFee ?? 0) : ""}
                  onChange={(e) => form.set("shippingFee", e.target.value === "" ? 0 : Number(e.target.value))}
                  disabled={!canWrite}
                  className="pe-14 tabular-nums"
                />
                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{v.currency ?? "MAD"}</span>
              </div>
            )}
          </Field>
          <Field label="Delivery promise" error={form.errors.deliveryText} optional>
            {(p) => (
              <div className="grid gap-2">
                <TextInput
                  {...p}
                  value={v.deliveryText ?? ""}
                  onChange={(e) => form.set("deliveryText", e.target.value)}
                  maxLength={140}
                  dir="auto"
                  disabled={!canWrite}
                  placeholder={DELIVERY_SUGGESTIONS[locale]?.[0] ?? DELIVERY_SUGGESTIONS.en![0]}
                />
                {canWrite && (
                  <div className="flex flex-wrap gap-1.5">
                    {(DELIVERY_SUGGESTIONS[locale] ?? DELIVERY_SUGGESTIONS.en!).map((s) => (
                      <button
                        key={s}
                        type="button"
                        dir="auto"
                        onClick={() => form.set("deliveryText", s)}
                        className="rounded-full bg-foreground/[0.045] px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
        </div>

        <div className="adm-aurora flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 ring-1 ring-foreground/[0.07] ring-inset" dir={locale === "ar" ? "rtl" : "ltr"}>
          <span className="relative z-10 grid gap-0.5">
            <span className="text-[0.7rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase" dir="ltr">
              Preview
            </span>
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{formatMoney(samplePrice, v.currency ?? "MAD", locale)}</span>
          </span>
          <span className="relative z-10 grid justify-items-end gap-0.5 text-sm">
            <span className="font-medium">{v.deliveryText || DELIVERY_SUGGESTIONS[locale]?.[0] || DELIVERY_SUGGESTIONS.en![0]}</span>
            <span className="text-muted-foreground">
              {fee > 0 ? `+ ${formatMoney(fee, v.currency ?? "MAD", locale)}` : locale === "ar" ? "توصيل مجاني" : locale === "fr" ? "Livraison offerte" : "Free shipping"}
            </span>
          </span>
        </div>
      </SettingsSection>

      <SaveBar dirty={form.dirty && canWrite} saving={saving} onSave={onSave} onDiscard={form.discard} />
    </>
  );
}
