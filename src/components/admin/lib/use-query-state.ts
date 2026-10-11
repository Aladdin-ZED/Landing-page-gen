"use client";
/**
 * URL-backed filter state for list screens: the server page reads searchParams, the client
 * updates them with router.replace inside a transition (so the list keeps showing while the next
 * one streams in, and `pending` can dim it smoothly).
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export type QueryPatch = Record<string, string | number | boolean | null | undefined>;

export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (patch: QueryPatch, opts: { resetPage?: boolean; scroll?: boolean } = {}) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === "" || value === false) next.delete(key);
        else next.set(key, String(value));
      }
      if (opts.resetPage ?? true) {
        if (!("page" in patch)) next.delete("page");
      }
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: opts.scroll ?? false });
      });
    },
    [params, pathname, router],
  );

  const get = useCallback((key: string) => params.get(key) ?? "", [params]);

  return { get, set, pending, params };
}
