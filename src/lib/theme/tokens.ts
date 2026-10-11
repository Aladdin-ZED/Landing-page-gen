/**
 * ThemeSpec + locale → CSS custom properties (docs/DESIGN.md §2) + [data-bg] section maps + <html>
 * attributes (§2.5). Every interpolated value is a validated enum, a computed "#rrggbb", a number, or a
 * constant from this module / the font manifest — no user text ever reaches the CSS.
 */
import { dirOf, Locale, SECTION_BGS, ThemeSpec, type Divider, type SectionBg } from "@/lib/page/schema";
import {
  ARCHETYPE_DEFS,
  findPairing,
  SPRINGS,
  EASE,
  type ArchetypeDef,
  type FontPairing,
  type RadiusDef,
  type RadiusKind,
  type ShadowKind,
  type SpringKind,
  type SurfacesKind,
  type TextureKind,
} from "./archetypes";
import { auroraGeometry, auroraHues, sectionAurora, sectionDepth, sectionGlass, sectionStage } from "./depth";
import { accentRole, arabicLineHeights, fontData, fontStack, hasItalic, isKnownFont, nearestWeight } from "./fonts";
import { buildPalette, type Palette, type SectionColors } from "./palette";
import { textureUrl } from "./textures";
import type { BuiltTheme } from "./types";

/* ------------------------------------------------------------------ */
/* Presets for spec overrides                                          */
/* ------------------------------------------------------------------ */

/**
 * A call to action is never a square slab (the owner's "red rectangle CTAs"): button corners are at
 * least 12px, about a quarter of the button's height, in every archetype and preset — "none" keeps
 * crisp cards and media but not a boxy CTA. 999 = pill.
 */
const BTN_RADIUS_MIN_PX = 12;
/** Backdrop saturation of frosted glass: beyond 1.3 a cream or blush page behind a chip turns peach. */
const GLASS_SATURATE_MAX = 1.3;

/** Admin radius overrides — generous, continuous scales (l/xl/media/panel shrink fluidly on phones). */
const RADIUS_PRESETS: Record<RadiusKind, RadiusDef> = {
  none: { kind: "none", scale: [0, 0, 0, 0, 0], btn: BTN_RADIUS_MIN_PX, media: 0, panel: 0 },
  subtle: { kind: "subtle", scale: [4, 6, 10, 14, 18], btn: BTN_RADIUS_MIN_PX, media: 16, panel: 24 },
  soft: { kind: "soft", scale: [8, 12, 16, 22, 28], btn: 14, media: 24, panel: 32 },
  round: { kind: "round", scale: [12, 18, 24, 32, 40], btn: 999, media: 32, panel: 44 },
};

/** Grain is a finish, not a material: never above 3% (DESIGN.md §1.1). */
const GRAIN_MAX = 0.03;
const GRAIN_DEFAULT = 0.022;

/** Damped-spring easing sampled into CSS linear() (normalized so it settles exactly at 1). */
function springEasing(kind: SpringKind): string {
  const z = SPRINGS[kind];
  const settle = z >= 1 ? 8.5 : -Math.log(0.003) / z;
  const wd = z < 1 ? Math.sqrt(1 - z * z) : 0;
  const x = (t: number) =>
    z >= 1 ? 1 - Math.exp(-t) * (1 + t) : 1 - Math.exp(-z * t) * (Math.cos(wd * t) + (z / wd) * Math.sin(wd * t));
  const n = z >= 1 ? 20 : 40;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) pts.push(i === n ? "1" : num(x((i / n) * settle), 3));
  return `linear(${pts.join(",")})`;
}

const SPRING_EASINGS: Record<SpringKind, string> = {
  gentle: springEasing("gentle"),
  soft: springEasing("soft"),
  bouncy: springEasing("bouncy"),
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function num(v: number, digits = 4): string {
  const s = v.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}
/** Always a <length> ("0px", never a bare 0): radius and spacing tokens feed max(), min() and calc(). */
const px = (v: number) => `${num(v, 2)}px`;
const rem = (pxv: number) => `${num(pxv / 16)}rem`;
const ms = (v: number) => `${Math.round(v)}ms`;

const V_MIN = 360;
const V_MAX = 1280;

/** clamp() that grows linearly from `lo` px at 360px to `hi` px at 1280px viewports. */
function fluidPx(lo: number, hi: number): string {
  if (lo === hi) return px(hi);
  const slope = (hi - lo) / (V_MAX - V_MIN);
  const intercept = lo - slope * V_MIN;
  return `clamp(${px(lo)},${px(intercept)} + ${num(slope * 100, 3)}vw,${px(hi)})`;
}

/** Large radii relax on phones (a 40px corner on a 340px card reads bubbly): 75% at 360px. */
const fluidRadius = (v: number) => (v >= 16 && v < 999 ? fluidPx(Math.round(v * 0.75), v) : px(v));

/** Fluid type scale steps −1…6 between 360px and 1280px viewports. */
function typeScale(ratio: readonly [number, number]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = -1; i <= 6; i++) {
    const a = 16 * ratio[0] ** i;
    const b = 18 * ratio[1] ** i;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const slope = (b - a) / (V_MAX - V_MIN);
    const intercept = a - slope * V_MIN;
    const vw = slope * 100;
    out[`lp-step-${i}`] = `clamp(${rem(lo)},${rem(intercept)} ${vw < 0 ? "-" : "+"} ${num(Math.abs(vw))}vw,${rem(hi)})`;
  }
  return out;
}

const SPACE: Record<ArchetypeDef["density"], string> = {
  airy: "clamp(5rem,3.1rem + 8vw,10rem)",
  balanced: "clamp(4.25rem,2.8rem + 6.2vw,8rem)",
  dense: "clamp(3.5rem,2.4rem + 4.8vw,6.5rem)",
};

interface ResolvedFonts {
  pairing: FontPairing;
  display: string;
  body: string;
  accent: string | null;
  displayAr: string;
  bodyAr: string;
  displayWeight: number;
  displayWeightAr: number;
}

function resolveFonts(spec: ThemeSpec, d: ArchetypeDef): ResolvedFonts {
  const pairing = findPairing(d, spec.fonts.display, spec.fonts.body) ?? d.fonts[0]!;
  const known = (id: string | undefined, fallback: string) => (id && isKnownFont(id) ? id : fallback);
  // the Arabic slots must actually cover Arabic — a Latin-only face there would silently hand every
  // Arabic headline to the system font
  const arabic = (id: string, fallback: string) => (fontData(id)?.scripts.includes("arabic") ? id : fallback);
  const display = known(spec.fonts.display, pairing.display);
  const displayAr = arabic(spec.fonts.displayAr, pairing.displayAr);
  return {
    pairing,
    display,
    body: known(spec.fonts.body, pairing.body),
    accent: spec.fonts.accent === undefined ? (pairing.accent ?? null) : isKnownFont(spec.fonts.accent) ? spec.fonts.accent : (pairing.accent ?? null),
    displayAr,
    bodyAr: arabic(spec.fonts.bodyAr, pairing.bodyAr),
    displayWeight: nearestWeight(display, pairing.displayWeight),
    displayWeightAr: nearestWeight(displayAr, pairing.displayWeightAr),
  };
}

const ACCENT_WEIGHT = { mono: 500, serif: 400, sans: 500 } as const;

function sectionVars(sec: SectionColors): Record<string, string> {
  return {
    "sec-bg": sec.bg,
    "sec-ink": sec.ink,
    "sec-ink-soft": sec.inkSoft,
    "sec-line": sec.line,
    "sec-line-strong": sec.lineStrong,
    "sec-accent": sec.accent,
    "sec-accent-ink": sec.accentInk,
    "sec-card": sec.card,
    "sec-card-ink": sec.cardInk,
    "sec-chip": sec.chip,
    "sec-chip-ink": sec.chipInk,
    "sec-highlight": sec.highlight,
    "sec-success": sec.success,
    "sec-danger": sec.danger,
    "sec-warn": sec.warn,
  };
}

function paletteVars(p: Palette): Record<string, string> {
  const v: Record<string, string> = {
    "lp-bg": p.bg,
    "lp-surface": p.surface,
    "lp-surface-2": p.surface2,
    "lp-soft": p.soft,
    "lp-ink": p.ink,
    "lp-ink-soft": p.inkSoft,
    "lp-ink-mute": p.inkMute,
    "lp-line": p.line,
    "lp-line-strong": p.lineStrong,
    "lp-accent": p.accent,
    "lp-accent-ink": p.accentInk,
    "lp-accent-soft": p.accentSoft,
    "lp-accent-strong": p.accentStrong,
    "lp-pop": p.pop,
    "lp-pop-ink": p.popInk,
    "lp-dark": p.dark,
    "lp-dark-ink": p.darkInk,
    "lp-success": p.success,
    "lp-danger": p.danger,
    "lp-warn": p.warn,
  };
  for (const [step, hex] of Object.entries(p.a)) v[`lp-a-${step}`] = hex;
  for (const [step, hex] of Object.entries(p.n)) v[`lp-n-${step}`] = hex;
  return v;
}

const decls = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");

/* ------------------------------------------------------------------ */
/* buildTheme                                                          */
/* ------------------------------------------------------------------ */

export function buildThemeTokens(input: ThemeSpec, localeInput: Locale): BuiltTheme {
  const parsed = ThemeSpec.safeParse(input);
  if (!parsed.success) throw new Error(`invalid theme spec: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const spec = parsed.data;
  const locale = Locale.parse(localeInput);
  const ar = locale === "ar";
  const rtl = dirOf(locale) === "rtl";
  const d = ARCHETYPE_DEFS[spec.archetype];

  /* fonts ---------------------------------------------------------------- */
  const f = resolveFonts(spec, d);
  const role = f.accent ? accentRole(f.accent) : null;
  // Arabic companion of the Latin accent: the Arabic display face for serif flourishes, the Arabic
  // body face for mono labels / spec numbers
  const accentAr = role === "serif" ? f.displayAr : f.bodyAr;
  // Arabic pages set the accent / label stack Arabic face first, so the weight is the one that face
  // ships (no faux bold): regular beside a serif flourish, medium for labels (mono role)
  const accentWeight = !role ? 400 : ar ? nearestWeight(accentAr, role === "mono" ? ACCENT_WEIGHT.mono : 400) : ACCENT_WEIGHT[role];
  const bodyStrong = (id: string) => nearestWeight(id, 700);

  const fontIds: string[] = [];
  const fontWeights: number[] = [];
  const addFont = (id: string | null, w: number) => {
    if (!id || fontIds.includes(id)) return;
    fontIds.push(id);
    fontWeights.push(w);
  };
  if (ar) {
    addFont(f.displayAr, f.displayWeightAr);
    addFont(f.bodyAr, 400);
    if (f.accent) {
      addFont(accentAr, accentWeight);
      // the Latin accent only backs up glyphs the Arabic face lacks
      addFont(f.accent, nearestWeight(f.accent, accentWeight));
    }
  } else {
    addFont(f.display, f.displayWeight);
    addFont(f.body, 400);
    addFont(f.accent, accentWeight);
  }

  // *emphasis* in italic: the display face's own italic first (Bodoni, Fraunces, Instrument Serif),
  // else a serif accent's italic inside a grotesk headline; no italic available → accent color
  const italicFont = !ar ? ([f.display, f.accent].find((id) => id && hasItalic(id)) ?? null) : null;
  let emphasis: string = d.emphasis;
  if (emphasis === "italic" && !italicFont) emphasis = "color";

  const bodyStack = ar ? fontStack(f.bodyAr) : fontStack(f.body);
  // Arabic pages: the Arabic companion leads the stack. A Latin face first would also own U+0020
  // (Latin unicode-range), so every space between two Arabic words would take its advance — a mono's
  // wide space splits labels into islands. The Latin accent stays behind it as a last resort.
  const accentStack = f.accent ? (ar ? fontStack(accentAr, [f.accent]) : fontStack(f.accent, [f.body])) : bodyStack;
  const lh = ar ? arabicLineHeights(f.displayAr, d.display.lineHeight) : null;
  const typeVars: Record<string, string> = {
    "lp-font-display": ar ? fontStack(f.displayAr) : fontStack(f.display),
    "lp-font-body": bodyStack,
    "lp-font-accent": accentStack,
    // small labels / captions / spec numbers: the mono accent when there is one, else the body face
    "lp-font-label": role === "mono" ? accentStack : bodyStack,
    "lp-font-emphasis": ar ? fontStack(f.displayAr) : italicFont ? fontStack(italicFont) : fontStack(f.display),
    "lp-emphasis-style": italicFont && emphasis === "italic" ? "italic" : "normal",
    "lp-display-weight": String(ar ? f.displayWeightAr : f.displayWeight),
    "lp-display-tracking": ar ? "0" : `${num(d.display.tracking, 3)}em`,
    "lp-display-case": ar ? "none" : d.display.case,
    "lp-display-lh": num(ar ? lh!.display : d.display.lineHeight, 2),
    "lp-body-lh": num(ar ? Math.max(lh!.body, d.bodyLineHeight + 0.15) : d.bodyLineHeight, 2),
    "lp-body-weight": "400",
    "lp-strong-weight": String(bodyStrong(ar ? f.bodyAr : f.body)),
    // in-between weights for quiet hierarchy (labels, prices, nav) — the nearest the body face ships,
    // so Arabic never gets a faux bold
    "lp-medium-weight": String(nearestWeight(ar ? f.bodyAr : f.body, 500)),
    "lp-semibold-weight": String(nearestWeight(ar ? f.bodyAr : f.body, 600)),
    "lp-accent-weight": String(accentWeight),
    "lp-label-case": ar ? "none" : d.labels.case,
    "lp-label-tracking": ar ? "0" : `${num(d.labels.tracking, 3)}em`,
    ...typeScale(d.typeRatio),
  };

  /* color ---------------------------------------------------------------- */
  const palette = buildPalette(
    { accent: spec.palette.accent, pop: spec.palette.pop, neutralHue: spec.palette.neutralHue, base: spec.palette.base, harmony: spec.palette.harmony },
    { lineStrength: d.lineStrength },
  );
  // a quiet page (calm, modest, baby products) never gets the highlighter-block emphasis (the owner's
  // rejected "yellow marker"): the display face's italic where there is one, else the accent color
  if (palette.quiet && emphasis === "highlight") {
    emphasis = italicFont ? "italic" : "color";
    if (emphasis === "italic") typeVars["lp-emphasis-style"] = "italic";
  }

  /* shape, depth, material, motion --------------------------------------- */
  const radius = spec.radius === "archetype" ? d.radius : RADIUS_PRESETS[spec.radius];
  const shadowKind: ShadowKind = spec.shadow === "archetype" ? d.shadow : spec.shadow;
  const textureKind: TextureKind = spec.texture === "archetype" ? d.texture.kind : spec.texture;
  const surfaces: SurfacesKind = spec.surfaces === "archetype" ? d.surfaces.kind : spec.surfaces;
  const grainBase = textureKind === "none" ? 0 : d.texture.kind === "grain" ? d.texture.opacity : GRAIN_DEFAULT;
  const textureOpacity = Math.min(GRAIN_MAX, grainBase * (palette.scheme === "dark" ? 1.2 : 1));
  const motion = spec.motion;
  const off = motion === "off";
  const durMul = motion === "calm" ? 1.25 : 1;
  const dividers: Divider[] = spec.dividers.length > 0 ? [...spec.dividers] : [...d.dividers];
  const panels = surfaces === "panels";

  const shapeVars: Record<string, string> = {
    "lp-radius-xs": px(radius.scale[0]),
    "lp-radius-s": px(radius.scale[1]),
    "lp-radius-m": px(radius.scale[2]),
    "lp-radius-l": fluidRadius(radius.scale[3]),
    "lp-radius-xl": fluidRadius(radius.scale[4]),
    "lp-radius-btn": px(radius.btn >= 999 ? 999 : Math.max(BTN_RADIUS_MIN_PX, radius.btn)),
    "lp-radius-media": fluidRadius(radius.media),
    "lp-radius-pill": "999px",
    // floating section panels (data-surfaces="panels"): inset from the viewport, rounded, spaced
    "lp-radius-panel": panels ? fluidRadius(radius.panel) : "0px",
    "lp-panel-inset": panels ? fluidPx(8, 20) : "0px",
    "lp-panel-gap": panels ? fluidPx(8, 20) : "0px",
    "lp-border-w": px(d.borderWidth),
    "lp-border-style": "solid",
  };

  const motionVars: Record<string, string> = {
    "lp-ease": off ? "linear" : d.motion.ease,
    "lp-ease-out": off ? "linear" : d.motion.easeOut,
    "lp-ease-spring": off ? "linear" : SPRING_EASINGS[motion === "calm" ? "gentle" : d.motion.spring],
    // the shared smooth vocabulary (DESIGN.md §6): decelerations + a springy pop for badges/checks
    "lp-ease-in-out": off ? "linear" : EASE.inOut,
    "lp-ease-expo-out": off ? "linear" : EASE.expoOut,
    "lp-ease-quint-out": off ? "linear" : EASE.quintOut,
    "lp-ease-pop": off ? "linear" : SPRING_EASINGS[motion === "calm" ? "soft" : "bouncy"],
    "lp-dur-s": ms(off ? 0 : d.motion.dur[0] * durMul),
    "lp-dur-m": ms(off ? 0 : d.motion.dur[1] * durMul),
    "lp-dur-l": ms(off ? 0 : d.motion.dur[2] * durMul),
    "lp-stagger": ms(off ? 0 : d.motion.stagger * (motion === "calm" ? 1.2 : 1)),
    "lp-reveal-distance": px(off ? 0 : Math.round(d.motion.distance * (motion === "calm" ? 0.6 : 1))),
  };

  const spaceVars: Record<string, string> = {
    "lp-space-section": SPACE[d.density],
    "lp-container": rem(d.container),
    "lp-gutter": "clamp(1rem,0.55rem + 2vw,2rem)",
  };

  const materialVars: Record<string, string> = {
    "lp-glass-blur": px(d.glass.blur),
    "lp-glass-filter": `blur(${px(d.glass.blur)}) saturate(${Math.round(Math.min(d.glass.saturate, GLASS_SATURATE_MAX) * 100)}%)`,
    "lp-grain": textureUrl(textureKind, palette.ink, spec.seed),
    "lp-grain-opacity": num(textureOpacity, 3),
    "lp-tilt-min": `${num(d.tilt[0], 2)}deg`,
    "lp-tilt-max": `${num(d.tilt[1], 2)}deg`,
    "lp-ornament": num(spec.ornament, 2),
  };

  /* sections ------------------------------------------------------------- */
  const hues = auroraHues(palette.accent, palette.pop, palette.neutralHue);
  const geo = auroraGeometry(spec.seed, rtl);
  const depthVars = (sec: SectionColors): Record<string, string> => {
    const dp = sectionDepth(shadowKind, sec, palette.accent);
    const gl = sectionGlass(sec, d.glass);
    const au = sectionAurora(sec, hues, geo);
    const st = sectionStage(sec, palette.accent);
    return {
      "lp-shadow-s": dp.shadowS,
      "lp-shadow-m": dp.shadowM,
      "lp-shadow-l": dp.shadowL,
      "lp-shadow-glow": dp.shadowGlow,
      "lp-highlight": dp.highlight,
      "lp-highlight-accent": dp.highlightAccent,
      "lp-shadow-product": dp.product,
      "lp-shadow-product-filter": dp.productFilter,
      "sec-glass": gl.fill,
      "sec-glass-ink": gl.ink,
      "sec-glass-border": gl.border,
      "sec-glass-solid": gl.solid,
      "lp-aurora-1": au.lights[0],
      "lp-aurora-2": au.lights[1],
      "lp-aurora-3": au.lights[2],
      "lp-aurora": au.field,
      "lp-stage-glow": au.stage,
      // product stage tint, one clean hue per block (outranks the color-mix fallbacks of base.css,
      // which sit in :where() at zero specificity)
      "mx-stage": st.stage,
      "mx-stage-hi": st.hi,
      "mx-stage-lo": st.lo,
    };
  };
  const baseSec = palette.sections.base;
  const rootVars: Record<string, string> = {
    ...paletteVars(palette),
    ...typeVars,
    ...shapeVars,
    ...motionVars,
    ...spaceVars,
    ...materialVars,
    ...sectionVars(baseSec),
    ...depthVars(baseSec),
  };

  const blocks: string[] = [`:root{color-scheme:${palette.scheme};accent-color:${baseSec.accent};${decls(rootVars)}}`];
  const tokens: Record<string, string> = { ...rootVars };
  for (const bg of SECTION_BGS as readonly SectionBg[]) {
    const sec = palette.sections[bg];
    const vars: Record<string, string> = { ...sectionVars(sec), ...depthVars(sec) };
    // grain follows the section's ink so it stays visible (and tinted) on inverse blocks
    if (sec.scheme !== palette.scheme && textureKind !== "none") vars["lp-grain"] = textureUrl(textureKind, sec.ink, spec.seed);
    blocks.push(`[data-bg="${bg}"]{color-scheme:${sec.scheme};accent-color:${sec.accent};${decls(vars)}}`);
    for (const [k, v] of Object.entries(vars)) tokens[`${bg}:${k}`] = v;
  }
  blocks.push(`::selection{background:${palette.accent};color:${palette.accentInk}}`);

  const attrs: Record<string, string> = {
    "data-arch": d.id,
    "data-btn": d.button,
    "data-card": d.card,
    "data-emphasis": ar && emphasis === "italic" ? "color" : emphasis,
    "data-mask": d.mask,
    "data-glyph": d.glyph,
    "data-texture": textureKind,
    "data-radius": radius.kind,
    "data-shadow": shadowKind,
    "data-surfaces": surfaces,
    "data-motion": motion,
    "data-base": spec.palette.base,
    "data-density": d.density,
  };

  return { css: blocks.join("\n"), tokens, fontIds, fontWeights, attrs, dividers, scheme: palette.scheme };
}
