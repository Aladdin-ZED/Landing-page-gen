/**
 * Landing runtime — tiny dependency-free vanilla TS that brings the static landing HTML to life
 * through the data-attribute contract (docs/ARCHITECTURE.md, docs/DESIGN.md §6).
 *
 *   initLanding({ doc, win, config, preview? }) → { destroy(), refresh() }
 *
 * - Uses opts.doc / opts.win exclusively (runs inside the admin preview iframe from the parent window).
 * - Idempotent: a second init on the same document replaces the first (bundle choice carried over).
 * - refresh() re-binds every DOM module after the preview re-rendered; session state (idempotency key,
 *   first-interaction time, selected bundle, analytics/pixels) is kept.
 * - Every module is optional (missing elements = no-op) and isolated: an exception in one never
 *   breaks the others or leaks to the page; reveals fail open (content visible).
 */
import { accordion } from "./accordion";
import { analytics } from "./analytics";
import { bundles } from "./bundles";
import { compare } from "./compare";
import type { LandingRuntimeConfig } from "./config";
import type { Bus, Ctx, Fn, State, W } from "./core";
import { report } from "./core";
import { countdown } from "./countdown";
import { form } from "./form";
import { gallery } from "./gallery";
import { lead } from "./lead";
import { marquee } from "./marquee";
import { orderScroll } from "./order-scroll";
import { parallax } from "./parallax";
import { pixels } from "./pixels";
import { reveal, revealAll } from "./reveal";
import { sticky } from "./sticky";
import { tabs } from "./tabs";
import { thankyou } from "./thankyou";
import { captureUtm } from "./tracking";
import { video } from "./video";

export type { LandingRuntimeConfig } from "./config";

export interface LandingInitOptions {
  doc: Document;
  win: Window;
  config: LandingRuntimeConfig;
  /** admin preview: never sends orders/leads/events, never loads pixels (default: config.mode === "preview") */
  preview?: boolean;
}

export interface LandingInstance {
  destroy(): void;
  refresh(): void;
}

type Module = (c: Ctx) => void;

/** Once per instance (survive refresh): attribution, analytics, pixels. */
const ONCE: Module[] = [analytics, pixels];
/** DOM bindings, rebuilt on refresh. Order matters: bundles → form → lead; thankyou → countdown. */
const BIND: Module[] = [
  reveal,
  parallax,
  marquee,
  video,
  gallery,
  compare,
  tabs,
  accordion,
  bundles,
  form,
  lead,
  orderScroll,
  sticky,
  thankyou,
  countdown,
];

interface Scope {
  add(fn: Fn): void;
  run(): void;
}

function scope(win: W): Scope {
  let fns: Fn[] = [];
  return {
    add: (fn) => {
      fns.push(fn);
    },
    run: () => {
      const list = fns;
      fns = [];
      for (let i = list.length - 1; i >= 0; i--) {
        try {
          list[i]!();
        } catch (e) {
          report(win, e);
        }
      }
    },
  };
}

const instances = new WeakMap<Document, LandingInstance & { st: State }>();

function motionReduced(doc: Document, win: W): boolean {
  if (doc.documentElement.getAttribute("data-motion") === "off") return true;
  try {
    return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function initLanding(opts: LandingInitOptions): LandingInstance {
  const doc = opts.doc;
  const win = opts.win as W;
  const cfg = opts.config;
  const preview = opts.preview === undefined ? cfg.mode === "preview" : opts.preview;

  const prev = instances.get(doc);
  if (prev) prev.destroy();

  doc.documentElement.classList.add("lp-js");

  const st: State = {
    bundleId: prev ? prev.st.bundleId : "",
    bump: false,
    t0: 0,
    idem: "",
    eventId: "",
    lead: "",
    sending: false,
    done: false,
    utm: {},
  };
  const subs = new Map<keyof Bus, Set<(d: unknown) => void>>();
  const root = scope(win);
  let bind = scope(win);
  let alive = true;

  const ctx = (s: Scope): Ctx => ({
    doc,
    win,
    cfg,
    preview,
    reduced: motionReduced(doc, win),
    st,
    add: s.add,
    on(target, type, fn, o) {
      const h = (e: Event) => {
        try {
          fn(e);
        } catch (err) {
          report(win, err);
        }
      };
      target.addEventListener(type, h, o);
      s.add(() => target.removeEventListener(type, h, o));
    },
    emit(k, d) {
      const set = subs.get(k);
      if (!set) return;
      set.forEach((fn) => {
        try {
          fn(d);
        } catch (err) {
          report(win, err);
        }
      });
    },
    sub(k, fn) {
      let set = subs.get(k);
      if (!set) subs.set(k, (set = new Set()));
      const h = fn as unknown as (d: unknown) => void;
      set.add(h);
      s.add(() => set!.delete(h));
    },
  });

  const run = (m: Module, c: Ctx) => {
    try {
      m(c);
    } catch (e) {
      report(win, e);
      if (m === reveal) {
        try {
          revealAll(c);
        } catch {
          doc.documentElement.classList.remove("lp-js");
        }
      }
    }
  };

  const mount = () => {
    const c = ctx(bind);
    for (const m of BIND) run(m, c);
  };

  try {
    st.utm = captureUtm(win);
  } catch (e) {
    report(win, e);
  }
  const rootCtx = ctx(root);
  for (const m of ONCE) run(m, rootCtx);
  mount();

  const inst = {
    st,
    destroy() {
      if (!alive) return;
      alive = false;
      bind.run();
      root.run();
      subs.clear();
      if (instances.get(doc) === inst) instances.delete(doc);
    },
    refresh() {
      if (!alive) return;
      bind.run();
      bind = scope(win);
      mount();
    },
  };
  instances.set(doc, inst);
  return { destroy: inst.destroy, refresh: inst.refresh };
}

/** Parse & sanity-check the JSON config embedded as <script type="application/json" id="lp-config">. */
export function readConfig(doc: Document): LandingRuntimeConfig | null {
  try {
    const el = doc.getElementById("lp-config");
    const c = el ? (JSON.parse(el.textContent || "null") as LandingRuntimeConfig | null) : null;
    if (
      !c ||
      c.v !== 1 ||
      typeof c.pageKey !== "string" ||
      !c.endpoints ||
      typeof c.endpoints.order !== "string" ||
      !Array.isArray(c.bundles) ||
      !c.money ||
      !c.phone ||
      typeof c.phone.national !== "string"
    )
      return null;
    if (!c.strings || typeof c.strings !== "object") c.strings = {};
    if (!c.pixels || typeof c.pixels !== "object") c.pixels = {};
    if (!Array.isArray(c.variants)) c.variants = [];
    return c;
  } catch {
    return null;
  }
}
