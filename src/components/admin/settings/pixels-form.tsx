"use client";

import { CopyCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Tracking } from "@/lib/page/schema";
import { TrackingSecretsSettings, type SettingInput } from "@/lib/settings/schemas";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { StatusChip } from "../common/status-chip";
import { runAction, type ActionResult } from "../lib/action-result";
import { Field, ReadOnlyNote, SaveBar, SecretInput, SettingsSection, TextInput, useSettingsForm } from "./form-kit";

const MASK = /^••••[^•]{0,4}$/;

/** "" (not set) or a value the stored schema accepts — with a message a merchant understands. */
const idField = (schema: z.ZodType, error: string) =>
  z
    .string()
    .trim()
    .refine((s) => s === "" || schema.safeParse(s).success, { error });

/** "" (remove), the mask (keep the stored secret) or a new token. */
const secretField = (schema: z.ZodType) =>
  z.string().refine((s) => s === "" || MASK.test(s) || schema.safeParse(s).success, { error: "This doesn't look like a valid token." });

/** Form schema: every field is a string; the server schemas decide what is valid. */
const PixelsFormSchema = z.object({
  metaPixelId: idField(Tracking.shape.metaPixelId, "A Meta pixel ID is 6–20 digits."),
  tiktokPixelId: idField(Tracking.shape.tiktokPixelId, "A TikTok pixel ID is 8–30 capital letters and digits."),
  snapPixelId: idField(Tracking.shape.snapPixelId, "A Snap pixel ID looks like xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx."),
  ga4Id: idField(Tracking.shape.ga4Id, "A GA4 measurement ID starts with G-, e.g. G-AB12CD34EF."),
  metaCapiToken: secretField(TrackingSecretsSettings.shape.metaCapiToken),
  metaTestEventCode: idField(TrackingSecretsSettings.shape.metaTestEventCode, "4–20 capital letters and digits, e.g. TEST12345."),
  tiktokToken: secretField(TrackingSecretsSettings.shape.tiktokToken),
  tiktokTestEventCode: idField(TrackingSecretsSettings.shape.tiktokTestEventCode, "4–20 capital letters and digits, e.g. TEST12345."),
  snapToken: secretField(TrackingSecretsSettings.shape.snapToken),
  ga4ApiSecret: secretField(TrackingSecretsSettings.shape.ga4ApiSecret),
});
export type PixelsValues = z.input<typeof PixelsFormSchema>;

type PixelKey = "metaPixelId" | "tiktokPixelId" | "snapPixelId" | "ga4Id";
type TokenKey = "metaCapiToken" | "tiktokToken" | "snapToken" | "ga4ApiSecret";
type TestCodeKey = "metaTestEventCode" | "tiktokTestEventCode";

interface Platform {
  id: string;
  name: string;
  mark: string;
  color: string;
  pixel: { key: PixelKey; label: string; placeholder: string; hint: string };
  token: { key: TokenKey; label: string; hint?: string };
  /** platforms that receive server-side Purchase events (Settings tokens + the page's pixel id) */
  server?: boolean;
  extra?: { key: TestCodeKey; label: string; placeholder: string; hint: string };
}

const PLATFORMS: Platform[] = [
  {
    id: "meta",
    name: "Meta (Facebook & Instagram)",
    mark: "M",
    color: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    pixel: { key: "metaPixelId", label: "Pixel ID", placeholder: "123456789012345", hint: "Events Manager → Data sources → your pixel." },
    token: {
      key: "metaCapiToken",
      label: "Conversions API token",
      hint: "Sends every order to Meta from the server too, counted once with the browser pixel. Stored encrypted, never shown again.",
    },
    server: true,
    extra: { key: "metaTestEventCode", label: "Test event code", placeholder: "TEST12345", hint: "Only while testing in Events Manager; remove it afterwards." },
  },
  {
    id: "tiktok",
    name: "TikTok",
    mark: "T",
    color: "bg-foreground/[0.07] text-foreground",
    pixel: { key: "tiktokPixelId", label: "Pixel ID", placeholder: "C4ABCDEF1234567890", hint: "TikTok Ads Manager → Assets → Events." },
    token: {
      key: "tiktokToken",
      label: "Events API access token",
      hint: "Sends every order to TikTok from the server too, counted once with the browser pixel. Stored encrypted, never shown again.",
    },
    server: true,
    extra: { key: "tiktokTestEventCode", label: "Test event code", placeholder: "TEST12345", hint: "Only while testing in Events Manager; remove it afterwards." },
  },
  {
    id: "snap",
    name: "Snapchat",
    mark: "S",
    color: "bg-warn/30 text-warn-ink",
    pixel: { key: "snapPixelId", label: "Pixel ID", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", hint: "Snap Ads Manager → Events Manager." },
    token: { key: "snapToken", label: "Conversions API token", hint: "Stored encrypted for later. Purchases are tracked by the browser pixel; this token isn't used yet." },
  },
  {
    id: "ga4",
    name: "Google Analytics 4",
    mark: "G",
    color: "bg-foreground/[0.07] text-foreground",
    pixel: { key: "ga4Id", label: "Measurement ID", placeholder: "G-XXXXXXXXXX", hint: "Admin → Data streams → Web." },
    token: { key: "ga4ApiSecret", label: "Measurement Protocol API secret", hint: "Stored encrypted for later. Purchases are tracked by the browser tag; this secret isn't used yet." },
  },
];

const orUndef = (s: string) => s.trim() || undefined;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** "Meta (Facebook & Instagram)" → "Meta" */
const shortName = (p: Platform) => p.name.replace(/ \(.*\)$/, "");

type ApplyResult = { updated: number; live: number; skipped: number };

export function PixelsForm({
  initial,
  canWrite,
  save,
  pages,
  apply,
}: {
  initial: PixelsValues;
  canWrite: boolean;
  save: (
    pixels: SettingInput<"pixels">,
    secrets: Partial<SettingInput<"tracking_secrets">>,
  ) => Promise<ActionResult<{ secrets: Record<string, string | undefined> }>>;
  /** pages that "Apply to pages" would touch (drafts + live) */
  pages: { total: number; live: number };
  /** null when the role can't edit pages */
  apply: (() => Promise<ActionResult<ApplyResult>>) | null;
}) {
  const router = useRouter();
  const form = useSettingsForm(PixelsFormSchema, initial);
  const v = form.values;
  const [saving, setSaving] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  // what "Apply" copies is the SAVED setting: only offer it when nothing is pending
  const savedPixels = form.dirty ? [] : PLATFORMS.filter((p) => v[p.pixel.key].trim());

  const onSave = async () => {
    if (!form.validate()) return;
    setSaving(true);
    try {
      const res = await runAction(
        save(
          { metaPixelId: orUndef(v.metaPixelId), tiktokPixelId: orUndef(v.tiktokPixelId), snapPixelId: orUndef(v.snapPixelId), ga4Id: orUndef(v.ga4Id) },
          // "" clears a secret, the mask keeps it, anything else replaces it
          {
            metaCapiToken: v.metaCapiToken,
            metaTestEventCode: v.metaTestEventCode.trim(),
            tiktokToken: v.tiktokToken,
            tiktokTestEventCode: v.tiktokTestEventCode.trim(),
            snapToken: v.snapToken,
            ga4ApiSecret: v.ga4ApiSecret,
          },
        ),
        { success: apply && pages.total ? "Pixels saved — apply them to your pages below" : "Pixels saved" },
      );
      if (res) {
        const secrets = Object.fromEntries(Object.entries(res.secrets).map(([k, s]) => [k, s ?? ""]));
        form.commit({ ...v, ...secrets });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!canWrite && <ReadOnlyNote />}
      <p className="adm-rise text-sm leading-relaxed text-pretty text-muted-foreground">
        Your store&apos;s ad pixels in one place. Save them here, then apply them to your pages in one click — each page keeps its own copy, which you can
        fine-tune in the builder under <span className="font-medium text-foreground">SEO &amp; tracking</span>. Pixels only fire on live pages, never in
        previews.
      </p>
      {PLATFORMS.map((p, i) => {
        const active = !!v[p.pixel.key];
        return (
          <SettingsSection
            key={p.id}
            style={{ ["--i" as string]: i + 1 }}
            title={
              <span className="flex items-center gap-2.5">
                <span aria-hidden="true" className={cn("flex size-8 items-center justify-center rounded-xl text-sm font-bold", p.color)}>
                  {p.mark}
                </span>
                {p.name}
              </span>
            }
            aside={
              <StatusChip tone={active ? "emerald" : "neutral"}>
                {active ? (v[p.token.key] ? (p.server ? "Browser + server" : "Pixel + token") : "Pixel") : "Off"}
              </StatusChip>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={p.pixel.label} optional error={form.errors[p.pixel.key]} hint={p.pixel.hint}>
                {(fp) => (
                  <TextInput
                    {...fp}
                    value={v[p.pixel.key]}
                    onChange={(e) => form.set(p.pixel.key, e.target.value)}
                    placeholder={p.pixel.placeholder}
                    disabled={!canWrite}
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono text-[0.82rem]"
                  />
                )}
              </Field>
              <Field label={p.token.label} optional error={form.errors[p.token.key]} hint={p.token.hint}>
                {(fp) => <SecretInput {...fp} value={v[p.token.key]} onChange={(val) => form.set(p.token.key, val)} placeholder="Paste a token" disabled={!canWrite} />}
              </Field>
              {p.extra && (
                <TestCodeField extra={p.extra} value={v[p.extra.key]} error={form.errors[p.extra.key]} disabled={!canWrite} onChange={(val) => form.set(p.extra!.key, val)} />
              )}
            </div>
          </SettingsSection>
        );
      })}
      {apply && (
        <SettingsSection
          title={
            <span className="flex items-center gap-2.5">
              <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <CopyCheckIcon className="size-4" />
              </span>
              Apply to your pages
            </span>
          }
          description={
            pages.total
              ? `Copies the saved pixel IDs into ${plural(pages.total, "page")}. A page keeps its own ID for any platform left empty here. Live pages pick the pixels up when you re-publish them.`
              : "Once you have pages, copy the saved pixel IDs into all of them in one click."
          }
          style={{ ["--i" as string]: PLATFORMS.length + 1 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-foreground/[0.025] px-4 py-3 ring-1 ring-foreground/[0.06] ring-inset">
            <p className="text-sm text-muted-foreground">
              {form.dirty
                ? "Save your changes first — pages get the saved values."
                : savedPixels.length
                  ? `Ready: ${savedPixels.map(shortName).join(", ")}.`
                  : "Add and save at least one pixel ID above."}
            </p>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={!pages.total || !savedPixels.length || saving}
              onClick={() => setConfirmApply(true)}
            >
              <CopyCheckIcon />
              Apply to {pages.total ? plural(pages.total, "page") : "pages"}
            </Button>
          </div>
        </SettingsSection>
      )}

      {apply && (
        <ConfirmDialog
          open={confirmApply}
          onOpenChange={setConfirmApply}
          icon={<CopyCheckIcon />}
          title={`Copy the store pixels into ${plural(pages.total, "page")}?`}
          description={
            <>
              Every draft gets the saved IDs for {savedPixels.map(shortName).join(", ") || "your platforms"}, replacing the IDs those
              pages had for the same platforms.{" "}
              {pages.live ? `The ${plural(pages.live, "live page")} keep${pages.live === 1 ? "s" : ""} running unchanged until you re-publish ${pages.live === 1 ? "it" : "them"}.` : ""}
            </>
          }
          confirmLabel="Apply pixels"
          pendingLabel="Applying…"
          onConfirm={async () => {
            const res = await runAction(apply());
            if (!res) return false;
            const skipped = res.skipped ? { description: `${plural(res.skipped, "page")} changed while this ran and kept ${res.skipped === 1 ? "its" : "their"} pixels — apply again to include ${res.skipped === 1 ? "it" : "them"}.` } : undefined;
            if (!res.updated) toast.success("Every page already uses these pixels", skipped);
            else
              toast.success(
                `${plural(res.updated, "page")} updated${res.live ? ` — re-publish the ${res.live === 1 ? "live one" : `${res.live} live ones`} from Pages` : ""}`,
                skipped,
              );
            router.refresh();
          }}
        >
          {pages.live > 0 && (
            <p className="rounded-xl bg-foreground/[0.035] px-3.5 py-2.5 text-sm text-muted-foreground ring-1 ring-foreground/[0.06] ring-inset">
              Live pages then show <span className="font-medium text-foreground">Unpublished edits</span> in{" "}
              <Link href="/admin/pages?status=published" className="font-medium text-brand hover:underline">
                Pages
              </Link>
              .
            </p>
          )}
        </ConfirmDialog>
      )}

      <SaveBar dirty={form.dirty && canWrite} saving={saving} onSave={onSave} onDiscard={form.discard} />
    </>
  );
}

/** A platform's "Test events" code: capitals and digits only, typed in upper case. */
function TestCodeField({
  extra,
  value,
  error,
  disabled,
  onChange,
}: {
  extra: NonNullable<Platform["extra"]>;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={extra.label} optional error={error} hint={extra.hint}>
      {(fp) => (
        <TextInput
          {...fp}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={extra.placeholder}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-[0.82rem]"
        />
      )}
    </Field>
  );
}
