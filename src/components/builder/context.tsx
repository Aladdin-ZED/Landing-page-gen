"use client";
/**
 * React access to the per-page builder store.
 *
 *   const doc = useEditor((s) => s.doc);
 *   const api = useEditorApi();            // store.getState() actions, temporal (undo) store…
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { createEditorStore, type EditorState, type EditorStore } from "@/lib/editor/store";
import type { EditorBootstrap } from "@/lib/editor/types";

const EditorContext = createContext<EditorStore | null>(null);

export function EditorProvider({ boot, children }: { boot: EditorBootstrap; children: ReactNode }) {
  const [store] = useState(() => createEditorStore(boot));
  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorContext);
  if (!store) throw new Error("useEditorStore must be used inside <EditorProvider>");
  return store;
}

export function useEditor<T>(selector: (s: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}

/** Selector with a custom equality (e.g. shallow arrays). */
export function useEditorWith<T>(selector: (s: EditorState) => T, equal: (a: T, b: T) => boolean): T {
  return useStoreWithEqualityFn(useEditorStore(), selector, equal);
}

/** Actions are stable for the store's lifetime. */
export function useEditorApi(): EditorState {
  return useEditorStore().getState();
}

export function useHistory(): { canUndo: boolean; canRedo: boolean } {
  const store = useEditorStore();
  const canUndo = useStore(store.temporal, (t) => t.pastStates.length > 0);
  const canRedo = useStore(store.temporal, (t) => t.futureStates.length > 0);
  return { canUndo, canRedo };
}
