/**
 * Swoosh underline geometry for *emphasis* (html[data-emphasis="swoosh"]).
 *
 * One clean, confident stroke runs under the whole emphasis: it starts on the baseline, sags a
 * hair, then sweeps up toward the end. Emphasis words are separate inline-blocks (so long emphasis
 * still wraps on phones), so the stroke is cut into one slice per word — each slice is the exact
 * piece of the shared curve that lies under its word, and the slices overlap across the spaces, so
 * on one line they read as a single uninterrupted line; after a wrap each line keeps its part.
 *
 * Units: 100 viewBox units = 1em. Each word's SVG box spans the word plus an overhang (OUTER at the
 * ends of the emphasis; between words a short LEAD before the word and a long TAIL after it, which
 * together bridge the space — mirrored in base.css .lp-em__deco) and is SWOOSH_H units (0.4em) tall,
 * placed just under the baseline. The lead is kept short because after a line wrap it is the part
 * that pokes out past the text edge. Widths are estimated from character counts;
 * preserveAspectRatio="none" stretches each slice to the real word box, so the estimate only bends
 * the proportions slightly — never the placement.
 */
import { smoothPath, type Pt } from "./geometry";

export const SWOOSH_H = 40;

/** average advance of a display-face character / of a word space (em) */
const CH_EM = 0.52;
const SPACE_EM = 0.27;
/** overhang of the stroke past the first/last letter of the emphasis (em) */
export const OUTER_EM = 0.04;
/** overhang into the spaces between words: before a word (lead) and after it (tail), in em */
export const LEAD_EM = 0.06;
export const TAIL_EM = 0.26;

export interface SwooshSlice {
  /** viewBox width of this word's SVG (100 units = 1em) */
  w: number;
  /** path data of this word's piece of the stroke */
  d: string;
  /** when this piece starts drawing / how long it draws, as fractions of the whole stroke */
  f0: number;
  f: number;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Slices of one swoosh for words of `chars[i]` characters. `rand` (seeded by the caller) varies the
 * rise and sag a little, so two emphasized words on a page never carry the identical stroke.
 */
export function swooshSlices(chars: readonly number[], rand: () => number): SwooshSlice[] {
  const n = chars.length;
  if (n === 0) return [];
  const widths = chars.map((c) => Math.max(1, c) * CH_EM);
  const total = widths.reduce((a, b) => a + b, 0) + (n - 1) * SPACE_EM;
  const base = 25 + (rand() - 0.5) * 2; // baseline of the stroke (units from the box top)
  const sag = 2.2 + rand() * 1.6; // gentle dip in the middle
  const rise = 11 + rand() * 3; // sweep up toward the end
  const y = (t: number) => base + sag * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) - rise * Math.max(0, t) ** 2.4;

  const span = total + 2 * OUTER_EM;
  const out: SwooshSlice[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    const from = x - (i === 0 ? OUTER_EM : LEAD_EM);
    const to = x + widths[i]! + (i === n - 1 ? OUTER_EM : TAIL_EM);
    const len = to - from;
    const steps = Math.max(3, Math.ceil(len / 0.32));
    const pts: Pt[] = [];
    for (let k = 0; k <= steps; k++) {
      const xe = from + (len * k) / steps;
      pts.push([(xe - from) * 100, y(xe / total)]);
    }
    out.push({
      w: Math.round(len * 100),
      d: smoothPath(pts),
      f0: r3((from + OUTER_EM) / span),
      f: r3(len / span),
    });
    x += widths[i]! + SPACE_EM;
  }
  return out;
}
