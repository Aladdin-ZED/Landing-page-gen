"use client";
/**
 * On-demand loading of ./kit (generator + copy library). The wizard prefetches it while the
 * browser is idle and needs it from the directions step on; until it is in, the directions show
 * their loading state.
 */
import { useEffect, useState } from "react";

export type GeneratorKit = typeof import("./kit");

let loaded: GeneratorKit | null = null;
let pending: Promise<GeneratorKit> | null = null;

export function loadGeneratorKit(): Promise<GeneratorKit> {
  return (pending ??= import("./kit").then(
    (kit) => (loaded = kit),
    (err: unknown) => {
      pending = null;
      throw err;
    },
  ));
}

/**
 * The kit once loaded (null before). `wanted` starts the load; a failed load surfaces `error` and is
 * retried when `attempt` changes (the wizard step or a new seed), so "Try again" or going back recovers.
 */
export function useGeneratorKit(wanted: boolean, attempt: unknown): { kit: GeneratorKit | null; error: string | null } {
  const [kit, setKit] = useState<GeneratorKit | null>(() => loaded);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (kit || !wanted) return;
    let alive = true;
    loadGeneratorKit().then(
      (k) => {
        if (!alive) return;
        setError(null);
        setKit(k);
      },
      (err: unknown) => {
        console.warn("[generate] the generator could not be loaded", err);
        if (alive) setError("The page generator couldn't be loaded. Check your connection, then try again.");
      },
    );
    return () => {
      alive = false;
    };
  }, [kit, wanted, attempt]);
  return { kit, error: kit ? null : error };
}
