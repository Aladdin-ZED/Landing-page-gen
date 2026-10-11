import "server-only";
/**
 * Paged admin lists: when the requested page is past the end (its last items were just deleted,
 * unblocked or filtered away, or the URL is stale), redirect to the last page that exists instead
 * of showing a misleading "nothing here" state.
 */
import { redirect } from "next/navigation";

type Params = Record<string, string | string[] | undefined>;

export function redirectPastLastPage(pathname: string, params: Params, list: { page: number; pageSize: number; total: number }, param = "page"): void {
  const last = Math.max(1, Math.ceil(list.total / list.pageSize));
  if (list.page <= last) return;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = Array.isArray(value) ? value[0] : value;
    if (key !== param && v !== undefined) qs.set(key, v);
  }
  if (last > 1) qs.set(param, String(last));
  const query = qs.toString();
  redirect(query ? `${pathname}?${query}` : pathname);
}
