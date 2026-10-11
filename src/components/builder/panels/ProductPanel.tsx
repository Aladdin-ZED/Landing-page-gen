"use client";
/**
 * Product panel: identity (name, tagline, description, category, SKU), price, photos (sortable,
 * alt text), transparent cutout (pick one, or generate it in the browser with the local AI when
 * available), variant groups with swatches, and the real rating (never invented).
 */
import { CircleAlert, LoaderCircle, Plus, Scissors, Star, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AiError, useAi } from "@/lib/ai/client";
import { PRODUCT_CATEGORIES, type AssetRef, type Product } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi, useEditorStore } from "../context";
import { assetUrl, useEnv } from "../env";
import { ImageField, ImagesField } from "../fields/ImageField";
import { TextField } from "../fields/TextField";
import { useMedia } from "../media";
import { Choice, ColorInput, FieldRow, Hint, NumberInput, PanelHeader, PanelSection, Segmented, useCommitted } from "../ui";

const CATEGORY_LABELS: Partial<Record<(typeof PRODUCT_CATEGORIES)[number], string>> = {
  "organic-food": "Organic food",
};
const categoryLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c.charAt(0).toUpperCase() + c.slice(1);

const ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function shortId(prefix: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  for (;;) {
    const b = new Uint8Array(5);
    crypto.getRandomValues(b);
    const id = `${prefix}-${[...b].map((x) => ID_ALPHABET[x % ID_ALPHABET.length]).join("")}`;
    if (!used.has(id)) return id;
  }
}

export function ProductPanel() {
  const product = useEditor((s) => s.doc.product);
  const currency = useEditor((s) => s.doc.currency);
  const api = useEditorApi();
  const set = (recipe: (p: Product) => void, group?: string) => api.updateDoc((d) => recipe(d.product as Product), group ?? null);

  const name = useCommitted(
    product.name,
    (v) => v,
    (raw) => (raw.trim() ? { value: raw.slice(0, 120) } : { error: "The product needs a name" }),
    (v) => set((p) => void (p.name = v), "product:name"),
  );

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Product" description="Used by every section, the order form and search results." />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        <PanelSection title="Basics" collapsible>
          <FieldRow label="Name" htmlFor="p-name" error={name.error} count={name.raw.length} max={120}>
            <Input id="p-name" dir="auto" value={name.raw} maxLength={120} aria-invalid={!!name.error || undefined} onChange={(e) => name.onChange(e.target.value)} onFocus={name.onFocus} onBlur={name.onBlur} className="h-8 text-[13px]" />
          </FieldRow>
          <TextField id="p-tagline" label="Tagline" value={product.tagline} max={400} onChange={(v) => set((p) => void (p.tagline = v || undefined), "product:tagline")} help="One line under the name. *Emphasis* works." />
          <TextField id="p-desc" label="Description" value={product.description} max={4000} multiline rows={4} onChange={(v) => set((p) => void (p.description = v || undefined), "product:description")} help="Short paragraphs; start a line with “- ” for a bullet." />
          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label="Category">
              <Choice value={product.category} onChange={(v) => set((p) => void (p.category = v))} options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))} />
            </FieldRow>
            <SkuField value={product.sku} onCommit={(v) => set((p) => void (p.sku = v), "product:sku")} />
          </div>
        </PanelSection>

        <PanelSection title="Price" collapsible>
          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label="Price" htmlFor="p-price">
              <NumberInput id="p-price" value={product.price} min={0} max={10_000_000} suffix={currency} onCommit={(v) => set((p) => void (p.price = v ?? 0), "product:price")} />
            </FieldRow>
            <FieldRow label="Compare at" htmlFor="p-compare">
              <NumberInput id="p-compare" value={product.compareAt} min={0} max={10_000_000} suffix={currency} optional placeholder="—" onCommit={(v) => set((p) => void (p.compareAt = v), "product:compare")} />
            </FieldRow>
          </div>
          {product.compareAt !== undefined && product.compareAt <= product.price ? (
            <Hint tone="warn" icon={<CircleAlert />}>
              “Compare at” must be a real, higher previous price — otherwise no saving is shown.
            </Hint>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">Only enter a previous price you really sold at. Pack prices are set in Offers.</p>
          )}
        </PanelSection>

        <PanelSection title="Photos" collapsible>
          <ImagesField label="Product photos" value={product.images} max={30} onChange={(v) => set((p) => void (p.images = v), "product:images")} help="Drag to reorder. The first photo leads; add alt text to each." />
          <CutoutBlock />
        </PanelSection>

        <PanelSection title="Variants" collapsible defaultOpen={product.variants.length > 0} hint="Colors, sizes… Customers pick per unit in multi-packs.">
          <VariantsEditor />
        </PanelSection>

        <PanelSection title="Rating" collapsible defaultOpen={!!product.rating}>
          <RatingEditor />
        </PanelSection>
      </div>
    </div>
  );
}

function SkuField({ value, onCommit }: { value: string | undefined; onCommit: (v: string | undefined) => void }) {
  const f = useCommitted<string | undefined>(
    value,
    (v) => v ?? "",
    (raw) => (raw.length <= 60 ? { value: raw.trim() ? raw.trim() : undefined } : { error: "At most 60 characters" }),
    onCommit,
  );
  return (
    <FieldRow label="SKU" htmlFor="p-sku" error={f.error}>
      <Input id="p-sku" value={f.raw} maxLength={60} placeholder="Optional" onChange={(e) => f.onChange(e.target.value)} onFocus={f.onFocus} onBlur={f.onBlur} className="h-8 font-mono text-xs" />
    </FieldRow>
  );
}

/* ------------------------------------------------------------------ */
/* cutout                                                              */
/* ------------------------------------------------------------------ */

const STAGE_TEXT: Partial<Record<string, string>> = {
  "load-matting": "Loading the cutout model…",
  matting: "Removing the background…",
};

function CutoutBlock() {
  const store = useEditorStore();
  const api = useEditorApi();
  const cutout = useEditor((s) => s.doc.product.cutout);
  const images = useEditor((s) => s.doc.product.images);
  const assets = useEditor((s) => s.assets);
  const env = useEnv();
  const ai = useAi({ enabled: env.ai.enabled, maxTier: env.ai.tier });
  const media = useMedia();
  const [busy, setBusy] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  // background removal also runs without WebGPU (WASM), so the device tier doesn't matter here
  const aiReady = env.ai.enabled && env.ai.bgRemoval && ai.enabled && ai.status !== "off";
  const photos = images.filter((r) => assets[r.id] && assets[r.id]!.kind !== "video" && !assets[r.id]!.alpha);
  const source = photos.find((r) => r.id === sourceId) ?? photos[0];

  const generate = async () => {
    const row = source ? store.getState().assets[source.id] : undefined;
    const src = assetUrl(row, 1440);
    if (!source || !src) return;
    setBusy(true);
    try {
      const res = await fetch(src, { credentials: "same-origin" });
      if (!res.ok) throw new Error("photo");
      const blob = await ai.removeBackground(await res.blob());
      const ext = blob.type === "image/png" ? "png" : "webp";
      const uploaded = await media.upload(blob, { name: `cutout.${ext}`, cutout: true, sourceAssetId: source.id });
      const name = store.getState().doc.product.name;
      api.updateDoc((d) => {
        d.product.cutout = { id: uploaded.id, alt: name.slice(0, 200) };
      });
      toast.success("Cutout ready", { description: "Hero stages and showcases use it automatically." });
    } catch (err) {
      if (err instanceof AiError && err.code === "CANCELLED") return;
      toast.error("The cutout could not be made", { description: err instanceof Error && err.message !== "photo" ? err.message : "Try another photo or upload a transparent PNG." });
    } finally {
      setBusy(false);
    }
  };

  const stage = ai.progress ? (STAGE_TEXT[ai.progress.stage] ?? "Working…") : "Removing the background…";
  const pct = ai.progress?.total ? Math.round(((ai.progress.loaded ?? 0) / ai.progress.total) * 100) : null;

  return (
    <div className="space-y-2">
      <ImageField
        label="Cutout (transparent background)"
        value={cutout}
        allowCutout={false}
        onChange={(v) => api.updateDoc((d) => void (d.product.cutout = v as AssetRef | undefined), "product:cutout")}
        help="Used on hero stages and showcases. A PNG/WebP with transparency."
      />
      {!cutout && source && aiReady ? (
        <div className="space-y-2 rounded-xl bg-foreground/[0.025] p-2.5 ring-1 ring-inset ring-foreground/[0.04]">
          {photos.length > 1 ? (
            <div role="radiogroup" aria-label="Photo to cut out" className="-m-1 flex gap-1.5 overflow-x-auto p-1">
              {photos.slice(0, 8).map((r) => {
                const on = r.id === source.id;
                const url = assetUrl(assets[r.id], 160);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={r.alt || "Product photo"}
                    disabled={busy}
                    onClick={() => setSourceId(r.id)}
                    className={cn(
                      "size-10 shrink-0 overflow-hidden rounded-lg outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-ring/60",
                      on ? "ring-2 ring-brand" : "opacity-70 ring-1 ring-foreground/10 hover:opacity-100",
                    )}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin preview of a /media rendition
                      <img src={url} alt="" className="size-full object-cover" draggable={false} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <Button variant="outline" className="min-w-0 flex-1" onClick={() => void generate()} disabled={busy || ai.status === "busy"}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Scissors />}
              <span className="truncate">{busy ? `${stage}${pct !== null ? ` ${pct}%` : ""}` : photos.length > 1 ? "Cut out this photo with AI" : "Cut out the photo with AI"}</span>
            </Button>
            {busy ? (
              <Button variant="ghost" onClick={() => ai.cancel()}>
                Cancel
              </Button>
            ) : null}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Runs privately in this browser{ai.capabilities && !ai.capabilities.webgpu ? " on the processor — it can take up to a minute" : ""}. The first run downloads the model.
          </p>
        </div>
      ) : null}
      {!cutout && images.length > 0 && !aiReady ? <p className="text-[11px] text-muted-foreground">Tip: upload a photo with a transparent background for the most striking hero.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* variants                                                            */
/* ------------------------------------------------------------------ */

function VariantsEditor() {
  const groups = useEditor((s) => s.doc.product.variants);
  const api = useEditorApi();
  const media = useMedia();
  const allIds = () => groups.flatMap((g) => [g.id, ...g.options.map((o) => o.id)]);

  const addGroup = () =>
    api.updateDoc((d) => {
      if (d.product.variants.length >= 3) return;
      d.product.variants.push({
        id: shortId("g", allIds()),
        name: d.locale === "ar" ? "اللون" : d.locale === "fr" ? "Couleur" : "Color",
        kind: "text",
        perUnit: true,
        options: [{ id: shortId("o", allIds()), label: "1", soldOut: false }],
      });
    });

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={g.id} className="bld-card space-y-3 p-3">
          <div className="flex items-end gap-2">
            <GroupName value={g.name} onCommit={(v) => api.updateDoc((d) => void (d.product.variants[gi]!.name = v), `variant:${g.id}:name`)} />
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${g.name}`} onClick={() => api.updateDoc((d) => void d.product.variants.splice(gi, 1))} className="mb-px text-muted-foreground hover:text-destructive">
              <Trash2 />
            </Button>
          </div>
          <Segmented
            value={g.kind}
            onChange={(kind) => api.updateDoc((d) => void (d.product.variants[gi]!.kind = kind))}
            label="Display"
            size="sm"
            options={[
              { value: "text", label: "Text" },
              { value: "swatch", label: "Swatches" },
              { value: "image", label: "Photos" },
            ]}
          />
          <ul className="space-y-1.5">
            {g.options.map((o, oi) => (
              <li key={o.id} className="flex items-center gap-1.5">
                {g.kind === "swatch" ? (
                  <div className="w-[5.5rem] shrink-0">
                    <ColorInput label={`${o.label} swatch`} value={o.swatch ?? "#cccccc"} onCommit={(hex) => api.updateDoc((d) => void (d.product.variants[gi]!.options[oi]!.swatch = hex), `opt:${o.id}:swatch`)} />
                  </div>
                ) : null}
                {g.kind === "image" ? (
                  <OptionImage
                    value={o.image}
                    onPick={async () => {
                      const a = await media.pick({ title: `Photo for ${o.label}` });
                      if (a) api.updateDoc((d) => void (d.product.variants[gi]!.options[oi]!.image = { id: a.id, alt: o.label }));
                    }}
                  />
                ) : null}
                <OptionLabel value={o.label} onCommit={(v) => api.updateDoc((d) => void (d.product.variants[gi]!.options[oi]!.label = v), `opt:${o.id}:label`)} />
                <button
                  type="button"
                  onClick={() => api.updateDoc((d) => void (d.product.variants[gi]!.options[oi]!.soldOut = !o.soldOut))}
                  aria-pressed={o.soldOut}
                  title={o.soldOut ? "Sold out — click to make available" : "Mark as sold out"}
                  className={cn("h-7 shrink-0 rounded-md px-1.5 text-[10.5px] font-semibold transition-colors", o.soldOut ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted")}
                >
                  {o.soldOut ? "Sold out" : "In stock"}
                </button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove ${o.label}`}
                  disabled={g.options.length <= 1}
                  onClick={() => api.updateDoc((d) => void d.product.variants[gi]!.options.splice(oi, 1))}
                  className="text-muted-foreground"
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="xs"
              disabled={g.options.length >= 24}
              onClick={() =>
                api.updateDoc((d) => {
                  const grp = d.product.variants[gi]!;
                  grp.options.push({ id: shortId("o", allIds()), label: String(grp.options.length + 1), soldOut: false });
                })
              }
            >
              <Plus />
              Option
            </Button>
            <label className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
              Pick per unit
              <Switch size="sm" checked={g.perUnit} onCheckedChange={(v) => api.updateDoc((d) => void (d.product.variants[gi]!.perUnit = v))} />
            </label>
          </div>
        </div>
      ))}
      {groups.length < 3 ? (
        <Button variant="secondary" className="w-full" onClick={addGroup}>
          <Plus />
          Add a variant group
        </Button>
      ) : null}
    </div>
  );
}

function GroupName({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const f = useCommitted(value, (v) => v, (raw) => (raw.trim() ? { value: raw.slice(0, 40) } : { error: "Name the group" }), onCommit);
  return (
    <FieldRow label="Group" error={f.error} className="flex-1">
      <Input dir="auto" value={f.raw} maxLength={40} onChange={(e) => f.onChange(e.target.value)} onFocus={f.onFocus} onBlur={f.onBlur} className="h-8 text-[13px]" aria-label="Variant group name" />
    </FieldRow>
  );
}

function OptionLabel({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const f = useCommitted(value, (v) => v, (raw) => (raw.trim() ? { value: raw.slice(0, 40) } : { error: "Required" }), onCommit);
  return <Input dir="auto" value={f.raw} maxLength={40} aria-invalid={!!f.error || undefined} onChange={(e) => f.onChange(e.target.value)} onFocus={f.onFocus} onBlur={f.onBlur} className="h-7 min-w-0 flex-1 text-[12.5px]" aria-label="Option" />;
}

function OptionImage({ value, onPick }: { value: AssetRef | undefined; onPick: () => void }) {
  const row = useEditor((s) => (value ? s.assets[value.id] : undefined));
  const url = assetUrl(row, 360);
  return (
    <button type="button" onClick={onPick} aria-label="Choose option photo" className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-inset ring-foreground/10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of a /media rendition
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <Plus className="size-3.5" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* rating                                                              */
/* ------------------------------------------------------------------ */

function RatingEditor() {
  const rating = useEditor((s) => s.doc.product.rating);
  const api = useEditorApi();
  const [wanted, setWanted] = useState(false);
  /** half-entered rating (both numbers are needed before it is stored) */
  const [draft, setDraft] = useState<{ value?: number; count?: number }>({});
  const enabled = !!rating || wanted;
  const value = rating?.value ?? draft.value;
  const count = rating?.count ?? draft.count;

  const commit = (v: number | undefined, c: number | undefined) => {
    if (v !== undefined && c !== undefined) {
      api.updateDoc((d) => void (d.product.rating = { value: v, count: c }), "product:rating");
      setDraft({});
    } else {
      if (rating) api.updateDoc((d) => void delete d.product.rating);
      setWanted(true);
      setDraft({ value: v, count: c });
    }
  };

  return (
    <div className="space-y-3">
      <FieldRow label="Show the real average rating" inline>
        <Switch
          checked={enabled}
          onCheckedChange={(on) => {
            setWanted(on);
            setDraft({});
            if (!on && rating) api.updateDoc((d) => void delete d.product.rating);
          }}
        />
      </FieldRow>
      {enabled ? (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label="Average (1–5)">
              <div className="relative">
                <NumberInput value={value} min={1} max={5} step={0.1} optional onCommit={(v) => commit(v, count)} />
                <Star className="pointer-events-none absolute end-2.5 top-2 size-4 fill-warn text-warn-ink" />
              </div>
            </FieldRow>
            <FieldRow label="Number of ratings">
              <NumberInput value={count} min={1} max={1_000_000} integer optional onCommit={(c) => commit(value, c)} />
            </FieldRow>
          </div>
          <Hint tone="warn" icon={<CircleAlert />}>
            Only your real numbers (e.g. from your store or marketplace). Shoppers and ad platforms penalize invented ratings.
          </Hint>
        </>
      ) : null}
    </div>
  );
}
