/**
 * Landing runtime core — tiny dependency-free vanilla TS that brings the static landing HTML to life
 * through the data-attribute contract (docs/ARCHITECTURE.md, docs/OFFERS.md §F.6, docs/DESIGN.md §6).
 *
 *   start(opts, modules) → { destroy(), refresh() }
 *
 * The entries choose the modules (entry.ts: product pages, entry-thanks.ts: thank-you pages,
 * index.ts: the admin preview with everything). Optional chunks (pixels, turnstile, units-matrix,
 * units-fields, fill-steps-box) register `(window.__lpx = window.__lpx || []).push([name, fn])` before
 * the core script runs; the preview passes them as `features`.
 *
 * - Uses opts.doc / opts.win exclusively (runs inside the admin preview iframe from the parent window).
 * - Idempotent: a second start on the same document replaces the first (offer choice carried over).
 * - refresh() re-binds every DOM module after the preview re-rendered; session state (idempotency key,
 *   first-interaction time, selected offer, analytics/pixels) is kept.
 * - Every module is optional (missing elements = no-op) and isolated: an exception in one never
 *   breaks the others or leaks to the page; reveals fail open (content visible).
 */
import type { LandingRuntimeConfig } from "./config";
import type { Bus, Ctx, Features, Fn, State, W } from "./core";
import { report } from "./core";
import { emptySel } from "./money";
import { revealAll } from "./reveal";
import { captureUtm } from "./tracking";

export type { LandingRuntimeConfig } from "./config";

export interface LandingInitOptions {
  doc: Document;
  win: Window;
  config: LandingRuntimeConfig;
  /** admin preview: never sends orders/leads/events, never loads pixels (default: config.mode === "preview") */
  preview?: boolean;
  /** optional chunks (default: what registered on window.__lpx) */
  features?: Features;
}

export interface LandingInstance {
  destroy(): void;
  refresh(): void;
}

export type Module = (c: Ctx) => void;

export interface Modules {
  /** once per instance (survive refresh): attribution, analytics — the "pixels" chunk runs here too */
  once: Module[];
  /** DOM bindings, rebuilt on refresh, in order */
  bind: Module[];
  /** the module whose failure must reveal everything (reveal.ts) */
  reveal?: Module;
}

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

/** The optional chunks registered on the page. */
export function registered(win: Window): Features {
  const out: Features = {};
  const list = (win as unknown as { __lpx?: unknown }).__lpx;
  if (Array.isArray(list))
    for (const x of list) if (Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "function") out[x[0]] = x[1] as Features[string];
  return out;
}

export function start(opts: LandingInitOptions, modules: Modules): LandingInstance {
  const doc = opts.doc;
  const win = opts.win as W;
  const cfg = opts.config;
  const preview = opts.preview === undefined ? cfg.mode === "preview" : opts.preview;
  const fx = opts.features || registered(win);

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
    sel: () => emptySel(st.bundleId, st.bump),
    px: () => null,
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
    fx,
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
      if (m === modules.reveal) {
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
    for (const m of modules.bind) run(m, c);
  };

  try {
    st.utm = captureUtm(win);
  } catch (e) {
    report(win, e);
  }
  const rootCtx = ctx(root);
  const once = modules.once.slice();
  if (typeof fx.pixels === "function") once.push(fx.pixels as unknown as Module);
  for (const m of once) run(m, rootCtx);
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

/** Parse & sanity-check the JSON config embedded as <script type="application/json" id="lp-config"> (v2 only). */
export function readConfig(doc: Document): LandingRuntimeConfig | null {
  try {
    const el = doc.getElementById("lp-config");
    const c = el ? (JSON.parse(el.textContent || "null") as LandingRuntimeConfig | null) : null;
    if (
      !c ||
      c.v !== 2 ||
      typeof c.pageKey !== "string" ||
      !c.endpoints ||
      typeof c.endpoints.order !== "string" ||
      !Array.isArray(c.bundles) ||
      !Array.isArray(c.items) ||
      !c.money ||
      !c.phone ||
      typeof c.phone.national !== "string"
    )
      return null;
    if (!c.strings || typeof c.strings !== "object") c.strings = {};
    if (!c.pixels || typeof c.pixels !== "object") c.pixels = {};
    if (!Array.isArray(c.extras)) c.extras = [];
    if (!Array.isArray(c.features)) c.features = [];
    if (typeof c.ver !== "string") c.ver = "";
    if (!c.fill) c.fill = "none";
    for (const b of c.bundles) if (!Array.isArray(b.units)) b.units = [];
    for (const it of c.items) if (!Array.isArray(it.groups)) it.groups = [];
    return c;
  } catch {
    return null;
  }
}

/** Boot from the embedded config (production entries). */
export function boot(modules: Modules): void {
  const doc = document;
  const html = doc.documentElement;
  html.classList.add("lp-js");
  const go = () => {
    const config = readConfig(doc);
    if (!config) {
      html.classList.remove("lp-js");
      return;
    }
    try {
      start({ doc, win: window, config }, modules);
    } catch {
      html.classList.remove("lp-js");
    }
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", go, { once: true });
  else go();
}
