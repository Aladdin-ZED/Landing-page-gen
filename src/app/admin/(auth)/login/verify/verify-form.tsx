"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert, SubmitButton, TextField } from "../../_components/form-ui";
import { OtpField } from "../../_components/otp-field";
import { IDLE } from "../../_lib/form-state";
import { verifyAction } from "./actions";

export function VerifyForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(verifyAction, IDLE);
  const [method, setMethod] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [seenState, setSeenState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.status === "error" ? state : null;

  // A rejected code is useless: clear it (during render, on the new result)…
  if (state !== seenState) {
    setSeenState(state);
    if (state.status === "error") setCode("");
  }
  // …and return focus to the input.
  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
  }, [state]);

  const switchMethod = () => {
    setMethod((m) => (m === "totp" ? "recovery" : "totp"));
    setCode("");
  };

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-6">
      <input type="hidden" name="method" value={method} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormAlert message={error?.message} />

      {method === "totp" ? (
        <OtpField
          label="Authentication code"
          name="code"
          value={code}
          onChange={setCode}
          onComplete={() => {
            if (!pending) formRef.current?.requestSubmit();
          }}
          error={error?.fieldErrors?.code}
          autoFocus
          disabled={pending}
        />
      ) : (
        <TextField
          key="recovery"
          label="Recovery code"
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          maxLength={20}
          placeholder="XXXX-XXXX-XXXX"
          className="font-mono tracking-wider uppercase placeholder:normal-case"
          hint="Each recovery code works once."
          error={error?.fieldErrors?.code}
        />
      )}

      <SubmitButton pending={pending} pendingLabel="Verifying…">
        Verify and continue
      </SubmitButton>

      <button
        type="button"
        onClick={switchMethod}
        className="justify-self-center rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {method === "totp" ? "Use a recovery code instead" : "Use the authenticator app instead"}
      </button>
    </form>
  );
}
