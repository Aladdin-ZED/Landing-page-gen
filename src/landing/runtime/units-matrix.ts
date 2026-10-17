/**
 * Matrix pickers (optional chunk "units-matrix", docs/OFFERS.md §D.1, §F.4): a merged option group
 * (color × size [× …]) shown either as one selector per dimension ("linked": controls
 * u.<k>.<gid>.<dimId>) or as one list of combinations ("combined": control u.<k>.<gid>, values = cell
 * keys). Values are stored as (partial) cell keys "d-col=o-noir|d-size=o-m".
 *
 * Linked: a value with no orderable combination (within the line's rules) is disabled — data-state
 * "out" (épuisé) or "none" (not made, "indisponible"). A value that clashes with the other dims'
 * current values is struck (data-state "conflict") but selectable: picking it switches the other dim
 * when exactly one of its values completes an orderable combination (data-msg-switched "{dim} changée :
 * {value}"), else clears it (data-msg-conflict "{value} n'existe pas en {other}, choisissez {dim}").
 * Focus stays on the tapped control. Locked dims show a static chip; allow lists hide the rest.
 */
import type { RuntimeOption } from "./config";
import type { Ctl } from "./core";
import { fill, flag, hide } from "./core";
import type { Combo, MatrixGroup } from "./money";
import { cellKey, optOf, parseKey, resolveCell } from "./money";
import type { Host, MatrixKit, Rules } from "./units";
import { allows } from "./units";

type Dim = MatrixGroup["dims"][number];

const ruleOf = (rules: Rules | undefined, g: MatrixGroup, d: Dim) => (rules ? rules[g.id + "." + d.id] : undefined);

/** Every combination allowed by the line's rules, with its state (0 in · 1 out · 2 not made). */
function combos(g: MatrixGroup, rules: Rules | undefined): { c: Combo; s: number }[] {
  let out: Combo[] = [{}];
  for (const d of g.dims) {
    const r = ruleOf(rules, g, d);
    const next: Combo[] = [];
    for (const c of out) for (const v of d.values) if (allows(r, v.id)) next.push({ ...c, [d.id]: v.id });
    out = next;
  }
  return out.map((c) => ({ c, s: (resolveCell(g, c) || { s: 2 }).s }));
}

/** A value without the line's locked dims: locks are the line's, not the shopper's — never remembered (another offer may allow others). */
function mine(g: MatrixGroup, rules: Rules | undefined, c: Combo): string {
  const out: Combo = {};
  for (const d of g.dims) if (c[d.id] && !(ruleOf(rules, g, d) || {}).lock) out[d.id] = c[d.id]!;
  return cellKey(out);
}

/** orderable combinations matching every given value */
const fits = (list: { c: Combo; s: number }[], want: Combo) => list.filter((x) => x.s === 0 && Object.keys(want).every((k) => !want[k] || x.c[k] === want[k]));

export function matrixKit(): MatrixKit {
  return {
    init(g, rules, swatch) {
      const all = combos(g, rules);
      const combo: Combo = {};
      for (const d of g.dims) {
        const r = ruleOf(rules, g, d);
        if (r && r.lock) combo[d.id] = r.lock;
      }
      for (const d of g.dims) {
        if (combo[d.id]) continue;
        const r = ruleOf(rules, g, d);
        const ok = (id: string) => fits(all, { ...combo, [d.id]: id }).length > 0;
        const ids = d.values.map((v) => v.id).filter(ok);
        if (r && r.preset && ids.indexOf(r.preset) >= 0) combo[d.id] = r.preset;
        else if (ids.length === 1 || (ids.length && swatch(d.id))) combo[d.id] = ids[0]!;
      }
      return mine(g, rules, combo);
    },

    pick(g, rules, prev, name, base, value, msg) {
      if (name === base) return { v: value };
      const dimId = name.slice(base.length + 1);
      const dim = g.dims.find((d) => d.id === dimId);
      if (!dim) return { v: prev };
      const all = combos(g, rules);
      const combo: Combo = parseKey(prev) || {};
      const old = { ...combo };
      combo[dimId] = value;
      for (const d of g.dims) {
        const r = ruleOf(rules, g, d);
        if (r && r.lock) combo[d.id] = r.lock;
      }
      if (fits(all, combo).length) return { v: mine(g, rules, combo) };
      // the others that clash with the new value (pairwise), else all of them
      const others = g.dims.filter((d) => d.id !== dimId && combo[d.id] && !(ruleOf(rules, g, d) || {}).lock);
      let clash = others.filter((d) => !fits(all, { [dimId]: value, [d.id]: combo[d.id]! }).length);
      if (!clash.length) clash = others;
      const label = (d: Dim, id: string | undefined) => (optOf(d.values, id) || ({ label: "" } as RuntimeOption)).label;
      let note = "";
      for (const d of clash) delete combo[d.id];
      for (const d of clash) {
        const cands = d.values.filter((v) => fits(all, { ...combo, [d.id]: v.id }).length).map((v) => v.id);
        if (cands.length === 1) {
          combo[d.id] = cands[0]!;
          note = fill(msg("switched"), { dim: d.name, value: label(d, cands[0]) });
        } else note = fill(msg("conflict"), { value: label(dim, value), other: label(d, old[d.id]), dim: d.name });
      }
      return { v: mine(g, rules, combo), note };
    },

    sync(h: Host, root, g, base, rules, value, off) {
      const all = combos(g, rules);
      const combo: Combo = parseKey(value) || {};
      const words = { out: h.t("out", ""), none: h.t("none", "") };
      /** data-soldout (épuisé) · data-none (not made) · data-conflict (struck, selectable) + the strike mark */
      const state = (wrap: Element, s: string) => {
        flag(wrap, "data-soldout", s === "out");
        flag(wrap, "data-none", s === "none");
        flag(wrap, "data-conflict", s === "conflict");
        const face = wrap.querySelector(".lp-vo__face");
        const x = face && face.querySelector(".lp-vo__x");
        if (face && s && !x) face.appendChild(h.c.doc.createElement("span")).className = "lp-vo__x";
        else if (x && !s) x.parentNode!.removeChild(x);
        const w = wrap.querySelector("[data-lp-state]");
        if (w) w.textContent = s === "out" ? words.out : s === "none" ? words.none : "";
      };
      const combined = h.ctl(root, base);
      if (combined.length) {
        // one list of combinations: rules hide the others, out ones disabled
        for (const el of combined) {
          const opts: (HTMLOptionElement | Ctl)[] = el.tagName === "SELECT" ? (Array.prototype.slice.call((el as HTMLSelectElement).options) as HTMLOptionElement[]) : [el];
          for (const o of opts) {
            if (!o.value) continue;
            const c = parseKey(o.value) || {};
            const ok = g.dims.every((d) => allows(ruleOf(rules, g, d), c[d.id] || ""));
            const s = (resolveCell(g, c) || { s: 2 }).s;
            const wrap = o.tagName === "OPTION" ? o : o.closest("label") || o;
            hide(wrap, !ok || s === 2);
            (o as HTMLInputElement).disabled = off || !ok || s > 0;
            state(wrap, s === 1 ? "out" : "");
            if (o.tagName !== "OPTION" && o.tagName !== "SELECT") (o as HTMLInputElement).checked = !!value && o.value === value;
          }
          if (el.tagName === "SELECT") {
            el.disabled = off;
            if (el.value !== value) el.value = value;
          }
        }
        const fs = combined[0]!.closest("[data-field]") || combined[0]!.closest("fieldset");
        if (fs)
          for (const d of g.dims) {
            const r = ruleOf(rules, g, d);
            const v = r && r.lock ? optOf(d.values, r.lock) : undefined;
            h.chip(fs, g.id + "." + d.id, v ? d.name : null, v ? v.label : "");
          }
        return;
      }
      for (const d of g.dims) {
        const r = ruleOf(rules, g, d);
        const els = h.ctl(root, base + "." + d.id);
        if (!els.length) continue;
        const fs = els[0]!.closest("[data-dim]") || els[0]!.closest("fieldset");
        const lock = r && r.lock ? optOf(d.values, r.lock) : undefined;
        const vv = fs && fs.querySelector("legend [data-lp-vval]");
        if (vv) vv.textContent = (optOf(d.values, combo[d.id]) || { label: "" }).label;
        if (fs) {
          hide(fs, !!lock);
          const src = lock && els.find((x) => x.value === lock.id);
          h.chip(fs, g.id + "." + d.id, lock ? d.name : null, lock ? lock.label : "", src ? src.getAttribute("data-sw") : null);
        }
        // the other dims' current values (locks included)
        const others: Combo = {};
        for (const x of g.dims) if (x.id !== d.id && combo[x.id]) others[x.id] = combo[x.id]!;
        const opts: (HTMLOptionElement | Ctl)[] = [];
        for (const el of els) {
          if (el.tagName === "SELECT") {
            opts.push(...(Array.prototype.slice.call((el as HTMLSelectElement).options) as HTMLOptionElement[]));
            el.disabled = off || !!lock;
            if (el.value !== (combo[d.id] || "")) el.value = combo[d.id] || "";
          } else opts.push(el);
        }
        for (const o of opts) {
          if (!o.value) continue;
          const ok = allows(r, o.value);
          const any = all.filter((x) => x.c[d.id] === o.value);
          const s = any.some((x) => x.s === 0) ? "" : any.some((x) => x.s === 1) ? "out" : "none";
          const clash = !s && !fits(all, { ...others, [d.id]: o.value }).length;
          const wrap = o.tagName === "OPTION" ? o : o.closest("label") || o;
          hide(wrap, !ok);
          (o as HTMLInputElement).disabled = (o.tagName !== "OPTION" && off) || !!lock || !ok || !!s;
          state(wrap, s || (clash ? "conflict" : ""));
          if (o.tagName !== "OPTION") (o as HTMLInputElement).checked = combo[d.id] === o.value;
        }
      }
    },
  };
}
