/**
 * Procedural vector shapes owned by the primitives: ornament glyphs (kicker dots, marquee
 * separators) and rating-star shapes per archetype. Computed once at module load — pure and
 * deterministic. Every shape is a clean, geometric vector (DESIGN.md v2): no hand-drawn wobble.
 */
import type { Archetype } from "@/lib/page/schema";
import { ARCHETYPE_DEFS } from "@/lib/theme/archetypes";
import { f, polygonPath, roundedPolygonPath, starPoints, translatePath, type Pt } from "./geometry";

/* ------------------------------------------------------------------ */
/* Ornament glyphs (16×16)                                             */
/* ------------------------------------------------------------------ */

/**
 * `dot`, `spark` and `diamond` are the theme's html[data-glyph] vocabulary; the rest are extra
 * clean glyphs a section may ask for explicitly (`<Ornament kind="star8" />` for a souk accent).
 */
export const ORNAMENT_KINDS = [
  "dot",
  "spark",
  "diamond",
  "asterisk",
  "star8",
  "bolt",
  "flower",
  "burst",
  "crosshair",
  "sprig",
  "square",
  "hex",
  "ring",
  "plus",
] as const;
export type OrnamentKind = (typeof ORNAMENT_KINDS)[number];

/**
 * The archetype's glyph — read from `glyph` in src/lib/theme/archetypes.ts (html[data-glyph]).
 * Archetypes without a glyph (`none`) get the dot here; CSS hides decorative ornaments under
 * html[data-glyph="none"] while explicit separators (marquee) keep a quiet dot.
 */
export const ORNAMENT_BY_ARCHETYPE: Readonly<Record<Archetype, OrnamentKind>> = Object.fromEntries(
  (Object.keys(ARCHETYPE_DEFS) as Archetype[]).map((a) => {
    const g = ARCHETYPE_DEFS[a].glyph;
    return [a, g === "none" ? "dot" : g];
  }),
) as Record<Archetype, OrnamentKind>;

export interface OrnamentShape {
  fill?: string;
  stroke?: string;
  /** stroke width in 16-unit space */
  sw?: number;
}

const circle16 = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0z`;

const hexPts: Pt[] = Array.from({ length: 6 }, (_, i) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return [8 + 6.6 * Math.cos(a), 8 + 6.6 * Math.sin(a)] as Pt;
});

/** Four-point sparkle with gently concave sides (the modern "spark", not a cartoon star). */
const SPARK = (() => {
  const c = 8;
  const r = 7.4;
  const k = 1.05; // pinch: how close the side curves pass to the center
  return (
    `M${c} ${f(c - r)}` +
    `C${f(c + k)} ${f(c - k)} ${f(c + k)} ${f(c - k)} ${f(c + r)} ${c}` +
    `C${f(c + k)} ${f(c + k)} ${f(c + k)} ${f(c + k)} ${c} ${f(c + r)}` +
    `C${f(c - k)} ${f(c + k)} ${f(c - k)} ${f(c + k)} ${f(c - r)} ${c}` +
    `C${f(c - k)} ${f(c - k)} ${f(c - k)} ${f(c - k)} ${c} ${f(c - r)}Z`
  );
})();

export const ORNAMENTS: Readonly<Record<OrnamentKind, OrnamentShape>> = {
  dot: { fill: circle16(8, 8, 3.4) },
  spark: { fill: SPARK },
  diamond: { fill: roundedPolygonPath([[8, 2.4], [13.6, 8], [8, 13.6], [2.4, 8]], () => 0.7) },
  asterisk: { stroke: "M8 2v12M2.8 5l10.4 6M13.2 5L2.8 11", sw: 1.7 },
  star8: { fill: roundedPolygonPath(starPoints(8, 8, 8, 7.4, 7.4 * 0.7654), () => 0.4) },
  bolt: { fill: "M9.3 .8L2.9 9.1h4.4l-.8 6.1 6.6-8.4H8.6l.7-6z" },
  flower: { fill: [circle16(8, 4.7, 3), circle16(11.3, 8, 3), circle16(8, 11.3, 3), circle16(4.7, 8, 3)].join("") },
  burst: { fill: roundedPolygonPath(starPoints(12, 8, 8, 7.6, 5.8), (i) => (i % 2 ? 0.25 : 0.5)) },
  crosshair: { stroke: `${circle16(8, 8, 4.4)}M8 .9v3.4M8 11.7v3.4M.9 8h3.4M11.7 8h3.4`, sw: 1.25 },
  sprig: { stroke: "M3.2 13.2C5.6 10 8.4 7.4 12.2 5.4M12.8 2.6C8.4 2.4 5.6 5.4 6 9.8c4.2.6 7.2-2.4 6.8-7.2z", sw: 1.3 },
  square: { fill: roundedPolygonPath([[3.6, 3.6], [12.4, 3.6], [12.4, 12.4], [3.6, 12.4]], () => 1.2) },
  hex: { stroke: polygonPath(hexPts) + circle16(8, 8, 2.2), sw: 1.4 },
  ring: { stroke: circle16(8, 8, 5.2), sw: 1.8 },
  plus: { stroke: "M8 2.5v11M2.5 8h11", sw: 2 },
};

/* ------------------------------------------------------------------ */
/* Rating stars (row of 5 in a 132×24 box)                             */
/* ------------------------------------------------------------------ */

/** `hand` is kept for saved data and renders like `rounded` (no hand-drawn shapes in v2). */
export type StarKind = "classic" | "rounded" | "fine" | "chunky" | "star8" | "hand" | "slant";

export const STAR_BY_ARCHETYPE: Readonly<Record<Archetype, StarKind>> = {
  maison: "fine",
  apothecary: "rounded",
  souk: "star8",
  playground: "chunky",
  kinetic: "slant",
  circuit: "classic",
  hearth: "rounded",
  bloom: "rounded",
  field: "rounded",
  editorial: "classic",
  garage: "slant",
};

export const STAR_GAP = 3;
export const STAR_ROW_W = 5 * 24 + 4 * STAR_GAP;

function singleStar(kind: StarKind): string {
  switch (kind) {
    case "classic":
      return roundedPolygonPath(starPoints(5, 12, 12.7, 11.3, 4.6), (i) => (i % 2 ? 0.3 : 0.7));
    case "rounded":
    case "hand":
      return roundedPolygonPath(starPoints(5, 12, 12.7, 11.6, 5.4), (i) => (i % 2 ? 1 : 2.3));
    case "fine":
      return roundedPolygonPath(starPoints(5, 12, 12.8, 11.8, 3.8), () => 0.2);
    case "chunky":
      return roundedPolygonPath(starPoints(5, 12, 12.8, 11.8, 6.3), (i) => (i % 2 ? 1.6 : 3.3));
    case "star8":
      return roundedPolygonPath(starPoints(8, 12, 12, 11.6, 11.6 * 0.7654), () => 0.7);
    case "slant": {
      const pts = starPoints(5, 12, 12.6, 11.3, 4.8).map(([x, y]) => [x - (y - 12.6) * 0.21, y] as Pt);
      return roundedPolygonPath(pts, () => 0.35);
    }
  }
}

/** Five stars side by side, as one path. */
export const STAR_ROWS: Readonly<Record<StarKind, string>> = Object.fromEntries(
  (["classic", "rounded", "fine", "chunky", "star8", "hand", "slant"] as const).map((k) => {
    const one = singleStar(k);
    return [k, Array.from({ length: 5 }, (_, i) => translatePath(one, i * (24 + STAR_GAP), 0)).join("")];
  }),
) as Record<StarKind, string>;
