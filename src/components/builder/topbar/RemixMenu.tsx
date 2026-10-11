"use client";
/**
 * Remix: regenerate the design, the layout, the copy — or everything — from a seed. The seed is
 * shown (and editable) so a result you like can be reproduced; every remix is one undo step.
 */
import { Dices, LayoutPanelTop, Palette, Shuffle, Type, Wand } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageDoc } from "@/lib/page/schema";
import { useEditorStore } from "../context";
import { loadRemix } from "../on-demand";

type Scope = "design" | "layout" | "copy" | "all";

const SCOPES: { scope: Scope; label: string; hint: string; icon: typeof Palette }[] = [
  { scope: "design", label: "Design", hint: "Palette, fonts and mood", icon: Palette },
  { scope: "layout", label: "Layout", hint: "Section styles and backgrounds", icon: LayoutPanelTop },
  { scope: "copy", label: "Copy", hint: "Headlines and texts", icon: Type },
  { scope: "all", label: "Everything", hint: "A fresh take on the whole page", icon: Shuffle },
];

const newSeed = () => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0]! % 1_000_000;
};

export function RemixMenu({ disabled }: { disabled?: boolean }) {
  const store = useEditorStore();
  const [seed, setSeed] = useState(newSeed);
  const [seedText, setSeedText] = useState(String(seed));

  const remix = async (scope: Scope) => {
    let remixDoc: Awaited<ReturnType<typeof loadRemix>>;
    try {
      remixDoc = await loadRemix(); // prefetched on idle: normally already in
    } catch {
      toast.error("The remix engine couldn't be loaded. Check your connection and try again.");
      return;
    }
    const before = store.getState().doc;
    let next: PageDoc;
    try {
      const out = remixDoc(before, { seed, scope });
      // remixDoc hands the input back unchanged when it cannot produce a valid page
      if (out === before) throw new Error("no remix");
      const parsed = PageDoc.safeParse(out);
      if (!parsed.success) throw new Error("invalid remix");
      next = parsed.data;
    } catch {
      toast.error("This remix did not work out. Try another seed.");
      return;
    }
    store.getState().replaceDoc(next);
    const label = SCOPES.find((s) => s.scope === scope)!.label;
    toast(`Remixed ${label.toLowerCase()} · seed ${seed}`, {
      action: { label: "Undo", onClick: () => store.getState().undo() },
    });
    const fresh = newSeed();
    setSeed(fresh);
    setSeedText(String(fresh));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label="Remix" className="bld-press gap-1.5 text-foreground/80">
          <Wand />
          <span className="hidden xl:inline">Remix</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-1.5">
        <DropdownMenuLabel className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">Regenerate with a new seed</DropdownMenuLabel>
        {SCOPES.map(({ scope, label, hint, icon: Icon }) => (
          <DropdownMenuItem key={scope} onSelect={() => void remix(scope)} className="gap-3 rounded-lg px-2 py-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/[0.05] text-foreground/80">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium">{label}</span>
              <span className="block text-[11.5px] text-muted-foreground">{hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-2 px-2 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
          <label htmlFor="bld-seed" className="text-[11.5px] font-medium text-muted-foreground">
            Seed
          </label>
          <input
            id="bld-seed"
            inputMode="numeric"
            value={seedText}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "").slice(0, 9);
              setSeedText(raw);
              if (raw) setSeed(Number(raw));
            }}
            className="h-7 w-24 rounded-md border border-input bg-transparent px-2 font-mono text-xs tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New random seed"
            onClick={() => {
              const s = newSeed();
              setSeed(s);
              setSeedText(String(s));
            }}
          >
            <Dices />
          </Button>
          <span className="ms-auto text-[10.5px] text-muted-foreground">same seed = same result</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
