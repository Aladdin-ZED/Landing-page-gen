/**
 * First-party analytics beacons (EventPayload): view on load (landing page), form_start on the first
 * form interaction, cta_click on order CTAs, bundle_change when the shopper switches packs.
 * Anonymous visitor id only; never in preview.
 */
import type { Ctx } from "./core";
import { beacon } from "./http";
import { visitorId } from "./tracking";

type EventType = "view" | "form_start" | "bundle_change" | "cta_click";

export function analytics(c: Ctx): void {
  const url = c.cfg.endpoints.event;
  if (c.preview || !url) return;
  let vid = "";
  const send = (type: EventType, bundleId?: string | null) => {
    vid = vid || visitorId(c);
    beacon(c.win, url, {
      pageKey: c.cfg.pageKey,
      type,
      vid,
      ...(bundleId ? { bundleId: bundleId.slice(0, 40) } : {}),
      utm: c.st.utm,
    });
  };
  if (c.cfg.page === "landing") send("view");
  c.sub("start", () => send("form_start", c.st.bundleId));
  c.sub("cta", (id) => send("cta_click", id));
  c.sub("bundle", (e) => {
    if (e.user) send("bundle_change", e.id);
  });
}
