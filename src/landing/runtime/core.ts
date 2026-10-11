/**
 * Runtime plumbing shared by every module: the context object, scoped listeners/cleanups,
 * a tiny typed event bus and DOM helpers.
 *
 * Everything goes through ctx.doc / ctx.win (never the globals) so the same code runs on the live
 * page and inside the admin preview iframe driven from the parent window. Never use `instanceof`
 * on DOM nodes here: nodes from the iframe belong to another realm.
 */
import type { LandingRuntimeConfig } from "./config";

export type W = Window & typeof globalThis;
export type Fn = () => void;
export type Ctl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface Purchase {
  orderId: string;
  value: number;
  currency: string;
  eventId: string;
  qty: number;
}

/** Cross-module events. `select` is a request, `bundle` the applied result. */
export interface Bus {
  select: string;
  bundle: { id: string; user: boolean };
  start: null;
  cta: string | null;
  purchase: Purchase;
}

/** State that survives refresh() (preview re-renders) for the lifetime of one instance. */
export interface State {
  bundleId: string;
  bump: boolean;
  /** first form interaction (epoch ms); 0 = not started */
  t0: number;
  idem: string;
  eventId: string;
  /** idem the abandoned-lead beacon was sent for */
  lead: string;
  sending: boolean;
  done: boolean;
  utm: Record<string, string>;
}

export interface Ctx {
  doc: Document;
  win: W;
  cfg: LandingRuntimeConfig;
  /** admin preview: no network, no pixels, no storage side effects that matter */
  preview: boolean;
  /** prefers-reduced-motion or theme motion "off" */
  reduced: boolean;
  st: State;
  /** register a cleanup for this scope */
  add(fn: Fn): void;
  /** addEventListener with automatic removal and exception guard */
  on(target: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void;
  emit<K extends keyof Bus>(k: K, d: Bus[K]): void;
  sub<K extends keyof Bus>(k: K, fn: (d: Bus[K]) => void): void;
}

export function report(win: W, e: unknown): void {
  try {
    win.console.warn("[lp]", e);
  } catch {
    /* console unavailable */
  }
}

export function $$<E extends Element = HTMLElement>(root: ParentNode, sel: string): E[] {
  return Array.prototype.slice.call(root.querySelectorAll(sel)) as E[];
}

/** Boolean attribute toggle (present = on). */
export function flag(el: Element, name: string, on: boolean): void {
  if (on) {
    if (!el.hasAttribute(name)) el.setAttribute(name, "");
  } else if (el.hasAttribute(name)) el.removeAttribute(name);
}

/**
 * Set text while keeping an existing single text node (React in the preview keeps references to
 * its text nodes; replacing them would detach its future updates).
 */
export function setText(el: Element, s: string): void {
  const n = el.firstChild;
  if (n && n === el.lastChild && n.nodeType === 3) {
    if (n.nodeValue !== s) n.nodeValue = s;
  } else if (el.textContent !== s) el.textContent = s;
}

export function num(v: string | null | undefined, fb = 0): number {
  const n = parseFloat(v || "");
  return isFinite(n) ? n : fb;
}

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export function closest(t: EventTarget | null, sel: string): HTMLElement | null {
  const el = t as Element | null;
  return el && typeof el.closest === "function" ? (el.closest(sel) as HTMLElement | null) : null;
}

export function getForm(c: Ctx): HTMLFormElement | null {
  return c.doc.querySelector<HTMLFormElement>("form[data-lp-form]");
}

type StoreKind = "localStorage" | "sessionStorage";

/** Storage access that never throws (private mode, blocked site data, sandboxed previews). */
export function sget(win: W, kind: StoreKind, key: string): string | null {
  try {
    return win[kind].getItem(key);
  } catch {
    return null;
  }
}

export function sset(win: W, kind: StoreKind, key: string, val: string): boolean {
  try {
    win[kind].setItem(key, val);
    return true;
  } catch {
    return false;
  }
}

/** Direction of an element as rendered (RTL-aware widgets). */
export function isRtl(c: Ctx, el: Element): boolean {
  try {
    return c.win.getComputedStyle(el).direction === "rtl";
  } catch {
    return c.cfg.dir === "rtl";
  }
}

/** Write a live status line ([data-lp-status], aria-live=polite) with a `data-tone` for styling. */
export function setStatus(el: Element | null, text: string, tone: "error" | "info" | "success" | ""): void {
  if (!el) return;
  setText(el, text);
  if (text && tone) el.setAttribute("data-tone", tone);
  else el.removeAttribute("data-tone");
}

/** Disable a control (native `disabled` on buttons, aria-disabled everywhere). */
export function disable(el: Element | null, off: boolean): void {
  if (!el) return;
  if (el.tagName === "BUTTON") (el as HTMLButtonElement).disabled = off;
  el.setAttribute("aria-disabled", off ? "true" : "false");
}
