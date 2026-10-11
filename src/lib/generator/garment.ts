/**
 * Garment details for the showcase callouts (hotspots / exploded) of a garment without merchant
 * facts. The section's own defaults are written per product family, and the "style" family is a
 * jewelry one (secure clasp, 316L steel, gift box) — under a prayer abaya that reads as a broken
 * page. These lines describe what a buyer looks at on any garment (fabric, cut, finishing), plus the
 * details the merchant's own words name (lace, prayer wear, a girl's size). The section keeps its
 * `sample` flag: the merchant checks them against the real piece.
 *
 * Pins sit on the part each line names, never on the face: on the real figure when the photo's
 * subject analysis is known (head, hands, body box — see media/focus.ts), else on the usual spots of
 * a standing-figure shot. Pure & deterministic.
 */
import type { AssetRef, Locale, ProductCategory } from "@/lib/page/schema";
import { parseFocus, type AssetFocus, type Box } from "@/lib/media/focus";
import { keywordHits } from "./mood";
import type { SemanticItem } from "./overlay";

type Lang = "ar" | "fr" | "en";
type Line = Readonly<Record<Lang, readonly [label: string, text: string]>>;

const LACE = ["lace", "dentelle", "dentelles", "guipure", "دانتيل", "دانتال", "الدانتيل", "تخريم"];
const PRAYER = ["prayer", "prière", "priere", "salat", "salah", "isdal", "esdal", "صلاة", "الصلاة", "للصلاة", "إسدال", "اسدال"];
const KIDS = ["fille", "filles", "fillette", "girl", "girls", "enfant", "enfants", "kid", "kids", "bébé", "baby", "بنات", "للبنات", "طفلة", "أطفال", "اطفال", "للأطفال", "بنت"];

const LINES: Readonly<Record<"lace" | "fabric" | "prayer" | "cut" | "finish" | "kids", Line>> = {
  lace: {
    ar: ["الدانتيل", "دانتيل رقيق يزيّن القطعة بدون مبالغة."],
    fr: ["Dentelle", "Une dentelle fine qui habille la pièce sans la charger."],
    en: ["Lace", "Fine lace that dresses the piece without weighing it down."],
  },
  fabric: {
    ar: ["القماش", "ناعم عند اللمس، ينسدل بانسيابية ويُلبس طوال اليوم."],
    fr: ["Tissu", "Doux au toucher, il tombe avec fluidité et se porte toute la journée."],
    en: ["Fabric", "Soft to the touch, it drapes fluidly and wears all day."],
  },
  prayer: {
    ar: ["للصلاة", "واسعة وساترة، تترك حرية الحركة في الركوع والسجود."],
    fr: ["Pour la prière", "Ample et couvrante, elle laisse bouger librement à chaque mouvement."],
    en: ["Made for prayer", "Loose and covering, free to move through every position."],
  },
  cut: {
    ar: ["القصّة", "قصّة مدروسة تنسدل بشكل جميل وتترك حرية الحركة."],
    fr: ["Coupe", "Une coupe pensée pour bien tomber et laisser bouger."],
    en: ["Cut", "A cut designed to fall right and move with you."],
  },
  finish: {
    ar: ["التشطيب", "خياطة نظيفة وحواف متقنة تصمد غسلة بعد غسلة."],
    fr: ["Finitions", "Coutures nettes et ourlets soignés, faits pour durer lavage après lavage."],
    en: ["Finishing", "Clean seams and neat hems, made to last wash after wash."],
  },
  kids: {
    ar: ["للصغيرات", "خفيفة وسهلة اللبس، تلبسها الصغيرة بنفسها."],
    fr: ["Pour les petites", "Légère et facile à enfiler, elle s'habille toute seule."],
    en: ["For little ones", "Light and easy to slip on, no help needed."],
  },
};

/**
 * Pin spot of each detail on a standing figure (percent of the frame), placed on the part it talks
 * about and kept off the face and neck (nothing above 40 %): lace on the sleeve cuff, fabric on the
 * body under the veil, the loose cut on the wide sleeve, finishing low on the skirt toward the hem.
 */
const PINS: Readonly<Record<keyof typeof LINES, readonly [x: number, y: number]>> = {
  lace: [35, 68],
  fabric: [56, 49],
  prayer: [72, 56],
  cut: [72, 56],
  finish: [44, 90],
  kids: [60, 78],
};

/* ------------------------------------------------------------------ */
/* Pins on the real figure                                             */
/* ------------------------------------------------------------------ */

/** What the generator may know about a product photo (the upload's subject analysis, see media/focus.ts). */
export interface PhotoInfo {
  id: string;
  width: number;
  height: number;
  alpha?: boolean;
  /** AssetFocus JSON as stored at upload — validated here, never trusted */
  focus?: unknown;
}

/** One person in a photo: the head box, the hands that belong to it and its body column (0..1 of the image). */
interface Figure {
  head: Box;
  hands: Box[];
  body: Box;
}

const pct = (n: number) => Math.round(n * 1000) / 10;
/** a pin keeps clear of the photo's edges (the frame's own crop clamps again) */
const pin = (n: number) => Math.min(94, Math.max(6, pct(n)));
const midX = (b: Box) => b.x + b.w / 2;
const midY = (b: Box) => b.y + b.h / 2;

/** The people a person photo shows (one per head), each hand given to the nearest head above it. */
function figuresOf(f: AssetFocus): Figure[] {
  if (f.kind !== "person") return [];
  const heads = (f.keep ?? []).filter((k) => k.k === "head").map((k) => k.b);
  const hands = (f.keep ?? []).filter((k) => k.k === "hand").map((k) => k.b);
  const out: Figure[] = heads.map((head) => ({ head, hands: [], body: f.box }));
  for (const h of hands) {
    let best = -1;
    let bestD = Infinity;
    out.forEach((fig, i) => {
      if (midY(h) < fig.head.y + fig.head.h) return;
      const d = Math.abs(midX(h) - midX(fig.head));
      if (d < bestD) [best, bestD] = [i, d];
    });
    if (best >= 0) out[best]!.hands.push(h);
  }
  // several people: each one's column is centred on its own head (about 2.4 head widths wide)
  if (out.length > 1) {
    for (const fig of out) {
      const w = Math.min(f.box.w, fig.head.w * 2.4);
      const x = Math.max(f.box.x, Math.min(f.box.x + f.box.w - w, midX(fig.head) - w / 2));
      fig.body = { x, y: fig.head.y, w, h: f.box.y + f.box.h - fig.head.y };
    }
  }
  return out;
}

/** The figure the details are pinned on: the only one, else the largest head (the adult of a mother-and-child shot). */
const mainFigure = (figs: readonly Figure[]): Figure | null => [...figs].sort((a, b) => b.head.h * b.head.w - a.head.h * a.head.w)[0] ?? null;

type PinKey = keyof typeof LINES;

/**
 * Pin spots on the actual person (percent of the image): fabric on the chest just under the veil,
 * lace on the sleeve cuff beside the hands, the cut / prayer ease on the wide sleeve between chest
 * and hands, finishing low on the skirt, the little-ones line by the hands. Every pin sits below the
 * head box (never on the face). Null without a usable person analysis, or for a bust / close-up.
 */
function figurePins(focus: AssetFocus | null): Readonly<Record<PinKey, readonly [number, number]>> | null {
  if (!focus || focus.conf < 0.3) return null;
  const fig = mainFigure(figuresOf(focus));
  if (!fig) return null;
  const { head, body } = fig;
  const chin = head.y + head.h;
  const bottom = body.y + body.h;
  if (bottom - chin < 0.3) return null;
  const hand = fig.hands.length
    ? fig.hands.reduce((a, b) => {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
      })
    : null;
  const handTop = hand ? hand.y : chin + (bottom - chin) * 0.45;
  const handBottom = hand ? hand.y + hand.h : handTop + 0.08;
  const mid = midX(head);
  // the cuff opens beside the hands (image start side), the wide sleeve on the other side
  const cuffX = hand ? hand.x - Math.max(0.03, hand.w * 0.35) : mid - head.w * 0.55;
  const sleeve: readonly [number, number] = [pin(Math.min(body.x + body.w - 0.05, mid + head.w * 0.62)), pin((chin + handTop) / 2 + 0.06)];
  return {
    fabric: [pin(mid + head.w * 0.12), pin(chin + Math.max(0.06, (handTop - chin) * 0.5))],
    lace: [pin(cuffX), pin((handTop + handBottom) / 2)],
    prayer: sleeve,
    cut: sleeve,
    finish: [pin(mid - head.w * 0.2), pin(Math.min(bottom - 0.05, handBottom + (bottom - handBottom) * 0.45))],
    kids: [pin(hand ? hand.x + hand.w + 0.03 : mid + head.w * 0.3), pin(handBottom + 0.03)],
  };
}

/**
 * The product photo a garment's details are pinned on: the main photo, unless it shows several
 * people and another photo shows one (pins on a mother-and-daughter shot hover between the two).
 * `focus` is the chosen photo's analysis (null when unknown).
 */
export function garmentPhoto(images: readonly AssetRef[], photos: readonly PhotoInfo[] | undefined): { ref: AssetRef; focus: AssetFocus | null } | null {
  const main = images[0];
  if (!main) return null;
  const info = new Map((photos ?? []).map((p) => [p.id, p]));
  const focusOf = (ref: AssetRef): AssetFocus | null => {
    const p = info.get(ref.id);
    return p && !p.alpha ? parseFocus(p.focus) : null;
  };
  const people = (f: AssetFocus | null) => (f?.kind === "person" ? (f.keep ?? []).filter((k) => k.k === "head").length : 0);
  const mainFocus = focusOf(main);
  if (people(mainFocus) > 1) {
    const single = images.slice(1).find((ref) => people(focusOf(ref)) === 1 && figurePins(focusOf(ref)) !== null);
    if (single) return { ref: single, focus: focusOf(single) };
  }
  return { ref: main, focus: mainFocus };
}

/**
 * 3–4 detail callouts for a garment, in the page language: lace when the name says so, fabric, the
 * cut (or prayer wear), finishing, and a line for little ones when there is room. With the photo's
 * subject analysis the pins sit on the real figure; without it, on the usual standing-figure spots.
 */
export function garmentDetails(locale: Locale, category: ProductCategory, keywords: string, focus: AssetFocus | null = null): SemanticItem[] {
  const lang: Lang = locale === "ar" || locale === "fr" ? locale : "en";
  const lace = keywordHits(keywords, LACE).length > 0;
  const prayer = keywordHits(keywords, PRAYER).length > 0;
  const kids = category === "kids" || keywordHits(keywords, KIDS).length > 0;
  const keys: PinKey[] = [...(lace ? (["lace"] as const) : []), "fabric", prayer ? "prayer" : "cut", "finish"];
  if (keys.length < 4 && kids) keys.push("kids");
  const onFigure = figurePins(focus);
  return keys.slice(0, 4).map((k) => {
    const [label, text] = LINES[k][lang];
    const [x, y] = onFigure?.[k] ?? PINS[k];
    return { label, text, x, y };
  });
}

/**
 * The hero's giant background word for a modest / devotional product. The fashion copy's "ستايل",
 * "Style", "Mode" sits wrong behind a girl's prayer abaya: prayer wear gets serenity, other modest
 * wear elegance. (≤ 16 characters, the hero's field limit.)
 */
export function modestBigWord(locale: Locale, keywords: string): string {
  const lang: Lang = locale === "ar" || locale === "fr" ? locale : "en";
  const prayer = keywordHits(keywords, PRAYER).length > 0;
  const words: Record<Lang, readonly [prayer: string, modest: string]> = {
    ar: ["سكينة", "أناقة"],
    fr: ["Sérénité", "Élégance"],
    en: ["Serenity", "Grace"],
  };
  return words[lang][prayer ? 0 : 1];
}
