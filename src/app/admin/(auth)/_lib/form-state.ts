/**
 * Result shape returned by the auth server actions (useActionState-friendly).
 * Successful flows usually redirect, so "success" only carries data a page must display.
 */

export type FieldErrors = Partial<Record<string, string>>;

export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      /** form-level message (generic for credential errors) */
      message?: string;
      fieldErrors?: FieldErrors;
      /** non-secret values to restore into the form after an error */
      values?: Record<string, string>;
    };

export const IDLE: FormState = { status: "idle" };

export function formError(message?: string, fieldErrors?: FieldErrors, values?: Record<string, string>): FormState {
  return { status: "error", message, fieldErrors, values };
}

/** Reads a string field from FormData (files and missing fields become ""), bounded in length. */
export function field(data: FormData, name: string, max = 1024): string {
  const value = data.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}
