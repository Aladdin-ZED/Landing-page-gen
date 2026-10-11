"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormAlert, PasswordField, SubmitButton, TextField } from "../_components/form-ui";
import { IDLE } from "../_lib/form-state";
import { setupAction } from "./actions";

export function SetupForm({ minPasswordLength }: { minPasswordLength: number }) {
  const [state, action, pending] = useActionState(setupAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  const error = state.status === "error" ? state : null;

  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className="grid gap-5">
      <FormAlert message={error?.message} />
      <PasswordField
        label="Setup token"
        name="token"
        autoComplete="off"
        required
        autoFocus
        hint="The SETUP_TOKEN value from the server environment."
        error={error?.fieldErrors?.token}
      />
      <div className="my-1 border-t" role="presentation" />
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        maxLength={120}
        defaultValue={error?.values?.name ?? ""}
        error={error?.fieldErrors?.name}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={191}
        defaultValue={error?.values?.email ?? ""}
        error={error?.fieldErrors?.email}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        minLength={minPasswordLength}
        maxLength={200}
        hint={`At least ${minPasswordLength} characters. A short sentence works well.`}
        error={error?.fieldErrors?.password}
      />
      <PasswordField
        label="Confirm password"
        name="confirm"
        autoComplete="new-password"
        required
        maxLength={200}
        error={error?.fieldErrors?.confirm}
      />
      <SubmitButton pending={pending} pendingLabel="Creating account…" className="mt-1">
        Create owner account
      </SubmitButton>
    </form>
  );
}
