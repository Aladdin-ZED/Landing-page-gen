/**
 * Scroll reveals (DESIGN.md §6): flips `data-in` once on [data-reveal] elements entering the
 * viewport; CSS owns the animation. data-delay / data-stagger become the `--d` custom property,
 * written when the element is revealed.
 * [data-count-to] numbers roll up from 0 keeping the server-rendered digits & separators.
 *
 * Sign of life: once the observer is bound (or everything was revealed at once) the runtime sets
 * `html[data-rv]`; base.css then never runs its 2.5 s CSS failsafe (which would fade in every
 * element still waiting below the fold). Removed again on cleanup, so a page whose runtime was torn
 * down without a successor falls back to the failsafe instead of keeping content hidden.
 */
import type { Ctx } from "./core";
import { $$, clamp, flag, num } from "./core";
import { NUM_RUN, formatNum, numStyle } from "./numbers";

const SEL = "[data-reveal]";

/** Mark the runtime's reveals as bound: html[data-rv] (see the module doc). */
function alive(c: Ctx): void {
  const root = c.doc.documentElement;
  flag(root, "data-rv", true);
  c.add(() => flag(root, "data-rv", false));
}

/** Failsafe: everything visible (reduced motion, no IntersectionObserver, or a crash). */
export function revealAll(c: Ctx): void {
  for (const el of $$(c.doc, SEL)) flag(el, "data-in", true);
  alive(c);
}

/**
 * Roll a number up from 0 inside the first text node holding digits; restores the exact text at the end.
 * Cleanup restores only text the roll-up itself wrote, so a preview re-render that already replaced the
 * value (React updates the same text node) is never overwritten with the stale number.
 */
function count(c: Ctx, el: Element): void {
  const to = num(el.getAttribute("data-count-to"), NaN);
  if (!isFinite(to)) return;
  const dec = clamp(Math.floor(num(el.getAttribute("data-count-decimals"))), 0, 4);
  const walker = c.doc.createTreeWalker(el, 4 /* NodeFilter.SHOW_TEXT */);
  let node: Node | null = walker.nextNode();
  while (node && !NUM_RUN.test(node.nodeValue || "")) node = walker.nextNode();
  if (!node) return;
  const text = node.nodeValue || "";
  const m = NUM_RUN.exec(text)!;
  const style = numStyle(m[0], dec);
  const pre = text.slice(0, m.index);
  const post = text.slice(m.index + m[0].length);
  const target = node;
  const dur = 1400;
  let start = 0;
  let raf = 0;
  let wrote = "";
  const put = (s: string) => {
    target.nodeValue = wrote = s;
  };
  const step = (now: number) => {
    if (!start) start = now;
    const p = Math.min(1, (now - start) / dur);
    if (p >= 1) {
      put(text);
      raf = 0;
      return;
    }
    put(pre + formatNum(to * (1 - Math.pow(1 - p, 3)), dec, style) + post);
    raf = c.win.requestAnimationFrame(step);
  };
  put(pre + formatNum(0, dec, style) + post);
  raf = c.win.requestAnimationFrame(step);
  c.add(() => {
    if (raf) c.win.cancelAnimationFrame(raf);
    if (target.nodeValue === wrote) target.nodeValue = text;
  });
}

export function reveal(c: Ctx): void {
  const pending = $$(c.doc, SEL).filter((el) => !el.hasAttribute("data-in"));
  if (!pending.length) {
    alive(c);
    return;
  }
  const IO = c.win.IntersectionObserver;
  if (c.reduced || typeof IO !== "function") {
    revealAll(c);
    return;
  }
  const { win } = c;
  // Reveal once the element's top passes 92% of the viewport. Elements that entered but sit below
  // that line wait in `near` and are re-checked on scroll — and revealed when the page cannot
  // scroll any further (a footer line in the last pixels would otherwise stay hidden forever).
  const near = new Set<Element>();
  let raf = 0;
  // `--d` = data-delay + rank within this batch × the nearest [data-stagger]: items entering together
  // cascade, while an item scrolled into view on its own (stacked mobile lists) never waits for siblings.
  const show = (due: Element[]) => {
    const rank = new Map<Element, number>();
    for (const el of due) {
      near.delete(el);
      io.unobserve(el);
      let d = num(el.getAttribute("data-delay"));
      const box = el.parentElement && el.parentElement.closest("[data-stagger]");
      if (box) {
        const i = rank.get(box) || 0;
        rank.set(box, i + 1);
        d += i * num(box.getAttribute("data-stagger"));
      }
      if (d > 0) (el as HTMLElement).style.setProperty("--d", Math.round(d) + "ms");
      flag(el, "data-in", true);
      if (el.hasAttribute("data-count-to")) count(c, el);
    }
  };
  const check = () => {
    raf = 0;
    const vh = win.innerHeight;
    const atEnd = win.scrollY + vh >= c.doc.documentElement.scrollHeight - 2;
    const due: Element[] = [];
    near.forEach((el) => {
      if (atEnd || el.getBoundingClientRect().top < vh * 0.92) due.push(el);
    });
    show(due);
  };
  const onScroll = () => {
    if (near.size && !raf) raf = win.requestAnimationFrame(check);
  };
  const io = new IO((entries) => {
    const due: Element[] = [];
    for (const e of entries) {
      if (!e.isIntersecting) near.delete(e.target);
      else if (e.boundingClientRect.top < win.innerHeight * 0.92) due.push(e.target);
      else near.add(e.target);
    }
    show(due);
    onScroll();
  });
  for (const el of pending) io.observe(el);
  alive(c);
  c.on(win, "scroll", onScroll, { passive: true });
  c.on(win, "resize", onScroll, { passive: true });
  c.add(() => {
    io.disconnect();
    if (raf) win.cancelAnimationFrame(raf);
  });
}
