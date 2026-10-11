"use client";

import { ImageIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StoreSettings, type SettingInput } from "@/lib/settings/schemas";
import { CHECKER } from "../media/asset-tile";
import type { PickedAsset } from "../media/MediaPicker";
import { runAction, type ActionResult } from "../lib/action-result";
import { useOpenedOnce } from "../lib/lazy";
import { MediaPicker } from "../on-demand";
import { Field, ReadOnlyNote, SaveBar, SettingsSection, TextInput, useSettingsForm } from "./form-kit";

type StoreInput = SettingInput<"store">;
type TextKey = "storeName" | "legalName" | "phone" | "whatsapp" | "email" | "address" | "city" | "ice" | "rc";

const COUNTRIES: { code: string; label: string }[] = [
  { code: "MA", label: "Morocco" },
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgium" },
  { code: "ES", label: "Spain" },
  { code: "DE", label: "Germany" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "PT", label: "Portugal" },
  { code: "DZ", label: "Algeria" },
  { code: "TN", label: "Tunisia" },
  { code: "SN", label: "Senegal" },
  { code: "CI", label: "Côte d'Ivoire" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
];

const SOCIALS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourstore" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourstore" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourstore" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourstore" },
  { key: "snapchat", label: "Snapchat", placeholder: "https://snapchat.com/add/yourstore" },
] as const;

/** smallest WebP rendition ≥ 160 px wide, for the logo preview */
function previewUrl(a: PickedAsset): string | null {
  const v = a.variants.filter((x) => x.fmt === "webp").sort((x, y) => x.w - y.w);
  const best = v.find((x) => x.w >= 160) ?? v[v.length - 1];
  return best ? `/media/${best.key}` : a.url;
}

export function StoreForm({
  initial,
  logoUrl,
  canWrite,
  save,
}: {
  initial: StoreInput;
  logoUrl: string | null;
  canWrite: boolean;
  save: (input: StoreInput) => Promise<ActionResult<null>>;
}) {
  const router = useRouter();
  const form = useSettingsForm(StoreSettings, initial);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);
  const pickerMounted = useOpenedOnce(picker);
  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl);

  const text = (key: TextKey) => ({
    value: v[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => form.set(key, e.target.value),
    disabled: !canWrite,
  });
  const social = (key: (typeof SOCIALS)[number]["key"]) => ({
    value: v.socials?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => form.set("socials", { ...(v.socials ?? {}), [key]: e.target.value }),
    disabled: !canWrite,
  });

  const onSave = async () => {
    const parsed = form.validate();
    if (!parsed) return;
    setSaving(true);
    try {
      const ok = await runAction(save(form.values), { success: "Store details saved — legal pages updated" });
      if (ok !== undefined) {
        form.commit(form.values);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!canWrite && <ReadOnlyNote />}
      <SettingsSection title="Identity" description="Shown in page headers, footers, the thank-you page and the legal pages." style={{ ["--i" as string]: 1 }}>
        <div className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
          <div className="grid justify-items-start gap-2">
            <span className="text-sm font-medium">Logo</span>
            <button
              type="button"
              disabled={!canWrite}
              onClick={() => setPicker(true)}
              className={`group relative flex size-24 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-foreground/10 transition-all duration-300 ring-inset hover:ring-foreground/25 disabled:cursor-default ${logoPreview ? CHECKER : "bg-foreground/[0.03]"}`}
              aria-label={v.logo ? "Change logo" : "Choose a logo"}
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- optimized media variant
                <img src={logoPreview} alt="Store logo" className="max-h-full max-w-full object-contain p-2" />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground transition-transform duration-300 group-hover:scale-110" />
              )}
              {canWrite && (
                <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-[0.68rem] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {v.logo ? "Change" : "Choose"}
                </span>
              )}
            </button>
            {v.logo && canWrite && (
              <button
                type="button"
                onClick={() => {
                  form.set("logo", undefined);
                  setLogoPreview(null);
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" /> Remove
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name" error={form.errors.storeName} hint="As customers know you, e.g. “Argania Store”.">
              {(p) => <TextInput {...p} {...text("storeName")} maxLength={80} required />}
            </Field>
            <Field label="Legal name" optional error={form.errors.legalName} hint="Company name on invoices and legal pages.">
              {(p) => <TextInput {...p} {...text("legalName")} maxLength={160} />}
            </Field>
            <Field label="Country" error={form.errors.country}>
              {(p) => (
                <Select value={v.country ?? "MA"} onValueChange={(c) => form.set("country", c)} disabled={!canWrite}>
                  <SelectTrigger id={p.id} className="h-10 w-full rounded-xl bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-72 rounded-xl">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="City" optional error={form.errors.city}>
              {(p) => <TextInput {...p} {...text("city")} maxLength={120} />}
            </Field>
            <Field label="Address" optional error={form.errors.address} className="sm:col-span-2">
              {(p) => <TextInput {...p} {...text("address")} maxLength={300} />}
            </Field>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Contact" description="WhatsApp powers the “Questions?” buttons on your pages and thank-you screens." style={{ ["--i" as string]: 2 }}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="WhatsApp" optional error={form.errors.whatsapp} hint="A mobile, as 06… or +212 6…">
            {(p) => <TextInput {...p} {...text("whatsapp")} inputMode="tel" placeholder="+212 6 12 34 56 78" />}
          </Field>
          <Field label="Phone" optional error={form.errors.phone}>
            {(p) => <TextInput {...p} {...text("phone")} inputMode="tel" placeholder="+212 5 22 00 00 00" />}
          </Field>
          <Field label="Email" optional error={form.errors.email}>
            {(p) => <TextInput {...p} {...text("email")} type="email" placeholder="contact@yourstore.ma" />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Legal identifiers"
        description="Moroccan businesses: your ICE and RC appear in the legal notice. Leave empty if you sell as an individual."
        style={{ ["--i" as string]: 3 }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ICE" optional error={form.errors.ice} hint="Identifiant Commun de l'Entreprise — 15 digits.">
            {(p) => <TextInput {...p} {...text("ice")} inputMode="numeric" maxLength={15} className="font-mono" />}
          </Field>
          <Field label="RC" optional error={form.errors.rc} hint="Registre de commerce number.">
            {(p) => <TextInput {...p} {...text("rc")} maxLength={30} className="font-mono" />}
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection title="Social profiles" description="Linked from page footers. Full https:// links." style={{ ["--i" as string]: 4 }}>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <Field key={s.key} label={s.label} optional error={form.errors[`socials.${s.key}`]}>
              {(p) => <TextInput {...p} {...social(s.key)} type="url" placeholder={s.placeholder} />}
            </Field>
          ))}
        </div>
      </SettingsSection>

      <SaveBar dirty={form.dirty && canWrite} saving={saving} onSave={onSave} onDiscard={() => {
        form.discard();
        setLogoPreview(logoUrl);
      }} />

      {canWrite && pickerMounted && (
        <MediaPicker
          open={picker}
          onOpenChange={setPicker}
          accept="image"
          title="Choose your logo"
          onPick={(a) => {
            form.set("logo", { id: a.id, alt: a.alt || (v.storeName ?? "") });
            setLogoPreview(previewUrl(a));
          }}
        />
      )}
      {form.dirty && canWrite && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCwIcon className="size-3" /> Legal pages update within a minute; re-publish live pages to refresh their header, footer and WhatsApp buttons.
        </p>
      )}
    </>
  );
}
