"use client";
/**
 * Settings → Security for the signed-in user: password change, two-step verification status
 * (enrolment itself lives on /admin/two-factor with its QR code and recovery codes) and the
 * devices signed in to this account, each revocable.
 */
import { KeyRoundIcon, LaptopIcon, Loader2Icon, LogOutIcon, MonitorSmartphoneIcon, ShieldCheckIcon, ShieldIcon, SmartphoneIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { TWO_FACTOR_PATH } from "@/lib/auth/paths";
import type { DeviceSession } from "@/lib/admin-data/security";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { StatusChip } from "../common/status-chip";
import { RelativeTime } from "../common/time";
import { runAction, type ActionResult } from "../lib/action-result";
import { fullDate, shortDate } from "../lib/format";
import { Field, SettingsSection, TextInput } from "./form-kit";

interface PasswordInput {
  current: string;
  next: string;
  confirm: string;
}

const EMPTY: PasswordInput = { current: "", next: "", confirm: "" };

export function SecurityPanel({
  email,
  minLength,
  twoFactor,
  twoFactorTurnedOff = false,
  sessions,
  actions,
}: {
  email: string;
  minLength: number;
  twoFactor: { enabled: boolean; recoveryCodesRemaining: number };
  /** back from /admin/two-factor after turning it off there */
  twoFactorTurnedOff?: boolean;
  sessions: DeviceSession[];
  actions: {
    changePassword: (input: PasswordInput) => Promise<ActionResult<null>>;
    revokeSession: (id: string) => Promise<ActionResult<null>>;
    revokeOthers: () => Promise<ActionResult<{ count: number }>>;
  };
}) {
  return (
    <>
      <PasswordCard email={email} minLength={minLength} save={actions.changePassword} />
      <TwoFactorCard {...twoFactor} turnedOff={twoFactorTurnedOff && !twoFactor.enabled} />
      <SessionsCard sessions={sessions} revoke={actions.revokeSession} revokeOthers={actions.revokeOthers} />
    </>
  );
}

function PasswordCard({ email, minLength, save }: { email: string; minLength: number; save: (input: PasswordInput) => Promise<ActionResult<null>> }) {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordInput, string>>>({});
  const [saving, setSaving] = useState(false);

  const set = (key: keyof PasswordInput, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!values.current) next.current = "Enter your current password.";
    // same rules as the server policy (checkPasswordPolicy); the server stays the authority
    const lower = values.next.normalize("NFKC").toLowerCase();
    const address = email.normalize("NFKC").trim().toLowerCase();
    const local = address.split("@")[0] ?? "";
    if ([...values.next.normalize("NFKC")].length < minLength) next.next = `Use at least ${minLength} characters.`;
    else if (lower.includes(address) || (local.length >= 4 && lower.includes(local))) next.next = "Don't include your email address in your password.";
    if (values.next !== values.confirm) next.confirm = "The two new passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const ok = await runAction(save(values), { success: "Password changed — other devices were signed out" });
      if (ok !== undefined) {
        setValues(EMPTY);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const length = values.next.length;
  const strength = length === 0 ? 0 : length < minLength ? 1 : length < 14 ? 2 : length < 20 ? 3 : 4;

  return (
    <SettingsSection title="Password" description="Changing it signs you out everywhere else." style={{ ["--i" as string]: 1 }}>
      <form onSubmit={submit} noValidate className="grid gap-4">
        {/* lets password managers attach the new password to the right account */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" error={errors.current}>
            {(fp) => <TextInput {...fp} type="password" autoComplete="current-password" value={values.current} onChange={(e) => set("current", e.target.value)} />}
          </Field>
          <Field label="New password" error={errors.next} hint={`${minLength}+ characters — a short sentence works well.`}>
            {(fp) => <TextInput {...fp} type="password" autoComplete="new-password" value={values.next} onChange={(e) => set("next", e.target.value)} />}
          </Field>
          <Field label="Repeat new password" error={errors.confirm}>
            {(fp) => <TextInput {...fp} type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => set("confirm", e.target.value)} />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 w-8 rounded-full transition-colors duration-500",
                  i <= strength ? (strength === 1 ? "bg-warn" : strength === 2 ? "bg-emerald-400" : "bg-emerald-600") : "bg-foreground/10",
                )}
              />
            ))}
            <span className="ms-1 text-xs text-muted-foreground">{["", "Too short", "Good", "Strong", "Excellent"][strength]}</span>
          </div>
          <Button type="submit" className="rounded-full px-4" disabled={saving || !values.current || !values.next}>
            {saving && <Loader2Icon className="animate-spin" />}
            Change password
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function TwoFactorCard({ enabled, recoveryCodesRemaining, turnedOff }: { enabled: boolean; recoveryCodesRemaining: number; turnedOff: boolean }) {
  const low = enabled && recoveryCodesRemaining <= 3;
  return (
    <SettingsSection
      title="Two-step verification"
      description={
        enabled
          ? "Every sign-in asks for a code from your authenticator app, so a leaked password alone can't open the studio."
          : "Add a 6-digit code from your phone to every sign-in. It takes a minute and protects your orders and customers' data."
      }
      aside={
        <StatusChip tone={enabled ? "emerald" : "warn"} pulse={!enabled}>
          {enabled ? "On" : "Off"}
        </StatusChip>
      }
      style={{ ["--i" as string]: 2 }}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 ring-1 ring-inset",
          enabled ? "bg-emerald-500/[0.06] ring-emerald-500/15" : "adm-aurora ring-brand/20",
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn("flex size-11 items-center justify-center rounded-2xl", enabled ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-brand text-brand-foreground")}>
            {enabled ? <ShieldCheckIcon className="size-5" /> : <ShieldIcon className="size-5" />}
          </span>
          <div className="grid gap-0.5" role={turnedOff ? "status" : undefined}>
            <p className="text-sm font-medium">{enabled ? "Authenticator app connected" : turnedOff ? "Two-step verification turned off" : "Not protected yet"}</p>
            <p className={cn("text-xs", low ? "font-medium text-warn-ink" : "text-muted-foreground")}>
              {enabled
                ? `${recoveryCodesRemaining} recovery code${recoveryCodesRemaining === 1 ? "" : "s"} left${low ? " — generate new ones soon" : ""}`
                : turnedOff
                  ? "Your password alone protects this account now. Turn it back on any time."
                  : "Works with Google Authenticator, 1Password, Microsoft Authenticator, Aegis…"}
            </p>
          </div>
        </div>
        <Button asChild variant={enabled ? "outline" : "brand"} className="rounded-full px-4">
          <Link href={`${TWO_FACTOR_PATH}?from=settings`}>
            <KeyRoundIcon />
            {enabled ? "Manage codes" : "Set up now"}
          </Link>
        </Button>
      </div>
    </SettingsSection>
  );
}

function deviceIcon(label: string) {
  if (/iOS|Android/.test(label)) return SmartphoneIcon;
  if (/Windows|macOS|Linux/.test(label)) return LaptopIcon;
  return MonitorSmartphoneIcon;
}

function SessionsCard({
  sessions,
  revoke,
  revokeOthers,
}: {
  sessions: DeviceSession[];
  revoke: (id: string) => Promise<ActionResult<null>>;
  revokeOthers: () => Promise<ActionResult<{ count: number }>>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const others = sessions.filter((s) => !s.current).length;

  const end = async (id: string) => {
    setBusy(id);
    try {
      const ok = await runAction(revoke(id), { success: "Device signed out" });
      if (ok !== undefined) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SettingsSection
      title="Signed-in devices"
      description="Sessions last 30 days and end after a week without use. Sign out anything you don't recognise."
      aside={
        others > 0 ? (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirmAll(true)}>
            <LogOutIcon />
            Sign out other devices
          </Button>
        ) : undefined
      }
      style={{ ["--i" as string]: 3 }}
    >
      <ul className="grid gap-2">
        <AnimatePresence initial={false}>
          {sessions.map((s) => {
            const Icon = deviceIcon(s.device);
            return (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3.5 ring-1 ring-inset",
                  s.current ? "bg-brand/[0.04] ring-brand/20" : "ring-foreground/[0.07]",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", s.current ? "bg-brand/12 text-brand" : "bg-foreground/[0.05] text-muted-foreground")}>
                    <Icon className="size-[1.1rem]" />
                  </span>
                  <div className="grid min-w-0 gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {s.device}
                      {s.current && <StatusChip tone="brand">This device</StatusChip>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active <RelativeTime iso={s.lastSeenAt} /> · since{" "}
                      <time dateTime={s.createdAt} title={fullDate(s.createdAt)} suppressHydrationWarning>
                        {shortDate(s.createdAt)}
                      </time>
                    </p>
                  </div>
                </div>
                {s.current ? (
                  <form action={logout}>
                    <Button type="submit" variant="ghost" size="sm" className="rounded-full">
                      <LogOutIcon />
                      Sign out
                    </Button>
                  </form>
                ) : (
                  <Button variant="ghost" size="sm" className="rounded-full" disabled={busy === s.id} onClick={() => void end(s.id)}>
                    {busy === s.id ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
                    Sign out
                  </Button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {others === 0 && <p className="text-xs text-muted-foreground">Only this device is signed in to your account.</p>}

      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        icon={<LogOutIcon />}
        title={`Sign out ${others} other device${others === 1 ? "" : "s"}?`}
        description="They will need your password (and two-step code) to come back. This device stays signed in."
        confirmLabel="Sign them out"
        pendingLabel="Signing out…"
        onConfirm={async () => {
          const res = await runAction(revokeOthers(), { success: (d) => `${d.count} device${d.count === 1 ? "" : "s"} signed out` });
          if (res === undefined) return false;
          router.refresh();
        }}
      />
    </SettingsSection>
  );
}
