/**
 * Typed fields (optional chunk "units-fields", docs/OFFERS.md §D.4): a name to print, an engraving, a
 * number. The client mirrors the server's checks for instant errors (src/lib/page/options.ts
 * checkField — the same function, bundled into this chunk): cleaning (NFC, controls / bidi /
 * zero-width removed, whitespace collapsed), Eastern Arabic / Persian digits folded for digits and
 * numbers, "<" ">" refused, length in code points (never truncated), charsets, number range.
 * A live counter "0/12" in the field's [data-lp-count].
 */
import { checkField, cleanText, codePoints } from "../../lib/page/options";
import type { Ctl } from "./core";
import type { Code, FieldsKit } from "./units";

export function fieldsKit(): FieldsKit {
  return {
    clean: cleanText,
    check(g, v): Code {
      const r = checkField(g, v);
      return r.ok ? "" : r.error;
    },
    sync(root, name, g, value, off) {
      const els = /^[\w.@-]+$/.test(name) ? (Array.prototype.slice.call(root.querySelectorAll('[name="' + name + '"]')) as Ctl[]) : [];
      for (const el of els) {
        el.disabled = off;
        // never rewrite what the shopper is typing (caret, IME composition)
        if (el.value !== value && el.ownerDocument.activeElement !== el) el.value = value;
        const f = el.closest("[data-field]") || el.parentElement;
        const n = f && f.querySelector("[data-lp-count]");
        if (n) {
          const used = codePoints(cleanText(el.value));
          const t = n.querySelector("bdi") || n;
          if (!n.hasAttribute("data-max")) n.setAttribute("data-max", (t.textContent || "").split("/")[1] || String(g.maxLength));
          t.textContent = used + "/" + n.getAttribute("data-max");
          if (used > g.maxLength) n.setAttribute("data-over", "");
          else n.removeAttribute("data-over");
        }
      }
    },
  };
}
