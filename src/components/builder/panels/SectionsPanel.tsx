"use client";
/**
 * Sections list: three zones (top bar · page · footer & floating), drag to reorder inside a zone,
 * click to select, eye to hide, menu for duplicate / move / remove. The order form is locked.
 */
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent, type Modifier } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, GripVertical, Lock, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getSection } from "@/landing/registry";
import { isRequired, isSingleton, zoneOf, type Zone } from "@/lib/editor/sections";
import type { SectionInstance } from "@/lib/page/schema";
import { cn } from "@/lib/utils";
import { useEditor, useEditorApi, useEditorStore } from "../context";
import { useBuiltTheme } from "../env";
import { BG_LABELS, SectionIcon } from "../section-meta";
import { PanelHeader } from "../ui";

const ZONES: { zone: Zone; title: string }[] = [
  { zone: "top", title: "Top bar" },
  { zone: "main", title: "Page" },
  { zone: "end", title: "Footer & floating" },
];

/** Drag only vertically. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function SectionsPanel() {
  const api = useEditorApi();
  const sections = useEditor(useShallow((s) => s.doc.sections));
  const selectedId = useEditor((s) => s.selectedId);
  const theme = useBuiltTheme();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  // a stable id for dnd-kit's aria-describedby: its own counter differs between the server render and hydration
  const dndId = useId();

  const byZone = useMemo(() => {
    const out: Record<Zone, SectionInstance[]> = { top: [], main: [], end: [] };
    for (const s of sections) out[zoneOf(s.type)].push(s);
    return out;
  }, [sections]);

  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) api.reorderSection(String(e.active.id), String(e.over.id));
  };

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Sections"
        description={`${sections.filter((s) => !s.hidden).length} visible · drag to reorder`}
        actions={
          <Button size="sm" variant="secondary" onClick={() => api.setLibraryOpen(true)} className="bld-press h-7 gap-1">
            <Plus />
            Add
          </Button>
        }
      />
      <div className="bld-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-6" data-bld-keys>
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
          {ZONES.map(({ zone, title }) =>
            byZone[zone].length ? (
              <div key={zone} className="mb-3">
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold text-muted-foreground">{title}</p>
                <SortableContext items={byZone[zone].map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-0.5">
                    {byZone[zone].map((s, i, list) => (
                      <SectionRow
                        key={s.id}
                        section={s}
                        selected={s.id === selectedId}
                        swatch={theme?.tokens[`${s.bg}:sec-bg`] ?? null}
                        first={i === 0}
                        last={i === list.length - 1}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </div>
            ) : null,
          )}
        </DndContext>
        <button
          type="button"
          onClick={() => api.setLibraryOpen(true)}
          className="bld-press mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground/[0.035] py-3 text-[12.5px] font-medium text-muted-foreground outline-none ring-1 ring-inset ring-foreground/[0.05] hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Plus className="size-4" />
          Add a section
        </button>
      </div>
    </div>
  );
}

function SectionRow({ section, selected, swatch, first, last }: { section: SectionInstance; selected: boolean; swatch: string | null; first: boolean; last: boolean }) {
  const store = useEditorStore();
  const api = useEditorApi();
  const def = getSection(section.type);
  const required = isRequired(section.type);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const variant = def?.variants.find((v) => v.id === section.variant);
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const setRefs = useCallback(
    (el: HTMLLIElement | null) => {
      setNodeRef(el);
      setNode(el);
    },
    [setNodeRef],
  );
  // a selection made in the preview (or by the keyboard) brings its row into view
  useEffect(() => {
    if (selected) node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, node]);

  const remove = () => {
    if (api.removeSection(section.id)) {
      toast(`${def?.label ?? "Section"} removed`, { action: { label: "Undo", onClick: () => store.getState().undo() } });
    }
  };

  return (
    <li
      ref={setRefs}
      data-section-id={section.id}
      data-section-type={section.type}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative flex h-11 items-center gap-1 rounded-xl pe-1 ps-0.5 transition-[background-color,box-shadow,opacity] duration-200",
        selected ? "bg-brand-soft/80 shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_35%,transparent)]" : "hover:bg-foreground/[0.04]",
        isDragging && "z-10 bg-card shadow-[0_12px_28px_-10px_rgb(0_0_0/0.3),0_0_0_1px_rgb(0_0_0/0.06)]",
        section.hidden && "opacity-55",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        data-dnd-handle
        aria-label={`Reorder ${def?.label ?? section.type}`}
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/50 opacity-0 outline-none transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing group-hover:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          api.setInteractive(false);
          api.select(section.id);
        }}
        aria-current={selected || undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("relative grid size-7 shrink-0 place-items-center rounded-lg text-foreground/75 transition-colors", selected ? "bg-background/80" : "bg-foreground/[0.05]")}>
          <SectionIcon type={section.type} className="size-3.5" />
          <span
            className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full ring-2 ring-[var(--bld-panel)]"
            style={{ background: swatch ?? "var(--muted)" }}
            title={`Background: ${BG_LABELS[section.bg]}`}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-[13px] font-medium leading-tight text-foreground">
            {def?.label ?? section.type}
            {required ? <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Required" /> : null}
          </span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">{variant?.label ?? section.variant}</span>
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={required}
            aria-label={section.hidden ? "Show section" : "Hide section"}
            aria-pressed={section.hidden}
            onClick={() => api.patchSection(section.id, { hidden: !section.hidden })}
            className={cn("text-muted-foreground", !section.hidden && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
          >
            {section.hidden ? <EyeOff /> : <Eye />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">{required ? "The order form is always shown" : section.hidden ? "Hidden — click to show" : "Hide on the page"}</TooltipContent>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="Section actions" className="text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem disabled={isSingleton(section.type)} onSelect={() => api.duplicateSection(section.id)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem disabled={first} onSelect={() => api.moveSection(section.id, -1)}>
            <ArrowUp />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onSelect={() => api.moveSection(section.id, 1)}>
            <ArrowDown />
            Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={required} onSelect={remove}>
            <Trash2 />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
