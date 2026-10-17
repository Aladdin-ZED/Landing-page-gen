/**
 * Editor affordances inside the preview iframe (plain DOM, driven from the parent window):
 *  - hover outline + label chip on sections ([data-sid]), persistent outline on the selected one
 *  - click → select section (links, buttons and runtime handlers are swallowed in edit mode)
 *  - double-click on [data-edit] → plain-text editing in an overlay that copies the element's
 *    typography; Enter / blur commit, Shift+Enter = new line, Escape cancels
 * The overlay lives outside <body> so it never touches the DOM React owns.
 * Interactive mode turns all of this off and only keeps the page from navigating the iframe away.
 *
 * Offers (docs/OFFERS.md §H.4, two-way selection): `selectOffer(id)` selects that offer in every
 * attached preview (its input[name=bundle] radio, through the runtime's own "change" path) and
 * scrolls it into view; a click on an offer card on the canvas ([data-bundle-card], or an offer
 * CTA's [data-bundle]) emits `offerClicked` to the parent window (`onOfferClicked`), so the Offers
 * panel opens that offer's editor. No React wiring is needed in the preview component.
 */

/** Window event (parent window) fired when an offer is clicked on the canvas: detail = { offerId }. */
export const OFFER_CLICKED_EVENT = "lp-editor:offer-clicked";

/** Frame documents with an attached editor (selectOffer reaches each). */
const frames = new Set<Document>();

/** Select an offer in the previews (the runtime updates prices, units and visuals as for a tap). */
export function selectOffer(offerId: string, reveal = true): void {
  for (const doc of frames) {
    const win = doc.defaultView as (Window & typeof globalThis) | null;
    if (!win) continue;
    const id = win.CSS.escape(offerId);
    const radio = doc.querySelector<HTMLInputElement>(`input[name="bundle"][value="${id}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new win.Event("change", { bubbles: true }));
    }
    if (!reveal) continue;
    const card = (radio?.closest("[data-bundle-card]") as HTMLElement | null) ?? doc.querySelector<HTMLElement>(`[data-bundle-card="${id}"]`);
    if (!card) continue;
    const r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > win.innerHeight) card.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/** Subscribe to offer clicks on the canvas; returns the unsubscribe function. */
export function onOfferClicked(cb: (offerId: string) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (e: Event) => {
    const id = (e as CustomEvent<{ offerId?: unknown }>).detail?.offerId;
    if (typeof id === "string" && id) cb(id);
  };
  window.addEventListener(OFFER_CLICKED_EVENT, handler);
  return () => window.removeEventListener(OFFER_CLICKED_EVENT, handler);
}

function offerClicked(target: EventTarget | null): void {
  const node = target as Node | null;
  const el = node && node.nodeType === 1 ? (node as Element) : (node?.parentElement ?? null);
  const card = el?.closest("[data-bundle-card],a[data-bundle],button[data-bundle]");
  const id = card?.getAttribute("data-bundle-card") || card?.getAttribute("data-bundle");
  if (!id || typeof window === "undefined") return;
  selectOffer(id, false);
  window.dispatchEvent(new CustomEvent(OFFER_CLICKED_EVENT, { detail: { offerId: id } }));
}

export interface EditorHandlers {
  /** chip text for a section id, e.g. "Hero · stage" */
  label(sectionId: string): string;
  /** raw (markup) value at a section data path, or null when it is not a string */
  rawText(sectionId: string, path: string): string | null;
  select(sectionId: string): void;
  editText(sectionId: string, path: string, value: string): void;
}

export interface EditorHandle {
  setInteractive(on: boolean): void;
  setSelected(id: string | null, reveal?: boolean): void;
  /** re-measure outlines after the page re-rendered */
  refresh(): void;
  destroy(): void;
}

const EDITOR_CSS = `
.lpx-layer{position:absolute;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none}
.lpx-box{position:absolute;display:none;box-sizing:border-box;border:2px solid #2563eb;border-radius:3px}
.lpx-box[data-on]{display:block}
.lpx-box--hover{border:1.5px dashed rgba(37,99,235,.75)}
.lpx-chip{position:absolute;top:-1px;left:-1px;padding:3px 7px;border-radius:2px 0 4px 0;background:#2563eb;color:#fff;font:600 11px/1.3 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif;letter-spacing:0;white-space:nowrap;direction:ltr;text-transform:none}
.lpx-box--hover .lpx-chip{background:rgba(37,99,235,.85)}
html.lpx-edit [data-sid]{cursor:pointer}
html.lpx-edit [data-edit]{cursor:text}
html.lpx-edit [data-edit]:hover{outline:1px dashed rgba(37,99,235,.7);outline-offset:3px}
[data-lpx-editing]{visibility:hidden!important}
.lpx-editor{position:absolute;z-index:2147483647;box-sizing:border-box;margin:0;text-transform:none;outline:2px solid #2563eb;outline-offset:3px;border-radius:2px;white-space:pre-wrap;overflow-wrap:break-word;cursor:text;pointer-events:auto}
`;

/**
 * Typography copied from the edited element so the overlay text sits exactly over it.
 * Not text-transform: the overlay shows (and innerText returns) the text exactly as stored — an
 * uppercase display style would otherwise save "TITRE" for "Titre".
 */
const COPY_PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-stretch",
  "font-variant",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-indent",
  "color",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
];

interface Editing {
  el: Element;
  editor: HTMLElement;
  sid: string;
  path: string;
  raw: string;
  done: boolean;
}

export function attachEditor(doc: Document, handlers: () => EditorHandlers): EditorHandle {
  const win = doc.defaultView as (Window & typeof globalThis) | null;
  if (!win) throw new Error("attachEditor: the frame has no window");
  const html = doc.documentElement;
  frames.add(doc);

  const style = doc.createElement("style");
  style.setAttribute("data-lp", "editor");
  style.textContent = EDITOR_CSS;
  doc.head.appendChild(style);

  const layer = doc.createElement("div");
  layer.className = "lpx-layer";
  layer.setAttribute("aria-hidden", "true");
  const makeBox = (kind: "hover" | "selected") => {
    const box = doc.createElement("div");
    box.className = `lpx-box lpx-box--${kind}`;
    const chip = doc.createElement("span");
    chip.className = "lpx-chip";
    box.appendChild(chip);
    layer.appendChild(box);
    return box;
  };
  const hoverBox = makeBox("hover");
  const selectedBox = makeBox("selected");
  html.appendChild(layer);

  let interactive = false;
  let hoverId: string | null = null;
  let selectedId: string | null = null;
  let editing: Editing | null = null;
  let raf = 0;

  const sectionOf = (target: EventTarget | null): HTMLElement | null => {
    const node = target as Node | null;
    const el = node && node.nodeType === 1 ? (node as Element) : (node?.parentElement ?? null);
    return (el?.closest("[data-sid]") as HTMLElement | null) ?? null;
  };
  const byId = (id: string) => doc.querySelector<HTMLElement>(`[data-sid="${win.CSS.escape(id)}"]`);

  const place = (box: HTMLElement, id: string | null) => {
    const el = id ? byId(id) : null;
    if (!el || !id || interactive) {
      box.removeAttribute("data-on");
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      box.removeAttribute("data-on");
      return;
    }
    box.style.top = `${r.top + win.scrollY}px`;
    box.style.left = `${r.left + win.scrollX}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
    const chip = box.firstElementChild as HTMLElement;
    const text = handlers().label(id);
    if (chip.textContent !== text) chip.textContent = text;
    box.setAttribute("data-on", "");
  };

  const measure = () => {
    raf = 0;
    place(selectedBox, selectedId);
    place(hoverBox, hoverId && hoverId !== selectedId ? hoverId : null);
  };
  const schedule = () => {
    if (!raf) raf = win.requestAnimationFrame(measure);
  };

  /* ---- inline text editing ---- */

  const backgroundOf = (el: Element): string => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = win.getComputedStyle(n).backgroundColor;
      if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
    }
    return "#ffffff";
  };

  const finish = (commit: boolean) => {
    const e = editing;
    if (!e || e.done) return;
    e.done = true;
    editing = null;
    const value = (e.editor.innerText ?? "").replace(/\n+$/, "");
    e.editor.remove();
    e.el.removeAttribute("data-lpx-editing");
    if (commit && value !== e.raw) handlers().editText(e.sid, e.path, value);
    schedule();
  };

  const startEdit = (el: HTMLElement, sid: string, path: string) => {
    finish(true);
    const raw = handlers().rawText(sid, path) ?? (el.innerText || "").trim();
    const cs = win.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const editor = doc.createElement("div");
    editor.className = "lpx-editor";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-multiline", "true");
    editor.spellcheck = true;
    editor.contentEditable = "plaintext-only";
    const plainOnly = editor.contentEditable === "plaintext-only";
    if (!plainOnly) editor.contentEditable = "true";
    for (const p of COPY_PROPS) editor.style.setProperty(p, cs.getPropertyValue(p));
    editor.style.background = backgroundOf(el);
    editor.style.top = `${r.top + win.scrollY}px`;
    editor.style.left = `${r.left + win.scrollX}px`;
    editor.style.width = `${Math.max(r.width, 40)}px`;
    editor.style.minHeight = `${Math.max(r.height, 20)}px`;
    editor.dir = (el.closest("[dir]")?.getAttribute("dir") as string | null) ?? html.dir ?? "auto";
    editor.textContent = raw;
    const e: Editing = { el, editor, sid, path, raw, done: false };
    editing = e;
    el.setAttribute("data-lpx-editing", "");
    html.appendChild(editor);

    editor.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish(false);
      } else if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        finish(true);
      }
    });
    editor.addEventListener("blur", () => finish(true));
    if (!plainOnly) {
      editor.addEventListener("paste", (ev) => {
        ev.preventDefault();
        const text = ev.clipboardData?.getData("text/plain") ?? "";
        const sel = win.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(doc.createTextNode(text));
        range.collapse(false);
      });
    }
    editor.focus();
    const sel = win.getSelection();
    if (sel) {
      const range = doc.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  /* ---- events ---- */

  const onMove = (ev: Event) => {
    if (interactive || editing) return;
    const id = sectionOf(ev.target)?.getAttribute("data-sid") ?? null;
    if (id !== hoverId) {
      hoverId = id;
      schedule();
    }
  };
  const onLeave = () => {
    if (hoverId === null) return;
    hoverId = null;
    schedule();
  };

  /** In-page anchors keep working; anything that would navigate the iframe away is blocked. */
  const blocksNavigation = (ev: Event): boolean => {
    const a = (ev.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a) return false;
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("#")) return false;
    ev.preventDefault();
    return true;
  };

  const onClick = (ev: MouseEvent) => {
    if ((ev.target as Element | null)?.closest?.(".lpx-editor")) return;
    if (interactive) {
      blocksNavigation(ev);
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const id = sectionOf(ev.target)?.getAttribute("data-sid");
    if (id) handlers().select(id);
    offerClicked(ev.target);
  };

  /**
   * Editable text under the pointer even when a decorative layer (art, sticker, texture) sits on top
   * of it, or when it is drawn with pointer-events: none (giant background words): hit-tested
   * geometrically inside the section, the smallest box wins.
   */
  const editableAt = (x: number, y: number, scope: Element | null): HTMLElement | null => {
    for (const n of doc.elementsFromPoint(x, y)) {
      const hit = n.closest("[data-edit]") as HTMLElement | null;
      if (hit) return hit;
    }
    let best: HTMLElement | null = null;
    let area = Number.POSITIVE_INFINITY;
    for (const el of (scope ?? doc).querySelectorAll<HTMLElement>("[data-edit]")) {
      const r = el.getBoundingClientRect();
      const a = r.width * r.height;
      if (a > 0 && a < area && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        best = el;
        area = a;
      }
    }
    return best;
  };

  const onDblClick = (ev: MouseEvent) => {
    if (interactive) return;
    const target = ev.target as Element | null;
    if (target?.closest?.(".lpx-editor")) return;
    const el = (target?.closest?.("[data-edit]") as HTMLElement | null) ?? editableAt(ev.clientX, ev.clientY, sectionOf(target));
    const sid = sectionOf(el)?.getAttribute("data-sid");
    const path = el?.getAttribute("data-edit");
    if (!el || !sid || !path) return;
    ev.preventDefault();
    ev.stopPropagation();
    startEdit(el, sid, path);
  };

  const swallow = (ev: Event) => {
    if (interactive) return;
    if ((ev.target as Element | null)?.closest?.(".lpx-editor")) return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  const noSubmit = (ev: Event) => ev.preventDefault();

  doc.addEventListener("mousemove", onMove, { passive: true });
  html.addEventListener("mouseleave", onLeave);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("dblclick", onDblClick, true);
  doc.addEventListener("submit", swallow, true);
  doc.addEventListener("submit", noSubmit);
  doc.addEventListener("auxclick", swallow, true);
  win.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("resize", schedule);
  const ro = new win.ResizeObserver(schedule);
  ro.observe(doc.body);

  const setInteractive = (on: boolean) => {
    interactive = on;
    html.classList.toggle("lpx-edit", !on);
    if (on) {
      finish(true);
      hoverId = null;
    }
    schedule();
  };
  setInteractive(false);

  return {
    setInteractive,
    setSelected(id, reveal = false) {
      selectedId = id;
      schedule();
      if (!reveal || !id) return;
      const el = byId(id);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > win.innerHeight) el.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    refresh: schedule,
    destroy() {
      frames.delete(doc);
      finish(false);
      if (raf) win.cancelAnimationFrame(raf);
      ro.disconnect();
      doc.removeEventListener("mousemove", onMove);
      html.removeEventListener("mouseleave", onLeave);
      doc.removeEventListener("click", onClick, true);
      doc.removeEventListener("dblclick", onDblClick, true);
      doc.removeEventListener("submit", swallow, true);
      doc.removeEventListener("submit", noSubmit);
      doc.removeEventListener("auxclick", swallow, true);
      win.removeEventListener("scroll", schedule);
      win.removeEventListener("resize", schedule);
      html.classList.remove("lpx-edit");
      layer.remove();
      style.remove();
    },
  };
}
