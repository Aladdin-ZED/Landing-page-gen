/**
 * Ad pixels — Meta (fbq), TikTok (ttq), Snap (snaptr), GA4 (gtag) — only for configured ids,
 * never in preview. The official loader stubs are re-implemented here (no inline script → works under
 * the strict hash-based CSP via 'strict-dynamic') and inject the vendors' official scripts.
 *
 * Events: PageView (+ GA4 config page_view) and ViewContent / view_item on the landing page,
 * InitiateCheckout / begin_checkout on the first form interaction, Purchase / purchase on the
 * thank-you page (emitted by thankyou.ts once per order) with the order's eventId for
 * browser ↔ server deduplication (Meta eventID, TikTok event_id, Snap client_dedup_id) and
 * GA4 transaction_id = orderId. TikTok's purchase event is "CompletePayment".
 */
import { round2 } from "../../lib/page/pricing";
import type { Ctx } from "./core";
import { computeTotals } from "./money";

type Fn = (...a: unknown[]) => void;
interface Queue {
  (...a: unknown[]): void;
  queue: unknown[];
  callMethod?: Fn;
  handleRequest?: Fn;
  push?: Queue;
  loaded?: boolean;
  version?: string;
}
type Deferred = unknown[] & Record<string, unknown>;
interface Ttq extends Array<unknown> {
  methods: string[];
  setAndDefer: (o: Deferred, m: string) => void;
  instance: (id: string) => Deferred;
  load: (id: string, opts?: Record<string, unknown>) => void;
  _i: Record<string, Deferred>;
  _t: Record<string, number>;
  _o: Record<string, Record<string, unknown>>;
  page: Fn;
  track: Fn;
}
interface PxWin {
  fbq?: Queue;
  _fbq?: Queue;
  ttq?: Ttq;
  TiktokAnalyticsObject?: string;
  snaptr?: Queue;
  dataLayer?: unknown[];
  gtag?: Fn;
  /** set once the loaders ran in this window: re-initialisation must not double-count page views */
  __lpPx?: boolean;
}

const TTQ_METHODS =
  "page track identify instances debug on off once ready alias group enableCookie disableCookie holdConsent revokeConsent grantConsent".split(
    " ",
  );

const valid = (re: RegExp, v: string | undefined) => (v && re.test(v) ? v : "");

interface PixelEvent {
  value: number;
  qty: number;
  currency: string;
  unit?: number;
  orderId?: string;
  eventId?: string;
}

/** Meta fbq stub (official snippet semantics: queue `arguments` until fbevents.js takes over). */
function metaStub(w: PxWin, load: (src: string) => void): void {
  if (w.fbq) return;
  const n = function () {
    // eslint-disable-next-line prefer-rest-params
    if (n.callMethod) n.callMethod(...(arguments as unknown as unknown[]));
    // eslint-disable-next-line prefer-rest-params
    else n.queue.push(arguments);
  } as Queue;
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  load("https://connect.facebook.net/en_US/fbevents.js");
}

/** TikTok ttq stub (official snippet: deferred method queue + per-pixel _i/_t/_o registries). */
function tiktokStub(w: PxWin, load: (src: string) => void): Ttq {
  w.TiktokAnalyticsObject = "ttq";
  const q = (w.ttq = w.ttq || ([] as unknown as Ttq));
  if (typeof q.load === "function") return q;
  q.methods = TTQ_METHODS;
  q.setAndDefer = (o, m) => {
    o[m] = function () {
      // eslint-disable-next-line prefer-rest-params
      o.push([m].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (const m of TTQ_METHODS) q.setAndDefer(q as unknown as Deferred, m);
  q.instance = (id) => {
    const e = (q._i[id] || []) as Deferred;
    for (const m of TTQ_METHODS) q.setAndDefer(e, m);
    return e;
  };
  q.load = (id, opts) => {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    q._i = q._i || {};
    q._i[id] = [] as unknown as Deferred;
    q._i[id]._u = src;
    q._t = q._t || {};
    q._t[id] = Date.now();
    q._o = q._o || {};
    q._o[id] = opts || {};
    load(src + "?sdkid=" + encodeURIComponent(id) + "&lib=ttq");
  };
  return q;
}

/** Snap snaptr stub (official snippet: queue until scevent.min.js installs handleRequest). */
function snapStub(w: PxWin, load: (src: string) => void): void {
  if (w.snaptr) return;
  const a = function () {
    // eslint-disable-next-line prefer-rest-params
    if (a.handleRequest) a.handleRequest(...(arguments as unknown as unknown[]));
    // eslint-disable-next-line prefer-rest-params
    else a.queue.push(arguments);
  } as Queue;
  a.queue = [];
  w.snaptr = a;
  load("https://sc-static.net/scevent.min.js");
}

/** GA4 gtag (official snippet: dataLayer must receive the Arguments object itself). */
function gaStub(w: PxWin, id: string, load: (src: string) => void): void {
  load("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id));
  const dl = (w.dataLayer = w.dataLayer || []);
  w.gtag =
    w.gtag ||
    function () {
      // eslint-disable-next-line prefer-rest-params
      dl.push(arguments);
    };
}

export function pixels(c: Ctx): void {
  if (c.preview) return;
  const { cfg, doc } = c;
  const px = cfg.pixels || {};
  const meta = valid(/^[0-9]{6,20}$/, px.meta);
  const tiktok = valid(/^[A-Z0-9]{8,30}$/, px.tiktok);
  const snap = valid(/^[a-f0-9-]{20,40}$/, px.snap);
  const ga = valid(/^G-[A-Z0-9]{4,16}$/, px.ga4);
  if (!meta && !tiktok && !snap && !ga) return;
  const w = c.win as unknown as PxWin;
  const p = cfg.product;

  const load = (src: string) => {
    const s = doc.createElement("script");
    s.async = true;
    s.src = src;
    const first = doc.getElementsByTagName("script")[0];
    if (first && first.parentNode) first.parentNode.insertBefore(s, first);
    else (doc.head || doc.documentElement).appendChild(s);
  };

  const fire = (kind: 0 | 1 | 2, e: PixelEvent) => {
    const value = round2(e.value);
    const cur = e.currency;
    const id = p.contentId;
    if (meta && w.fbq) {
      const args: unknown[] = [
        "track",
        ["ViewContent", "InitiateCheckout", "Purchase"][kind],
        { content_ids: [id], content_type: "product", content_name: p.name, value, currency: cur, num_items: e.qty },
      ];
      if (e.eventId) args.push({ eventID: e.eventId });
      w.fbq(...args);
    }
    if (tiktok && w.ttq)
      w.ttq.track(
        ["ViewContent", "InitiateCheckout", "CompletePayment"][kind],
        {
          contents: [{ content_id: id, content_type: "product", content_name: p.name, quantity: e.qty }],
          content_type: "product",
          value,
          currency: cur,
        },
        e.eventId ? { event_id: e.eventId } : {},
      );
    if (snap && w.snaptr)
      w.snaptr("track", ["VIEW_CONTENT", "START_CHECKOUT", "PURCHASE"][kind], {
        item_ids: [id],
        price: value,
        currency: cur,
        number_items: e.qty,
        ...(e.orderId ? { transaction_id: e.orderId } : {}),
        ...(e.eventId ? { client_dedup_id: e.eventId } : {}),
      });
    if (ga && w.gtag)
      w.gtag("event", ["view_item", "begin_checkout", "purchase"][kind], {
        currency: cur,
        value,
        items: [
          {
            item_id: p.sku || id,
            item_name: p.name,
            quantity: e.qty,
            ...(e.unit !== undefined ? { price: e.unit } : {}),
          },
        ],
        ...(e.orderId ? { transaction_id: e.orderId } : {}),
      });
  };

  const perUnit = (id: string) => {
    const b = cfg.bundles.find((x) => x.id === id);
    return b ? round2(b.perUnit) : undefined;
  };

  if (!w.__lpPx) {
    w.__lpPx = true;
    if (meta) {
      metaStub(w, load);
      w.fbq!("init", meta);
      w.fbq!("track", "PageView");
    }
    if (tiktok) {
      const q = tiktokStub(w, load);
      q.load(tiktok);
      q.page();
    }
    if (snap) {
      snapStub(w, load);
      w.snaptr!("init", snap, {});
      w.snaptr!("track", "PAGE_VIEW");
    }
    if (ga) {
      gaStub(w, ga, load);
      w.gtag!("js", new Date());
      w.gtag!("config", ga);
    }
    if (cfg.page === "landing") {
      const t = computeTotals(cfg, cfg.defaultBundleId, false);
      fire(0, {
        value: t ? t.bundle : p.price,
        qty: t ? t.qty : 1,
        currency: cfg.currency,
        unit: t ? perUnit(cfg.defaultBundleId) : p.price,
      });
    }
  }

  if (cfg.page === "landing")
    c.sub("start", () => {
      const now = computeTotals(cfg, c.st.bundleId, c.st.bump);
      if (now) fire(1, { value: now.total, qty: now.qty, currency: cfg.currency, unit: perUnit(c.st.bundleId) });
    });
  c.sub("purchase", (o) =>
    fire(2, { value: o.value, qty: o.qty, currency: o.currency, orderId: o.orderId, eventId: o.eventId || undefined }),
  );
}
