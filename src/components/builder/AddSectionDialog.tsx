"use client";
/**
 * Section library: categories on the side, every section with its styles as live mini-renders in
 * the page's current theme. Picking a style inserts the section after the selected one (or where
 * its zone belongs) and selects it.
 *
 * Each mini-render is an iframe, so only the entries near the visible part of the list keep theirs
 * (about a hundred styles would otherwise stay mounted after one scroll through "All sections").
 */
import { motion } from "motion/react";
import { Check, Lock, Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LandingThumbnail } from "@/components/preview";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AnySectionDefinition, SectionCategory } from "@/landing/types";
import { addBlocker, allowedBgs, defaultData, libraryByCategory } from "@/lib/editor/sections";
import type { PageDoc, SectionInstance } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi } from "./context";
import { useEnv } from "./env";
import { SectionIcon } from "./section-meta";
import { EASE } from "./ui";

type Filter = SectionCategory | "all";

export function AddSectionDialog() {
  const api = useEditorApi();
  const open = useEditor((s) => s.libraryOpen);
  return (
    <Dialog open={open} onOpenChange={api.setLibraryOpen}>
      <DialogContent className="flex h-[min(86vh,52rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {open ? <Library /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Library() {
  const api = useEditorApi();
  const liveDoc = useEditor((s) => s.doc);
  const selectedId = useEditor((s) => s.selectedId);
  const assets = useEditor((s) => s.assets);
  const { store } = useEnv();
  const doc = useDeferredValue(liveDoc);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const groups = useMemo(() => libraryByCategory(), []);

  const needle = q.trim().toLowerCase();
  const visible = groups
    .filter((g) => filter === "all" || g.category === filter)
    .map((g) => ({
      ...g,
      sections: needle ? g.sections.filter((s) => `${s.label} ${s.labelFr} ${s.description} ${s.variants.map((v) => v.label).join(" ")}`.toLowerCase().includes(needle)) : g.sections,
    }))
    .filter((g) => g.sections.length);

  const add = (def: AnySectionDefinition, variant: string) => {
    // a section that can appear only once and is already there: switch its style instead
    const existing = def.singleton ? liveDoc.sections.find((s) => s.type === def.type) : undefined;
    if (existing) {
      const bgs = allowedBgs(def, variant);
      if (existing.variant !== variant || existing.hidden) {
        api.patchSection(existing.id, { variant, hidden: false, ...(bgs.includes(existing.bg) ? {} : { bg: bgs[0] }) });
      }
      api.setLibraryOpen(false);
      api.setInteractive(false);
      api.select(existing.id);
      toast.success(`${def.label} style changed`, { action: { label: "Undo", onClick: () => api.undo() } });
      return;
    }
    const id = api.addSection(def.type, { variant, afterId: selectedId });
    if (!id) {
      toast.error(addBlocker(liveDoc, def.type) ?? "This section can't be added.");
      return;
    }
    api.setLibraryOpen(false);
    api.setInteractive(false);
    toast.success(`${def.label} added`, { description: "Edit it on the right — or double-click its text in the preview." });
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="bld-panel flex w-56 shrink-0 flex-col border-e border-[var(--bld-hairline)] p-3">
        <DialogTitle className="px-2 pt-1 font-display text-[22px] font-semibold leading-none tracking-[-0.03em]">Add a section</DialogTitle>
        <DialogDescription className="mt-1.5 px-2 text-[11.5px]">Previews use your current theme and product.</DialogDescription>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            aria-label="Search sections"
            className="h-8 w-full rounded-lg bg-foreground/[0.045] pe-2 ps-8 text-[13px] outline-none ring-1 ring-inset ring-foreground/[0.06] focus:ring-ring/60"
          />
        </div>
        <nav className="bld-scroll mt-3 flex-1 space-y-0.5 overflow-y-auto" aria-label="Categories">
          {([{ category: "all", label: "All sections" }, ...groups] as { category: Filter; label: string }[]).map((g) => (
            <button
              key={g.category}
              type="button"
              onClick={() => setFilter(g.category)}
              aria-current={filter === g.category || undefined}
              className={cn(
                "relative flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                filter === g.category ? "font-semibold text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
              )}
            >
              {filter === g.category ? <motion.span layoutId="bld-lib-cat" className="absolute inset-0 rounded-lg bg-foreground/[0.06]" transition={{ type: "spring", stiffness: 500, damping: 40 }} /> : null}
              <span className="relative">{g.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div ref={setScroller} className="bld-scroll min-w-0 flex-1 overflow-y-auto px-7 pb-10 pt-6">
        {visible.length === 0 ? <p className="py-24 text-center text-sm text-muted-foreground">No section matches “{q}”.</p> : null}
        {visible.map((g) => (
          <section key={g.category} className="mb-9">
            {filter === "all" ? <h3 className="mb-3 text-[11.5px] font-semibold text-muted-foreground">{g.label}</h3> : null}
            <div className="space-y-6">
              {g.sections.map((def) => (
                <SectionEntry key={def.type} def={def} doc={doc} assets={assets} store={store} onAdd={add} scroller={scroller} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/** True while `el` is within `margin` of the scroll container's viewport. */
function useNear(el: Element | null, root: Element | null, margin = "900px 0px"): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!el || !root) return;
    const io = new IntersectionObserver((entries) => setNear(entries.some((e) => e.isIntersecting)), { root, rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [el, root, margin]);
  return near;
}

function SectionEntry({
  def,
  doc,
  assets,
  store,
  onAdd,
  scroller,
}: {
  def: AnySectionDefinition;
  doc: PageDoc;
  assets: Parameters<typeof LandingThumbnail>[0]["assets"];
  store: Parameters<typeof LandingThumbnail>[0]["store"];
  onAdd: (def: AnySectionDefinition, variant: string) => void;
  scroller: HTMLDivElement | null;
}) {
  const [self, setSelf] = useState<HTMLElement | null>(null);
  const near = useNear(self, scroller);
  const present = doc.sections.some((s) => s.type === def.type);
  /** the page's own instance of a once-per-page section: its tiles switch style and preview its content */
  const current = def.singleton ? doc.sections.find((s) => s.type === def.type) : undefined;
  const blocker = current ? null : addBlocker(doc, def.type);
  const floating = def.category === "floating";
  const data = useMemo(() => current?.data ?? defaultData(def, doc, `lib-${def.type}`), [def, doc, current]);
  const thumbs = useMemo(() => {
    const out: Record<string, PageDoc> = {};
    for (const v of def.variants) {
      const bgs = allowedBgs(def, v.id);
      const bg = current && bgs.includes(current.bg) ? current.bg : bgs[0]!;
      const inst: SectionInstance = { id: current?.id ?? `lib-${def.type}`, type: def.type, variant: v.id, bg, divider: "none", spacing: "normal", hidden: false, data };
      out[v.id] = { ...doc, sections: [inst] };
    }
    return out;
  }, [def, doc, data, current]);
  const ratio = def.category === "top" ? "1280 / 150" : def.category === "bottom" ? "16 / 7" : "16 / 10";

  return (
    <motion.article ref={setSelf} data-section-type={def.type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-foreground/[0.06] text-foreground/80">
          <SectionIcon type={def.type} className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-semibold tracking-[-0.01em]">
            {def.label}
            {def.required ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-px text-[10.5px] font-medium text-muted-foreground">
                <Lock className="size-2.5" /> Required
              </span>
            ) : null}
            {present && def.singleton ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-px text-[10.5px] font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-2.5" /> On the page
              </span>
            ) : null}
          </p>
          <p className="truncate text-[12px] text-muted-foreground">{def.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-3">
        {def.variants.map((v) => {
          const active = current?.variant === v.id;
          return (
            <button
              key={v.id}
              type="button"
              disabled={!!blocker}
              onClick={() => onAdd(def, v.id)}
              title={blocker ?? v.description}
              data-selected={active}
              className="bld-tile group flex flex-col overflow-hidden text-left outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {floating ? (
                <div className="grid place-items-center bg-muted/50 text-muted-foreground" style={{ aspectRatio: ratio }}>
                  <SectionIcon type={def.type} className="size-7" />
                </div>
              ) : near ? (
                <LandingThumbnail doc={thumbs[v.id]!} assets={assets} store={store} device="desktop" sections={1} aspectRatio={ratio} className="w-full rounded-t-[12px]" />
              ) : (
                <div className="w-full rounded-t-[12px] bg-muted/50" style={{ aspectRatio: ratio }} aria-hidden="true" />
              )}
              <span className="block px-3 pb-2.5 pt-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] font-semibold">{v.label}</span>
                  {current ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium transition-opacity",
                        active ? "bg-brand-soft text-foreground" : "bg-foreground/[0.06] text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                      )}
                    >
                      {active ? "Current style" : "Switch to this"}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{v.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </motion.article>
  );
}
