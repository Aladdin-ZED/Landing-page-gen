"use client";

import { ArrowLeftIcon, CheckIcon, CopyIcon, KeyRoundIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormAlert, PasswordField, SubmitButton, TextField } from "../_components/form-ui";
import { OtpField } from "../_components/otp-field";
import {
  beginEnrollmentAction,
  confirmEnrollmentAction,
  disableAction,
  regenerateCodesAction,
  type ChallengeState,
  type CodesState,
  type DisableState,
} from "./actions";
import { RecoveryCodes } from "./recovery-codes";

const IDLE_CHALLENGE: ChallengeState = { status: "idle" };
const IDLE_CODES: CodesState = { status: "idle" };
const IDLE_DISABLE: DisableState = { status: "idle" };

export function TwoFactorManager({
  enabled,
  remaining,
  continueHref,
  fromSetup,
  fromSettings = false,
  notice,
}: {
  enabled: boolean;
  remaining: number;
  continueHref: string;
  fromSetup: boolean;
  /** opened from Settings → Security: "Done", "Continue" and turning off return there */
  fromSettings?: boolean;
  notice: string | null;
}) {
  const [challenge, begin, beginning] = useActionState(beginEnrollmentAction, IDLE_CHALLENGE);
  const [confirmed, confirm, confirming] = useActionState(confirmEnrollmentAction, IDLE_CODES);
  const [regenerated, regenerate, regenerating] = useActionState(regenerateCodesAction, IDLE_CODES);

  // Fresh codes win over everything else: they are shown exactly once.
  if (confirmed.status === "codes") return <RecoveryCodes codes={confirmed.recoveryCodes} continueHref={continueHref} />;
  if (regenerated.status === "codes") return <RecoveryCodes codes={regenerated.recoveryCodes} continueHref={continueHref} />;

  return (
    <div className="grid gap-6">
      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {enabled ? (
        <EnabledView
          remaining={remaining}
          continueHref={continueHref}
          fromSettings={fromSettings}
          regenerate={regenerate}
          regenerating={regenerating}
          regenerateError={regenerated.status === "error" ? regenerated : null}
        />
      ) : challenge.status === "challenge" ? (
        <ChallengeView
          challenge={challenge}
          confirm={confirm}
          confirming={confirming}
          error={confirmed.status === "error" ? confirmed : null}
          restart={begin}
          restarting={beginning}
        />
      ) : (
        <IntroView
          begin={begin}
          beginning={beginning}
          error={challenge.status === "error" ? challenge.message : undefined}
          fromSetup={fromSetup}
          fromSettings={fromSettings}
          continueHref={continueHref}
        />
      )}
    </div>
  );
}

function IntroView({
  begin,
  beginning,
  error,
  fromSetup,
  fromSettings,
  continueHref,
}: {
  begin: (data: FormData) => void;
  beginning: boolean;
  error?: string;
  fromSetup: boolean;
  fromSettings: boolean;
  continueHref: string;
}) {
  return (
    <form action={begin} className="grid gap-5">
      <FormAlert message={error} />
      <ul className="grid gap-3 text-sm">
        <li className="flex gap-3">
          <SmartphoneIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Use any authenticator app — Google Authenticator, 1Password, Microsoft Authenticator, Aegis…
          </span>
        </li>
        <li className="flex gap-3">
          <KeyRoundIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>Each sign-in will ask for a 6-digit code from the app, on top of your password.</span>
        </li>
      </ul>
      <SubmitButton pending={beginning} pendingLabel="Preparing…">
        Set up authenticator app
      </SubmitButton>
      {fromSetup && (
        <Link
          href={continueHref}
          className="justify-self-center rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Skip for now
        </Link>
      )}
      {fromSettings && <BackToSettings href={continueHref} />}
    </form>
  );
}

function ChallengeView({
  challenge,
  confirm,
  confirming,
  error,
  restart,
  restarting,
}: {
  challenge: Extract<ChallengeState, { status: "challenge" }>;
  confirm: (data: FormData) => void;
  confirming: boolean;
  error: { message: string; field?: string } | null;
  restart: (data: FormData) => void;
  restarting: boolean;
}) {
  const [code, setCode] = useState("");
  // Controlled, so a mistyped code doesn't also wipe the password (form actions reset uncontrolled fields).
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [seenError, setSeenError] = useState(error);
  if (error !== seenError) {
    setSeenError(error);
    // Clear only what was wrong: a rejected password keeps the code, anything else asks for a new code.
    if (error?.field === "password") setPassword("");
    else if (error) setCode("");
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(challenge.secretDisplay.replace(/\s/g, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-6">
      <ol className="grid gap-6">
        <li className="grid gap-3">
          <p className="text-sm font-medium">1. Scan this code with your authenticator app</p>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR code, nothing to optimise */}
            <img
              src={challenge.qrDataUrl}
              alt="QR code for setting up two-step verification"
              width={152}
              height={152}
              className="size-38 shrink-0 rounded-lg border bg-white p-1.5"
            />
            <div className="grid min-w-0 gap-2 text-xs text-muted-foreground">
              <p>Can&apos;t scan? Enter this key instead:</p>
              <code className="rounded-md bg-muted px-2 py-1.5 text-[0.8rem] leading-relaxed break-all text-foreground">
                {challenge.secretDisplay}
              </code>
              <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={copySecret}>
                {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
                {copied ? "Copied" : "Copy key"}
              </Button>
            </div>
          </div>
        </li>
        <li>
          <form action={confirm} noValidate className="grid gap-4">
            <FormAlert message={error && !error.field ? error.message : undefined} />
            <OtpField
              label="2. Enter the 6-digit code it shows"
              name="code"
              value={code}
              onChange={setCode}
              error={error?.field === "code" ? error.message : undefined}
              autoFocus
            />
            <PasswordField
              label="3. Confirm with your password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint="Confirms it's really you. Your other devices are signed out once it's on."
              error={error?.field === "password" ? error.message : undefined}
            />
            <SubmitButton pending={confirming} pendingLabel="Turning on…">
              Turn on two-step verification
            </SubmitButton>
          </form>
        </li>
      </ol>
      <form action={restart} className="text-center">
        <button
          type="submit"
          disabled={restarting}
          className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          Start over with a new key
        </button>
      </form>
    </div>
  );
}

/** Quiet way back to Settings → Security for an admin who changes their mind. */
function BackToSettings({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-self-center gap-1.5 rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <ArrowLeftIcon aria-hidden="true" className="size-3.5 rtl:rotate-180" />
      Back to Security settings
    </Link>
  );
}

function EnabledView({
  remaining,
  continueHref,
  fromSettings,
  regenerate,
  regenerating,
  regenerateError,
}: {
  remaining: number;
  continueHref: string;
  fromSettings: boolean;
  regenerate: (data: FormData) => void;
  regenerating: boolean;
  regenerateError: { message: string; field?: string } | null;
}) {
  const [code, setCode] = useState("");
  const [seenError, setSeenError] = useState(regenerateError);
  if (regenerateError !== seenError) {
    setSeenError(regenerateError);
    if (regenerateError) setCode("");
  }
  const [showDisable, setShowDisable] = useState(false);
  const [disabled, disable, disabling] = useActionState(disableAction, IDLE_DISABLE);
  const disableError = disabled.status === "error" ? disabled : null;
  const low = remaining <= 3;

  return (
    <div className="grid gap-8">
      <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
        <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
        <div className="grid gap-1 text-sm">
          <p className="font-medium">Two-step verification is on</p>
          <p className={low ? "text-destructive" : "text-muted-foreground"}>
            {remaining === 1 ? "1 recovery code left." : `${remaining} recovery codes left.`}
            {low && " Generate new ones soon."}
          </p>
        </div>
      </div>

      <section aria-labelledby="regen-title" className="grid gap-3">
        <h2 id="regen-title" className="text-sm font-semibold">
          New recovery codes
        </h2>
        <p className="text-sm text-muted-foreground">Replaces all existing codes. Enter a code from your app to confirm.</p>
        <form action={regenerate} noValidate className="grid gap-4">
          <FormAlert message={regenerateError && regenerateError.field !== "code" ? regenerateError.message : undefined} />
          <OtpField
            label="Authentication code"
            name="code"
            value={code}
            onChange={setCode}
            error={regenerateError?.field === "code" ? regenerateError.message : undefined}
          />
          <SubmitButton pending={regenerating} pendingLabel="Generating…" variant="outline">
            Generate new codes
          </SubmitButton>
        </form>
      </section>

      <section aria-labelledby="disable-title" className="grid gap-3 border-t pt-6">
        <h2 id="disable-title" className="text-sm font-semibold">
          Turn off two-step verification
        </h2>
        {showDisable ? (
          <form action={disable} noValidate className="grid gap-4">
            {fromSettings && <input type="hidden" name="from" value="settings" />}
            <p className="text-sm text-muted-foreground">
              Your account will be protected by your password only.
            </p>
            <FormAlert message={disableError && !disableError.field ? disableError.message : undefined} />
            <PasswordField
              label="Password"
              name="password"
              autoComplete="current-password"
              required
              error={disableError?.field === "password" ? disableError.message : undefined}
            />
            <TextField
              label="Authenticator or recovery code"
              name="code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              required
              className="font-mono tracking-wider"
              error={disableError?.field === "code" ? disableError.message : undefined}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="ghost" className="h-10" onClick={() => setShowDisable(false)}>
                Cancel
              </Button>
              <SubmitButton pending={disabling} pendingLabel="Turning off…" variant="destructive">
                Turn off
              </SubmitButton>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" className="justify-self-start text-destructive" onClick={() => setShowDisable(true)}>
            Turn off…
          </Button>
        )}
      </section>

      <Button asChild size="lg" variant="secondary" className="h-10 w-full">
        <Link href={continueHref}>{fromSettings ? "Back to Security settings" : "Done"}</Link>
      </Button>
    </div>
  );
}
