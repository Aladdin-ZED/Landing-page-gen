"use client";

import { BanIcon, CopyCheckIcon, ExternalLinkIcon, FingerprintIcon, GaugeIcon, ShieldAlertIcon, TimerResetIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { TurnstileSettings } from "@/lib/settings/schemas";
import { StatusChip } from "../common/status-chip";
import { runAction, type ActionResult } from "../lib/action-result";
import { Field, ReadOnlyNote, SaveBar, SecretInput, SettingsSection, TextInput, useSettingsForm } from "./form-kit";

const MASK = /^••••[^•]{0,4}$/;

const TurnstileForm = z
  .object({
    siteKey: z
      .string()
      .trim()
      .refine((s) => s === "" || TurnstileSettings.shape.siteKey.safeParse(s).success, { error: "A site key is 10–100 letters, digits, - or _ (e.g. 0x4AAAAAAA…)." }),
    secretKey: z
      .string()
      .refine((s) => s === "" || MASK.test(s) || TurnstileSettings.shape.secretKey.safeParse(s).success, { error: "This doesn't look like a Turnstile secret key." }),
  })
  .refine((v) => !!v.siteKey === !!v.secretKey, { error: "Add both keys — the site key and the secret key work together.", path: ["secretKey"] });
type TurnstileValues = z.input<typeof TurnstileForm>;

/** Protections every order goes through, with or without Turnstile. */
const ALWAYS_ON = [
  { icon: FingerprintIcon, title: "Invisible honeypot", text: "Bots that fill the hidden field get a fake success and never reach your sheet." },
  { icon: GaugeIcon, title: "Rate limits", text: "8 orders per visitor per 10 min, 4 per phone per day, 200 per page per 10 min." },
  { icon: CopyCheckIcon, title: "Duplicate guard", text: "A repeat from the same phone on the same page within 12 hours is answered, not stored twice." },
  { icon: BanIcon, title: "Blocklist", text: "Numbers and visitors you block in Orders are refused instantly." },
  { icon: ShieldAlertIcon, title: "Risk score", text: "Too-fast forms, bot browsers and odd data are flagged in the order drawer." },
] as const;

export function AntiSpamForm({
  initial,
  source,
  canWrite,
  save,
}: {
  initial: TurnstileValues;
  /** where the active keys come from */
  source: "saved" | "environment" | "none";
  canWrite: boolean;
  save: (input: { siteKey?: string; secretKey?: string }) => Promise<ActionResult<{ siteKey?: string; secretKey?: string }>>;
}) {
  const router = useRouter();
  const form = useSettingsForm(TurnstileForm, initial);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const active = !!initial.siteKey && !!initial.secretKey;

  const onSave = async () => {
    if (!form.validate()) return;
    setSaving(true);
    try {
      const res = await runAction(save({ siteKey: v.siteKey.trim(), secretKey: v.secretKey }), {
        success: v.siteKey ? "Turnstile saved — re-publish your pages to show the check" : "Turnstile turned off",
      });
      if (res) {
        form.commit({ siteKey: res.siteKey ?? "", secretKey: res.secretKey ?? "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!canWrite && <ReadOnlyNote />}
      <SettingsSection
        title="Cloudflare Turnstile"
        description="A privacy-friendly check that stops scripted fake orders. Most shoppers never see a puzzle: it runs quietly while they fill in the form."
        aside={
          <StatusChip tone={active ? "emerald" : "neutral"} pulse={active}>
            {active ? (source === "environment" ? "On · from server env" : "On") : "Off"}
          </StatusChip>
        }
        style={{ ["--i" as string]: 1 }}
      >
        <ol className="grid gap-2 rounded-2xl bg-foreground/[0.025] p-4 text-sm ring-1 ring-foreground/[0.06] ring-inset sm:grid-cols-3 sm:gap-4">
          {[
            <>
              Open{" "}
              <a
                href="https://dash.cloudflare.com/?to=/:account/turnstile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
              >
                Turnstile in Cloudflare
                <ExternalLinkIcon className="size-3" />
              </a>{" "}
              (free).
            </>,
            <>Add a widget for your store domain, mode “Managed”.</>,
            <>Paste the site key and the secret key below, save, then re-publish your pages.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 leading-relaxed text-muted-foreground">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground tabular-nums shadow-[0_0_0_1px_var(--border)]">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Site key" optional error={form.errors.siteKey} hint="Public — it is embedded in your pages.">
            {(fp) => (
              <TextInput
                {...fp}
                value={v.siteKey}
                onChange={(e) => form.set("siteKey", e.target.value)}
                placeholder="0x4AAAAAAA…"
                disabled={!canWrite}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-[0.82rem]"
              />
            )}
          </Field>
          <Field label="Secret key" optional error={form.errors.secretKey} hint="Private — stored encrypted, used only by the server.">
            {(fp) => <SecretInput {...fp} value={v.secretKey} onChange={(val) => form.set("secretKey", val)} placeholder="0x4AAAAAAA…" disabled={!canWrite} />}
          </Field>
        </div>
        <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
          Pages published before Turnstile was switched on keep taking orders; those orders are marked “no captcha” in the order drawer until you
          re-publish the page. Clearing both keys turns the check off.
        </p>
      </SettingsSection>

      <SettingsSection
        title="Always on"
        description="Every order passes these checks on the server, whatever your settings."
        aside={<StatusChip tone="emerald">Active</StatusChip>}
        style={{ ["--i" as string]: 2 }}
      >
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ALWAYS_ON.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-2xl p-3.5 ring-1 ring-foreground/[0.07] ring-inset">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Icon className="size-4" />
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <TimerResetIcon className="size-3.5" />
          Limits reset on their own; nothing to maintain.
        </p>
      </SettingsSection>

      <SaveBar dirty={form.dirty && canWrite} saving={saving} onSave={onSave} onDiscard={form.discard} />
    </>
  );
}
