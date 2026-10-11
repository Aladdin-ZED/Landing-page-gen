"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormAlert, PasswordField, SubmitButton, TextField } from "../_components/form-ui";
import { IDLE } from "../_lib/form-state";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState(loginAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.status === "error" ? state : null;

  // After a failed attempt, put the cursor where the user needs to act.
  useEffect(() => {
    if (state.status !== "error") return;
    const form = formRef.current;
    const target =
      form?.querySelector<HTMLInputElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLInputElement>('input[name="password"]');
    target?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      {next && <input type="hidden" name="next" value={next} />}
      <FormAlert message={error?.message} />
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        autoFocus
        maxLength={191}
        defaultValue={error?.values?.email ?? ""}
        error={error?.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        maxLength={200}
        error={error?.fieldErrors?.password}
      />
      <SubmitButton pending={pending} pendingLabel="Signing in…" className="mt-1">
        Sign in
      </SubmitButton>
    </form>
  );
}
