"use client";
/**
 * Product panel: identity (name, tagline, description, category, SKU), price, photos (sortable,
 * alt text), transparent cutout (pick one, or generate it in the browser with the local AI when
 * available), options (colors, sizes… — the editor shared with the generate wizard) and the real
 * rating (never invented).
 */
import { CircleAlert, LoaderCircle, Scissors, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { VariantsEditor, type VariantPhoto } from "@/components/admin/variants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AiError, useAi } from "@/lib/ai/client";
import { PRODUCT_CATEGORIES, type AssetRef, type Product } from "@/lib/page/schema";
import { parseExtractedPalette } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi, useEditorStore } from "../context";
import { assetUrl, useEnv } from "../env";
import { ImageField, ImagesField } from "../fields/ImageField";
import { TextField } from "../fields/TextField";
import { useMedia } from "../media";
import { Choice, FieldRow, Hint, NumberInput, PanelHeader, PanelSection, useCommitted } from "../ui";

const CATEGORY_LABELS: Partial<Record<(typeof PRODUCT_CATEGORIES)[number], string>> = {
  "organic-food": "Organic food",
};
const categoryLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c.charAt(0).toUpperCase() + c.slice(1);

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

        <PanelSection title="Options" collapsible defaultOpen={product.variants.length > 0} hint="Colors, sizes or any choice the customer makes on the order form.">
          <VariantsSection />
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
/* variants (options)                                                  */
/* ------------------------------------------------------------------ */

/**
 * The shared options editor (src/components/admin/variants) on the page document: photos are the
 * product's photos (their palettes feed the color suggestions), the library picker links any other
 * photo, and typing bursts are coalesced into one undo step each.
 */
function VariantsSection() {
  const groups = useEditor((s) => s.doc.product.variants);
  const locale = useEditor((s) => s.doc.locale);
  const images = useEditor((s) => s.doc.product.images);
  const assets = useEditor((s) => s.assets);
  const api = useEditorApi();
  const media = useMedia();
  const photos = useMemo<VariantPhoto[]>(
    () =>
      images.flatMap((ref) => {
        const row = assets[ref.id];
        if (row?.kind === "video") return [];
        return [{ ref, url: assetUrl(row, 160), palette: parseExtractedPalette(row?.palette) }];
      }),
    [images, assets],
  );
  return (
    <VariantsEditor
      value={groups}
      locale={locale}
      density="compact"
      photos={photos}
      photoUrl={(id) => assetUrl(assets[id], 160)}
      onPickPhoto={async (title) => {
        const a = await media.pick({ title });
        return a ? { id: a.id, alt: a.alt, ...(a.focal ? { fx: a.focal.x, fy: a.focal.y } : {}) } : null;
      }}
      onChange={(next, coalesce) =>
        api.updateDoc((d) => {
          d.product.variants = next;
        }, coalesce ?? null)
      }
    />
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
