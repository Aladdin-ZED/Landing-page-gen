"use client";
/**
 * Right inspector for the selected section: style (live variant tiles), background (theme swatches
 * with their own text color), divider above, spacing, then the section's own fields generated from
 * its FieldSpecs, validated live against the section schema.
 */
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Copy, Eye, EyeOff, Lock, Trash2, X } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import { toast } from "sonner";
import { LandingThumbnail } from "@/components/preview";
import { getSection } from "@/landing/registry";
import type { AnySectionDefinition, FieldSpec } from "@/landing/types";
import { issuesByPath, sectionIssues } from "@/lib/editor/fields";
import { allowedBgs, isRequired, isSingleton, zoneOf } from "@/lib/editor/sections";
import { selectSelected } from "@/lib/editor/store";
import { DIVIDERS, SECTION_BGS, type PageDoc, type SectionInstance } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi, useEditorStore } from "./context";
import { useBuiltTheme, useEnv } from "./env";
import { Fields, type FieldScope } from "./fields/Fields";
import { BG_LABELS, DIVIDER_LABELS, DividerGlyph, SectionIcon } from "./section-meta";
import { EASE, Hint, MOD, PanelSection, Segmented, TipButton } from "./ui";

export const INSPECTOR_WIDTH = 344;

export function Inspector({ overlay }: { overlay: boolean }) {
  const section = useEditor(selectSelected);
  const interactive = useEditor((s) => s.interactive);
  const show = !!section && !interactive;
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.aside
          key="inspector"
          aria-label="Section settings"
          initial={overlay ? { opacity: 0, x: 16 } : { width: 0, opacity: 0 }}
          animate={overlay ? { opacity: 1, x: 0 } : { width: INSPECTOR_WIDTH, opacity: 1 }}
          exit={overlay ? { opacity: 0, x: 16 } : { width: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className={cn(
            "bld-panel z-20 shrink-0 overflow-hidden border-s border-[var(--bld-hairline)]",
            overlay ? "absolute inset-y-0 end-0 w-[344px] shadow-[-12px_0_40px_-20px_rgb(0_0_0/0.35)]" : "relative h-full",
          )}
        >
          <div className="h-full" style={{ width: INSPECTOR_WIDTH }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={section.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE }} className="h-full">
                <InspectorBody section={section} />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function InspectorBody({ section }: { section: SectionInstance }) {
  const store = useEditorStore();
  const api = useEditorApi();
  const def = getSection(section.type);
  const currency = useEditor((s) => s.doc.currency);
  const required = isRequired(section.type);

  const issues = useMemo(() => (def ? sectionIssues(def, section.data) : []), [def, section.data]);
  const errors = useMemo(() => issuesByPath(issues), [issues]);
  const scope: FieldScope = useMemo(
    () => ({
      root: section.data,
      errors,
      set: (path, value) => api.setSectionField(section.id, path, value),
      currency,
      idPrefix: `f-${section.id}`,
    }),
    [section.data, section.id, errors, api, currency],
  );

  if (!def) {
    return (
      <div className="p-5">
        <Hint tone="warn" icon={<CircleAlert />}>
          Unknown section type “{section.type}”. It will be left out when publishing.
        </Hint>
      </div>
    );
  }

  const remove = () => {
    if (api.removeSection(section.id)) toast(`${def.label} removed`, { action: { label: "Undo", onClick: () => store.getState().undo() } });
  };
  const zone = zoneOf(section.type);
  const { loose, groups } = splitFields(def.fields);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[var(--bld-hairline)] px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.06] text-foreground/80">
          <SectionIcon type={section.type} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold tracking-[-0.01em]">
            {def.label}
            {required ? <Lock className="size-3 text-muted-foreground" aria-label="Required" /> : null}
          </p>
          <p className="truncate text-[11.5px] text-muted-foreground">{def.description}</p>
        </div>
        <div className="flex shrink-0 items-center">
          {!isSingleton(section.type) ? (
            <TipButton label="Duplicate" shortcut={`${MOD}+D`} size="icon-sm" onClick={() => api.duplicateSection(section.id)}>
              <Copy />
            </TipButton>
          ) : null}
          <TipButton label={section.hidden ? "Show" : "Hide"} size="icon-sm" disabled={required} onClick={() => api.patchSection(section.id, { hidden: !section.hidden })}>
            {section.hidden ? <EyeOff /> : <Eye />}
          </TipButton>
          <TipButton label={required ? "Required on every page" : "Remove"} size="icon-sm" disabled={required} onClick={remove} className="hover:text-destructive">
            <Trash2 />
          </TipButton>
          <TipButton label="Close" shortcut="Esc" size="icon-sm" onClick={() => api.select(null)}>
            <X />
          </TipButton>
        </div>
      </div>

      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto pb-10">
        {section.hidden ? (
          <div className="px-4 pt-3">
            <Hint icon={<EyeOff />}>Hidden — visitors don&apos;t see this section.</Hint>
          </div>
        ) : null}
        {issues.length ? (
          <div className="px-4 pt-3">
            <Hint tone="warn" icon={<CircleAlert />}>
              {issues.length === 1 ? "1 field needs attention" : `${issues.length} fields need attention`} before publishing.
            </Hint>
          </div>
        ) : null}

        {def.variants.length > 1 ? (
          <PanelSection title="Style" collapsible>
            <VariantPicker def={def} section={section} />
          </PanelSection>
        ) : null}

        <PanelSection title="Look" collapsible>
          <BackgroundPicker def={def} section={section} />
          {zone === "main" ? <DividerPicker section={section} /> : null}
          {zone !== "end" || def.category === "bottom" ? (
            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-foreground/85">Spacing</p>
              <Segmented
                value={section.spacing}
                onChange={(spacing) => api.patchSection(section.id, { spacing })}
                label="Spacing"
                size="sm"
                options={[
                  { value: "tight", label: "Tight" },
                  { value: "normal", label: "Normal" },
                  { value: "airy", label: "Airy" },
                ]}
              />
            </div>
          ) : null}
        </PanelSection>

        {loose.length ? (
          <PanelSection title="Content" collapsible>
            <Fields fields={loose} scope={scope} />
          </PanelSection>
        ) : null}
        {groups.map((g) => (
          <PanelSection key={g.label} title={g.label} collapsible>
            <Fields fields={g.fields} scope={scope} />
          </PanelSection>
        ))}
        {!def.fields.length ? (
          <div className="px-4 pt-4">
            <Hint>This section has no content of its own — it uses the product, offer and store details.</Hint>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Top-level groups become their own panel sections; loose fields share one. */
function splitFields(fields: readonly FieldSpec[]): { loose: FieldSpec[]; groups: Extract<FieldSpec, { kind: "group" }>[] } {
  const loose: FieldSpec[] = [];
  const groups: Extract<FieldSpec, { kind: "group" }>[] = [];
  for (const f of fields) {
    if (f.kind === "group") groups.push(f);
    else loose.push(f);
  }
  return { loose, groups };
}

/* ------------------------------------------------------------------ */
/* variants                                                            */
/* ------------------------------------------------------------------ */

function VariantPicker({ def, section }: { def: AnySectionDefinition; section: SectionInstance }) {
  const api = useEditorApi();
  const doc = useEditor((s) => s.doc);
  const assets = useEditor((s) => s.assets);
  const { store } = useEnv();
  // thumbnails follow edits at a lower priority than the inputs
  const base = useDeferredValue(doc);
  const data = useDeferredValue(section.data);
  const floating = def.category === "floating";
  const docs = useMemo(() => {
    const out: Record<string, PageDoc> = {};
    for (const v of def.variants) {
      const inst: SectionInstance = { ...section, data, variant: v.id, hidden: false, divider: "none", bg: allowedBgs(def, v.id).includes(section.bg) ? section.bg : allowedBgs(def, v.id)[0]! };
      out[v.id] = { ...base, sections: [inst] };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- section identity changes with every edit; data/bg/id are what matter
  }, [def, base.theme, base.product, base.offers, base.form, base.locale, base.currency, data, section.bg, section.id]);

  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Section style">
      {def.variants.map((v) => {
        const active = v.id === section.variant;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-selected={active}
            onClick={() => {
              if (active) return;
              const bgs = allowedBgs(def, v.id);
              api.patchSection(section.id, { variant: v.id, ...(bgs.includes(section.bg) ? {} : { bg: bgs[0] }) });
            }}
            title={v.description}
            className="bld-tile group flex flex-col overflow-hidden text-left outline-none"
          >
            {floating ? (
              <div className="grid aspect-[4/3] place-items-center bg-muted/60 text-muted-foreground">
                <SectionIcon type={def.type} className="size-6" />
              </div>
            ) : (
              <LandingThumbnail
                doc={docs[v.id]!}
                assets={assets}
                store={store}
                device="mobile"
                sections={1}
                aspectRatio={def.category === "top" ? "390 / 110" : "3 / 4"}
                className="w-full rounded-t-[12px]"
              />
            )}
            <span className="flex items-center gap-1.5 px-2.5 py-2">
              <span className={cn("size-1.5 shrink-0 rounded-full transition-colors", active ? "bg-brand" : "bg-foreground/15")} />
              <span className="truncate text-[11.5px] font-medium">{v.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* background, divider                                                 */
/* ------------------------------------------------------------------ */

function BackgroundPicker({ def, section }: { def: AnySectionDefinition; section: SectionInstance }) {
  const api = useEditorApi();
  const theme = useBuiltTheme();
  const allowed = new Set(allowedBgs(def, section.variant));
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground/85">
        Background <span className="font-normal text-muted-foreground">· {BG_LABELS[section.bg]}</span>
      </p>
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label="Background">
        {SECTION_BGS.map((bg) => {
          const ok = allowed.has(bg);
          const active = section.bg === bg;
          const fill = theme?.tokens[`${bg}:sec-bg`] ?? "var(--muted)";
          const ink = theme?.tokens[`${bg}:sec-ink`] ?? "var(--foreground)";
          const accent = theme?.tokens[`${bg}:sec-accent`] ?? ink;
          return (
            <button
              key={bg}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${BG_LABELS[bg]}${ok ? "" : " (not available for this style)"}`}
              title={ok ? BG_LABELS[bg] : `${BG_LABELS[bg]} — not available for this style`}
              disabled={!ok}
              data-selected={active}
              onClick={() => api.patchSection(section.id, { bg })}
              className="bld-tile relative grid aspect-square place-items-center overflow-hidden outline-none disabled:cursor-not-allowed disabled:opacity-35"
              style={{ background: fill }}
            >
              <span className="text-[13px] font-semibold leading-none" style={{ color: ink }}>
                Aa
              </span>
              <span className="absolute bottom-1.5 h-[3px] w-3 rounded-full" style={{ background: accent }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DividerPicker({ section }: { section: SectionInstance }) {
  const api = useEditorApi();
  const options = ["auto", ...DIVIDERS] as const;
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-medium text-foreground/85">
        Edge above <span className="font-normal text-muted-foreground">· {DIVIDER_LABELS[section.divider]}</span>
      </p>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Edge above">
        {options.map((d) => {
          const active = section.divider === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              data-selected={active}
              title={d === "auto" ? "Auto — chosen by the theme where the background changes" : DIVIDER_LABELS[d]}
              onClick={() => api.patchSection(section.id, { divider: d })}
              className="bld-tile flex flex-col items-center gap-1 px-1 pb-1.5 pt-2 text-foreground/70 outline-none"
            >
              <DividerGlyph kind={d} className="h-5 w-9" />
              <span className="text-[10.5px] font-medium">{DIVIDER_LABELS[d]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
