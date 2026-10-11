/**
 * Order-form controls (used by the orderForm section). Pure markup + base.css styling: modern
 * filled fields (56px, soft fill, --sec-line-strong boundary, smooth accent focus glow), 16px+ text
 * (no iOS zoom), stacked labels (or floating ones with `float`), a phone field with its country
 * chip (always LTR), a drawn chevron, and check/radio controls that pop with a spring.
 * Error state is driven by the runtime (aria-invalid on the control, text in [data-error]).
 * Controls are uncontrolled (defaultValue/defaultChecked) — the vanilla runtime owns behavior.
 */
import type { ReactElement, ReactNode } from "react";
import type { RenderContext } from "../types";
import { Icon } from "./Icon";
import { cx, editAttr } from "./util";

export type FieldName = "name" | "phone" | "city" | "address" | "note" | "email";

/** Stable ids for a field: control, error message, hint. */
export function fieldIds(name: string) {
  const id = `lp-f-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return { id, error: `${id}-err`, hint: `${id}-hint` };
}

export interface FieldShellProps {
  ctx: RenderContext;
  /** runtime field key → data-field (name|phone|city|address|note|email or a custom key) */
  field: FieldName | (string & {});
  label: string;
  /** control id the label points at (default fieldIds(field).id) */
  htmlFor?: string;
  hint?: string;
  /** shows the soft "(optional)" style; pass the localized suffix in `label` if needed */
  optional?: boolean;
  /**
   * Floating label: the label rests inside the field and glides up on focus / once filled
   * (engines with :has(); others keep it stacked). Give the control a placeholder (" " is enough).
   */
  float?: boolean;
  className?: string;
  /** data path of the label for click-to-edit */
  editPath?: string;
  children: ReactNode;
}

/** Label + control slot + hint + live error line ([data-error], filled by the runtime). */
export function FieldShell({
  ctx,
  field,
  label,
  htmlFor,
  hint,
  optional = false,
  float = false,
  className,
  editPath,
  children,
}: FieldShellProps): ReactElement {
  const ids = fieldIds(field);
  const forId = htmlFor ?? ids.id;
  return (
    <div className={cx("lp-field", optional && "lp-field--optional", float && "lp-field--float", className)} data-field={field}>
      <label className="lp-field__label" htmlFor={forId}>
        <span {...editAttr(ctx, editPath)}>{label}</span>
      </label>
      {hint ? (
        <p className="lp-field__hint" id={ids.hint}>
          {hint}
        </p>
      ) : null}
      <div className="lp-field__control">{children}</div>
      <p className="lp-field__error" id={ids.error} data-error="" aria-live="polite" />
    </div>
  );
}

/** aria-describedby value for a field's control (error line + optional hint). */
export function describedBy(name: string, withHint = false): string {
  const ids = fieldIds(name);
  return withHint ? `${ids.hint} ${ids.error}` : ids.error;
}

type AutoComplete = "name" | "tel" | "tel-national" | "email" | "address-level2" | "street-address" | "off";

export interface InputProps {
  name: string;
  id?: string;
  type?: "text" | "tel" | "email";
  placeholder?: string;
  required?: boolean;
  autoComplete?: AutoComplete;
  inputMode?: "text" | "tel" | "email" | "numeric";
  enterKeyHint?: "next" | "done" | "send";
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
  dir?: "ltr" | "rtl" | "auto";
  /** ids of the hint/error lines (default: the field's error line) */
  describedBy?: string;
  className?: string;
}

export function Input({
  name,
  id,
  type = "text",
  placeholder,
  required = false,
  autoComplete,
  inputMode,
  enterKeyHint = "next",
  minLength,
  maxLength = 120,
  defaultValue,
  dir,
  describedBy: described,
  className,
}: InputProps): ReactElement {
  return (
    <input
      className={cx("lp-input", className)}
      id={id ?? fieldIds(name).id}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      aria-required={required || undefined}
      autoComplete={autoComplete}
      inputMode={inputMode}
      enterKeyHint={enterKeyHint}
      minLength={minLength}
      maxLength={maxLength}
      defaultValue={defaultValue}
      dir={dir}
      aria-describedby={described ?? fieldIds(name).error}
      spellCheck={type === "text" ? false : undefined}
    />
  );
}

export interface PhoneInputProps {
  ctx: RenderContext;
  name?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  describedBy?: string;
  className?: string;
}

/**
 * Phone field: always LTR (digits read left→right even on Arabic pages), with the market's
 * country chip ("MA +212") as a fixed adornment, numeric keypad, national-format autocomplete.
 */
export function PhoneInput({
  ctx,
  name = "phone",
  id,
  required = true,
  placeholder,
  describedBy: described,
  className,
}: PhoneInputProps): ReactElement {
  return (
    <div className={cx("lp-input-group", className)} dir="ltr">
      <span className="lp-input-group__prefix">
        <span className="lp-input-group__cc" aria-hidden="true">
          {ctx.market.phoneCountry}
        </span>
        <span className="lp-input-group__dial">{ctx.market.phonePrefix}</span>
      </span>
      <Input
        name={name}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        dir="ltr"
        required={required}
        minLength={6}
        maxLength={20}
        placeholder={placeholder ?? ctx.market.phonePlaceholder}
        describedBy={described}
        className="lp-input--grouped"
      />
    </div>
  );
}

export interface SelectProps {
  name: string;
  id?: string;
  options: { value: string; label: string }[];
  /** first, disabled option shown until a choice is made */
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: AutoComplete;
  describedBy?: string;
  className?: string;
}

/** Native select (best on mobile) with a custom chevron. */
export function Select({
  name,
  id,
  options,
  placeholder,
  required = false,
  defaultValue,
  autoComplete,
  describedBy: described,
  className,
}: SelectProps): ReactElement {
  return (
    <div className={cx("lp-select", className)}>
      <select
        className="lp-select__el"
        id={id ?? fieldIds(name).id}
        name={name}
        required={required}
        aria-required={required || undefined}
        autoComplete={autoComplete}
        defaultValue={defaultValue ?? (placeholder ? "" : undefined)}
        aria-describedby={described ?? fieldIds(name).error}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={20} className="lp-select__chev" />
    </div>
  );
}

export interface TextareaProps {
  name: string;
  id?: string;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  autoComplete?: AutoComplete;
  describedBy?: string;
  className?: string;
}

export function Textarea({
  name,
  id,
  rows = 3,
  placeholder,
  required = false,
  maxLength = 300,
  autoComplete,
  describedBy: described,
  className,
}: TextareaProps): ReactElement {
  return (
    <textarea
      className={cx("lp-input", "lp-textarea", className)}
      id={id ?? fieldIds(name).id}
      name={name}
      rows={rows}
      placeholder={placeholder}
      required={required}
      aria-required={required || undefined}
      maxLength={maxLength}
      autoComplete={autoComplete}
      aria-describedby={described ?? fieldIds(name).error}
    />
  );
}

export interface ChoiceProps {
  name: string;
  value: string;
  id?: string;
  defaultChecked?: boolean;
  required?: boolean;
  /** visible label; omit to get the bare control (e.g. inside a bundle card that is itself a <label>) */
  label?: ReactNode;
  describedBy?: string;
  className?: string;
}

/** Custom radio (real input; the accent fill and center dot pop in with a spring). */
export function Radio({ name, value, id, defaultChecked, required, label, describedBy: d, className }: ChoiceProps): ReactElement {
  const control = (
    <span className={cx("lp-radio", !label && className)}>
      <input
        className="lp-radio__input"
        type="radio"
        name={name}
        value={value}
        id={id}
        defaultChecked={defaultChecked}
        required={required}
        aria-describedby={d}
      />
      <span className="lp-radio__dot" aria-hidden="true" />
    </span>
  );
  if (!label) return control;
  return (
    <label className={cx("lp-choice", className)}>
      {control}
      <span className="lp-choice__label">{label}</span>
    </label>
  );
}

/** Custom checkbox: rounded box that fills with the accent and draws a crisp check when checked. */
export function Checkbox({ name, value, id, defaultChecked, required, label, describedBy: d, className }: ChoiceProps): ReactElement {
  const control = (
    <span className={cx("lp-check", !label && className)}>
      <input
        className="lp-check__input"
        type="checkbox"
        name={name}
        value={value}
        id={id}
        defaultChecked={defaultChecked}
        required={required}
        aria-describedby={d}
      />
      <svg className="lp-check__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 12.4l4 4L18.2 8" pathLength={1} />
      </svg>
    </span>
  );
  if (!label) return control;
  return (
    <label className={cx("lp-choice", className)}>
      {control}
      <span className="lp-choice__label">{label}</span>
    </label>
  );
}

/** Visually hidden honeypot (runtime contract: input[name=website].lp-hp). */
export function Honeypot(): ReactElement {
  return (
    <input className="lp-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
  );
}
