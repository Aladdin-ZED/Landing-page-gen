"use client";
/**
 * Settings → Pixels: one card per ad platform with its pixels (Meta and TikTok take up to 3 —
 * backup ad accounts), each with its own server token and test event code, a status that says what
 * actually fires (Not set · Browser only · Browser + server), short "where to find it" steps, a
 * "Send test event" that shows the platform's own answer, and "Apply to pages".
 */
import {
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CopyCheckIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  Loader2Icon,
  MonitorSmartphoneIcon,
  PlusIcon,
  SendIcon,
  ServerIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TestEventResult } from "@/lib/orders/conversions-core";
import {
  emptyRow,
  isMask,
  normalizeForm,
  platformStatus,
  validatePixelForm,
  type PixelFormErrors,
  type PixelFormValues,
  type PixelRow,
  type PixelStatus,
} from "@/lib/pixels/form";
import { PIXEL_LIMIT, PIXEL_PLATFORMS, isServerPlatform, normalizePixelId, type PixelPlatform, type ServerPlatform } from "@/lib/pixels/ids";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "../common/confirm-dialog";
import { StatusChip } from "../common/status-chip";
import { runAction, type ActionResult } from "../lib/action-result";
import type { Tone } from "../lib/status";
import { Field, ReadOnlyNote, SaveBar, SecretInput, SettingsSection, TextInput } from "./form-kit";

/* ------------------------------------------------------------------ */
/* platforms                                                           */
/* ------------------------------------------------------------------ */

interface PlatformMeta {
  id: PixelPlatform;
  name: string;
  tagline: string;
  mark: string;
  markClass: string;
  idLabel: string;
  placeholder: string;
  /** where to find the id / token / test code — short, in the platform's own words */
  steps: { id: ReactNode; token?: ReactNode; test?: ReactNode };
  tokenLabel?: string;
  /** events the browser pixel sends, in funnel order */
  events: readonly string[];
}

const PLATFORMS: Record<PixelPlatform, PlatformMeta> = {
  meta: {
    id: "meta",
    name: "Meta",
    tagline: "Facebook & Instagram ads",
    mark: "M",
    markClass: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    idLabel: "Pixel ID",
    placeholder: "1234567890123456",
    tokenLabel: "Conversions API token",
    steps: {
      id: (
        <>
          <Ext href="https://business.facebook.com/events_manager2">Events Manager</Ext> → Data sources → your pixel: the ID is under its name.
        </>
      ),
      token: <>Same pixel → Settings → Conversions API → Generate access token.</>,
      test: <>Same pixel → Test events → Confirm your server events → copy the code (TEST…).</>,
    },
    events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Lead", "Purchase"],
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    tagline: "TikTok ads",
    mark: "T",
    markClass: "bg-foreground/[0.07] text-foreground",
    idLabel: "Pixel ID",
    placeholder: "C4ABCDEF1234567890",
    tokenLabel: "Events API access token",
    steps: {
      id: (
        <>
          <Ext href="https://ads.tiktok.com/i18n/events_manager">TikTok Events Manager</Ext> → Web → your pixel: copy its ID (capital letters and digits).
        </>
      ),
      token: <>Same pixel → Settings → Events API → Generate access token.</>,
      test: <>Same pixel → Test events → copy the test event code.</>,
    },
    events: ["Page", "ViewContent", "AddToCart", "InitiateCheckout", "SubmitForm", "Purchase"],
  },
  snap: {
    id: "snap",
    name: "Snapchat",
    tagline: "Snap ads",
    mark: "S",
    markClass: "bg-warn/30 text-warn-ink",
    idLabel: "Pixel ID",
    placeholder: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    steps: {
      id: (
        <>
          <Ext href="https://ads.snapchat.com/">Snap Ads Manager</Ext> → Events Manager → your Pixel: copy the Pixel ID.
        </>
      ),
    },
    events: ["PAGE_VIEW", "VIEW_CONTENT", "ADD_CART", "START_CHECKOUT", "SIGN_UP", "PURCHASE"],
  },
  ga4: {
    id: "ga4",
    name: "Google Analytics 4",
    tagline: "Traffic & conversions",
    mark: "G",
    markClass: "bg-foreground/[0.07] text-foreground",
    idLabel: "Measurement ID",
    placeholder: "G-AB12CD34EF",
    steps: {
      id: (
        <>
          <Ext href="https://analytics.google.com/">Google Analytics</Ext> → Admin → Data streams → Web: copy the Measurement ID (G-…).
        </>
      ),
    },
    events: ["page_view", "view_item", "add_to_cart", "begin_checkout", "generate_lead", "purchase"],
  },
};

const STATUS: Record<PixelStatus, { tone: Tone; label: (on: number, of: number) => string }> = {
  off: { tone: "neutral", label: () => "Not set" },
  browser: { tone: "blue", label: () => "Browser only" },
  partial: { tone: "teal", label: (on, of) => `Browser + server · ${on} of ${of}` },
  server: { tone: "emerald", label: () => "Browser + server" },
};

const ROW_LABELS = ["Main pixel", "Backup pixel", "Second backup"];

/* ------------------------------------------------------------------ */
/* form state                                                          */
/* ------------------------------------------------------------------ */

type UiRow = PixelRow & { k: string };
type UiValues = Record<PixelPlatform, UiRow[]>;
type ApplyResult = { updated: number; live: number; skipped: number };
type TestInput = { platform: ServerPlatform; id: string; origin: string; token: string; testCode: string };

let seq = 0;
const key = () => `r${++seq}`;

/** Rows for the UI: at least one (blank) row per platform so there is always a field to type in. */
function toUi(values: PixelFormValues): UiValues {
  const out = {} as UiValues;
  for (const p of PIXEL_PLATFORMS) {
    const rows = values[p] ?? [];
    out[p] = (rows.length ? rows : [emptyRow()]).map((r) => ({ ...r, k: key() }));
  }
  return out;
}

const strip = (v: UiValues): PixelFormValues =>
  Object.fromEntries(PIXEL_PLATFORMS.map((p) => [p, v[p].map((r) => ({ origin: r.origin, id: r.id, token: r.token, testCode: r.testCode }))])) as PixelFormValues;

/** Comparable form content (blank rows ignored, ids/test codes in canonical form). */
const signature = (v: UiValues) => {
  const n = normalizeForm(strip(v));
  return JSON.stringify(PIXEL_PLATFORMS.map((p) => n[p].filter((r) => r.id || r.token || r.testCode)));
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ------------------------------------------------------------------ */
/* component                                                           */
/* ------------------------------------------------------------------ */

export function PixelsForm({
  initial,
  canWrite,
  save,
  test,
  pages,
  apply,
}: {
  initial: PixelFormValues;
  canWrite: boolean;
  save: (values: PixelFormValues) => Promise<ActionResult<{ values: PixelFormValues }>>;
  /** null when the role can't change settings */
  test: ((input: TestInput) => Promise<ActionResult<TestEventResult>>) | null;
  /** pages that "Apply to pages" would touch (drafts + live) */
  pages: { total: number; live: number };
  /** null when the role can't edit pages */
  apply: (() => Promise<ActionResult<ApplyResult>>) | null;
}) {
  const router = useRouter();
  const [base, setBase] = useState<UiValues>(() => toUi(initial));
  const [values, setValues] = useState<UiValues>(base);
  const [errors, setErrors] = useState<PixelFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const dirty = useMemo(() => signature(values) !== signature(base), [values, base]);
  // what "Apply" copies is the SAVED setting: only offer it when nothing is pending
  const savedPlatforms = PIXEL_PLATFORMS.filter((p) => base[p].some((r) => r.id));

  const clearError = useCallback((path: string) => {
    setErrors((e) => {
      if (!e[path]) return e;
      const next = { ...e };
      delete next[path];
      return next;
    });
  }, []);

  const update = (p: PixelPlatform, k: string, field: keyof PixelRow, value: string) => {
    setValues((v) => ({ ...v, [p]: v[p].map((r) => (r.k === k ? { ...r, [field]: value } : r)) }));
    const i = values[p].findIndex((r) => r.k === k);
    clearError(`${p}.${i}.${field}`);
  };
  const addRow = (p: PixelPlatform) => setValues((v) => (v[p].length >= PIXEL_LIMIT[p] ? v : { ...v, [p]: [...v[p], { ...emptyRow(), k: key() }] }));
  const removeRow = (p: PixelPlatform, k: string) => {
    setValues((v) => {
      const rest = v[p].filter((r) => r.k !== k);
      return { ...v, [p]: rest.length ? rest : [{ ...emptyRow(), k: key() }] };
    });
    // row indexes shift: re-validate from scratch on the next save
    setErrors({});
  };

  const onSave = async () => {
    const normalized = normalizeForm(strip(values));
    const found = validatePixelForm(normalized);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error("Check the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const res = await runAction(save(normalized), {
        success: apply && pages.total ? "Pixels saved — apply them to your pages below" : "Pixels saved",
      });
      if (res) {
        const next = toUi(res.values);
        setBase(next);
        setValues(next);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setValues(base);
    setErrors({});
  };

  return (
    <>
      {!canWrite && <ReadOnlyNote />}
      <Overview />
      {PIXEL_PLATFORMS.map((p, i) => (
        <PlatformCard
          key={p}
          meta={PLATFORMS[p]}
          index={i + 1}
          rows={values[p]}
          savedRows={base[p]}
          errors={errors}
          canWrite={canWrite}
          test={test}
          dirty={dirty}
          onChange={(k, field, value) => update(p, k, field, value)}
          onAdd={() => addRow(p)}
          onRemove={(k) => removeRow(p, k)}
        />
      ))}

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
              ? `New pages start with the store pixels. To update existing ones, copy the saved pixels into ${plural(pages.total, "page")} — a page keeps its own pixels for any platform that is empty here, and you can still fine-tune each page in the builder under SEO & tracking. Live pages pick the changes up when you re-publish them.`
              : "New pages start with the store pixels. Once you have pages, you can also copy the saved pixels into all of them in one click."
          }
          style={{ ["--i" as string]: PIXEL_PLATFORMS.length + 2 }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-foreground/[0.025] px-4 py-3 ring-1 ring-foreground/[0.06] ring-inset">
            <p className="text-sm text-muted-foreground">
              {dirty
                ? "Save your changes first — pages get the saved values."
                : savedPlatforms.length
                  ? `Ready: ${savedPlatforms.map((p) => PLATFORMS[p].name).join(", ")}.`
                  : "Add and save at least one pixel ID above."}
            </p>
            <Button variant="outline" className="rounded-full" disabled={!pages.total || !savedPlatforms.length || dirty || saving} onClick={() => setConfirmApply(true)}>
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
              Every draft gets the saved pixels for {savedPlatforms.map((p) => PLATFORMS[p].name).join(", ") || "your platforms"}, replacing the pixels
              those pages had for the same platforms.{" "}
              {pages.live
                ? `The ${plural(pages.live, "live page")} keep${pages.live === 1 ? "s" : ""} running unchanged until you re-publish ${pages.live === 1 ? "it" : "them"}.`
                : ""}
            </>
          }
          confirmLabel="Apply pixels"
          pendingLabel="Applying…"
          onConfirm={async () => {
            const res = await runAction(apply());
            if (!res) return false;
            const skipped = res.skipped
              ? { description: `${plural(res.skipped, "page")} changed while this ran and kept ${res.skipped === 1 ? "its" : "their"} pixels — apply again to include ${res.skipped === 1 ? "it" : "them"}.` }
              : undefined;
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

      <SaveBar dirty={dirty && canWrite} saving={saving} onSave={onSave} onDiscard={discard} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* overview                                                            */
/* ------------------------------------------------------------------ */

const HOW = [
  {
    icon: MonitorSmartphoneIcon,
    title: "Browser pixel",
    text: "Loads on your live pages and follows the shopper: view, pack choice, form, lead and the confirmed order with its real total.",
  },
  {
    icon: ServerIcon,
    title: "Server events",
    text: "With a token, every order is also sent from the server — ad blockers can't stop it, and the platform counts it once.",
  },
  {
    icon: EyeOffIcon,
    title: "Never in previews",
    text: "Pixels never load in the builder, previews or for blocked bots, so your data stays clean.",
  },
] as const;

function Overview() {
  return (
    <section className="adm-rise grid gap-3 sm:grid-cols-3" style={{ ["--i" as string]: 0 }} aria-label="How tracking works">
      {HOW.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3 rounded-2xl bg-foreground/[0.025] p-4 ring-1 ring-foreground/[0.06] ring-inset">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background text-foreground/70 shadow-[0_0_0_1px_var(--border)]">
            <Icon className="size-4" />
          </span>
          <span className="grid gap-0.5">
            <span className="text-sm font-medium">{title}</span>
            <span className="text-xs leading-relaxed text-pretty text-muted-foreground">{text}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* platform card                                                       */
/* ------------------------------------------------------------------ */

function PlatformCard({
  meta,
  index,
  rows,
  savedRows,
  errors,
  canWrite,
  test,
  dirty,
  onChange,
  onAdd,
  onRemove,
}: {
  meta: PlatformMeta;
  index: number;
  rows: UiRow[];
  savedRows: UiRow[];
  errors: PixelFormErrors;
  canWrite: boolean;
  test: ((input: TestInput) => Promise<ActionResult<TestEventResult>>) | null;
  dirty: boolean;
  onChange: (k: string, field: keyof PixelRow, value: string) => void;
  onAdd: () => void;
  onRemove: (k: string) => void;
}) {
  const p = meta.id;
  const server = isServerPlatform(p);
  // the status describes what fires NOW: the saved values
  const saved = normalizeForm({ meta: [], tiktok: [], snap: [], ga4: [], [p]: savedRows } as PixelFormValues)[p];
  const status = platformStatus(p, saved);
  const live = saved.filter((r) => r.id);
  const withToken = live.filter((r) => r.token).length;
  const testing = server && live.some((r) => r.testCode);
  const limit = PIXEL_LIMIT[p];
  const [help, setHelp] = useState(false);

  return (
    <SettingsSection
      style={{ ["--i" as string]: index }}
      description={
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="me-0.5 text-xs">{server ? (limit > 1 ? "Every pixel gets" : "Sends") : "Browser events"}</span>
          {meta.events.map((e) => (
            <span key={e} dir="ltr" className="rounded-md bg-foreground/[0.04] px-1.5 py-0.5 font-mono text-[0.68rem] leading-none text-foreground/70 ring-1 ring-foreground/[0.06] ring-inset">
              {e}
            </span>
          ))}
        </span>
      }
      title={
        <span className="flex items-center gap-2.5">
          <span aria-hidden="true" className={cn("flex size-8 items-center justify-center rounded-xl text-sm font-bold", meta.markClass)}>
            {meta.mark}
          </span>
          <span className="grid leading-tight">
            {meta.name}
            <span className="text-xs font-normal tracking-normal text-muted-foreground">{meta.tagline}</span>
          </span>
        </span>
      }
      aside={
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {testing && (
            <StatusChip tone="warn" title="A test event code is saved: server events go to Test events only">
              Test mode
            </StatusChip>
          )}
          <StatusChip tone={STATUS[status].tone} pulse={status === "server"}>
            {STATUS[status].label(withToken, live.length)}
          </StatusChip>
        </span>
      }
    >
      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          aria-expanded={help}
          className="-mx-1 flex w-fit items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className={cn("size-4 transition-transform duration-300", !help && "-rotate-90")} />
          Where to find {server ? "the ID and token" : "the ID"}
        </button>
        <AnimatePresence initial={false}>
          {help && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <ol className="grid gap-2 rounded-2xl bg-foreground/[0.025] p-4 text-sm ring-1 ring-foreground/[0.06] ring-inset">
                {[
                  { label: meta.idLabel, text: meta.steps.id },
                  ...(meta.steps.token ? [{ label: meta.tokenLabel ?? "Token", text: meta.steps.token }] : []),
                  ...(meta.steps.test ? [{ label: "Test event code", text: meta.steps.test }] : []),
                ].map((s, i) => (
                  <li key={i} className="flex gap-3 leading-relaxed text-muted-foreground">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground tabular-nums shadow-[0_0_0_1px_var(--border)]">
                      {i + 1}
                    </span>
                    <span>
                      <span className="font-medium text-foreground">{s.label}: </span>
                      {s.text}
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ul className="grid gap-3">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <motion.li
              key={r.k}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
            >
              <PixelRowCard
                platform={p}
                meta={meta}
                row={r}
                index={i}
                count={rows.length}
                errors={errors}
                canWrite={canWrite}
                test={test}
                dirty={dirty}
                onChange={(field, value) => onChange(r.k, field, value)}
                onRemove={() => onRemove(r.k)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {limit > 1 && (
        <Button type="button" variant="outline" className="w-fit rounded-full border-dashed" onClick={onAdd} disabled={!canWrite || rows.length >= limit}>
          <PlusIcon />
          {rows.length >= limit ? `Up to ${limit} pixels` : "Add a backup pixel"}
        </Button>
      )}
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ */
/* one pixel                                                           */
/* ------------------------------------------------------------------ */

function PixelRowCard({
  platform,
  meta,
  row,
  index,
  count,
  errors,
  canWrite,
  test,
  dirty,
  onChange,
  onRemove,
}: {
  platform: PixelPlatform;
  meta: PlatformMeta;
  row: UiRow;
  index: number;
  count: number;
  errors: PixelFormErrors;
  canWrite: boolean;
  test: ((input: TestInput) => Promise<ActionResult<TestEventResult>>) | null;
  dirty: boolean;
  onChange: (field: keyof PixelRow, value: string) => void;
  onRemove: () => void;
}) {
  const server = isServerPlatform(platform);
  const err = (f: keyof PixelRow) => errors[`${platform}.${index}.${f}`];
  const [testOpen, setTestOpen] = useState(!!row.testCode);
  const multi = PIXEL_LIMIT[platform] > 1;
  const removable = canWrite && (count > 1 || !!(row.id || row.token || row.testCode));

  return (
    <div className="grid gap-4 rounded-2xl bg-background/60 p-4 ring-1 ring-foreground/[0.07] ring-inset">
      {(multi || server) && (
        <div className="flex min-h-7 items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <RowDot row={row} server={server} />
            {multi ? (ROW_LABELS[index] ?? `Pixel ${index + 1}`) : "Pixel"}
          </span>
          <span className="flex items-center gap-1">
            {server && test && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-7 rounded-full px-2.5 text-xs", testOpen && "bg-foreground/[0.05]")}
                aria-expanded={testOpen}
                onClick={() => setTestOpen((o) => !o)}
              >
                <FlaskConicalIcon className="size-3.5" />
                Test
              </Button>
            )}
            {removable && (
              <Button type="button" variant="ghost" size="icon" className="size-7 rounded-full text-muted-foreground" aria-label={`Remove ${ROW_LABELS[index]?.toLowerCase() ?? "pixel"}`} onClick={onRemove}>
                <XIcon className="size-3.5" />
              </Button>
            )}
          </span>
        </div>
      )}
      <div className={cn("grid gap-4", server && "sm:grid-cols-2")}>
        <Field label={meta.idLabel} error={err("id")}>
          {(fp) => (
            <TextInput
              {...fp}
              value={row.id}
              onChange={(e) => onChange("id", e.target.value)}
              onBlur={(e) => {
                const n = normalizePixelId(platform, e.target.value);
                if (n !== e.target.value) onChange("id", n);
              }}
              placeholder={meta.placeholder}
              disabled={!canWrite}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              dir="ltr"
              inputMode={platform === "meta" ? "numeric" : undefined}
              className="font-mono text-[0.82rem]"
            />
          )}
        </Field>
        {server && (
          <Field
            label={meta.tokenLabel}
            optional
            error={err("token")}
            hint={isMask(row.token) ? "Saved and encrypted. Type over it to replace it, clear it to stop server events." : "Turns on server events for this pixel. Stored encrypted, never shown again."}
          >
            {(fp) => <SecretInput {...fp} value={row.token} onChange={(v) => onChange("token", v)} placeholder="Paste the token" disabled={!canWrite} />}
          </Field>
        )}
      </div>
      {server && (
        <AnimatePresence initial={false}>
          {(testOpen || !!err("testCode")) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="-mx-1 overflow-hidden px-1"
            >
              <TestPanel platform={platform as ServerPlatform} row={row} error={err("testCode")} canWrite={canWrite} test={test} dirty={dirty} onChange={(v) => onChange("testCode", v)} />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

function RowDot({ row, server }: { row: PixelRow; server: boolean }) {
  const on = !!row.id;
  const both = on && server && !!row.token;
  return (
    <span
      aria-hidden="true"
      title={!on ? "Not set" : both ? "Browser + server" : "Browser only"}
      className={cn("inline-flex size-2 rounded-full", !on ? "bg-foreground/20" : both ? "bg-emerald-500" : "bg-sky-500")}
    />
  );
}

/* ------------------------------------------------------------------ */
/* test events                                                         */
/* ------------------------------------------------------------------ */

function TestPanel({
  platform,
  row,
  error,
  canWrite,
  test,
  dirty,
  onChange,
}: {
  platform: ServerPlatform;
  row: PixelRow;
  error?: string;
  canWrite: boolean;
  test: ((input: TestInput) => Promise<ActionResult<TestEventResult>>) | null;
  dirty: boolean;
  onChange: (value: string) => void;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<TestEventResult | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const live = useRef(true);
  const ready = !!row.id && !!row.token && /^[A-Z0-9]{4,20}$/.test(row.testCode.trim().toUpperCase());
  const name = platform === "meta" ? "Meta" : "TikTok";

  const send = async () => {
    if (!test || !ready) return;
    setSending(true);
    setResult(null);
    setShowRaw(false);
    try {
      const res = await runAction(test({ platform, id: row.id, origin: row.origin, token: row.token, testCode: row.testCode }));
      if (res && live.current) setResult(res);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-3 rounded-xl bg-foreground/[0.025] p-3.5 ring-1 ring-foreground/[0.06] ring-inset">
      <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,15rem)_auto]">
        <Field label="Test event code" error={error}>
          {(fp) => (
            <TextInput
              {...fp}
              value={row.testCode}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              placeholder="TEST12345"
              disabled={!canWrite}
              spellCheck={false}
              autoComplete="off"
              dir="ltr"
              className="font-mono text-[0.82rem]"
            />
          )}
        </Field>
        <Button type="button" variant="outline" className="h-10 w-fit rounded-full" onClick={send} disabled={!test || !ready || sending}>
          {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          {sending ? "Sending…" : "Send test event"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-pretty text-muted-foreground">
        {ready
          ? `Sends a test Purchase (1 ${"unit"}) to ${name} with this code — it shows in Test events and never counts in your reports.`
          : `Add the pixel ID, the token and the code from ${name} → Test events to send a test Purchase.`}{" "}
        <span className="text-warn-ink">While a code is saved, this pixel&apos;s server events — real orders too — go to Test events only. Clear it when you&apos;re done.</span>
        {dirty && ready ? " The test uses what is typed here, saved or not." : ""}
      </p>
      <AnimatePresence initial={false}>
        {result && (
          <motion.div
            key={result.eventId}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={cn(
              "grid gap-2 rounded-xl p-3 text-sm ring-1 ring-inset",
              result.ok ? "bg-emerald-500/[0.07] ring-emerald-500/20" : "bg-destructive/[0.06] ring-destructive/20",
            )}
          >
            <p className={cn("flex items-start gap-2 font-medium", result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
              {result.ok ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />}
              <span className="text-pretty">{result.message}</span>
            </p>
            <div className="flex flex-wrap gap-1.5 ps-6">
              {[`${result.eventName} · id ${result.eventId}`, ...(result.status ? [`HTTP ${result.status}`] : []), ...result.facts].map((f) => (
                <span key={f} className="rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[0.72rem] text-foreground/75 ring-1 ring-foreground/[0.06] ring-inset" dir="ltr">
                  {f}
                </span>
              ))}
            </div>
            {result.ok && <p className="ps-6 text-xs text-muted-foreground">Look for it in {name} Events Manager → Test events (it can take a minute).</p>}
            {result.response && (
              <div className="ps-6">
                <button type="button" onClick={() => setShowRaw((s) => !s)} aria-expanded={showRaw} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDownIcon className={cn("size-3.5 transition-transform", !showRaw && "-rotate-90")} />
                  {name}&apos;s answer
                </button>
                {showRaw && (
                  <pre dir="ltr" className="mt-2 max-h-56 overflow-auto rounded-lg bg-background/80 p-3 font-mono text-[0.72rem] leading-relaxed text-foreground/80 ring-1 ring-foreground/[0.06] ring-inset adm-scroll">
                    {result.response}
                  </pre>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* bits                                                                */
/* ------------------------------------------------------------------ */

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground">
      {children}
    </a>
  );
}
