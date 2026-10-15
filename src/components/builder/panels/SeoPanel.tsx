"use client";
/**
 * SEO & tracking panel: page language/market, search snippet (with a live preview), social image,
 * indexing, and the page's ad pixels — up to 3 Meta / TikTok pixels (backup ad accounts), validated
 * as you type, compared with the store pixels (Settings → Pixels) with a one-click "Use store pixels",
 * and a "Server" badge on the pixels whose orders are also sent from the server.
 */
import { Check, Globe, Plus, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { storePixelSummaryAction } from "@/app/admin/(panel)/settings/pixels/actions";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { plainLabel } from "@/lib/editor/paths";
import { MARKET_SPECS, PHONE_SPECS } from "@/lib/markets/specs";
import { LOCALES, MARKETS, type Locale, type Market, type PageDoc } from "@/lib/page/schema";
import { PIXEL_ID_RE, PIXEL_LIMIT, PIXEL_PLATFORMS, normalizePixelId, type PixelPlatform } from "@/lib/pixels/ids";
import { serverEventsFor, type StorePixelSummary } from "@/lib/pixels/summary";
import { mergeStorePixels, trackingIds, withTrackingIds } from "@/lib/pixels/tracking";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi } from "../context";
import { ImageField } from "../fields/ImageField";
import { TextField } from "../fields/TextField";
import { Choice, FieldRow, Hint, PanelHeader, PanelSection } from "../ui";

const LOCALE_NAMES: Record<Locale, string> = {
  ar: "العربية — Arabic",
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  nl: "Nederlands",
  pt: "Português",
};

type Tracking = PageDoc["tracking"];

const PIXELS: Record<PixelPlatform, { label: string; short: string; example: string; kind: string }> = {
  meta: { label: "Meta (Facebook & Instagram)", short: "Meta", example: "1234567890123456", kind: "Meta pixel ID (6–20 digits)" },
  tiktok: { label: "TikTok", short: "TikTok", example: "C4ABCDEF1234567890", kind: "TikTok pixel ID (capital letters and digits)" },
  snap: { label: "Snapchat", short: "Snapchat", example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d", kind: "Snap pixel ID" },
  ga4: { label: "Google Analytics 4", short: "GA4", example: "G-AB12CD34EF", kind: "GA4 measurement ID (G-…)" },
};

export function SeoPanel() {
  const doc = useEditor((s) => s.doc);
  const api = useEditorApi();
  const set = (recipe: (d: PageDoc) => void, group?: string) => api.updateDoc((d) => recipe(d as PageDoc), group ?? null);
  const title = doc.seo.title?.trim() || doc.product.name;
  const description = doc.seo.description?.trim() || plainLabel(doc.product.tagline ?? doc.product.description ?? "", 160);
  const currencies = [...new Set([MARKET_SPECS[doc.market].currency, "MAD", "EUR", doc.currency])];

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="SEO & tracking" description="How the page appears in search and shares, and which pixels it fires." />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        <PanelSection title="Language & market" collapsible>
          <FieldRow label="Page language" hint={doc.locale === "ar" ? "Arabic pages read right-to-left." : undefined}>
            <Choice value={doc.locale} onChange={(v) => set((d) => void (d.locale = v))} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))} />
          </FieldRow>
          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label="Market">
              <Choice
                value={doc.market}
                onChange={(v: Market) =>
                  set((d) => {
                    // the currency and phone country follow the market unless they were set apart
                    const prev = MARKET_SPECS[d.market];
                    const next = MARKET_SPECS[v];
                    if (d.currency === prev.currency) d.currency = next.currency;
                    if (d.form.phoneCountry === prev.code && PHONE_SPECS[next.code]) d.form.phoneCountry = next.code;
                    d.market = v;
                  })
                }
                options={MARKETS.map((m) => ({ value: m, label: MARKET_SPECS[m].name.en }))}
              />
            </FieldRow>
            <FieldRow label="Currency">
              <Choice value={doc.currency} onChange={(v) => set((d) => void (d.currency = v))} options={currencies.map((c) => ({ value: c, label: c }))} />
            </FieldRow>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Changing the language doesn&apos;t translate your texts — use Remix → Copy for new copy. Prices are not converted when the currency changes.
          </p>
        </PanelSection>

        <PanelSection title="Search result" collapsible>
          <div className="rounded-xl bg-card p-3 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--border)_90%,transparent)]" aria-label="Search result preview">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Globe className="size-3" />
              {typeof window === "undefined" ? "" : window.location.host}
            </p>
            <p className="mt-1 line-clamp-1 text-[15px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]" dir="auto">
              {title}
            </p>
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground" dir="auto">
              {description || "Add a description to control this text."}
            </p>
          </div>
          <TextField id="seo-title" label="Title" value={doc.seo.title} max={70} emphasis={false} placeholder={doc.product.name} onChange={(v) => set((d) => void (d.seo.title = v || undefined), "seo:title")} />
          <TextField id="seo-desc" label="Description" value={doc.seo.description} max={170} emphasis={false} multiline rows={3} onChange={(v) => set((d) => void (d.seo.description = v || undefined), "seo:description")} />
          <ImageField label="Share image" value={doc.seo.ogImage} onChange={(v) => set((d) => void (d.seo.ogImage = v), "seo:og")} help="Shown when the link is shared (WhatsApp, Facebook…). The first product photo is used when empty." />
          <FieldRow label="Hide from search engines" inline hint="For test pages or ad-only pages.">
            <Switch checked={doc.seo.noindex} onCheckedChange={(v) => set((d) => void (d.seo.noindex = v))} />
          </FieldRow>
        </PanelSection>

        <PixelsSection tracking={doc.tracking} onChange={(recipe, group) => set((d) => void (d.tracking = recipe(d.tracking)), group)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* pixels                                                              */
/* ------------------------------------------------------------------ */

function PixelsSection({ tracking, onChange }: { tracking: Tracking; onChange: (recipe: (t: Tracking) => Tracking, group?: string) => void }) {
  const store = useStorePixels();
  // the page differs from the store where the store has pixels (other platforms are the page's own)
  const differs = store
    ? PIXEL_PLATFORMS.filter((p) => store.platforms[p].length > 0 && trackingIds(tracking, p).join(",") !== store.platforms[p].map((x) => x.id).join(","))
    : [];

  return (
    <PanelSection title="Pixels" collapsible hint="They fire on the live page only — never in the builder or previews.">
      {store?.configured ? (
        differs.length ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-soft px-3 py-2.5 text-[12px] leading-relaxed text-foreground/80">
            <span className="flex min-w-0 items-start gap-2">
              <RefreshCw className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {differs.map((p) => PIXELS[p].short).join(", ")} {differs.length === 1 ? "differs" : "differ"} from your store pixels.
              </span>
            </span>
            <button
              type="button"
              onClick={() => onChange((t) => mergeStorePixels(t, store.tracking, "replace"))}
              className="shrink-0 rounded-full bg-background px-2.5 py-1 text-[11.5px] font-medium text-foreground shadow-[0_0_0_1px_var(--border)] outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Use store pixels
            </button>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Uses your store pixels.
          </p>
        )
      ) : null}
      <div className="grid gap-3.5">
        {PIXEL_PLATFORMS.map((p) => (
          <PlatformPixels key={p} platform={p} ids={trackingIds(tracking, p)} store={store} onCommit={(ids) => onChange((t) => withTrackingIds(t, p, ids), `pixel:${p}`)} />
        ))}
      </div>
      <Hint>
        Pixels marked <span className="font-medium text-foreground">Server</span> also get every order from the server (Meta Conversions API, TikTok Events
        API), counted once with the browser. Tokens and test codes live in{" "}
        <Link
          href="/admin/settings/pixels"
          target="_blank"
          rel="noopener"
          className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground"
        >
          Settings → Pixels
        </Link>
        .
      </Hint>
    </PanelSection>
  );
}

/** The store pixels (ids + server flags, never a token); null while loading or without access. */
function useStorePixels(): StorePixelSummary | null {
  const [summary, setSummary] = useState<StorePixelSummary | null>(null);
  useEffect(() => {
    let alive = true;
    storePixelSummaryAction()
      .then((res) => {
        if (alive && res.ok) setSummary(res.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return summary;
}

function PlatformPixels({
  platform,
  ids,
  store,
  onCommit,
}: {
  platform: PixelPlatform;
  ids: string[];
  store: StorePixelSummary | null;
  onCommit: (ids: string[]) => void;
}) {
  const spec = PIXELS[platform];
  const limit = PIXEL_LIMIT[platform];
  const [adding, setAdding] = useState(false);
  // always one field to type in; an extra blank field only while adding a backup pixel
  const rows = ids.length ? ids : [""];
  const replace = (i: number, v: string | undefined) => {
    const next = [...ids];
    if (v === undefined) next.splice(i, 1);
    else if (i < next.length) next[i] = v;
    else next.push(v);
    onCommit(next);
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <span className="text-[12.5px] leading-tight font-medium text-foreground/85">{spec.label}</span>
        {limit > 1 && ids.length > 0 && !adding && ids.length < limit ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="-me-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11.5px] font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Plus className="size-3" />
            Backup pixel
          </button>
        ) : null}
      </div>
      {rows.map((id, i) => (
        <PixelField
          key={i}
          platform={platform}
          index={i}
          value={id || undefined}
          server={!!id && !!store && serverEventsFor(store, platform, id)}
          onCommit={(v) => replace(i, v)}
        />
      ))}
      {adding ? (
        <PixelField
          platform={platform}
          index={ids.length}
          value={undefined}
          server={false}
          autoFocus
          onCommit={(v) => {
            if (v) replace(ids.length, v);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : null}
    </div>
  );
}

/**
 * One pixel id. Validated as you type, committed when the field is left (or Enter): ids don't change
 * the preview, and a half-typed id never replaces a working one. Emptying the field removes the pixel.
 */
function PixelField({
  platform,
  index,
  value,
  server,
  autoFocus,
  onCommit,
  onCancel,
}: {
  platform: PixelPlatform;
  index: number;
  value: string | undefined;
  server: boolean;
  autoFocus?: boolean;
  onCommit: (v: string | undefined) => void;
  onCancel?: () => void;
}) {
  const spec = PIXELS[platform];
  const [draft, setDraft] = useState<string | null>(null);
  const raw = draft ?? value ?? "";
  const normalized = normalizePixelId(platform, raw);
  const error = draft !== null && normalized && !PIXEL_ID_RE[platform].test(normalized) ? `This doesn't look like a ${spec.kind}, e.g. ${spec.example}.` : null;
  const id = `px-${platform}-${index}`;
  const label = `${spec.label} pixel ${index + 1}`;
  const removable = value !== undefined || !!onCancel;

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (!normalized) {
      if (value !== undefined) onCommit(undefined);
      else onCancel?.();
      return;
    }
    if (error) {
      // a new field with an invalid id is dropped; an existing one keeps its saved id
      if (value === undefined) onCancel?.();
      return;
    }
    if (normalized !== value) onCommit(normalized);
    else if (value === undefined) onCancel?.();
  };

  return (
    <div className="grid gap-1">
      <div className="relative flex items-center gap-1">
        <Input
          id={id}
          aria-label={label}
          value={raw}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          autoFocus={autoFocus}
          dir="ltr"
          placeholder={platform === "ga4" ? "Paste the measurement ID" : "Paste the pixel ID"}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(null);
              if (value === undefined) onCancel?.();
            }
          }}
          className={cn("h-8 min-w-0 flex-1 font-mono text-xs", server && "pe-[3.75rem]")}
        />
        {server ? (
          <span
            title="Orders are also sent from the server for this pixel"
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-emerald-700 ring-1 ring-emerald-500/20 ring-inset dark:text-emerald-300",
              removable ? "end-10" : "end-2",
            )}
          >
            Server
          </span>
        ) : null}
        {removable ? (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            // keeps the input's blur from committing first
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setDraft(null);
              if (value !== undefined) onCommit(undefined);
              else onCancel?.();
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[11.5px] leading-snug text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
