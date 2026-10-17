/**
 * Cloudflare Turnstile for the order form (optional chunk "turnstile", docs/OFFERS.md §F.9: emitted
 * only when the page embeds a site key) — active only when config.turnstileSiteKey is set, never in
 * previews. The form gets it from the chunk registry: c.fx.turnstile(c, form).
 *
 *  - Lazy: api.js is loaded on the first interaction with the form (focus, typing, tap), so visitors
 *    who never touch the form never contact Cloudflare.
 *  - Explicit render into a container the runtime adds above the form's status line, appearance
 *    "interaction-only": invisible unless Cloudflare asks the visitor for a click.
 *  - Tokens are single-use and live 300 s: the widget renews expired ones itself
 *    ("refresh-expired": auto), tokens older than TOKEN_TTL are never sent, and the form calls
 *    consume() after every attempt that did not create an order so the next one gets a new token.
 *  - CSP: the script is inserted by the hashed runtime (trusted through 'strict-dynamic'); its iframe
 *    needs frame-src https://challenges.cloudflare.com, which the renderer adds with the site key.
 */
import type { Ctx, W } from "./core";
import { report } from "./core";

/** config.strings key of the "complete the verification above" message (filled by the renderer). */
export { CAPTCHA_STRING } from "./strings";

const API_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Tokens are valid 300 s; a token older than this is renewed instead of sent. */
const TOKEN_TTL = 280_000;

interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string | null | undefined;
  reset(id?: string): void;
  remove(id?: string): void;
}

type TsWindow = W & { turnstile?: TurnstileApi };

export interface Captcha {
  /** load the script and render the widget (idempotent; retried after a failed load) */
  prime(): void;
  /**
   * A fresh, unused token, waiting up to `ms` for one. "" on timeout, when the browser is not
   * supported, or as soon as Cloudflare needs a click (see needsInteraction()).
   */
  token(ms: number): Promise<string>;
  /** the current token was sent: forget it and ask the widget for a new one */
  consume(): void;
  /** Cloudflare is showing an interactive check the visitor has to complete */
  needsInteraction(): boolean;
  /** the widget container (scrolled into view when a click is needed) */
  element(): HTMLElement | null;
}

const loads = new WeakMap<Window, Promise<TurnstileApi>>();

const usable = (t: TurnstileApi | undefined): t is TurnstileApi => !!t && typeof t.render === "function";

/** api.js, once per window; a failed load is forgotten so a later interaction can retry. */
function loadApi(c: Ctx): Promise<TurnstileApi> {
  const win = c.win as TsWindow;
  if (usable(win.turnstile)) return Promise.resolve(win.turnstile);
  const pending = loads.get(win);
  if (pending) return pending;
  const p = new Promise<TurnstileApi>((resolve, reject) => {
    const s = c.doc.createElement("script");
    s.src = API_URL;
    s.async = true;
    s.onload = () => (usable(win.turnstile) ? resolve(win.turnstile) : reject(new Error("turnstile: api missing")));
    s.onerror = () => {
      if (s.parentNode) s.parentNode.removeChild(s);
      reject(new Error("turnstile: script failed to load"));
    };
    (c.doc.head || c.doc.documentElement).appendChild(s);
  });
  loads.set(win, p);
  p.catch(() => {
    if (loads.get(win) === p) loads.delete(win);
  });
  return p;
}

/** Widget theme from the page's color scheme (<meta name="color-scheme">). */
function themeOf(doc: Document): "light" | "dark" {
  const m = doc.querySelector('meta[name="color-scheme"]');
  return m && /^\s*dark/.test(m.getAttribute("content") || "") ? "dark" : "light";
}

export function captcha(c: Ctx, form: HTMLFormElement): Captcha | null {
  const sitekey = c.cfg.turnstileSiteKey;
  if (c.preview || !sitekey) return null;

  let box: HTMLElement | null = null;
  let api: TurnstileApi | null = null;
  let widget: string | null = null;
  let tok = "";
  let at = 0;
  let interactive = false;
  let unsupported = false;
  let started = false;
  let alive = true;
  const waiters: ((t: string) => void)[] = [];

  const flush = (t: string) => {
    for (const w of waiters.splice(0)) w(t);
  };
  const fresh = () => !!tok && Date.now() - at < TOKEN_TTL;

  const container = (): HTMLElement => {
    if (box) return box;
    const el = c.doc.createElement("div");
    el.className = "lp-captcha";
    el.setAttribute("data-lp-captcha", "");
    // centered under the submit button, above the status line (CSSOM: allowed by the page CSP)
    el.style.display = "flex";
    el.style.justifyContent = "center";
    const anchor = form.querySelector("[data-lp-status]");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor);
    else form.appendChild(el);
    box = el;
    return el;
  };

  const reset = () => {
    tok = "";
    at = 0;
    if (!api || widget === null) return;
    try {
      api.reset(widget);
    } catch (e) {
      report(c.win, e);
    }
  };

  const render = (t: TurnstileApi) => {
    if (!alive || widget !== null) return;
    api = t;
    try {
      widget =
        t.render(container(), {
          sitekey,
          action: "order",
          appearance: "interaction-only",
          size: "flexible",
          theme: themeOf(c.doc),
          retry: "auto",
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback: (token: unknown) => {
            tok = typeof token === "string" ? token : "";
            at = Date.now();
            interactive = false;
            if (tok) flush(tok);
          },
          "expired-callback": () => {
            tok = "";
          },
          "timeout-callback": () => {
            tok = "";
          },
          "before-interactive-callback": () => {
            interactive = true;
            flush("");
          },
          "after-interactive-callback": () => {
            interactive = false;
          },
          // the widget retries by itself ("retry": auto); a waiting submit keeps waiting until its timeout
          "error-callback": (code: unknown) => {
            tok = "";
            report(c.win, "turnstile error " + String(code));
            return true;
          },
          "unsupported-callback": () => {
            unsupported = true;
            flush("");
          },
        }) ?? null;
    } catch (e) {
      report(c.win, e);
    }
  };

  const prime = () => {
    if (started || !alive) return;
    started = true;
    loadApi(c).then(render, (e: unknown) => {
      started = false;
      report(c.win, e);
      // blocked / offline: a waiting submit goes on without a token (the server decides)
      flush("");
    });
  };

  c.add(() => {
    alive = false;
    flush("");
    if (api && widget !== null) {
      try {
        api.remove(widget);
      } catch (e) {
        report(c.win, e);
      }
    }
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    widget = null;
  });

  return {
    prime,
    token(ms) {
      prime();
      if (fresh()) return Promise.resolve(tok);
      if (tok) reset(); // older than TOKEN_TTL: renew instead of sending a dead token
      if (!alive || unsupported || interactive) return Promise.resolve("");
      return new Promise<string>((resolve) => {
        const done = (t: string) => {
          c.win.clearTimeout(timer);
          resolve(t);
        };
        const timer = c.win.setTimeout(() => {
          const i = waiters.indexOf(done);
          if (i >= 0) waiters.splice(i, 1);
          resolve("");
        }, ms);
        waiters.push(done);
      });
    },
    consume: reset,
    needsInteraction: () => interactive,
    element: () => box,
  };
}
