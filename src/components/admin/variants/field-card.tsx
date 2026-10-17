"use client";
/**
 * Custom field card (docs/OFFERS.md §D.1, §D.5): a value the customer types on the order form ("Name
 * to print", a number). Label, input type, required, max length, allowed characters, placeholder,
 * help, an optional price ("gravure +30", only while the field is optional: a required field can't
 * add a price) and per piece / once per order.
 */
import { ArrowDown, ArrowUp, TextCursorInput, Trash2 } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Segmented } from "@/components/admin/common/segmented";
import { NumberInput } from "@/components/builder/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { feature } from "@/lib/page/features";
import { FIELD_CHARSETS, type FieldGroup } from "@/lib/page/schema";
import { cleanLabel } from "@/lib/page/variant-presets";
import { cn } from "@/lib/utils";
import { DraftInput, IconAction } from "./parts";
import type { Density } from "./options-field";

const CHARSET_LABELS: Record<(typeof FIELD_CHARSETS)[number], { label: string; hint: string }> = {
  any: { label: "Any characters", hint: "Letters, digits and signs (never < or >)." },
  letters: { label: "Letters only", hint: "Any alphabet (Arabic or Latin), spaces, apostrophes, dots and dashes." },
  latin: { label: "Latin letters & digits", hint: "For printers and engravers that only take A–Z, accents and 0–9." },
  digits: { label: "Digits only", hint: "Arabic-Indic digits are converted to 0–9." },
};

export interface FieldCardProps {
  group: FieldGroup;
  density: Density;
  currency?: string;
  position: number;
  count: number;
  onPatch: (patch: Partial<FieldGroup>, coalesce?: string | null) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
  issues: readonly { level: "error" | "warn"; message: string }[];
}

export function FieldCard({ group: g, density, currency, position, count, onPatch, onMove, onRemove, issues }: FieldCardProps) {
  const compact = density === "compact";
  const ids = { name: useId(), max: useId(), ph: useId(), help: useId(), req: useId(), unit: useId(), delta: useId(), min: useId(), maxv: useId() };
  const deltas = feature("PRICE_DELTAS");
  return (
    <section
      aria-label={g.name || "Custom field"}
      className={cn(
        "grid min-w-0 rounded-2xl bg-background ring-1 ring-foreground/[0.08] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-18px_rgb(0_0_0/0.18)] dark:bg-foreground/[0.03]",
        compact ? "gap-2.5 p-3" : "gap-3.5 p-4",
      )}
    >
      <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2.5")}>
        <span className={cn("grid shrink-0 place-items-center rounded-lg bg-brand-soft text-brand", compact ? "size-7 [&_svg]:size-3.5" : "size-9 [&_svg]:size-[1.05rem]")}>
          <TextCursorInput />
        </span>
        <label htmlFor={ids.name} className="sr-only">
          Field label (shown on the page)
        </label>
        <DraftInput
          id={ids.name}
          dir="auto"
          value={g.name}
          maxLength={40}
          placeholder="e.g. Name to print"
          clean={(raw) => cleanLabel(raw) || null}
          onCommit={(v) => onPatch({ name: v }, `field:${g.id}:name`)}
          className={cn(
            "min-w-0 flex-1 border-transparent bg-transparent font-semibold tracking-[-0.01em] shadow-none hover:border-input focus-visible:border-ring dark:bg-transparent",
            compact ? "h-8 px-2 text-[13px]" : "h-9 px-2.5 text-[15px]",
          )}
        />
        <div className="flex shrink-0 items-center">
          <IconAction label="Move up" disabled={position <= 0} onClick={() => onMove(-1)} compact={compact}>
            <ArrowUp />
          </IconAction>
          <IconAction label="Move down" disabled={position >= count - 1} onClick={() => onMove(1)} compact={compact}>
            <ArrowDown />
          </IconAction>
          <IconAction label={`Remove ${g.name || "field"}`} onClick={onRemove} compact={compact} danger>
            <Trash2 />
          </IconAction>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted-foreground">The customer types</span>
        <Segmented<"text" | "number">
          size="sm"
          label="Input type"
          value={g.input}
          onChange={(input) => onPatch({ input, ...(input === "number" ? { charset: "digits" as const } : {}) })}
          options={[
            { value: "text", label: "Text" },
            { value: "number", label: "Number" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {g.input === "text" ? (
          <>
            <Row label="Max length" htmlFor={ids.max}>
              <NumberInput id={ids.max} value={g.maxLength} min={1} max={60} integer suffix="chars" onCommit={(v) => onPatch({ maxLength: v ?? 24 }, `field:${g.id}:max`)} />
            </Row>
            <Row label="Allowed">
              <Select value={g.charset} onValueChange={(v) => onPatch({ charset: v as FieldGroup["charset"] })}>
                <SelectTrigger className="h-8 w-full text-[12.5px]" aria-label="Allowed characters">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_CHARSETS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHARSET_LABELS[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </>
        ) : (
          <>
            <Row label="Minimum" htmlFor={ids.min}>
              <NumberInput id={ids.min} value={g.min} min={0} max={1_000_000} integer optional placeholder="—" onCommit={(v) => onPatch({ min: v }, `field:${g.id}:min`)} />
            </Row>
            <Row label="Maximum" htmlFor={ids.maxv}>
              <NumberInput id={ids.maxv} value={g.max} min={0} max={1_000_000} integer optional placeholder="—" onCommit={(v) => onPatch({ max: v }, `field:${g.id}:maxv`)} />
            </Row>
          </>
        )}
      </div>
      {g.input === "text" ? <p className="-mt-1 text-[11px] leading-snug text-muted-foreground">{CHARSET_LABELS[g.charset].hint}</p> : null}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Row label="Placeholder" htmlFor={ids.ph}>
          <DraftInput id={ids.ph} dir="auto" value={g.placeholder ?? ""} maxLength={40} placeholder="e.g. Sara" onCommit={(v) => onPatch({ placeholder: v.trim() || undefined }, `field:${g.id}:ph`)} className="h-8 text-[12.5px]" />
        </Row>
        <Row label="Help line" htmlFor={ids.help}>
          <DraftInput id={ids.help} dir="auto" value={g.help ?? ""} maxLength={90} placeholder="Optional" onCommit={(v) => onPatch({ help: v.trim() || undefined }, `field:${g.id}:help`)} className="h-8 text-[12.5px]" />
        </Row>
      </div>

      <div className={cn("grid gap-2.5 border-t border-foreground/[0.06]", compact ? "pt-2.5" : "pt-3")}>
        <Toggle id={ids.req} checked={g.required} onChange={(required) => onPatch({ required, ...(required ? { delta: undefined } : {}) })} title="Required" hint={g.required ? "The order can't be sent without it." : "The customer can leave it empty."} />
        {deltas ? (
          <div className="grid gap-1">
            <Row label="Adds to the price" htmlFor={ids.delta}>
              <NumberInput
                id={ids.delta}
                value={g.delta}
                min={0}
                max={100_000}
                optional
                placeholder={g.required ? "—" : "0"}
                suffix={currency}
                className={cn(g.required && "pointer-events-none opacity-50")}
                onCommit={(v) => !g.required && onPatch({ delta: v === undefined || v === 0 ? undefined : Math.round(v * 100) / 100 }, `field:${g.id}:delta`)}
              />
            </Row>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {g.required ? "A required field can't add a price; include it in the offer price or make it optional." : "Charged when the customer fills it in (e.g. engraving)."}
            </p>
          </div>
        ) : null}
        <Toggle
          id={ids.unit}
          checked={g.perUnit}
          onChange={(perUnit) => onPatch({ perUnit })}
          title="Ask for each piece in packs"
          hint={g.perUnit ? "A pack of 2 asks twice (one name per piece)." : "Typed once for the whole order."}
        />
      </div>
      {issues.length ? (
        <ul className="-mt-1 grid gap-1">
          {issues.map((x, i) => (
            <li key={i} className={cn("text-[11.5px] leading-snug", x.level === "error" ? "font-medium text-destructive" : "text-warn-ink")}>
              {x.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <label htmlFor={htmlFor} className="text-[11.5px] font-medium text-foreground/80">
        {label}
      </label>
      {children}
    </div>
  );
}

function Toggle({ id, checked, onChange, title, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label htmlFor={id} className="flex min-w-0 cursor-pointer items-start gap-2.5">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} className="mt-[3px]" />
      <span className="grid min-w-0 gap-0.5">
        <span className="text-[12.5px] font-medium">{title}</span>
        <span className="text-[11.5px] leading-snug text-pretty text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
