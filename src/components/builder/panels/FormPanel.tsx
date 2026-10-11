"use client";
/**
 * Order form panel: which fields are asked, phone country, texts, WhatsApp fallback.
 */
import { Lock, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { MARKET_SPECS, PHONE_SPECS } from "@/lib/markets/specs";
import type { FormConfig } from "@/lib/page/schema";
import { useEditor, useEditorApi } from "../context";
import { TextField } from "../fields/TextField";
import { Choice, FieldRow, Hint, PanelHeader, PanelSection, Segmented, useCommitted } from "../ui";

const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(Object.values(MARKET_SPECS).map((m) => [m.code, m.name.en]));

export function FormPanel() {
  const form = useEditor((s) => s.doc.form);
  const api = useEditorApi();
  const set = (recipe: (f: FormConfig) => void, group?: string) => api.updateDoc((d) => recipe(d.form as FormConfig), group ?? null);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Order form" description="Shorter forms convert better. Ask only what delivery needs." />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        <PanelSection title="Fields" collapsible>
          <Hint icon={<Lock />}>Name and phone are always asked.</Hint>
          <FieldRow label="City">
            <Segmented
              value={form.city}
              onChange={(v) => set((f) => void (f.city = v))}
              label="City"
              size="sm"
              options={[
                { value: "select", label: "List" },
                { value: "text", label: "Typed" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </FieldRow>
          <FieldRow label="Address">
            <Segmented
              value={form.address}
              onChange={(v) => set((f) => void (f.address = v))}
              label="Address"
              size="sm"
              options={[
                { value: "required", label: "Required" },
                { value: "optional", label: "Optional" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </FieldRow>
          <FieldRow label="Email">
            <Segmented
              value={form.email}
              onChange={(v) => set((f) => void (f.email = v))}
              label="Email"
              size="sm"
              options={[
                { value: "required", label: "Required" },
                { value: "optional", label: "Optional" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </FieldRow>
          <FieldRow label="Note to the seller">
            <Segmented
              value={form.note}
              onChange={(v) => set((f) => void (f.note = v))}
              label="Note"
              size="sm"
              options={[
                { value: "optional", label: "Optional" },
                { value: "hidden", label: "Hidden" },
              ]}
            />
          </FieldRow>
          <FieldRow label="Phone numbers from" hint={`Example: ${PHONE_SPECS[form.phoneCountry]?.prefix ?? ""} ${PHONE_SPECS[form.phoneCountry]?.placeholder ?? ""}`}>
            <Choice value={form.phoneCountry} onChange={(v) => set((f) => void (f.phoneCountry = v))} options={Object.keys(PHONE_SPECS).map((c) => ({ value: c, label: `${COUNTRY_NAMES[c] ?? c} (${PHONE_SPECS[c]!.prefix})` }))} />
          </FieldRow>
        </PanelSection>

        <PanelSection title="Texts" collapsible hint="Leave empty to use the built-in wording in the page language.">
          <TextField id="form-title" label="Form title" value={form.title} max={400} onChange={(v) => set((f) => void (f.title = v || undefined), "form:title")} />
          <TextField id="form-submit" label="Button" value={form.submitLabel} max={60} emphasis={false} onChange={(v) => set((f) => void (f.submitLabel = v || undefined), "form:submit")} />
          <TextField id="form-reassure" label="Reassurance under the button" value={form.reassurance} max={140} emphasis={false} onChange={(v) => set((f) => void (f.reassurance = v || undefined), "form:reassurance")} help="e.g. “Pay in cash when you receive it.”" />
        </PanelSection>

        <PanelSection title="WhatsApp fallback" collapsible defaultOpen={!!form.whatsapp?.enabled} hint="A button to order by WhatsApp for shoppers who prefer chatting.">
          <WhatsAppEditor form={form} set={set} />
        </PanelSection>
      </div>
    </div>
  );
}

function WhatsAppEditor({ form, set }: { form: FormConfig; set: (recipe: (f: FormConfig) => void, group?: string) => void }) {
  // the switch follows the page (undo included) once a number exists; before that it only opens the field
  const [asked, setAsked] = useState(false);
  const wanted = form.whatsapp ? form.whatsapp.enabled : asked;
  const setWanted = (on: boolean) => {
    setAsked(on);
    set((f) => {
      if (f.whatsapp) f.whatsapp.enabled = on;
    });
  };
  const number = useCommitted(
    form.whatsapp?.number ?? "",
    (v) => v,
    (raw) => {
      const v = raw.replace(/[\s().-]/g, "");
      return /^\+?[0-9]{8,15}$/.test(v) ? { value: v } : { error: "International format, e.g. +212612345678" };
    },
    (v) => set((f) => void (f.whatsapp = { enabled: wanted, number: v }), "form:whatsapp"),
  );
  return (
    <>
      <FieldRow label="Show the WhatsApp option" inline>
        <Switch checked={wanted} onCheckedChange={setWanted} />
      </FieldRow>
      {wanted ? (
        <FieldRow label="WhatsApp number" error={number.error} hint={!form.whatsapp ? "Enter a number to turn it on." : undefined}>
          <div className="relative">
            <MessageCircle className="pointer-events-none absolute start-2.5 top-2 size-4 text-emerald-600" />
            <Input inputMode="tel" value={number.raw} placeholder="+212 6 12 34 56 78" onChange={(e) => number.onChange(e.target.value)} onFocus={number.onFocus} onBlur={number.onBlur} className="h-8 ps-8 font-mono text-xs" />
          </div>
        </FieldRow>
      ) : null}
    </>
  );
}
